import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const origin = "https://forex-session-compass.lovable.app";
const xml = readFileSync("public/sitemap.xml", "utf8");
const robots = readFileSync("public/robots.txt", "utf8");

describe("Public sitemap", () => {
  it("contains all indexable public pages on the live domain", () => {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    expect(document.querySelector("parsererror")).toBeNull();
    expect(document.documentElement.namespaceURI).toBe("http://www.sitemaps.org/schemas/sitemap/0.9");
    const urls = [...document.getElementsByTagName("loc")].map((element) => element.textContent);
    const paths = ["/", "/converter", "/overlap", "/utc-to-local", "/sessions", "/sessions/sydney", "/sessions/tokyo", "/sessions/london", "/sessions/newyork", "/about", "/contact", "/privacy", "/disclaimer", "/white-label", "/pricing"];
    expect(urls.sort()).toEqual(paths.map((path) => origin + path).sort());
    expect(document.getElementsByTagName("lastmod").length).toBe(0);
  });

  it("allows crawling and advertises the exact live sitemap URL", () => {
    expect(robots).toMatch(/User-agent: \*\s+Allow: \//);
    expect(robots).not.toMatch(/^Disallow:\s*\S/m);
    expect(robots.match(/^Sitemap:\s*(.+)$/m)?.[1]).toBe(`${origin}/sitemap.xml`);
  });
});