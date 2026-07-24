import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  value: number;
  count?: number;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  className?: string;
}

const sizes = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-5 w-5" };

/** Read-only star rating with partial-fill via a clipped overlay. */
export function RatingStars({ value, count, size = "sm", showValue, className }: RatingStarsProps) {
  const clamped = Math.max(0, Math.min(5, value));
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="relative inline-flex">
        <div className="flex text-muted-foreground/40">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className={cn(sizes[size], "fill-current")} />
          ))}
        </div>
        <div
          className="absolute inset-0 flex overflow-hidden text-primary"
          style={{ width: `${(clamped / 5) * 100}%` }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className={cn(sizes[size], "shrink-0 fill-current")} />
          ))}
        </div>
      </div>
      {showValue && clamped > 0 && (
        <span className="text-xs font-medium text-foreground">{clamped.toFixed(1)}</span>
      )}
      {typeof count === "number" && (
        <span className="text-xs text-muted-foreground">
          {count > 0 ? `(${count})` : "No reviews"}
        </span>
      )}
    </div>
  );
}

interface StarInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

/** Interactive star picker for the review form. */
export function StarInput({ value, onChange, className }: StarInputProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={cn(
              "h-7 w-7 transition-colors",
              star <= value ? "fill-primary text-primary" : "fill-transparent text-muted-foreground/50",
            )}
          />
        </button>
      ))}
    </div>
  );
}
