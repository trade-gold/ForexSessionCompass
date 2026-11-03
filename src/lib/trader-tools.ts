import {
  SESSIONS,
  formatTime,
  getSession,
  getSessionStatus,
  isDstActive,
  overlapsOnUtcDate,
  ukUsTransitionGap,
  type SessionId,
} from "./forex-time";

// ============================================================================
// A. SMART RISK & POSITION CALCULATOR (PRO / ELITE)
// ============================================================================

export interface PairSpec {
  symbol: string;
  label: string;
  base: string;
  quote: string;
  pipSize: number;
  priceDecimals: number;
  contractSize: number; // standard lot units (100,000 for FX, 100 oz for XAU/USD)
  defaultPrice: number; // reference conversion rate (user-editable in UI)
}

export const FOREX_PAIRS: PairSpec[] = [
  { symbol: "EUR/USD", label: "EUR/USD (Euro / US Dollar)", base: "EUR", quote: "USD", pipSize: 0.0001, priceDecimals: 5, contractSize: 100000, defaultPrice: 1.0850 },
  { symbol: "GBP/USD", label: "GBP/USD (British Pound / US Dollar)", base: "GBP", quote: "USD", pipSize: 0.0001, priceDecimals: 5, contractSize: 100000, defaultPrice: 1.2950 },
  { symbol: "USD/JPY", label: "USD/JPY (US Dollar / Japanese Yen)", base: "USD", quote: "JPY", pipSize: 0.01, priceDecimals: 3, contractSize: 100000, defaultPrice: 152.40 },
  { symbol: "AUD/USD", label: "AUD/USD (Australian Dollar / US Dollar)", base: "AUD", quote: "USD", pipSize: 0.0001, priceDecimals: 5, contractSize: 100000, defaultPrice: 0.6580 },
  { symbol: "NZD/USD", label: "NZD/USD (New Zealand Dollar / US Dollar)", base: "NZD", quote: "USD", pipSize: 0.0001, priceDecimals: 5, contractSize: 100000, defaultPrice: 0.5980 },
  { symbol: "USD/CAD", label: "USD/CAD (US Dollar / Canadian Dollar)", base: "USD", quote: "CAD", pipSize: 0.0001, priceDecimals: 5, contractSize: 100000, defaultPrice: 1.3890 },
  { symbol: "USD/CHF", label: "USD/CHF (US Dollar / Swiss Franc)", base: "USD", quote: "CHF", pipSize: 0.0001, priceDecimals: 5, contractSize: 100000, defaultPrice: 0.8650 },
  { symbol: "EUR/JPY", label: "EUR/JPY (Euro / Japanese Yen)", base: "EUR", quote: "JPY", pipSize: 0.01, priceDecimals: 3, contractSize: 100000, defaultPrice: 165.35 },
  { symbol: "GBP/JPY", label: "GBP/JPY (British Pound / Japanese Yen)", base: "GBP", quote: "JPY", pipSize: 0.01, priceDecimals: 3, contractSize: 100000, defaultPrice: 197.35 },
  { symbol: "EUR/GBP", label: "EUR/GBP (Euro / British Pound)", base: "EUR", quote: "GBP", pipSize: 0.0001, priceDecimals: 5, contractSize: 100000, defaultPrice: 0.8380 },
  { symbol: "XAU/USD", label: "XAU/USD (Spot Gold / US Dollar — 100 oz lot)", base: "XAU", quote: "USD", pipSize: 0.1, priceDecimals: 2, contractSize: 100, defaultPrice: 2745.00 },
];

export interface RiskCalculationInput {
  accountBalance: number;
  riskPercent: number;
  stopLossPips: number;
  takeProfitPips?: number | undefined;
  pairSymbol: string;
  pairPrice?: number | undefined; // entry price / current exchange rate
  direction?: "long" | "short" | undefined;
}

export interface RiskCalculationResult {
  valid: boolean;
  error?: string | undefined;
  pair: PairSpec;
  direction: "long" | "short";
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number | null;
  accountBalance: number;
  riskPercent: number;
  riskAmount: number;
  stopLossPips: number;
  takeProfitPips: number;
  pipValuePerStandardLot: number;
  standardLots: number;
  miniLots: number;
  microLots: number;
  units: number;
  potentialLoss: number;
  potentialProfit: number;
  rewardToRiskRatio: number;
  warnings: string[];
}

/**
 * Calculates USD pip value per standard lot (100,000 units FX / 100 oz XAU).
 * Dynamically derives cross-pair quote conversion from the user's entered `priceInput`
 * rather than ignoring `priceInput` on non-USD crosses (EUR/JPY, GBP/JPY, EUR/GBP).
 */
export function getPipValuePerStandardLotUsd(pair: PairSpec, priceInput?: number): number {
  const price = priceInput && priceInput > 0 ? priceInput : pair.defaultPrice;
  const rawQuotePipValue = pair.pipSize * pair.contractSize;

  if (pair.quote === "USD") {
    return rawQuotePipValue;
  }

  if (pair.base === "USD" && price > 0) {
    return rawQuotePipValue / price;
  }

  // Cross pairs (e.g., EUR/JPY, GBP/JPY, EUR/GBP): derive quote/USD rate dynamically from `price`
  const baseUsdPair = FOREX_PAIRS.find((p) => p.base === pair.base && p.quote === "USD");
  if (baseUsdPair && price > 0) {
    // Since Base/Quote = (Base/USD) / (Quote/USD), Quote/USD = (Base/USD) / (Base/Quote)
    const quoteToUsdRate = baseUsdPair.defaultPrice / price;
    return rawQuotePipValue * quoteToUsdRate;
  }

  const usdQuotePair = FOREX_PAIRS.find((p) => p.base === "USD" && p.quote === pair.quote);
  if (usdQuotePair && usdQuotePair.defaultPrice > 0) {
    return rawQuotePipValue / usdQuotePair.defaultPrice;
  }

  return rawQuotePipValue;
}

export function calculatePositionRisk(input: RiskCalculationInput): RiskCalculationResult {
  const pair = FOREX_PAIRS.find((p) => p.symbol === input.pairSymbol) ?? FOREX_PAIRS[0]!;
  const direction = input.direction ?? "long";
  const balance = Number(input.accountBalance);
  const riskPct = Number(input.riskPercent);
  const slPips = Number(input.stopLossPips);
  const tpPips = Number(input.takeProfitPips ?? 0);
  const price = Number(input.pairPrice && input.pairPrice > 0 ? input.pairPrice : pair.defaultPrice);

  const empty: RiskCalculationResult = {
    valid: false,
    pair,
    direction,
    entryPrice: price,
    stopLossPrice: price,
    takeProfitPrice: null,
    accountBalance: balance,
    riskPercent: riskPct,
    riskAmount: 0,
    stopLossPips: slPips,
    takeProfitPips: tpPips,
    pipValuePerStandardLot: 0,
    standardLots: 0,
    miniLots: 0,
    microLots: 0,
    units: 0,
    potentialLoss: 0,
    potentialProfit: 0,
    rewardToRiskRatio: 0,
    warnings: [],
  };

  if (!Number.isFinite(balance) || balance <= 0) {
    return { ...empty, error: "Enter an account balance greater than 0." };
  }
  if (!Number.isFinite(riskPct) || riskPct <= 0 || riskPct > 100) {
    return { ...empty, error: "Enter a risk percentage between 0.01% and 100%." };
  }
  if (!Number.isFinite(slPips) || slPips <= 0) {
    return { ...empty, error: "Enter a stop-loss distance greater than 0 pips." };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return { ...empty, error: "Enter a valid entry price greater than 0." };
  }

  const pipValuePerStandardLot = getPipValuePerStandardLotUsd(pair, price);

  const riskAmount = balance * (riskPct / 100);
  const rawStandardLots = riskAmount / (slPips * pipValuePerStandardLot);
  const standardLots = Math.floor((rawStandardLots + 1e-9) * 100) / 100;
  const miniLots = Math.floor((rawStandardLots * 10 + 1e-9) * 100) / 100;
  const microLots = Math.floor((rawStandardLots * 100 + 1e-9) * 100) / 100;
  const units = Math.round(rawStandardLots * pair.contractSize);

  const slDelta = slPips * pair.pipSize;
  const tpDelta = tpPips * pair.pipSize;
  const stopLossPrice = Number(
    (direction === "long" ? price - slDelta : price + slDelta).toFixed(pair.priceDecimals),
  );
  const takeProfitPrice =
    tpPips > 0
      ? Number(
          (direction === "long" ? price + tpDelta : price - tpDelta).toFixed(pair.priceDecimals),
        )
      : null;

  const potentialLoss = Number((standardLots * slPips * pipValuePerStandardLot).toFixed(2));
  const rewardToRiskRatio = tpPips > 0 ? Number((tpPips / slPips).toFixed(2)) : 0;
  const potentialProfit =
    tpPips > 0 ? Number((standardLots * tpPips * pipValuePerStandardLot).toFixed(2)) : 0;

  const warnings: string[] = [];
  if (riskPct > 2 && riskPct <= 5) {
    warnings.push("Elevated risk: Risking more than 2% on a single trade increases consecutive drawdown exposure.");
  } else if (riskPct > 5) {
    warnings.push("High risk alert: Risking above 5% on one trade can rapidly deplete account equity during losing streaks.");
  }
  if (slPips < 5) {
    warnings.push("Tight stop-loss notice: Stop-losses under 5 pips are vulnerable to normal session spread widening and slippage.");
  }
  if (tpPips > 0 && rewardToRiskRatio < 1) {
    warnings.push(`Sub-1:1 reward-to-risk (${rewardToRiskRatio}:1): Potential reward is smaller than the capital risked.`);
  }
  if (standardLots < 0.01) {
    warnings.push("Account/risk size requires less than 0.01 standard lot (1 micro lot). Consider reducing stop-loss distance or using a micro/cent account.");
  }

  return {
    valid: true,
    pair,
    direction,
    entryPrice: price,
    stopLossPrice,
    takeProfitPrice,
    accountBalance: balance,
    riskPercent: riskPct,
    riskAmount: Number(riskAmount.toFixed(2)),
    stopLossPips: slPips,
    takeProfitPips: tpPips,
    pipValuePerStandardLot: Number(pipValuePerStandardLot.toFixed(2)),
    standardLots,
    miniLots,
    microLots,
    units,
    potentialLoss,
    potentialProfit,
    rewardToRiskRatio,
    warnings,
  };
}

// ============================================================================
// B. TRADER DISCIPLINE GUARDIAN (PRO / ELITE)
// ============================================================================

export interface DisciplineRules {
  maxDailyTrades: number;
  maxDailyLossAmount: number;
  maxRiskPercent: number;
  cooldownMinutes: number;
}

export interface DailyDisciplineLog {
  dateKey: string; // YYYY-MM-DD
  tradesTaken: number;
  realizedLossAmount: number; // positive number representing cumulative loss today
  highestRiskPercentUsed: number;
  lastLossTimestamp: string | null;
  checkedItemIds: string[];
}

export interface DisciplineEvaluation {
  status: "clear" | "caution" | "limit_reached";
  tradesRemaining: number;
  lossBufferRemaining: number;
  cooldownRemainingMinutes: number;
  checklistCompletedCount: number;
  checklistTotalCount: number;
  warnings: string[];
}

export const DEFAULT_DISCIPLINE_CHECKLIST = [
  { id: "session_active", label: "Confirmed target forex session is open and liquid" },
  { id: "news_checked", label: "Checked high-impact economic event blackout windows" },
  { id: "risk_sized", label: "Calculated exact lot size and stop-loss before entry" },
  { id: "plan_aligned", label: "Setup matches written strategy rules (no impulse/FOMO entry)" },
] as const;

export function evaluateDisciplineState(
  rules: DisciplineRules,
  log: DailyDisciplineLog,
  now: Date,
  totalChecklistCount: number = DEFAULT_DISCIPLINE_CHECKLIST.length,
): DisciplineEvaluation {
  const tradesRemaining = Math.max(0, rules.maxDailyTrades - log.tradesTaken);
  const lossBufferRemaining = Math.max(
    0,
    Number((rules.maxDailyLossAmount - log.realizedLossAmount).toFixed(2)),
  );

  let cooldownRemainingMinutes = 0;
  if (log.lastLossTimestamp && rules.cooldownMinutes > 0) {
    const elapsedMs = now.getTime() - new Date(log.lastLossTimestamp).getTime();
    const cooldownMs = rules.cooldownMinutes * 60_000;
    if (elapsedMs >= 0 && elapsedMs < cooldownMs) {
      cooldownRemainingMinutes = Math.ceil((cooldownMs - elapsedMs) / 60_000);
    }
  }

  const warnings: string[] = [];
  let status: DisciplineEvaluation["status"] = "clear";

  if (log.tradesTaken >= rules.maxDailyTrades) {
    status = "limit_reached";
    warnings.push(
      `Daily trade limit reached (${log.tradesTaken}/${rules.maxDailyTrades} trades). Pause live trading for the remainder of the session.`,
    );
  } else if (tradesRemaining === 1 && rules.maxDailyTrades > 1) {
    status = "caution";
    warnings.push("1 trade remaining before reaching your daily trade limit.");
  }

  if (log.realizedLossAmount >= rules.maxDailyLossAmount && rules.maxDailyLossAmount > 0) {
    status = "limit_reached";
    warnings.push(
      `Daily loss limit reached ($${log.realizedLossAmount.toFixed(2)} / $${rules.maxDailyLossAmount.toFixed(2)}). Step away from the desk to protect capital.`,
    );
  } else if (
    rules.maxDailyLossAmount > 0 &&
    log.realizedLossAmount >= rules.maxDailyLossAmount * 0.75
  ) {
    if (status === "clear") status = "caution";
    warnings.push(
      `Approaching daily loss limit ($${lossBufferRemaining.toFixed(2)} buffer remaining).`,
    );
  }

  if (log.highestRiskPercentUsed > rules.maxRiskPercent) {
    if (status === "clear") status = "caution";
    warnings.push(
      `Per-trade risk cap exceeded (${log.highestRiskPercentUsed}% used vs ${rules.maxRiskPercent}% maximum rule).`,
    );
  }

  if (cooldownRemainingMinutes > 0) {
    if (status === "clear") status = "caution";
    warnings.push(
      `Post-loss cooldown active: ${cooldownRemainingMinutes} minute(s) remaining before your next planned setup.`,
    );
  }

  return {
    status,
    tradesRemaining,
    lossBufferRemaining,
    cooldownRemainingMinutes,
    checklistCompletedCount: log.checkedItemIds.length,
    checklistTotalCount: totalChecklistCount,
    warnings,
  };
}

// ============================================================================
// C. TRADE JOURNAL & PERFORMANCE INTELLIGENCE REPORTS (ELITE)
// ============================================================================

export type TradeSessionCategory = SessionId | "overlap";

export interface TradeJournalEntry {
  id: string;
  pair: string;
  direction: "long" | "short";
  session_id: TradeSessionCategory;
  entry_price: number;
  exit_price: number;
  stop_loss: number | null;
  take_profit?: number | null | undefined;
  lot_size: number;
  pnl_amount: number;
  r_multiple: number;
  outcome: "win" | "loss" | "breakeven";
  strategy_tag: string;
  mistake_tag: string;
  notes: string;
  traded_at: string;
}

export const STRATEGY_TAGS = [
  "London Killzone Breakout",
  "NY Overlap Continuation",
  "Asian Range Sweep",
  "HTF Trend Pullback",
  "Support / Resistance Bounce",
  "General",
] as const;

export const MISTAKE_TAGS = [
  "None",
  "FOMO / Chased Entry",
  "Moved Stop-Loss",
  "Overleveraged Position",
  "Traded During News Blackout",
  "Revenge Trade After Loss",
  "Exited Too Early",
] as const;

export interface SessionPerformanceStat {
  sessionId: TradeSessionCategory;
  label: string;
  trades: number;
  wins: number;
  winRate: number;
  netPnl: number;
  avgR: number;
}

export interface PairPerformanceStat {
  pair: string;
  trades: number;
  wins: number;
  winRate: number;
  netPnl: number;
  avgR: number;
}

export interface StrategyPerformanceStat {
  strategy: string;
  trades: number;
  wins: number;
  winRate: number;
  netPnl: number;
  avgR: number;
}

export interface MistakeStat {
  mistake: string;
  count: number;
  totalPnlImpact: number;
}

export interface TradeJournalAnalytics {
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  netPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number | null;
  avgRMultiple: number;
  weeklyNetPnl: number;
  weeklyTrades: number;
  monthlyNetPnl: number;
  monthlyTrades: number;
  bySession: SessionPerformanceStat[];
  byPair: PairPerformanceStat[];
  byStrategy: StrategyPerformanceStat[];
  mistakes: MistakeStat[];
  insights: string[];
}

const SESSION_LABELS: Record<TradeSessionCategory, string> = {
  sydney: "Sydney Session",
  tokyo: "Tokyo Session",
  london: "London Session",
  newyork: "New York Session",
  overlap: "London ∩ NY Overlap",
};

export function classifyTradeSession(at: Date): TradeSessionCategory {
  const lonOpen = getSessionStatus(getSession("london"), at).open;
  const nyOpen = getSessionStatus(getSession("newyork"), at).open;
  if (lonOpen && nyOpen) return "overlap";
  if (lonOpen) return "london";
  if (nyOpen) return "newyork";
  if (getSessionStatus(getSession("tokyo"), at).open) return "tokyo";
  return "sydney";
}

/** Calculates estimated PnL ($), R-Multiple, and outcome from entry, exit, stop-loss, and lot size. */
export function calculateTradeMetrics(input: {
  pairSymbol: string;
  direction: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  stopLossPrice?: number | null | undefined;
  lotSize: number;
}): {
  pipsGained: number;
  pnlAmount: number;
  rMultiple: number;
  outcome: "win" | "loss" | "breakeven";
} {
  const pair = FOREX_PAIRS.find((p) => p.symbol === input.pairSymbol) ?? FOREX_PAIRS[0]!;
  const entry = Number(input.entryPrice);
  const exit = Number(input.exitPrice);
  const lots = Math.max(0.01, Number(input.lotSize) || 0.01);
  const rawPriceDiff = input.direction === "long" ? exit - entry : entry - exit;
  const pipsGained = Number((rawPriceDiff / pair.pipSize).toFixed(1));
  const pipValueStd = getPipValuePerStandardLotUsd(pair, exit > 0 ? exit : entry);
  const pnlAmount = Number((pipsGained * pipValueStd * lots).toFixed(2));

  let rMultiple = 0;
  const sl = Number(input.stopLossPrice ?? 0);
  if (sl > 0 && sl !== entry) {
    const riskDiff = Math.abs(entry - sl);
    if (riskDiff > 0) {
      rMultiple = Number((rawPriceDiff / riskDiff).toFixed(2));
    }
  }

  const outcome: "win" | "loss" | "breakeven" =
    pnlAmount > 0 ? "win" : pnlAmount < 0 ? "loss" : "breakeven";

  return { pipsGained, pnlAmount, rMultiple, outcome };
}

/**
 * Exports trade journal entries to RFC-4180 CSV with formula-injection protection
 * (prefixes string cells starting with =, +, -, @, Tab, or CR with a single quote).
 */
export function exportTradeJournalCsv(entries: TradeJournalEntry[]): string {
  const sanitizeCsvCell = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return String(value);
    const raw = String(value).replace(/\r?\n/g, " ").trim();
    const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    if (/[",]/.test(safe)) {
      return `"${safe.replaceAll('"', '""')}"`;
    }
    return safe;
  };

  const headers = [
    "Trade ID",
    "Date (UTC)",
    "Pair",
    "Direction",
    "Session",
    "Entry Price",
    "Exit Price",
    "Stop Loss",
    "Take Profit",
    "Lot Size",
    "PnL (USD)",
    "R-Multiple",
    "Outcome",
    "Strategy Tag",
    "Mistake Tag",
    "Notes",
  ];

  const rows = entries.map((e) =>
    [
      sanitizeCsvCell(e.id),
      sanitizeCsvCell(e.traded_at),
      sanitizeCsvCell(e.pair),
      sanitizeCsvCell(e.direction),
      sanitizeCsvCell(e.session_id),
      e.entry_price,
      e.exit_price,
      e.stop_loss ?? "",
      e.take_profit ?? "",
      e.lot_size,
      e.pnl_amount,
      e.r_multiple,
      sanitizeCsvCell(e.outcome),
      sanitizeCsvCell(e.strategy_tag),
      sanitizeCsvCell(e.mistake_tag),
      sanitizeCsvCell(e.notes),
    ].join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}

export function analyzeTradeJournal(
  entries: TradeJournalEntry[],
  now: Date = new Date(),
): TradeJournalAnalytics {
  const totalTrades = entries.length;
  const winEntries = entries.filter((e) => e.outcome === "win");
  const lossEntries = entries.filter((e) => e.outcome === "loss");
  const breakevens = entries.filter((e) => e.outcome === "breakeven").length;
  const wins = winEntries.length;
  const losses = lossEntries.length;

  const winRate = totalTrades > 0 ? Number(((wins / totalTrades) * 100).toFixed(1)) : 0;
  const netPnl = Number(entries.reduce((s, e) => s + Number(e.pnl_amount), 0).toFixed(2));
  const grossProfit = winEntries.reduce((s, e) => s + Math.max(0, Number(e.pnl_amount)), 0);
  const grossLoss = Math.abs(lossEntries.reduce((s, e) => s + Math.min(0, Number(e.pnl_amount)), 0));
  const avgWin = wins > 0 ? Number((grossProfit / wins).toFixed(2)) : 0;
  const avgLoss = losses > 0 ? Number((grossLoss / losses).toFixed(2)) : 0;
  const profitFactor =
    grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? null : 0;
  const avgRMultiple =
    totalTrades > 0
      ? Number((entries.reduce((s, e) => s + Number(e.r_multiple), 0) / totalTrades).toFixed(2))
      : 0;

  const sevenDaysAgo = now.getTime() - 7 * 86_400_000;
  const thirtyDaysAgo = now.getTime() - 30 * 86_400_000;

  const weeklyList = entries.filter((e) => new Date(e.traded_at).getTime() >= sevenDaysAgo);
  const monthlyList = entries.filter((e) => new Date(e.traded_at).getTime() >= thirtyDaysAgo);

  const weeklyNetPnl = Number(weeklyList.reduce((s, e) => s + Number(e.pnl_amount), 0).toFixed(2));
  const monthlyNetPnl = Number(monthlyList.reduce((s, e) => s + Number(e.pnl_amount), 0).toFixed(2));

  const sessionCategories: TradeSessionCategory[] = ["sydney", "tokyo", "london", "newyork", "overlap"];
  const bySession: SessionPerformanceStat[] = sessionCategories.map((sid) => {
    const list = entries.filter((e) => e.session_id === sid);
    const w = list.filter((e) => e.outcome === "win").length;
    const pnl = Number(list.reduce((s, e) => s + Number(e.pnl_amount), 0).toFixed(2));
    const r =
      list.length > 0
        ? Number((list.reduce((s, e) => s + Number(e.r_multiple), 0) / list.length).toFixed(2))
        : 0;
    return {
      sessionId: sid,
      label: SESSION_LABELS[sid],
      trades: list.length,
      wins: w,
      winRate: list.length > 0 ? Number(((w / list.length) * 100).toFixed(1)) : 0,
      netPnl: pnl,
      avgR: r,
    };
  });

  // Breakdown by Pair
  const pairGroups = new Map<string, TradeJournalEntry[]>();
  for (const e of entries) {
    const list = pairGroups.get(e.pair) ?? [];
    list.push(e);
    pairGroups.set(e.pair, list);
  }
  const byPair: PairPerformanceStat[] = [...pairGroups.entries()]
    .map(([pair, list]) => {
      const w = list.filter((e) => e.outcome === "win").length;
      const pnl = Number(list.reduce((s, e) => s + Number(e.pnl_amount), 0).toFixed(2));
      const r = Number(
        (list.reduce((s, e) => s + Number(e.r_multiple), 0) / list.length).toFixed(2),
      );
      return {
        pair,
        trades: list.length,
        wins: w,
        winRate: Number(((w / list.length) * 100).toFixed(1)),
        netPnl: pnl,
        avgR: r,
      };
    })
    .sort((a, b) => b.netPnl - a.netPnl);

  // Breakdown by Strategy
  const stratGroups = new Map<string, TradeJournalEntry[]>();
  for (const e of entries) {
    const tag = e.strategy_tag || "General";
    const list = stratGroups.get(tag) ?? [];
    list.push(e);
    stratGroups.set(tag, list);
  }
  const byStrategy: StrategyPerformanceStat[] = [...stratGroups.entries()]
    .map(([strategy, list]) => {
      const w = list.filter((e) => e.outcome === "win").length;
      const pnl = Number(list.reduce((s, e) => s + Number(e.pnl_amount), 0).toFixed(2));
      const r = Number(
        (list.reduce((s, e) => s + Number(e.r_multiple), 0) / list.length).toFixed(2),
      );
      return {
        strategy,
        trades: list.length,
        wins: w,
        winRate: Number(((w / list.length) * 100).toFixed(1)),
        netPnl: pnl,
        avgR: r,
      };
    })
    .sort((a, b) => b.netPnl - a.netPnl);

  const mistakeMap = new Map<string, { count: number; pnl: number }>();
  for (const e of entries) {
    if (!e.mistake_tag || e.mistake_tag === "None") continue;
    const prev = mistakeMap.get(e.mistake_tag) ?? { count: 0, pnl: 0 };
    mistakeMap.set(e.mistake_tag, {
      count: prev.count + 1,
      pnl: Number((prev.pnl + Number(e.pnl_amount)).toFixed(2)),
    });
  }
  const mistakes: MistakeStat[] = [...mistakeMap.entries()]
    .map(([mistake, v]) => ({ mistake, count: v.count, totalPnlImpact: v.pnl }))
    .sort((a, b) => b.count - a.count);

  const insights: string[] = [];
  if (totalTrades > 0) {
    const activeSessions = bySession.filter((s) => s.trades > 0);
    const bestSess = [...activeSessions].sort((a, b) => b.netPnl - a.netPnl)[0];
    const worstSess = [...activeSessions].sort((a, b) => a.netPnl - b.netPnl)[0];
    if (bestSess && bestSess.netPnl > 0) {
      insights.push(
        `Best performing session: ${bestSess.label} (${bestSess.winRate}% win rate, +$${bestSess.netPnl.toFixed(2)} across ${bestSess.trades} trade(s)).`,
      );
    }
    if (worstSess && worstSess.netPnl < 0) {
      insights.push(
        `Weakest session: ${worstSess.label} (-$${Math.abs(worstSess.netPnl).toFixed(2)} across ${worstSess.trades} trade(s)). Consider tightening risk or reducing frequency in this window.`,
      );
    }
    const topPair = byPair[0];
    if (topPair && topPair.netPnl > 0) {
      insights.push(
        `Most profitable instrument: ${topPair.pair} (${topPair.winRate}% win rate, +$${topPair.netPnl.toFixed(2)}, avg ${topPair.avgR}R).`,
      );
    }
    const topMistake = mistakes[0];
    if (topMistake) {
      insights.push(
        `Most frequent execution error: "${topMistake.mistake}" (${topMistake.count} occurrence(s), net PnL impact ${topMistake.totalPnlImpact >= 0 ? "+" : "-"}$${Math.abs(topMistake.totalPnlImpact).toFixed(2)}).`,
      );
    }
  }

  return {
    totalTrades,
    wins,
    losses,
    breakevens,
    winRate,
    netPnl,
    avgWin,
    avgLoss,
    profitFactor,
    avgRMultiple,
    weeklyNetPnl,
    weeklyTrades: weeklyList.length,
    monthlyNetPnl,
    monthlyTrades: monthlyList.length,
    bySession,
    byPair,
    byStrategy,
    mistakes,
    insights,
  };
}

// ============================================================================
// D. SESSION OPPORTUNITY PLANNER & ALERTS (PRO / ELITE)
// ============================================================================

export interface CustomTradingWindow {
  id: string;
  label: string;
  sessionId: SessionId;
  startLocalTime: string; // HH:MM in user's preferred timezone
  endLocalTime: string;
}

export const INSTITUTIONAL_KILLZONE_PRESETS: CustomTradingWindow[] = [
  {
    id: "kz-asian-range",
    label: "Asian Range Liquidity Build (Tokyo)",
    sessionId: "tokyo",
    startLocalTime: "00:00",
    endLocalTime: "05:00",
  },
  {
    id: "kz-london-open",
    label: "London Open Killzone (ICT / Institutional)",
    sessionId: "london",
    startLocalTime: "07:00",
    endLocalTime: "10:00",
  },
  {
    id: "kz-ny-open",
    label: "New York Open Killzone (Peak Overlap)",
    sessionId: "newyork",
    startLocalTime: "12:00",
    endLocalTime: "15:00",
  },
  {
    id: "kz-london-close",
    label: "London Close Reversal Window",
    sessionId: "london",
    startLocalTime: "15:00",
    endLocalTime: "17:00",
  },
];

export interface SessionOpportunityAlert {
  id: string;
  title: string;
  state: "active" | "opening_soon" | "upcoming";
  windowText: string;
  minutesToEvent: number;
}

export function evaluateSessionOpportunities(
  now: Date,
  viewTz: string,
  preferredSessions: SessionId[],
  leadMinutes = 30,
  fmt: "12" | "24" = "24",
): SessionOpportunityAlert[] {
  const alerts: SessionOpportunityAlert[] = [];

  for (const sid of preferredSessions) {
    const s = SESSIONS.find((x) => x.id === sid);
    if (!s) continue;
    const st = getSessionStatus(s, now);
    const diffMin = Math.round((st.nextChange.getTime() - now.getTime()) / 60_000);
    const windowText = `${formatTime(st.todayOpen, viewTz, false, fmt)}–${formatTime(st.todayClose, viewTz, false, fmt)} (${viewTz})`;

    if (st.open) {
      alerts.push({
        id: `sess-${s.id}`,
        title: `${s.name} Session is OPEN`,
        state: "active",
        windowText,
        minutesToEvent: diffMin,
      });
    } else if (diffMin <= leadMinutes) {
      alerts.push({
        id: `sess-${s.id}`,
        title: `${s.name} Session opens in ${diffMin}m`,
        state: "opening_soon",
        windowText,
        minutesToEvent: diffMin,
      });
    } else {
      alerts.push({
        id: `sess-${s.id}`,
        title: `${s.name} Session`,
        state: "upcoming",
        windowText,
        minutesToEvent: diffMin,
      });
    }
  }

  // Also check London ∩ New York overlap today
  const overlaps = overlapsOnUtcDate(
    getSession("london"),
    getSession("newyork"),
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate(),
  );
  const ov = overlaps[0];
  if (ov) {
    const ovText = `${formatTime(ov.start, viewTz, false, fmt)}–${formatTime(ov.end, viewTz, false, fmt)} (${viewTz})`;
    if (now >= ov.start && now < ov.end) {
      alerts.unshift({
        id: "overlap-ln-ny",
        title: "London ∩ New York Overlap is ACTIVE",
        state: "active",
        windowText: ovText,
        minutesToEvent: Math.round((ov.end.getTime() - now.getTime()) / 60_000),
      });
    } else if (ov.start > now) {
      const mToStart = Math.round((ov.start.getTime() - now.getTime()) / 60_000);
      alerts.push({
        id: "overlap-ln-ny",
        title:
          mToStart <= leadMinutes
            ? `London ∩ New York Overlap starts in ${mToStart}m`
            : "London ∩ New York Overlap",
        state: mToStart <= leadMinutes ? "opening_soon" : "upcoming",
        windowText: ovText,
        minutesToEvent: mToStart,
      });
    }
  }

  return alerts;
}

// ============================================================================
// D2. ADVANCED SESSION OVERLAP & WORKSPACE INTELLIGENCE (PRO / ELITE)
// ============================================================================

export interface AdvancedOverlapRow {
  id: string;
  pairLabel: string;
  sessionA: SessionId;
  sessionB: SessionId;
  hasOverlap: boolean;
  isActiveNow: boolean;
  durationMinutes: number;
  localWindow: string;
  utcWindow: string;
  liquidityTier: "Peak Institutional" | "Moderate Cross-Regional" | "Low / Handoff" | "No Direct Overlap";
  focusPairs: string[];
  tradingNotes: string;
}

export interface WorkspacePreferences {
  workspaceName: string;
  primaryTz: string;
  pinnedZones: string[];
  focusPairs: string[];
  defaultOverlapDateOffsetDays: number;
}

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  workspaceName: "London & NY Execution Desk",
  primaryTz: "UTC",
  pinnedZones: ["UTC", "Europe/London", "America/New_York", "Asia/Tokyo"],
  focusPairs: ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD"],
  defaultOverlapDateOffsetDays: 0,
};

const OVERLAP_METADATA: Record<
  string,
  {
    liquidityTier: AdvancedOverlapRow["liquidityTier"];
    focusPairs: string[];
    tradingNotes: string;
  }
> = {
  "london-newyork": {
    liquidityTier: "Peak Institutional",
    focusPairs: ["EUR/USD", "GBP/USD", "XAU/USD", "USD/CAD", "USD/CHF"],
    tradingNotes:
      "Highest daily global FX volume (~70% of interbank turnover). US macro releases at 12:30/13:30 UTC frequently drive trend continuation or reversal.",
  },
  "tokyo-london": {
    liquidityTier: "Moderate Cross-Regional",
    focusPairs: ["EUR/JPY", "GBP/JPY", "EUR/USD", "USD/JPY"],
    tradingNotes:
      "European desk open absorbs late Asian order flow. Watch for Asian range sweeps and London Killzone breakouts on JPY and European crosses.",
  },
  "sydney-tokyo": {
    liquidityTier: "Moderate Cross-Regional",
    focusPairs: ["AUD/JPY", "AUD/USD", "NZD/USD", "USD/JPY"],
    tradingNotes:
      "Primary Asia-Pacific liquidity window. Driven by RBA, BoJ, Australia/China trade releases, and regional equity open.",
  },
  "sydney-newyork": {
    liquidityTier: "Low / Handoff",
    focusPairs: ["AUD/USD", "NZD/USD"],
    tradingNotes:
      "Late New York close / early Sydney rollover window. Spreads commonly widen around 17:00 New York time.",
  },
};

export function evaluateAdvancedOverlapMatrix(
  dateAt: Date,
  viewTz: string,
  now: Date = new Date(),
  fmt: "12" | "24" = "24",
): {
  rows: AdvancedOverlapRow[];
  dstGapWarning: string | null;
  dstActiveSessions: { id: SessionId; name: string; tz: string; dst: boolean }[];
} {
  const y = dateAt.getUTCFullYear();
  const m = dateAt.getUTCMonth() + 1;
  const d = dateAt.getUTCDate();

  const pairs: [SessionId, SessionId][] = [
    ["london", "newyork"],
    ["tokyo", "london"],
    ["sydney", "tokyo"],
    ["sydney", "newyork"],
    ["sydney", "london"],
    ["tokyo", "newyork"],
  ];

  const rows: AdvancedOverlapRow[] = pairs.map(([aId, bId]) => {
    const sA = getSession(aId);
    const sB = getSession(bId);
    const wins = overlapsOnUtcDate(sA, sB, y, m, d);
    const totalMinutes = wins.reduce(
      (sum, w) => sum + Math.round((w.end.getTime() - w.start.getTime()) / 60_000),
      0,
    );
    const isActiveNow = wins.some((w) => now >= w.start && now < w.end);
    const key = `${aId}-${bId}`;
    const meta = OVERLAP_METADATA[key] ?? {
      liquidityTier: totalMinutes > 0 ? "Low / Handoff" : "No Direct Overlap",
      focusPairs: ["EUR/USD", "USD/JPY"],
      tradingNotes:
        totalMinutes > 0
          ? "Seasonal DST transition overlap window."
          : "Sessions do not overlap on this date; expect inter-session liquidity handoff.",
    };

    const localWindow =
      wins.length > 0
        ? wins
            .map(
              (w) =>
                `${formatTime(w.start, viewTz, false, fmt)}–${formatTime(w.end, viewTz, false, fmt)}`,
            )
            .join(", ")
        : "No overlap";

    const utcWindow =
      wins.length > 0
        ? wins
            .map(
              (w) =>
                `${formatTime(w.start, "UTC", false, "24")}–${formatTime(w.end, "UTC", false, "24")} UTC`,
            )
            .join(", ")
        : "—";

    return {
      id: key,
      pairLabel: `${sA.name} ∩ ${sB.name}`,
      sessionA: aId,
      sessionB: bId,
      hasOverlap: wins.length > 0,
      isActiveNow,
      durationMinutes: totalMinutes,
      localWindow,
      utcWindow,
      liquidityTier: wins.length > 0 ? meta.liquidityTier : "No Direct Overlap",
      focusPairs: meta.focusPairs,
      tradingNotes: meta.tradingNotes,
    };
  });

  return {
    rows,
    dstGapWarning: ukUsTransitionGap(dateAt),
    dstActiveSessions: SESSIONS.map((s) => ({
      id: s.id,
      name: s.name,
      tz: s.tz,
      dst: isDstActive(dateAt, s.tz),
    })),
  };
}

// ============================================================================
// E. ECONOMIC EVENT RISK PLANNER (ELITE — MANUAL / USER-VERIFIED SCHEDULE)
// ============================================================================

export interface EconomicRiskEvent {
  id: string;
  title: string;
  currency: string;
  impact: "high" | "medium" | "low";
  event_time: string; // ISO timestamp
  pre_window_minutes: number;
  post_window_minutes: number;
  source_label: string;
  notes: string;
  updated_at: string;
}

export interface HighImpactEventTemplate {
  id: string;
  title: string;
  currency: string;
  impact: "high" | "medium" | "low";
  typicalUtcTime: string; // HH:MM UTC
  pre_window_minutes: number;
  post_window_minutes: number;
  source_label: string;
  notes: string;
}

export const HIGH_IMPACT_EVENT_TEMPLATES: HighImpactEventTemplate[] = [
  {
    id: "us-cpi",
    title: "US Consumer Price Index (CPI m/m & y/y)",
    currency: "USD",
    impact: "high",
    typicalUtcTime: "12:30",
    pre_window_minutes: 30,
    post_window_minutes: 30,
    source_label: "US Bureau of Labor Statistics (Preset)",
    notes: "Flatten or hedge open USD & XAU/USD exposure 30m prior to release.",
  },
  {
    id: "us-nfp",
    title: "US Non-Farm Payrolls (NFP) & Unemployment Rate",
    currency: "USD",
    impact: "high",
    typicalUtcTime: "12:30",
    pre_window_minutes: 30,
    post_window_minutes: 30,
    source_label: "US Bureau of Labor Statistics (Preset)",
    notes: "First Friday of the month; severe spread widening across all USD pairs.",
  },
  {
    id: "fomc-rate",
    title: "FOMC Federal Funds Rate & Press Conference",
    currency: "USD",
    impact: "high",
    typicalUtcTime: "18:00",
    pre_window_minutes: 45,
    post_window_minutes: 60,
    source_label: "Federal Reserve (Preset)",
    notes: "Two-stage volatility wave at 18:00 UTC statement and 18:30 UTC Chair Q&A.",
  },
  {
    id: "ecb-rate",
    title: "ECB Main Refinancing Rate & Monetary Policy Statement",
    currency: "EUR",
    impact: "high",
    typicalUtcTime: "12:15",
    pre_window_minutes: 30,
    post_window_minutes: 45,
    source_label: "European Central Bank (Preset)",
    notes: "Stand aside on EUR/USD, EUR/GBP, and EUR/JPY until press conference settles.",
  },
  {
    id: "boe-rate",
    title: "BoE Official Bank Rate & MPC Vote Split",
    currency: "GBP",
    impact: "high",
    typicalUtcTime: "11:00",
    pre_window_minutes: 30,
    post_window_minutes: 30,
    source_label: "Bank of England (Preset)",
    notes: "High whip-saw risk on GBP/USD and GBP/JPY during London mid-day.",
  },
  {
    id: "boj-rate",
    title: "BoJ Policy Balance Rate & Outlook Report",
    currency: "JPY",
    impact: "high",
    typicalUtcTime: "03:00",
    pre_window_minutes: 45,
    post_window_minutes: 45,
    source_label: "Bank of Japan (Preset)",
    notes: "Unscheduled announcement window during Tokyo session; watch USD/JPY & EUR/JPY.",
  },
];

export interface EvaluatedEconomicEvent extends EconomicRiskEvent {
  blackoutStart: Date;
  blackoutEnd: Date;
  status: "in_blackout" | "approaching" | "upcoming" | "passed";
  minutesUntilEvent: number;
}

export function evaluateEconomicRiskEvents(
  events: EconomicRiskEvent[],
  now: Date,
  currencyFilter = "ALL",
  impactFilter = "ALL",
): {
  activeBlackoutEvents: EvaluatedEconomicEvent[];
  approachingEvents: EvaluatedEconomicEvent[];
  evaluated: EvaluatedEconomicEvent[];
} {
  const filtered = events.filter((e) => {
    const matchCurrency =
      currencyFilter === "ALL" || e.currency.toUpperCase() === currencyFilter.toUpperCase();
    const matchImpact =
      impactFilter === "ALL" || e.impact.toLowerCase() === impactFilter.toLowerCase();
    return matchCurrency && matchImpact;
  });

  const evaluated: EvaluatedEconomicEvent[] = filtered
    .map((ev) => {
      const evTime = new Date(ev.event_time);
      const blackoutStart = new Date(evTime.getTime() - ev.pre_window_minutes * 60_000);
      const blackoutEnd = new Date(evTime.getTime() + ev.post_window_minutes * 60_000);
      const minutesUntilEvent = Math.round((evTime.getTime() - now.getTime()) / 60_000);

      let status: EvaluatedEconomicEvent["status"] = "upcoming";
      if (now >= blackoutStart && now <= blackoutEnd) {
        status = "in_blackout";
      } else if (now > blackoutEnd) {
        status = "passed";
      } else if (blackoutStart.getTime() - now.getTime() <= 60 * 60_000) {
        status = "approaching";
      }

      return {
        ...ev,
        blackoutStart,
        blackoutEnd,
        status,
        minutesUntilEvent,
      };
    })
    .sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime());

  return {
    activeBlackoutEvents: evaluated.filter((e) => e.status === "in_blackout"),
    approachingEvents: evaluated.filter((e) => e.status === "approaching"),
    evaluated,
  };
}
