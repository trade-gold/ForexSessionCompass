import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Lock, RefreshCw, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { FeatureGate } from "@/components/FeatureGate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEntitlements, usePlans } from "@/hooks/use-entitlements";
import { FEATURES, FEATURE_KEYS, hasFeature, planForFeature, type FeatureKey } from "@/lib/plans";

export function PlanFeatures({ account = false }: { account?: boolean }) {
  const { session } = useAuth();
  const plans = usePlans();
  const ent = useEntitlements();
  const [selected, setSelected] = useState<FeatureKey | null>(null);
  const [expanded, setExpanded] = useState(!account);
  const features = FEATURE_KEYS.filter((feature) => planForFeature(plans.data ?? [], feature));
  const included = features.filter((feature) => session && hasFeature(ent.data ?? null, feature)).length;

  return (
    <section className="my-8 border-y py-6" aria-label="Pro and Elite features">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-info">Pro & Elite</p>
          <h2 className="mt-1 text-xl font-semibold">{account ? "Your plan & premium features" : "Premium feature access"}</h2>
          {session ? (
            <div className="mt-2 text-sm text-muted-foreground" aria-live="polite">
              {ent.isLoading ? "Checking your subscription…" : ent.isError ? "Your subscription could not be loaded." : ent.data ? (
                <><strong className="text-foreground">{ent.data.is_admin ? "Owner · all features included" : ent.data.plan_name}</strong> · {ent.data.status}
                  {ent.data.expires_at && <> · expires {new Date(ent.data.expires_at).toLocaleDateString()}</>}
                  <span className="block mt-1">{included} of {features.length} premium features included</span>
                </>
              ) : "Subscription details unavailable."}
            </div>
          ) : <p className="mt-2 text-sm text-muted-foreground">Sign in to check your plan access.</p>}
          {account && <p className="mt-2 text-xs text-muted-foreground">Pro / Elite subscription · separate from academy rental access</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {session && <Button variant="outline" size="sm" onClick={() => void ent.refetch()} disabled={ent.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${ent.isFetching ? "animate-spin motion-reduce:animate-none" : ""}`} />Refresh plan</Button>}
          {account && <Button asChild variant="outline" size="sm"><Link to="/pricing">Plans & payments<ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button>}
          {account && <Button variant="outline" size="sm" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Hide features" : "View features"}</Button>}
        </div>
      </div>
      {expanded && <div className="mt-6">
        {plans.isLoading && <p className="text-sm text-muted-foreground">Loading premium features…</p>}
        {plans.isError && <div className="flex items-center gap-3 text-sm text-destructive">Features could not be loaded.<Button variant="outline" size="sm" onClick={() => void plans.refetch()}>Retry</Button></div>}
        {!plans.isLoading && !plans.isError && features.length === 0 && <p className="text-sm text-muted-foreground">No premium features are currently offered.</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const plan = planForFeature(plans.data ?? [], feature);
            const unlocked = session && hasFeature(ent.data ?? null, feature);
            const checking = session && (ent.isLoading || ent.isError || !ent.data);
            return <article key={feature} className="flex flex-col rounded-lg border bg-panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-mono text-info">{plan?.name}</span>
                <span className={unlocked ? "flex items-center gap-1 text-up" : "flex items-center gap-1 text-muted-foreground"}>
                  {unlocked ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  {checking ? "Access unverified" : unlocked ? "Included in your plan" : "Requires plan access"}
                </span>
              </div>
              <h3 className="mt-3 font-semibold">{FEATURES[feature]}</h3>
              <p className="mb-4 mt-2 text-xs text-muted-foreground">Tool not available yet</p>
              <Button variant="outline" size="sm" className="mt-auto self-start" onClick={() => setSelected(feature)}>View access<ArrowUpRight className="ml-2 h-3.5 w-3.5" /></Button>
            </article>;
          })}
        </div>
      </div>}
      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected ? FEATURES[selected] : "Premium feature"}</DialogTitle>
            <DialogDescription>Subscription access and tool availability</DialogDescription>
          </DialogHeader>
          {selected && <FeatureGate feature={selected}>
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm text-up"><CheckCircle2 className="h-4 w-4" />Included in your current access</p>
              <p className="text-sm text-muted-foreground">This tool is not available yet. Your subscription includes this feature, but the tool has not been released.</p>
              <Button asChild variant="outline"><Link to="/contact">Contact the owner</Link></Button>
            </div>
          </FeatureGate>}
        </DialogContent>
      </Dialog>
    </section>
  );
}