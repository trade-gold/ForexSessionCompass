import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { useEntitlements, usePlans } from "@/hooks/use-entitlements";
import {
  FEATURES,
  formatPrice,
  hasFeature,
  planForFeature,
  type Entitlements,
  type FeatureKey,
} from "@/lib/plans";

const ELITE_ONLY_FEATURES: FeatureKey[] = ["journal", "events", "reports", "alerts"];

export function FeatureGate({
  feature,
  overrideEntitlements,
  children,
}: {
  feature: FeatureKey;
  overrideEntitlements?: Entitlements | null | undefined;
  children: ReactNode;
}) {
  const { session, isAdmin, loading } = useAuth();
  const ent = useEntitlements();
  const plans = usePlans();

  if (loading || (session && ent.isLoading && overrideEntitlements === undefined)) {
    return (
      <div role="status" className="rounded-lg border bg-panel p-6 text-sm text-muted-foreground">
        Verifying your subscription entitlements…
      </div>
    );
  }
  if (ent.isError && overrideEntitlements === undefined && !isAdmin) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/40 bg-panel p-6 text-sm text-destructive">
        We couldn't verify your subscription status right now. Please refresh the page or try signing in again.
      </div>
    );
  }

  const effectiveEntitlements: Entitlements | null =
    overrideEntitlements !== undefined
      ? overrideEntitlements
      : ent.data ??
        (isAdmin
          ? {
              plan_id: "owner",
              plan_name: "Owner (all features)",
              status: "active",
              expires_at: null,
              is_admin: true,
              features: Object.keys(FEATURES),
            }
          : null);

  if ((session || overrideEntitlements !== undefined) && hasFeature(effectiveEntitlements, feature)) {
    return <>{children}</>;
  }

  const requiredTier = ELITE_ONLY_FEATURES.includes(feature) ? "ELITE" : "PRO";
  const plan = planForFeature(plans.data ?? [], feature);
  const status = effectiveEntitlements?.status ?? "inactive";
  const currentPlanId = effectiveEntitlements?.plan_id ?? "free";

  return (
    <div className="rounded-lg border border-primary/30 bg-panel p-6" role="region" aria-label={`Locked ${requiredTier} feature`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-primary">
          <Lock className="h-3.5 w-3.5" />
          <span>{requiredTier} Subscription Required</span>
        </p>
        <span
          className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${
            requiredTier === "ELITE" ? "bg-info/20 text-info" : "bg-up/20 text-up"
          }`}
        >
          {requiredTier} TIER
        </span>
      </div>
      <h2 className="mt-2 text-xl font-semibold">{FEATURES[feature]}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {plan
          ? `This tool is unlocked on the ${plan.name} plan (${formatPrice(plan)}).`
          : `This tool requires an active ${requiredTier === "ELITE" ? "Elite" : "Pro or Elite"} subscription.`}
      </p>

      {!session && overrideEntitlements === undefined && (
        <p className="mt-2 rounded border border-info/30 bg-info/10 px-3 py-2 text-xs text-info">
          You are currently browsing as a guest. Sign in to verify your subscription or upgrade your account.
        </p>
      )}
      {status === "expired" && (
        <p className="mt-2 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Your {effectiveEntitlements?.plan_name ?? "paid"} subscription has expired
          {effectiveEntitlements?.expires_at
            ? ` on ${new Date(effectiveEntitlements.expires_at).toLocaleDateString()}`
            : ""}
          . Renew on the Pricing page to restore access to your saved tools and data.
        </p>
      )}
      {status === "suspended" && (
        <p className="mt-2 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Your subscription is currently suspended. Please contact support or review your billing status on the Pricing page.
        </p>
      )}
      {status === "cancelled" && (
        <p className="mt-2 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Your subscription has been cancelled. Reactivate a plan on the Pricing page to unlock this tool.
        </p>
      )}
      {status === "pending" && (
        <p className="mt-2 rounded border border-info/40 bg-info/10 px-3 py-2 text-xs text-info">
          Your payment submission is pending administrator verification. Access will unlock automatically as soon as your payment is approved.
        </p>
      )}
      {session && status === "active" && currentPlanId === "pro" && requiredTier === "ELITE" && (
        <p className="mt-2 rounded border border-info/40 bg-info/10 px-3 py-2 text-xs text-info">
          Your account is on the <strong>Pro</strong> plan. Upgrade to <strong>Elite</strong> to unlock the Trade Journal, Performance Intelligence Reports, and Economic Event Risk Planner.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {session ? (
          <Button asChild>
            <Link to="/pricing">
              {status === "expired" || status === "cancelled"
                ? "Renew subscription"
                : currentPlanId === "pro" && requiredTier === "ELITE"
                  ? "Upgrade to Elite"
                  : "See plans & upgrade"}
            </Link>
          </Button>
        ) : (
          <>
            <Button asChild>
              <Link to="/login">Log in to access</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/pricing">Compare Free, Pro & Elite plans</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
