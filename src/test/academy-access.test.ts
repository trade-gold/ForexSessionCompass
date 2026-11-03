import { describe, expect, it } from "vitest";
import {
  accessState,
  adminRowAccessState,
  canAccessPremiumAcademyFeatures,
  daysRemaining,
  describeMembershipPlan,
  parseAcademyAccess,
  parseAcademyProfileRow,
  parseAdminAcademyList,
  parseAdminAcademyRow,
  resolveUnifiedAccess,
  validateProfileUpdateInput,
  type AcademyAccess,
} from "@/lib/academy-access";
import { describeAuthError } from "@/lib/auth-messages";
import {
  ACADEMY_PRESETS,
  brandedURL,
  configSearch,
  escapeHtml,
  parseBrandConfig,
  sanitizeAcademySlug,
} from "@/lib/white-label";

const base: AcademyAccess = {
  academy_name: "Test Academy",
  status: "pending",
  activated_at: null,
  expires_at: null,
  is_active: false,
};

describe("academy access states & unified membership plans", () => {
  it("shows pending accounts as pending and describes plan accurately", () => {
    expect(accessState(base)).toBe("pending");
    expect(canAccessPremiumAcademyFeatures(base)).toBe(false);
    expect(describeMembershipPlan(base)).toBe("Registered Account (Pending Activation)");
  });

  it("unifies paid subscriptions with academy membership state (eliminates split-brain)", () => {
    const unified = resolveUnifiedAccess(base, {
      plan_id: "elite",
      plan_name: "Elite",
      status: "active",
      expires_at: "2030-01-01T00:00:00Z",
      is_admin: false,
      features: ["journal", "alerts"],
    });
    expect(unified.effectiveAccess?.is_active).toBe(true);
    expect(unified.effectiveAccess?.status).toBe("active");
    expect(unified.unifiedPlanLabel).toBe("Elite");
    expect(canAccessPremiumAcademyFeatures(unified.effectiveAccess)).toBe(true);
  });

  it("shows suspended accounts as deactivated", () => {
    const suspended = { ...base, status: "suspended" as const };
    expect(accessState(suspended)).toBe("deactivated");
    expect(canAccessPremiumAcademyFeatures(suspended)).toBe(false);
    expect(describeMembershipPlan(suspended)).toBe("Academy Account (Suspended)");
  });

  it("shows active accounts with a future expiry as active and unlocks premium features", () => {
    const active = {
      ...base,
      status: "active" as const,
      is_active: true,
      expires_at: "2030-01-01T00:00:00Z",
    };
    expect(accessState(active)).toBe("active");
    expect(canAccessPremiumAcademyFeatures(active)).toBe(true);
    expect(describeMembershipPlan(active)).toBe("30-Day Academy Rental Plan");
  });

  it("shows active-status accounts past their expiry as expired and blocks premium features", () => {
    const expired = {
      ...base,
      status: "active" as const,
      is_active: false,
      expires_at: "2020-01-01T00:00:00Z",
    };
    expect(accessState(expired)).toBe("expired");
    expect(canAccessPremiumAcademyFeatures(expired)).toBe(false);
    expect(canAccessPremiumAcademyFeatures(null)).toBe(false);
    expect(describeMembershipPlan(expired)).toBe("30-Day Academy Rental Plan (Expired)");
  });
});

describe("days remaining", () => {
  it("rounds partial days up", () => {
    const access = {
      ...base,
      status: "active" as const,
      is_active: true,
      expires_at: "2026-11-02T12:00:00Z",
    };
    expect(daysRemaining(access, new Date("2026-11-01T00:00:00Z"))).toBe(2);
  });

  it("never returns a negative number", () => {
    const access = { ...base, status: "active" as const, expires_at: "2026-01-01T00:00:00Z" };
    expect(daysRemaining(access, new Date("2026-11-01T00:00:00Z"))).toBe(0);
  });
});

describe("parseAcademyAccess, user profile validation & administrator academy validation", () => {
  it("accepts a well-formed access row", () => {
    expect(parseAcademyAccess({ ...base })).toEqual(base);
  });

  it("rejects missing or malformed data", () => {
    expect(parseAcademyAccess(null)).toBeNull();
    expect(parseAcademyAccess({ ...base, status: "unknown" })).toBeNull();
  });

  it("validates user profile rows and admin academy rows against server timestamp", () => {
    const validRow = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "owner@apexpip.example",
      academy_name: "Apex Pip Academy",
      contact_name: "Arjun Rao",
      phone: "+91 9876543210",
      country: "India",
      status: "active" as const,
      activated_at: "2026-10-15T00:00:00Z",
      expires_at: "2026-11-14T00:00:00Z",
      created_at: "2026-10-10T09:00:00Z",
      updated_at: "2026-10-15T00:00:00Z",
    };
    const parsedProfile = parseAcademyProfileRow(validRow);
    expect(parsedProfile).not.toBeNull();
    expect(parsedProfile!.contact_name).toBe("Arjun Rao");

    const parsedAdmin = parseAdminAcademyRow(validRow);
    expect(parsedAdmin).not.toBeNull();
    expect(adminRowAccessState(parsedAdmin!, new Date("2026-10-31T00:00:00Z"))).toBe("active");
    expect(adminRowAccessState(parsedAdmin!, new Date("2026-12-01T00:00:00Z"))).toBe("expired");

    const list = parseAdminAcademyList([validRow, { invalid: true }]);
    expect(list).toHaveLength(1);
  });

  it("validates profile update inputs and rejects out-of-range values", () => {
    const ok = validateProfileUpdateInput({
      contactName: "  Varun Kondi  ",
      academyName: "  Hyderabad FX Desk  ",
      phone: "  +91 9000000000 ",
      country: " India ",
    });
    expect(ok.valid).toBe(true);
    if (ok.valid) {
      expect(ok.data.contact_name).toBe("Varun Kondi");
      expect(ok.data.academy_name).toBe("Hyderabad FX Desk");
      expect(ok.data.phone).toBe("+91 9000000000");
      expect(ok.data.country).toBe("India");
    }

    const tooShort = validateProfileUpdateInput({
      contactName: "A",
      academyName: "Valid Academy",
    });
    expect(tooShort.valid).toBe(false);
  });
});

describe("white-label branding isolation, slug sanitization & auth error messages", () => {
  it("isolates multiple academy configurations and validates primary & secondary colors", () => {
    expect(ACADEMY_PRESETS.length).toBeGreaterThanOrEqual(3);
    for (const preset of ACADEMY_PRESETS) {
      const search = configSearch(preset.config);
      const roundtrip = parseBrandConfig(search);
      expect(roundtrip.brand).toBe(preset.config.brand);
      expect(roundtrip.accent).toBe(preset.config.accent);
      expect(roundtrip.accent2).toBe(preset.config.accent2);
      expect(roundtrip.tz).toBe(preset.config.tz);
      expect(brandedURL(roundtrip)).toContain("brand=");
    }

    expect(sanitizeAcademySlug("Apex-Pip-01")).toBe("apex-pip-01");
    expect(sanitizeAcademySlug("bad<script>slug")).toBeUndefined();

    // Rejects malicious or invalid inputs
    const sanitized = parseBrandConfig({
      brand: "Valid Academy",
      logo: "javascript:alert(1)",
      accent: "not-a-color",
      accent2: "#123456",
      tz: "Invalid/Zone",
      academy: "../evil",
    });
    expect(sanitized.logo).toBeUndefined();
    expect(sanitized.accent).toBeUndefined();
    expect(sanitized.accent2).toBe("#123456");
    expect(sanitized.tz).toBeUndefined();
    expect(sanitized.academy).toBeUndefined();
  });

  it("maps authentication and authorization errors to clear user messages", () => {
    expect(describeAuthError(new Error("Invalid login credentials"))).toBe(
      "Email or password is incorrect.",
    );
    expect(describeAuthError(new Error("User already registered"))).toContain("already exists");
    expect(describeAuthError(new Error("Not authorized (42501)"))).toContain("not authorized");
  });

  it("prevents XSS, protocol injection, URL credential injection, and comma truncation in white-label configs", () => {
    for (const badLogo of [
      "javascript:1",
      "data:text/x",
      "//evil.co/a",
      "http://x.co",
      "<script>x",
      'https://example.com/a"onload="alert(1)',
      "https://user:pass@evil.co/logo.png",
    ]) {
      expect(parseBrandConfig({ logo: badLogo }).logo).toBeUndefined();
    }
    expect(parseBrandConfig({ logo: "APEX-FX" }).logo).toBe("APEX-FX");
    expect(parseBrandConfig({ logo: "https://example.com/logo.png" }).logo).toBe(
      "https://example.com/logo.png",
    );
    expect(escapeHtml('Apex "Pro" <script>&</script>')).toBe(
      "Apex &quot;Pro&quot; &lt;script&gt;&amp;&lt;/script&gt;",
    );

    const commaLabels = parseBrandConfig(
      configSearch({
        labels: { london: "London, UK Killzone", newyork: "NY, US Open" },
      }),
    );
    expect(commaLabels.labels?.london).toBe("London· UK Killzone");
    expect(commaLabels.labels?.newyork).toBe("NY· US Open");
  });
});
