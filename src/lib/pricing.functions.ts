import { createServerFn } from "@tanstack/react-start";
import {
  DEFAULT_CREDIT_CARD_FEE_BPS,
  DEFAULT_TAX_RATE_BPS,
  type PricingConfig,
} from "@/lib/pricing";

function percentEnvToBps(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round(parsed * 100);
}

/**
 * Server-side source of truth for the tax and card-fee rates. Configure with
 * the TAX_RATE_PERCENT and CREDIT_CARD_FEE_PERCENT environment variables.
 */
export function resolvePricingConfig(): PricingConfig {
  return {
    taxRateBps: percentEnvToBps(process.env["TAX_RATE_PERCENT"], DEFAULT_TAX_RATE_BPS),
    creditCardFeeBps: percentEnvToBps(
      process.env["CREDIT_CARD_FEE_PERCENT"],
      DEFAULT_CREDIT_CARD_FEE_BPS,
    ),
  };
}

/** Public: the storefront needs these rates to render the price breakdown. */
export const getPricingConfig = createServerFn({ method: "GET" }).handler(async () =>
  resolvePricingConfig(),
);
