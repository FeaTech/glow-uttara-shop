/** Shared admin date-range presets (used by dashboard tiles, orders, customers). */
export const RANGE_VALUES = ["7d", "30d", "90d", "365d", "all"] as const;
export type RangeValue = (typeof RANGE_VALUES)[number] | `custom:${string}`;

export const RANGE_PRESETS: { value: string; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "365d", label: "Last 12 months" },
  { value: "all", label: "All time" },
];

export function isCustomRange(value?: string | null): boolean {
  return typeof value === "string" && value.startsWith("custom:");
}

export function parseCustomRange(value: string): { from: string; to: string } | null {
  if (!value.startsWith("custom:")) return null;
  const [from, to] = value.slice(7).split(",");
  if (!from || !to) return null;
  return { from, to };
}

export function buildCustomRange(from: string, to: string): RangeValue {
  return `custom:${from},${to}` as RangeValue;
}

export function normalizeRange(value?: string | null): RangeValue {
  if (typeof value === "string" && value.startsWith("custom:")) {
    const parsed = parseCustomRange(value);
    if (parsed) return value as RangeValue;
  }
  return (RANGE_VALUES as readonly string[]).includes(value ?? "") ? (value as RangeValue) : "30d";
}

export function rangeLabel(value?: string | null): string {
  if (isCustomRange(value)) {
    const parsed = parseCustomRange(value!);
    if (parsed) return `${parsed.from} – ${parsed.to}`;
  }
  const range = normalizeRange(value);
  return RANGE_PRESETS.find((p) => p.value === range)?.label ?? "Last 30 days";
}

/** Parse "YYYY-MM-DD" into a local Date (avoids UTC interpretation of date-only strings). */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Returns { start, end } ISO timestamps for a range. All presets include today. */
export function rangeInterval(value?: string | null): { start: string | null; end: string | null } {
  if (isCustomRange(value)) {
    const parsed = parseCustomRange(value!);
    if (parsed) {
      const start = parseLocalDate(parsed.from);
      start.setHours(0, 0, 0, 0);
      const end = parseLocalDate(parsed.to);
      end.setHours(23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }
  }
  const range = normalizeRange(value);
  if (range === "all") return { start: null, end: null };

  // End of today (23:59:59.999) ensures today is always included
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  // Start at midnight N-1 days ago so that the range spans exactly N days including today
  const days = Number((range as string).replace("d", ""));
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  return { start: start.toISOString(), end: end.toISOString() };
}

/** Returns the inclusive start ISO timestamp for a range, or null for "all". */
export function rangeStartISO(value?: string | null): string | null {
  const range = normalizeRange(value);
  if (range === "all" || isCustomRange(range)) return null;
  const days = Number((range as string).replace("d", ""));
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start.toISOString();
}
