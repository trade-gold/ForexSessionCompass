import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SITE_ORIGIN } from "@/components/site";
import { Route as RootRoute } from "@/routes/__root";
import { Route as HomeRoute } from "@/routes/index";
import { Route as ConverterRoute } from "@/routes/converter";
import { Route as OverlapRoute } from "@/routes/overlap";
import { Route as UtcToLocalRoute } from "@/routes/utc-to-local";
import { Route as SessionsIndexRoute } from "@/routes/sessions.index";
import { Route as SessionsDetailRoute } from "@/routes/sessions.$session";
import { Route as WhiteLabelRoute } from "@/routes/white-label";
import { Route as AboutRoute } from "@/routes/about";
import { Route as ContactRoute } from "@/routes/contact";
import { Route as PrivacyRoute } from "@/routes/privacy";
import { Route as DisclaimerRoute } from "@/routes/disclaimer";

describe("Site verification, SEO canonicals across all 14 public pages & secret safety", () => {
  it("retains the exact Google AdSense account in the global head", async () => {
    const head = RootRoute.options.head;
    if (!head) throw new Error("Global head is missing");
    const metadata = await head({} as Parameters<typeof head>[0]);
    expect(metadata?.meta).toContainEqual({
      name: "google-adsense-account",
      content: "ca-pub-4676429472951443",
    });
  });

  it("preserves the existing homepage Search Console verification", async () => {
    const head = HomeRoute.options.head;
    if (!head) throw new Error("Homepage head is missing");
    const metadata = await head({} as Parameters<typeof head>[0]);
    expect(metadata?.meta).toContainEqual({
      name: "google-site-verification",
      content: "5YFSCOqTK9qZ-F_0rdTj3OY8YkALbLS4GhJZXYPhhaM",
    });
  });

  it("emits canonical URL and social metadata without unrelated image URLs on all 14 public pages", async () => {
    expect(existsSync("public/og-image.png")).toBe(true);

    const staticPages = [
      { path: "/", route: HomeRoute },
      { path: "/converter", route: ConverterRoute },
      { path: "/overlap", route: OverlapRoute },
      { path: "/utc-to-local", route: UtcToLocalRoute },
      { path: "/sessions", route: SessionsIndexRoute },
      { path: "/about", route: AboutRoute },
      { path: "/contact", route: ContactRoute },
      { path: "/privacy", route: PrivacyRoute },
      { path: "/disclaimer", route: DisclaimerRoute },
      { path: "/white-label", route: WhiteLabelRoute },
    ] as const;

    const sessionPages = ["sydney", "tokyo", "london", "newyork"] as const;

    const allPageResults: {
      path: string;
      headOut: unknown;
    }[] = [];

    for (const p of staticPages) {
      const headOut = await p.route.options.head?.({} as never);
      allPageResults.push({ path: p.path, headOut });
    }

    for (const sid of sessionPages) {
      const headOut = await SessionsDetailRoute.options.head?.({
        loaderData: { id: sid },
        params: { session: sid },
      } as never);
      allPageResults.push({ path: `/sessions/${sid}`, headOut });
    }

    expect(allPageResults).toHaveLength(14);

    for (const { path, headOut } of allPageResults) {
      const expectedUrl = `${SITE_ORIGIN}${path}`;
      const metaList = ((headOut as { meta?: unknown[] } | undefined)?.meta ?? []) as Record<string, string>[];
      const linkList = ((headOut as { links?: unknown[] } | undefined)?.links ?? []) as Record<string, string>[];

      // Canonical URL
      expect(linkList).toContainEqual({ rel: "canonical", href: expectedUrl });

      // Title and description
      const titleEntry = metaList.find((m) => typeof m["title"] === "string");
      const descEntry = metaList.find((m) => m["name"] === "description");
      expect(Boolean(titleEntry?.["title"])).toBe(true);
      expect(Boolean(descEntry?.["content"])).toBe(true);

      // Open Graph title, description, image, url, type
      expect(metaList).toContainEqual({
        property: "og:title",
        content: titleEntry?.["title"],
      });
      expect(metaList).toContainEqual({
        property: "og:description",
        content: descEntry?.["content"],
      });
      expect(metaList).toContainEqual({
        property: "og:url",
        content: expectedUrl,
      });
      expect(metaList.some((m) => m["property"] === "og:image")).toBe(false);
      expect(metaList).toContainEqual({
        property: "og:type",
        content: "website",
      });

      // Twitter card, title, description, image
      expect(metaList).toContainEqual({
        name: "twitter:card",
        content: "summary_large_image",
      });
      expect(metaList).toContainEqual({
        name: "twitter:title",
        content: titleEntry?.["title"],
      });
      expect(metaList).toContainEqual({
        name: "twitter:description",
        content: descEntry?.["content"],
      });
      expect(metaList.some((m) => m["name"] === "twitter:image")).toBe(false);
    }
  });

  it("includes a safe .env.example and configures .gitignore to exclude .env secrets while allowing .env.example", () => {
    const envExample = readFileSync(".env.example", "utf8");
    expect(envExample).toContain("VITE_SUPABASE_URL=");
    expect(envExample).toContain("VITE_SUPABASE_PUBLISHABLE_KEY=");
    expect(envExample).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(envExample).not.toMatch(/service_role/i);

    const gitignore = readFileSync(".gitignore", "utf8");
    expect(gitignore).toContain(".env");
    expect(gitignore).toContain(".env.*");
    expect(gitignore).toContain("!.env.example");

    const supaSource = readFileSync("src/lib/supabase.ts", "utf8");
    expect(supaSource).toContain('@/integrations/supabase/client');
    expect(supaSource).not.toContain("VITE_SUPABASE_ANON_KEY");
    expect(supaSource).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(supaSource).not.toMatch(/service_role/i);
  });
});