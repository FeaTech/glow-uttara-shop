import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RealtimeConfig {
  /** Unique channel name (one websocket channel per name). */
  channel: string;
  table: string;
  /** PostgREST-style filter, e.g. `product_id=eq.<uuid>`. */
  filter?: string;
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
  /** Query keys to invalidate whenever a matching change arrives. */
  invalidate: QueryKey[];
  enabled?: boolean;
}

/**
 * Subscribe to Postgres changes on a table and invalidate the given React Query
 * keys when a change arrives. RLS scopes the events to rows the signed-in user
 * can see. No-ops during SSR.
 */
export function useRealtimeInvalidate({
  channel,
  table,
  filter,
  event = "*",
  invalidate,
  enabled = true,
}: RealtimeConfig) {
  const queryClient = useQueryClient();
  const keysKey = JSON.stringify(invalidate);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const keys = JSON.parse(keysKey) as QueryKey[];

    const ch = supabase
      .channel(channel)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event, schema: "public", table, ...(filter ? { filter } : {}) } as any,
        () => keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key })),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [channel, table, filter, event, enabled, keysKey, queryClient]);
}
