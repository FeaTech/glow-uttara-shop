import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RANGE_PRESETS, isCustomRange, parseCustomRange, buildCustomRange, type RangeValue } from "@/lib/date-range";

export function RangeFilter({
  value,
  onChange,
  className,
}: {
  value: RangeValue;
  onChange: (value: RangeValue) => void;
  className?: string;
}) {
  const custom = isCustomRange(value);
  const parsed = custom ? parseCustomRange(value) : null;

  const [fromDate, setFromDate] = useState(parsed?.from ?? "");
  const [toDate, setToDate] = useState(parsed?.to ?? "");

  const selectValue = custom ? "__custom" : value;

  function handleSelectChange(v: string) {
    if (v === "__custom") {
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
      setFromDate(weekAgo);
      setToDate(today);
      onChange(buildCustomRange(weekAgo, today));
    } else {
      onChange(v as RangeValue);
    }
  }

  function applyCustom() {
    if (fromDate && toDate) {
      onChange(buildCustomRange(fromDate, toDate));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={selectValue} onValueChange={handleSelectChange}>
        <SelectTrigger className={className ?? "h-9 w-[170px]"} aria-label="Date range">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGE_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
          <SelectItem value="__custom">Custom range</SelectItem>
        </SelectContent>
      </Select>

      {(custom || selectValue === "__custom") && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-9 w-[140px] text-xs"
            aria-label="From date"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-9 w-[140px] text-xs"
            aria-label="To date"
          />
          <Button size="sm" variant="outline" className="h-9" onClick={applyCustom} disabled={!fromDate || !toDate}>
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}
