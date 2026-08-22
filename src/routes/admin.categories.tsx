import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Pencil, Trash2, Image as ImageIcon } from "lucide-react";
import { ProductImage } from "@/components/ProductImage";
import { uploadProductImage } from "@/lib/upload";
import { adminListCategories, adminSaveCategory, adminDeleteCategory } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/categories")({
  head: () => ({ meta: [{ title: "Categories — Admin — FEA Glam" }] }),
  component: AdminCategories,
});

type CategoryRow = Awaited<ReturnType<typeof adminListCategories>>[number];

function productCount(cat: CategoryRow): number {
  const rel = (cat as any).products;
  if (Array.isArray(rel)) return rel[0]?.count ?? 0;
  return rel?.count ?? 0;
}

function AdminCategories() {
  const queryClient = useQueryClient();
  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => adminListCategories({ data: undefined }),
    retry: false,
  });
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [open, setOpen] = useState(false);

  const deleteFn = useServerFn(adminDeleteCategory);
  const deleteMutation = useMutation({
    mutationFn: deleteFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category deleted");
    },
    onError: (err: any) => toast.error(err?.message ?? "Delete failed"),
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-light text-foreground">Categories</h1>
          <p className="mt-1 text-muted-foreground">{categories?.length ?? 0} categories · organise your catalog</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="btn-gold" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add category</Button>
          </DialogTrigger>
          <CategoryDialog key={editing?.id ?? "new"} category={editing} onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="card-luxe mt-8 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : !categories?.length ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No categories yet.</TableCell></TableRow>
            ) : (
              categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {c.image_url && (
                        <ProductImage src={c.image_url} alt={c.name} className="h-10 w-10 rounded object-cover" />
                      )}
                      <div>
                    <p className="font-medium text-foreground">{c.name}</p>
                    {c.description && <p className="max-w-md truncate text-xs text-muted-foreground">{c.description}</p>}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">/{c.slug}</TableCell>
                  <TableCell className="text-muted-foreground">{productCount(c)}</TableCell>
                  <TableCell className="text-muted-foreground">{c.sort_order}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete “{c.name}”?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Products in this category won't be deleted, but they'll become uncategorised.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate({ data: { id: c.id } })}>Delete</AlertDialogAction>
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

function CategoryDialog({ category, onDone }: { category: CategoryRow | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const saveFn = useServerFn(adminSaveCategory);

  const [form, setForm] = useState({
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    description: category?.description ?? "",
    image_url: category?.image_url ?? "",
    sort_order: category?.sort_order?.toString() ?? "0",
  });
  const [uploading, setUploading] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadProductImage(file);
      set({ image_url: path });
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const mutation = useMutation({
    mutationFn: saveFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(category ? "Category updated" : "Category created");
      onDone();
    },
    onError: (err: any) => toast.error(err?.message ?? "Save failed"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return toast.error("Name is required");
    mutation.mutate({
      data: {
        id: category?.id,
        name: form.name,
        slug: form.slug || undefined,
        description: form.description || null,
        image_url: form.image_url || null,
        sort_order: Number(form.sort_order) || 0,
      },
    });
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>{category ? "Edit category" : "Add category"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div><Label>Name</Label><Input value={form.name} onChange={(e) => set({ name: e.target.value })} required /></div>
        <div><Label>Slug (optional)</Label><Input value={form.slug} onChange={(e) => set({ slug: e.target.value })} placeholder="auto-generated" /></div>
        <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} /></div>
        <div className="space-y-2">
          <Label>Image</Label>
          <div className="flex items-center gap-3">
            {form.image_url ? (
              <ProductImage src={form.image_url} alt="Category" className="h-16 w-16 rounded-md object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed text-muted-foreground">
                <ImageIcon className="h-5 w-5" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Input type="file" accept="image/*" onChange={onPickImage} disabled={uploading} />
              {form.image_url && (
                <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => set({ image_url: "" })}>
                  Remove image
                </Button>
              )}
            </div>
          </div>
          {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
        </div>
        <div><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={(e) => set({ sort_order: e.target.value })} /></div>
        <DialogFooter>
          <Button type="submit" className="btn-gold" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : category ? "Save changes" : "Create category"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
