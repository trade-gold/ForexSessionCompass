// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  applySecurityHeaders,
  buildReportOnlyCsp,
  buildSecurityHeaders,
  isEmbeddableRequest,
} from "@/lib/security-headers";

const page = (path: string) => new Request(`https://forex-session-compass.lovable.app${path}`);
const html = (init?: ResponseInit) =>
  new Response("<html></html>", { headers: { "content-type": "text/html" }, ...init });

describe("security response headers", () => {
  it("only treats `/` with embed=1 as embeddable", () => {
    expect(isEmbeddableRequest(new URL("https://x.test/?embed=1&brand=A"))).toBe(true);
    expect(isEmbeddableRequest(new URL("https://x.test/"))).toBe(false);
    expect(isEmbeddableRequest(new URL("https://x.test/?embed=0"))).toBe(false);
    for (const path of ["/admin", "/login", "/register", "/profile", "/pricing", "/tools"]) {
      expect(isEmbeddableRequest(new URL(`https://x.test${path}?embed=1`))).toBe(false);
    }
  });

  it("adds baseline headers to every response", () => {
    const res = applySecurityHeaders(page("/pricing"), html());
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("permissions-policy")).toContain("camera=()");
    expect(res.headers.get("strict-transport-security")).toBe("max-age=31536000");
    expect(res.headers.get("content-security-policy-report-only")).toContain("object-src 'none'");
  });

  it("blocks framing of sensitive pages but keeps the white-label embed working", () => {
    for (const path of ["/admin", "/login", "/register", "/profile", "/pricing", "/"]) {
      const csp = applySecurityHeaders(page(path), html()).headers.get("content-security-policy");
      expect(csp).toContain("frame-ancestors 'self'");
    }
    const embed = applySecurityHeaders(page("/?embed=1&brand=Acme"), html());
    expect(embed.headers.get("content-security-policy")).toBeNull();
  });

  it("does not send HSTS over plain http and keeps host-provided headers", () => {
    const http = applySecurityHeaders(new Request("http://localhost:3000/"), html());
    expect(http.headers.get("strict-transport-security")).toBeNull();

    const custom = applySecurityHeaders(
      page("/"),
      html({ headers: { "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" } }),
    );
    expect(custom.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("preserves status, body and existing headers, and removes X-Powered-By", async () => {
    const res = applySecurityHeaders(
      page("/login"),
      new Response("hello", { status: 404, headers: { "x-powered-by": "x", "set-cookie": "a=b" } }),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("x-powered-by")).toBeNull();
    expect(res.headers.get("set-cookie")).toBe("a=b");
    expect(await res.text()).toBe("hello");
  });

  it("falls back to a rebuilt response when headers are immutable", async () => {
    const original = new Response("body", { status: 200 });
    Object.defineProperty(original, "headers", {
      value: new Proxy(new Headers(), {
        get(target, prop) {
          if (prop === "set" || prop === "append" || prop === "delete") {
            return () => {
              throw new TypeError("immutable");
            };
          }
          const v = Reflect.get(target, prop) as unknown;
          return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
        },
      }),
    });
    const res = applySecurityHeaders(page("/"), original);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await res.text()).toBe("body");
  });

  it("uses the configured Supabase origin in connect-src", () => {
    expect(buildReportOnlyCsp()).toContain("https://*.supabase.co");
    expect(buildSecurityHeaders(new URL("https://x.test/")).append.length).toBeGreaterThan(0);
  });
});
