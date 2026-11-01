import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  parseAcademyAccess,
  parseAcademyProfileRow,
  type AcademyAccess,
  type AcademyProfileRow,
} from "@/lib/academy-access";

type AuthState = {
  session: Session | null;
  access: AcademyAccess | null;
  profile: AcademyProfileRow | null;
  isAdmin: boolean;
  accessError: boolean;
  loading: boolean;
  refreshAccess: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<AcademyAccess | null>(null);
  const [profile, setProfile] = useState<AcademyProfileRow | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessError, setAccessError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const requestCounterRef = useRef(0);

  const loadAccountState = useCallback(async (activeSession: Session | null) => {
    const reqId = ++requestCounterRef.current;
    if (!supabase || !activeSession) {
      setAccess(null);
      setProfile(null);
      setIsAdmin(false);
      setAccessError(false);
      setLoading(false);
      return;
    }
    try {
      const [accessRes, profileRes, adminRes] = await Promise.all([
        supabase.rpc("get_my_academy_access").maybeSingle(),
        supabase
          .from("academies")
          .select(
            "id, email, academy_name, contact_name, phone, country, status, activated_at, expires_at, created_at, updated_at",
          )
          .eq("id", activeSession.user.id)
          .maybeSingle(),
        supabase.rpc("is_admin"),
      ]);
      // Ignore stale responses if a newer auth state change occurred
      if (reqId !== requestCounterRef.current) return;
      const parsedAccess = accessRes.error ? null : parseAcademyAccess(accessRes.data);
      const parsedProfile = profileRes.error ? null : parseAcademyProfileRow(profileRes.data);
      setAccess(parsedAccess);
      setProfile(parsedProfile);
      setIsAdmin(Boolean(!adminRes.error && adminRes.data === true));
      setAccessError(parsedAccess === null && parsedProfile === null && !adminRes.data);
    } catch {
      if (reqId !== requestCounterRef.current) return;
      setAccess(null);
      setProfile(null);
      setIsAdmin(false);
      setAccessError(true);
    } finally {
      if (reqId === requestCounterRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;
    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      if (event === "TOKEN_REFRESHED") return;
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => {
      requestCounterRef.current++;
      data.subscription.unsubscribe();
    };
  }, [loadAccountState]);

  // Auth callbacks must return before starting requests that need the auth lock.
  useEffect(() => {
    if (authReady) void loadAccountState(session);
  }, [authReady, session, loadAccountState]);

  const refreshAccess = useCallback(async () => {
    await loadAccountState(session);
  }, [loadAccountState, session]);

  const signOut = useCallback(async () => {
    requestCounterRef.current++;
    setSession(null);
    setAccess(null);
    setProfile(null);
    setIsAdmin(false);
    setAccessError(false);
    await supabase?.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      access,
      profile,
      isAdmin,
      accessError,
      loading,
      refreshAccess,
      signOut,
    }),
    [session, access, profile, isAdmin, accessError, loading, refreshAccess, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
