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

  const { data } = useQuery({
    queryKey: ["cart"],
    queryFn: () => getCart({ data: undefined }),
    enabled: authed,
    retry: false,
    throwOnError: false,
    staleTime: 30_000,
  });
  if (!data?.items) return 0;
  return data.items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
}
