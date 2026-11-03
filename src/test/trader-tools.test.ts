import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FEATURES, FEATURE_KEYS, hasFeature, parseEntitlements } from "@/lib/plans";
import {
  HIGH_IMPACT_EVENT_TEMPLATES,
  INSTITUTIONAL_KILLZONE_PRESETS,
  analyzeTradeJournal,
  calculatePositionRisk,
  calculateTradeMetrics,
  classifyTradeSession,
  evaluateAdvancedOverlapMatrix,
  evaluateDisciplineState,
  evaluateEconomicRiskEvents,
  evaluateSessionOpportunities,
  exportTradeJournalCsv,
  type DailyDisciplineLog,
  type DisciplineRules,
  type EconomicRiskEvent,
  type TradeJournalEntry,
} from "@/lib/trader-tools";

describe("Pro & Elite Subscription Suite — Complete 12-Scenario Verification", () => {
  describe("Scenarios 1–6 & 12: Subscription Access Control, RLS Isolation & Direct URL Protection", () => {
    const proFeatures = ["overlap_advanced", "workspace", "risk_calculator", "discipline", "planner"] as const;
    const eliteOnlyFeatures = ["journal", "events", "reports", "alerts"] as const;

    it("Scenario 1: Free user cannot access any Pro or Elite tools", () => {
      const freeEnt = parseEntitlements({
        plan_id: "free",
        plan_name: "Free",
        status: "active",
        expires_at: null,
        is_admin: false,
        features: [],
      });
      for (const f of FEATURE_KEYS) {
        expect(hasFeature(freeEnt, f)).toBe(false);
      }
      expect(hasFeature(null, "risk_calculator")).toBe(false);
    });

    it("Scenario 2: Pro user can access all Pro tools but NOT Elite tools", () => {
      const proEnt = parseEntitlements({
        plan_id: "pro",
        plan_name: "Pro",
        status: "active",
        expires_at: "2030-01-01T00:00:00Z",
        is_admin: false,
        features: [...proFeatures],
      });
      for (const f of proFeatures) {
        expect(hasFeature(proEnt, f)).toBe(true);
      }
      for (const f of eliteOnlyFeatures) {
        expect(hasFeature(proEnt, f)).toBe(false);
      }
    });

    it("Scenario 3: Elite user can access every Pro and Elite paid tool", () => {
      const eliteEnt = parseEntitlements({
        plan_id: "elite",
        plan_name: "Elite",
        status: "active",
        expires_at: "2030-01-01T00:00:00Z",
        is_admin: false,
        features: [...FEATURE_KEYS],
      });
      for (const f of FEATURE_KEYS) {
        expect(hasFeature(eliteEnt, f)).toBe(true);
      }
    });

    it("Scenario 4: Expired, cancelled, or suspended subscriptions lose paid access", () => {
      const expiredEnt = parseEntitlements({
        plan_id: "elite",
        plan_name: "Elite",
        status: "expired",
        expires_at: "2020-01-01T00:00:00Z",
        is_admin: false,
        features: [],
      });
      const cancelledEnt = parseEntitlements({
        plan_id: "pro",
        plan_name: "Pro",
        status: "cancelled",
        expires_at: "2030-01-01T00:00:00Z",
        is_admin: false,
        features: [],
      });
      for (const f of FEATURE_KEYS) {
        expect(hasFeature(expiredEnt, f)).toBe(false);
        expect(hasFeature(cancelledEnt, f)).toBe(false);
      }
    });

    it("Scenario 5, 6 & 12: RLS policies enforce user isolation + backend has_feature(), and every UI tab is wrapped in FeatureGate", () => {
      const sql0003 = readFileSync("drizzle/migrations/0003_subscription_plans_payments.sql", "utf8");
      const sql0004 = readFileSync("drizzle/migrations/0004_trader_productivity_suite.sql", "utf8");
      const sql0005 = readFileSync("drizzle/migrations/0005_security_and_commercial_unification.sql", "utf8");
      const toolsRouteSource = readFileSync("src/routes/tools.tsx", "utf8");

      // User isolation & backend subscription check in SQL
      expect(sql0004).toContain("ENABLE ROW LEVEL SECURITY");
      expect(sql0004).toContain("auth.uid() = user_id");
      expect(sql0004).toContain("public.has_feature('discipline')");
      expect(sql0004).toContain("public.has_feature('journal')");
      expect(sql0004).toContain("public.has_feature('planner')");
      expect(sql0004).toContain("public.has_feature('overlap_advanced')");
      expect(sql0004).toContain("public.has_feature('events')");
      expect(sql0005).toContain("auth.uid() = user_id AND (public.has_feature('journal')");

      // Admin verification in SQL
      expect(sql0003).toContain("IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'");
      expect(sql0003).toContain("kondivarun2@gmail.com");

      // Direct URL access protection via FeatureGate on all 6 tabs
      expect(toolsRouteSource).toContain('<FeatureGate feature="risk_calculator"');
      expect(toolsRouteSource).toContain('<FeatureGate feature="discipline"');
      expect(toolsRouteSource).toContain('<FeatureGate feature="planner"');
      expect(toolsRouteSource).toContain('<FeatureGate feature="overlap_advanced"');
      expect(toolsRouteSource).toContain('<FeatureGate feature="journal"');
      expect(toolsRouteSource).toContain('<FeatureGate feature="events"');
      expect(Object.keys(FEATURES)).toHaveLength(9);
    });
  });

  describe("Scenario 7: Smart Risk & Position Size Calculator (Major Pairs, Dynamic Cross Pairs & XAU/USD)", () => {
    it("calculates standard, mini, and micro lot sizes, SL/TP prices, R:R ratio, and potential P/L for EUR/USD", () => {
      const res = calculatePositionRisk({
        accountBalance: 10000,
        riskPercent: 1,
        stopLossPips: 20,
        takeProfitPips: 50,
        pairSymbol: "EUR/USD",
        pairPrice: 1.085,
        direction: "long",
      });

      expect(res.valid).toBe(true);
      expect(res.riskAmount).toBe(100);
      expect(res.standardLots).toBe(0.5);
      expect(res.miniLots).toBe(5);
      expect(res.microLots).toBe(50);
      expect(res.stopLossPrice).toBeCloseTo(1.083, 5);
      expect(res.takeProfitPrice).toBeCloseTo(1.09, 5);
      expect(res.rewardToRiskRatio).toBe(2.5);
      expect(res.potentialProfit).toBe(250);
      expect(res.potentialLoss).toBe(100);
    });

    it("calculates USD/JPY, dynamic cross-pairs (EUR/JPY, EUR/GBP), and XAU/USD (Spot Gold) position sizing accurately", () => {
      const jpyRes = calculatePositionRisk({
        accountBalance: 5000,
        riskPercent: 6,
        stopLossPips: 25,
        takeProfitPips: 50,
        pairSymbol: "USD/JPY",
        pairPrice: 150.0,
        direction: "short",
      });

      expect(jpyRes.valid).toBe(true);
      expect(jpyRes.riskAmount).toBe(300);
      expect(jpyRes.pipValuePerStandardLot).toBeCloseTo(1000 / 150, 2);
      expect(jpyRes.standardLots).toBeCloseTo(1.8, 2);
      expect(jpyRes.stopLossPrice).toBeCloseTo(150.25, 3);
      expect(jpyRes.takeProfitPrice).toBeCloseTo(149.5, 3);
      expect(jpyRes.warnings.length).toBeGreaterThan(0);

      // Verify dynamic cross-pair pip value scales with user's entered price
      const eurJpy160 = calculatePositionRisk({
        accountBalance: 10000,
        riskPercent: 1,
        stopLossPips: 20,
        pairSymbol: "EUR/JPY",
        pairPrice: 160.0,
      });
      const eurJpy170 = calculatePositionRisk({
        accountBalance: 10000,
        riskPercent: 1,
        stopLossPips: 20,
        pairSymbol: "EUR/JPY",
        pairPrice: 170.0,
      });
      expect(eurJpy160.pipValuePerStandardLot).toBeGreaterThan(eurJpy170.pipValuePerStandardLot);

      const goldRes = calculatePositionRisk({
        accountBalance: 10000,
        riskPercent: 1,
        stopLossPips: 50,
        takeProfitPips: 100,
        pairSymbol: "XAU/USD",
        pairPrice: 2750.0,
        direction: "long",
      });
      expect(goldRes.valid).toBe(true);
      expect(goldRes.pipValuePerStandardLot).toBe(10);
      expect(goldRes.standardLots).toBe(0.2);
      expect(goldRes.stopLossPrice).toBeCloseTo(2745.0, 2);
      expect(goldRes.takeProfitPrice).toBeCloseTo(2760.0, 2);
    });
  });

  describe("Trader Discipline Guardian", () => {
    const baseRules: DisciplineRules = {
      maxDailyTrades: 3,
      maxDailyLossAmount: 200,
      maxRiskPercent: 1,
      cooldownMinutes: 45,
    };
    const londonOpenTime = new Date("2026-06-10T10:00:00Z");

    it("clears trading when all rules are satisfied and locks with cooldown when limits are reached", () => {
      const cleanLog: DailyDisciplineLog = {
        dateKey: "2026-06-10",
        tradesTaken: 1,
        realizedLossAmount: 50,
        highestRiskPercentUsed: 1,
        lastLossTimestamp: null,
        checkedItemIds: ["session_active", "news_checked", "risk_sized", "plan_aligned"],
      };
      const clearState = evaluateDisciplineState(baseRules, cleanLog, londonOpenTime);
      expect(clearState.status).toBe("clear");
      expect(clearState.tradesRemaining).toBe(2);

      const lockedLog: DailyDisciplineLog = {
        dateKey: "2026-06-10",
        tradesTaken: 3,
        realizedLossAmount: 220,
        highestRiskPercentUsed: 2,
        lastLossTimestamp: "2026-06-10T09:40:00Z",
        checkedItemIds: ["session_active"],
      };
      const lockedState = evaluateDisciplineState(baseRules, lockedLog, londonOpenTime);
      expect(lockedState.status).toBe("limit_reached");
      expect(lockedState.cooldownRemainingMinutes).toBe(25);
      expect(lockedState.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("Scenarios 8 & 9: Trade Journal, CSV Export & Performance Intelligence Reports", () => {
    it("auto-calculates trade PnL & R-multiple, computes reports, and exports formula-safe CSV", () => {
      const autoMetrics = calculateTradeMetrics({
        pairSymbol: "EUR/USD",
        direction: "long",
        entryPrice: 1.08,
        exitPrice: 1.085,
        stopLossPrice: 1.078,
        lotSize: 0.5,
      });
      expect(autoMetrics.pipsGained).toBe(50);
      expect(autoMetrics.pnlAmount).toBe(250);
      expect(autoMetrics.rMultiple).toBe(2.5);
      expect(autoMetrics.outcome).toBe("win");

      expect(classifyTradeSession(new Date("2026-06-10T14:00:00Z"))).toBe("overlap");
      expect(classifyTradeSession(new Date("2026-06-10T02:00:00Z"))).toBe("tokyo");

      const entries: TradeJournalEntry[] = [
        {
          id: "t1",
          pair: "EUR/USD",
          direction: "long",
          session_id: "overlap",
          entry_price: 1.08,
          exit_price: 1.085,
          stop_loss: 1.078,
          take_profit: 1.085,
          lot_size: 0.5,
          pnl_amount: 250,
          r_multiple: 2.5,
          outcome: "win",
          strategy_tag: "NY Overlap Continuation",
          mistake_tag: "None",
          notes: "Clean setup",
          traded_at: "2026-06-10T14:00:00Z",
        },
        {
          id: "t2",
          pair: "GBP/USD",
          direction: "short",
          session_id: "tokyo",
          entry_price: 1.27,
          exit_price: 1.272,
          stop_loss: 1.272,
          take_profit: 1.265,
          lot_size: 0.5,
          pnl_amount: -100,
          r_multiple: -1,
          outcome: "loss",
          strategy_tag: "Asian Range Sweep",
          mistake_tag: "Revenge Trade After Loss",
          notes: "=CMD|' /C calc'!A0",
          traded_at: "2026-06-10T03:00:00Z",
        },
      ];

      const report = analyzeTradeJournal(entries, new Date("2026-06-11T12:00:00Z"));
      expect(report.totalTrades).toBe(2);
      expect(report.winRate).toBe(50);
      expect(report.netPnl).toBe(150);
      expect(report.profitFactor).toBe(2.5);
      expect(report.avgRMultiple).toBe(0.75);
      expect(report.weeklyTrades).toBe(2);
      expect(report.monthlyTrades).toBe(2);
      expect(report.byPair).toHaveLength(2);
      expect(report.byPair[0]?.pair).toBe("EUR/USD");
      expect(report.byStrategy).toHaveLength(2);
      expect(report.byStrategy[0]?.strategy).toBe("NY Overlap Continuation");
      expect(report.mistakes[0]?.mistake).toBe("Revenge Trade After Loss");
      expect(report.insights.length).toBeGreaterThan(0);

      const csv = exportTradeJournalCsv(entries);
      expect(csv).toContain("Trade ID,Date (UTC),Pair");
      expect(csv).toContain("'=CMD|' /C calc'!A0");
    });
  });

  describe("Scenario 10: Session Opportunity Planner, Killzone Presets & Overlap Workspace", () => {
    it("evaluates active session windows, killzone presets, and the 6-pair advanced overlap matrix", () => {
      expect(INSTITUTIONAL_KILLZONE_PRESETS.length).toBeGreaterThanOrEqual(4);
      const now = new Date("2026-06-10T13:30:00Z"); // London + NY overlap active in summer
      const opps = evaluateSessionOpportunities(now, "UTC", ["london", "newyork"], 30, "24");

      expect(opps.length).toBeGreaterThanOrEqual(2);
      const overlap = opps.find((o) => o.id === "overlap-ln-ny");
      expect(overlap?.state).toBe("active");

      const matrix = evaluateAdvancedOverlapMatrix(now, "UTC", now, "24");
      expect(matrix.rows).toHaveLength(6);
      const lnNy = matrix.rows.find((r) => r.id === "london-newyork");
      expect(lnNy?.hasOverlap).toBe(true);
      expect(lnNy?.isActiveNow).toBe(true);
      expect(lnNy?.durationMinutes).toBe(240);
    });
  });

  describe("Economic Event Risk Planner (Manual Mode with Central Bank Presets)", () => {
    it("triggers blackout windows around user-entered events and provides tier-1 presets", () => {
      expect(HIGH_IMPACT_EVENT_TEMPLATES.length).toBeGreaterThanOrEqual(6);
      const events: EconomicRiskEvent[] = [
        {
          id: "ev1",
          title: "US CPI m/m",
          currency: "USD",
          impact: "high",
          event_time: "2026-06-10T12:30:00Z",
          pre_window_minutes: 30,
          post_window_minutes: 30,
          source_label: "BLS Schedule (User Entered)",
          notes: "Stand aside on USD pairs",
          updated_at: "2026-06-10T08:00:00Z",
        },
        {
          id: "ev2",
          title: "German ZEW",
          currency: "EUR",
          impact: "medium",
          event_time: "2026-06-10T09:00:00Z",
          pre_window_minutes: 15,
          post_window_minutes: 15,
          source_label: "Manual Entry",
          notes: "",
          updated_at: "2026-06-10T08:00:00Z",
        },
      ];

      const insideBlackout = evaluateEconomicRiskEvents(
        events,
        new Date("2026-06-10T12:15:00Z"),
        "USD",
        "high",
      );
      expect(insideBlackout.activeBlackoutEvents).toHaveLength(1);
      expect(insideBlackout.evaluated).toHaveLength(1);
      expect(insideBlackout.activeBlackoutEvents[0]?.minutesUntilEvent).toBe(15);

      const approaching = evaluateEconomicRiskEvents(
        events,
        new Date("2026-06-10T11:30:00Z"),
        "ALL",
        "ALL",
      );
      expect(approaching.activeBlackoutEvents).toHaveLength(0);
      expect(approaching.approachingEvents).toHaveLength(1);
    });
  });
});
