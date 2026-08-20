import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { adminListCoupons, adminSaveCoupon, adminDeleteCoupon } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/coupons")({
  head: () => ({ meta: [{ title: "Coupons — Admin — FEA Glam" }] }),
  component: AdminCoupons,
});

type CouponRow = Awaited<ReturnType<typeof adminListCoupons>>[number];

function AdminCoupons() {
  const queryClient = useQueryClient();
  const { data: coupons, isLoading } = useQuery({
    queryKey: ["admin", "coupons"],
    queryFn: () => adminListCoupons({ data: undefined }),
    retry: false,
  });
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [open, setOpen] = useState(false);

  const deleteFn = useServerFn(adminDeleteCoupon);
  const deleteMutation = useMutation({
    mutationFn: deleteFn,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] }); toast.success("Coupon deleted"); },
    onError: (err: any) => toast.error(err?.message ?? "Delete failed"),
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-light text-foreground">Coupons</h1>
          <p className="mt-1 text-muted-foreground">{coupons?.length ?? 0} coupons · manage promo codes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="btn-gold" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add coupon</Button>
          </DialogTrigger>
          <CouponDialog key={editing?.id ?? "new"} coupon={editing} onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="card-luxe mt-8 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Min order</TableHead>
              <TableHead>Used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : !coupons?.length ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No coupons yet.</TableCell></TableRow>
            ) : (
              coupons.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <p className="font-mono font-semibold text-foreground">{c.code}</p>
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {c.discount_type === "percent" ? `${c.discount_value}%` : formatINR(c.discount_value)}
                    {c.max_discount_inr ? <span className="text-xs text-muted-foreground"> (max {formatINR(c.max_discount_inr)})</span> : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatINR(c.min_order_inr)}</TableCell>
                  <TableCell className="text-muted-foreground">{c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ""}</TableCell>
                  <TableCell>
                    <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete “{c.code}”?</AlertDialogTitle>
                            <AlertDialogDescription>This coupon will no longer be redeemable.</AlertDialogDescription>
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

function CouponDialog({ coupon, onDone }: { coupon: CouponRow | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const saveFn = useServerFn(adminSaveCoupon);

  const [form, setForm] = useState({
    code: coupon?.code ?? "",
    description: coupon?.description ?? "",
    discount_type: (coupon?.discount_type ?? "percent") as "percent" | "fixed",
    discount_value: coupon?.discount_value?.toString() ?? "",
    min_order_inr: coupon?.min_order_inr?.toString() ?? "0",
    max_discount_inr: coupon?.max_discount_inr?.toString() ?? "",
    usage_limit: coupon?.usage_limit?.toString() ?? "",
    customer_monthly_limit: coupon?.customer_monthly_limit?.toString() ?? "",
    starts_at: toDateTimeLocal(coupon?.starts_at),
    expires_at: toDateTimeLocal(coupon?.expires_at),
    eligibility: (coupon?.eligibility ?? "everyone") as "everyone" | "new_customers" | "selected_customers",
    active: coupon?.active ?? true,
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const mutation = useMutation({
    mutationFn: saveFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
      toast.success(coupon ? "Coupon updated" : "Coupon created");
      onDone();
    },
    onError: (err: any) => toast.error(err?.message ?? "Save failed"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.discount_value) return toast.error("Code and value are required");
    mutation.mutate({
      data: {
        id: coupon?.id,
        code: form.code,
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_order_inr: Number(form.min_order_inr) || 0,
        max_discount_inr: form.max_discount_inr ? Number(form.max_discount_inr) : null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        customer_monthly_limit: form.customer_monthly_limit ? Number(form.customer_monthly_limit) : null,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        eligibility: form.eligibility,
        active: form.active,
      },
    });
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>{coupon ? "Edit coupon" : "Add coupon"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Code</Label><Input value={form.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} className="uppercase" required /></div>
          <div>
            <Label>Type</Label>
            <Select value={form.discount_type} onValueChange={(v) => set({ discount_type: v as "percent" | "fixed" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Percentage (%)</SelectItem>
                <SelectItem value="fixed">Fixed (₹)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2"><Label>Description</Label><Input value={form.description} onChange={(e) => set({ description: e.target.value })} /></div>
          <div><Label>Value ({form.discount_type === "percent" ? "%" : "₹"})</Label><Input type="number" value={form.discount_value} onChange={(e) => set({ discount_value: e.target.value })} required /></div>
          <div><Label>Min order (₹)</Label><Input type="number" value={form.min_order_inr} onChange={(e) => set({ min_order_inr: e.target.value })} /></div>
          {form.discount_type === "percent" && (
            <div><Label>Max discount (₹)</Label><Input type="number" value={form.max_discount_inr} onChange={(e) => set({ max_discount_inr: e.target.value })} placeholder="No cap" /></div>
          )}
          <div><Label>Usage limit</Label><Input type="number" value={form.usage_limit} onChange={(e) => set({ usage_limit: e.target.value })} placeholder="Unlimited" /></div>
          <div><Label>Uses per customer / month</Label><Input type="number" value={form.customer_monthly_limit} onChange={(e) => set({ customer_monthly_limit: e.target.value })} placeholder="Unlimited" /></div>
          <div><Label>Starts at</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => set({ starts_at: e.target.value })} /></div>
          <div><Label>Expires at</Label><Input type="datetime-local" value={form.expires_at} onChange={(e) => set({ expires_at: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Customer eligibility</Label><Select value={form.eligibility} onValueChange={(v) => set({ eligibility: v as typeof form.eligibility })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="everyone">Everyone</SelectItem><SelectItem value="new_customers">New customers (ready for future rules)</SelectItem><SelectItem value="selected_customers">Selected customers (ready for future rules)</SelectItem></SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">Eligibility rules beyond everyone will be enabled in a future release.</p></div>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={form.active} onCheckedChange={(v) => set({ active: v })} id="active" />
            <Label htmlFor="active" className="font-normal">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" className="btn-gold" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : coupon ? "Save changes" : "Create coupon"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function toDateTimeLocal(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}
