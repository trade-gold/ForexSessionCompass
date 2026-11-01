import { FormatToggle, useBrand, useClockFormat } from "@/components/BrandProvider";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { meta, PageHeader, ZoneSelect } from "@/components/site";
import { useLocalZone, useNow } from "@/hooks/use-now";
import { formatDate, formatOffset, getOffsetMinutes, isValidZone } from "@/lib/forex-time";

export const Route = createFileRoute("/utc-to-local")({
  head: () =>
    meta(
      "UTC to Local Time Converter – Live Clock | Forex Time Tools",
      "Live UTC clock alongside your preferred local time zone, plus a converter for any UTC date and time.",
      "/utc-to-local",
    ),
  component: UtcLocal,
});

const pad = (n: number) => String(n).padStart(2, "0");

function UtcLocal() {
  const formatTime = useClockFormat();
  const { config } = useBrand();
  const now = useNow();
  const local = useLocalZone();
  const [tz, setTz] = useState<string | null>(null);
  const viewTz = tz ?? config.tz ?? local;
  const [utc, setUtc] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ftt-zone");
      if (saved && !config.tz && isValidZone(saved)) {
        setTz(saved);
      }
    } catch {
      // Ignore storage access errors
    }
    const n = new Date();
    setUtc(
      `${n.getUTCFullYear()}-${pad(n.getUTCMonth() + 1)}-${pad(n.getUTCDate())}T${pad(n.getUTCHours())}:${pad(n.getUTCMinutes())}`,
    );
  }, [config.tz]);

  const choose = (v: string) => {
    setTz(v);
    try {
      localStorage.setItem("ftt-zone", v);
    } catch {
      // Ignore storage access errors
    }
  };

  const parsed = utc ? new Date(utc + ":00Z") : null;
  const valid = Boolean(parsed && !isNaN(parsed.getTime()));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader eyebrow="Tool" title="UTC to Local Time Converter">
        Many economic calendars and broker platforms list times in UTC. Choose your zone to see the live equivalent; your choice is saved on this device.
      </PageHeader>
      <div className="mb-4 md:w-96">
        <label htmlFor="lz" className="mb-1 block text-xs text-muted-foreground">
          Your preferred time zone
        </label>
        <ZoneSelect id="lz" value={viewTz} onChange={choose} extra={viewTz} />
      </div>
      <div className="mb-4 flex justify-end">
        <FormatToggle />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { label: "UTC", z: "UTC" },
          { label: viewTz, z: viewTz },
        ].map((c, i) => (
          <div key={i} className="panel p-5">
            <p className="font-mono text-xs uppercase text-muted-foreground">{c.label}</p>
            <p className="font-mono text-4xl font-bold tabular-nums text-up">
              {now ? formatTime(now, c.z, true) : "--:--:--"}
            </p>
            <p className="text-sm text-muted-foreground">
              {now ? `${formatDate(now, c.z)} · ${formatOffset(getOffsetMinutes(now, c.z))}` : "\u00a0"}
            </p>
          </div>
        ))}
      </div>
      <section className="panel mt-6 p-5">
        <h2 className="mb-3 font-semibold">Convert a specific UTC time</h2>
        <input
          aria-label="UTC date and time"
          type="datetime-local"
          className="field md:w-80"
          value={utc}
          onChange={(e) => setUtc(e.target.value)}
        />
        {!valid && (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            Enter a UTC date and time to see the equivalent in {viewTz}.
          </p>
        )}
        {valid && parsed && (
          <p className="mt-4 font-mono text-2xl">
            {formatTime(parsed, viewTz)}{" "}
            <span className="text-base text-muted-foreground">
              {formatDate(parsed, viewTz)} · {formatOffset(getOffsetMinutes(parsed, viewTz))}
            </span>
          </p>
        )}
      </section>
    </div>
  );
}
