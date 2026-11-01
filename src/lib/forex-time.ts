// Pure time utilities built on Intl + IANA zones. DST handled by the browser's tz database.
//
// Documented Session Conventions & Assumptions:
// - Sydney:   07:00–16:00 Australia/Sydney (AEST UTC+10 / AEDT UTC+11)
// - Tokyo:    09:00–18:00 Asia/Tokyo (JST UTC+9, no DST)
// - London:   08:00–17:00 Europe/London (GMT UTC+0 / BST UTC+1)
// - New York: 08:00–17:00 America/New_York (EST UTC-5 / EDT UTC-4)
// - Weekend closure: Friday 17:00 America/New_York through Sunday 17:00 America/New_York.
// All calculations use official IANA timezone identifiers rather than fixed UTC schedules.

export type SessionId = "sydney" | "tokyo" | "london" | "newyork";

export interface SessionDef {
  id: SessionId;
  name: string;
  city: string;
  tz: string;
  openHour: number; // local hour in session's own zone
  closeHour: number;
}

export const SESSIONS: SessionDef[] = [
  { id: "sydney", name: "Sydney", city: "Sydney", tz: "Australia/Sydney", openHour: 7, closeHour: 16 },
  { id: "tokyo", name: "Tokyo", city: "Tokyo", tz: "Asia/Tokyo", openHour: 9, closeHour: 18 },
  { id: "london", name: "London", city: "London", tz: "Europe/London", openHour: 8, closeHour: 17 },
  { id: "newyork", name: "New York", city: "New York", tz: "America/New_York", openHour: 8, closeHour: 17 },
];

export const ZONES: { label: string; tz: string }[] = [
  { label: "UTC", tz: "UTC" },
  { label: "IST (India)", tz: "Asia/Kolkata" },
  { label: "London", tz: "Europe/London" },
  { label: "New York", tz: "America/New_York" },
  { label: "Tokyo", tz: "Asia/Tokyo" },
  { label: "Sydney", tz: "Australia/Sydney" },
  { label: "Frankfurt", tz: "Europe/Berlin" },
  { label: "Dubai", tz: "Asia/Dubai" },
  { label: "Singapore", tz: "Asia/Singapore" },
  { label: "Hong Kong", tz: "Asia/Hong_Kong" },
  { label: "Chicago", tz: "America/Chicago" },
  { label: "Los Angeles", tz: "America/Los_Angeles" },
];

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function partsFmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function isValidZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Validates that a (year, month, day) triple is a real calendar date without rollover (e.g. rejects Feb 30). */
export function isValidCalendarDate(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1970 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function getZonedParts(date: Date, tz: string): ZonedParts {
  const safeTz = isValidZone(tz) ? tz : "UTC";
  const p: Record<string, string> = {};
  for (const x of partsFmt(safeTz).formatToParts(date)) p[x.type] = x.value;
  const num = (k: string) => Number(p[k] ?? "0");
  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
    hour: num("hour") % 24,
    minute: num("minute"),
    second: num("second"),
    weekday: WD[p["weekday"] ?? ""] ?? 0,
  };
}

/** Offset of tz from UTC in minutes at the given instant (e.g. IST = +330). */
export function getOffsetMinutes(date: Date, tz: string): number {
  const z = getZonedParts(date, tz);
  const asUtc = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Convert a wall-clock time in tz to a real instant, handling DST transitions accurately. */
export function zonedTimeToUtc(y: number, mo: number, d: number, h: number, mi: number, tz: string): Date {
  const safeTz = isValidZone(tz) ? tz : "UTC";
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let off = getOffsetMinutes(new Date(guess), safeTz);
  let t = guess - off * 60000;
  const off2 = getOffsetMinutes(new Date(t), safeTz);
  if (off2 !== off) {
    off = off2;
    t = guess - off * 60000;
  }
  return new Date(t);
}

export function formatOffset(min: number): string {
  const s = min >= 0 ? "+" : "-";
  const a = Math.abs(min);
  return `UTC${s}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}

export function formatTime(date: Date, tz: string, seconds = false, format: "12" | "24" = "24"): string {
  const safeTz = isValidZone(tz) ? tz : "UTC";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: safeTz,
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
    hourCycle: format === "12" ? "h12" : "h23",
  }).format(date);
}

export function formatDate(date: Date, tz: string): string {
  const safeTz = isValidZone(tz) ? tz : "UTC";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: safeTz,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function getSession(id: SessionId): SessionDef {
  const session = SESSIONS.find((s) => s.id === id);
  if (!session) throw new Error("Unknown session");
  return session;
}

function addDays(y: number, m: number, d: number, n: number) {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() };
}

/** Session interval for a given local calendar date in the session's own zone (supports midnight crossover). */
export function sessionInterval(s: SessionDef, y: number, m: number, d: number) {
  const start = zonedTimeToUtc(y, m, d, s.openHour, 0, s.tz);
  if (s.closeHour <= s.openHour) {
    const nextDay = addDays(y, m, d, 1);
    return { start, end: zonedTimeToUtc(nextDay.y, nextDay.m, nextDay.d, s.closeHour, 0, s.tz) };
  }
  return { start, end: zonedTimeToUtc(y, m, d, s.closeHour, 0, s.tz) };
}

/** Trading-day intervals (Mon–Fri local) of a session around an instant, sorted. */
export function sessionIntervalsAround(s: SessionDef, at: Date, rangeDays = 3) {
  const z = getZonedParts(at, s.tz);
  const out: { start: Date; end: Date }[] = [];
  for (let i = -rangeDays; i <= rangeDays; i++) {
    const day = addDays(z.year, z.month, z.day, i);
    if (day.wd === 0 || day.wd === 6) continue;
    out.push(sessionInterval(s, day.y, day.m, day.d));
  }
  return out;
}

export interface SessionStatus {
  open: boolean;
  nextChange: Date;
  todayOpen: Date;
  todayClose: Date;
}

export function getSessionStatus(s: SessionDef, now: Date): SessionStatus {
  const z = getZonedParts(now, s.tz);
  const today = sessionInterval(s, z.year, z.month, z.day);
  const ivs = sessionIntervalsAround(s, now, 4);
  const cur = ivs.find((iv) => now >= iv.start && now < iv.end);
  if (cur) return { open: true, nextChange: cur.end, todayOpen: cur.start, todayClose: cur.end };
  const next = ivs.find((iv) => iv.start > now);
  if (!next) throw new Error("No upcoming session");
  return { open: false, nextChange: next.start, todayOpen: today.start, todayClose: today.end };
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return "0h 00m 00s";
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

/** Overlaps between two distinct sessions whose start falls on the given UTC date. */
export function overlapsOnUtcDate(a: SessionDef, b: SessionDef, y: number, m: number, d: number) {
  if (a.id === b.id || !isValidCalendarDate(y, m, d)) return [];
  const dayStart = Date.UTC(y, m - 1, d);
  const mid = new Date(dayStart + 12 * 3600000);
  const A = sessionIntervalsAround(a, mid, 2);
  const B = sessionIntervalsAround(b, mid, 2);
  const res: { start: Date; end: Date; minutes: number }[] = [];
  const seen = new Set<string>();
  for (const x of A) {
    for (const y2 of B) {
      const s = Math.max(x.start.getTime(), y2.start.getTime());
      const e = Math.min(x.end.getTime(), y2.end.getTime());
      const key = `${s}:${e}`;
      if (e > s && s >= dayStart && s < dayStart + 86400000 && !seen.has(key)) {
        seen.add(key);
        res.push({ start: new Date(s), end: new Date(e), minutes: (e - s) / 60000 });
      }
    }
  }
  return res.sort((p, q) => p.start.getTime() - q.start.getTime());
}

export function isForexWeekendClosed(now: Date): boolean {
  // Market week: Sun 17:00 New York → Fri 17:00 New York.
  const z = getZonedParts(now, "America/New_York");
  if (z.weekday === 6) return true;
  if (z.weekday === 5 && z.hour >= 17) return true;
  if (z.weekday === 0 && z.hour < 17) return true;
  return false;
}

/** Returns whether a timezone is currently observing Daylight Saving Time at the given instant. */
export function isDstActive(date: Date, tz: string): boolean {
  const year = date.getUTCFullYear();
  const janOffset = getOffsetMinutes(new Date(Date.UTC(year, 0, 15, 12, 0)), tz);
  const julOffset = getOffsetMinutes(new Date(Date.UTC(year, 6, 15, 12, 0)), tz);
  if (janOffset === julOffset) return false;
  const standardOffset = Math.min(janOffset, julOffset);
  return getOffsetMinutes(date, tz) > standardOffset;
}

/** Detects whether the US and UK are in their transitional DST mismatch window (when London/NY overlap is 5h instead of 4h). */
export function isUsUkDstGap(date: Date): boolean {
  const londonDst = isDstActive(date, "Europe/London");
  const nyDst = isDstActive(date, "America/New_York");
  return londonDst !== nyDst;
}

/** Computes when the overall forex market week next opens (Sunday 17:00 NY) or closes (Friday 17:00 NY). */
export function getMarketWeekTransition(now: Date): { closed: boolean; nextTransition: Date } {
  const closed = isForexWeekendClosed(now);
  const z = getZonedParts(now, "America/New_York");
  if (closed) {
    // Next open is Sunday 17:00 America/New_York
    const daysToSun = z.weekday === 0 ? 0 : 7 - z.weekday;
    const sun = addDays(z.year, z.month, z.day, daysToSun);
    return {
      closed: true,
      nextTransition: zonedTimeToUtc(sun.y, sun.m, sun.d, 17, 0, "America/New_York"),
    };
  }
  // Next close is Friday 17:00 America/New_York
  const daysToFri = 5 - z.weekday;
  const fri = addDays(z.year, z.month, z.day, daysToFri);
  return {
    closed: false,
    nextTransition: zonedTimeToUtc(fri.y, fri.m, fri.d, 17, 0, "America/New_York"),
  };
}

/** A Wednesday inside the London/New York overlap, retaining the current date’s DST rules. */
export function simulatedWeekday(now: Date): Date {
  const day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + (3 - now.getUTCDay())),
  );
  const overlaps = overlapsOnUtcDate(
    getSession("london"),
    getSession("newyork"),
    day.getUTCFullYear(),
    day.getUTCMonth() + 1,
    day.getUTCDate(),
  );
  const overlap = overlaps[0];
  if (!overlap) throw new Error("No weekday overlap");
  return new Date((overlap.start.getTime() + overlap.end.getTime()) / 2);
}
