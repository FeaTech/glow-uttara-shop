/**
 * Money maths for checkout. Everything is computed in paise (integers) so we
 * never hit JavaScript floating-point errors, and so the amount shown on the
 * checkout page is byte-for-byte the amount sent to Razorpay.
 */

export type PaymentChannel =
  | "cod"
  | "upi"
  | "credit_card"
  | "debit_card"
  | "netbanking"
  | "wallet";

export const ONLINE_CHANNELS: PaymentChannel[] = [
  "upi",
  "credit_card",
  "debit_card",
  "netbanking",
  "wallet",
];

export const PAYMENT_CHANNEL_LABELS: Record<PaymentChannel, string> = {
  cod: "Cash on delivery",
  upi: "UPI",
  credit_card: "Credit card",
  debit_card: "Debit card",
  netbanking: "Net banking",
  wallet: "Wallet",
};

/** Razorpay Checkout `method` keys for each channel we support. */
export const RAZORPAY_METHOD_BY_CHANNEL: Record<
  Exclude<PaymentChannel, "cod">,
  "upi" | "card" | "netbanking" | "wallet"
> = {
  upi: "upi",
  credit_card: "card",
  debit_card: "card",
  netbanking: "netbanking",
  wallet: "wallet",
};

/** Defaults; overridable through TAX_RATE_PERCENT / CREDIT_CARD_FEE_PERCENT. */
export const DEFAULT_TAX_RATE_BPS = 1800; // 18.00%
export const DEFAULT_CREDIT_CARD_FEE_BPS = 300; // 3.00%

export type PricingConfig = { taxRateBps: number; creditCardFeeBps: number };

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  taxRateBps: DEFAULT_TAX_RATE_BPS,
  creditCardFeeBps: DEFAULT_CREDIT_CARD_FEE_BPS,
};

export function isPaymentChannel(value: string): value is PaymentChannel {
  return value in PAYMENT_CHANNEL_LABELS;
}

/** Only credit cards carry a processing fee. */
export function feeBpsForChannel(channel: PaymentChannel, config: PricingConfig): number {
  return channel === "credit_card" ? config.creditCardFeeBps : 0;
}

export type OrderTotals = {
  subtotalPaise: number;
  discountPaise: number;
  taxablePaise: number;
  taxRateBps: number;
  taxPaise: number;
  amountBeforeFeePaise: number;
  feeRateBps: number;
  feePaise: number;
  totalPaise: number;
};

export function computeOrderTotals(input: {
  subtotalPaise: number;
  discountPaise: number;
  channel: PaymentChannel;
  config: PricingConfig;
}): OrderTotals {
  const subtotalPaise = Math.max(0, Math.round(input.subtotalPaise));
  const discountPaise = Math.min(subtotalPaise, Math.max(0, Math.round(input.discountPaise)));
  const taxablePaise = subtotalPaise - discountPaise;

  const taxRateBps = Math.max(0, Math.round(input.config.taxRateBps));
  const taxPaise = Math.round((taxablePaise * taxRateBps) / 10000);
  const amountBeforeFeePaise = taxablePaise + taxPaise;

  const feeRateBps = feeBpsForChannel(input.channel, input.config);
  const feePaise = Math.round((amountBeforeFeePaise * feeRateBps) / 10000);
  const totalPaise = amountBeforeFeePaise + feePaise;

  return {
    subtotalPaise,
    discountPaise,
    taxablePaise,
    taxRateBps,
    taxPaise,
    amountBeforeFeePaise,
    feeRateBps,
    feePaise,
    totalPaise,
  };
}

/** "18" from 1800 bps, "2.5" from 250 bps. */
export function bpsToPercentLabel(bps: number): string {
  const pct = bps / 100;
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/0$/, "");
}
