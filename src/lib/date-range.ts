/** Shared admin date-range presets (used by dashboard tiles, orders, customers). */
export const RANGE_VALUES = ["7d", "30d", "90d", "365d", "all"] as const;
export type RangeValue = (typeof RANGE_VALUES)[number];

export const RANGE_PRESETS: { value: RangeValue; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "365d", label: "Last 12 months" },
  { value: "all", label: "All time" },
];

export function normalizeRange(value?: string | null): RangeValue {
  return (RANGE_VALUES as readonly string[]).includes(value ?? "") ? (value as RangeValue) : "30d";
}

export function rangeLabel(value?: string | null): string {
  const range = normalizeRange(value);
  return RANGE_PRESETS.find((p) => p.value === range)?.label ?? "Last 30 days";
}

/** Returns the inclusive start ISO timestamp for a range, or null for "all". */
export function rangeStartISO(value?: string | null): string | null {
  const range = normalizeRange(value);
  if (range === "all") return null;
  const days = Number(range.replace("d", ""));
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start.toISOString();
}
