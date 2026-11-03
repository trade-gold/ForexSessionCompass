import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CalendarClock,
  Calculator,
  CheckCircle2,
  Compass,
  Download,
  Edit3,
  Layers,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useBrand, useClockFormat } from "@/components/BrandProvider";
import { FeatureGate } from "@/components/FeatureGate";
import { meta, PageHeader, ZoneSelect } from "@/components/site";
import { Button } from "@/components/ui/button";
import { useEntitlements } from "@/hooks/use-entitlements";
import { useLocalZone, useNow } from "@/hooks/use-now";
import {
  SESSIONS,
  ZONES,
  formatDate,
  formatTime,
  isDstActive,
  utcOffsetLabel,
  type SessionId,
} from "@/lib/forex-time";
import { FEATURES, type Entitlements } from "@/lib/plans";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_DISCIPLINE_CHECKLIST,
  DEFAULT_WORKSPACE_PREFERENCES,
  FOREX_PAIRS,
  HIGH_IMPACT_EVENT_TEMPLATES,
  INSTITUTIONAL_KILLZONE_PRESETS,
  MISTAKE_TAGS,
  STRATEGY_TAGS,
  analyzeTradeJournal,
  exportTradeJournalCsv,
  calculatePositionRisk,
  calculateTradeMetrics,
  classifyTradeSession,
  evaluateAdvancedOverlapMatrix,
  evaluateDisciplineState,
  evaluateEconomicRiskEvents,
  evaluateSessionOpportunities,
  type DailyDisciplineLog,
  type DisciplineRules,
  type EconomicRiskEvent,
  type TradeJournalEntry,
  type TradeSessionCategory,
  type WorkspacePreferences,
} from "@/lib/trader-tools";

export const Route = createFileRoute("/tools")({
  head: () => ({
    ...meta(
      "Pro & Elite Trader Productivity Suite | Forex Session Compass",
      "Smart Risk & Position Calculator, Trader Discipline Guardian, Session Opportunity Planner, Advanced Session Overlap & Workspace, Trade Journal & Reports, and Economic Event Risk Planner.",
      "/tools",
    ),
    meta: [
      { title: "Pro & Elite Trader Productivity Suite | Forex Session Compass" },
      {
        name: "description",
        content:
          "Smart Risk & Position Calculator, Trader Discipline Guardian, Session Opportunity Planner, Advanced Session Overlap & Workspace, Trade Journal & Reports, and Economic Event Risk Planner.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TraderSuitePage,
});

type ToolTabId = "risk" | "discipline" | "planner" | "workspace" | "journal" | "events";

const TABS: {
  id: ToolTabId;
  label: string;
  tier: "PRO" | "ELITE";
  icon: typeof Calculator;
}[] = [
  { id: "risk", label: "Smart Risk Calculator", tier: "PRO", icon: Calculator },
  { id: "discipline", label: "Discipline Guardian", tier: "PRO", icon: ShieldAlert },
  { id: "planner", label: "Session Opportunity Planner", tier: "PRO", icon: Compass },
  { id: "workspace", label: "Advanced Overlap & Workspace", tier: "PRO", icon: Layers },
  { id: "journal", label: "Trade Journal & Reports", tier: "ELITE", icon: BookOpen },
  { id: "events", label: "Economic Event Risk Planner", tier: "ELITE", icon: CalendarClock },
];

type PreviewMode = "actual" | "owner" | "free" | "pro" | "elite" | "expired";

const PRO_FEATURES = ["overlap_advanced", "workspace", "risk_calculator", "discipline", "planner"];
const ELITE_FEATURES = Object.keys(FEATURES);

function buildPreviewEntitlements(mode: PreviewMode): Entitlements | null | undefined {
  if (mode === "actual") return undefined;
  if (mode === "owner") {
    return {
      plan_id: "owner",
      plan_name: "Owner (all features)",
      status: "active",
      expires_at: null,
      is_admin: true,
      features: ELITE_FEATURES,
    };
  }
  if (mode === "free") {
    return {
      plan_id: "free",
      plan_name: "Free",
      status: "active",
      expires_at: null,
      is_admin: false,
      features: [],
    };
  }
  if (mode === "pro") {
    return {
      plan_id: "pro",
      plan_name: "Pro",
      status: "active",
      expires_at: "2030-01-01T00:00:00Z",
      is_admin: false,
      features: PRO_FEATURES,
    };
  }
  if (mode === "elite") {
    return {
      plan_id: "elite",
      plan_name: "Elite",
      status: "active",
      expires_at: "2030-01-01T00:00:00Z",
      is_admin: false,
      features: ELITE_FEATURES,
    };
  }
  return {
    plan_id: "pro",
    plan_name: "Pro",
    status: "expired",
    expires_at: "2020-01-01T00:00:00Z",
    is_admin: false,
    features: [],
  };
}

function TraderSuitePage() {
  const { session, isAdmin } = useAuth();
  const ent = useEntitlements();
  const [activeTab, setActiveTab] = useState<ToolTabId>("risk");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("actual");

  // Support deep linking via ?tool=risk|discipline|planner|workspace|journal|events
  // while keeping every tool wrapped in <FeatureGate> so URL parameters never bypass subscription checks.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tool") as ToolTabId | null;
      if (t && TABS.some((x) => x.id === t)) {
        setActiveTab(t);
      }
    } catch {
      // Ignore SSR/URL errors
    }
  }, []);

  const selectTab = (tabId: ToolTabId) => {
    setActiveTab(tabId);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tool", tabId);
      window.history.replaceState({}, "", url.toString());
    } catch {
      // Ignore history errors
    }
  };

  const overrideEnt = isAdmin ? buildPreviewEntitlements(previewMode) : undefined;
  const activePlanLabel =
    overrideEnt !== undefined
      ? `${overrideEnt?.plan_name ?? "None"} (${overrideEnt?.status === "expired" ? "Expired" : "Simulated"})`
      : ent.data?.plan_name ?? (isAdmin ? "Owner (all features)" : session ? "Free" : "Guest (Not logged in)");

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader eyebrow="Subscription Productivity Platform" title="Trader Productivity Suite">
          Position risk sizing, discipline rules, session opportunity alerts, multi-timezone workspace, trade journal analytics, and manual economic blackout planning. Educational decision-support only—not financial advice.
        </PageHeader>
        <div className="rounded-lg border bg-panel px-4 py-3 text-xs">
          <p className="text-muted-foreground">Active Entitlement Tier</p>
          <p className="mt-0.5 font-mono text-sm font-bold text-up">{activePlanLabel}</p>
          <Link to="/pricing" className="mt-1 inline-block text-info hover:underline">
            View plans & billing →
          </Link>
        </div>
      </div>

      {/* Owner/Admin Plan Simulator Bar */}
      {isAdmin && (
        <div className="rounded-xl border border-info/40 bg-info/10 p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-info" />
              <span className="font-semibold text-foreground">
                Owner / Administrator Plan Testing Switcher:
              </span>
              <span className="text-muted-foreground">
                Preview how Free, Pro, Elite, and Expired accounts experience subscription locks.
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "actual", label: "Owner Full Access" },
                  { id: "free", label: "Test as FREE" },
                  { id: "pro", label: "Test as PRO" },
                  { id: "elite", label: "Test as ELITE" },
                  { id: "expired", label: "Test as EXPIRED" },
                ] as const
              ).map((m) => (
                <Button
                  key={m.id}
                  type="button"
                  size="sm"
                  variant={previewMode === m.id ? "default" : "outline"}
                  onClick={() => setPreviewMode(m.id)}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tool Navigation Tabs */}
      <nav className="flex flex-wrap gap-2 border-b pb-4" aria-label="Trader productivity tools">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors ${
                active
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-panel text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 text-info" />
              <span>{t.label}</span>
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                  t.tier === "ELITE" ? "bg-info/20 text-info" : "bg-up/20 text-up"
                }`}
              >
                {t.tier}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Tool Panels Wrapped in FeatureGate */}
      {activeTab === "risk" && (
        <FeatureGate feature="risk_calculator" overrideEntitlements={overrideEnt}>
          <SmartRiskCalculatorTool />
        </FeatureGate>
      )}
      {activeTab === "discipline" && (
        <FeatureGate feature="discipline" overrideEntitlements={overrideEnt}>
          <DisciplineGuardianTool />
        </FeatureGate>
      )}
      {activeTab === "planner" && (
        <FeatureGate feature="planner" overrideEntitlements={overrideEnt}>
          <SessionOpportunityPlannerTool />
        </FeatureGate>
      )}
      {activeTab === "workspace" && (
        <FeatureGate feature="overlap_advanced" overrideEntitlements={overrideEnt}>
          <AdvancedOverlapWorkspaceTool />
        </FeatureGate>
      )}
      {activeTab === "journal" && (
        <FeatureGate feature="journal" overrideEntitlements={overrideEnt}>
          <TradeJournalAndReportsTool />
        </FeatureGate>
      )}
      {activeTab === "events" && (
        <FeatureGate feature="events" overrideEntitlements={overrideEnt}>
          <EconomicEventRiskPlannerTool />
        </FeatureGate>
      )}
    </div>
  );
}

// ============================================================================
// TOOL A: SMART RISK & POSITION CALCULATOR (PRO)
// ============================================================================

function SmartRiskCalculatorTool() {
  const [balance, setBalance] = useState("10000");
  const [riskPct, setRiskPct] = useState("1.0");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [slPips, setSlPips] = useState("20");
  const [tpPips, setTpPips] = useState("40");
  const [pairSymbol, setPairSymbol] = useState("EUR/USD");
  const [entryPriceInput, setEntryPriceInput] = useState("1.0850");

  const selectedPair = FOREX_PAIRS.find((p) => p.symbol === pairSymbol) ?? FOREX_PAIRS[0]!;
  const result = calculatePositionRisk({
    accountBalance: Number(balance),
    riskPercent: Number(riskPct),
    stopLossPips: Number(slPips),
    takeProfitPips: tpPips ? Number(tpPips) : 0,
    pairSymbol,
    pairPrice: entryPriceInput ? Number(entryPriceInput) : selectedPair.defaultPrice,
    direction,
  });

  return (
    <section className="grid gap-6 lg:grid-cols-2" aria-label="Smart Risk and Position Calculator">
      <div className="panel space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">A. Smart Risk & Position Size Calculator</h2>
          <span className="rounded bg-up/15 px-2 py-0.5 font-mono text-xs text-up">PRO</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Calculate exact standard, mini, and micro lot sizes, monetary risk, pip value, stop-loss price, and reward-to-risk ratio across major Forex pairs and XAU/USD.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="rc-balance" className="mb-1 block text-xs text-muted-foreground">
              Account Balance (USD)
            </label>
            <input
              id="rc-balance"
              type="number"
              min="1"
              step="any"
              className="field font-mono"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="rc-risk" className="mb-1 block text-xs text-muted-foreground">
              Risk Per Trade (%)
            </label>
            <input
              id="rc-risk"
              type="number"
              min="0.01"
              max="100"
              step="0.1"
              className="field font-mono"
              value={riskPct}
              onChange={(e) => setRiskPct(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="rc-pair" className="mb-1 block text-xs text-muted-foreground">
              Currency Pair / Instrument
            </label>
            <select
              id="rc-pair"
              className="field"
              value={pairSymbol}
              onChange={(e) => {
                const sym = e.target.value;
                setPairSymbol(sym);
                const found = FOREX_PAIRS.find((p) => p.symbol === sym);
                if (found) setEntryPriceInput(String(found.defaultPrice));
              }}
            >
              {FOREX_PAIRS.map((p) => (
                <option key={p.symbol} value={p.symbol}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rc-dir" className="mb-1 block text-xs text-muted-foreground">
              Trade Direction
            </label>
            <select
              id="rc-dir"
              className="field"
              value={direction}
              onChange={(e) => setDirection(e.target.value as "long" | "short")}
            >
              <option value="long">Long (Buy)</option>
              <option value="short">Short (Sell)</option>
            </select>
          </div>
          <div>
            <label htmlFor="rc-price" className="mb-1 block text-xs text-muted-foreground">
              Entry Price
            </label>
            <input
              id="rc-price"
              type="number"
              min="0.0001"
              step="any"
              placeholder={String(selectedPair.defaultPrice)}
              className="field font-mono"
              value={entryPriceInput}
              onChange={(e) => setEntryPriceInput(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="rc-sl" className="mb-1 block text-xs text-muted-foreground">
              Stop-Loss Distance (Pips)
            </label>
            <input
              id="rc-sl"
              type="number"
              min="0.1"
              step="0.5"
              className="field font-mono"
              value={slPips}
              onChange={(e) => setSlPips(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="rc-tp" className="mb-1 block text-xs text-muted-foreground">
              Take-Profit Distance (Pips, optional — used for R:R & target price)
            </label>
            <input
              id="rc-tp"
              type="number"
              min="0"
              step="0.5"
              className="field font-mono"
              value={tpPips}
              onChange={(e) => setTpPips(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="panel space-y-4 p-6">
        <h3 className="text-base font-semibold">Calculated Position Size & Risk Profile</h3>
        {!result.valid ? (
          <p role="alert" className="rounded border border-destructive/50 bg-destructive/10 p-3 text-xs">
            {result.error}
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-up/40 bg-panel p-4">
                <p className="text-xs text-muted-foreground">Standard Lots</p>
                <p className="mt-1 font-mono text-2xl font-bold text-up">
                  {result.standardLots.toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg border bg-panel p-4">
                <p className="text-xs text-muted-foreground">Mini Lots (0.1)</p>
                <p className="mt-1 font-mono text-2xl font-bold">{result.miniLots.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border bg-panel p-4">
                <p className="text-xs text-muted-foreground">Micro Lots (0.01)</p>
                <p className="mt-1 font-mono text-2xl font-bold">{result.microLots.toFixed(2)}</p>
              </div>
            </div>

            <dl className="grid gap-3 rounded-lg border bg-panel p-4 text-xs sm:grid-cols-2">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Capital at Risk ({result.riskPercent}%)</dt>
                <dd className="font-mono font-semibold text-foreground">
                  ${result.riskAmount.toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Estimated Loss at SL</dt>
                <dd className="font-mono font-semibold text-destructive">
                  -${result.potentialLoss.toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Pip Value (1.00 Lot)</dt>
                <dd className="font-mono">${result.pipValuePerStandardLot.toFixed(2)} / pip</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Position Size (Units)</dt>
                <dd className="font-mono">{result.units.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Stop-Loss Price ({result.direction.toUpperCase()})</dt>
                <dd className="font-mono font-semibold text-destructive">
                  {result.stopLossPrice.toFixed(result.pair.priceDecimals)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Take-Profit Price</dt>
                <dd className="font-mono font-semibold text-up">
                  {result.takeProfitPrice !== null
                    ? result.takeProfitPrice.toFixed(result.pair.priceDecimals)
                    : "Not set"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Reward-to-Risk (R:R)</dt>
                <dd className="font-mono font-semibold text-info">
                  {result.rewardToRiskRatio > 0 ? `${result.rewardToRiskRatio} : 1` : "Not set"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Estimated Profit at TP</dt>
                <dd className="font-mono font-semibold text-up">
                  {result.potentialProfit > 0 ? `+$${result.potentialProfit.toFixed(2)}` : "—"}
                </dd>
              </div>
            </dl>

            {result.warnings.length > 0 ? (
              <div className="space-y-2">
                {result.warnings.map((w) => (
                  <div
                    key={w}
                    role="alert"
                    className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-up/40 bg-up/10 p-3 text-xs text-up">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Risk parameters are within conservative institutional guidelines (≤2% risk, ≥1:1 R:R).</span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// TOOL B: TRADER DISCIPLINE GUARDIAN (PRO)
// ============================================================================

function DisciplineGuardianTool() {
  const { session } = useAuth();
  const now = useNow() ?? new Date();
  const todayKey = now.toISOString().slice(0, 10);

  const [rules, setRules] = useState<DisciplineRules>({
    maxDailyTrades: 3,
    maxDailyLossAmount: 200,
    maxRiskPercent: 1.5,
    cooldownMinutes: 30,
  });
  const [checklistItems, setChecklistItems] = useState<{ id: string; label: string }[]>([
    ...DEFAULT_DISCIPLINE_CHECKLIST,
  ]);
  const [newCheckItemLabel, setNewCheckItemLabel] = useState("");
  const [log, setLog] = useState<DailyDisciplineLog>({
    dateKey: todayKey,
    tradesTaken: 0,
    realizedLossAmount: 0,
    highestRiskPercentUsed: 1.0,
    lastLossTimestamp: null,
    checkedItemIds: [],
  });
  const [lossInput, setLossInput] = useState("50");
  const [riskInput, setRiskInput] = useState("1.0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    try {
      const localRules = localStorage.getItem("fsc_discipline_rules");
      if (localRules) setRules((prev) => ({ ...prev, ...JSON.parse(localRules) }));
      const localItems = localStorage.getItem("fsc_discipline_checklist");
      if (localItems) {
        const parsed = JSON.parse(localItems);
        if (Array.isArray(parsed) && parsed.length > 0) setChecklistItems(parsed);
      }
      const localLog = localStorage.getItem(`fsc_discipline_log_${todayKey}`);
      if (localLog) setLog((prev) => ({ ...prev, ...JSON.parse(localLog) }));
    } catch {
      // Ignore storage errors
    }
    if (!session) {
      setLoading(false);
      return;
    }
    void (async () => {
      const { data, error } = await supabase
        .from("trader_discipline_rules")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setLoading(false);
      if (error) {
        setErrorMsg(`Could not load saved discipline rules: ${error.message}`);
        return;
      }
      if (data) {
        setRules({
          maxDailyTrades: Number(data.max_daily_trades ?? 3),
          maxDailyLossAmount: Number(data.max_daily_loss_amount ?? 200),
          maxRiskPercent: Number(data.max_risk_percent ?? 1.5),
          cooldownMinutes: Number(data.cooldown_minutes ?? 30),
        });
        if (Array.isArray(data.checklist_items) && data.checklist_items.length > 0) {
          setChecklistItems(data.checklist_items as { id: string; label: string }[]);
        }
        const dl = data.daily_log as Partial<DailyDisciplineLog> | null;
        if (dl && dl.dateKey === todayKey) {
          setLog((prev) => ({ ...prev, ...dl }));
        }
      }
    })();
  }, [session, todayKey]);

  const persistDiscipline = async (
    nextRules: DisciplineRules,
    nextLog: DailyDisciplineLog,
    nextChecklist = checklistItems,
  ) => {
    setRules(nextRules);
    setLog(nextLog);
    setChecklistItems(nextChecklist);
    try {
      localStorage.setItem("fsc_discipline_rules", JSON.stringify(nextRules));
      localStorage.setItem("fsc_discipline_checklist", JSON.stringify(nextChecklist));
      localStorage.setItem(`fsc_discipline_log_${todayKey}`, JSON.stringify(nextLog));
    } catch {
      // Ignore storage errors
    }
    if (!session) return;
    setSaving(true);
    setStatusMsg(null);
    setErrorMsg(null);
    const { error } = await supabase.from("trader_discipline_rules").upsert({
      user_id: session.user.id,
      max_daily_trades: nextRules.maxDailyTrades,
      max_daily_loss_amount: nextRules.maxDailyLossAmount,
      max_risk_percent: nextRules.maxRiskPercent,
      cooldown_minutes: nextRules.cooldownMinutes,
      checklist_items: nextChecklist,
      daily_log: nextLog,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      setErrorMsg(`Database sync failed (${error.message}). Progress saved in browser.`);
    } else {
      setStatusMsg("Discipline rules and daily progress saved to your account.");
    }
  };

  const evaluation = evaluateDisciplineState(rules, log, now, checklistItems.length);

  const toggleChecklist = (id: string) => {
    const exists = log.checkedItemIds.includes(id);
    const nextIds = exists
      ? log.checkedItemIds.filter((x) => x !== id)
      : [...log.checkedItemIds, id];
    void persistDiscipline(rules, { ...log, checkedItemIds: nextIds }, checklistItems);
  };

  const addChecklistItem = () => {
    const label = newCheckItemLabel.trim();
    if (!label) return;
    const nextItems = [...checklistItems, { id: `custom_${Date.now()}`, label }];
    setNewCheckItemLabel("");
    void persistDiscipline(rules, log, nextItems);
  };

  const removeChecklistItem = (id: string) => {
    if (checklistItems.length <= 1) return;
    const nextItems = checklistItems.filter((x) => x.id !== id);
    const nextChecked = log.checkedItemIds.filter((x) => x !== id);
    void persistDiscipline(rules, { ...log, checkedItemIds: nextChecked }, nextItems);
  };

  return (
    <section className="space-y-6" aria-label="Trader Discipline Guardian">
      <div className="panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">B. Trader Discipline Guardian</h2>
            <p className="text-xs text-muted-foreground">
              Track your daily trade count, realized loss limit, post-loss cooldown timer, and pre-trade checklist.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 font-mono text-xs font-bold uppercase ${
              evaluation.status === "clear"
                ? "bg-up/15 text-up"
                : evaluation.status === "caution"
                  ? "bg-info/15 text-info"
                  : "bg-destructive/20 text-destructive"
            }`}
          >
            {evaluation.status === "clear"
              ? "Discipline Clear"
              : evaluation.status === "caution"
                ? "Caution — Near Limit"
                : "Daily Limit Reached"}
          </span>
        </div>

        {loading && (
          <p className="mt-3 text-xs text-muted-foreground">Loading your saved discipline rules…</p>
        )}

        {evaluation.warnings.length > 0 && (
          <div className="mt-4 space-y-2">
            {evaluation.warnings.map((w) => (
              <div
                key={w}
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Daily Summary Cards */}
        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg border bg-panel p-4">
            <p className="text-xs text-muted-foreground">Trades Today ({todayKey})</p>
            <p className="mt-1 font-mono text-2xl font-bold">
              {log.tradesTaken} / {rules.maxDailyTrades}
            </p>
            <p className="text-xs text-muted-foreground">{evaluation.tradesRemaining} remaining</p>
          </div>
          <div className="rounded-lg border bg-panel p-4">
            <p className="text-xs text-muted-foreground">Realized Loss Today</p>
            <p className="mt-1 font-mono text-2xl font-bold">
              ${log.realizedLossAmount.toFixed(2)} / ${rules.maxDailyLossAmount.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              ${evaluation.lossBufferRemaining.toFixed(2)} buffer left
            </p>
          </div>
          <div className="rounded-lg border bg-panel p-4">
            <p className="text-xs text-muted-foreground">Cooldown Timer</p>
            <p className="mt-1 font-mono text-2xl font-bold text-info">
              {evaluation.cooldownRemainingMinutes > 0
                ? `${evaluation.cooldownRemainingMinutes}m left`
                : "Ready"}
            </p>
            <p className="text-xs text-muted-foreground">Rule: {rules.cooldownMinutes}m after loss</p>
          </div>
          <div className="rounded-lg border bg-panel p-4">
            <p className="text-xs text-muted-foreground">Pre-Trade Checklist</p>
            <p className="mt-1 font-mono text-2xl font-bold text-up">
              {evaluation.checklistCompletedCount} / {evaluation.checklistTotalCount}
            </p>
            <p className="text-xs text-muted-foreground">Completed today</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Rule Configuration */}
          <div className="space-y-4 rounded-lg border bg-panel p-4">
            <h3 className="text-sm font-semibold">1. Configure Personal Daily Trading Rules</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="dg-max-trades" className="mb-1 block text-xs text-muted-foreground">
                  Daily Trade Limit
                </label>
                <input
                  id="dg-max-trades"
                  type="number"
                  min="1"
                  max="50"
                  className="field font-mono"
                  value={rules.maxDailyTrades}
                  onChange={(e) =>
                    setRules({ ...rules, maxDailyTrades: Math.max(1, Number(e.target.value)) })
                  }
                />
              </div>
              <div>
                <label htmlFor="dg-max-loss" className="mb-1 block text-xs text-muted-foreground">
                  Daily Loss Limit ($)
                </label>
                <input
                  id="dg-max-loss"
                  type="number"
                  min="10"
                  step="10"
                  className="field font-mono"
                  value={rules.maxDailyLossAmount}
                  onChange={(e) =>
                    setRules({ ...rules, maxDailyLossAmount: Math.max(0, Number(e.target.value)) })
                  }
                />
              </div>
              <div>
                <label htmlFor="dg-max-risk" className="mb-1 block text-xs text-muted-foreground">
                  Max Risk Per Trade (%)
                </label>
                <input
                  id="dg-max-risk"
                  type="number"
                  min="0.1"
                  max="20"
                  step="0.1"
                  className="field font-mono"
                  value={rules.maxRiskPercent}
                  onChange={(e) =>
                    setRules({ ...rules, maxRiskPercent: Math.max(0.1, Number(e.target.value)) })
                  }
                />
              </div>
              <div>
                <label htmlFor="dg-cooldown" className="mb-1 block text-xs text-muted-foreground">
                  Cooldown Timer After Loss / Limit (Min)
                </label>
                <input
                  id="dg-cooldown"
                  type="number"
                  min="0"
                  max="1440"
                  className="field font-mono"
                  value={rules.cooldownMinutes}
                  onChange={(e) =>
                    setRules({ ...rules, cooldownMinutes: Math.max(0, Number(e.target.value)) })
                  }
                />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => void persistDiscipline(rules, log, checklistItems)}
            >
              {saving ? "Saving…" : "Save Discipline Rules"}
            </Button>
          </div>

          {/* Daily Trade Check-In & Pre-Trade Checklist */}
          <div className="space-y-4 rounded-lg border bg-panel p-4">
            <h3 className="text-sm font-semibold">2. Daily Discipline Checklist & Trade Tracking</h3>
            <div className="space-y-2">
              {checklistItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={log.checkedItemIds.includes(item.id)}
                      onChange={() => toggleChecklist(item.id)}
                      className="accent-primary"
                    />
                    <span>{item.label}</span>
                  </label>
                  {checklistItems.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove checklist item ${item.label}`}
                      onClick={() => removeChecklistItem(item.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add custom checklist rule…"
                maxLength={120}
                className="field flex-1 py-1 text-xs"
                value={newCheckItemLabel}
                onChange={(e) => setNewCheckItemLabel(e.target.value)}
              />
              <Button type="button" size="sm" variant="outline" onClick={addChecklistItem}>
                + Add Rule
              </Button>
            </div>

            <div className="border-t pt-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Record Today's Trade Execution
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="number"
                  aria-label="Loss amount if losing trade"
                  placeholder="Loss $ (if loss)"
                  className="field py-1 font-mono text-xs"
                  value={lossInput}
                  onChange={(e) => setLossInput(e.target.value)}
                />
                <input
                  type="number"
                  aria-label="Risk percent used"
                  placeholder="Risk % used"
                  className="field py-1 font-mono text-xs"
                  value={riskInput}
                  onChange={(e) => setRiskInput(e.target.value)}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    void persistDiscipline(
                      rules,
                      {
                        ...log,
                        tradesTaken: log.tradesTaken + 1,
                        highestRiskPercentUsed: Math.max(
                          log.highestRiskPercentUsed,
                          Number(riskInput) || 0,
                        ),
                      },
                      checklistItems,
                    )
                  }
                >
                  + Log Winning / Breakeven Trade
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    void persistDiscipline(
                      rules,
                      {
                        ...log,
                        tradesTaken: log.tradesTaken + 1,
                        realizedLossAmount:
                          log.realizedLossAmount + Math.max(0, Number(lossInput) || 0),
                        highestRiskPercentUsed: Math.max(
                          log.highestRiskPercentUsed,
                          Number(riskInput) || 0,
                        ),
                        lastLossTimestamp: new Date().toISOString(),
                      },
                      checklistItems,
                    )
                  }
                >
                  + Log Losing Trade (Start Cooldown)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void persistDiscipline(
                      rules,
                      {
                        dateKey: todayKey,
                        tradesTaken: 0,
                        realizedLossAmount: 0,
                        highestRiskPercentUsed: 0,
                        lastLossTimestamp: null,
                        checkedItemIds: [],
                      },
                      checklistItems,
                    )
                  }
                >
                  Reset Today
                </Button>
              </div>
            </div>
          </div>
        </div>
        {statusMsg && (
          <p role="status" className="mt-3 font-mono text-xs text-up">
            {statusMsg}
          </p>
        )}
        {errorMsg && (
          <p role="alert" className="mt-3 font-mono text-xs text-destructive">
            {errorMsg}
          </p>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// TOOL C: SESSION OPPORTUNITY PLANNER & ALERTS (PRO)
// ============================================================================

function SessionOpportunityPlannerTool() {
  const { session } = useAuth();
  const { fmt, preferredTz, setPreferredTz } = useBrand();
  const localZone = useLocalZone();
  const now = useNow() ?? new Date();
  const viewTz = preferredTz ?? localZone;

  const [preferredSessions, setPreferredSessions] = useState<SessionId[]>(["london", "newyork"]);
  const [leadMinutes, setLeadMinutes] = useState(30);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );
  const [windowLabel, setWindowLabel] = useState("");
  const [windowStart, setWindowStart] = useState("13:00");
  const [windowEnd, setWindowEnd] = useState("17:00");
  const [customWindows, setCustomWindows] = useState<
    { id: string; label: string; start: string; end: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const notifiedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    try {
      const saved = localStorage.getItem("fsc_session_planner");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.preferredSessions)) setPreferredSessions(parsed.preferredSessions);
        if (typeof parsed.leadMinutes === "number") setLeadMinutes(parsed.leadMinutes);
        if (typeof parsed.notificationsEnabled === "boolean") {
          setNotificationsEnabled(parsed.notificationsEnabled);
        }
        if (Array.isArray(parsed.customWindows)) setCustomWindows(parsed.customWindows);
      }
    } catch {
      // Ignore storage errors
    }
    if (!session) {
      setLoading(false);
      return;
    }
    void (async () => {
      const { data, error } = await supabase
        .from("session_planner_configs")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setLoading(false);
      if (error) {
        setErrorNotice(`Could not fetch saved planner preferences: ${error.message}`);
        return;
      }
      if (data) {
        if (Array.isArray(data.preferred_sessions) && data.preferred_sessions.length > 0) {
          setPreferredSessions(data.preferred_sessions as SessionId[]);
        }
        if (typeof data.alert_lead_minutes === "number") {
          setLeadMinutes(data.alert_lead_minutes);
        }
        if (typeof data.notifications_enabled === "boolean") {
          setNotificationsEnabled(data.notifications_enabled);
        }
        if (Array.isArray(data.preferred_windows)) {
          setCustomWindows(
            data.preferred_windows as { id: string; label: string; start: string; end: string }[],
          );
        }
      }
    })();
  }, [session]);

  const savePlannerConfig = async (
    nextSessions = preferredSessions,
    nextLead = leadMinutes,
    nextWindows = customWindows,
    nextNotif = notificationsEnabled,
  ) => {
    setPreferredSessions(nextSessions);
    setLeadMinutes(nextLead);
    setCustomWindows(nextWindows);
    setNotificationsEnabled(nextNotif);
    try {
      localStorage.setItem(
        "fsc_session_planner",
        JSON.stringify({
          preferredSessions: nextSessions,
          leadMinutes: nextLead,
          customWindows: nextWindows,
          notificationsEnabled: nextNotif,
        }),
      );
    } catch {
      // Ignore storage errors
    }
    if (!session) return;
    setErrorNotice(null);
    const { error } = await supabase.from("session_planner_configs").upsert({
      user_id: session.user.id,
      preferred_sessions: nextSessions,
      preferred_windows: nextWindows,
      alert_lead_minutes: nextLead,
      notifications_enabled: nextNotif,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      setErrorNotice(`Database save failed (${error.message}). Saved in browser.`);
    } else {
      setSaveNotice("Session planner & alert preferences saved to your account.");
    }
  };

  const requestBrowserNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifPermission("unsupported");
      setErrorNotice("Browser notifications are not supported in this browser environment.");
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === "granted") {
      await savePlannerConfig(preferredSessions, leadMinutes, customWindows, true);
      try {
        new Notification("Forex Session Compass — Alerts Enabled", {
          body: `You will receive browser alerts ${leadMinutes} minutes before your selected sessions open.`,
        });
      } catch {
        // Ignore notification constructor restrictions
      }
    } else if (perm === "denied") {
      setErrorNotice(
        "Browser notification permission was denied. Enable notifications for this site in your browser settings.",
      );
    }
  };

  const sendTestNotification = () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setErrorNotice("Browser notifications are not supported in this browser.");
      return;
    }
    if (Notification.permission !== "granted") {
      void requestBrowserNotificationPermission();
      return;
    }
    try {
      new Notification("Forex Session Compass — Session Alert Test", {
        body: `Active timezone: ${viewTz}. Lead time: ${leadMinutes}m before open.`,
      });
      setSaveNotice("Sent a live browser notification.");
    } catch {
      setErrorNotice("Browser blocked the notification pop-up.");
    }
  };

  const opportunities = evaluateSessionOpportunities(now, viewTz, preferredSessions, leadMinutes, fmt);

  // Automatically trigger browser notification when a tracked session enters opening_soon
  useEffect(() => {
    if (
      !notificationsEnabled ||
      typeof window === "undefined" ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) {
      return;
    }
    const dayKey = now.toISOString().slice(0, 10);
    for (const op of opportunities) {
      if (op.state === "opening_soon") {
        const dedupeKey = `${dayKey}:${op.id}`;
        if (!notifiedKeysRef.current.has(dedupeKey)) {
          notifiedKeysRef.current.add(dedupeKey);
          try {
            new Notification(`Forex Session Compass: ${op.title}`, {
              body: `Scheduled window: ${op.windowText}`,
            });
          } catch {
            // Ignore notification errors
          }
        }
      }
    }
  }, [notificationsEnabled, opportunities, now]);

  return (
    <section className="space-y-6" aria-label="Session Opportunity Planner and Alerts">
      <div className="panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">C. Session Opportunity Planner & Alerts</h2>
            <p className="text-xs text-muted-foreground">
              Select your target trading sessions, configure upcoming-session alert lead times, enable browser notifications, and save custom trading windows.
            </p>
          </div>
          <div className="w-64">
            <label htmlFor="sp-tz" className="mb-1 block text-xs text-muted-foreground">
              Planner Timezone
            </label>
            <ZoneSelect id="sp-tz" value={viewTz} extra={viewTz} onChange={setPreferredTz} />
          </div>
        </div>

        {loading && (
          <p className="mt-3 text-xs text-muted-foreground">Loading your session planner settings…</p>
        )}

        {/* Live Session Opportunity Alerts */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {opportunities.map((op) => (
            <div
              key={op.id}
              className={`rounded-lg border p-4 ${
                op.state === "active"
                  ? "border-up/60 bg-up/10"
                  : op.state === "opening_soon"
                    ? "border-info/60 bg-info/10"
                    : "bg-panel"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{op.title}</span>
                <span
                  className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                    op.state === "active"
                      ? "bg-up/20 text-up"
                      : op.state === "opening_soon"
                        ? "bg-info/20 text-info"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {op.state === "active"
                    ? "ACTIVE NOW"
                    : op.state === "opening_soon"
                      ? "OPENING SOON"
                      : "SCHEDULED"}
                </span>
              </div>
              <p className="mt-2 font-mono text-xs text-muted-foreground">{op.windowText}</p>
              <p className="mt-1 font-mono text-[11px] text-info">
                {op.state === "active"
                  ? `Closes in ${op.minutesToEvent}m`
                  : `Opens in ${op.minutesToEvent}m`}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Preferred Sessions, Lead Time & Browser Notifications */}
          <div className="space-y-4 rounded-lg border bg-panel p-4">
            <h3 className="text-sm font-semibold">1. Sessions, Lead Time & Browser Notifications</h3>
            <div className="flex flex-wrap gap-3">
              {SESSIONS.map((s) => {
                const checked = preferredSessions.includes(s.id);
                return (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...preferredSessions, s.id]
                          : preferredSessions.filter((id) => id !== s.id);
                        if (next.length > 0) {
                          void savePlannerConfig(next, leadMinutes, customWindows, notificationsEnabled);
                        }
                      }}
                    />
                    <span>{s.name}</span>
                  </label>
                );
              })}
            </div>
            <div>
              <label htmlFor="sp-lead" className="mb-1 block text-xs text-muted-foreground">
                Alert Lead Time (Minutes before session open)
              </label>
              <input
                id="sp-lead"
                type="number"
                min="5"
                max="120"
                className="field w-40 font-mono"
                value={leadMinutes}
                onChange={(e) =>
                  void savePlannerConfig(
                    preferredSessions,
                    Math.max(5, Math.min(120, Number(e.target.value) || 15)),
                    customWindows,
                    notificationsEnabled,
                  )
                }
              />
            </div>

            <div className="space-y-2 border-t pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <Bell className="h-3.5 w-3.5 text-info" />
                  <span>Browser Notification Permission:</span>
                </span>
                <span className="rounded border px-2 py-0.5 font-mono uppercase">
                  {notifPermission}
                </span>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => {
                    const next = e.target.checked;
                    if (next && notifPermission !== "granted") {
                      void requestBrowserNotificationPermission();
                    } else {
                      void savePlannerConfig(preferredSessions, leadMinutes, customWindows, next);
                    }
                  }}
                />
                <span>Alert me in browser when a selected session is opening soon</span>
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                {notifPermission !== "granted" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void requestBrowserNotificationPermission()}
                  >
                    Grant Notification Permission
                  </Button>
                )}
                <Button type="button" size="sm" variant="outline" onClick={sendTestNotification}>
                  Send Test Notification
                </Button>
              </div>
            </div>
          </div>

          {/* User-Defined Preferred Trading Windows */}
          <div className="space-y-4 rounded-lg border bg-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">2. Custom Preferred Trading Windows ({viewTz})</h3>
              <span className="font-mono text-[10px] uppercase text-info">Academy & ICT Killzone Presets</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {INSTITUTIONAL_KILLZONE_PRESETS.map((kz) => (
                <Button
                  key={kz.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (customWindows.some((w) => w.label === kz.label)) return;
                    const next = [
                      ...customWindows,
                      {
                        id: `${kz.id}-${Date.now()}`,
                        label: kz.label,
                        start: kz.startLocalTime,
                        end: kz.endLocalTime,
                      },
                    ];
                    void savePlannerConfig(preferredSessions, leadMinutes, next, notificationsEnabled);
                  }}
                >
                  + {kz.label.split(" (")[0]} ({kz.startLocalTime}–{kz.endLocalTime})
                </Button>
              ))}
            </div>
            {customWindows.length === 0 ? (
              <p className="rounded border bg-card p-3 text-xs text-muted-foreground">
                No custom trading windows saved yet. Add your preferred execution windows below.
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {customWindows.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center justify-between rounded border bg-card px-3 py-2"
                  >
                    <div>
                      <span className="font-medium text-foreground">{w.label}</span>
                      <span className="ml-2 font-mono text-muted-foreground">
                        {w.start}–{w.end} ({viewTz})
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete window ${w.label}`}
                      onClick={() =>
                        void savePlannerConfig(
                          preferredSessions,
                          leadMinutes,
                          customWindows.filter((x) => x.id !== w.id),
                          notificationsEnabled,
                        )
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                type="text"
                placeholder="e.g. London Open Focus"
                className="field py-1 text-xs"
                value={windowLabel}
                onChange={(e) => setWindowLabel(e.target.value)}
              />
              <input
                type="time"
                aria-label="Window start time"
                className="field py-1 font-mono text-xs"
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
              />
              <input
                type="time"
                aria-label="Window end time"
                className="field py-1 font-mono text-xs"
                value={windowEnd}
                onChange={(e) => setWindowEnd(e.target.value)}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (!windowLabel.trim()) return;
                const next = [
                  ...customWindows,
                  {
                    id: `${Date.now()}`,
                    label: windowLabel.trim(),
                    start: windowStart,
                    end: windowEnd,
                  },
                ];
                void savePlannerConfig(preferredSessions, leadMinutes, next, notificationsEnabled);
                setWindowLabel("");
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Preferred Window
            </Button>
          </div>
        </div>
        {saveNotice && (
          <p role="status" className="mt-3 font-mono text-xs text-up">
            {saveNotice}
          </p>
        )}
        {errorNotice && (
          <p role="alert" className="mt-3 font-mono text-xs text-destructive">
            {errorNotice}
          </p>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// TOOL D: ADVANCED SESSION OVERLAP & WORKSPACE (PRO)
// ============================================================================

function AdvancedOverlapWorkspaceTool() {
  const { session } = useAuth();
  const { fmt, preferredTz, setPreferredTz } = useBrand();
  const localZone = useLocalZone();
  const now = useNow() ?? new Date();

  const [prefs, setPrefs] = useState<WorkspacePreferences>(() => ({
    ...DEFAULT_WORKSPACE_PREFERENCES,
    primaryTz: preferredTz ?? localZone,
  }));
  const [selectedDateStr, setSelectedDateStr] = useState(() => now.toISOString().slice(0, 10));
  const [newZoneToAdd, setNewZoneToAdd] = useState("Asia/Kolkata");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const localRaw = localStorage.getItem("fsc_workspace_prefs_v1");
      if (localRaw) {
        const parsed = JSON.parse(localRaw) as Partial<WorkspacePreferences>;
        setPrefs((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // Ignore storage errors
    }
    if (!session) return;
    void (async () => {
      const { data, error } = await supabase
        .from("session_planner_configs")
        .select("workspace_config")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) {
        setErrMsg(`Could not load workspace preferences: ${error.message}`);
        return;
      }
      const wc = data?.workspace_config as Partial<WorkspacePreferences> | null;
      if (wc && typeof wc === "object" && Object.keys(wc).length > 0) {
        setPrefs((prev) => ({ ...prev, ...wc }));
      }
    })();
  }, [session]);

  const saveWorkspacePrefs = async (nextPrefs: WorkspacePreferences) => {
    setPrefs(nextPrefs);
    setPreferredTz(nextPrefs.primaryTz);
    try {
      localStorage.setItem("fsc_workspace_prefs_v1", JSON.stringify(nextPrefs));
    } catch {
      // Ignore storage errors
    }
    if (!session) return;
    setSaving(true);
    setSaveMsg(null);
    setErrMsg(null);
    const { error } = await supabase.from("session_planner_configs").upsert({
      user_id: session.user.id,
      workspace_config: nextPrefs,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      setErrMsg(`Database sync failed (${error.message}). Saved in browser.`);
    } else {
      setSaveMsg("Workspace layout and overlap preferences saved to your account.");
    }
  };

  const evalDate = selectedDateStr ? new Date(`${selectedDateStr}T12:00:00Z`) : now;
  const matrix = evaluateAdvancedOverlapMatrix(evalDate, prefs.primaryTz, now, fmt);

  const toggleFocusPair = (symbol: string) => {
    const exists = prefs.focusPairs.includes(symbol);
    const nextPairs = exists
      ? prefs.focusPairs.filter((p) => p !== symbol)
      : [...prefs.focusPairs, symbol];
    void saveWorkspacePrefs({ ...prefs, focusPairs: nextPairs });
  };

  const addPinnedZone = () => {
    if (prefs.pinnedZones.includes(newZoneToAdd) || prefs.pinnedZones.length >= 6) return;
    void saveWorkspacePrefs({ ...prefs, pinnedZones: [...prefs.pinnedZones, newZoneToAdd] });
  };

  const removePinnedZone = (tz: string) => {
    if (prefs.pinnedZones.length <= 1) return;
    void saveWorkspacePrefs({
      ...prefs,
      pinnedZones: prefs.pinnedZones.filter((z) => z !== tz),
    });
  };

  return (
    <section className="space-y-6" aria-label="Advanced Session Overlap and Workspace">
      <div className="panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              D. Advanced Session Overlap & Multi-Timezone Workspace
            </h2>
            <p className="text-xs text-muted-foreground">
              Customize your multi-timezone trading desk, inspect all 6 cross-regional session overlap windows, and track DST transition shifts.
            </p>
          </div>
          <span className="rounded bg-up/15 px-2.5 py-1 font-mono text-xs text-up">
            PRO WORKSPACE
          </span>
        </div>

        {matrix.dstGapWarning && (
          <div className="mt-4 rounded-md border border-info/50 bg-info/10 p-3 text-xs text-info">
            <strong>DST Transition Notice:</strong> {matrix.dstGapWarning}
          </div>
        )}

        {/* Workspace Configuration Header */}
        <div className="mt-5 grid gap-4 rounded-lg border bg-panel p-4 sm:grid-cols-3">
          <div>
            <label htmlFor="ws-name" className="mb-1 block text-xs text-muted-foreground">
              Workspace Profile Name
            </label>
            <input
              id="ws-name"
              type="text"
              maxLength={60}
              className="field text-xs"
              value={prefs.workspaceName}
              onChange={(e) => setPrefs({ ...prefs, workspaceName: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="ws-tz" className="mb-1 block text-xs text-muted-foreground">
              Primary Workspace Timezone
            </label>
            <ZoneSelect
              id="ws-tz"
              value={prefs.primaryTz}
              extra={prefs.primaryTz}
              onChange={(tz) => setPrefs({ ...prefs, primaryTz: tz })}
            />
          </div>
          <div>
            <label htmlFor="ws-date" className="mb-1 block text-xs text-muted-foreground">
              Target Date for Overlap Analysis (UTC)
            </label>
            <input
              id="ws-date"
              type="date"
              className="field font-mono text-xs"
              value={selectedDateStr}
              onChange={(e) => setSelectedDateStr(e.target.value)}
            />
          </div>
        </div>

        {/* Pinned Multi-Timezone Hub Clocks */}
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              Pinned Workspace Clocks ({prefs.pinnedZones.length}/6)
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <ZoneSelect
                value={newZoneToAdd}
                onChange={setNewZoneToAdd}
                extra={newZoneToAdd}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={prefs.pinnedZones.length >= 6}
                onClick={addPinnedZone}
              >
                + Pin Clock
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {prefs.pinnedZones.map((tz) => {
              const zoneLabel = ZONES.find((z) => z.tz === tz)?.label ?? tz;
              const dst = isDstActive(now, tz);
              return (
                <div key={tz} className="rounded-lg border bg-panel p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold">{zoneLabel}</span>
                    <div className="flex items-center gap-1.5">
                      {dst && (
                        <span className="rounded bg-info/20 px-1.5 py-0.5 font-mono text-[10px] text-info">
                          DST
                        </span>
                      )}
                      {prefs.pinnedZones.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Unpin ${tz}`}
                          onClick={() => removePinnedZone(tz)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 font-mono text-2xl font-bold">
                    {formatTime(now, tz, true, fmt)}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {formatDate(now, tz)} · {utcOffsetLabel(now, tz)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Advanced Session Overlap Matrix */}
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold">
            Advanced Session-Overlap Matrix ({selectedDateStr} · Shown in {prefs.primaryTz})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2">Session Pair</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Window ({prefs.primaryTz})</th>
                  <th className="p-2">UTC Window</th>
                  <th className="p-2">Duration</th>
                  <th className="p-2">Liquidity Profile & Focus Pairs</th>
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((row) => (
                  <tr key={row.id} className="border-b align-top last:border-0">
                    <td className="p-2 font-semibold">{row.pairLabel}</td>
                    <td className="p-2">
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                          row.isActiveNow
                            ? "bg-up/20 text-up"
                            : row.hasOverlap
                              ? "bg-info/20 text-info"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {row.isActiveNow
                          ? "ACTIVE NOW"
                          : row.hasOverlap
                            ? "HAS OVERLAP"
                            : "NO OVERLAP"}
                      </span>
                    </td>
                    <td className="p-2 font-mono">{row.localWindow}</td>
                    <td className="p-2 font-mono text-muted-foreground">{row.utcWindow}</td>
                    <td className="p-2 font-mono">
                      {row.durationMinutes > 0
                        ? `${Math.floor(row.durationMinutes / 60)}h ${row.durationMinutes % 60}m`
                        : "0m"}
                    </td>
                    <td className="p-2">
                      <div className="font-medium text-foreground">{row.liquidityTier}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-info">
                        Pairs: {row.focusPairs.join(", ")}
                      </div>
                      <p className="mt-1 text-muted-foreground">{row.tradingNotes}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Workspace Focus Pairs & Save Button */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold">Workspace Focus Pairs</p>
            <div className="flex flex-wrap gap-1.5">
              {FOREX_PAIRS.map((p) => {
                const active = prefs.focusPairs.includes(p.symbol);
                return (
                  <button
                    key={p.symbol}
                    type="button"
                    onClick={() => toggleFocusPair(p.symbol)}
                    className={`rounded border px-2.5 py-1 font-mono text-xs transition-colors ${
                      active
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border bg-panel text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p.symbol}
                  </button>
                );
              })}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => void saveWorkspacePrefs(prefs)}
          >
            {saving ? "Saving Workspace…" : "Save Workspace Preferences"}
          </Button>
        </div>

        {saveMsg && (
          <p role="status" className="mt-3 font-mono text-xs text-up">
            {saveMsg}
          </p>
        )}
        {errMsg && (
          <p role="alert" className="mt-3 font-mono text-xs text-destructive">
            {errMsg}
          </p>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// TOOL E: TRADE JOURNAL & PERFORMANCE INTELLIGENCE REPORTS (ELITE)
// ============================================================================

function TradeJournalAndReportsTool() {
  const { session } = useAuth();
  const [entries, setEntries] = useState<TradeJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Trade entry form state
  const [pair, setPair] = useState("EUR/USD");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [sessionId, setSessionId] = useState<TradeSessionCategory>(() =>
    classifyTradeSession(new Date()),
  );
  const [entryPrice, setEntryPrice] = useState("1.0850");
  const [exitPrice, setExitPrice] = useState("1.0890");
  const [stopLossPrice, setStopLossPrice] = useState("1.0830");
  const [takeProfitPrice, setTakeProfitPrice] = useState("1.0890");
  const [lotSize, setLotSize] = useState("0.50");
  const [pnlAmount, setPnlAmount] = useState("200");
  const [rMultiple, setRMultiple] = useState("2.0");
  const [strategyTag, setStrategyTag] = useState<string>(STRATEGY_TAGS[0]);
  const [mistakeTag, setMistakeTag] = useState<string>("None");
  const [notes, setNotes] = useState("");

  const loadJournal = useCallback(async () => {
    setLoading(true);
    setErrorNotice(null);
    try {
      const localRaw = localStorage.getItem("fsc_trade_journal_v1");
      if (localRaw) setEntries(JSON.parse(localRaw));
    } catch {
      // Ignore storage errors
    }
    if (!session) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("trade_journal_entries")
      .select("*")
      .eq("user_id", session.user.id)
      .order("traded_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      setErrorNotice(`Could not load journal entries from database: ${error.message}`);
      return;
    }
    if (data) {
      setEntries(data as unknown as TradeJournalEntry[]);
    }
  }, [session]);

  useEffect(() => {
    void loadJournal();
  }, [loadJournal]);

  const handleAutoCalculateTrade = () => {
    const calc = calculateTradeMetrics({
      pairSymbol: pair,
      direction,
      entryPrice: Number(entryPrice),
      exitPrice: Number(exitPrice),
      stopLossPrice: stopLossPrice ? Number(stopLossPrice) : null,
      lotSize: Number(lotSize),
    });
    setPnlAmount(String(calc.pnlAmount));
    setRMultiple(String(calc.rMultiple));
    setNotice(
      `Auto-calculated from prices: ${calc.pipsGained >= 0 ? "+" : ""}${calc.pipsGained} pips, $${calc.pnlAmount.toFixed(2)} PnL, ${calc.rMultiple}R.`,
    );
  };

  const resetForm = () => {
    setEditingId(null);
    setNotes("");
    setMistakeTag("None");
  };

  const startEditingTrade = (t: TradeJournalEntry) => {
    setEditingId(t.id);
    setPair(t.pair);
    setDirection(t.direction);
    setSessionId(t.session_id);
    setEntryPrice(String(t.entry_price));
    setExitPrice(String(t.exit_price));
    setStopLossPrice(t.stop_loss !== null ? String(t.stop_loss) : "");
    setTakeProfitPrice(
      t.take_profit !== null && t.take_profit !== undefined ? String(t.take_profit) : "",
    );
    setLotSize(String(t.lot_size));
    setPnlAmount(String(t.pnl_amount));
    setRMultiple(String(t.r_multiple));
    setStrategyTag(t.strategy_tag);
    setMistakeTag(t.mistake_tag);
    setNotes(t.notes);
    setNotice(`Editing trade ${t.pair} (${t.direction.toUpperCase()}). Update fields and click Save Trade Changes.`);
  };

  const handleSaveTrade = async (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setErrorNotice(null);
    const pnl = Number(pnlAmount);
    const outcome: TradeJournalEntry["outcome"] =
      pnl > 0 ? "win" : pnl < 0 ? "loss" : "breakeven";
    const slNum = stopLossPrice ? Number(stopLossPrice) : null;
    const tpNum = takeProfitPrice ? Number(takeProfitPrice) : null;

    if (editingId) {
      const updatedList = entries.map((item) =>
        item.id === editingId
          ? {
              ...item,
              pair,
              direction,
              session_id: sessionId,
              entry_price: Number(entryPrice) || 0,
              exit_price: Number(exitPrice) || 0,
              stop_loss: slNum,
              take_profit: tpNum,
              lot_size: Number(lotSize) || 0.1,
              pnl_amount: pnl,
              r_multiple: Number(rMultiple) || 0,
              outcome,
              strategy_tag: strategyTag,
              mistake_tag: mistakeTag,
              notes: notes.trim(),
            }
          : item,
      );
      setEntries(updatedList);
      try {
        localStorage.setItem("fsc_trade_journal_v1", JSON.stringify(updatedList));
      } catch {
        // Ignore storage errors
      }
      const targetId = editingId;
      resetForm();
      if (!session) return;
      const { error } = await supabase
        .from("trade_journal_entries")
        .update({
          pair,
          direction,
          session_id: sessionId,
          entry_price: Number(entryPrice) || 0,
          exit_price: Number(exitPrice) || 0,
          stop_loss: slNum,
          take_profit: tpNum,
          lot_size: Number(lotSize) || 0.1,
          pnl_amount: pnl,
          r_multiple: Number(rMultiple) || 0,
          outcome,
          strategy_tag: strategyTag,
          mistake_tag: mistakeTag,
          notes: notes.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetId)
        .eq("user_id", session.user.id);
      if (error) {
        setErrorNotice(`Database update failed (${error.message}). Updated in browser.`);
      } else {
        setNotice("Trade entry updated in your journal.");
      }
      return;
    }

    const newEntry: TradeJournalEntry = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`,
      pair,
      direction,
      session_id: sessionId,
      entry_price: Number(entryPrice) || 0,
      exit_price: Number(exitPrice) || 0,
      stop_loss: slNum,
      take_profit: tpNum,
      lot_size: Number(lotSize) || 0.1,
      pnl_amount: pnl,
      r_multiple: Number(rMultiple) || 0,
      outcome,
      strategy_tag: strategyTag,
      mistake_tag: mistakeTag,
      notes: notes.trim(),
      traded_at: new Date().toISOString(),
    };
    const nextList = [newEntry, ...entries];
    setEntries(nextList);
    try {
      localStorage.setItem("fsc_trade_journal_v1", JSON.stringify(nextList));
    } catch {
      // Ignore storage errors
    }
    resetForm();
    if (!session) return;
    const { error } = await supabase.from("trade_journal_entries").insert({
      id: newEntry.id,
      user_id: session.user.id,
      pair: newEntry.pair,
      direction: newEntry.direction,
      session_id: newEntry.session_id,
      entry_price: newEntry.entry_price,
      exit_price: newEntry.exit_price,
      stop_loss: newEntry.stop_loss,
      take_profit: newEntry.take_profit,
      lot_size: newEntry.lot_size,
      pnl_amount: newEntry.pnl_amount,
      r_multiple: newEntry.r_multiple,
      outcome: newEntry.outcome,
      strategy_tag: newEntry.strategy_tag,
      mistake_tag: newEntry.mistake_tag,
      notes: newEntry.notes,
      traded_at: newEntry.traded_at,
    });
    if (error) {
      setErrorNotice(`Database insert failed (${error.message}). Saved locally.`);
    } else {
      setNotice("Trade logged to your private journal.");
    }
  };

  const handleDeleteTrade = async (id: string) => {
    const next = entries.filter((x) => x.id !== id);
    setEntries(next);
    if (editingId === id) resetForm();
    try {
      localStorage.setItem("fsc_trade_journal_v1", JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
    if (session) {
      const { error } = await supabase
        .from("trade_journal_entries")
        .delete()
        .eq("id", id)
        .eq("user_id", session.user.id);
      if (error) {
        setErrorNotice(`Could not delete from database: ${error.message}`);
      } else {
        setNotice("Trade deleted from your journal.");
      }
    }
  };

  const stats = analyzeTradeJournal(entries);
  const maxMistakeCount = Math.max(1, ...stats.mistakes.map((m) => m.count));

  return (
    <section className="space-y-6" aria-label="Trade Performance Intelligence and Journal">
      <div className="panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">
              E. Trade Journal & Performance Intelligence Reports
            </h2>
            <p className="text-xs text-muted-foreground">
              Add, edit, and delete private trade records with stop-loss, take-profit, session, strategy, and mistake tags. Analytics and 7-day / 30-day reports calculate strictly from your actual journal data.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={entries.length === 0}
              onClick={() => {
                const csv = exportTradeJournalCsv(entries);
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `forex-trade-journal-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                setNotice("Exported trade journal to CSV (formula-injection protected).");
              }}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void loadJournal()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Sync Journal
            </Button>
          </div>
        </div>

        {/* Top KPI Summary & Weekly/Monthly Reports */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-panel p-4">
            <p className="text-xs text-muted-foreground">Win Rate ({stats.totalTrades} trades)</p>
            <p className="mt-1 font-mono text-2xl font-bold text-up">{stats.winRate}%</p>
            <p className="text-xs text-muted-foreground">
              {stats.wins}W · {stats.losses}L · {stats.breakevens}BE
            </p>
          </div>
          <div className="rounded-lg border bg-panel p-4">
            <p className="text-xs text-muted-foreground">Total Net PnL</p>
            <p
              className={`mt-1 font-mono text-2xl font-bold ${
                stats.netPnl >= 0 ? "text-up" : "text-destructive"
              }`}
            >
              {stats.netPnl >= 0 ? `+$${stats.netPnl.toFixed(2)}` : `-$${Math.abs(stats.netPnl).toFixed(2)}`}
            </p>
            <p className="text-xs text-muted-foreground">
              Avg R: {stats.avgRMultiple}R · Profit Factor: {stats.profitFactor ?? "∞"}
            </p>
          </div>
          <div className="rounded-lg border bg-panel p-4">
            <p className="text-xs text-muted-foreground">7-Day Weekly Report</p>
            <p
              className={`mt-1 font-mono text-2xl font-bold ${
                stats.weeklyNetPnl >= 0 ? "text-up" : "text-destructive"
              }`}
            >
              {stats.weeklyNetPnl >= 0
                ? `+$${stats.weeklyNetPnl.toFixed(2)}`
                : `-$${Math.abs(stats.weeklyNetPnl).toFixed(2)}`}
            </p>
            <p className="text-xs text-muted-foreground">{stats.weeklyTrades} trades in last 7d</p>
          </div>
          <div className="rounded-lg border bg-panel p-4">
            <p className="text-xs text-muted-foreground">30-Day Monthly Report</p>
            <p
              className={`mt-1 font-mono text-2xl font-bold ${
                stats.monthlyNetPnl >= 0 ? "text-up" : "text-destructive"
              }`}
            >
              {stats.monthlyNetPnl >= 0
                ? `+$${stats.monthlyNetPnl.toFixed(2)}`
                : `-$${Math.abs(stats.monthlyNetPnl).toFixed(2)}`}
            </p>
            <p className="text-xs text-muted-foreground">{stats.monthlyTrades} trades in last 30d</p>
          </div>
        </div>

        {/* Actionable Performance Insights */}
        {stats.insights.length > 0 && (
          <div className="mt-4 rounded-lg border border-info/40 bg-info/10 p-4 text-xs">
            <h3 className="font-semibold text-foreground">Performance Intelligence Insights</h3>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-muted-foreground">
              {stats.insights.map((ins) => (
                <li key={ins}>{ins}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Performance by Session & Recurring Mistakes */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-panel p-4">
            <h3 className="mb-3 text-sm font-semibold">Performance by Session</h3>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2">Session</th>
                  <th className="py-2">Trades</th>
                  <th className="py-2">Win Rate</th>
                  <th className="py-2">Avg R</th>
                  <th className="py-2 text-right">Net PnL</th>
                </tr>
              </thead>
              <tbody>
                {stats.bySession.map((s) => (
                  <tr key={s.sessionId} className="border-b last:border-0">
                    <td className="py-2 font-medium">{s.label}</td>
                    <td className="py-2 font-mono">{s.trades}</td>
                    <td className="py-2 font-mono">{s.winRate}%</td>
                    <td className="py-2 font-mono">{s.avgR}R</td>
                    <td
                      className={`py-2 text-right font-mono font-semibold ${
                        s.netPnl >= 0 ? "text-up" : "text-destructive"
                      }`}
                    >
                      {s.netPnl >= 0 ? `+$${s.netPnl.toFixed(2)}` : `-$${Math.abs(s.netPnl).toFixed(2)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border bg-panel p-4">
            <h3 className="mb-3 text-sm font-semibold">Recurring Mistakes Cost Chart</h3>
            {stats.mistakes.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No mistake tags logged yet. Tag any execution errors below to measure their PnL impact.
              </p>
            ) : (
              <div className="space-y-3">
                {stats.mistakes.map((m) => (
                  <div key={m.mistake} className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="font-medium">{m.mistake}</span>
                      <span className="font-mono text-muted-foreground">
                        {m.count}x ({m.totalPnlImpact >= 0 ? "+" : ""}${m.totalPnlImpact.toFixed(2)})
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded bg-card">
                      <div
                        className="h-full bg-destructive"
                        style={{ width: `${(m.count / maxMistakeCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Performance by Pair & Strategy */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-panel p-4">
            <h3 className="mb-3 text-sm font-semibold">Performance by Pair</h3>
            {stats.byPair.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Log trades to view pair-by-pair win rates and net PnL.
              </p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2">Pair</th>
                    <th className="py-2">Trades</th>
                    <th className="py-2">Win Rate</th>
                    <th className="py-2">Avg R</th>
                    <th className="py-2 text-right">Net PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byPair.map((p) => (
                    <tr key={p.pair} className="border-b last:border-0">
                      <td className="py-2 font-mono font-semibold">{p.pair}</td>
                      <td className="py-2 font-mono">{p.trades}</td>
                      <td className="py-2 font-mono">{p.winRate}%</td>
                      <td className="py-2 font-mono">{p.avgR}R</td>
                      <td
                        className={`py-2 text-right font-mono font-semibold ${
                          p.netPnl >= 0 ? "text-up" : "text-destructive"
                        }`}
                      >
                        {p.netPnl >= 0 ? `+$${p.netPnl.toFixed(2)}` : `-$${Math.abs(p.netPnl).toFixed(2)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-lg border bg-panel p-4">
            <h3 className="mb-3 text-sm font-semibold">Performance by Strategy</h3>
            {stats.byStrategy.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Log trades with strategy tags to compare setup expectancy.
              </p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2">Strategy</th>
                    <th className="py-2">Trades</th>
                    <th className="py-2">Win Rate</th>
                    <th className="py-2">Avg R</th>
                    <th className="py-2 text-right">Net PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byStrategy.map((st) => (
                    <tr key={st.strategy} className="border-b last:border-0">
                      <td className="py-2 font-medium">{st.strategy}</td>
                      <td className="py-2 font-mono">{st.trades}</td>
                      <td className="py-2 font-mono">{st.winRate}%</td>
                      <td className="py-2 font-mono">{st.avgR}R</td>
                      <td
                        className={`py-2 text-right font-mono font-semibold ${
                          st.netPnl >= 0 ? "text-up" : "text-destructive"
                        }`}
                      >
                        {st.netPnl >= 0
                          ? `+$${st.netPnl.toFixed(2)}`
                          : `-$${Math.abs(st.netPnl).toFixed(2)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Add / Edit Trade Form */}
        <form onSubmit={(e) => void handleSaveTrade(e)} className="mt-6 rounded-lg border bg-panel p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {editingId ? "Edit Journal Trade Entry" : "Log New Trade to Journal"}
            </h3>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAutoCalculateTrade}
            >
              <Calculator className="mr-1.5 h-3.5 w-3.5" />
              Auto-Calculate PnL & R from Prices
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <label htmlFor="tj-pair" className="mb-1 block text-xs text-muted-foreground">
                Pair
              </label>
              <select
                id="tj-pair"
                className="field py-1.5 text-xs"
                value={pair}
                onChange={(e) => setPair(e.target.value)}
              >
                {FOREX_PAIRS.map((p) => (
                  <option key={p.symbol} value={p.symbol}>
                    {p.symbol}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tj-dir" className="mb-1 block text-xs text-muted-foreground">
                Direction
              </label>
              <select
                id="tj-dir"
                className="field py-1.5 text-xs"
                value={direction}
                onChange={(e) => setDirection(e.target.value as "long" | "short")}
              >
                <option value="long">Long (Buy)</option>
                <option value="short">Short (Sell)</option>
              </select>
            </div>
            <div>
              <label htmlFor="tj-sess" className="mb-1 block text-xs text-muted-foreground">
                Session
              </label>
              <select
                id="tj-sess"
                className="field py-1.5 text-xs"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value as TradeSessionCategory)}
              >
                <option value="sydney">Sydney</option>
                <option value="tokyo">Tokyo</option>
                <option value="london">London</option>
                <option value="newyork">New York</option>
                <option value="overlap">London ∩ NY Overlap</option>
              </select>
            </div>
            <div>
              <label htmlFor="tj-entry" className="mb-1 block text-xs text-muted-foreground">
                Entry Price
              </label>
              <input
                id="tj-entry"
                type="number"
                step="any"
                required
                className="field py-1.5 font-mono text-xs"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="tj-exit" className="mb-1 block text-xs text-muted-foreground">
                Exit Price
              </label>
              <input
                id="tj-exit"
                type="number"
                step="any"
                required
                className="field py-1.5 font-mono text-xs"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="tj-sl" className="mb-1 block text-xs text-muted-foreground">
                Stop-Loss Price
              </label>
              <input
                id="tj-sl"
                type="number"
                step="any"
                placeholder="Optional"
                className="field py-1.5 font-mono text-xs"
                value={stopLossPrice}
                onChange={(e) => setStopLossPrice(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="tj-tp" className="mb-1 block text-xs text-muted-foreground">
                Take-Profit Price
              </label>
              <input
                id="tj-tp"
                type="number"
                step="any"
                placeholder="Optional"
                className="field py-1.5 font-mono text-xs"
                value={takeProfitPrice}
                onChange={(e) => setTakeProfitPrice(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="tj-lots" className="mb-1 block text-xs text-muted-foreground">
                Lot Size
              </label>
              <input
                id="tj-lots"
                type="number"
                step="0.01"
                min="0.01"
                required
                className="field py-1.5 font-mono text-xs"
                value={lotSize}
                onChange={(e) => setLotSize(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="tj-pnl" className="mb-1 block text-xs text-muted-foreground">
                Net PnL ($)
              </label>
              <input
                id="tj-pnl"
                type="number"
                step="any"
                required
                className="field py-1.5 font-mono text-xs"
                value={pnlAmount}
                onChange={(e) => setPnlAmount(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="tj-r" className="mb-1 block text-xs text-muted-foreground">
                R-Multiple
              </label>
              <input
                id="tj-r"
                type="number"
                step="0.1"
                className="field py-1.5 font-mono text-xs"
                value={rMultiple}
                onChange={(e) => setRMultiple(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="tj-strat" className="mb-1 block text-xs text-muted-foreground">
                Strategy Tag
              </label>
              <select
                id="tj-strat"
                className="field py-1.5 text-xs"
                value={strategyTag}
                onChange={(e) => setStrategyTag(e.target.value)}
              >
                {STRATEGY_TAGS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tj-mistake" className="mb-1 block text-xs text-muted-foreground">
                Mistake Tag
              </label>
              <select
                id="tj-mistake"
                className="field py-1.5 text-xs"
                value={mistakeTag}
                onChange={(e) => setMistakeTag(e.target.value)}
              >
                {MISTAKE_TAGS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Trade notes / post-trade reflection (optional)"
              maxLength={300}
              className="field flex-1 py-1.5 text-xs"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button type="submit" size="sm">
              {editingId ? "Save Trade Changes" : "+ Add Trade Entry"}
            </Button>
            {editingId && (
              <Button type="button" size="sm" variant="outline" onClick={resetForm}>
                Cancel Edit
              </Button>
            )}
          </div>
          {notice && (
            <p role="status" className="mt-2 font-mono text-xs text-up">
              {notice}
            </p>
          )}
          {errorNotice && (
            <p role="alert" className="mt-2 font-mono text-xs text-destructive">
              {errorNotice}
            </p>
          )}
        </form>

        {/* Trade History Table */}
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">Saved Trade Journal ({entries.length})</h3>
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading trade journal…</p>
          ) : entries.length === 0 ? (
            <p className="rounded border bg-panel p-4 text-xs text-muted-foreground">
              Your trade journal is empty. Log your completed trades above to calculate session, pair, and strategy performance reports.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-2">Pair & Side</th>
                    <th className="p-2">Entry → Exit (SL/TP)</th>
                    <th className="p-2">Session</th>
                    <th className="p-2">Strategy</th>
                    <th className="p-2">Mistake Tag</th>
                    <th className="p-2">R</th>
                    <th className="p-2 text-right">PnL ($)</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="p-2 font-mono font-semibold">
                        {t.pair}{" "}
                        <span className={t.direction === "long" ? "text-up" : "text-info"}>
                          {t.direction.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-2 font-mono text-[11px]">
                        {t.entry_price} → {t.exit_price}
                        {(t.stop_loss || t.take_profit) && (
                          <span className="block text-muted-foreground">
                            {t.stop_loss ? `SL: ${t.stop_loss}` : ""}{" "}
                            {t.take_profit ? `TP: ${t.take_profit}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="p-2">{t.session_id}</td>
                      <td className="p-2">{t.strategy_tag}</td>
                      <td className="p-2 text-muted-foreground">{t.mistake_tag}</td>
                      <td className="p-2 font-mono">{t.r_multiple}R</td>
                      <td
                        className={`p-2 text-right font-mono font-semibold ${
                          t.pnl_amount >= 0 ? "text-up" : "text-destructive"
                        }`}
                      >
                        {t.pnl_amount >= 0
                          ? `+$${Number(t.pnl_amount).toFixed(2)}`
                          : `-$${Math.abs(Number(t.pnl_amount)).toFixed(2)}`}
                      </td>
                      <td className="p-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={`Edit trade ${t.pair}`}
                            onClick={() => startEditingTrade(t)}
                            className="text-muted-foreground hover:text-info"
                          >
                            <Edit3 className="inline h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete trade ${t.pair}`}
                            onClick={() => void handleDeleteTrade(t.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="inline h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// TOOL F: ECONOMIC EVENT RISK PLANNER (ELITE — MANUAL VERIFIED SCHEDULE MODE)
// ============================================================================

const CURRENCIES = ["ALL", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"] as const;
const IMPACTS = ["ALL", "high", "medium", "low"] as const;

function EconomicEventRiskPlannerTool() {
  const { session } = useAuth();
  const { preferredTz } = useBrand();
  const formatClockTime = useClockFormat();
  const localZone = useLocalZone();
  const now = useNow() ?? new Date();
  const viewTz = preferredTz ?? localZone;

  const [events, setEvents] = useState<EconomicRiskEvent[]>([]);
  const [currencyFilter, setCurrencyFilter] = useState<string>("ALL");
  const [impactFilter, setImpactFilter] = useState<string>("ALL");
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [impact, setImpact] = useState<"high" | "medium" | "low">("high");
  const [eventDateTime, setEventDateTime] = useState("");
  const [preMin, setPreMin] = useState("15");
  const [postMin, setPostMin] = useState("15");
  const [sourceLabel, setSourceLabel] = useState("Manual Central Bank / Calendar Entry");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  useEffect(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const n = new Date(Date.now() + 2 * 3600_000);
    setEventDateTime(
      `${n.getUTCFullYear()}-${pad(n.getUTCMonth() + 1)}-${pad(n.getUTCDate())}T${pad(
        n.getUTCHours(),
      )}:30`,
    );

    setLoading(true);
    try {
      const localRaw = localStorage.getItem("fsc_economic_events_v1");
      if (localRaw) setEvents(JSON.parse(localRaw));
    } catch {
      // Ignore storage errors
    }
    if (!session) {
      setLoading(false);
      return;
    }
    void (async () => {
      const { data, error } = await supabase
        .from("economic_risk_events")
        .select("*")
        .eq("user_id", session.user.id)
        .order("event_time", { ascending: true });
      setLoading(false);
      if (error) {
        setErrorNotice(`Could not load scheduled events: ${error.message}`);
        return;
      }
      if (data) {
        setEvents(data as unknown as EconomicRiskEvent[]);
      }
    })();
  }, [session]);

  const handleAddEvent = async (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setErrorNotice(null);
    if (!title.trim() || !eventDateTime) return;
    const parsedDate = new Date(eventDateTime + ":00Z");
    if (isNaN(parsedDate.getTime())) {
      setErrorNotice("Enter a valid UTC date and time for the event.");
      return;
    }
    const newEv: EconomicRiskEvent = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`,
      title: title.trim(),
      currency,
      impact,
      event_time: parsedDate.toISOString(),
      pre_window_minutes: Math.max(0, Number(preMin) || 15),
      post_window_minutes: Math.max(0, Number(postMin) || 15),
      source_label: sourceLabel.trim() || "Manual User Entry",
      notes: notes.trim(),
      updated_at: new Date().toISOString(),
    };
    const nextList = [...events, newEv];
    setEvents(nextList);
    try {
      localStorage.setItem("fsc_economic_events_v1", JSON.stringify(nextList));
    } catch {
      // Ignore storage errors
    }
    setTitle("");
    setNotes("");
    if (!session) return;
    const { error } = await supabase.from("economic_risk_events").insert({
      id: newEv.id,
      user_id: session.user.id,
      title: newEv.title,
      currency: newEv.currency,
      impact: newEv.impact,
      event_time: newEv.event_time,
      pre_window_minutes: newEv.pre_window_minutes,
      post_window_minutes: newEv.post_window_minutes,
      source_label: newEv.source_label,
      notes: newEv.notes,
      updated_at: newEv.updated_at,
    });
    if (error) {
      setErrorNotice(`Database save failed (${error.message}). Saved locally.`);
    } else {
      setNotice("Manual economic event and blackout window scheduled.");
    }
  };

  const handleDeleteEvent = async (id: string) => {
    const next = events.filter((x) => x.id !== id);
    setEvents(next);
    try {
      localStorage.setItem("fsc_economic_events_v1", JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
    if (session) {
      await supabase.from("economic_risk_events").delete().eq("id", id).eq("user_id", session.user.id);
    }
  };

  const { activeBlackoutEvents, approachingEvents, evaluated } = evaluateEconomicRiskEvents(
    events,
    now,
    currencyFilter,
    impactFilter,
  );

  return (
    <section className="space-y-6" aria-label="Economic Event Risk Planner">
      <div className="panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">
              F. Economic Event Risk Planner (Manual Event-Entry Mode)
            </h2>
            <p className="text-xs text-muted-foreground">
              Manually schedule high-impact economic releases and configure pre-event and post-event blackout windows. All entries below are user-entered; this tool does not claim to stream a live economic calendar feed.
            </p>
          </div>
          <span className="rounded border border-info/40 bg-info/10 px-2.5 py-1 font-mono text-xs text-info">
            Mode: Manual User-Entered Schedule · Zone: {viewTz}
          </span>
        </div>

        {/* Live No-Trade Blackout Alert */}
        {activeBlackoutEvents.length > 0 && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-destructive bg-destructive/15 p-4 text-xs"
          >
            <p className="font-mono font-bold uppercase text-destructive">
              NO-TRADE BLACKOUT WINDOW ACTIVE ({activeBlackoutEvents.length} Manual Event
              {activeBlackoutEvents.length > 1 ? "s" : ""})
            </p>
            <ul className="mt-1 space-y-1">
              {activeBlackoutEvents.map((ev) => (
                <li key={ev.id}>
                  <strong>
                    [{ev.currency} · {ev.impact.toUpperCase()}] {ev.title}
                  </strong>{" "}
                  — Blackout window:{" "}
                  {formatClockTime(ev.blackoutStart, viewTz)}–
                  {formatClockTime(ev.blackoutEnd, viewTz)} ({viewTz}) · Source: {ev.source_label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Approaching Blackout Warning */}
        {activeBlackoutEvents.length === 0 && approachingEvents.length > 0 && (
          <div
            role="status"
            className="mt-4 rounded-lg border border-info/50 bg-info/10 p-4 text-xs text-info"
          >
            <p className="font-mono font-bold uppercase">
              Upcoming Event Risk Warning ({approachingEvents.length} Event
              {approachingEvents.length > 1 ? "s" : ""} Approaching)
            </p>
            <ul className="mt-1 space-y-1">
              {approachingEvents.map((ev) => (
                <li key={ev.id}>
                  <strong>
                    [{ev.currency}] {ev.title}
                  </strong>{" "}
                  in {ev.minutesUntilEvent}m — Blackout starts at{" "}
                  {formatClockTime(ev.blackoutStart, viewTz)} ({viewTz})
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Currency & Impact Filters */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">Currency:</span>
            {CURRENCIES.map((c) => (
              <Button
                key={c}
                type="button"
                size="sm"
                variant={currencyFilter === c ? "default" : "outline"}
                onClick={() => setCurrencyFilter(c)}
              >
                {c}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">Impact:</span>
            {IMPACTS.map((imp) => (
              <Button
                key={imp}
                type="button"
                size="sm"
                variant={impactFilter === imp ? "default" : "outline"}
                onClick={() => setImpactFilter(imp)}
              >
                {imp.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>

        {/* Add Manual Event Form */}
        <form onSubmit={(e) => void handleAddEvent(e)} className="mt-5 rounded-lg border bg-panel p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Add Manual Economic Event (UTC Input)</h3>
            <span className="font-mono text-[10px] uppercase text-info">One-Click Central Bank & Tier-1 Macro Presets</span>
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {HIGH_IMPACT_EVENT_TEMPLATES.map((tpl) => (
              <Button
                key={tpl.id}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setTitle(tpl.title);
                  setCurrency(tpl.currency);
                  setImpact(tpl.impact);
                  setPreMin(String(tpl.pre_window_minutes));
                  setPostMin(String(tpl.post_window_minutes));
                  setSourceLabel(tpl.source_label);
                  setNotes(tpl.notes);
                  const datePrefix = eventDateTime.slice(0, 10) || new Date().toISOString().slice(0, 10);
                  setEventDateTime(`${datePrefix}T${tpl.typicalUtcTime}`);
                  setNotice(`Loaded preset "${tpl.title}". Verify release date/time and click Schedule.`);
                }}
              >
                [{tpl.currency}] {tpl.title.split(" (")[0]}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="ev-title" className="mb-1 block text-xs text-muted-foreground">
                Event Name *
              </label>
              <input
                id="ev-title"
                required
                placeholder="e.g. US CPI / FOMC Rate Decision"
                maxLength={120}
                className="field py-1.5 text-xs"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="ev-ccy" className="mb-1 block text-xs text-muted-foreground">
                Currency
              </label>
              <select
                id="ev-ccy"
                className="field py-1.5 text-xs"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.filter((c) => c !== "ALL").map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ev-impact" className="mb-1 block text-xs text-muted-foreground">
                Impact Level
              </label>
              <select
                id="ev-impact"
                className="field py-1.5 text-xs"
                value={impact}
                onChange={(e) => setImpact(e.target.value as "high" | "medium" | "low")}
              >
                <option value="high">High Impact (Red)</option>
                <option value="medium">Medium Impact (Amber)</option>
                <option value="low">Low Impact</option>
              </select>
            </div>
            <div>
              <label htmlFor="ev-dt" className="mb-1 block text-xs text-muted-foreground">
                Release Date & Time (UTC) *
              </label>
              <input
                id="ev-dt"
                type="datetime-local"
                required
                className="field py-1.5 font-mono text-xs"
                value={eventDateTime}
                onChange={(e) => setEventDateTime(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="ev-pre" className="mb-1 block text-xs text-muted-foreground">
                Pre-Event Blackout (Min)
              </label>
              <input
                id="ev-pre"
                type="number"
                min="0"
                max="240"
                className="field py-1.5 font-mono text-xs"
                value={preMin}
                onChange={(e) => setPreMin(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="ev-post" className="mb-1 block text-xs text-muted-foreground">
                Post-Event Blackout (Min)
              </label>
              <input
                id="ev-post"
                type="number"
                min="0"
                max="240"
                className="field py-1.5 font-mono text-xs"
                value={postMin}
                onChange={(e) => setPostMin(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="ev-src" className="mb-1 block text-xs text-muted-foreground">
                Source / Attribution Label
              </label>
              <input
                id="ev-src"
                maxLength={120}
                className="field py-1.5 text-xs"
                value={sourceLabel}
                onChange={(e) => setSourceLabel(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="ev-notes" className="mb-1 block text-xs text-muted-foreground">
                Risk Plan Note
              </label>
              <input
                id="ev-notes"
                placeholder="e.g. Flatten USD positions 15m prior"
                maxLength={200}
                className="field py-1.5 text-xs"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3">
            <Button type="submit" size="sm">
              + Schedule Manual Event & Blackout Window
            </Button>
          </div>
          {notice && (
            <p role="status" className="mt-2 font-mono text-xs text-up">
              {notice}
            </p>
          )}
          {errorNotice && (
            <p role="alert" className="mt-2 font-mono text-xs text-destructive">
              {errorNotice}
            </p>
          )}
        </form>

        {/* Event List */}
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">
            Manually Entered Economic Events ({evaluated.length})
          </h3>
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading your scheduled events…</p>
          ) : evaluated.length === 0 ? (
            <p className="rounded border bg-panel p-4 text-xs text-muted-foreground">
              No manual economic events match your current filters. Add upcoming central bank or macro releases above to track pre-event and post-event no-trade blackout windows.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-2">Currency & Impact</th>
                    <th className="p-2">Event & Source</th>
                    <th className="p-2">Event Time ({viewTz})</th>
                    <th className="p-2">No-Trade Blackout Window</th>
                    <th className="p-2">Status</th>
                    <th className="p-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluated.map((ev) => {
                    const evDate = new Date(ev.event_time);
                    return (
                      <tr key={ev.id} className="border-b last:border-0">
                        <td className="p-2 font-mono">
                          <span className="font-bold">{ev.currency}</span>{" "}
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                              ev.impact === "high"
                                ? "bg-destructive/20 text-destructive"
                                : ev.impact === "medium"
                                  ? "bg-info/20 text-info"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {ev.impact}
                          </span>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1.5 font-medium">
                            <span>{ev.title}</span>
                            <span className="rounded border border-info/30 bg-info/10 px-1.5 py-0.5 font-mono text-[10px] text-info">
                              MANUAL
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Source: {ev.source_label} · Added{" "}
                            {new Date(ev.updated_at).toLocaleDateString()}
                            {ev.notes ? ` · Note: ${ev.notes}` : ""}
                          </div>
                        </td>
                        <td className="p-2 font-mono">
                          {formatDate(evDate, viewTz)} {formatClockTime(evDate, viewTz)}
                        </td>
                        <td className="p-2 font-mono">
                          {formatClockTime(ev.blackoutStart, viewTz)}–
                          {formatClockTime(ev.blackoutEnd, viewTz)} (-{ev.pre_window_minutes}m / +
                          {ev.post_window_minutes}m)
                        </td>
                        <td className="p-2 font-mono">
                          {ev.status === "in_blackout" ? (
                            <span className="rounded bg-destructive/20 px-2 py-0.5 text-[10px] font-bold text-destructive">
                              IN BLACKOUT
                            </span>
                          ) : ev.status === "approaching" ? (
                            <span className="rounded bg-info/20 px-2 py-0.5 text-[10px] font-bold text-info">
                              IN {ev.minutesUntilEvent}M
                            </span>
                          ) : ev.status === "upcoming" ? (
                            <span className="text-muted-foreground">Scheduled</span>
                          ) : (
                            <span className="text-muted-foreground">Passed</span>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          <button
                            type="button"
                            aria-label={`Delete event ${ev.title}`}
                            onClick={() => void handleDeleteEvent(ev.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="inline h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
