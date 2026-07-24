import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { getWishlist } from "@/lib/wishlist.functions";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";

const wishlistQueryOptions = () =>
  queryOptions({
    queryKey: ["wishlist", "full"],
    queryFn: () => getWishlist({ data: undefined }),
  });

export const Route = createFileRoute("/_authenticated/wishlist")({
  head: () => ({
    meta: [
      { title: "My wishlist — FEALuxy" },
      { name: "description", content: "Your saved FEALuxy favourites." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(wishlistQueryOptions()),
  component: WishlistPage,
});

function WishlistPage() {
  const { data: items } = useSuspenseQuery(wishlistQueryOptions());
  const products = items.map((i) => i.products).filter(Boolean);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container-luxe py-12">
        <div className="flex items-center gap-3">
          <Heart className="h-7 w-7 text-primary" />
          <h1 className="font-serif text-3xl font-light text-foreground md:text-4xl">My wishlist</h1>
        </div>
        <p className="mt-2 text-muted-foreground">{products.length} saved item{products.length === 1 ? "" : "s"}</p>

        {products.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-border py-24 text-center">
            <Heart className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-4 font-serif text-2xl font-light text-foreground">Your wishlist is empty</p>
            <p className="mt-2 text-muted-foreground">Tap the heart on any product to save it here.</p>
            <Button asChild className="btn-gold mt-6"><Link to="/products">Discover products</Link></Button>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {products.map((product, i) => (
              <ProductCard key={(product as any).id} product={product as never} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
