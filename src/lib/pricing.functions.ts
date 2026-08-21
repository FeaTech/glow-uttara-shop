import { createServerFn } from "@tanstack/react-start";

/** Public: the storefront needs the tax / card-fee rates to render the breakdown. */
export const getPricingConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { resolvePricingConfig } = await import("@/lib/pricing.server");
  return resolvePricingConfig();
});
