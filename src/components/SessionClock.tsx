import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  SESSIONS,
  ZONES,
  formatDate,
  formatDuration,
  formatOffset,
  getMarketWeekTransition,
  getOffsetMinutes,
  getSessionStatus,
  isDstActive,
  isForexWeekendClosed,
  isUsUkDstGap,
  simulatedWeekday,
  type SessionDef,
} from "@/lib/forex-time";
import { useLocalZone, useNow } from "@/hooks/use-now";
import { ZoneSelect } from "@/components/site";
import { FormatToggle, useBrand, useClockFormat } from "@/components/BrandProvider";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PINNED_ZONES,
  brandedURL,
  loadSavedProfiles,
  saveProfilesToStorage,
  type SavedTimezoneProfile,
} from "@/lib/white-label";

export function SessionClock() {
  const live = useNow();
  const local = useLocalZone();
  const { config, fmt, setFmt, preferredTz, setPreferredTz } = useBrand();
  const formatTime = useClockFormat();

  const [view, setView] = useState<string | null>(null);
  const [simulate, setSimulate] = useState(false);
  const [pinnedZones, setPinnedZones] = useState<string[]>(DEFAULT_PINNED_ZONES);
  const [addZoneCandidate, setAddZoneCandidate] = useState<string>("Asia/Tokyo");
  const [profiles, setProfiles] = useState<SavedTimezoneProfile[]>([]);
  const [profileName, setProfileName] = useState("");
  const [shareNotice, setShareNotice] = useState("");

  useEffect(() => {
    setProfiles(loadSavedProfiles());
    try {
      const savedPinned = localStorage.getItem("fsc_pinned_zones");
      if (savedPinned) {
        const parsed = JSON.parse(savedPinned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPinnedZones(parsed.filter((z): z is string => typeof z === "string").slice(0, 6));
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const updatePinnedZones = (next: string[]) => {
    setPinnedZones(next);
    try {
      localStorage.setItem("fsc_pinned_zones", JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  };

  const viewTz = view ?? config.tz ?? preferredTz ?? local;
  if (!live) return <div className="panel h-96 animate-pulse" aria-label="Loading clocks" />;

  const now = simulate ? simulatedWeekday(live) : live;
  const sessions = SESSIONS.filter((s) => !config.sessions || config.sessions.includes(s.id));
  const name = (s: SessionDef) => config.labels?.[s.id] || s.name;
  const active = sessions.filter((s) => getSessionStatus(s, now).open);
  const weekendClosed = isForexWeekendClosed(now);
  const marketTransition = getMarketWeekTransition(now);
  const dstGap = isUsUkDstGap(now);

  const handleZoneChange = (nextTz: string) => {
    setView(nextTz);
    setPreferredTz(nextTz);
  };

  const handleSaveProfile = () => {
    const trimmed = profileName.trim();
    if (!trimmed) return;
    const nextProfile: SavedTimezoneProfile = {
      id: `${Date.now()}`,
      name: trimmed.slice(0, 40),
      tz: viewTz,
      fmt,
      pinnedZones,
    };
    const nextList = [nextProfile, ...profiles.filter((p) => p.name !== nextProfile.name)].slice(0, 8);
    setProfiles(nextList);
    saveProfilesToStorage(nextList);
    setProfileName("");
    setShareNotice(`Saved profile "${nextProfile.name}".`);
  };

  const handleApplyProfile = (p: SavedTimezoneProfile) => {
    setView(p.tz);
    setPreferredTz(p.tz);
    setFmt(p.fmt);
    if (p.pinnedZones.length > 0) updatePinnedZones(p.pinnedZones);
    setShareNotice(`Activated profile "${p.name}".`);
  };

  const handleDeleteProfile = (id: string) => {
    const nextList = profiles.filter((p) => p.id !== id);
    setProfiles(nextList);
    saveProfilesToStorage(nextList);
  };

  const handleCopyShareLink = async () => {
    const shareUrl = brandedURL(
      {
        ...config,
        tz: viewTz,
        fmt,
      },
      typeof window !== "undefined" ? window.location.origin : "https://forex-session-compass.lovable.app",
    );
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareNotice("Shareable dashboard link copied to clipboard.");
    } catch {
      setShareNotice(`Share link: ${shareUrl}`);
    }
  };

  return (
    <div className="space-y-5">
      {config.brand && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="rounded bg-primary/20 px-2 py-0.5 font-mono font-semibold text-primary">
              {config.logo === "DEMO" || config.brand.toLowerCase().includes("demo")
                ? "DEMO ACADEMY BRANDING"
                : "ACADEMY DASHBOARD"}
            </span>
            <span className="font-medium text-foreground">{config.brand}</span>
          </div>
          <span className="font-mono text-muted-foreground">Default zone: {config.tz ?? "Auto"}</span>
        </div>
      )}

      <div className="panel flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {simulate ? "Simulation time" : "Your time"} · {viewTz}
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
            {formatTime(now, viewTz, true)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(now, viewTz)} · {formatOffset(getOffsetMinutes(now, viewTz))} · UTC{" "}
            {formatTime(now, "UTC")}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 sm:w-72">
            <label htmlFor="viewtz" className="mb-1 block text-xs text-muted-foreground">
              Show session times in
            </label>
            <ZoneSelect id="viewtz" value={viewTz} onChange={handleZoneChange} extra={viewTz} />
          </div>
          <FormatToggle />
          <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyShareLink()}>
            Share View
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={simulate}
            onChange={(e) => setSimulate(e.target.checked)}
            className="accent-primary"
          />
          Simulate Active Weekday Overlap
        </label>
        {shareNotice && (
          <p role="status" className="font-mono text-xs text-info">
            {shareNotice}
          </p>
        )}
      </div>

      {simulate ? (
        <div role="status" className="rounded-md border-l-4 border-info bg-info/10 p-3.5 text-sm text-info">
          <strong>SIMULATION</strong> — Wednesday London/New York overlap. Not live market status.
        </div>
      ) : weekendClosed ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3.5 text-sm">
          <span>
            The forex market is in its weekend closure (Friday 17:00 to Sunday 17:00 New York time).
          </span>
          <span className="font-mono text-xs text-foreground">
            Reopens in {formatDuration(marketTransition.nextTransition.getTime() - now.getTime())}
          </span>
        </div>
      ) : null}

      {dstGap && (
        <div className="rounded-md border border-info/40 bg-info/10 px-3.5 py-2.5 text-xs text-muted-foreground">
          <strong className="text-info">DST Transition Window Active:</strong> The US and UK are currently between daylight-saving switch dates, shifting the London–New York overlap to 5 hours instead of 4 hours.
        </div>
      )}

      {active.length > 1 && (
        <div className="flex items-center gap-2 rounded-md border border-up/40 bg-up/10 px-3.5 py-2.5 text-sm text-up">
          <span className="live-dot h-2 w-2 rounded-full bg-up" />
          <span className="font-medium">
            {simulate ? "Simulated overlap" : "Active overlap"}: {active.map(name).join(" ∩ ")}
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sessions.map((s) => {
          const st = getSessionStatus(s, now);
          const dst = isDstActive(now, s.tz);
          const progress = st.open
            ? Math.max(
                0,
                Math.min(
                  100,
                  ((now.getTime() - st.todayOpen.getTime()) /
                    (st.todayClose.getTime() - st.todayOpen.getTime())) *
                    100,
                ),
              )
            : 0;
          return (
            <article
              key={s.id}
              className={`panel flex min-w-0 flex-col justify-between p-4 transition-colors ${
                st.open ? "border-up/70 shadow-sm" : ""
              }`}
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <h3 className="break-words font-semibold">{name(s)}</h3>
                    {dst && (
                      <span
                        title={`${s.city} is currently observing Daylight Saving Time`}
                        className="rounded border border-info/40 bg-info/10 px-1.5 py-0.5 font-mono text-[10px] text-info"
                      >
                        DST
                      </span>
                    )}
                  </div>
                  <span
                    className={`flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-xs font-semibold ${
                      st.open ? "bg-up/15 text-up" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        st.open ? "live-dot bg-up" : "bg-muted-foreground"
                      }`}
                    />
                    {st.open ? "OPEN" : "CLOSED"}
                  </span>
                </div>

                <p className="mt-3 whitespace-nowrap font-mono text-2xl font-bold tabular-nums">
                  {formatTime(now, s.tz, true)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(now, s.tz)} · {formatOffset(getOffsetMinutes(now, s.tz))}
                </p>

                <dl className="mt-4 space-y-2 border-t pt-3 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Local hours</dt>
                    <dd className="font-mono">
                      {formatTime(st.todayOpen, s.tz)}–{formatTime(st.todayClose, s.tz)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">In your zone</dt>
                    <dd className="font-mono">
                      {formatTime(st.todayOpen, viewTz)}–{formatTime(st.todayClose, viewTz)}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-1">
                    <dt className="text-muted-foreground">{st.open ? "Closes in" : "Opens in"}</dt>
                    <dd className="font-mono font-semibold text-info">
                      {formatDuration(st.nextChange.getTime() - now.getTime())}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-4">
                <div
                  className="h-1.5 overflow-hidden rounded bg-muted"
                  role="progressbar"
                  aria-label={`${name(s)} session progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress)}
                >
                  <div className="h-full bg-up transition-all" style={{ width: `${progress}%` }} />
                </div>
                {!config.embed && (
                  <div className="mt-2.5 flex justify-end">
                    <Link
                      to="/sessions/$session"
                      params={{ session: s.id }}
                      className="font-mono text-[11px] text-muted-foreground hover:text-info"
                    >
                      Session guide →
                    </Link>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <Timeline now={now} sessions={sessions} viewTz={viewTz} />

      {!config.embed && (
        <section className="panel space-y-4 p-5" aria-label="Multi-timezone clocks and saved profiles">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Multi-Timezone Desk Clocks
              </h2>
              <p className="text-xs text-muted-foreground">
                Pin up to 6 financial centers and save your preferred timezone profiles on this device.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Select timezone to pin"
                className="field w-auto py-1 text-xs"
                value={addZoneCandidate}
                onChange={(e) => setAddZoneCandidate(e.target.value)}
              >
                {ZONES.map((z) => (
                  <option key={z.tz} value={z.tz}>
                    {z.label} ({z.tz})
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pinnedZones.includes(addZoneCandidate) || pinnedZones.length >= 6}
                onClick={() => updatePinnedZones([...pinnedZones, addZoneCandidate])}
              >
                + Pin Clock
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {pinnedZones.map((z) => {
              const labelObj = ZONES.find((item) => item.tz === z);
              return (
                <div key={z} className="rounded-md border bg-panel p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {labelObj ? labelObj.label : z}
                    </span>
                    {pinnedZones.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Remove ${z} clock`}
                        onClick={() => updatePinnedZones(pinnedZones.filter((item) => item !== z))}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <p className="mt-1 font-mono text-lg font-bold tabular-nums">
                    {formatTime(now, z, true)}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {formatOffset(getOffsetMinutes(now, z))}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Saved Profiles:</span>
              {profiles.length === 0 ? (
                <span className="text-xs text-muted-foreground">None saved yet</span>
              ) : (
                profiles.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 rounded-md border bg-panel px-2.5 py-1 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => handleApplyProfile(p)}
                      className="font-medium text-foreground hover:text-info"
                    >
                      {p.name} ({p.fmt}H · {p.tz})
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete profile ${p.name}`}
                      onClick={() => handleDeleteProfile(p.id)}
                      className="ml-1 text-muted-foreground hover:text-destructive"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                aria-label="New timezone profile name"
                placeholder="Profile name (e.g. IST Desk)"
                maxLength={40}
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="field w-48 py-1 text-xs"
              />
              <Button type="button" size="sm" variant="outline" onClick={handleSaveProfile}>
                Save Profile
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Timeline({
  now,
  sessions,
  viewTz,
}: {
  now: Date;
  sessions: SessionDef[];
  viewTz: string;
}) {
  const { config } = useBrand();
  const formatTime = useClockFormat();
  const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const pct = ((now.getTime() - dayStart) / 864e5) * 100;

  return (
    <div className="panel p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Today in UTC · 24-hour session & overlap timeline
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          Current cursor: {formatTime(now, "UTC")} UTC ({formatTime(now, viewTz)} {viewTz})
        </p>
      </div>
      <div className="space-y-2.5">
        {sessions.map((s) => (
          <div key={s.id} className="grid grid-cols-[7.5rem_1fr] items-center gap-3">
            <span className="truncate text-xs font-medium text-muted-foreground">
              {config.labels?.[s.id] || s.name}
            </span>
            <div className="relative h-6 overflow-hidden rounded border border-border/60 bg-panel">
              {[-1, 0, 1].map((o, i) => {
                const day = new Date(dayStart + o * 864e5 + 12 * 36e5);
                if (day.getUTCDay() === 0 || day.getUTCDay() === 6) return null;
                const st = getSessionStatus(s, day);
                const a = Math.max(0, (st.todayOpen.getTime() - dayStart) / 864e5);
                const b = Math.min(1, (st.todayClose.getTime() - dayStart) / 864e5);
                return b > a ? (
                  <div
                    key={i}
                    className="absolute inset-y-0 bg-info/45"
                    style={{ left: `${a * 100}%`, width: `${(b - a) * 100}%` }}
                  />
                ) : null;
              })}
              <div className="absolute inset-y-0 w-0.5 bg-up" style={{ left: `${pct}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="ml-32 mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h}>{formatTime(new Date(dayStart + h * 36e5), "UTC")}</span>
        ))}
      </div>
    </div>
  );
}
