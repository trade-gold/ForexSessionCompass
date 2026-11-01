import { Link, Navigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Award,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  Settings,
  Shield,
  ShieldCheck,
  Sliders,
  User,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useBrand, useClockFormat } from "@/components/BrandProvider";
import { ZoneSelect } from "@/components/site";
import { Button } from "@/components/ui/button";
import { useLocalZone, useNow } from "@/hooks/use-now";
import {
  SESSIONS,
  ZONES,
  formatDate as formatTzDate,
  formatOffset,
  getOffsetMinutes,
  isValidZone,
} from "@/lib/forex-time";
import { supabase } from "@/lib/supabase";
import { describeAuthError } from "@/lib/auth-messages";
import {
  DEFAULT_PINNED_ZONES,
  THEME_PRESETS,
  brandedURL,
  configSearch,
  escapeHtml,
  loadSavedProfiles,
  parseBrandConfig,
  saveProfilesToStorage,
  type BrandConfig,
  type SavedTimezoneProfile,
} from "@/lib/white-label";
import {
  accessState,
  adminRowAccessState,
  canAccessPremiumAcademyFeatures,
  daysRemaining,
  describeMembershipPlan,
  parseAdminAcademyList,
  validateProfileUpdateInput,
  type AcademyAccess,
  type AccessState,
  type AdminAcademyRow,
  type AdminAction,
  type DashboardSectionId,
} from "@/lib/academy-access";

const TOOLS = [
  { to: "/", label: "Session Clock", desc: "Live Sydney, Tokyo, London & NY clocks" },
  { to: "/converter", label: "Time Zone Converter", desc: "Convert any date & time across zones" },
  { to: "/overlap", label: "Session Overlaps", desc: "London/NY & custom overlap calculator" },
  { to: "/utc-to-local", label: "UTC to Local", desc: "Live UTC & local clock comparison" },
  { to: "/sessions", label: "Session Guides", desc: "Trading hours & DST characteristics" },
] as const;

const STATE_LABEL: Record<AccessState, string> = {
  pending: "Pending activation",
  active: "Active",
  expired: "Expired",
  deactivated: "Deactivated",
};

const STATE_BADGE: Record<AccessState, string> = {
  pending: "border border-border bg-secondary text-foreground",
  active: "border border-up/40 bg-up/15 text-up",
  expired: "border border-destructive/40 bg-destructive/15 text-foreground",
  deactivated: "border border-destructive/40 bg-destructive/15 text-foreground",
};

function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return "Not available";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Not available";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatIsoDateTime(iso: string | null | undefined): string {
  if (!iso) return "Not available";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Not available";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusMessage(access: AcademyAccess, state: AccessState): string {
  if (state === "pending") {
    return "Your account is registered and waiting for activation. Protected academy customization tools stay locked until your payment is verified and the administrator activates your account. Your 30 days of access start at activation.";
  }
  if (state === "expired") {
    return `Your 30-day access ended${access.expires_at ? ` on ${formatIsoDate(access.expires_at)}` : ""}. Contact the administrator to renew and restore access.`;
  }
  if (state === "deactivated") {
    return "Your account is currently deactivated. Contact the administrator for help.";
  }
  return "Your access is active. All membership features, white-label customization options, and forex tools below are available to you.";
}

const SECTIONS: {
  id: DashboardSectionId;
  label: string;
  shortDesc: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}[] = [
  { id: "overview", label: "Overview", shortDesc: "Account summary & quick links", icon: LayoutDashboard },
  { id: "profile", label: "My Profile", shortDesc: "Display name, contact & email", icon: User },
  { id: "membership", label: "Membership", shortDesc: "Plan status, features & branding", icon: Award },
  { id: "subscription", label: "Subscription", shortDesc: "Activation & expiry dates", icon: CreditCard },
  { id: "preferences", label: "Preferences", shortDesc: "Timezone & 12H/24H clock settings", icon: Sliders },
  { id: "security", label: "Security", shortDesc: "Password update, reset & session", icon: Shield },
  { id: "account", label: "Account Management", shortDesc: "Account details & sign-out", icon: Settings },
  { id: "admin", label: "Admin Console", shortDesc: "Manage registered academies", icon: ShieldCheck, adminOnly: true },
];

export function UserProfileDashboard({ initialSection = "overview" }: { initialSection?: DashboardSectionId | undefined }) {
  const { session, access, profile, isAdmin, accessError, loading, refreshAccess, signOut } = useAuth();
  const { fmt, setFmt, preferredTz, setPreferredTz } = useBrand();
  const formatClockTime = useClockFormat();
  const localZone = useLocalZone();
  const now = useNow();

  const [activeSection, setActiveSection] = useState<DashboardSectionId>(initialSection);

  // B. Profile form state
  const [contactNameInput, setContactNameInput] = useState("");
  const [academyNameInput, setAcademyNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [countryInput, setCountryInput] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // B2. Email update state
  const [newEmailInput, setNewEmailInput] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // C. White-label branding studio state (for active memberships)
  const [brandDraft, setBrandDraft] = useState<BrandConfig>({
    brand: access?.academy_name ?? "My Forex Academy",
    title: `${access?.academy_name ?? "My Forex Academy"} — Session Clock`,
    logo: "",
    accent: "#34d399",
    accent2: "#38bdf8",
    tz: preferredTz ?? "Asia/Kolkata",
    fmt: "24",
    sessions: ["sydney", "tokyo", "london", "newyork"],
    labels: {},
  });
  const [copyNotice, setCopyNotice] = useState("");

  // E. Preferences state
  const [pinnedZones, setPinnedZones] = useState<string[]>(DEFAULT_PINNED_ZONES);
  const [addZoneCandidate, setAddZoneCandidate] = useState<string>("Asia/Tokyo");
  const [savedProfiles, setSavedProfiles] = useState<SavedTimezoneProfile[]>([]);
  const [newProfileName, setNewProfileName] = useState("");
  const [prefFeedback, setPrefFeedback] = useState<string | null>(null);

  // F. Security state
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [resetEmailSending, setResetEmailSending] = useState(false);
  const [resetEmailFeedback, setResetEmailFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Sync profile inputs when profile/access/session loads
  useEffect(() => {
    const meta = (session?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const resolvedAcademy =
      profile?.academy_name ??
      access?.academy_name ??
      (typeof meta["academy_name"] === "string" ? meta["academy_name"] : "");
    const resolvedContact =
      profile?.contact_name ??
      (typeof meta["contact_name"] === "string" ? meta["contact_name"] : "");
    const resolvedPhone =
      profile?.phone ?? (typeof meta["phone"] === "string" ? meta["phone"] : "");
    const resolvedCountry =
      profile?.country ?? (typeof meta["country"] === "string" ? meta["country"] : "");

    if (resolvedAcademy) setAcademyNameInput(resolvedAcademy);
    if (resolvedContact) setContactNameInput(resolvedContact);
    setPhoneInput(resolvedPhone ?? "");
    setCountryInput(resolvedCountry ?? "");
    if (session?.user?.email) setNewEmailInput(session.user.email);

    if (resolvedAcademy) {
      setBrandDraft((prev) => ({
        ...prev,
        brand: prev.brand && prev.brand !== "My Forex Academy" ? prev.brand : resolvedAcademy,
        title:
          prev.title && prev.title !== "My Forex Academy — Session Clock"
            ? prev.title
            : `${resolvedAcademy} — Live Session Clock`,
      }));
    }
  }, [profile, access, session]);

  // Load saved timezone profiles & pinned clocks
  useEffect(() => {
    setSavedProfiles(loadSavedProfiles());
    try {
      const savedPinned = localStorage.getItem("fsc_pinned_zones");
      if (savedPinned) {
        const parsed = JSON.parse(savedPinned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPinnedZones(parsed.filter((z): z is string => isValidZone(z)).slice(0, 6));
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <div className="panel mx-auto max-w-md space-y-3 p-8">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-info border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (!access && !profile && !isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 md:py-16">
        <div className="rounded-xl border bg-card p-6 md:p-8" role="alert">
          <p className="font-mono text-xs uppercase tracking-widest text-info">Account Notice</p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Account unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {accessError
              ? "We could not load your academy account. Refresh the page and try again."
              : "No academy profile was found for this login."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="button" variant="default" onClick={() => void refreshAccess()}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Retry loading
            </Button>
            <Button type="button" variant="outline" onClick={() => void signOut()}>
              Log out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const effectiveAccess: AcademyAccess | null =
    access ??
    (profile
      ? {
          academy_name: profile.academy_name,
          status: profile.status,
          activated_at: profile.activated_at,
          expires_at: profile.expires_at,
          // Never evaluate is_active=true from the client browser clock; require server RPC
          is_active: false,
        }
      : null);

  const state: AccessState = effectiveAccess ? accessState(effectiveAccess) : "pending";
  const isPremiumUnlocked = canAccessPremiumAcademyFeatures(effectiveAccess);
  const remainingDays = effectiveAccess && now ? daysRemaining(effectiveAccess, now) : null;
  const planName = describeMembershipPlan(effectiveAccess);

  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    profile?.contact_name ||
    (typeof meta["contact_name"] === "string" && meta["contact_name"]) ||
    effectiveAccess?.academy_name ||
    session.user.email?.split("@")[0] ||
    "Trader";
  const organizationName =
    profile?.academy_name ||
    effectiveAccess?.academy_name ||
    (typeof meta["academy_name"] === "string" && meta["academy_name"]) ||
    "Personal Account";
  const userEmail = profile?.email || session.user.email || "Not available";
  const createdAtIso = profile?.created_at ?? session.user.created_at ?? null;
  const updatedAtIso = profile?.updated_at ?? session.user.updated_at ?? null;
  const activeTimezone = preferredTz ?? localZone;

  const visibleSections = SECTIONS.filter((s) => !s.adminOnly || isAdmin);

  // Handlers for Section B: My Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setProfileFeedback(null);

    const validated = validateProfileUpdateInput({
      contactName: contactNameInput,
      academyName: academyNameInput,
      phone: phoneInput,
      country: countryInput,
    });
    if (!validated.valid) {
      setProfileFeedback({ type: "err", text: validated.error });
      return;
    }

    setProfileSaving(true);
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("academies")
      .update({
        ...validated.data,
        updated_at: nowIso,
      })
      .eq("id", session.user.id);

    // Sync user_metadata in Supabase Auth as well
    await supabase.auth.updateUser({
      data: {
        contact_name: validated.data.contact_name,
        academy_name: validated.data.academy_name,
        phone: validated.data.phone ?? "",
        country: validated.data.country ?? "",
      },
    });

    setProfileSaving(false);
    if (error) {
      setProfileFeedback({ type: "err", text: describeAuthError(error) });
      return;
    }
    setProfileFeedback({ type: "ok", text: "Profile changes saved successfully." });
    await refreshAccess();
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setEmailFeedback(null);
    const trimmedEmail = newEmailInput.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailFeedback({ type: "err", text: "Enter a valid email address." });
      return;
    }
    if (trimmedEmail === (session.user.email ?? "").toLowerCase()) {
      setEmailFeedback({ type: "err", text: "Enter a different email address than your current one." });
      return;
    }
    setEmailSaving(true);
    const { error } = await supabase.auth.updateUser({ email: trimmedEmail });
    setEmailSaving(false);
    if (error) {
      setEmailFeedback({ type: "err", text: describeAuthError(error) });
      return;
    }
    setEmailFeedback({
      type: "ok",
      text: "Confirmation link sent. Check both your old and new email inboxes to verify the change.",
    });
  };

  // Handlers for Section E: Preferences
  const updatePinnedZones = (next: string[]) => {
    setPinnedZones(next);
    try {
      localStorage.setItem("fsc_pinned_zones", JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  };

  const handleSaveNewTimezoneProfile = () => {
    const trimmed = newProfileName.trim();
    if (!trimmed) {
      setPrefFeedback("Enter a profile name before saving.");
      return;
    }
    const nextProfile: SavedTimezoneProfile = {
      id: `${Date.now()}`,
      name: trimmed.slice(0, 40),
      tz: activeTimezone,
      fmt,
      pinnedZones,
    };
    const nextList = [nextProfile, ...savedProfiles.filter((p) => p.name !== nextProfile.name)].slice(0, 8);
    setSavedProfiles(nextList);
    saveProfilesToStorage(nextList);
    setNewProfileName("");
    setPrefFeedback(`Saved preference profile "${nextProfile.name}".`);
  };

  const handleActivateSavedProfile = (p: SavedTimezoneProfile) => {
    setPreferredTz(p.tz);
    setFmt(p.fmt);
    if (p.pinnedZones.length > 0) updatePinnedZones(p.pinnedZones);
    setPrefFeedback(`Applied profile "${p.name}" (${p.tz} · ${p.fmt}H).`);
  };

  const handleDeleteSavedProfile = (id: string) => {
    const nextList = savedProfiles.filter((p) => p.id !== id);
    setSavedProfiles(nextList);
    saveProfilesToStorage(nextList);
  };

  // Handlers for Section F: Security
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setPasswordFeedback(null);
    if (newPassword.length < 8 || newPassword.length > 72) {
      setPasswordFeedback({ type: "err", text: "Password must be between 8 and 72 characters." });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordFeedback({ type: "err", text: "Passwords do not match." });
      return;
    }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordFeedback({ type: "err", text: describeAuthError(error) });
      return;
    }
    setNewPassword("");
    setConfirmNewPassword("");
    setPasswordFeedback({ type: "ok", text: "Your password has been updated securely." });
  };

  const handleSendPasswordResetEmail = async () => {
    if (!supabase || !session.user.email) return;
    setResetEmailFeedback(null);
    setResetEmailSending(true);
    const redirectUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/academy`
        : "https://forex-session-compass.lovable.app/academy";
    const { error } = await supabase.auth.resetPasswordForEmail(session.user.email, {
      redirectTo: redirectUrl,
    });
    setResetEmailSending(false);
    if (error) {
      setResetEmailFeedback({ type: "err", text: describeAuthError(error) });
      return;
    }
    setResetEmailFeedback({
      type: "ok",
      text: `Password reset instructions sent to ${session.user.email}.`,
    });
  };

  // Helpers for Section C White-Label Studio
  const cleanBrand = parseBrandConfig(
    configSearch({
      ...brandDraft,
      brand: brandDraft.brand || organizationName,
    }),
  );
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://forex-session-compass.lovable.app";
  const studentDashboardUrl = brandedURL({ ...cleanBrand, embed: false }, origin);
  const studentEmbedUrl = brandedURL({ ...cleanBrand, embed: true }, origin);

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyNotice(`${label} copied to clipboard.`);
    } catch {
      setCopyNotice(`Copy manually: ${value}`);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      {/* Top Identity Banner */}
      <div className="mb-6 flex flex-col justify-between gap-4 rounded-xl border bg-panel p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-primary/40 bg-primary/15 font-mono text-lg font-bold text-primary">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-xs uppercase tracking-widest text-info">
                {isAdmin ? "Administrator & User Dashboard" : "User Profile Dashboard"}
              </p>
              <span
                className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wide ${STATE_BADGE[state]}`}
              >
                {STATE_LABEL[state]}
              </span>
            </div>
            <h1 className="mt-0.5 truncate text-xl font-semibold text-foreground sm:text-2xl">
              {organizationName}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {displayName} · {userEmail}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void refreshAccess()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Sync Status
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => void signOut()}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Log out
          </Button>
        </div>
      </div>

      {/* Main Layout: Dark Charcoal/Navy Sidebar + Active Content Area */}
      <div className="grid gap-6 lg:grid-cols-[16.5rem_1fr]">
        {/* Sidebar Navigation */}
        <aside className="rounded-xl border bg-panel p-3 lg:self-start" aria-label="Dashboard sections">
          <p className="mb-2 hidden px-3 pt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground lg:block">
            Dashboard Navigation
          </p>
          <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-x-visible lg:pb-0">
            {visibleSections.map((item) => {
              const Icon = item.icon;
              const isCurrent = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    isCurrent
                      ? "bg-card font-semibold text-foreground shadow-sm ring-1 ring-primary/40"
                      : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="min-w-0">
                    <p className="truncate leading-tight">{item.label}</p>
                    <p className="hidden truncate text-[11px] font-normal text-muted-foreground lg:block">
                      {item.shortDesc}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="mt-4 hidden border-t pt-4 lg:block">
            <p className="px-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Live Clock ({activeTimezone})
            </p>
            <p className="mt-1 px-3 font-mono text-xl font-bold tabular-nums text-up">
              {now ? formatClockTime(now, activeTimezone, true) : "--:--:--"}
            </p>
            <p className="px-3 text-[11px] text-muted-foreground">
              {now ? `${formatTzDate(now, activeTimezone)} · ${fmt}H` : ""}
            </p>
          </div>
        </aside>

        {/* Active Section Panel */}
        <div className="min-w-0 space-y-6">
          {/* SECTION A: DASHBOARD OVERVIEW */}
          {activeSection === "overview" && (
            <section className="space-y-6" aria-label="Dashboard Overview">
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-widest text-info">
                      Dashboard Overview
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold text-foreground">
                      Welcome back, {displayName}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      {effectiveAccess
                        ? statusMessage(effectiveAccess, state)
                        : "Manage your profile, timezone preferences, and security settings below."}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 font-mono text-xs font-bold uppercase tracking-wide ${STATE_BADGE[state]}`}
                  >
                    {STATE_LABEL[state]}
                  </span>
                </div>

                {/* Key Account Metrics Grid */}
                <dl className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border bg-panel p-4">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Display Name & Organization
                    </dt>
                    <dd className="mt-1.5 truncate font-semibold text-foreground">{displayName}</dd>
                    <dd className="truncate text-xs text-muted-foreground">{organizationName}</dd>
                  </div>

                  <div className="rounded-lg border bg-panel p-4">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Account Email
                    </dt>
                    <dd className="mt-1.5 truncate font-mono text-sm text-foreground">{userEmail}</dd>
                    <dd className="text-xs text-muted-foreground">
                      Created: {formatIsoDate(createdAtIso)}
                    </dd>
                  </div>

                  <div className="rounded-lg border bg-panel p-4">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Current Plan
                    </dt>
                    <dd className="mt-1.5 font-semibold text-foreground">{planName}</dd>
                    <dd className="text-xs text-muted-foreground">
                      Status: {STATE_LABEL[state]}
                    </dd>
                  </div>

                  <div className="rounded-lg border bg-panel p-4">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Access Window
                    </dt>
                    <dd className="mt-1.5 font-mono text-sm text-foreground">
                      {effectiveAccess?.expires_at
                        ? `Expires ${formatIsoDate(effectiveAccess.expires_at)}`
                        : "No expiry set"}
                    </dd>
                    <dd className="text-xs text-muted-foreground">
                      {state === "active" && remainingDays !== null
                        ? `${remainingDays} days remaining`
                        : effectiveAccess?.activated_at
                          ? `Activated ${formatIsoDate(effectiveAccess.activated_at)}`
                          : "Awaiting activation"}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Quick Access to Dashboard Sections */}
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <h3 className="text-base font-semibold text-foreground">
                  Quick Access — Account Sections
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Jump directly to any profile, membership, preference, or security section.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleSections
                    .filter((s) => s.id !== "overview")
                    .map((sec) => {
                      const Icon = sec.icon;
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => setActiveSection(sec.id)}
                          className="flex items-start gap-3 rounded-lg border bg-panel p-4 text-left transition-colors hover:border-info"
                        >
                          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-info" />
                          <div>
                            <p className="text-sm font-semibold text-foreground">{sec.label}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{sec.shortDesc}</p>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Forex Tools Access */}
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Your Forex Session Tools</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Launch any Forex Session Compass calculator with your saved preferences.
                    </p>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    Preferred Zone: {activeTimezone} ({fmt}H)
                  </span>
                </div>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {TOOLS.map((tool) => (
                    <li key={tool.to}>
                      <Link
                        to={tool.to}
                        search={(prev) => prev}
                        className="block rounded-lg border bg-panel p-4 transition-colors hover:border-info"
                      >
                        <p className="text-sm font-semibold text-foreground">
                          {tool.label} <span className="text-info">→</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{tool.desc}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* SECTION B: MY PROFILE */}
          {activeSection === "profile" && (
            <section className="space-y-6" aria-label="My Profile">
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <p className="font-mono text-xs uppercase tracking-widest text-info">My Profile</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">
                  Profile Information & Display Name
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  View and update your display name, academy or organization name, and contact details. Your membership status and expiry dates are protected on the server.
                </p>

                <dl className="mt-5 grid gap-4 rounded-lg border bg-panel p-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Registered Email</dt>
                    <dd className="mt-1 truncate font-mono text-xs text-foreground">{userEmail}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Account Created</dt>
                    <dd className="mt-1 font-mono text-xs text-foreground">
                      {formatIsoDate(createdAtIso)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Last Profile Update</dt>
                    <dd className="mt-1 font-mono text-xs text-foreground">
                      {formatIsoDate(updatedAtIso)}
                    </dd>
                  </div>
                </dl>

                <form onSubmit={(e) => void handleSaveProfile(e)} className="mt-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="prof-contact" className="mb-1 block text-xs text-muted-foreground">
                        Display Name (Contact Person) *
                      </label>
                      <input
                        id="prof-contact"
                        required
                        minLength={2}
                        maxLength={120}
                        className="field"
                        value={contactNameInput}
                        onChange={(e) => setContactNameInput(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="prof-academy" className="mb-1 block text-xs text-muted-foreground">
                        Academy / Organization Name *
                      </label>
                      <input
                        id="prof-academy"
                        required
                        minLength={2}
                        maxLength={120}
                        className="field"
                        value={academyNameInput}
                        onChange={(e) => setAcademyNameInput(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="prof-phone" className="mb-1 block text-xs text-muted-foreground">
                        Phone Number (optional)
                      </label>
                      <input
                        id="prof-phone"
                        type="tel"
                        maxLength={40}
                        placeholder="+91 ..."
                        className="field"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="prof-country" className="mb-1 block text-xs text-muted-foreground">
                        Country (optional)
                      </label>
                      <input
                        id="prof-country"
                        maxLength={80}
                        placeholder="India"
                        className="field"
                        value={countryInput}
                        onChange={(e) => setCountryInput(e.target.value)}
                      />
                    </div>
                  </div>

                  {profileFeedback && (
                    <p
                      role="status"
                      className={`rounded-md border px-3 py-2 text-xs ${
                        profileFeedback.type === "ok"
                          ? "border-up/40 bg-up/10 text-up"
                          : "border-destructive/50 bg-destructive/10 text-foreground"
                      }`}
                    >
                      {profileFeedback.text}
                    </p>
                  )}

                  <Button type="submit" disabled={profileSaving}>
                    {profileSaving ? "Saving changes..." : "Save Profile Changes"}
                  </Button>
                </form>
              </div>

              {/* Secure Email Update Flow */}
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-info" />
                  <h3 className="text-base font-semibold text-foreground">
                    Update Registered Email Address
                  </h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Email updates use Supabase's secure verification workflow. A confirmation link is sent before your login email changes.
                </p>
                <form onSubmit={(e) => void handleUpdateEmail(e)} className="mt-4 space-y-4">
                  <div className="max-w-md">
                    <label htmlFor="prof-new-email" className="mb-1 block text-xs text-muted-foreground">
                      New Email Address
                    </label>
                    <input
                      id="prof-new-email"
                      type="email"
                      required
                      maxLength={254}
                      className="field"
                      value={newEmailInput}
                      onChange={(e) => setNewEmailInput(e.target.value)}
                    />
                  </div>
                  {emailFeedback && (
                    <p
                      role="status"
                      className={`rounded-md border px-3 py-2 text-xs ${
                        emailFeedback.type === "ok"
                          ? "border-up/40 bg-up/10 text-up"
                          : "border-destructive/50 bg-destructive/10 text-foreground"
                      }`}
                    >
                      {emailFeedback.text}
                    </p>
                  )}
                  <Button type="submit" variant="outline" size="sm" disabled={emailSaving}>
                    {emailSaving ? "Sending confirmation..." : "Request Email Change"}
                  </Button>
                </form>
              </div>
            </section>
          )}

          {/* SECTION C: MEMBERSHIP */}
          {activeSection === "membership" && (
            <section className="space-y-6" aria-label="Membership">
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-widest text-info">Membership</p>
                    <h2 className="mt-1 text-xl font-semibold text-foreground">{planName}</h2>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 font-mono text-xs font-bold uppercase tracking-wide ${STATE_BADGE[state]}`}
                  >
                    {STATE_LABEL[state]}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {effectiveAccess
                    ? statusMessage(effectiveAccess, state)
                    : "Your membership status is verified against our database records."}
                </p>

                <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border bg-panel p-4">
                    <dt className="text-xs text-muted-foreground">Membership Status</dt>
                    <dd className="mt-1 font-mono text-sm font-semibold text-foreground">
                      {STATE_LABEL[state]}
                    </dd>
                  </div>
                  <div className="rounded-lg border bg-panel p-4">
                    <dt className="text-xs text-muted-foreground">Academy Rental Access</dt>
                    <dd
                      className={`mt-1 font-mono text-sm font-semibold ${
                        isPremiumUnlocked ? "text-up" : "text-muted-foreground"
                      }`}
                    >
                      {isPremiumUnlocked ? "Unlocked (Server Verified)" : "Locked"}
                    </dd>
                  </div>
                  <div className="rounded-lg border bg-panel p-4">
                    <dt className="text-xs text-muted-foreground">Membership Expiry Date</dt>
                    <dd className="mt-1 font-mono text-sm text-foreground">
                      {effectiveAccess?.expires_at
                        ? `${formatIsoDate(effectiveAccess.expires_at)}${
                            remainingDays !== null && state === "active" ? ` (${remainingDays}d left)` : ""
                          }`
                        : "Not set"}
                    </dd>
                  </div>
                </dl>

                {/* Available Features Matrix */}
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border bg-panel p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">
                        Standard Forex Session Tools
                      </h3>
                      <span className="rounded bg-up/15 px-2 py-0.5 font-mono text-[10px] text-up">
                        AVAILABLE
                      </span>
                    </div>
                    <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-up" />
                        Live Sydney, Tokyo, London & New York Session Clock
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-up" />
                        Automatic US, UK & Australia DST Transition Handling
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-up" />
                        Time Zone Converter, Overlap Calculator & UTC-to-Local
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-up" />
                        Saved Timezone Profiles & Multi-Timezone Desk Clocks
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-lg border bg-panel p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">
                        Academy White-Label Rental Features
                      </h3>
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-[10px] ${
                          isPremiumUnlocked
                            ? "bg-up/15 text-up"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {isPremiumUnlocked ? "ACTIVE" : "REQUIRES ACTIVE RENTAL"}
                      </span>
                    </div>
                    <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                      <li className="flex items-center gap-2">
                        {isPremiumUnlocked ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-up" />
                        ) : (
                          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        Custom Academy Brand Name, Page Title & Logo Badge
                      </li>
                      <li className="flex items-center gap-2">
                        {isPremiumUnlocked ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-up" />
                        ) : (
                          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        Custom Primary & Secondary Theme Colors
                      </li>
                      <li className="flex items-center gap-2">
                        {isPremiumUnlocked ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-up" />
                        ) : (
                          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        Custom Session Labels (Killzones) & Session Filtering
                      </li>
                      <li className="flex items-center gap-2">
                        {isPremiumUnlocked ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-up" />
                        ) : (
                          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        Shareable Student Dashboard URL & LMS Iframe Embed
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Active Academy Branding Studio (Server-gated by is_active) */}
              {isPremiumUnlocked && (
                <div className="rounded-xl border bg-card p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        Academy White-Label Branding Studio
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Configure your academy's branded session clock and copy the link for your students. Students do not need individual accounts.
                      </p>
                    </div>
                    <span className="rounded bg-up/15 px-2.5 py-1 font-mono text-xs text-up">
                      Active Rental Feature
                    </span>
                  </div>

                  <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="acad-brand" className="mb-1 block text-xs text-muted-foreground">
                          Displayed Academy Name
                        </label>
                        <input
                          id="acad-brand"
                          className="field"
                          maxLength={100}
                          value={brandDraft.brand ?? ""}
                          onChange={(e) => setBrandDraft((p) => ({ ...p, brand: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label htmlFor="acad-title" className="mb-1 block text-xs text-muted-foreground">
                          Browser Page Title
                        </label>
                        <input
                          id="acad-title"
                          className="field"
                          maxLength={160}
                          value={brandDraft.title ?? ""}
                          onChange={(e) => setBrandDraft((p) => ({ ...p, title: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label htmlFor="acad-logo" className="mb-1 block text-xs text-muted-foreground">
                          Logo Monogram (up to 12 chars) or HTTPS Image URL
                        </label>
                        <input
                          id="acad-logo"
                          className="field"
                          maxLength={2048}
                          placeholder="e.g. APX or https://..."
                          value={brandDraft.logo ?? ""}
                          onChange={(e) => setBrandDraft((p) => ({ ...p, logo: e.target.value }))}
                        />
                      </div>

                      <div>
                        <p className="mb-1.5 text-xs text-muted-foreground">Quick Theme Palettes</p>
                        <div className="flex flex-wrap gap-2">
                          {THEME_PRESETS.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() =>
                                setBrandDraft((p) => ({ ...p, accent: t.accent, accent2: t.accent2 }))
                              }
                              className="flex items-center gap-1.5 rounded border bg-panel px-2.5 py-1 text-xs hover:border-info"
                            >
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: t.accent }}
                              />
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: t.accent2 }}
                              />
                              {t.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex items-center justify-between rounded border bg-panel p-2.5">
                          <label htmlFor="acad-accent" className="text-xs">
                            Primary Color
                          </label>
                          <input
                            id="acad-accent"
                            type="color"
                            value={brandDraft.accent ?? "#34d399"}
                            onChange={(e) => setBrandDraft((p) => ({ ...p, accent: e.target.value }))}
                            className="h-8 w-12 cursor-pointer rounded border bg-panel"
                          />
                        </div>
                        <div className="flex items-center justify-between rounded border bg-panel p-2.5">
                          <label htmlFor="acad-accent2" className="text-xs">
                            Secondary Color
                          </label>
                          <input
                            id="acad-accent2"
                            type="color"
                            value={brandDraft.accent2 ?? "#38bdf8"}
                            onChange={(e) => setBrandDraft((p) => ({ ...p, accent2: e.target.value }))}
                            className="h-8 w-12 cursor-pointer rounded border bg-panel"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor="acad-tz" className="mb-1 block text-xs text-muted-foreground">
                            Default Student Timezone
                          </label>
                          <ZoneSelect
                            id="acad-tz"
                            value={brandDraft.tz ?? "Asia/Kolkata"}
                            extra={brandDraft.tz}
                            onChange={(tz) => setBrandDraft((p) => ({ ...p, tz }))}
                          />
                        </div>
                        <div>
                          <span className="mb-1 block text-xs text-muted-foreground">Clock Format</span>
                          <div className="flex gap-2">
                            {(["24", "12"] as const).map((f) => (
                              <Button
                                key={f}
                                type="button"
                                size="sm"
                                variant={brandDraft.fmt === f ? "default" : "outline"}
                                onClick={() => setBrandDraft((p) => ({ ...p, fmt: f }))}
                              >
                                {f}H
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <fieldset className="space-y-2">
                        <legend className="text-xs text-muted-foreground">
                          Visible Sessions & Custom Academy Labels
                        </legend>
                        {SESSIONS.map((s) => (
                          <div key={s.id} className="flex items-center gap-2">
                            <label className="flex w-28 shrink-0 items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={!brandDraft.sessions || brandDraft.sessions.includes(s.id)}
                                onChange={(e) => {
                                  const ids = brandDraft.sessions ?? SESSIONS.map((x) => x.id);
                                  const next = e.target.checked
                                    ? [...ids, s.id]
                                    : ids.filter((id) => id !== s.id);
                                  if (next.length) setBrandDraft((p) => ({ ...p, sessions: next }));
                                }}
                              />
                              {s.name}
                            </label>
                            <input
                              aria-label={`${s.name} custom label`}
                              className="field py-1 text-xs"
                              maxLength={60}
                              placeholder={`Custom ${s.name} label`}
                              value={brandDraft.labels?.[s.id] ?? ""}
                              onChange={(e) =>
                                setBrandDraft((p) => ({
                                  ...p,
                                  labels: { ...p.labels, [s.id]: e.target.value },
                                }))
                              }
                            />
                          </div>
                        ))}
                      </fieldset>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-lg border bg-panel p-4">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold">Shareable Student Dashboard URL</h4>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void copyText(studentDashboardUrl, "Student dashboard URL")}
                          >
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                            Copy Link
                          </Button>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Share this link with your students on Telegram, WhatsApp, Discord, or your LMS.
                        </p>
                        <input
                          readOnly
                          aria-label="Shareable Student Dashboard URL"
                          className="field mt-2 font-mono text-xs"
                          value={studentDashboardUrl}
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button asChild size="sm">
                            <Link to="/" search={configSearch(cleanBrand)}>
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                              Open Branded Dashboard
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void copyText(
                                `<iframe src="${escapeHtml(studentEmbedUrl)}" title="${escapeHtml(cleanBrand.brand ?? "Academy Session Clock")}" style="width:100%;height:780px;border:0" loading="lazy"></iframe>`,
                                "Embed iframe code",
                              )
                            }
                          >
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                            Copy Embed Code
                          </Button>
                        </div>
                        {copyNotice && (
                          <p role="status" className="mt-2 font-mono text-xs text-info">
                            {copyNotice}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* SECTION D: SUBSCRIPTION DETAILS */}
          {activeSection === "subscription" && (
            <section className="space-y-6" aria-label="Subscription Details">
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <p className="font-mono text-xs uppercase tracking-widest text-info">
                  Subscription Details
                </p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">
                  Subscription Dates & Plan Record
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The details below reflect your live record in the database. Subscription activation and 30-day renewals are calculated by the server clock.
                </p>

                <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border bg-panel p-4">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Subscription Plan
                    </dt>
                    <dd className="mt-1.5 text-base font-semibold text-foreground">{planName}</dd>
                    <dd className="mt-0.5 text-xs text-muted-foreground">
                      30-day access cycle per activation or renewal
                    </dd>
                  </div>

                  <div className="rounded-lg border bg-panel p-4">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Subscription Status
                    </dt>
                    <dd className="mt-1.5 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-xs font-bold uppercase ${STATE_BADGE[state]}`}
                      >
                        {STATE_LABEL[state]}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        (Database status: {effectiveAccess?.status ?? "pending"})
                      </span>
                    </dd>
                  </div>

                  <div className="rounded-lg border bg-panel p-4">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Subscription Start Date (Activated)
                    </dt>
                    <dd className="mt-1.5 font-mono text-sm text-foreground">
                      {effectiveAccess?.activated_at
                        ? formatIsoDateTime(effectiveAccess.activated_at)
                        : "Not yet activated"}
                    </dd>
                  </div>

                  <div className="rounded-lg border bg-panel p-4">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Subscription Expiry Date
                    </dt>
                    <dd className="mt-1.5 font-mono text-sm text-foreground">
                      {effectiveAccess?.expires_at
                        ? formatIsoDateTime(effectiveAccess.expires_at)
                        : "Not set"}
                    </dd>
                    {state === "active" && remainingDays !== null && (
                      <dd className="mt-0.5 font-mono text-xs text-up">
                        {remainingDays} day{remainingDays === 1 ? "" : "s"} remaining
                      </dd>
                    )}
                  </div>
                </dl>

                <div className="mt-6 rounded-lg border bg-panel p-4 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Activation & Renewal Process</p>
                  <p className="mt-1 leading-relaxed">
                    Account activations and 30-day extensions are applied by the administrator after payment verification. To activate a pending account or renew an expiring subscription, contact the administrator.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button asChild size="sm" variant="default">
                      <Link to="/contact">Contact Administrator</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/white-label">View Customization Tiers ($10 / $25)</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SECTION E: PREFERENCES */}
          {activeSection === "preferences" && (
            <section className="space-y-6" aria-label="Preferences">
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <p className="font-mono text-xs uppercase tracking-widest text-info">Preferences</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">
                  Display, Timezone & Clock Preferences
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Customize your preferred timezone, 12-hour or 24-hour clock format, and pinned desk clocks. These preferences remain saved in your browser across page refreshes and apply across the Session Clock and UTC converter.
                </p>

                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="pref-tz" className="mb-1.5 block text-xs text-muted-foreground">
                        Preferred Timezone
                      </label>
                      <ZoneSelect
                        id="pref-tz"
                        value={activeTimezone}
                        extra={activeTimezone}
                        onChange={(tz) => {
                          setPreferredTz(tz);
                          setPrefFeedback(`Preferred timezone updated to ${tz}.`);
                        }}
                      />
                    </div>

                    <div>
                      <span className="mb-1.5 block text-xs text-muted-foreground">
                        Preferred Clock Format
                      </span>
                      <div className="flex gap-2" role="group" aria-label="Preferred clock format">
                        {(["24", "12"] as const).map((v) => (
                          <Button
                            key={v}
                            type="button"
                            size="sm"
                            variant={fmt === v ? "default" : "outline"}
                            aria-pressed={fmt === v}
                            onClick={() => {
                              setFmt(v);
                              setPrefFeedback(`Clock format set to ${v}-hour (${v}H).`);
                            }}
                          >
                            {v}-Hour ({v}H)
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Live Preference Preview Card */}
                  <div className="rounded-lg border bg-panel p-5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 text-info" />
                      <span className="font-mono uppercase">Live Preference Preview · {activeTimezone}</span>
                    </div>
                    <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-up">
                      {now ? formatClockTime(now, activeTimezone, true) : "--:--:--"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {now
                        ? `${formatTzDate(now, activeTimezone)} · ${formatOffset(
                            getOffsetMinutes(now, activeTimezone),
                          )} · Format: ${fmt}H`
                        : "Loading clock..."}
                    </p>
                  </div>
                </div>

                {prefFeedback && (
                  <p role="status" className="mt-4 rounded-md border border-info/40 bg-info/10 px-3 py-2 text-xs text-info">
                    {prefFeedback}
                  </p>
                )}

                {/* Pinned Multi-Timezone Clocks Configuration */}
                <div className="mt-6 border-t pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Pinned Multi-Timezone Desk Clocks
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Choose up to 6 financial centers displayed on your main Session Clock dashboard.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        aria-label="Select timezone to pin"
                        className="field w-auto py-1 text-xs"
                        value={addZoneCandidate}
                        onChange={(e) => setAddZoneCandidate(e.target.value)}
                      >
                        {ZONES.map((z) => (
                          <option key={z.tz} value={z.tz}>
                            {z.label} ({z.tz})
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pinnedZones.includes(addZoneCandidate) || pinnedZones.length >= 6}
                        onClick={() => updatePinnedZones([...pinnedZones, addZoneCandidate])}
                      >
                        + Pin Zone
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {pinnedZones.map((z) => {
                      const zInfo = ZONES.find((item) => item.tz === z);
                      return (
                        <span
                          key={z}
                          className="inline-flex items-center gap-2 rounded-md border bg-panel px-3 py-1.5 font-mono text-xs"
                        >
                          <span>{zInfo ? zInfo.label : z}</span>
                          {pinnedZones.length > 1 && (
                            <button
                              type="button"
                              aria-label={`Remove ${z}`}
                              onClick={() => updatePinnedZones(pinnedZones.filter((item) => item !== z))}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Saved Timezone Profiles */}
                <div className="mt-6 border-t pt-6">
                  <h3 className="text-sm font-semibold text-foreground">Saved Timezone Profiles</h3>
                  <p className="text-xs text-muted-foreground">
                    Save combinations of timezone, 12H/24H format, and pinned clocks for one-click switching.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {savedProfiles.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No saved profiles yet.</span>
                    ) : (
                      savedProfiles.map((p) => (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1.5 rounded-md border bg-panel px-3 py-1.5 text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => handleActivateSavedProfile(p)}
                            className="font-medium text-foreground hover:text-info"
                          >
                            {p.name} ({p.fmt}H · {p.tz})
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete profile ${p.name}`}
                            onClick={() => handleDeleteSavedProfile(p.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      aria-label="New profile name"
                      placeholder="Profile name (e.g. London Session Setup)"
                      maxLength={40}
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      className="field max-w-xs py-1.5 text-xs"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={handleSaveNewTimezoneProfile}>
                      Save Current Setup
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SECTION F: SECURITY */}
          {activeSection === "security" && (
            <section className="space-y-6" aria-label="Security">
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <p className="font-mono text-xs uppercase tracking-widest text-info">Security</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">
                  Password & Authentication Security
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Update your account password or trigger a password reset email via Supabase Auth. Passwords are never stored or logged in plaintext.
                </p>

                <form onSubmit={(e) => void handlePasswordUpdate(e)} className="mt-5 max-w-md space-y-4">
                  <div>
                    <label htmlFor="sec-new-pass" className="mb-1 block text-xs text-muted-foreground">
                      New Password (minimum 8 characters)
                    </label>
                    <input
                      id="sec-new-pass"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={72}
                      className="field"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="sec-confirm-pass" className="mb-1 block text-xs text-muted-foreground">
                      Confirm New Password
                    </label>
                    <input
                      id="sec-confirm-pass"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={72}
                      className="field"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                    />
                  </div>

                  {passwordFeedback && (
                    <p
                      role="status"
                      className={`rounded-md border px-3 py-2 text-xs ${
                        passwordFeedback.type === "ok"
                          ? "border-up/40 bg-up/10 text-up"
                          : "border-destructive/50 bg-destructive/10 text-foreground"
                      }`}
                    >
                      {passwordFeedback.text}
                    </p>
                  )}

                  <Button type="submit" disabled={passwordSaving}>
                    <KeyRound className="mr-1.5 h-4 w-4" />
                    {passwordSaving ? "Updating password..." : "Update Password"}
                  </Button>
                </form>

                {/* Password Reset Email Trigger */}
                <div className="mt-6 border-t pt-6">
                  <h3 className="text-sm font-semibold text-foreground">Password Reset via Email</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Prefer to reset via email? Send a password recovery link to{" "}
                    <span className="font-mono text-foreground">{userEmail}</span>.
                  </p>
                  {resetEmailFeedback && (
                    <p
                      role="status"
                      className={`mt-3 rounded-md border px-3 py-2 text-xs ${
                        resetEmailFeedback.type === "ok"
                          ? "border-up/40 bg-up/10 text-up"
                          : "border-destructive/50 bg-destructive/10 text-foreground"
                      }`}
                    >
                      {resetEmailFeedback.text}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    disabled={resetEmailSending}
                    onClick={() => void handleSendPasswordResetEmail()}
                  >
                    {resetEmailSending ? "Sending reset email..." : "Send Password Reset Email"}
                  </Button>
                </div>
              </div>

              {/* Account Security Information */}
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <h3 className="text-base font-semibold text-foreground">
                  Account Security & Session Details
                </h3>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border bg-panel p-3.5">
                    <dt className="text-xs text-muted-foreground">Authenticated User ID</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-foreground">
                      {session.user.id}
                    </dd>
                  </div>
                  <div className="rounded-lg border bg-panel p-3.5">
                    <dt className="text-xs text-muted-foreground">Last Sign-In</dt>
                    <dd className="mt-1 font-mono text-xs text-foreground">
                      {formatIsoDateTime(session.user.last_sign_in_at)}
                    </dd>
                  </div>
                  <div className="rounded-lg border bg-panel p-3.5">
                    <dt className="text-xs text-muted-foreground">Email Verification Status</dt>
                    <dd className="mt-1 font-mono text-xs text-foreground">
                      {session.user.email_confirmed_at
                        ? `Verified (${formatIsoDate(session.user.email_confirmed_at)})`
                        : "Standard email sign-in"}
                    </dd>
                  </div>
                  <div className="rounded-lg border bg-panel p-3.5">
                    <dt className="text-xs text-muted-foreground">Data Isolation Policy</dt>
                    <dd className="mt-1 font-mono text-xs text-up">
                      Row-Level Security Active (auth.uid() = id)
                    </dd>
                  </div>
                </dl>
                <div className="mt-5">
                  <Button type="button" variant="outline" onClick={() => void signOut()}>
                    <LogOut className="mr-1.5 h-4 w-4" />
                    Sign Out of Current Session
                  </Button>
                </div>
              </div>
            </section>
          )}

          {/* SECTION G: ACCOUNT MANAGEMENT */}
          {activeSection === "account" && (
            <section className="space-y-6" aria-label="Account Management">
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <p className="font-mono text-xs uppercase tracking-widest text-info">
                  Account Management
                </p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">
                  Account Summary & Administration Guidance
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review your complete registered account record and session controls.
                </p>

                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border bg-panel p-4">
                    <dt className="text-xs text-muted-foreground">Display Name</dt>
                    <dd className="mt-1 font-medium text-foreground">{displayName}</dd>
                  </div>
                  <div className="rounded-lg border bg-panel p-4">
                    <dt className="text-xs text-muted-foreground">Academy / Organization</dt>
                    <dd className="mt-1 font-medium text-foreground">{organizationName}</dd>
                  </div>
                  <div className="rounded-lg border bg-panel p-4">
                    <dt className="text-xs text-muted-foreground">Registered Email</dt>
                    <dd className="mt-1 font-mono text-xs text-foreground">{userEmail}</dd>
                  </div>
                  <div className="rounded-lg border bg-panel p-4">
                    <dt className="text-xs text-muted-foreground">Phone & Country</dt>
                    <dd className="mt-1 text-xs text-foreground">
                      {profile?.phone || "No phone set"} · {profile?.country || "No country set"}
                    </dd>
                  </div>
                  <div className="rounded-lg border bg-panel p-4">
                    <dt className="text-xs text-muted-foreground">Account Created</dt>
                    <dd className="mt-1 font-mono text-xs text-foreground">
                      {formatIsoDateTime(createdAtIso)}
                    </dd>
                  </div>
                  <div className="rounded-lg border bg-panel p-4">
                    <dt className="text-xs text-muted-foreground">Membership State</dt>
                    <dd className="mt-1 font-mono text-xs text-foreground">
                      {planName} ({STATE_LABEL[state]})
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 rounded-lg border bg-panel p-4 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Account Closure & Data Requests</p>
                  <p className="mt-1 leading-relaxed">
                    To protect active academy rentals and prevent accidental loss of paid access windows, permanent account deletion is handled through administrator verification rather than automated self-deletion. Contact the administrator to request account archival, data export, or closure.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/contact">Contact Administrator</Link>
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => void signOut()}>
                      <LogOut className="mr-1.5 h-3.5 w-3.5" />
                      Log Out of Account
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SECTION H: ADMINISTRATOR CONSOLE (Protected by server-side is_admin()) */}
          {activeSection === "admin" && isAdmin && (
            <AdminAcademyConsole now={now ?? new Date()} onChanged={refreshAccess} />
          )}
        </div>
      </div>
    </div>
  );
}

function AdminAcademyConsole({
  now,
  onChanged,
}: {
  now: Date;
  onChanged: () => Promise<void>;
}) {
  const [rows, setRows] = useState<AdminAcademyRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [filter, setFilter] = useState<"all" | AccessState>("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);

  const fetchAcademies = useCallback(async () => {
    if (!supabase) return;
    setLoadingRows(true);
    setAdminMessage(null);
    const { data, error } = await supabase
      .from("academies")
      .select(
        "id, email, academy_name, contact_name, phone, country, status, activated_at, expires_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false });
    setLoadingRows(false);
    if (error) {
      setAdminMessage(describeAuthError(error));
      return;
    }
    setRows(parseAdminAcademyList(data));
  }, []);

  useEffect(() => {
    void fetchAcademies();
  }, [fetchAcademies]);

  const handleAction = async (academyId: string, action: AdminAction) => {
    if (!supabase) return;
    setBusyId(academyId);
    setAdminMessage(null);
    const { data, error } = await supabase.rpc("admin_set_academy_access", {
      p_academy_id: academyId,
      p_action: action,
    });
    setBusyId(null);
    if (error) {
      setAdminMessage(describeAuthError(error));
      return;
    }
    setAdminMessage(
      `Successfully applied "${action}" to academy ${
        (data as { academy_name?: string } | null)?.academy_name ?? academyId
      }.`,
    );
    await fetchAcademies();
    await onChanged();
  };

  const filteredRows = rows.filter((r) => {
    const st = adminRowAccessState(r, now);
    if (filter !== "all" && st !== filter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      r.academy_name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.contact_name.toLowerCase().includes(q) ||
      (r.country ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <section
      className="rounded-xl border border-info/50 bg-card p-6 shadow-sm"
      aria-label="Administrator Academy Management"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-info" />
          <h2 className="text-lg font-semibold text-foreground">
            Administrator Control Panel — Registered Academies
          </h2>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void fetchAcademies()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Reload List
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Protected by server-side RLS (<code>public.is_admin()</code>) and <code>public.admin_set_academy_access</code>. Each activation or renewal grants 30 days calculated by the database clock.
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "pending", "active", "expired", "deactivated"] as const).map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? `All (${rows.length})` : STATE_LABEL[f]}
            </Button>
          ))}
        </div>
        <input
          type="search"
          aria-label="Search academies"
          placeholder="Search academy, email, contact..."
          className="field sm:w-64"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {adminMessage && (
        <p
          role="status"
          className="mt-3 rounded border border-info/40 bg-info/10 px-3 py-2 text-xs text-info"
        >
          {adminMessage}
        </p>
      )}

      {loadingRows ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading academies...</p>
      ) : filteredRows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No academies match the current filter.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-2.5">Academy & Contact</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Activated</th>
                <th className="p-2.5">Expires</th>
                <th className="p-2.5 text-right">Actions (Server-enforced)</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const st = adminRowAccessState(row, now);
                const rem = daysRemaining(row, now);
                const isBusy = busyId === row.id;
                return (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="p-2.5">
                      <p className="font-semibold text-foreground">{row.academy_name}</p>
                      <p className="text-muted-foreground">
                        {row.contact_name} · {row.email}
                        {row.country ? ` · ${row.country}` : ""}
                      </p>
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase ${STATE_BADGE[st]}`}
                      >
                        {STATE_LABEL[st]}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono">{formatIsoDate(row.activated_at)}</td>
                    <td className="p-2.5 font-mono">
                      {row.expires_at ? (
                        <>
                          {formatIsoDate(row.expires_at)}{" "}
                          <span className="text-muted-foreground">({rem}d)</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-2.5 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          disabled={isBusy}
                          onClick={() => void handleAction(row.id, "activate")}
                        >
                          Activate (30d)
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => void handleAction(row.id, "renew")}
                        >
                          Renew (+30d)
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={isBusy || row.status === "suspended"}
                          onClick={() => void handleAction(row.id, "deactivate")}
                        >
                          Deactivate
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
