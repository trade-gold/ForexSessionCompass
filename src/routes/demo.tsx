import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { meta, PageHeader } from "@/components/site";
import { ACADEMY_PRESETS, configSearch } from "@/lib/white-label";
import { SESSIONS, formatTime, getSessionStatus, isDstActive } from "@/lib/forex-time";
import { useNow } from "@/hooks/use-now";

export const Route = createFileRoute("/demo")({
  head: () => meta(
    "Buyer Demo Tour – Explore Forex Session Compass",
    "Guided tour of Forex Session Compass: live session clocks, converters, overlap finder, white-label branding, embeddable widget and academy accounts.",
    "/demo",
  ),
  component: DemoPage,
});

const TOUR = [
  { to: "/", n: "01", title: "Home dashboard & live sessions", desc: "Live open/closed status, countdowns, DST badges and a 24-hour UTC timeline." },
  { to: "/converter", n: "02", title: "Timezone converter", desc: "Convert any date and time across 12 financial timezones and see which sessions are open." },
  { to: "/overlap", n: "03", title: "Session overlap finder", desc: "Exact overlap windows for any date, shown in the timezone you pick." },
  { to: "/utc-to-local", n: "04", title: "UTC to local converter", desc: "Live UTC clock beside your local zone, plus single-timestamp lookup." },
  { to: "/", n: "05", title: "Multi-timezone desk clocks", desc: "Pin up to six zones and save timezone profiles in the browser (on the home page)." },
  { to: "/sessions", n: "06", title: "Session guides", desc: "Reference guides for Sydney, Tokyo, London and New York." },
  { to: "/white-label", n: "07", title: "White-label studio", desc: "Brand name, logo, colours, default zone, clock format and session labels." },
  { to: "/academy", n: "08", title: "Profile & academy portal", desc: "Account dashboard, membership status and admin panel (needs a connected database)." },
] as const;

const CAPS = [
  ["Four major sessions", "Sydney, Tokyo, London and New York, calculated from official IANA timezones."],
  ["Timezone tools", "Converter, UTC-to-local and multi-zone desk clocks with saved profiles."],
  ["Overlap analysis", "London ∩ New York, Tokyo ∩ London and more, for any date."],
  ["Daylight saving aware", "DST badges and detection of the US/UK transition weeks."],
  ["White-label branding", "Per-academy links that need no student login."],
  ["Embeddable widget", "Compact iframe view plus downloadable HTML and JSON config."],
  ["Education & academy", "Session guides plus an account, membership and admin portal."],
] as const;

function DemoPage() {
  const [preset, setPreset] = useState(0);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const now = useNow();
  const cfg = ACADEMY_PRESETS[preset]!.config;
  const qs = new URLSearchParams({ ...configSearch({ ...cfg, embed: true }) }).toString();
  const embedSrc = `/?${qs}`;
  const snippet = `<iframe src="${origin || "https://your-domain.com"}${embedSrc}" width="100%" height="640" style="border:0" title="Forex session clock"></iframe>`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="panel mb-8 border-info/40 bg-info/5 p-3 text-sm text-muted-foreground">
        <span className="font-mono text-xs uppercase tracking-widest text-info">Demo mode</span> · Times are real and computed in your browser. This app does not provide price feeds. Academy names below are fictional examples.
      </div>

      <PageHeader eyebrow="Buyer demo tour" title="Explore Forex Session Compass">
        A complete, DST-aware forex time utility with white-label branding and an embeddable widget. Every link below opens the working feature.
      </PageHeader>

      <section className="mb-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {now && SESSIONS.map((s) => {
          const st = getSessionStatus(s, now);
          return (
            <div key={s.id} className="panel p-4 transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <span className="font-medium">{s.name}</span>
                <span className={`rounded px-2 py-0.5 font-mono text-xs ${st.open ? "bg-up/15 text-up" : "bg-muted text-muted-foreground"}`}>
                  {st.open ? "OPEN" : "CLOSED"}
                </span>
              </div>
              <p className="mt-2 font-mono text-2xl">{formatTime(now, s.tz)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.tz}{isDstActive(now, s.tz) ? " · DST" : ""}</p>
            </div>
          );
        })}
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold">Guided tour</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {TOUR.map((t) => (
            <Link key={t.n} to={t.to} className="panel group flex gap-4 p-4 transition-colors hover:border-info/60">
              <span className="font-mono text-sm text-info">{t.n}</span>
              <span>
                <span className="block font-medium group-hover:text-info">{t.title} →</span>
                <span className="mt-1 block text-sm text-muted-foreground">{t.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold">Capabilities</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CAPS.map(([t, d]) => (
            <div key={t} className="panel p-4">
              <p className="font-medium text-up">{t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Embed widget & white-label preview</h2>
            <p className="text-sm text-muted-foreground">Switch a fictional academy to see branding applied to the live embedded widget.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ACADEMY_PRESETS.map((p, i) => (
              <button key={p.id} type="button" onClick={() => setPreset(i)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${i === preset ? "border-info bg-info/15 text-foreground" : "text-muted-foreground hover:bg-accent"}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="panel overflow-hidden">
          <div className="flex items-center gap-2 border-b bg-panel px-3 py-2 font-mono text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-info/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-up/70" />
            <span className="ml-2 truncate">academy-website.example/live-sessions</span>
          </div>
          <iframe key={embedSrc} src={embedSrc} title="Embedded session widget preview" className="h-[640px] w-full border-0" />
        </div>
        <pre className="panel mt-3 overflow-x-auto p-3 font-mono text-xs text-muted-foreground">{snippet}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void navigator.clipboard?.writeText(snippet)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Copy embed code</button>
          <Link to="/white-label" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">Open full white-label studio</Link>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-xl font-semibold">Profile & academy preview</h2>
        <p className="mb-4 text-sm text-muted-foreground">Sample data only. The real portal uses secure sign-in and needs the buyer's own database connected.</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Account</p>
            <p className="mt-2 font-medium">Demo Academy Owner</p>
            <p className="text-sm text-muted-foreground">owner@demo-academy.example</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Membership</p>
            <p className="mt-2 font-medium text-up">Active (sample)</p>
            <p className="text-sm text-muted-foreground">Admins can activate, renew +30 days or deactivate.</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Sections</p>
            <p className="mt-2 text-sm text-muted-foreground">Overview · Profile · Membership · Subscription · Preferences · Security · Account</p>
          </div>
        </div>
      </section>
    </div>
  );
}
