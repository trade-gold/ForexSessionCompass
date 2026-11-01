import { z } from "zod";

const accessSchema = z.object({
  academy_name: z.string(),
  status: z.enum(["pending", "active", "suspended"]),
  activated_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  is_active: z.boolean(),
});

export type AcademyAccess = z.infer<typeof accessSchema>;

export type AccessState = "pending" | "active" | "expired" | "deactivated";

export type AdminAction = "activate" | "renew" | "deactivate";

export type DashboardSectionId =
  | "overview"
  | "profile"
  | "membership"
  | "subscription"
  | "preferences"
  | "security"
  | "account"
  | "admin";

const profileRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  academy_name: z.string(),
  contact_name: z.string(),
  phone: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  status: z.enum(["pending", "active", "suspended"]),
  activated_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

export type AcademyProfileRow = z.infer<typeof profileRowSchema>;

export type AdminAcademyRow = AcademyProfileRow;

const DAY_MS = 86_400_000;

export function parseAcademyAccess(data: unknown): AcademyAccess | null {
  const parsed = accessSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function parseAcademyProfileRow(data: unknown): AcademyProfileRow | null {
  const parsed = profileRowSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function parseAdminAcademyRow(data: unknown): AdminAcademyRow | null {
  return parseAcademyProfileRow(data);
}

export function parseAdminAcademyList(data: unknown): AdminAcademyRow[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => parseAdminAcademyRow(item))
    .filter((row): row is AdminAcademyRow => row !== null);
}

export function accessState(access: AcademyAccess): AccessState {
  if (access.is_active) return "active";
  if (access.status === "pending") return "pending";
  if (access.status === "suspended") return "deactivated";
  return "expired";
}

export function adminRowAccessState(row: AdminAcademyRow, now: Date): AccessState {
  if (row.status === "pending") return "pending";
  if (row.status === "suspended") return "deactivated";
  if (
    row.status === "active" &&
    row.expires_at !== null &&
    new Date(row.expires_at).getTime() > now.getTime()
  ) {
    return "active";
  }
  return "expired";
}

/**
 * Returns the accurate, non-fabricated plan name supported by the database state.
 */
export function describeMembershipPlan(access: AcademyAccess | null): string {
  if (!access) return "Registered Account";
  const state = accessState(access);
  if (state === "active") return "30-Day Academy Rental Plan";
  if (state === "pending") return "Registered Account (Pending Activation)";
  if (state === "expired") return "30-Day Academy Rental Plan (Expired)";
  return "Academy Account (Suspended)";
}

/**
 * Enforces that premium academy rental features are unlocked only when
 * the server-side `get_my_academy_access()` RPC confirms `is_active === true`.
 */
export function canAccessPremiumAcademyFeatures(access: AcademyAccess | null): boolean {
  if (!access) return false;
  return access.is_active === true && accessState(access) === "active";
}

export function daysRemaining(access: Pick<AcademyAccess, "expires_at">, now: Date): number {
  if (!access.expires_at) return 0;
  return Math.max(0, Math.ceil((new Date(access.expires_at).getTime() - now.getTime()) / DAY_MS));
}

export function validateProfileUpdateInput(input: {
  contactName: string;
  academyName: string;
  phone?: string | undefined;
  country?: string | undefined;
}): { valid: true; data: { contact_name: string; academy_name: string; phone: string | null; country: string | null } } | { valid: false; error: string } {
  const contact = input.contactName.trim();
  const academy = input.academyName.trim();
  const phone = (input.phone ?? "").trim();
  const country = (input.country ?? "").trim();

  if (contact.length < 2 || contact.length > 120) {
    return { valid: false, error: "Display name must be between 2 and 120 characters." };
  }
  if (academy.length < 2 || academy.length > 120) {
    return { valid: false, error: "Academy / organization name must be between 2 and 120 characters." };
  }
  if (phone.length > 40) {
    return { valid: false, error: "Phone number must be 40 characters or fewer." };
  }
  if (country.length > 80) {
    return { valid: false, error: "Country must be 80 characters or fewer." };
  }
  return {
    valid: true,
    data: {
      contact_name: contact,
      academy_name: academy,
      phone: phone.length > 0 ? phone : null,
      country: country.length > 0 ? country : null,
    },
  };
}
