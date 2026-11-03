import { createFileRoute, Link } from "@tanstack/react-router";
import { useBrand } from "@/components/BrandProvider";
import { SessionClock } from "@/components/SessionClock";
import { meta } from "@/components/site";

export const Route = createFileRoute("/")({
  head: () => ({
    ...meta(
      "Forex Market Session Clock – Live Sydney, Tokyo, London & New York | Forex Time Tools",
      "Live forex session clock showing Sydney, Tokyo, London and New York market hours in your time zone, with daylight saving handled automatically.",
      "/",
    ),
    meta: [
      { name: "google-site-verification", content: "5YFSCOqTK9qZ-F_0rdTj3OY8YkALbLS4GhJZXYPhhaM" },
      ...meta(
        "Forex Market Session Clock – Live Sydney, Tokyo, London & New York | Forex Time Tools",
        "Live forex session clock showing Sydney, Tokyo, London and New York market hours in your time zone, with daylight saving handled automatically.",
        "/",
      ).meta,
    ],
  }),
  component: Index,
});

const TOOLS = [
  {
    to: "/converter",
    title: "Time Zone Converter",
    desc: "Convert any date and time between IST, UTC, London, New York, Tokyo, Sydney and more.",
  },
  {
    to: "/overlap",
    title: "Session Overlap Calculator",
    desc: "See when London and New York overlap, or compare any two sessions on any date.",
  },
  {
    to: "/utc-to-local",
    title: "UTC to Local Time",
    desc: "A live UTC clock beside your chosen local zone, plus a quick UTC time lookup.",
  },
  {
    to: "/sessions",
    title: "Session Guides",
    desc: "Plain-language guides to each session's hours and typical characteristics.",
  },
  {
    to: "/tools",
    title: "Trader Productivity Suite (Pro & Elite)",
    desc: "Position & risk calculator, discipline guardian, session opportunity planner, trade performance journal, and economic event blackout planner.",
  },
  {
    to: "/pricing",
    title: "Subscription Plans (Free · Pro · Elite)",
    desc: "Compare Free, Pro Trader, and Elite Trader tiers or activate your subscription.",
  },
] as const;

function Index() {
  const { config } = useBrand();
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {!config.embed && (
        <section className="mb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-info">Live · DST-aware</p>
          <h1 className="mt-2 text-3xl font-semibold md:text-5xl">
            {config.brand ? `${config.brand} — Session Clock` : "Forex Market Session Clock"}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Real-time status of the four major forex sessions, calculated from your device clock and official IANA time zones.
          </p>
        </section>
      )}
      <SessionClock />
      {!config.embed && (
        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              search={(prev) => prev}
              className="panel block p-5 transition-colors hover:border-info"
            >
              <h2 className="font-semibold">
                {t.title} <span className="text-info">→</span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
            </Link>
          ))}
        </section>
      )}
      <p className="mt-8 text-xs text-muted-foreground">
        Session hours shown are common conventions (08:00–17:00 local for London and New York, 09:00–18:00 Tokyo, 07:00–16:00 Sydney). Liquidity providers and brokers may define them differently. Bank holidays are not accounted for.
      </p>
    </div>
  );
}
