import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/hooks/use-wishlist";

interface WishlistButtonProps {
  productId: string;
  /** Product name — used to give every wishlist button a unique accessible label. */
  productName?: string;
  variant?: "floating" | "inline";
  className?: string;
}

export function WishlistButton({ productId, productName, variant = "floating", className }: WishlistButtonProps) {
  const { isWishlisted, toggle, pendingId } = useWishlist();
  const active = isWishlisted(productId);
  const pending = pendingId === productId;

  const base =
    variant === "floating"
      ? "absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full glass shadow-sm"
      : "inline-grid h-11 w-11 place-items-center rounded-md border border-input";

  const target = productName ? `${productName}` : `product ${productId.slice(0, 8)}`;

  return (
    <button
      type="button"
      data-product-id={productId}
      aria-label={active ? `Remove ${target} from wishlist` : `Add ${target} to wishlist`}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(productId);
      }}
      className={cn(
        base,
        "transition-all duration-200 hover:scale-110 active:scale-95",
        pending && "opacity-60",
        className,
      )}
    >
      <Heart
        className={cn(
          "h-[18px] w-[18px] transition-colors",
          active ? "fill-primary text-primary" : "text-foreground/70",
        )}
      />
    </button>
  );
}
