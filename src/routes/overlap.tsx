import { FormatToggle, useBrand, useClockFormat } from "@/components/BrandProvider";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { meta, PageHeader, ZoneSelect } from "@/components/site";
import { useLocalZone } from "@/hooks/use-now";
import {
  SESSIONS,
  formatDate,
  getSession,
  isUsUkDstGap,
  isValidCalendarDate,
  overlapsOnUtcDate,
  type SessionId,
} from "@/lib/forex-time";

export const Route = createFileRoute("/overlap")({
  head: () =>
    meta(
      "Forex Session Overlap Calculator – London/New York & More",
      "Calculate when forex sessions overlap on any date, including the London–New York overlap, shown in your chosen time zone.",
      "/overlap",
    ),
  component: Overlap,
});

const pad = (n: number) => String(n).padStart(2, "0");
const dur = (m: number) => `${Math.floor(m / 60)}h ${pad(m % 60)}m`;

function Overlap() {
  const formatTime = useClockFormat();
  const { config, preferredTz } = useBrand();
  const local = useLocalZone();
  const [tz, setTz] = useState<string | null>(null);
  const viewTz = tz ?? config.tz ?? preferredTz ?? local;
  const [date, setDate] = useState("");
  const [a, setA] = useState<SessionId>("tokyo");
  const [b, setB] = useState<SessionId>("london");

  useEffect(() => {
    const n = new Date();
    setDate(`${n.getUTCFullYear()}-${pad(n.getUTCMonth() + 1)}-${pad(n.getUTCDate())}`);
  }, []);

  const rawMatch = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const [y = 0, m = 0, d = 0] = rawMatch ? date.split("-").map(Number) : [];
  const valid = rawMatch && isValidCalendarDate(y, m, d);
  const selectedMidUtc = valid ? new Date(Date.UTC(y, m - 1, d, 12, 0)) : null;
  const dstGap = selectedMidUtc && !isNaN(selectedMidUtc.getTime()) ? isUsUkDstGap(selectedMidUtc) : false;
  const ln = valid ? overlapsOnUtcDate(getSession("london"), getSession("newyork"), y, m, d) : [];
  const custom = valid && a !== b ? overlapsOnUtcDate(getSession(a), getSession(b), y, m, d) : [];
  const allPairs = valid
    ? SESSIONS.flatMap((s1, i) =>
        SESSIONS.slice(i + 1).map((s2) => ({ s1, s2, o: overlapsOnUtcDate(s1, s2, y, m, d) })),
      )
    : [];

  const Row = ({ o }: { o: { start: Date; end: Date; minutes: number } }) => (
    <p className="font-mono text-lg">
      {formatTime(o.start, viewTz)} – {formatTime(o.end, viewTz)}{" "}
      <span className="text-sm text-muted-foreground">
        ({dur(o.minutes)}, {formatDate(o.start, viewTz)})
      </span>
    </p>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader eyebrow="Tool" title="Forex Session Overlap Calculator">
        Overlaps are periods when two major centres are open at once. Results are calculated for the selected UTC date and shown in your chosen zone.
      </PageHeader>
      <div className="panel grid gap-4 p-5 md:grid-cols-2">
        <div>
          <label htmlFor="od" className="mb-1 block text-xs text-muted-foreground">
            Date (UTC)
          </label>
          <input
            id="od"
            type="date"
            className="field"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="oz" className="mb-1 block text-xs text-muted-foreground">
            Display in
          </label>
          <ZoneSelect id="oz" value={viewTz} onChange={setTz} extra={viewTz} />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <FormatToggle />
      </div>
      {!valid && (
        <p role="status" className="mt-4 text-muted-foreground">
          Choose a valid date to calculate session overlaps.
        </p>
      )}
      {valid && (
        <>
          {dstGap && (
            <div className="mt-4 rounded-md border border-info/40 bg-info/10 p-3.5 text-xs text-muted-foreground">
              <strong className="text-info">US/UK DST Transition Gap on {date}:</strong> Because the US and UK switch daylight saving on different Sundays, the London–New York overlap spans 5 hours (300 minutes) on this date instead of the standard 4 hours.
            </div>
          )}

          <section className="panel mt-4 border-up/50 p-5">
            <h2 className="mb-2 font-semibold">London ∩ New York</h2>
            {ln.length ? (
              ln.map((o, i) => <Row key={i} o={o} />)
            ) : (
              <p className="text-muted-foreground">No overlap on this date (weekend).</p>
            )}
          </section>

          <section className="panel mt-4 p-5">
            <h2 className="mb-3 font-semibold">Compare two sessions</h2>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {[
                { v: a, set: setA, id: "sa" },
                { v: b, set: setB, id: "sb" },
              ].map((x) => (
                <select
                  key={x.id}
                  aria-label="Session"
                  className="field"
                  value={x.v}
                  onChange={(e) => x.set(e.target.value as SessionId)}
                >
                  {SESSIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ))}
            </div>
            {a === b ? (
              <p className="text-muted-foreground">Choose two different sessions.</p>
            ) : custom.length ? (
              custom.map((o, i) => <Row key={i} o={o} />)
            ) : (
              <p className="text-muted-foreground">These sessions do not overlap on this date.</p>
            )}
          </section>

          <section className="panel mt-4 p-5">
            <h2 className="mb-3 font-semibold">24-Hour Overlap Visualization (UTC Day {date})</h2>
            <div className="space-y-2.5">
              {allPairs
                .filter((p) => p.o.length > 0)
                .map(({ s1, s2, o }) => {
                  const dayStart = Date.UTC(y, m - 1, d);
                  return (
                    <div
                      key={s1.id + s2.id}
                      className="grid grid-cols-[9.5rem_1fr] items-center gap-3"
                    >
                      <span className="truncate text-xs font-medium text-muted-foreground">
                        {s1.name} ∩ {s2.name}
                      </span>
                      <div className="relative h-6 overflow-hidden rounded border border-border/60 bg-panel">
                        {o.map((iv, idx) => {
                          const left = Math.max(0, (iv.start.getTime() - dayStart) / 864e5);
                          const right = Math.min(1, (iv.end.getTime() - dayStart) / 864e5);
                          return right > left ? (
                            <div
                              key={idx}
                              className="absolute inset-y-0 bg-up/55"
                              style={{ left: `${left * 100}%`, width: `${(right - left) * 100}%` }}
                              title={`${formatTime(iv.start, viewTz)}–${formatTime(iv.end, viewTz)} (${dur(iv.minutes)})`}
                            />
                          ) : null;
                        })}
                      </div>
                    </div>
                  );
                })}
              {allPairs.every((p) => p.o.length === 0) && (
                <p className="text-xs text-muted-foreground">
                  No session overlaps occur on this UTC weekend date.
                </p>
              )}
            </div>
          </section>

          <section className="panel mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-3">Pair</th>
                  <th className="p-3">Overlap ({viewTz})</th>
                  <th className="p-3">Length</th>
                </tr>
              </thead>
              <tbody>
                {allPairs.map(({ s1, s2, o }) => (
                  <tr key={s1.id + s2.id} className="border-b last:border-0">
                    <td className="p-3">{s1.name} ∩ {s2.name}</td>
                    <td className="p-3 font-mono">
                      {o.length
                        ? o.map((x) => `${formatTime(x.start, viewTz)}–${formatTime(x.end, viewTz)}`).join(", ")
                        : "—"}
                    </td>
                    <td className="p-3 font-mono text-muted-foreground">
                      {o.length ? dur(o.reduce((s, x) => s + x.minutes, 0)) : "None"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
