import { useEffect, useState } from "react";

const KEY = "fealuxy:recently-viewed";
const MAX = 12;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Record a viewed product id at the front of the recently-viewed list. */
export function recordProductView(id: string) {
  if (typeof window === "undefined") return;
  const ids = [id, ...read().filter((x) => x !== id)].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage full / disabled — ignore */
  }
}

/** Client-only list of recently viewed product ids (empty during SSR). */
export function useRecentlyViewedIds(): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => setIds(read()), []);
  return ids;
}
