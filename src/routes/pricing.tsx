import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEntitlements, usePlans } from "@/hooks/use-entitlements";
import { supabase } from "@/lib/supabase";
import { FEATURES, formatPrice, type FeatureKey } from "@/lib/plans";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Plans & Pricing | Forex Session Compass" },
      { name: "description", content: "Compare Free, Pro and Elite plans for Forex Session Compass trader tools." },
      { property: "og:title", content: "Plans & Pricing | Forex Session Compass" },
      { property: "og:description", content: "Compare Free, Pro and Elite plans for Forex Session Compass trader tools." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PricingPage,
});

const FREE_ITEMS = ["Live forex session clocks", "Basic timezone converter", "Session guides & overlaps"];

function PricingPage() {
  const plans = usePlans();
  const { session } = useAuth();
  const ent = useEntitlements();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader eyebrow="Plans" title="Choose your plan">
        Payments are verified manually by the site owner. Access starts only after your payment is confirmed.
      </PageHeader>
      {session && ent.data && (
        <p className="mb-6 rounded-md border bg-panel p-3 text-sm">
          Your current plan: <strong>{ent.data.plan_name}</strong> ({ent.data.status}
          {ent.data.expires_at ? `, until ${new Date(ent.data.expires_at).toLocaleDateString()}` : ""})
        </p>
      )}
      {plans.isLoading && <p className="text-sm text-muted-foreground">Loading plans…</p>}
      {plans.isError && <p className="text-sm text-destructive">Plans could not be loaded. Please refresh.</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {(plans.data ?? []).filter((p) => p.is_active).map((p) => (
          <section key={p.id} className="flex flex-col rounded-lg border bg-panel p-5">
            <h2 className="text-lg font-semibold">{p.name}</h2>
            <p className="mt-1 text-2xl font-bold">{formatPrice(p)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
            <ul className="mt-4 space-y-1 text-sm">
              {(p.id === "free" ? FREE_ITEMS : p.features.map((f) => FEATURES[f as FeatureKey] ?? f)).map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {session ? <PaymentSection /> : (
        <p className="mt-8 text-sm">
          <Link to="/register" className="text-primary underline">Create an account</Link> or{" "}
          <Link to="/login" className="text-primary underline">log in</Link> to upgrade.
        </p>
      )}
    </main>
  );
}

function PaymentSection() {
  const qc = useQueryClient();
  const plans = usePlans();
  const paid = (plans.data ?? []).filter((p) => p.is_active && p.id !== "free");
  const [planId, setPlanId] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const settings = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("payment_instructions").maybeSingle();
      if (error) throw error;
      return data?.payment_instructions ?? "";
    },
  });
  const payments = useQuery({
    queryKey: ["my_payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("id, plan_id, method, reference, status, admin_note, created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("submit_payment", { p_plan_id: planId, p_method: method, p_reference: reference });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: "Submitted. Your plan activates once the owner verifies this payment." });
    setReference("");
    void qc.invalidateQueries({ queryKey: ["my_payments"] });
  }

  return (
    <section className="mt-10 grid gap-6 md:grid-cols-2">
      <div className="rounded-lg border bg-panel p-5">
        <h2 className="font-semibold">How to pay</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{settings.data ?? "Loading…"}</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="plan">Plan</Label>
            <select id="plan" required value={planId} onChange={(e) => setPlanId(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="">Select a plan</option>
              {paid.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatPrice(p)}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="method">Payment method</Label>
            <Input id="method" required minLength={2} maxLength={40} placeholder="e.g. UPI, bank transfer" value={method} onChange={(e) => setMethod(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ref">Transaction reference</Label>
            <Input id="ref" required minLength={3} maxLength={120} placeholder="Reference / UTR number" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit payment for review"}</Button>
          {msg && <p className={`text-sm ${msg.ok ? "text-up" : "text-destructive"}`}>{msg.text}</p>}
        </form>
      </div>
      <div className="rounded-lg border bg-panel p-5">
        <h2 className="font-semibold">Your payment submissions</h2>
        {payments.isLoading && <p className="mt-2 text-sm text-muted-foreground">Loading…</p>}
        {payments.data?.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No payments submitted yet.</p>}
        <ul className="mt-3 space-y-2 text-sm">
          {payments.data?.map((p) => (
            <li key={p.id} className="rounded border p-2">
              <strong>{p.plan_id}</strong> · {p.method} · {p.reference} — <span className="font-medium">{p.status}</span>
              <span className="block text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}{p.admin_note ? ` · Note: ${p.admin_note}` : ""}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
