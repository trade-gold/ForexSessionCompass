import { createFileRoute, Link } from "@tanstack/react-router";
import { meta, PageHeader } from "@/components/site";
import { SESSIONS } from "@/lib/forex-time";
import { SESSION_CONTENT } from "@/lib/session-content";

export const Route = createFileRoute("/sessions/")({
  head: () =>
    meta(
      "Forex Trading Sessions Explained | Forex Time Tools",
      "Guides to the Sydney, Tokyo, London and New York forex sessions: common hours, typical characteristics and daylight saving notes.",
      "/sessions",
    ),
  component: Sessions,
});

function Sessions() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader eyebrow="Learn" title="Forex Trading Sessions">
        The forex market trades around the clock on weekdays as financial centres open and close in turn. These guides describe each major session.
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        {SESSIONS.map((s) => (
          <Link
            key={s.id}
            to="/sessions/$session"
            params={{ session: s.id }}
            search={(prev) => prev}
            className="panel block p-5 transition-colors hover:border-info"
          >
            <h2 className="font-semibold">
              {s.name} session <span className="text-info">→</span>
            </h2>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {String(s.openHour).padStart(2, "0")}:00–{s.closeHour}:00 {s.tz}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{SESSION_CONTENT[s.id].summary}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
