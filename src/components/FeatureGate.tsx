import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { useEntitlements, usePlans } from "@/hooks/use-entitlements";
import { FEATURES, formatPrice, hasFeature, planForFeature, type FeatureKey } from "@/lib/plans";

export function FeatureGate({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { session, loading } = useAuth();
  const ent = useEntitlements();
  const plans = usePlans();

  if (loading || (session && ent.isLoading)) {
    return <p className="rounded-lg border bg-panel p-6 text-sm text-muted-foreground">Checking your access…</p>;
  }
  if (ent.isError) {
    return <p className="rounded-lg border bg-panel p-6 text-sm text-destructive">We couldn't check your plan. Please refresh the page.</p>;
  }
  if (session && hasFeature(ent.data ?? null, feature)) return <>{children}</>;

  const plan = planForFeature(plans.data ?? [], feature);
  return (
    <div className="rounded-lg border bg-panel p-6">
      <p className="text-xs uppercase tracking-wide text-primary">Premium feature</p>
      <h2 className="mt-1 text-xl font-semibold">{FEATURES[feature]}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {plan
          ? `Included in the ${plan.name} plan (${formatPrice(plan)}).`
          : "This feature is not currently offered on any active plan."}
        {ent.data?.status === "expired" && " Your previous subscription has expired."}
        {ent.data?.status === "suspended" && " Your subscription is suspended."}
        {ent.data?.status === "cancelled" && " Your subscription was cancelled."}
      </p>
      <div className="mt-4 flex gap-2">
        {session ? (
          <Button asChild><Link to="/pricing">See plans & upgrade</Link></Button>
        ) : (
          <>
            <Button asChild><Link to="/login">Log in</Link></Button>
            <Button asChild variant="outline"><Link to="/pricing">See plans</Link></Button>
          </>
        )}
      </div>
    </div>
  );
}
