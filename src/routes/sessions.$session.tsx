import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { meta, PageHeader } from "@/components/site";
import { useClockFormat } from "@/components/BrandProvider";
import {
  SESSIONS,
  formatDuration,
  formatOffset,
  getOffsetMinutes,
  getSessionStatus,
  isDstActive,
} from "@/lib/forex-time";
import { SESSION_CONTENT } from "@/lib/session-content";
import { useNow } from "@/hooks/use-now";

export const Route = createFileRoute("/sessions/$session")({
  loader: ({ params }) => {
    const s = SESSIONS.find((x) => x.id === params.session);
    if (!s) throw notFound();
    return { id: s.id };
  },
  head: ({ loaderData, params }) => {
    const sessionId = loaderData?.id ?? params?.session;
    const s = SESSIONS.find((x) => x.id === sessionId);
    if (!s) return { meta: [{ title: "Session not found" }, { name: "robots", content: "noindex" }] };
    return meta(
      `${s.name} Forex Session – Hours & Characteristics | Forex Time Tools`,
      `${s.name} forex session hours, typical characteristics, commonly traded pairs and daylight saving notes.`,
      `/sessions/${s.id}`,
    );
  },
  component: SessionPage,
});

function SessionPage() {
  const { id } = Route.useLoaderData();
  const s = SESSIONS.find((x) => x.id === id)!;
  const c = SESSION_CONTENT[s.id];
  const now = useNow();
  const formatTime = useClockFormat();
  const st = now ? getSessionStatus(s, now) : null;
  const dst = now ? isDstActive(now, s.tz) : false;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/sessions" search={(prev) => prev} className="text-sm text-info hover:underline">
        ← All sessions
      </Link>
      <PageHeader eyebrow="Session guide" title={`The ${s.name} Session`}>
        {c.summary}
      </PageHeader>
      <div className="panel mb-6 grid gap-4 p-5 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Local time now</p>
          <p className="mt-1 font-mono text-xl font-bold">
            {now ? formatTime(now, s.tz, true) : "--:--:--"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <p className={`mt-1 font-mono text-xl font-bold ${st?.open ? "text-up" : "text-muted-foreground"}`}>
            {st ? (st.open ? "OPEN" : "CLOSED") : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Today in UTC</p>
          <p className="mt-1 font-mono text-xl">
            {st ? `${formatTime(st.todayOpen, "UTC")}–${formatTime(st.todayClose, "UTC")}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{st?.open ? "Closes in" : "Opens in"}</p>
          <p className="mt-1 font-mono text-xl text-info">
            {st && now ? formatDuration(st.nextChange.getTime() - now.getTime()) : "—"}
          </p>
        </div>
      </div>
      <div className="prose-dark">
        <h2>Common trading hours</h2>
        <p>
          A widely used convention places the {s.name} session from{" "}
          {String(s.openHour).padStart(2, "0")}:00 to {s.closeHour}:00 local time ({s.tz}, currently{" "}
          {now ? `${formatOffset(getOffsetMinutes(now, s.tz))}${dst ? " · DST Active" : ""}` : "…"}).
          Different brokers and data providers may use slightly different windows.
        </p>
        <h2>Typical characteristics</h2>
        <ul>
          {c.traits.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <h2>Pairs often associated with this session</h2>
        <p>
          {c.pairs.join(", ")}. Any pair can be traded in any session; this list reflects where local currencies are involved.
        </p>
        <h2>Daylight saving</h2>
        <p>{c.notes}</p>
        <p>
          These are general observations, not predictions. Market conditions vary and past patterns do not guarantee future behaviour. See our{" "}
          <Link to="/disclaimer" search={(prev) => prev}>
            disclaimer
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
