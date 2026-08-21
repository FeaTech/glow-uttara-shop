import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Tag, X, Check } from "lucide-react";
import { getCart } from "@/lib/cart.functions";
import { getAddresses } from "@/lib/profile.functions";
import { createOrder } from "@/lib/orders.functions";
import { createRazorpayOrder, verifyRazorpayPayment } from "@/lib/razorpay.functions";
import { loadRazorpayScript, openRazorpayCheckout } from "@/lib/razorpay-checkout";
import { releaseOrderCoupon, validateCoupon } from "@/lib/coupons.functions";
import { calculateOnlineFee } from "@/lib/payment-fees";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";

const cartQueryOptions = () =>
  queryOptions({ queryKey: ["cart"], queryFn: () => getCart({ data: undefined }) });

const addressesQueryOptions = () =>
  queryOptions({ queryKey: ["addresses"], queryFn: () => getAddresses({ data: undefined }) });

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — FEA Glam" },
      { name: "description", content: "Complete your FEA Glam order." },
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
  const validateCouponFn = useServerFn(validateCoupon);
  const releaseOrderCouponFn = useServerFn(releaseOrderCoupon);
  const createRazorpayOrderFn = useServerFn(createRazorpayOrder);
  const verifyRazorpayPaymentFn = useServerFn(verifyRazorpayPayment);

  const [selectedAddressId, setSelectedAddressId] = useState<string | undefined>(addresses[0]?.id);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online">("cod");
  const [newAddress, setNewAddress] = useState({ label: "Home", line1: "", line2: "", city: "", state: "", pincode: "", country: "India" });
  const [showNewAddress, setShowNewAddress] = useState(addresses.length === 0);

  const [couponInput, setCouponInput] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const subtotal = cart.total;
  const discount = applied?.discount ?? 0;
  const base = Math.max(0, subtotal - discount);
  const taxes = paymentMethod === "online" ? calculateOnlineFee(base) : 0;
  const gst = includedGst(base);
  const total = base + taxes;

  const couponMutation = useMutation({
    mutationFn: (code: string) => validateCouponFn({ data: { code, subtotal } }),
    onSuccess: (result) => {
      if (result.valid) {
        setApplied({ code: result.code, discount: result.discount });
        setCouponError(null);
        toast.success(`Coupon ${result.code} applied — you saved ${formatINR(result.discount)}`);
      } else {
        setApplied(null);
        setCouponError(result.message);
      }
    },
    onError: () => setCouponError("Could not validate coupon"),
  });

  const orderMutation = useMutation({
    mutationFn: async (variables: {
      data: {
        shippingAddress: {
          label?: string;
          line1: string;
          line2?: string;
          city: string;
          state: string;
          pincode: string;
          country: string;
        };
        paymentMethod: "cod" | "online";
        couponCode?: string;
      };
    }) => {
      const { orderId } = await createOrderFn(variables);
      if (variables.data.paymentMethod !== "online") return { orderId, paid: false };

      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Could not load the payment gateway. Please try again.");

      const session = await createRazorpayOrderFn({ data: { orderId } });
      const result = await openRazorpayCheckout(session);
      if (!result) {
        await releaseOrderCouponFn({ data: { orderId } });
        throw new Error("Payment cancelled — your order is saved as pending payment.");
      }

      await verifyRazorpayPaymentFn({
        data: {
          orderId,
          razorpayOrderId: result.razorpay_order_id,
          razorpayPaymentId: result.razorpay_payment_id,
          razorpaySignature: result.razorpay_signature,
        },
      });
      return { orderId, paid: true };
    },
    onSuccess: ({ paid }) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(paid ? "Payment successful — order confirmed!" : "Order placed successfully!");
      navigate({ to: "/orders" });
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.error(err?.message ?? "Could not place order");
    },
  });

  if (!cart.items.length) {
    return (
      <div className="container-luxe py-24 text-center">
        <h1 className="font-serif text-3xl font-light text-foreground">Your cart is empty</h1>
        <Button asChild className="btn-gold mt-6"><Link to="/products">Continue shopping</Link></Button>
      </div>
    );
  }

  const handlePlaceOrder = () => {
    let shippingAddress;
    if (showNewAddress) {
      if (!newAddress.line1 || !newAddress.city || !newAddress.state || !newAddress.pincode) {
        toast.error("Please complete the shipping address");
        return;
      }
      shippingAddress = { ...newAddress, label: newAddress.label || "Home" };
    } else {
      const addr = addresses.find((a) => a.id === selectedAddressId);
      if (!addr) { toast.error("Please select a shipping address"); return; }
      shippingAddress = { label: addr.label, line1: addr.line1, line2: addr.line2 ?? undefined, city: addr.city, state: addr.state, pincode: addr.pincode, country: addr.country };
    }
    orderMutation.mutate({ data: { shippingAddress, paymentMethod, couponCode: applied?.code } });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container-luxe py-12">
        <h1 className="font-serif text-3xl font-light text-foreground md:text-4xl">Checkout</h1>
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            {/* Address */}
            <section className="card-luxe p-6">
              <h2 className="font-serif text-xl text-foreground">Shipping address</h2>
              {addresses.length > 0 && !showNewAddress && (
                <RadioGroup value={selectedAddressId} onValueChange={setSelectedAddressId} className="mt-4 space-y-3">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="flex items-start space-x-3 rounded-md border border-input p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
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
                  <div className="sm:col-span-2"><Label>Address label</Label><Input value={newAddress.label} onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })} /></div>
                  <div className="sm:col-span-2"><Label>Address line 1</Label><Input value={newAddress.line1} onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })} /></div>
                  <div className="sm:col-span-2"><Label>Address line 2</Label><Input value={newAddress.line2} onChange={(e) => setNewAddress({ ...newAddress, line2: e.target.value })} /></div>
                  <div><Label>City</Label><Input value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} /></div>
                  <div><Label>State</Label><Input value={newAddress.state} onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })} /></div>
                  <div><Label>Pincode</Label><Input value={newAddress.pincode} onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })} /></div>
                  <div><Label>Country</Label><Input value={newAddress.country} onChange={(e) => setNewAddress({ ...newAddress, country: e.target.value })} /></div>
                </div>
              )}
              {addresses.length > 0 && (
                <Button variant="outline" className="mt-4" onClick={() => setShowNewAddress(!showNewAddress)}>
                  {showNewAddress ? "Use saved address" : "Add new address"}
                </Button>
              )}
            </section>

            {/* Payment */}
            <section className="card-luxe p-6">
              <h2 className="font-serif text-xl text-foreground">Payment method</h2>
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "cod" | "online")} className="mt-4 space-y-3">
                <div className="flex items-center space-x-3 rounded-md border border-input p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <RadioGroupItem value="cod" id="cod" />
                  <Label htmlFor="cod" className="cursor-pointer font-normal">Cash on delivery</Label>
                </div>
                <div className="flex items-center space-x-3 rounded-md border border-input p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <RadioGroupItem value="online" id="online" />
                  <Label htmlFor="online" className="cursor-pointer font-normal">Pay online (UPI / card / net banking)</Label>
                </div>
              </RadioGroup>
              {paymentMethod === "online" && (
                <p className="mt-3 text-xs text-muted-foreground">A secure payment link will be generated after you place the order.</p>
              )}
            </section>
          </div>

          {/* Summary */}
          <div className="card-luxe h-fit p-6 lg:sticky lg:top-24">
            <h2 className="font-serif text-xl text-foreground">Order summary</h2>
            <div className="mt-4 space-y-3">
              {cart.items.map((item) => {
                const price = item.product_variants?.price_inr ?? item.products?.price_inr ?? 0;
                return (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.products?.name}{item.product_variants?.variant_name ? ` — ${item.product_variants.variant_name}` : ""} × {item.quantity}
                    </span>
                    <span className="text-foreground">{formatINR(price * item.quantity)}</span>
                  </div>
                );
              })}
            </div>

            {/* Coupon */}
            <div className="mt-5 border-t border-border pt-5">
              {applied ? (
                <div className="flex items-center justify-between rounded-md bg-primary/10 px-3 py-2 text-sm">
                  <span className="inline-flex items-center gap-2 font-medium text-primary">
                    <Check className="h-4 w-4" /> {applied.code}
                  </span>
                  <button onClick={() => { setApplied(null); setCouponInput(""); }} className="text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Coupon code"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        className="pl-9 uppercase"
                      />
                    </div>
                    <Button variant="outline" disabled={!couponInput || couponMutation.isPending} onClick={() => couponMutation.mutate(couponInput)}>
                      {couponMutation.isPending ? "…" : "Apply"}
                    </Button>
                  </div>
                  {couponError && <p className="mt-2 text-xs text-destructive">{couponError}</p>}
                </>
              )}
            </div>

            <div className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
              {discount > 0 && (
                <div className="flex justify-between text-primary"><span>Discount</span><span>−{formatINR(discount)}</span></div>
              )}
              <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span className="text-emerald-600 dark:text-emerald-400">Free</span></div>
              <div className="flex justify-between text-muted-foreground"><span>GST ({Math.round(GST_RATE * 100)}%, included)</span><span>{formatINR(gst)}</span></div>
              {taxes > 0 && (
                <div className="flex justify-between text-muted-foreground"><span>Online payment charges</span><span>{formatINR(taxes)}</span></div>
              )}
            </div>
            <div className="mt-4 flex justify-between border-t border-border pt-4 text-lg font-semibold text-foreground">
              <span>Total</span><span>{formatINR(total)}</span>
            </div>

            <Button className="btn-gold mt-6 w-full" onClick={handlePlaceOrder} disabled={orderMutation.isPending}>
              {orderMutation.isPending ? "Placing order…" : `Place order · ${formatINR(total)}`}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">By placing this order you agree to our terms.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
