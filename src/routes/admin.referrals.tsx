import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search, Download, CheckCircle2, BadgeCheck, XCircle, SlidersHorizontal, Users } from "lucide-react";
import {
  adminReferralSummary, adminListCommissions, adminListRelationships,
  adminApproveCommission, adminMarkPaid, adminCancelCommission, adminAdjustCommission,
  adminApproveDueCommissions, getReferralSettings, adminUpdateReferralSettings,
} from "@/lib/referral.functions";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/referrals")({
  head: () => ({ meta: [{ title: "Referral Management — Admin — FEA Glam" }] }),
  component: AdminReferrals,
});

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  approved: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

type StatusFilter = "all" | "pending" | "approved" | "paid" | "cancelled";

function AdminReferrals() {
  return (
    <div>
      <h1 className="font-serif text-3xl font-light text-foreground">Referral Management</h1>
      <p className="mt-1 text-muted-foreground">Two-level referral commissions, relationships &amp; program settings.</p>

      <SummaryCards />

      <Tabs defaultValue="commissions" className="mt-8">
        <TabsList>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="commissions" className="mt-6"><CommissionsTab /></TabsContent>
        <TabsContent value="relationships" className="mt-6"><RelationshipsTab /></TabsContent>
        <TabsContent value="settings" className="mt-6"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCards() {
  const { data } = useQuery({
    queryKey: ["admin", "referral", "summary"],
    queryFn: () => adminReferralSummary({ data: undefined }),
    retry: false,
  });
  useRealtimeInvalidate({
    channel: "admin-referrals",
    table: "referral_commissions",
    invalidate: [["admin", "referral", "summary"], ["admin", "referral", "commissions"]],
  });

  const cards = [
    { label: "Referred customers", value: data?.referredCustomers ?? "—", money: false },
    { label: "Referral orders", value: data?.referralOrders ?? "—", money: false },
    { label: "Pending", value: data?.commissionsByStatus.pending ?? 0, money: true },
    { label: "Approved", value: data?.commissionsByStatus.approved ?? 0, money: true },
    { label: "Paid", value: data?.commissionsByStatus.paid ?? 0, money: true },
    { label: "Cancelled", value: data?.commissionsByStatus.cancelled ?? 0, money: true },
  ];
  return (
    <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="card-luxe p-4">
          <p className="text-xs text-muted-foreground">{c.label}</p>
          <p className="mt-1 font-serif text-xl font-medium text-foreground">
            {c.money ? formatINR(Number(c.value)) : c.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function CommissionsTab() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [reasonDialog, setReasonDialog] = useState<{ mode: "cancel" | "adjust"; id: string; commission: number } | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin", "referral", "commissions", status, search],
    queryFn: () => adminListCommissions({ data: { status: status === "all" ? undefined : status, search: search || undefined } }),
    retry: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "referral"] });
  };
  const approveFn = useServerFn(adminApproveCommission);
  const payFn = useServerFn(adminMarkPaid);
  const dueFn = useServerFn(adminApproveDueCommissions);

  const approve = useMutation({ mutationFn: approveFn, onSuccess: () => { invalidate(); toast.success("Commission approved"); }, onError: (e: any) => toast.error(e?.message ?? "Failed") });
  const pay = useMutation({ mutationFn: payFn, onSuccess: () => { invalidate(); toast.success("Marked as paid"); }, onError: (e: any) => toast.error(e?.message ?? "Failed") });
  const approveDue = useMutation({ mutationFn: () => dueFn({ data: undefined }), onSuccess: (r) => { invalidate(); toast.success(`Approved ${r.approved} eligible commission(s)`); }, onError: (e: any) => toast.error(e?.message ?? "Failed") });

  const exportCsv = () => {
    const list = rows ?? [];
    if (!list.length) return toast.error("Nothing to export");
    const header = ["Order", "Beneficiary", "Referred customer", "Level", "Percentage", "Eligible", "Commission", "Adjustment", "Status", "Created"];
    const lines = list.map((r: any) => [
      r.orderRef, r.beneficiary?.full_name ?? "", r.purchaser?.full_name ?? "", r.referral_level,
      r.commission_percentage, r.eligible_order_amount, r.commission_amount, r.adjustment_amount, r.status,
      new Date(r.created_at).toISOString(),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `referral-commissions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code, order…" className="h-9 w-64 pl-9" />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="h-9 w-40"><SlidersHorizontal className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "pending", "approved", "paid", "cancelled"].map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => approveDue.mutate()} disabled={approveDue.isPending}>
            <CheckCircle2 className="h-4 w-4" /> Approve due
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4" /> Export</Button>
        </div>
      </div>

      <div className="card-luxe overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Beneficiary</TableHead>
              <TableHead>Referred</TableHead>
              <TableHead>Level</TableHead>
              <TableHead className="text-right">Eligible</TableHead>
              <TableHead className="text-right">%</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : !rows?.length ? (
              <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">No commissions found.</TableCell></TableRow>
            ) : (
              rows.map((r: any) => {
                const net = r.commission_amount + r.adjustment_amount;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">#{r.orderRef}</TableCell>
                    <TableCell>
                      <p className="text-foreground">{r.beneficiary?.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{r.beneficiary?.referral_code}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.purchaser?.full_name || "—"}</TableCell>
                    <TableCell><span className="rounded-full bg-secondary px-2 py-0.5 text-xs">L{r.referral_level}</span></TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatINR(r.eligible_order_amount)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{Number(r.commission_percentage)}%</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatINR(net)}
                      {r.adjustment_amount !== 0 && <span className="block text-xs text-muted-foreground">adj {formatINR(r.adjustment_amount)}</span>}
                    </TableCell>
                    <TableCell><span className={cn("rounded-full px-2.5 py-1 text-xs font-medium capitalize", STATUS_STYLES[r.status])}>{r.status}</span></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.status === "pending" && (
                          <Button size="sm" variant="ghost" onClick={() => approve.mutate({ data: { id: r.id } })} title="Approve"><BadgeCheck className="h-4 w-4 text-blue-600" /></Button>
                        )}
                        {r.status === "approved" && (
                          <Button size="sm" variant="ghost" onClick={() => pay.mutate({ data: { id: r.id } })} title="Mark paid"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></Button>
                        )}
                        {r.status !== "cancelled" && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setReasonDialog({ mode: "adjust", id: r.id, commission: r.eligible_order_amount })} title="Adjust">Adj</Button>
                            <Button size="sm" variant="ghost" onClick={() => setReasonDialog({ mode: "cancel", id: r.id, commission: net })} title="Cancel"><XCircle className="h-4 w-4 text-destructive" /></Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {reasonDialog && (
        <ReasonDialog
          mode={reasonDialog.mode}
          commissionId={reasonDialog.id}
          currentEligible={reasonDialog.commission}
          onClose={() => setReasonDialog(null)}
          onDone={() => { setReasonDialog(null); invalidate(); }}
        />
      )}
    </div>
  );
}

function ReasonDialog({ mode, commissionId, currentEligible, onClose, onDone }: {
  mode: "cancel" | "adjust";
  commissionId: string;
  currentEligible: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [newEligible, setNewEligible] = useState(currentEligible.toString());
  const cancelFn = useServerFn(adminCancelCommission);
  const adjustFn = useServerFn(adminAdjustCommission);

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "cancel") return cancelFn({ data: { id: commissionId, reason } });
      return adjustFn({ data: { id: commissionId, newEligibleAmount: Number(newEligible) || 0, reason } });
    },
    onSuccess: () => { toast.success(mode === "cancel" ? "Commission cancelled" : "Commission adjusted"); onDone(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{mode === "cancel" ? "Cancel commission" : "Adjust commission (partial return)"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {mode === "adjust" && (
            <div>
              <Label>New eligible amount (₹)</Label>
              <Input type="number" value={newEligible} onChange={(e) => setNewEligible(e.target.value)} className="mt-1.5" />
              <p className="mt-1 text-xs text-muted-foreground">Commission is recalculated proportionally.</p>
            </div>
          )}
          <div>
            <Label>Reason <span className="text-destructive">*</span></Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1.5" placeholder="Required — recorded in the audit trail" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button className="btn-gold" disabled={reason.trim().length < 3 || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving…" : mode === "cancel" ? "Cancel commission" : "Apply adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RelationshipsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "referral", "relationships"],
    queryFn: () => adminListRelationships({ data: undefined }),
    retry: false,
  });
  return (
    <div className="card-luxe overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Their code</TableHead>
            <TableHead>Referred by</TableHead>
            <TableHead>Referrer code</TableHead>
            <TableHead>Registered</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
          ) : !data?.length ? (
            <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No referral relationships yet.</TableCell></TableRow>
          ) : (
            data.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-foreground">{r.customerName || "—"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.customerCode}</TableCell>
                <TableCell className="text-foreground">{r.referrerName || "—"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.referrerCode}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{r.registeredAt ? formatDate(r.registeredAt) : "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function SettingsTab() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["admin", "referral", "settings"],
    queryFn: () => getReferralSettings({ data: undefined }),
    retry: false,
  });
  const saveFn = useServerFn(adminUpdateReferralSettings);

  const [form, setForm] = useState<null | {
    program_enabled: boolean; level_1_percentage: string; level_2_percentage: string;
    approval_waiting_days: string; minimum_payout_amount: string;
  }>(null);

  const current = form ?? (settings ? {
    program_enabled: settings.program_enabled,
    level_1_percentage: String(settings.level_1_percentage),
    level_2_percentage: String(settings.level_2_percentage),
    approval_waiting_days: String(settings.approval_waiting_days),
    minimum_payout_amount: String(settings.minimum_payout_amount),
  } : null);

  const set = (patch: Partial<NonNullable<typeof form>>) => setForm({ ...(current as any), ...patch });

  const mutation = useMutation({
    mutationFn: () => saveFn({
      data: {
        program_enabled: current!.program_enabled,
        level_1_percentage: Number(current!.level_1_percentage),
        level_2_percentage: Number(current!.level_2_percentage),
        approval_waiting_days: Number(current!.approval_waiting_days),
        minimum_payout_amount: Number(current!.minimum_payout_amount),
      },
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "referral", "settings"] }); toast.success("Settings saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (!current) return <p className="text-muted-foreground">Loading settings…</p>;

  return (
    <div className="card-luxe max-w-lg space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base">Referral program</Label>
          <p className="text-sm text-muted-foreground">Enable or pause commissions globally.</p>
        </div>
        <Switch checked={current.program_enabled} onCheckedChange={(v) => set({ program_enabled: v })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Level 1 %</Label><Input type="number" value={current.level_1_percentage} onChange={(e) => set({ level_1_percentage: e.target.value })} className="mt-1.5" /></div>
        <div><Label>Level 2 %</Label><Input type="number" value={current.level_2_percentage} onChange={(e) => set({ level_2_percentage: e.target.value })} className="mt-1.5" /></div>
        <div><Label>Approval waiting (days)</Label><Input type="number" value={current.approval_waiting_days} onChange={(e) => set({ approval_waiting_days: e.target.value })} className="mt-1.5" /></div>
        <div><Label>Minimum payout (₹)</Label><Input type="number" value={current.minimum_payout_amount} onChange={(e) => set({ minimum_payout_amount: e.target.value })} className="mt-1.5" /></div>
      </div>
      <Button className="btn-gold" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Save settings"}
      </Button>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" /> Max referral depth is fixed at 2 levels.
      </p>
    </div>
  );
}
