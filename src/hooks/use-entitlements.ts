import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { parseEntitlements, parsePlans } from "@/lib/plans";

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("sort_order");
      if (error) throw error;
      return parsePlans(data);
    },
  });
}

export function useEntitlements() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  return useQuery({
    queryKey: ["entitlements", userId],
    enabled: userId !== null,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_entitlements");
      if (error) throw error;
      return parseEntitlements(data);
    },
  });
}
