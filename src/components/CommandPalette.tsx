import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Sparkles, Package } from "lucide-react";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { quickSearchProducts, listCategories } from "@/lib/products.functions";
import { formatINR, productImage } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";

/**
 * Global search launched with ⌘K / Ctrl+K (or the `feaglam:search` window event).
 * Mounted once in the root layout. cmdk's built-in filter is disabled because
 * results are produced server-side.
 */
export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("feaglam:search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("feaglam:search", onOpen);
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 200);
    return () => clearTimeout(t);
  }, [value]);

  // Reset the query each time the dialog closes.
  useEffect(() => {
    if (!open) setValue("");
  }, [open]);

  const { data: results, isFetching } = useQuery({
    queryKey: ["quick-search", debounced],
    queryFn: () => quickSearchProducts({ data: { q: debounced } }),
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories({ data: undefined }),
    enabled: open,
  });

  const go = (fn: () => void) => { setOpen(false); fn(); };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Search FEAGlam</DialogTitle>
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2.5"
        >
          <CommandInput placeholder="Search products, categories…" value={value} onValueChange={setValue} />
          <CommandList>
            {debounced.length >= 2 && !isFetching && (!results || results.length === 0) && (
              <CommandEmpty>No products found for “{debounced}”.</CommandEmpty>
            )}

            {value.trim() && (
              <CommandGroup heading="Search">
                <CommandItem value={`search-${value}`} onSelect={() => go(() => navigate({ to: "/products", search: { search: value.trim() } }))}>
                  <Search className="mr-2 h-4 w-4" />
                  Search for “{value.trim()}”
                </CommandItem>
              </CommandGroup>
            )}

            {results && results.length > 0 && (
              <CommandGroup heading="Products">
                {results.map((p: any) => (
                  <CommandItem key={p.id} value={`product-${p.id}`} onSelect={() => go(() => navigate({ to: "/products/$slug", params: { slug: p.slug } }))}>
                    <ProductImage src={productImage(p.images)} alt="" className="mr-3 h-8 w-8 rounded object-cover" />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{formatINR(p.price_inr)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {debounced.length < 2 && (
              <CommandGroup heading="Categories">
                {(categories ?? []).map((c) => (
                  <CommandItem key={c.id} value={`category-${c.id}`} onSelect={() => go(() => navigate({ to: "/products", search: { category: c.slug } }))}>
                    <Package className="mr-2 h-4 w-4" />
                    {c.name}
                  </CommandItem>
                ))}
                <CommandItem value="all-products" onSelect={() => go(() => navigate({ to: "/products", search: {} }))}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Browse all products
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
