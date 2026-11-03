import { SESSIONS, isValidZone, type SessionId } from "./forex-time";

export type ClockFormat = "12" | "24";

export interface BrandConfig {
  brand?: string | undefined;
  title?: string | undefined;
  logo?: string | undefined;
  accent?: string | undefined;
  accent2?: string | undefined;
  tz?: string | undefined;
  fmt?: ClockFormat | undefined;
  sessions?: SessionId[] | undefined;
  labels?: Partial<Record<SessionId, string | undefined>> | undefined;
  embed?: boolean | undefined;
  academy?: string | undefined;
}

export const SERVICE_PRICES = { basic: 10, advanced: 25 } as const;

export const DEMO_CONFIG: BrandConfig = {
  brand: "Apex Pip Academy (Demo)",
  title: "Apex Pip Academy — Institutional Session Clock (Demo)",
  logo: "DEMO",
  accent: "#f59e0b",
  accent2: "#38bdf8",
  tz: "America/New_York",
  fmt: "12",
  sessions: ["london", "newyork"],
  labels: { london: "London Killzone", newyork: "NY Killzone" },
  academy: "apex",
};

export const ACADEMY_PRESETS: { id: string; label: string; summary: string; config: BrandConfig }[] = [
  {
    id: "apex",
    label: "Apex Pip Academy (Demo)",
    summary: "US/UK overlap focus · 12H clock · Amber/Sky theme",
    config: DEMO_CONFIG,
  },
  {
    id: "mumbai-fx",
    label: "Mumbai Institutional FX Academy (Demo)",
    summary: "IST default timezone · All 4 sessions · Emerald/Indigo theme",
    config: {
      brand: "Mumbai FX Academy (Demo)",
      title: "Mumbai Institutional FX Academy — Live Session Desk (Demo)",
      logo: "MIFX",
      accent: "#10b981",
      accent2: "#818cf8",
      tz: "Asia/Kolkata",
      fmt: "24",
      sessions: ["sydney", "tokyo", "london", "newyork"],
      labels: {
        sydney: "Sydney Open",
        tokyo: "Asian Range (Tokyo)",
        london: "London Liquidity",
        newyork: "NY Overlap Desk",
      },
      academy: "mumbai-fx",
    },
  },
  {
    id: "meridian",
    label: "Meridian Macro Institute (Demo)",
    summary: "London GMT/BST base · Tokyo/London/NY · Royal Blue/Teal theme",
    config: {
      brand: "Meridian Macro (Demo)",
      title: "Meridian Macro Institute — Global Session Compass (Demo)",
      logo: "MMI",
      accent: "#3b82f6",
      accent2: "#14b8a6",
      tz: "Europe/London",
      fmt: "24",
      sessions: ["tokyo", "london", "newyork"],
      labels: {
        tokyo: "Tokyo Desk",
        london: "London Prime",
        newyork: "New York Desk",
      },
      academy: "meridian",
    },
  },
];

export const THEME_PRESETS: { id: string; name: string; accent: string; accent2: string }[] = [
  { id: "terminal", name: "Emerald Terminal", accent: "#34d399", accent2: "#38bdf8" },
  { id: "amber", name: "Amber Institutional", accent: "#f59e0b", accent2: "#38bdf8" },
  { id: "quant", name: "Cyan Quant", accent: "#06b6d4", accent2: "#a855f7" },
  { id: "sovereign", name: "Royal Macro", accent: "#3b82f6", accent2: "#10b981" },
  { id: "gold", name: "Bullion Desk", accent: "#eab308", accent2: "#f97316" },
];

export interface SavedTimezoneProfile {
  id: string;
  name: string;
  tz: string;
  fmt: ClockFormat;
  pinnedZones: string[];
  sessions?: SessionId[] | undefined;
  labels?: Partial<Record<SessionId, string | undefined>> | undefined;
  accent?: string | undefined;
  accent2?: string | undefined;
}

export const DEFAULT_PINNED_ZONES = ["UTC", "Asia/Kolkata", "Europe/London", "America/New_York"];

const PROFILES_STORAGE_KEY = "fsc_saved_profiles_v1";

export function loadSavedProfiles(): SavedTimezoneProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SavedTimezoneProfile =>
          Boolean(item) &&
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          isValidZone(item.tz) &&
          (item.fmt === "12" || item.fmt === "24") &&
          Array.isArray(item.pinnedZones),
      )
      .map((item) => ({
        ...item,
        pinnedZones: item.pinnedZones.filter((z): z is string => isValidZone(z)).slice(0, 6),
      }));
  } catch {
    return [];
  }
}

export function saveProfilesToStorage(profiles: SavedTimezoneProfile[]): void {
  try {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles.slice(0, 12)));
  } catch {
    // Ignore storage quota or sandbox restrictions
  }
}

export function validZone(value: unknown): value is string {
  return isValidZone(value);
}

/** Escapes special HTML characters to prevent XSS or attribute breakout in generated snippets. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;
const SAFE_MONOGRAM_RE = /^[A-Za-z0-9 +.&_-]{1,12}$/;
const SAFE_ACADEMY_SLUG_RE = /^[a-z0-9-]{2,60}$/;

export function sanitizeAcademySlug(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const cleaned = raw.trim().toLowerCase();
  if (!SAFE_ACADEMY_SLUG_RE.test(cleaned)) return undefined;
  return cleaned;
}

function sanitizeLogo(logoRaw: string | undefined): string | undefined {
  if (!logoRaw) return undefined;
  if (logoRaw.startsWith("https://")) {
    try {
      const parsed = new URL(logoRaw);
      if (parsed.protocol !== "https:") return undefined;
      if (parsed.username || parsed.password) return undefined;
      if (/[\s"'<>`]/.test(logoRaw)) return undefined;
      return logoRaw;
    } catch {
      return undefined;
    }
  }
  if (SAFE_MONOGRAM_RE.test(logoRaw) && !logoRaw.includes("//")) {
    return logoRaw;
  }
  return undefined;
}

export function parseBrandConfig(search: Record<string, unknown>): BrandConfig {
  const text = (key: string, max = 100) => {
    const raw = search[key];
    if (typeof raw !== "string") return undefined;
    const trimmed = raw.slice(0, max).trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };
  const brand = text("brand");
  const title = text("title", 160);
  const logoRaw = text("logo", 2048);
  const accentRaw = text("accent");
  const accent2Raw = text("accent2");
  const academy = sanitizeAcademySlug(search["academy"]);
  const sessionsRaw = text("sessions")
    ?.split(",")
    .filter((id): id is SessionId => SESSIONS.some((s) => s.id === id));

  const labels: Partial<Record<SessionId, string>> = {};
  for (const entry of (text("labels", 500) ?? "").split(",")) {
    const i = entry.indexOf(":");
    const id = entry.slice(0, i).trim();
    const val = entry.slice(i + 1).replaceAll(",", "·").slice(0, 60).trim();
    if (i > 0 && val && SESSIONS.some((s) => s.id === id)) {
      labels[id as SessionId] = val;
    }
  }

  const tzRaw = search["tz"];
  const fmtRaw = String(search["fmt"] ?? "");
  const embedRaw = String(search["embed"] ?? "");

  return {
    brand,
    title,
    logo: sanitizeLogo(logoRaw),
    accent: accentRaw && HEX_COLOR_RE.test(accentRaw) ? accentRaw : undefined,
    accent2: accent2Raw && HEX_COLOR_RE.test(accent2Raw) ? accent2Raw : undefined,
    tz: validZone(tzRaw) ? tzRaw : undefined,
    fmt: fmtRaw === "12" ? "12" : fmtRaw === "24" ? "24" : undefined,
    sessions: sessionsRaw?.length ? [...new Set(sessionsRaw)] : undefined,
    labels,
    embed: embedRaw === "1",
    ...(academy ? { academy } : {}),
  };
}

export function configSearch(config: BrandConfig): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of ["brand", "title", "logo", "accent", "accent2", "tz", "fmt", "academy"] as const) {
    const val = config[k];
    if (val) out[k] = String(val);
  }
  if (config.sessions?.length) out["sessions"] = config.sessions.join(",");
  const labels = Object.entries(config.labels ?? {})
    .filter(([, v]) => Boolean(v && v.trim()))
    .map(([k, v]) => `${k}:${v!.replaceAll(",", "·").trim()}`)
    .join(",");
  if (labels) out["labels"] = labels;
  if (config.embed) out["embed"] = "1";
  return out;
}

export function brandedURL(config: BrandConfig, origin = "https://forex-session-compass.lovable.app"): string {
  const params = new URLSearchParams(configSearch(config)).toString();
  return params ? `${origin}/?${params}` : `${origin}/`;
}
