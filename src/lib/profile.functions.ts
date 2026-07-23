import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const profileSchema = z.object({
  fullName: z.string().max(120).optional(),
  phone: z.string().max(20).optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

const addressSchema = z.object({
  label: z.string().max(50).default("Home"),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  pincode: z.string().min(1).max(20),
  country: z.string().max(100).default("India"),
  isDefault: z.boolean().default(false),
});

const addressIdSchema = z.object({ addressId: z.string().uuid() });

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw error;
    return data;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: data.fullName || null,
        phone: data.phone || null,
        avatar_url: data.avatarUrl || null,
      })
      .eq("id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const getAddresses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("profile_id", userId)
      .order("is_default", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const createAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => addressSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.isDefault) {
      await supabase.from("addresses").update({ is_default: false }).eq("profile_id", userId);
    }
    const { data: address, error } = await supabase
      .from("addresses")
      .insert({
        profile_id: userId,
        label: data.label,
        line1: data.line1,
        line2: data.line2 || null,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        country: data.country,
        is_default: data.isDefault,
      })
      .select()
      .single();
    if (error) throw error;
    return address;
  });

export const updateAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => addressIdSchema.merge(addressSchema).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.isDefault) {
      await supabase.from("addresses").update({ is_default: false }).eq("profile_id", userId);
    }
    const { error } = await supabase
      .from("addresses")
      .update({
        label: data.label,
        line1: data.line1,
        line2: data.line2 || null,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        country: data.country,
        is_default: data.isDefault,
      })
      .eq("id", data.addressId)
      .eq("profile_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => addressIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("addresses").delete().eq("id", data.addressId).eq("profile_id", userId);
    if (error) throw error;
    return { ok: true };
  });
