import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Heart, Package, Pencil, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getProfile, getAddresses, createAddress, updateAddress, deleteAddress, updateProfile } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const profileQueryOptions = () =>
  queryOptions({ queryKey: ["profile"], queryFn: () => getProfile({ data: undefined }) });
const addressesQueryOptions = () =>
  queryOptions({ queryKey: ["addresses"], queryFn: () => getAddresses({ data: undefined }) });

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — FEALuxe" },
      { name: "description", content: "Manage your FEALuxe profile and addresses." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(profileQueryOptions());
    context.queryClient.ensureQueryData(addressesQueryOptions());
  },
  component: ProfilePage,
});

type Address = Awaited<ReturnType<typeof getAddresses>>[number];

const EMPTY_ADDRESS = { label: "Home", line1: "", line2: "", city: "", state: "", pincode: "", country: "India", isDefault: false };

function ProfilePage() {
  const { data: profile } = useSuspenseQuery(profileQueryOptions());
  const { data: addresses } = useSuspenseQuery(addressesQueryOptions());
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");

  const updateProfileFn = useServerFn(updateProfile);
  const deleteAddressFn = useServerFn(deleteAddress);

  const profileMutation = useMutation({
    mutationFn: updateProfileFn,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["profile"] }); toast.success("Profile updated"); },
    onError: (err: any) => toast.error(err?.message ?? "Could not update profile"),
  });

  const deleteAddressMutation = useMutation({
    mutationFn: deleteAddressFn,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["addresses"] }); toast.success("Address deleted"); },
    onError: (err: any) => toast.error(err?.message ?? "Could not delete address"),
  });

  const [editing, setEditing] = useState<Address | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  const openAdd = () => { setEditing(null); setShowForm(true); };
  const openEdit = (addr: Address) => { setEditing(addr); setShowForm(true); };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container-luxe max-w-4xl py-12">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-light text-foreground md:text-4xl">My profile</h1>
          <Button variant="outline" onClick={handleSignOut}>Sign out</Button>
        </div>

        {/* Quick links */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2">
          <Link to="/orders" className="card-luxe card-hover flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary"><Package className="h-5 w-5" /></span>
            <span className="font-medium text-foreground">My orders</span>
          </Link>
          <Link to="/wishlist" className="card-luxe card-hover flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary"><Heart className="h-5 w-5" /></span>
            <span className="font-medium text-foreground">My wishlist</span>
          </Link>
        </div>

        <Tabs defaultValue="profile" className="mt-8">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="addresses">Addresses</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="card-luxe mt-6 p-6">
            <form onSubmit={(e) => { e.preventDefault(); profileMutation.mutate({ data: { fullName, phone } }); }} className="space-y-4">
              <div><Label htmlFor="fullName">Full name</Label><Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1.5" /></div>
              <div><Label htmlFor="phone">Phone</Label><Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5" placeholder="+91…" /></div>
              <Button type="submit" className="btn-gold" disabled={profileMutation.isPending}>
                {profileMutation.isPending ? "Saving…" : "Save profile"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="addresses" className="mt-6 space-y-6">
            <div className="card-luxe p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl text-foreground">Saved addresses</h2>
                {!showForm && (
                  <Button size="sm" variant="outline" onClick={openAdd}><Plus className="h-4 w-4" /> Add</Button>
                )}
              </div>
              {addresses.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No saved addresses yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="flex items-start justify-between rounded-md border border-input p-4">
                      <div>
                        <p className="font-medium text-foreground">
                          {addr.label} {addr.is_default && <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Default</span>}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}, {addr.state} — {addr.pincode}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(addr)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteAddressMutation.mutate({ data: { addressId: addr.id } })} aria-label="Delete"><X className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showForm && (
              <AddressForm
                key={editing?.id ?? "new"}
                address={editing}
                onDone={() => setShowForm(false)}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function AddressForm({ address, onDone }: { address: Address | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(createAddress);
  const updateFn = useServerFn(updateAddress);

  const [form, setForm] = useState({
    label: address?.label ?? EMPTY_ADDRESS.label,
    line1: address?.line1 ?? "",
    line2: address?.line2 ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    pincode: address?.pincode ?? "",
    country: address?.country ?? "India",
    isDefault: address?.is_default ?? false,
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      if (address) await updateFn({ data: { addressId: address.id, ...data } });
      else await createFn({ data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success(address ? "Address updated" : "Address saved");
      onDone();
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not save address"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.line1 || !form.city || !form.state || !form.pincode) return toast.error("Please complete the address");
    mutation.mutate(form);
  };

  return (
    <div className="card-luxe p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-foreground">{address ? "Edit address" : "Add address"}</h2>
        <Button variant="ghost" size="icon" onClick={onDone} aria-label="Close"><X className="h-4 w-4" /></Button>
      </div>
      <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label>Label</Label><Input value={form.label} onChange={(e) => set({ label: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label>Line 1</Label><Input required value={form.line1} onChange={(e) => set({ line1: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label>Line 2</Label><Input value={form.line2} onChange={(e) => set({ line2: e.target.value })} /></div>
        <div><Label>City</Label><Input required value={form.city} onChange={(e) => set({ city: e.target.value })} /></div>
        <div><Label>State</Label><Input required value={form.state} onChange={(e) => set({ state: e.target.value })} /></div>
        <div><Label>Pincode</Label><Input required value={form.pincode} onChange={(e) => set({ pincode: e.target.value })} /></div>
        <div><Label>Country</Label><Input value={form.country} onChange={(e) => set({ country: e.target.value })} /></div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Switch id="default" checked={form.isDefault} onCheckedChange={(v) => set({ isDefault: v })} />
          <Label htmlFor="default" className="font-normal">Set as default address</Label>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" className="btn-gold" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : address ? "Save changes" : "Save address"}
          </Button>
        </div>
      </form>
    </div>
  );
}
