import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as cloudClient } from "@/integrations/supabase/client";

// One Cloud client for account pages and server-function bearer attachment.
// The managed client uses VITE_SUPABASE_PUBLISHABLE_KEY and preview-safe storage.
export const supabase: SupabaseClient = cloudClient;
