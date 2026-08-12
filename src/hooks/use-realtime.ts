import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RealtimeConfig {
  /** Unique channel name. One websocket channel is opened per name. */
  channel: string;
  /**
   * Table to watch, or several tables to watch on the SAME channel. Passing an
   * array avoids opening a separate websocket channel per table — each channel
   * costs a subscription and its own WAL polling on the database side.
   */
  table: string | string[];
  /** PostgREST-style filter, e.g. `product_id=eq.<uuid>`. Applies to all tables. */
  filter?: string;
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
  /** Query keys to invalidate whenever a matching change arrives. */
  invalidate: QueryKey[];
  enabled?: boolean;
}

/**
 * Subscribe to Postgres changes and invalidate the given React Query keys when
 * a change arrives. RLS scopes the events to rows the signed-in user can see.
 * No-ops during SSR.
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
  const tablesKey = JSON.stringify(Array.isArray(table) ? table : [table]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const keys = JSON.parse(keysKey) as QueryKey[];
    const tables = JSON.parse(tablesKey) as string[];

    const invalidateAll = () =>
      keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const pg = "postgres_changes" as any;
    let ch = supabase.channel(channel);
    for (const t of tables) {
      ch = ch.on(
        pg,
        { event, schema: "public", table: t, ...(filter ? { filter } : {}) } as any,
        invalidateAll,
      );
    }
    ch.subscribe();
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [channel, tablesKey, filter, event, enabled, keysKey, queryClient]);
}
