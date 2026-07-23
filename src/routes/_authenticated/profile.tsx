import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getProfile, getAddresses, createAddress, updateAddress, deleteAddress, updateProfile } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const profileQueryOptions = () =>
  queryOptions({
    queryKey: ["profile"],
    queryFn: () => getProfile({ data: undefined }),
  });

const addressesQueryOptions = () =>
  queryOptions({
    queryKey: ["addresses"],
    queryFn: () => getAddresses({ data: undefined }),
  });

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — FEALuxy" },
      { name: "description", content: "Manage your FEALuxy profile and addresses." },
      { property: "og:title", content: "My profile — FEALuxy" },
      { property: "og:description", content: "Manage your FEALuxy profile and addresses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(profileQueryOptions());
    context.queryClient.ensureQueryData(addressesQueryOptions());
  },
  component: ProfilePage,
});

function ProfilePage() {
  const { data: profile } = useSuspenseQuery(profileQueryOptions());
  const { data: addresses } = useSuspenseQuery(addressesQueryOptions());
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");

  const updateProfileFn = useServerFn(updateProfile);
  const createAddressFn = useServerFn(createAddress);
  const updateAddressFn = useServerFn(updateAddress);
  const deleteAddressFn = useServerFn(deleteAddress);

  const profileMutation = useMutation({
    mutationFn: updateProfileFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not update profile"),
  });

  const addressMutation = useMutation({
    mutationFn: createAddressFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Address saved");
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not save address"),
  });

  const deleteAddressMutation = useMutation({
    mutationFn: deleteAddressFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Address deleted");
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not delete address"),
  });

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  const [newAddress, setNewAddress] = useState({
    label: "Home",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    isDefault: false,
  });

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    addressMutation.mutate({ data: newAddress });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-light text-foreground">My profile</h1>
          <Button variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>

        <Tabs defaultValue="profile" className="mt-8">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="addresses">Addresses</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="card-luxe mt-6 p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                profileMutation.mutate({ data: { fullName, phone } });
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <Button type="submit" className="btn-gold" disabled={profileMutation.isPending}>
                {profileMutation.isPending ? "Saving..." : "Save profile"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="addresses" className="mt-6 space-y-6">
            <div className="card-luxe p-6">
              <h2 className="font-serif text-xl text-foreground">Saved addresses</h2>
              {addresses.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No saved addresses yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="flex items-start justify-between rounded-md border border-input p-4">
                      <div>
                        <p className="font-medium text-foreground">
                          {addr.label} {addr.is_default && <span className="text-xs text-primary">(default)</span>}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}, {addr.state} — {addr.pincode}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-sm text-destructive hover:underline"
                        onClick={() => deleteAddressMutation.mutate({ data: { addressId: addr.id } })}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card-luxe p-6">
              <h2 className="font-serif text-xl text-foreground">Add address</h2>
              <form onSubmit={handleSaveAddress} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Label</Label>
                  <Input value={newAddress.label} onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Line 1</Label>
                  <Input required value={newAddress.line1} onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Line 2</Label>
                  <Input value={newAddress.line2} onChange={(e) => setNewAddress({ ...newAddress, line2: e.target.value })} />
                </div>
                <div>
                  <Label>City</Label>
                  <Input required value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} />
                </div>
                <div>
                  <Label>State</Label>
                  <Input required value={newAddress.state} onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })} />
                </div>
                <div>
                  <Label>Pincode</Label>
                  <Input required value={newAddress.pincode} onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })} />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input value={newAddress.country} onChange={(e) => setNewAddress({ ...newAddress, country: e.target.value })} />
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <input
                    id="default"
                    type="checkbox"
                    checked={newAddress.isDefault}
                    onChange={(e) => setNewAddress({ ...newAddress, isDefault: e.target.checked })}
                  />
                  <Label htmlFor="default" className="font-normal">Set as default address</Label>
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" className="btn-gold" disabled={addressMutation.isPending}>
                    {addressMutation.isPending ? "Saving..." : "Save address"}
                  </Button>
                </div>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
