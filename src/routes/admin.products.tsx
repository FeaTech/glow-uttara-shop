import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Pencil, Trash2, Check, Upload, X, Loader2 } from "lucide-react";
import {
  adminListProducts, adminSaveProduct, adminDeleteProduct, adminUpdateStock,
  adminListVariants, adminSaveVariant, adminDeleteVariant,
} from "@/lib/admin.functions";
import { listCategories } from "@/lib/products.functions";
import { uploadProductImage } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR, productImage } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/products")({
  head: () => ({ meta: [{ title: "Products — Admin — FEA Glam" }] }),
  component: AdminProducts,
});

type ProductRow = Awaited<ReturnType<typeof adminListProducts>>[number];

function AdminProducts() {
  const queryClient = useQueryClient();
  // Only refresh the product list here. These used to also invalidate
  // ["admin","stats"], so every variant/stock change triggered a full dashboard
  // stats recomputation — on a page that doesn't even display those stats.
  useRealtimeInvalidate({ channel: "admin-product-inventory", table: "product_variants", invalidate: [["admin", "products"]] });
  useRealtimeInvalidate({ channel: "admin-product-stock", table: "products", invalidate: [["admin", "products"]] });
  const { data: products, isLoading } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => adminListProducts({ data: undefined }),
    retry: false,
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories({ data: undefined }),
  });

  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [open, setOpen] = useState(false);

  const deleteFn = useServerFn(adminDeleteProduct);
  const deleteMutation = useMutation({
    mutationFn: deleteFn,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "products"] }); toast.success("Product deleted"); },
    onError: (err: any) => toast.error(err?.message ?? "Delete failed"),
  });

  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (p: ProductRow) => { setEditing(p); setOpen(true); };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-light text-foreground">Products</h1>
          <p className="mt-1 text-muted-foreground">{products?.length ?? 0} products · manage catalog &amp; inventory</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="btn-gold" onClick={openCreate}><Plus className="h-4 w-4" /> Add product</Button>
          </DialogTrigger>
          <ProductDialog
            key={editing?.id ?? "new"}
            product={editing}
            categories={categories ?? []}
            onDone={() => setOpen(false)}
          />
        </Dialog>
      </div>

      <div className="card-luxe mt-8 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Inventory</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : !products?.length ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No products yet.</TableCell></TableRow>
            ) : (
              products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <ProductImage src={productImage(p.images)} alt="" className="h-11 w-11 rounded-md object-cover" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">/{p.slug}</p>
                      </div>
                      {p.is_featured && <Badge variant="secondary" className="shrink-0">Featured</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{(p.categories as any)?.name ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatINR(p.price_inr)}</TableCell>
                  <TableCell>{p.variantCount ? <div><p className="font-medium text-foreground">{p.variantsInStock} of {p.variantCount} available</p><p className={p.variantsSoldOut ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{p.variantsSoldOut ? `${p.variantsSoldOut} sold out` : "All variants in stock"}</p></div> : <StockEditor id={p.id} stock={p.inventoryStock} />}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete “{p.name}”?</AlertDialogTitle>
                            <AlertDialogDescription>This permanently removes the product and its variants. This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate({ data: { id: p.id } })}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StockEditor({ id, stock }: { id: string; stock: number }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(stock.toString());
  const updateFn = useServerFn(adminUpdateStock);
  const mutation = useMutation({
    mutationFn: updateFn,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "products"] }); toast.success("Stock updated"); },
    onError: (err: any) => toast.error(err?.message ?? "Update failed"),
  });
  const dirty = value !== stock.toString();
  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-20"
      />
      {dirty && (
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Save stock"
          onClick={() => mutation.mutate({ data: { id, stock: Math.max(0, Number(value) || 0) } })}>
          <Check className="h-4 w-4 text-primary" />
        </Button>
      )}
    </div>
  );
}

function ProductDialog({
  product, categories, onDone,
}: {
  product: ProductRow | null;
  categories: { id: string; name: string }[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const saveFn = useServerFn(adminSaveProduct);

  const [form, setForm] = useState({
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    category_id: product?.category_id ?? "",
    price_inr: product?.price_inr?.toString() ?? "",
    compare_price_inr: product?.compare_price_inr?.toString() ?? "",
    base_unit: (product as any)?.base_unit ?? "",
    stock: product?.stock?.toString() ?? "0",
    is_featured: product?.is_featured ?? false,
    short_description: product?.short_description ?? "",
    description: product?.description ?? "",
    images: ((product?.images as string[] | undefined) ?? []) as string[],
    tags: (product?.tags ?? []).join(", "),
  });

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const mutation = useMutation({
    mutationFn: saveFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(product ? "Product updated" : "Product created");
      onDone();
    },
    onError: (err: any) => toast.error(err?.message ?? "Save failed"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return toast.error("Name is required");
    mutation.mutate({
      data: {
        id: product?.id,
        name: form.name,
        slug: form.slug || undefined,
        category_id: form.category_id || null,
        price_inr: Number(form.price_inr) || 0,
        compare_price_inr: form.compare_price_inr ? Number(form.compare_price_inr) : null,
        base_unit: form.base_unit.trim() || null,
        stock: Number(form.stock) || 0,
        is_featured: form.is_featured,
        short_description: form.short_description || null,
        description: form.description || null,
        images: form.images,
        tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
      },
    });
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => set({ name: e.target.value })} required /></div>
          <div><Label>Slug (optional)</Label><Input value={form.slug} onChange={(e) => set({ slug: e.target.value })} placeholder="auto-generated" /></div>
          <div>
            <Label>Category</Label>
            <Select value={form.category_id} onValueChange={(v) => set({ category_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch checked={form.is_featured} onCheckedChange={(v) => set({ is_featured: v })} id="featured" />
            <Label htmlFor="featured" className="font-normal">Featured product</Label>
          </div>

          <div className="sm:col-span-2"><Label>Short description</Label><Input value={form.short_description} onChange={(e) => set({ short_description: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} /></div>
          <div className="sm:col-span-2">
            <Label>Images</Label>
            <ImageManager images={form.images} onChange={(imgs) => set({ images: imgs })} />
          </div>
           <div className="sm:col-span-2"><Label>Tags (comma separated)</Label><Input value={form.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="serum, skincare" /></div>
          <div><Label>Base price (₹)</Label><Input type="number" min="0" value={form.price_inr} onChange={(e) => set({ price_inr: e.target.value })} required /></div>
          <div><Label>Base MRP (₹)</Label><Input type="number" min="0" value={form.compare_price_inr} onChange={(e) => set({ compare_price_inr: e.target.value })} /></div>
          <div><Label>Base unit</Label><Input value={form.base_unit} onChange={(e) => set({ base_unit: e.target.value })} placeholder="e.g. 50ml" /></div>
          <div><Label>Stock (no variants)</Label><Input type="number" min="0" value={form.stock} onChange={(e) => set({ stock: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button type="submit" className="btn-gold" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : product ? "Save changes" : "Create product"}
          </Button>
        </DialogFooter>
      </form>

      {product?.id ? (
        <div className="mt-2 border-t border-border pt-4">
          <VariantsManager productId={product.id} />
        </div>
      ) : (
        <p className="mt-2 border-t border-border pt-4 text-xs text-muted-foreground">
          Save the product first to add size/shade variants.
        </p>
      )}
    </DialogContent>
  );
}

function VariantsManager({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const { data: variants } = useQuery({
    queryKey: ["admin", "variants", productId],
    queryFn: () => adminListVariants({ data: { productId } }),
    retry: false,
  });

  const saveFn = useServerFn(adminSaveVariant);
  const deleteFn = useServerFn(adminDeleteVariant);
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "variants", productId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
  };

  const saveMutation = useMutation({
    mutationFn: saveFn,
    onSuccess: () => { invalidate(); toast.success("Variant saved"); },
    onError: (err: any) => toast.error(err?.message ?? "Save failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteFn,
    onSuccess: () => { invalidate(); toast.success("Variant removed"); },
    onError: (err: any) => toast.error(err?.message ?? "Delete failed"),
  });

  const [draft, setDraft] = useState({ variant_name: "", sku: "", price_inr: "", compare_price_inr: "", stock: "0" });

  const addVariant = () => {
    if (!draft.variant_name.trim()) return toast.error("Variant name is required");
    saveMutation.mutate({
      data: {
        productId,
        variant_name: draft.variant_name.trim(),
        sku: draft.sku || null,
        price_inr: draft.price_inr ? Number(draft.price_inr) : null,
        compare_price_inr: draft.compare_price_inr ? Number(draft.compare_price_inr) : null,
        stock: Number(draft.stock) || 0,
      },
    });
    setDraft({ variant_name: "", sku: "", compare_price_inr: "", price_inr: "", stock: "0" });
  };

  return (
    <div>
      <p className="text-sm font-medium text-foreground">Variants</p>
      <p className="mt-1 text-xs text-muted-foreground">Each variant can have its own compare-at price — the discount shown to customers uses the selected variant’s own prices.</p>
      <div className="mt-3 space-y-2">
        {(variants ?? []).length > 0 && <div className="grid grid-cols-[1fr_1fr_80px_90px_70px_auto] gap-2 px-1 text-xs font-medium text-muted-foreground"><span>Name</span><span>SKU</span><span>Price</span><span>MRP</span><span>Stock</span><span className="sr-only">Actions</span></div>}
        {(variants ?? []).map((v) => (
          <VariantRow
            key={v.id}
            variant={v}
            productId={productId}
            onSave={(patch) => saveMutation.mutate({ data: { id: v.id, productId, ...patch } })}
            onDelete={() => deleteMutation.mutate({ data: { id: v.id } })}
          />
        ))}
        {(variants ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">No variants yet.</p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-[1fr_1fr_80px_90px_70px_auto] items-center gap-2">
        <Input placeholder="Name (e.g. 50ml)" value={draft.variant_name} onChange={(e) => setDraft({ ...draft, variant_name: e.target.value })} className="h-9" />
        <Input placeholder="SKU" value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} className="h-9" />
        <Input type="number" placeholder="₹" value={draft.price_inr} onChange={(e) => setDraft({ ...draft, price_inr: e.target.value })} className="h-9" />
        <Input type="number" placeholder="MRP ₹" value={draft.compare_price_inr} onChange={(e) => setDraft({ ...draft, compare_price_inr: e.target.value })} className="h-9" />
        <Input type="number" placeholder="Qty" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} className="h-9" />
        <Button type="button" size="sm" variant="outline" onClick={addVariant} disabled={saveMutation.isPending}>Add</Button>
      </div>
    </div>
  );
}

function VariantRow({
  variant, onSave, onDelete,
}: {
  variant: Awaited<ReturnType<typeof adminListVariants>>[number];
  productId: string;
  onSave: (patch: { variant_name: string; sku: string | null; price_inr: number | null; compare_price_inr: number | null; stock: number }) => void;
  onDelete: () => void;
}) {
  const [form, setForm] = useState({
    variant_name: variant.variant_name,
    sku: variant.sku ?? "",
    price_inr: variant.price_inr?.toString() ?? "",
    compare_price_inr: (variant as any).compare_price_inr?.toString() ?? "",
    stock: variant.stock.toString(),
  });
  const dirty =
    form.variant_name !== variant.variant_name ||
    form.sku !== (variant.sku ?? "") ||
    form.price_inr !== (variant.price_inr?.toString() ?? "") ||
    form.compare_price_inr !== ((variant as any).compare_price_inr?.toString() ?? "") ||
    form.stock !== variant.stock.toString();

  return (
    <div className="grid grid-cols-[1fr_1fr_80px_90px_70px_auto] items-center gap-2">
      <Input value={form.variant_name} onChange={(e) => setForm({ ...form, variant_name: e.target.value })} className="h-9" />
      <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="h-9" placeholder="SKU" />
      <Input type="number" value={form.price_inr} onChange={(e) => setForm({ ...form, price_inr: e.target.value })} className="h-9" placeholder="₹" />
      <Input type="number" value={form.compare_price_inr} onChange={(e) => setForm({ ...form, compare_price_inr: e.target.value })} className="h-9" placeholder="MRP ₹" />
      <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="h-9" />
      <div className="flex gap-1">
        {dirty && (
          <Button type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label="Save variant"
            onClick={() => onSave({ variant_name: form.variant_name, sku: form.sku || null, price_inr: form.price_inr ? Number(form.price_inr) : null, compare_price_inr: form.compare_price_inr ? Number(form.compare_price_inr) : null, stock: Number(form.stock) || 0 })}>
            <Check className="h-4 w-4 text-primary" />
          </Button>
        )}
        <Button type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label="Delete variant" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function ImageManager({ images, onChange }: { images: string[]; onChange: (images: string[]) => void }) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadProductImage(file));
      }
      onChange([...images, ...uploaded]);
      toast.success(`${uploaded.length} image${uploaded.length > 1 ? "s" : ""} uploaded`);
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const remove = (idx: number) => onChange(images.filter((_, i) => i !== idx));
  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    onChange([...images, url]);
    setUrlInput("");
  };

  return (
    <div className="mt-1.5 space-y-3">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((img, i) => (
            <div key={i} className="group relative h-20 w-20 overflow-hidden rounded-md border border-border">
              <ProductImage src={img} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-background/90 text-foreground opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
              {i === 0 && (
                <span className="absolute bottom-0 inset-x-0 bg-primary/90 py-0.5 text-center text-[9px] font-medium text-primary-foreground">Cover</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm transition-colors hover:bg-secondary">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Upload"}
          <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={(e) => handleFiles(e.target.files)} />
        </label>
        <div className="flex flex-1 items-center gap-2">
          <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="…or paste an image URL" className="h-9" />
          <Button type="button" variant="outline" size="sm" onClick={addUrl} disabled={!urlInput.trim()}>Add</Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">First image is used as the cover. Uploads go to Supabase Storage.</p>
    </div>
  );
}
