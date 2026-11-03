// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name === ".git") continue;
      walk(full, out);
    } else out.push(full);
  }
  return out;
}

const rel = (f: string) => relative(ROOT, f).split("\\").join("/");
const srcFiles = walk(join(ROOT, "src")).filter((f) => /\.(ts|tsx)$/.test(f));
const appSource = srcFiles.filter((f) => !rel(f).startsWith("src/test/"));
const read = (f: string) => readFileSync(f, "utf8");

describe("repository security guards", () => {
  it("keeps the service-role key out of client-reachable code", () => {
    const offenders = appSource
      .filter((f) => /service_role|SERVICE_ROLE/i.test(read(f)))
      .map(rel)
      .filter((f) => f !== "src/integrations/supabase/client.server.ts");
    expect(offenders).toEqual([]);

    const importers = appSource
      .filter((f) => !rel(f).startsWith("src/integrations/"))
      .filter((f) => /client\.server/.test(read(f)))
      .map(rel);
    expect(importers).toEqual([]);
  });

  it("contains no hardcoded credentials", () => {
    const patterns = [
      /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
      /sb_secret_[A-Za-z0-9_-]{8,}/,
      /sk_(live|test)_[A-Za-z0-9]{10,}/,
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    ];
    const files = [...srcFiles, ...walk(join(ROOT, "public")), join(ROOT, ".env.example")];
    const hits = files.filter((f) => patterns.some((p) => p.test(read(f)))).map(rel);
    expect(hits).toEqual([]);
  });

  it("only exposes safe VITE_ variables and ignores real env files", () => {
    const example = read(join(ROOT, ".env.example"));
    const names = [...example.matchAll(/^\s*([A-Z0-9_]+)\s*=/gm)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) {
      expect(n).toMatch(/^VITE_SUPABASE_(URL|PUBLISHABLE_KEY)$/);
    }
    const gitignore = read(join(ROOT, ".gitignore"));
    // The managed .env must ship with published builds; local variants stay ignored.
    expect(gitignore).not.toMatch(/^\.env$/m);
    expect(gitignore).toMatch(/^\.env\.\*$/m);
    expect(gitignore).toMatch(/^!\.env\.example$/m);
  });

  it("keeps the shipped .env limited to public backend settings", () => {
    let env = "";
    try {
      env = read(join(ROOT, ".env"));
    } catch {
      return;
    }
    expect(env).not.toMatch(/SERVICE_ROLE|sb_secret_|DB_PASSWORD/i);
  });

  it("avoids raw HTML / code-eval sinks outside the shadcn chart helper", () => {
    for (const f of appSource) {
      const text = read(f);
      if (rel(f) !== "src/components/ui/chart.tsx") {
        expect(text, rel(f)).not.toMatch(/dangerouslySetInnerHTML/);
      }
      expect(text, rel(f)).not.toMatch(/\beval\(|new Function\(|document\.write\(|\.innerHTML\s*=/);
    }
  });

  it("serves only the expected static files from public/", () => {
    const names = readdirSync(join(ROOT, "public")).sort();
    expect(names).toEqual(["favicon.ico", "og-image.png", "robots.txt", "sitemap.xml"]);
  });

  it("enforces strict chronological ordering on all supabase/migrations files", () => {
    const dir = join(ROOT, "supabase", "migrations");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    expect(files.length).toBe(6);
    for (const f of files) {
      expect(f).toMatch(/^202\d{11}_[a-z0-9_]+\.sql$/);
    }
    expect(files[0]).toBe("20261031101444_academy_rental_foundation.sql");
    expect(files[files.length - 1]).toBe("20261102120000_security_and_commercial_unification.sql");
  });

  it("enables RLS on every table created in supabase/migrations and locks admin bootstrap", () => {
    const dir = join(ROOT, "supabase", "migrations");
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => read(join(dir, f)))
      .join("\n");
    const tables = [
      ...new Set(
        [...sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?public\.([a-z_]+)/gi)].map((m) => m[1]),
      ),
    ];
    expect(tables.length).toBeGreaterThanOrEqual(11);
    for (const t of tables) {
      expect(sql, `RLS for ${t}`).toMatch(
        new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`, "i"),
      );
    }

    const unificationSql = read(
      join(dir, "20261102120000_security_and_commercial_unification.sql"),
    );
    expect(unificationSql).toContain("NOT EXISTS (SELECT 1 FROM public.admins)");
    expect(unificationSql).toContain("payments_unique_reference_idx");
    expect(unificationSql).toContain("public.admin_audit_logs");
    expect(unificationSql).toContain("public.get_verified_academy_brand");
  });

  it("pins search_path on SECURITY DEFINER functions and guards admin_* functions", () => {
    const dir = join(ROOT, "supabase", "migrations");
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => read(join(dir, f)))
      .join("\n");
    const blocks = sql.split(/CREATE OR REPLACE FUNCTION /i).slice(1);
    expect(blocks.length).toBeGreaterThan(8);
    for (const b of blocks) {
      const name = b.slice(0, b.indexOf("(")).trim();
      const head = b.slice(0, b.search(/\bAS\s+\$\$/i));
      if (/SECURITY DEFINER/i.test(head)) {
        expect(head, `${name} search_path`).toMatch(/SET search_path/i);
      }
      if (/^public\.admin_/.test(name)) {
        expect(b, `${name} admin check`).toMatch(/is_admin\(\)/);
      }
    }
  });
});
