import { z } from "zod";

export const FEATURES = {
  overlap_advanced: "Advanced session overlap analysis",
  workspace: "Multi-timezone workspace",
  risk_calculator: "Smart risk & position calculator",
  discipline: "Trader discipline guardian",
  planner: "Session opportunity planner",
  journal: "Trade journal & performance analytics",
  events: "Economic event risk planner",
  reports: "Personal trading reports",
  alerts: "Premium alerts & customization",
} as const;

export type FeatureKey = keyof typeof FEATURES;
export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];

const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price_cents: z.number().nullable(),
  currency: z.string(),
  period_days: z.number(),
  features: z.array(z.string()),
  is_active: z.boolean(),
  sort_order: z.number(),
});
export type Plan = z.infer<typeof planSchema>;

const entitlementSchema = z.object({
  plan_id: z.string(),
  plan_name: z.string(),
  status: z.string(),
  expires_at: z.string().nullable(),
  is_admin: z.boolean(),
  features: z.array(z.string()),
});
export type Entitlements = z.infer<typeof entitlementSchema>;

export function parsePlans(data: unknown): Plan[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((d) => {
    const p = planSchema.safeParse(d);
    return p.success ? [p.data] : [];
  });
}

export function parseEntitlements(data: unknown): Entitlements | null {
  const row = Array.isArray(data) ? data[0] : data;
  const p = entitlementSchema.safeParse(row);
  return p.success ? p.data : null;
}

/** UI-side check only; the database enforces the same rule via has_feature(). */
export function hasFeature(e: Entitlements | null, feature: FeatureKey): boolean {
  if (!e) return false;
  if (e.is_admin) return true;
  return e.features.includes(feature);
}

/** Cheapest active paid plan that includes a feature (for upgrade prompts). */
export function planForFeature(plans: Plan[], feature: FeatureKey): Plan | null {
  return (
    plans
      .filter((p) => p.is_active && p.id !== "free" && p.features.includes(feature))
      .sort((a, b) => a.sort_order - b.sort_order)[0] ?? null
  );
}

export function formatPrice(p: Pick<Plan, "price_cents" | "currency" | "period_days">): string {
  if (p.price_cents === null) return "Price not set yet";
  if (p.price_cents === 0) return "Free";
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: p.currency }).format(
    p.price_cents / 100,
  );
  return `${amount} / ${p.period_days} days`;
}
