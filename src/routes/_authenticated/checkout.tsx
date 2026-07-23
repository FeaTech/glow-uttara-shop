import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getCart } from "@/lib/cart.functions";
import { getAddresses } from "@/lib/profile.functions";
import { createOrder } from "@/lib/orders.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

const cartQueryOptions = () =>
  queryOptions({
    queryKey: ["cart"],
    queryFn: () => getCart({ data: undefined }),
  });

const addressesQueryOptions = () =>
  queryOptions({
    queryKey: ["addresses"],
    queryFn: () => getAddresses({ data: undefined }),
  });

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — FEALuxy" },
      { name: "description", content: "Complete your FEALuxy order." },
      { property: "og:title", content: "Checkout — FEALuxy" },
      { property: "og:description", content: "Complete your FEALuxy order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(cartQueryOptions());
    context.queryClient.ensureQueryData(addressesQueryOptions());
  },
  component: CheckoutPage,
});

function CheckoutPage() {
  const { data: cart } = useSuspenseQuery(cartQueryOptions());
  const { data: addresses } = useSuspenseQuery(addressesQueryOptions());
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createOrderFn = useServerFn(createOrder);
  const [selectedAddressId, setSelectedAddressId] = useState<string | undefined>(addresses[0]?.id);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online">("cod");
  const [newAddress, setNewAddress] = useState({ label: "Home", line1: "", line2: "", city: "", state: "", pincode: "", country: "India" });
  const [showNewAddress, setShowNewAddress] = useState(addresses.length === 0);
  const [placing, setPlacing] = useState(false);

  const orderMutation = useMutation({
    mutationFn: createOrderFn,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order placed successfully!");
      navigate({ to: "/orders" });
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not place order"),
  });

  if (!cart.items.length) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <h1 className="font-serif text-3xl font-light text-foreground">Your cart is empty</h1>
        <Button asChild className="mt-6 btn-gold">
          <Link to="/products">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  const handlePlaceOrder = async () => {
    setPlacing(true);
    try {
      let shippingAddress;
      if (showNewAddress) {
        shippingAddress = { ...newAddress, label: newAddress.label || "Home" };
      } else {
        const addr = addresses.find((a) => a.id === selectedAddressId);
        if (!addr) {
          toast.error("Please select a shipping address");
          return;
        }
        shippingAddress = {
          label: addr.label,
          line1: addr.line1,
          line2: addr.line2,
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
          country: addr.country,
        };
      }
      await orderMutation.mutateAsync({ data: { shippingAddress, paymentMethod } });
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="font-serif text-3xl font-light text-foreground">Checkout</h1>
        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <section className="card-luxe p-6">
              <h2 className="font-serif text-xl text-foreground">Shipping address</h2>
              {addresses.length > 0 && !showNewAddress && (
                <RadioGroup value={selectedAddressId} onValueChange={setSelectedAddressId} className="mt-4 space-y-3">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="flex items-start space-x-3 rounded-md border border-input p-4">
                      <RadioGroupItem value={addr.id} id={addr.id} />
                      <Label htmlFor={addr.id} className="cursor-pointer font-normal">
                        <span className="font-medium">{addr.label}</span>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}, {addr.state} — {addr.pincode}
                        </p>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
              {showNewAddress && (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label>Address label</Label>
                    <Input value={newAddress.label} onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Address line 1</Label>
                    <Input value={newAddress.line1} onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Address line 2</Label>
                    <Input value={newAddress.line2} onChange={(e) => setNewAddress({ ...newAddress, line2: e.target.value })} />
                  </div>
                  <div>
                    <Label>City</Label>
                    <Input value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} />
                  </div>
                  <div>
                    <Label>State</Label>
                    <Input value={newAddress.state} onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })} />
                  </div>
                  <div>
                    <Label>Pincode</Label>
                    <Input value={newAddress.pincode} onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })} />
                  </div>
                  <div>
                    <Label>Country</Label>
                    <Input value={newAddress.country} onChange={(e) => setNewAddress({ ...newAddress, country: e.target.value })} />
                  </div>
                </div>
              )}
              <Button variant="outline" className="mt-4" onClick={() => setShowNewAddress(!showNewAddress)}>
                {showNewAddress ? "Use saved address" : "Add new address"}
              </Button>
            </section>

            <section className="card-luxe p-6">
              <h2 className="font-serif text-xl text-foreground">Payment method</h2>
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "cod" | "online")} className="mt-4 space-y-3">
                <div className="flex items-center space-x-3 rounded-md border border-input p-4">
                  <RadioGroupItem value="cod" id="cod" />
                  <Label htmlFor="cod" className="cursor-pointer font-normal">Cash on delivery</Label>
                </div>
                <div className="flex items-center space-x-3 rounded-md border border-input p-4">
                  <RadioGroupItem value="online" id="online" />
                  <Label htmlFor="online" className="cursor-pointer font-normal">Pay online (UPI / card / net banking)</Label>
                </div>
              </RadioGroup>
            </section>
          </div>

          <div className="card-luxe h-fit p-6">
            <h2 className="font-serif text-xl text-foreground">Order summary</h2>
            <div className="mt-4 space-y-3">
              {cart.items.map((item) => {
                const price = item.product_variants?.price_inr ?? item.products?.price_inr ?? 0;
                return (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.products?.name} × {item.quantity}</span>
                    <span className="text-foreground">₹{(price * item.quantity).toLocaleString("en-IN")}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 border-t pt-4">
              <div className="flex justify-between text-lg font-semibold text-foreground">
                <span>Total</span>
                <span>₹{cart.total.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <Button className="mt-6 w-full btn-gold" onClick={handlePlaceOrder} disabled={placing}>
              {placing ? "Placing order..." : "Place order"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
