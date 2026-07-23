import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getProductBySlug } from "@/lib/products.functions";
import { addToCart } from "@/lib/cart.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const productQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["products", slug],
    queryFn: () => getProductBySlug({ data: { slug } }),
  });

type ProductLoaderData = Awaited<ReturnType<typeof getProductBySlug>>;

export const Route = createFileRoute("/products/$slug")({
  head: ({ loaderData }) => {
    const product = (loaderData as unknown) as ProductLoaderData | undefined;
    return {
      meta: product
        ? [
            { title: `${product.name} — FEALuxy` },
            { name: "description", content: product.description ?? `Shop ${product.name} at FEALuxy.` },
            { property: "og:title", content: `${product.name} — FEALuxy` },
            { property: "og:description", content: product.description ?? `Shop ${product.name} at FEALuxy.` },
            { property: "og:type", content: "product" },
            { name: "twitter:card", content: "summary_large_image" },
          ]
        : [],
    };
  },
  loader: async ({ context, params }) => {
    return context.queryClient.ensureQueryData(productQueryOptions(params.slug));
  },
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data: product } = useSuspenseQuery(productQueryOptions(slug));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToCartFn = useServerFn(addToCart);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>();
  const [quantity, setQuantity] = useState(1);

  const mutation = useMutation({
    mutationFn: addToCartFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Added to cart");
    },
    onError: (err: any) => {
      if (err?.message?.includes("Unauthorized")) {
        navigate({ to: "/auth" });
      } else {
        toast.error(err?.message ?? "Could not add to cart");
      }
    },
  });

  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Product not found.
      </div>
    );
  }

  const variants = product.product_variants ?? [];
  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const price = selectedVariant?.price_inr ?? product.price_inr ?? 0;
  const compare = product.compare_price_inr;
  const productImages = (product.images as string[] | undefined) ?? [];
  const images = productImages.length
    ? productImages
    : ["https://placehold.co/600x600/e8e0d5/8b7355?text=FEALuxy"];

  const handleAdd = () => {
    mutation.mutate({
      data: {
        productId: product.id,
        variantId: selectedVariantId,
        quantity,
      },
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-sm breadcrumbs text-muted-foreground">
          <Link to="/products" className="hover:text-foreground">Shop</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{product.name}</span>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="aspect-square overflow-hidden rounded-2xl bg-muted">
            <img src={images[0]} alt={product.name} className="h-full w-full object-cover" />
          </div>

          <div className="flex flex-col">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">{product.categories?.name}</p>
            <h1 className="mt-2 font-serif text-4xl font-light text-foreground">{product.name}</h1>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-3xl font-semibold text-foreground">₹{price.toLocaleString("en-IN")}</span>
              {compare && compare > price && (
                <span className="text-lg text-muted-foreground line-through">₹{compare.toLocaleString("en-IN")}</span>
              )}
              {compare && compare > price && (
                <Badge variant="secondary">{Math.round(((compare - price) / compare) * 100)}% off</Badge>
              )}
            </div>

            {product.description && (
              <p className="mt-6 leading-relaxed text-muted-foreground">{product.description}</p>
            )}

            {variants.length > 0 && (
              <div className="mt-8">
                <label className="text-sm font-medium text-foreground">Variant</label>
                <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                  <SelectTrigger className="mt-2 w-full max-w-xs">
                    <SelectValue placeholder="Choose an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {variants.map((variant) => (
                      <SelectItem key={variant.id} value={variant.id}>
                        {variant.variant_name} — ₹{variant.price_inr.toLocaleString("en-IN")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <div className="flex items-center rounded-md border border-input">
                <button
                  type="button"
                  className="px-3 py-2 text-foreground hover:bg-accent"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  −
                </button>
                <span className="w-10 text-center text-foreground">{quantity}</span>
                <button
                  type="button"
                  className="px-3 py-2 text-foreground hover:bg-accent"
                  onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                >
                  +
                </button>
              </div>
              <Button size="lg" className="btn-gold" onClick={handleAdd} disabled={mutation.isPending}>
                {mutation.isPending ? "Adding..." : "Add to cart"}
              </Button>
            </div>

            <div className="mt-10 rounded-xl bg-secondary/40 p-6">
              <h3 className="font-medium text-foreground">Highlights</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Authentic luxury brand product</li>
                <li>Pan-India shipping</li>
                <li>7-day easy returns</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
