import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePlans } from "@/hooks/use-entitlements";
import { supabase } from "@/lib/supabase";
import { FEATURES, FEATURE_KEYS, type Plan } from "@/lib/plans";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Owner Console | Forex Session Compass" },
      { name: "description", content: "Owner console for subscriptions, payments and plans." },
      { property: "og:title", content: "Owner Console | Forex Session Compass" },
      { property: "og:description", content: "Owner console for subscriptions, payments and plans." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { session, isAdmin, loading } = useAuth();
  if (loading) return <main className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">Loading…</main>;
  if (!session || !isAdmin) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <PageHeader eyebrow="Owner" title="Owner console">This page is only available to the site owner.</PageHeader>
        {!session && <Button asChild><Link to="/login">Log in</Link></Button>}
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader eyebrow="Owner" title="Owner console">
        You have full access to every premium feature. Academy rentals are still managed in the{" "}
        <Link to="/academy" className="underline">dashboard</Link>.
      </PageHeader>
      <Stats />
      <Payments />
      <Subscriptions />
      <Plans />
      <Instructions />
    </main>
  );
}

const card = "rounded-lg border bg-panel p-5";
function useErr() {
  const [msg, setMsg] = useState<string | null>(null);
  return [msg, setMsg] as const;
}

function Stats() {
  const q = useQuery({
    queryKey: ["admin_stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_stats");
      if (error) throw error;
      return (data as Array<Record<string, number>>)[0];
    },
  });
  const items = [
    ["Registered users", q.data?.total_users],
    ["Active subscriptions", q.data?.active_subscriptions],
    ["Payments awaiting review", q.data?.pending_payments],
    ["Verified payments", q.data?.verified_payments],
  ] as const;
  return (
    <section className="grid gap-3 sm:grid-cols-4">
      {items.map(([l, v]) => (
        <div key={l} className={card}><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-bold">{q.isLoading ? "…" : String(v ?? 0)}</p></div>
      ))}
    </section>
  );
}

function Payments() {
  const qc = useQueryClient();
  const [err, setErr] = useErr();
  const q = useQuery({
    queryKey: ["admin_payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  const emails = useEmails();
  async function review(id: string, approve: boolean) {
    const note = approve ? "" : (window.prompt("Reason for rejection (optional)") ?? "");
    setErr(null);
    const { error } = await supabase.rpc("admin_review_payment", { p_payment_id: id, p_approve: approve, p_note: note });
    if (error) setErr(error.message);
    void qc.invalidateQueries();
  }
  return (
    <section className={card}>
      <h2 className="font-semibold">Payment records</h2>
      <p className="text-xs text-muted-foreground">Only verify a payment after confirming the money arrived in your account.</p>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      {q.data?.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No payments yet.</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {q.data?.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="py-2 pr-2">{emails.get(p.user_id) ?? p.user_id.slice(0, 8)}</td>
                <td className="pr-2">{p.plan_id}</td>
                <td className="pr-2">{p.method} · {p.reference}</td>
                <td className="pr-2">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="pr-2 font-medium">{p.status}</td>
                <td className="whitespace-nowrap">
                  {p.status === "submitted" && (
                    <>
                      <Button size="sm" onClick={() => review(p.id, true)}>Verify & activate</Button>{" "}
                      <Button size="sm" variant="outline" onClick={() => review(p.id, false)}>Reject</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function useEmails() {
  const q = useQuery({
    queryKey: ["admin_academies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("academies").select("id, email, contact_name").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return new Map((q.data ?? []).map((a) => [a.id, a.email]));
}

function Subscriptions() {
  const qc = useQueryClient();
  const plans = usePlans();
  const [err, setErr] = useErr();
  const users = useQuery({
    queryKey: ["admin_academies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("academies").select("id, email, contact_name").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const subs = useQuery({
    queryKey: ["admin_subs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subscriptions").select("*");
      if (error) throw error;
      return new Map(data.map((s) => [s.user_id, s]));
    },
  });
  const [choice, setChoice] = useState<Record<string, string>>({});
  async function act(userId: string, action: "activate" | "suspend" | "cancel") {
    setErr(null);
    const { error } = await supabase.rpc("admin_set_subscription", { p_user_id: userId, p_plan_id: choice[userId] ?? "pro", p_action: action });
    if (error) setErr(error.message);
    void qc.invalidateQueries();
  }
  const paid = (plans.data ?? []).filter((p) => p.id !== "free");
  return (
    <section className={card}>
      <h2 className="font-semibold">Users & subscriptions</h2>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {users.data?.map((u) => {
              const s = subs.data?.get(u.id);
              const expired = s && new Date(s.expires_at) <= new Date();
              return (
                <tr key={u.id} className="border-t">
                  <td className="py-2 pr-2">{u.email}<span className="block text-xs text-muted-foreground">{u.contact_name}</span></td>
                  <td className="pr-2">{s ? `${s.plan_id} · ${expired && s.status === "active" ? "expired" : s.status} · until ${new Date(s.expires_at).toLocaleDateString()}` : "Free"}</td>
                  <td className="whitespace-nowrap">
                    <select aria-label="Plan" className="rounded border bg-background px-2 py-1" value={choice[u.id] ?? s?.plan_id ?? "pro"} onChange={(e) => setChoice({ ...choice, [u.id]: e.target.value })}>
                      {paid.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>{" "}
                    <Button size="sm" onClick={() => act(u.id, "activate")}>Activate / extend</Button>{" "}
                    {s && <Button size="sm" variant="outline" onClick={() => act(u.id, "suspend")}>Suspend</Button>}{" "}
                    {s && <Button size="sm" variant="outline" onClick={() => act(u.id, "cancel")}>Cancel</Button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Plans() {
  const plans = usePlans();
  return (
    <section className={card}>
      <h2 className="font-semibold">Plans, prices & features</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        {plans.data?.map((p) => <PlanEditor key={p.id} plan={p} />)}
      </div>
    </section>
  );
}

function PlanEditor({ plan }: { plan: Plan }) {
  const qc = useQueryClient();
  const [f, setF] = useState(plan);
  const [price, setPrice] = useState(plan.price_cents === null ? "" : String(plan.price_cents / 100));
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => setF(plan), [plan]);
  async function save() {
    setMsg(null);
    const cents = price.trim() === "" ? null : Math.round(Number(price) * 100);
    if (cents !== null && (!Number.isFinite(cents) || cents < 0)) return setMsg("Enter a valid price.");
    const { error } = await supabase.rpc("admin_update_plan", {
      p_id: f.id, p_name: f.name, p_description: f.description, p_price_cents: cents as number,
      p_currency: f.currency, p_period_days: f.period_days, p_features: f.features, p_is_active: f.is_active,
    });
    setMsg(error ? error.message : "Saved.");
    void qc.invalidateQueries({ queryKey: ["plans"] });
  }
  const free = f.id === "free";
  return (
    <div className="space-y-2 rounded border p-3 text-sm">
      <Input aria-label="Plan name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Textarea aria-label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      {!free && (
        <div className="flex gap-2">
          <Input aria-label="Price" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
          <Input aria-label="Currency" className="w-20" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} />
          <Input aria-label="Days" type="number" className="w-20" value={f.period_days} onChange={(e) => setF({ ...f, period_days: Number(e.target.value) })} />
        </div>
      )}
      {!free && FEATURE_KEYS.map((k) => (
        <label key={k} className="flex items-center gap-2">
          <input type="checkbox" checked={f.features.includes(k)} onChange={(e) => setF({ ...f, features: e.target.checked ? [...f.features, k] : f.features.filter((x) => x !== k) })} />
          {FEATURES[k]}
        </label>
      ))}
      {!free && (
        <label className="flex items-center gap-2 font-medium">
          <input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Plan available for sale
        </label>
      )}
      <Button size="sm" onClick={save}>Save {f.name}</Button>
      {msg && <p className="text-xs">{msg}</p>}
    </div>
  );
}

function Instructions() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("payment_instructions").maybeSingle();
      if (error) throw error;
      return data?.payment_instructions ?? "";
    },
  });
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (q.data !== undefined) setText(q.data); }, [q.data]);
  async function save() {
    const { error } = await supabase.rpc("admin_set_payment_instructions", { p_text: text });
    setMsg(error ? error.message : "Saved.");
    void qc.invalidateQueries({ queryKey: ["app_settings"] });
  }
  return (
    <section className={card}>
      <h2 className="font-semibold">Payment instructions shown to customers</h2>
      <Textarea className="mt-2" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Pay via UPI to … then submit the reference number." />
      <Button size="sm" className="mt-2" onClick={save}>Save instructions</Button>
      {msg && <p className="mt-1 text-xs">{msg}</p>}
    </section>
  );
}
