import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Heart, Minus, Plus, ShoppingBag, Truck, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { getProductBySlug, getRelatedProducts } from "@/lib/products.functions";
import { addToCart } from "@/lib/cart.functions";
import { listReviews, submitReview } from "@/lib/reviews.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RatingStars, StarInput } from "@/components/RatingStars";
import { ProductCard } from "@/components/ProductCard";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { recordProductView } from "@/hooks/use-recently-viewed";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { useWishlist } from "@/hooks/use-wishlist";
import { discountPercent, formatDate, formatINR, PLACEHOLDER_IMAGE } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";
import { cn } from "@/lib/utils";

const productQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["products", slug],
    queryFn: () => getProductBySlug({ data: { slug } }),
  });

type ProductLoaderData = Awaited<ReturnType<typeof getProductBySlug>>;

export const Route = createFileRoute("/products/$slug")({
  head: ({ loaderData }) => {
    const product = loaderData as unknown as ProductLoaderData | undefined;
    return {
      meta: product
        ? [
            { title: `${product.name} — FEA Glam` },
            { name: "description", content: product.short_description ?? product.description ?? `Shop ${product.name} at FEA Glam.` },
            { property: "og:title", content: `${product.name} — FEA Glam` },
            { property: "og:type", content: "product" },
          ]
        : [],
    };
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(productQueryOptions(params.slug)),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data: product } = useSuspenseQuery(productQueryOptions(slug));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToCartFn = useServerFn(addToCart);
  const { isWishlisted, toggle } = useWishlist();

  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>();
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (product?.id) recordProductView(product.id);
  }, [product?.id]);

  const variantList = product?.product_variants ?? [];
  useEffect(() => {
    if (!variantList.length) return;
    setSelectedVariantId((cur) => {
      if (cur && variantList.some((v) => v.id === cur)) return cur;
      return (variantList.find((v) => (v.stock ?? 0) > 0) ?? variantList[0]).id;
    });
  }, [product?.id, variantList.length]);


  const addMutation = useMutation({
    mutationFn: addToCartFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Added to cart");
    },
    onError: (err: any) => {
      if (err?.message?.includes("Unauthorized")) {
        toast.error("Please sign in to shop");
        navigate({ to: "/auth" });
      } else {
        toast.error(err?.message ?? "Could not add to cart");
      }
    },
  });

  if (!product) {
    return (
      <div className="container-luxe grid min-h-[60vh] place-items-center text-center">
        <div>
          <h1 className="font-serif text-3xl font-light text-foreground">Product not found</h1>
          <Button asChild className="btn-gold mt-6"><Link to="/products">Back to shop</Link></Button>
        </div>
      </div>
    );
  }

  const variants = product.product_variants ?? [];
  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const price = selectedVariant?.price_inr ?? product.price_inr ?? 0;
  // Discounts always compare against the selected variant's own MRP; only fall
  // back to the product-level compare price when no variant is selected.
  const compare = selectedVariant
    ? ((selectedVariant as any).compare_price_inr ?? null)
    : product.compare_price_inr;
  const baseUnit = ((product as any).base_unit as string | null) ?? null;
  const unitLabel = selectedVariant?.variant_name ?? baseUnit;
  const off = discountPercent(price, compare);
  const productImages = (product.images as string[] | undefined) ?? [];
  const images = productImages.length ? productImages : [PLACEHOLDER_IMAGE];
  const stock = selectedVariant?.stock ?? product.stock ?? 0;
  const outOfStock = stock <= 0;
  const attributes = (product.attributes ?? {}) as Record<string, string>;
  const wishlisted = isWishlisted(product.id);

  const doAdd = (goToCheckout = false) => {
    addMutation.mutate(
      { data: { productId: product.id, variantId: selectedVariantId, quantity } },
      { onSuccess: () => goToCheckout && navigate({ to: "/checkout" }) },
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container-luxe py-6">
        <nav className="text-sm text-muted-foreground">
          <Link to="/products" className="hover:text-foreground">Shop</Link>
          {product.categories?.slug && (
            <>
              <span className="mx-2">/</span>
              <Link to="/products" search={{ category: product.categories.slug }} className="hover:text-foreground">
                {product.categories.name}
              </Link>
            </>
          )}
          <span className="mx-2">/</span>
          <span className="text-foreground">{product.name}</span>
        </nav>

        <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* Gallery */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="group relative aspect-square overflow-hidden rounded-2xl bg-muted">
              <ProductImage
                src={images[activeImage]}
                alt={product.name}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              {off !== null && (
                <Badge className="absolute left-4 top-4 bg-foreground text-background">{off}% off</Badge>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-4 flex gap-3">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={cn(
                      "h-20 w-20 overflow-hidden rounded-lg border-2 transition-colors",
                      activeImage === i ? "border-primary" : "border-transparent hover:border-border",
                    )}
                  >
                    <ProductImage src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col">
            {product.categories?.name && (
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{product.categories.name}</p>
            )}
            <h1 className="mt-2 font-serif text-4xl font-light text-foreground">{product.name}</h1>

            {variants.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedVariant ? (
                  <>Size: <span className="font-medium text-foreground">{selectedVariant.variant_name}</span></>
                ) : (
                  <>Available in {variants.map((v) => v.variant_name).join(" · ")}</>
                )}
              </p>
            )}

            {product.rating_count > 0 && (
              <div className="mt-3">
                <RatingStars value={product.rating_avg} count={product.rating_count} size="md" showValue />
              </div>
            )}

            <div className="mt-5 flex items-center gap-3">
              <span className="text-3xl font-semibold text-foreground">{formatINR(price)}</span>
              {selectedVariant && (
                <span className="text-sm text-muted-foreground">/ {selectedVariant.variant_name}</span>
              )}
              {off !== null && (
                <>
                  <span className="text-lg text-muted-foreground line-through">{formatINR(compare)}</span>
                  <Badge variant="secondary" className="text-primary">Save {off}%</Badge>
                </>
              )}
            </div>


            {product.short_description && (
              <p className="mt-4 text-muted-foreground">{product.short_description}</p>
            )}

            {/* Stock */}
            <div className="mt-5 text-sm">
              {outOfStock ? (
                <span className="font-medium text-destructive">Out of stock</span>
              ) : stock <= 10 ? (
                <span className="font-medium text-primary">Only {stock} left in stock — order soon</span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="h-4 w-4" /> In stock
                </span>
              )}
            </div>

            {variants.length > 0 && (
              <div className="mt-6">
                <div className="flex items-baseline justify-between">
                  <label className="text-sm font-medium text-foreground">
                    Size / Variant
                    {selectedVariant && <span className="ml-2 text-muted-foreground">{selectedVariant.variant_name}</span>}
                  </label>
                  <span className="text-xs text-muted-foreground">{variants.length} options</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {variants.map((v) => {
                    const soldOut = (v.stock ?? 0) <= 0;
                    const active = v.id === selectedVariantId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={soldOut}
                        onClick={() => setSelectedVariantId(v.id)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-input text-muted-foreground hover:border-primary/60 hover:text-foreground",
                          soldOut && "cursor-not-allowed line-through opacity-50",
                        )}
                      >
                        <span className="font-medium">{v.variant_name}</span>
                        <span className="ml-2">{formatINR(v.price_inr ?? product.price_inr ?? 0)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}


            {/* Quantity + actions */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-md border border-input">
                <button type="button" className="grid h-11 w-11 place-items-center text-foreground transition-colors hover:bg-secondary" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center font-medium text-foreground">{quantity}</span>
                <button type="button" className="grid h-11 w-11 place-items-center text-foreground transition-colors hover:bg-secondary" onClick={() => setQuantity((q) => Math.min(99, q + 1))} aria-label="Increase">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <Button size="lg" className="btn-gold flex-1 sm:flex-none" onClick={() => doAdd(false)} disabled={addMutation.isPending || outOfStock}>
                <ShoppingBag className="h-4 w-4" />
                {addMutation.isPending ? "Adding…" : "Add to cart"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                aria-label="Add to wishlist"
                onClick={() => toggle(product.id)}
                className={cn(wishlisted && "border-primary text-primary")}
              >
                <Heart className={cn("h-5 w-5", wishlisted && "fill-primary")} />
              </Button>
            </div>
            <Button size="lg" variant="secondary" className="mt-3" onClick={() => doAdd(true)} disabled={addMutation.isPending || outOfStock}>
              Buy it now
            </Button>

            {/* Assurance */}
            <div className="mt-8 grid grid-cols-3 gap-3 rounded-xl bg-secondary/40 p-4 text-center text-xs text-muted-foreground">
              <div className="flex flex-col items-center gap-1"><Truck className="h-5 w-5 text-primary" /> Free shipping over ₹999</div>
              <div className="flex flex-col items-center gap-1"><RefreshCw className="h-5 w-5 text-primary" /> 7-day returns</div>
              <div className="flex flex-col items-center gap-1"><ShieldCheck className="h-5 w-5 text-primary" /> Authentic guaranteed</div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="description" className="mt-8">
              <TabsList>
                <TabsTrigger value="description">Description</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>
              <TabsContent value="description" className="mt-4 leading-relaxed text-muted-foreground">
                {product.description ?? "No description available."}
              </TabsContent>
              <TabsContent value="details" className="mt-4">
                {Object.keys(attributes).length ? (
                  <dl className="divide-y divide-border">
                    {Object.entries(attributes).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-2 text-sm">
                        <dt className="capitalize text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                        <dd className="font-medium text-foreground">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">No additional details.</p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Reviews */}
        <ReviewsSection productId={product.id} ratingAvg={product.rating_avg} ratingCount={product.rating_count} slug={slug} />

        {/* Related */}
        <RelatedProducts productId={product.id} categoryId={product.category_id} />

        {/* Recently viewed */}
        <RecentlyViewed excludeId={product.id} />
      </div>
    </div>
  );
}

function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => mounted && setSignedIn(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => mounted && setSignedIn(Boolean(s)));
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);
  return signedIn;
}

function ReviewsSection({ productId, ratingAvg, ratingCount, slug }: { productId: string; ratingAvg: number; ratingCount: number; slug: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const signedIn = useSignedIn();
  const submitFn = useServerFn(submitReview);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: reviews } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: () => listReviews({ data: { productId } }),
  });

  // Live-update reviews and the product's rating as others post/edit them.
  useRealtimeInvalidate({
    channel: `reviews-${productId}`,
    table: "reviews",
    filter: `product_id=eq.${productId}`,
    invalidate: [["reviews", productId], ["products", slug]],
  });

  const breakdown = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    (reviews ?? []).forEach((r) => { counts[5 - r.rating] += 1; });
    return counts; // index 0 = 5 stars
  }, [reviews]);

  const mutation = useMutation({
    mutationFn: submitFn,
    onSuccess: () => {
      toast.success("Thanks for your review!");
      setShowForm(false); setRating(0); setTitle(""); setBody("");
      queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
      queryClient.invalidateQueries({ queryKey: ["products", slug] });
    },
    onError: (err: any) => {
      if (err?.message?.includes("Unauthorized")) { navigate({ to: "/auth" }); return; }
      toast.error(err?.message ?? "Could not submit review");
    },
  });

  const total = reviews?.length ?? ratingCount;

  return (
    <section id="reviews" className="mt-16 border-t border-border pt-12">
      <h2 className="font-serif text-3xl font-light text-foreground">Customer reviews</h2>

      <div className="mt-8 grid gap-10 lg:grid-cols-[280px_1fr]">
        {/* Summary */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-5xl text-foreground">{(ratingAvg || 0).toFixed(1)}</span>
            <span className="text-muted-foreground">/ 5</span>
          </div>
          <RatingStars value={ratingAvg} size="md" className="mt-2" />
          <p className="mt-1 text-sm text-muted-foreground">{total} review{total === 1 ? "" : "s"}</p>

          <div className="mt-5 space-y-1.5">
            {breakdown.map((count, i) => {
              const star = 5 - i;
              const pct = total ? (count / total) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-6 text-muted-foreground">{star}★</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>

          <Button
            className="btn-gold mt-6 w-full"
            onClick={() => (signedIn ? setShowForm((v) => !v) : navigate({ to: "/auth" }))}
          >
            Write a review
          </Button>
        </div>

        {/* List + form */}
        <div>
          {showForm && (
            <form
              onSubmit={(e) => { e.preventDefault(); if (!rating) return toast.error("Please select a rating"); mutation.mutate({ data: { productId, rating, title, body } }); }}
              className="card-luxe mb-8 space-y-4 p-6"
            >
              <div>
                <label className="text-sm font-medium text-foreground">Your rating</label>
                <StarInput value={rating} onChange={setRating} className="mt-2" />
              </div>
              <Input placeholder="Review title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea placeholder="Share your experience…" value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
              <div className="flex gap-2">
                <Button type="submit" className="btn-gold" disabled={mutation.isPending}>
                  {mutation.isPending ? "Submitting…" : "Submit review"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          )}

          {!reviews || reviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
              No reviews yet. Be the first to review this product.
            </div>
          ) : (
            <ul className="space-y-6">
              {reviews.map((r) => (
                <li key={r.id} className="border-b border-border pb-6 last:border-0">
                  <div className="flex items-center justify-between">
                    <RatingStars value={r.rating} />
                    {r.is_verified && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5" /> Verified buyer
                      </span>
                    )}
                  </div>
                  {r.title && <p className="mt-2 font-medium text-foreground">{r.title}</p>}
                  {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {r.author_name || "Anonymous"} · {formatDate(r.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function RelatedProducts({ productId, categoryId }: { productId: string; categoryId: string | null }) {
  const { data: related } = useQuery({
    queryKey: ["products", "related", productId],
    queryFn: () => getRelatedProducts({ data: { productId, categoryId, limit: 4 } }),
  });

  if (!related || related.length === 0) return null;

  return (
    <section className="mt-16 border-t border-border pt-12">
      <h2 className="font-serif text-3xl font-light text-foreground">You may also like</h2>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {related.map((product, i) => (
          <ProductCard key={product.id} product={product as never} index={i} />
        ))}
      </div>
    </section>
  );
}
