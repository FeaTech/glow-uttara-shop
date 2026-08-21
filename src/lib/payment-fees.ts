/** Razorpay domestic card rate: 2% + 18% GST = 2.36% */
export const ONLINE_PAYMENT_FEE_RATE = 0.0236;

/** Indian GST rate applicable on cosmetics (prices are GST-inclusive) */
export const GST_RATE = 0.18;

export function calculateOnlineFee(baseInr: number): number {
  return Math.round(Math.max(0, baseInr) * ONLINE_PAYMENT_FEE_RATE);
}

/** GST already included inside a GST-inclusive amount */
export function includedGst(inclusiveInr: number): number {
  const amount = Math.max(0, inclusiveInr);
  return Math.round(amount - amount / (1 + GST_RATE));
}
