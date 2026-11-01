import { describe, expect, it } from "vitest";
import {
  formatDuration,
  isValidCalendarDate,
  isValidZone,
  overlapsOnUtcDate,
  getSession,
  zonedTimeToUtc,
} from "@/lib/forex-time";
import {
  configSearch,
  escapeHtml,
  parseBrandConfig,
} from "@/lib/white-label";
import {
  canAccessPremiumAcademyFeatures,
  parseAcademyAccess,
  validateProfileUpdateInput,
} from "@/lib/academy-access";

describe("Phase 3 Security & Edge-Case Hardening", () => {
  it("prevents XSS and protocol-injection payloads in white-label logo and HTML snippets", () => {
    for (const badLogo of [
      "javascript:1",
      "data:text/x",
      "//evil.co/a",
      "http://x.co",
      "<script>x",
      'https://example.com/a"onload="alert(1)',
    ]) {
      const parsed = parseBrandConfig({ logo: badLogo });
      expect(parsed.logo).toBeUndefined();
    }

    expect(parseBrandConfig({ logo: "APEX-FX" }).logo).toBe("APEX-FX");
    expect(parseBrandConfig({ logo: "https://example.com/logo.png" }).logo).toBe(
      "https://example.com/logo.png",
    );

    expect(escapeHtml('Apex "Pro" <script>&</script>')).toBe(
      "Apex &quot;Pro&quot; &lt;script&gt;&amp;&lt;/script&gt;",
    );
  });

  it("preserves custom session labels containing commas without truncating subsequent labels", () => {
    const cfg = {
      labels: {
        london: "London, UK Killzone",
        newyork: "New York, US Open",
      },
    };
    const search = configSearch(cfg);
    const parsed = parseBrandConfig(search);
    expect(parsed.labels?.london).toBe("London· UK Killzone");
    expect(parsed.labels?.newyork).toBe("New York· US Open");
  });

  it("validates calendar dates strictly and rejects impossible rollover dates like Feb 30", () => {
    expect(isValidCalendarDate(2026, 2, 28)).toBe(true);
    expect(isValidCalendarDate(2024, 2, 29)).toBe(true);
    expect(isValidCalendarDate(2026, 2, 29)).toBe(false);
    expect(isValidCalendarDate(2026, 2, 31)).toBe(false);
    expect(isValidCalendarDate(2026, 13, 1)).toBe(false);
    expect(isValidCalendarDate(2026, 0, 10)).toBe(false);

    const london = getSession("london");
    const ny = getSession("newyork");
    expect(overlapsOnUtcDate(london, london, 2026, 7, 15)).toHaveLength(0);
    expect(overlapsOnUtcDate(london, ny, 2026, 2, 31)).toHaveLength(0);
  });

  it("handles US, UK, and Australia DST transitions and Tokyo non-DST accurately", () => {
    for (const m of [1, 3, 7, 10]) {
      expect(zonedTimeToUtc(2026, m, 15, 9, 0, "Asia/Tokyo").toISOString()).toBe(
        `2026-${String(m).padStart(2, "0")}-15T00:00:00.000Z`,
      );
    }

    expect(zonedTimeToUtc(2026, 4, 3, 7, 0, "Australia/Sydney").toISOString()).toBe(
      "2026-04-02T20:00:00.000Z",
    );
    expect(zonedTimeToUtc(2026, 4, 7, 7, 0, "Australia/Sydney").toISOString()).toBe(
      "2026-04-06T21:00:00.000Z",
    );

    expect(formatDuration(NaN)).toBe("0h 00m 00s");
    expect(isValidZone("UTC")).toBe(true);
  });

  it("enforces server-side is_active flag and rejects client-manipulated or incomplete access records", () => {
    const unverifiedFuture = parseAcademyAccess({
      academy_name: "Untrusted Client Clock Academy",
      status: "active",
      activated_at: "2026-10-01T00:00:00Z",
      expires_at: "2099-01-01T00:00:00Z",
      is_active: false,
    });
    expect(canAccessPremiumAcademyFeatures(unverifiedFuture)).toBe(false);

    expect(
      validateProfileUpdateInput({
        contactName: "Valid Name",
        academyName: "Valid Academy",
        phone: "1".repeat(45),
      }).valid,
    ).toBe(false);
  });
});
