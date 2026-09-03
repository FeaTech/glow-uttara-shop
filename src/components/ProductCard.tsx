import { Link } from "@tanstack/react-router";
import { ShoppingBag, SlidersHorizontal } from "lucide-react";
import { useAddToCart } from "@/hooks/use-add-to-cart";
import { RatingStars } from "@/components/RatingStars";
import { WishlistButton } from "@/components/WishlistButton";
import { discountPercent, formatINR, productImage } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";
import { cn } from "@/lib/utils";
import { COLLECTION_BY_KEY } from "@/lib/collections";

export interface ProductCardProduct {
  id: string;
  slug: string;
  name: string;
  price_inr: number | null;
  compare_price_inr?: number | null;
  images?: unknown;
  stock?: number;
  is_featured?: boolean;
  product_type?: "regular" | "organic" | "korean" | "budget" | null;
  rating_avg?: number;
  rating_count?: number;
  categories?: { name?: string | null } | null;
  product_variants?: { id: string }[] | null;
}


export function ProductCard({ product, index = 0 }: { product: ProductCardProduct; index?: number }) {
  const price = product.price_inr ?? 0;
  const compare = product.compare_price_inr;
  const off = discountPercent(price, compare);
  const image = productImage(product.images);
  const outOfStock = typeof product.stock === "number" && product.stock <= 0;
  const hasVariants = (product.product_variants?.length ?? 0) > 0;

  // Optimistic — the cart badge updates on click, not after two round trips.
  const addMutation = useAddToCart();


  return (
    <div
      className="group card-luxe card-hover relative flex flex-col overflow-hidden"
      style={{ animation: `var(--animate-fade-up)`, animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <WishlistButton productId={product.id} productName={product.name} />

      <Link
        to="/products/$slug"
        params={{ slug: product.slug }}
        className="relative block aspect-square overflow-hidden bg-muted"
      >
        <ProductImage
          src={image}
          alt={product.name}
          loading="lazy"
          className={cn(
            "h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.08]",
            outOfStock && "opacity-70",
          )}
        />

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          {product.is_featured && (
            <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm">
              Featured
            </span>
          )}
          {product.product_type && COLLECTION_BY_KEY[product.product_type] && (
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide shadow-sm",
                COLLECTION_BY_KEY[product.product_type].badgeClass,
              )}
            >
              {COLLECTION_BY_KEY[product.product_type].badgeLabel}
            </span>
          )}
          {off !== null && (
            <span className="rounded-full bg-foreground px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-background shadow-sm">
              {off}% off
            </span>
          )}
        </div>

        {outOfStock && (
          <div className="absolute inset-0 grid place-items-center bg-background/40">
            <span className="rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground">
              Out of stock
            </span>
          </div>
        )}

      </Link>

      <Link
        to="/products/$slug"
        params={{ slug: product.slug }}
        className="flex flex-1 flex-col p-4"
      >
        {product.categories?.name && (
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {product.categories.name}
          </p>
        )}
        <h3 className="mt-1 line-clamp-2 font-medium leading-snug text-foreground transition-colors group-hover:text-primary">
          {product.name}
        </h3>
        {typeof product.rating_count === "number" && product.rating_count > 0 && (
          <RatingStars value={product.rating_avg ?? 0} count={product.rating_count} className="mt-2" />
        )}
        <div className="mt-auto flex items-center gap-2 pt-3">
          <span className="font-semibold text-foreground">{formatINR(price)}</span>
          {off !== null && (
            <span className="text-sm text-muted-foreground line-through">{formatINR(compare)}</span>
          )}
        </div>
      </Link>

      {/* Quick add / Options — always visible below the price */}
      {!outOfStock && (
        <div className="px-4 pb-4">
          {hasVariants ? (
            <Link
              to="/products/$slug"
              params={{ slug: product.slug }}
              className="btn-gold flex w-full items-center justify-center gap-2 py-2 text-sm"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Options
            </Link>
          ) : (
            <button
              type="button"
              disabled={addMutation.isPending}
              onClick={() => addMutation.mutate({ product, quantity: 1 })}
              className="btn-gold flex w-full items-center justify-center gap-2 py-2 text-sm"
            >
              <ShoppingBag className="h-4 w-4" />
              {addMutation.isPending ? "Adding…" : "Quick add"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
