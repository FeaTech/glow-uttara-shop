import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCart } from "@/lib/cart.functions";
import { supabase } from "@/integrations/supabase/client";

/** Total item quantity in the active cart, or 0 when signed out / on error. */
export function useCartCount(): number {
  const [authed, setAuthed] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setAuthed(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      const signedIn = !!session;
      setAuthed(signedIn);
      if (event === "SIGNED_OUT") {
        // Drop the previous account's cart entirely — never show a stale badge.
        queryClient.removeQueries({ queryKey: ["cart"] });
      } else if (signedIn) {
        // The bearer token is now attached; refetch the server-side cart so the
        // badge reflects what is actually stored in Supabase.
        void queryClient.invalidateQueries({ queryKey: ["cart"] });
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const { data } = useQuery({
    queryKey: ["cart"],
    queryFn: () => getCart({ data: undefined }),
    enabled: authed,
    retry: 1,
    throwOnError: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  if (!authed || !data?.items) return 0;
  return data.items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
}
