import { describe, expect, it } from "vitest";
import { hasFeature, planForFeature, formatPrice, type Entitlements, type Plan } from "@/lib/plans";

const ent = (o: Partial<Entitlements>): Entitlements => ({ plan_id: "free", plan_name: "Free", status: "active", expires_at: null, is_admin: false, features: [], ...o });
const plan = (o: Partial<Plan>): Plan => ({ id: "pro", name: "Pro", description: "", price_cents: null, currency: "USD", period_days: 30, features: [], is_active: true, sort_order: 1, ...o });

describe("plan entitlements", () => {
  it("free users are locked out of premium features", () => {
    expect(hasFeature(ent({}), "risk_calculator")).toBe(false);
  });
  it("owner/admin has every feature without a subscription", () => {
    expect(hasFeature(ent({ is_admin: true }), "journal")).toBe(true);
  });
  it("signed-out users have no premium access", () => {
    expect(hasFeature(null, "planner")).toBe(false);
  });
  it("pro feature list unlocks only listed features", () => {
    const e = ent({ plan_id: "pro", features: ["risk_calculator"] });
    expect(hasFeature(e, "risk_calculator")).toBe(true);
    expect(hasFeature(e, "journal")).toBe(false);
  });
  it("upgrade prompt points to cheapest active plan with the feature", () => {
    const plans = [plan({ id: "elite", sort_order: 2, features: ["journal", "planner"] }), plan({ features: ["planner"] }), plan({ id: "x", sort_order: 0, is_active: false, features: ["planner"] })];
    expect(planForFeature(plans, "planner")?.id).toBe("pro");
    expect(planForFeature(plans, "journal")?.id).toBe("elite");
  });
  it("unset price is shown honestly", () => {
    expect(formatPrice(plan({}))).toBe("Price not set yet");
  });
});
