import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Supa = SupabaseClient<Database>;

async function assertAdmin(supabase: Supa, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin access required");
}




type EarningRow = { status: string; commission_amount: number; adjustment_amount: number };
function sumEarnings(rows: EarningRow[]) {
  const acc = { pending: 0, approved: 0, paid: 0, cancelled: 0 };
  for (const r of rows) {
    if (r.status === "pending") acc.pending += r.commission_amount;
    else if (r.status === "approved") acc.approved += r.commission_amount + r.adjustment_amount;
    else if (r.status === "paid") acc.paid += r.commission_amount + r.adjustment_amount;
    else if (r.status === "cancelled") acc.cancelled += r.commission_amount;
  }
  return acc;
}

// ===========================================================================
// Customer
// ===========================================================================
export const getReferralDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const db = context.supabase;

    const { data: profile } = await db
      .from("profiles")
      .select("referral_code")
      .eq("id", userId)
      .maybeSingle();

    const { data: settings } = await db
      .from("referral_settings")
      .select("program_enabled, level_1_percentage, level_2_percentage, minimum_payout_amount")
      .eq("id", true)
      .maybeSingle();

    // Direct + indirect referral counts (security-definer, scoped to auth.uid()).
    const { data: counts } = await db.rpc("my_referral_counts");
    const countRow = Array.isArray(counts) ? counts[0] : counts;

    const { data: commissions } = await db
      .from("referral_commissions")
      .select("status, commission_amount, adjustment_amount")
      .eq("beneficiary_user_id", userId);

    return {
      referralCode: profile?.referral_code ?? "",
      programEnabled: settings?.program_enabled ?? true,
      level1Percentage: Number(settings?.level_1_percentage ?? 10),
      level2Percentage: Number(settings?.level_2_percentage ?? 5),
      minimumPayout: settings?.minimum_payout_amount ?? 0,
      directReferrals: countRow?.direct_count ?? 0,
      indirectReferrals: countRow?.indirect_count ?? 0,
      earnings: sumEarnings((commissions ?? []) as EarningRow[]),
    };
  });

export const getReferralHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;

    const { data: rows, error } = await db.rpc("my_referral_history");
    if (error) throw error;

    return (rows ?? []).map((r) => ({
      id: r.id,
      orderRef: r.order_id.slice(0, 8).toUpperCase(),
      referredCustomer: r.referred_customer,
      level: r.referral_level,
      orderDate: r.order_date,
      eligibleAmount: r.eligible_order_amount,
      percentage: Number(r.commission_percentage),
      commissionAmount: r.commission_amount + r.adjustment_amount,
      status: r.status,
    }));

  });

// ===========================================================================
// Admin
// ===========================================================================
export const adminReferralSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;

    const [{ count: referredCustomers }, { data: commissions }] = await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }).not("referred_by_user_id", "is", null),
      db.from("referral_commissions").select("order_id, status, commission_amount, adjustment_amount"),
    ]);

    const rows = commissions ?? [];
    const byStatus = { pending: 0, approved: 0, paid: 0, cancelled: 0 };
    for (const r of rows) {
      const net = r.status === "pending" || r.status === "cancelled" ? r.commission_amount : r.commission_amount + r.adjustment_amount;
      (byStatus as any)[r.status] += net;
    }
    const referralOrders = new Set(rows.map((r) => r.order_id)).size;

    return {
      referredCustomers: referredCustomers ?? 0,
      referralOrders,
      commissionsByStatus: byStatus,
    };
  });

const listSchema = z.object({
  status: z.enum(["pending", "approved", "paid", "cancelled"]).optional(),
  search: z.string().trim().max(80).optional(),
});

export const adminListCommissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => listSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;

    let query = db
      .from("referral_commissions")
      .select("*, orders(id, created_at, status, payment_status)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status) query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw error;

    const userIds = [
      ...new Set((rows ?? []).flatMap((r) => [r.beneficiary_user_id, r.purchasing_user_id])),
    ];
    const { data: profiles } = userIds.length
      ? await db.from("profiles").select("id, full_name, referral_code").in("id", userIds)
      : { data: [] as { id: string; full_name: string | null; referral_code: string }[] };
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

    let result = (rows ?? []).map((r) => ({
      ...r,
      beneficiary: byId.get(r.beneficiary_user_id) ?? null,
      purchaser: byId.get(r.purchasing_user_id) ?? null,
      orderRef: r.order_id.slice(0, 8).toUpperCase(),
    }));

    // Simple search across order ref, beneficiary/purchaser name & referral code.
    if (data.search) {
      const q = data.search.toLowerCase();
      result = result.filter((r) =>
        r.orderRef.toLowerCase().includes(q) ||
        r.beneficiary?.full_name?.toLowerCase().includes(q) ||
        r.purchaser?.full_name?.toLowerCase().includes(q) ||
        r.beneficiary?.referral_code?.toLowerCase().includes(q) ||
        r.purchaser?.referral_code?.toLowerCase().includes(q),
      );
    }
    return result;
  });

export const adminListRelationships = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { data: referred } = await db
      .from("profiles")
      .select("id, full_name, referral_code, referred_by_user_id, referral_registered_at")
      .not("referred_by_user_id", "is", null)
      .order("referral_registered_at", { ascending: false })
      .limit(500);

    const referrerIds = [...new Set((referred ?? []).map((r) => r.referred_by_user_id!))];
    const { data: referrers } = referrerIds.length
      ? await db.from("profiles").select("id, full_name, referral_code").in("id", referrerIds)
      : { data: [] as { id: string; full_name: string | null; referral_code: string }[] };
    const byId = new Map((referrers ?? []).map((p) => [p.id, p]));

    return (referred ?? []).map((r) => ({
      id: r.id,
      customerName: r.full_name,
      customerCode: r.referral_code,
      referrerName: byId.get(r.referred_by_user_id!)?.full_name ?? null,
      referrerCode: byId.get(r.referred_by_user_id!)?.referral_code ?? null,
      registeredAt: r.referral_registered_at,
    }));
  });

const idSchema = z.object({ id: z.string().uuid() });

async function writeAudit(
  db: Supa,
  commissionId: string,
  action: string,
  prev: string | null,
  next: string | null,
  delta: number,
  reason: string | null,
  actor: string,
) {
  await db.from("referral_commission_audit").insert({
    commission_id: commissionId,
    action,
    previous_status: prev as never,
    new_status: next as never,
    amount_delta: delta,
    reason,
    actor_user_id: actor,
  });
}

export const adminApproveCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { data: c } = await db.from("referral_commissions").select("*").eq("id", data.id).maybeSingle();
    if (!c) throw new Error("Commission not found");
    if (c.status !== "pending") throw new Error("Only pending commissions can be approved");
    await db.from("referral_commissions").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", data.id);
    await writeAudit(db, data.id, "approved", c.status, "approved", c.commission_amount, null, context.userId);
    return { ok: true };
  });

export const adminMarkPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { data: c } = await db.from("referral_commissions").select("*").eq("id", data.id).maybeSingle();
    if (!c) throw new Error("Commission not found");
    if (c.status !== "approved") throw new Error("Only approved commissions can be paid");
    await db.from("referral_commissions").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", data.id);
    await writeAudit(db, data.id, "paid", c.status, "paid", c.commission_amount + c.adjustment_amount, null, context.userId);
    return { ok: true };
  });

const cancelSchema = z.object({ id: z.string().uuid(), reason: z.string().trim().min(3).max(300) });

export const adminCancelCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => cancelSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { data: c } = await db.from("referral_commissions").select("*").eq("id", data.id).maybeSingle();
    if (!c) throw new Error("Commission not found");
    if (c.status === "cancelled") throw new Error("Already cancelled");

    if (c.status === "paid") {
      // Clawback already-paid commission via a negative adjustment.
      await db.from("referral_commissions").update({
        adjustment_amount: c.adjustment_amount - c.commission_amount,
        adjustment_reason: data.reason,
      }).eq("id", data.id);
      await writeAudit(db, data.id, "adjusted", "paid", "paid", -c.commission_amount, data.reason, context.userId);
    } else {
      await db.from("referral_commissions").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", data.id);
      await writeAudit(db, data.id, "cancelled", c.status, "cancelled", -c.commission_amount, data.reason, context.userId);
    }
    return { ok: true };
  });

const adjustSchema = z.object({
  id: z.string().uuid(),
  newEligibleAmount: z.number().int().min(0),
  reason: z.string().trim().min(3).max(300),
});

/** Recalculate a commission proportionally for a partial return, keeping an audit trail. */
export const adminAdjustCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => adjustSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { data: c } = await db.from("referral_commissions").select("*").eq("id", data.id).maybeSingle();
    if (!c) throw new Error("Commission not found");
    if (c.status === "cancelled") throw new Error("Cannot adjust a cancelled commission");

    const newCommission = Math.floor((data.newEligibleAmount * Number(c.commission_percentage)) / 100);
    const delta = newCommission - c.commission_amount;
    await db.from("referral_commissions").update({
      eligible_order_amount: data.newEligibleAmount,
      commission_amount: newCommission,
      adjustment_amount: c.adjustment_amount + delta,
      adjustment_reason: data.reason,
    }).eq("id", data.id);
    await writeAudit(db, data.id, "adjusted", c.status, c.status, delta, data.reason, context.userId);
    return { ok: true };
  });

export const adminApproveDueCommissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { data, error } = await db.rpc("approve_due_referral_commissions");
    if (error) throw error;
    return { approved: (data as number) ?? 0 };
  });

// ---- Settings ----
export const getReferralSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { data } = await db.from("referral_settings").select("*").eq("id", true).maybeSingle();
    return data;
  });

const settingsSchema = z.object({
  program_enabled: z.boolean(),
  level_1_percentage: z.number().min(0).max(100),
  level_2_percentage: z.number().min(0).max(100),
  approval_waiting_days: z.number().int().min(0).max(365),
  minimum_payout_amount: z.number().int().min(0),
});

export const adminUpdateReferralSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { error } = await db.from("referral_settings").update({
      ...data,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    }).eq("id", true);
    if (error) throw error;
    return { ok: true };
  });
