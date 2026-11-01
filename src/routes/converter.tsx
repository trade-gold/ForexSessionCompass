import { FormatToggle, useBrand, useClockFormat } from "@/components/BrandProvider";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { meta, PageHeader, ZoneSelect } from "@/components/site";
import {
  SESSIONS,
  ZONES,
  formatDate,
  formatOffset,
  getOffsetMinutes,
  getSessionStatus,
  getZonedParts,
  isDstActive,
  isValidCalendarDate,
  zonedTimeToUtc,
} from "@/lib/forex-time";

export const Route = createFileRoute("/converter")({
  head: () =>
    meta(
      "Forex Time Zone Converter – IST, UTC, London, New York, Tokyo, Sydney",
      "Convert a date and time between forex trading time zones including IST, UTC, London, New York, Tokyo and Sydney, with daylight saving applied.",
      "/converter",
    ),
  component: Converter,
});

const pad = (n: number) => String(n).padStart(2, "0");

function Converter() {
  const formatTime = useClockFormat();
  const { config, preferredTz } = useBrand();
  const [from, setFrom] = useState(config.tz ?? preferredTz ?? "Asia/Kolkata");
  const [to, setTo] = useState("America/New_York");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    const defaultFrom = config.tz ?? preferredTz ?? "Asia/Kolkata";
    setFrom(defaultFrom);
    const z = getZonedParts(new Date(), defaultFrom);
    setDate(`${z.year}-${pad(z.month)}-${pad(z.day)}`);
    setTime(`${pad(z.hour)}:${pad(z.minute)}`);
  }, [config.tz, preferredTz]);

  let instant: Date | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time)) {
    const [y = 0, m = 0, d = 0] = date.split("-").map(Number);
    const [h = 0, mi = 0] = time.split(":").map(Number);
    if (isValidCalendarDate(y, m, d) && h >= 0 && h <= 23 && mi >= 0 && mi <= 59) {
      const candidate = zonedTimeToUtc(y, m, d, h, mi, from);
      if (!isNaN(candidate.getTime())) instant = candidate;
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader eyebrow="Tool" title="Forex Time Zone Converter">
        Pick a date and time in one zone to see the exact equivalent elsewhere. Daylight saving rules for the chosen date are applied automatically.
      </PageHeader>
      <div className="panel grid gap-4 p-5 md:grid-cols-2">
        <div>
          <label htmlFor="d" className="mb-1 block text-xs text-muted-foreground">
            Date
          </label>
          <input
            id="d"
            type="date"
            className="field"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="t" className="mb-1 block text-xs text-muted-foreground">
            Time
          </label>
          <input
            id="t"
            type="time"
            className="field"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="f" className="mb-1 block text-xs text-muted-foreground">
            From zone
          </label>
          <ZoneSelect id="f" value={from} onChange={setFrom} extra={from} />
        </div>
        <div>
          <label htmlFor="to" className="mb-1 block text-xs text-muted-foreground">
            To zone
          </label>
          <ZoneSelect id="to" value={to} onChange={setTo} extra={to} />
        </div>
        <button
          type="button"
          className="rounded-md border px-4 py-2 text-sm hover:bg-accent md:col-span-2"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
        >
          ⇄ Swap zones
        </button>
      </div>

      <div className="mt-4 flex justify-end">
        <FormatToggle />
      </div>
      {!instant && (
        <p role="status" className="mt-4 text-muted-foreground">
          Enter a valid date and time to see the conversion.
        </p>
      )}
      {instant && (
        <>
          <div className="panel mt-4 border-up/50 p-5" aria-live="polite">
            <p className="text-xs text-muted-foreground">Result in {to}</p>
            <p className="font-mono text-4xl font-bold text-up">{formatTime(instant, to)}</p>
            <p className="text-sm text-muted-foreground">
              {formatDate(instant, to)} · {formatOffset(getOffsetMinutes(instant, to))}
              {isDstActive(instant, to) ? " · DST Active" : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
              {SESSIONS.map((s) => {
                const st = getSessionStatus(s, instant);
                return (
                  <span
                    key={s.id}
                    className={`rounded px-2.5 py-1 font-mono text-xs ${
                      st.open ? "bg-up/15 text-up" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.name}: {st.open ? "OPEN" : "CLOSED"}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="panel mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-3">Zone</th>
                  <th className="p-3">Time</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Offset</th>
                </tr>
              </thead>
              <tbody>
                {ZONES.map((z) => (
                  <tr key={z.tz} className="border-b last:border-0">
                    <td className="p-3 font-medium">{z.label}</td>
                    <td className="p-3 font-mono">{formatTime(instant, z.tz)}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(instant, z.tz)}</td>
                    <td className="p-3 font-mono text-muted-foreground">
                      {formatOffset(getOffsetMinutes(instant, z.tz))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
