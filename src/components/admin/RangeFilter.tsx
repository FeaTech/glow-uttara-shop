import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RANGE_PRESETS, type RangeValue } from "@/lib/date-range";

export function RangeFilter({
  value,
  onChange,
  className,
}: {
  value: RangeValue;
  onChange: (value: RangeValue) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as RangeValue)}>
      <SelectTrigger className={className ?? "h-9 w-[170px]"} aria-label="Date range">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {RANGE_PRESETS.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
