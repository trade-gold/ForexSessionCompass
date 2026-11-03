/**
 * Security response headers for every document / server response.
 *
 * Design constraints (see security-audit/SECURITY_AUDIT.md):
 *  - The white-label widget is meant to be embedded on other sites via
 *    `/?embed=1&...`, so ONLY that exact URL shape may be framed by anyone.
 *    Every other page (login, register, admin, pricing, profile, ...) is
 *    protected against clickjacking with CSP `frame-ancestors`.
 *  - The Lovable editor preview frames the app, so its origins stay allowed.
 *  - A full Content-Security-Policy is shipped as REPORT-ONLY first. TanStack
 *    Start injects inline hydration scripts, so an enforced policy would need
 *    nonces; report-only lets the owner see violations in DevTools without
 *    any risk of breaking the live site.
 *  - Nothing here touches cookies, auth, or the response body.
 */

/** Editor origins that may frame the app (mirrors previewAuthStorage.ts). */
const EDITOR_FRAME_ANCESTORS = [
  "https://lovable.dev",
  "https://*.lovable.dev",
  "https://gptengineer.app",
  "https://*.gptengineer.app",
] as const;

/** Origin used by white-label.tsx / brandedURL() for embed previews. */
const EMBED_HOST_ORIGIN = "https://forex-session-compass.lovable.app";

type HeaderPlan = {
  /** Set only when the response does not already carry the header. */
  setIfAbsent: Array<[string, string]>;
  /** Appended, so any header the host already sends is kept (CSP intersects). */
  append: Array<[string, string]>;
};

/** True only for the documented embed URL: `/` with `embed=1`. */
export function isEmbeddableRequest(url: URL): boolean {
  return url.pathname === "/" && url.searchParams.get("embed") === "1";
}

function readEnv(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const value = env?.[name];
  return value && value.length > 0 ? value : undefined;
}

function supabaseConnectSources(): string[] {
  const sources = ["https://*.supabase.co", "wss://*.supabase.co"];
  const raw = readEnv("SUPABASE_URL") ?? readEnv("VITE_SUPABASE_URL");
  if (raw) {
    try {
      const parsed = new URL(raw);
      sources.push(parsed.origin);
      if (parsed.protocol === "https:") sources.push(`wss://${parsed.host}`);
    } catch {
      // Ignore malformed env values; the wildcard sources above still apply.
    }
  }
  return [...new Set(sources)];
}

export function buildReportOnlyCsp(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    // TanStack Start emits inline hydration scripts; nonces are needed before this can be enforced.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // White-label logos may be any https image (validated in white-label.ts).
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${supabaseConnectSources().join(" ")}`,
    `frame-src 'self' ${EMBED_HOST_ORIGIN}`,
    "manifest-src 'self'",
    "worker-src 'self' blob:",
  ].join("; ");
}

export function buildSecurityHeaders(url: URL): HeaderPlan {
  const plan: HeaderPlan = {
    setIfAbsent: [
      ["X-Content-Type-Options", "nosniff"],
      ["Referrer-Policy", "strict-origin-when-cross-origin"],
      [
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=(), browsing-topics=()",
      ],
    ],
    append: [["Content-Security-Policy-Report-Only", buildReportOnlyCsp()]],
  };

  if (url.protocol === "https:") {
    // No includeSubDomains / preload on purpose: those are hard to undo.
    plan.setIfAbsent.push(["Strict-Transport-Security", "max-age=31536000"]);
  }

  if (!isEmbeddableRequest(url)) {
    plan.append.push([
      "Content-Security-Policy",
      `frame-ancestors 'self' ${EDITOR_FRAME_ANCESTORS.join(" ")}`,
    ]);
  }

  return plan;
}

function writePlan(headers: Headers, plan: HeaderPlan): void {
  for (const [name, value] of plan.setIfAbsent) {
    if (!headers.has(name)) headers.set(name, value);
  }
  for (const [name, value] of plan.append) {
    if (!(headers.get(name) ?? "").includes(value)) headers.append(name, value);
  }
  headers.delete("X-Powered-By");
}

/**
 * Returns the response with security headers applied. Never throws: on any
 * unexpected condition the original response is returned untouched.
 */
export function applySecurityHeaders(request: Request, response: Response): Response {
  try {
    if (response.status === 101 || (response as { webSocket?: unknown }).webSocket) {
      return response;
    }
    const plan = buildSecurityHeaders(new URL(request.url));
    try {
      writePlan(response.headers, plan);
      return response;
    } catch {
      // Some runtimes hand back immutable headers; rebuild without touching the body stream.
      const headers = new Headers(response.headers);
      writePlan(headers, plan);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
  } catch {
    return response;
  }
}
