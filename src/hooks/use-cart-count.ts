import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCart } from "@/lib/cart.functions";
import { supabase } from "@/integrations/supabase/client";

/** Total item quantity in the active cart, or 0 when signed out / on error. */
export function useCartCount(): number {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const cartQuery = useQuery({
    queryKey: ["cart"],
    queryFn: () => getCart({ data: undefined }),
    enabled: authed,
    retry: false,
    throwOnError: false,
    // A session can change while the header stays mounted. Always revalidate
    // when it becomes enabled so an old signed-out cache is never shown.
    staleTime: 0,
    refetchOnMount: "always",
  });
  useEffect(() => {
    if (authed) void cartQuery.refetch();
  }, [authed, cartQuery.refetch]);
  const { data } = cartQuery;
  if (!data?.items) return 0;
  return data.items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
}
