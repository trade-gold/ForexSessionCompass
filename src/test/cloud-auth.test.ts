import { describe, expect, it, vi } from "vitest";

const { client } = vi.hoisted(() => ({ client: { auth: {}, rpc: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: client }));
import { supabase } from "@/lib/supabase";
import { describeAuthError } from "@/lib/auth-messages";

describe("Cloud account configuration", () => {
  it("uses the managed publishable-key client even without the legacy anon variable", () => {
    expect(supabase).toBe(client);
  });
  it("recognizes structured Cloud credential errors", () => {
    expect(describeAuthError({ message: "Invalid login credentials", code: "invalid_credentials" })).toBe("Email or password is incorrect.");
  });
  it("recognizes email provider disabled errors", () => {
    expect(describeAuthError({ code: "email_provider_disabled" })).toBe("Email sign-in is currently unavailable. Please contact the site owner.");
  });
  it("recognizes confirmation-required errors", () => {
    expect(describeAuthError({ code: "email_not_confirmed", message: "Email not confirmed" })).toContain("hasn't been confirmed");
  });
});