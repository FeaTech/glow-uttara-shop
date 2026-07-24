import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Global realtime for the signed-in shopper. Keeps the cart, orders, and
 * wishlist in sync live (across tabs, devices, and admin-driven status changes)
 * by invalidating the relevant React Query caches on Postgres changes.
 * Renders nothing.
 */
export function RealtimeProvider() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setUserId(data.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUserId(session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const invalidate = (key: unknown[]) => queryClient.invalidateQueries({ queryKey: key });

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const pg = "postgres_changes" as any;
    const channel = supabase
      .channel(`realtime-user-${userId}`)
      // Cart (items scoped to the user's cart via RLS).
      .on(pg, { event: "*", schema: "public", table: "cart_items" } as any, () => invalidate(["cart"]))
      .on(pg, { event: "*", schema: "public", table: "cart" } as any, () => invalidate(["cart"]))
      // Orders — live status/payment updates pushed by admins.
      .on(
        pg,
        { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${userId}` } as any,
        () => invalidate(["orders"]),
      )
      // Wishlist — sync across tabs/devices.
      .on(
        pg,
        { event: "*", schema: "public", table: "wishlist_items", filter: `user_id=eq.${userId}` } as any,
        () => {
          invalidate(["wishlist", "ids"]);
          invalidate(["wishlist", "full"]);
        },
      )
      .subscribe();
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return null;
}
