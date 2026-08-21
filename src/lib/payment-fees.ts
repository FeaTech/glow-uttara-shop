/** Razorpay domestic card rate: 2% + 18% GST = 2.36% */
export const ONLINE_PAYMENT_FEE_RATE = 0.0236;

export function calculateOnlineFee(baseInr: number): number {
  return Math.round(Math.max(0, baseInr) * ONLINE_PAYMENT_FEE_RATE);
}
