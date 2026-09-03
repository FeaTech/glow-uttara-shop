import type { ProductType } from "@/lib/products.functions";

/**
 * The three customer-facing collections. Single source of truth for the
 * labels, copy and colour identity used by the home-page collection picker,
 * the product cards and the product detail badge.
 */
export interface Collection {
  key: ProductType;
  label: string;
  /** Compact label for badges, where "beauty" is redundant. */
  badgeLabel: string;
  tagline: string;
  /** Tailwind classes for the small badge shown on cards. */
  badgeClass: string;
}

export const COLLECTIONS: Collection[] = [
  {
    key: "korean",
    label: "Korean beauty",
    badgeLabel: "Korean beauty",
    tagline: "Glass-skin rituals and luminous, layered care.",
    badgeClass: "bg-rose-500 text-white",
  },
  {
    key: "organic",
    label: "Organic beauty",
    badgeLabel: "Organic",
    tagline: "Clean, plant-based formulas that let skin breathe.",
    badgeClass: "bg-emerald-600 text-white",
  },
  {
    key: "budget",
    label: "Budget beauty",
    badgeLabel: "Budget",
    tagline: "Everyday essentials that never feel like a compromise.",
    badgeClass: "bg-amber-500 text-white",
  },
];

export const COLLECTION_BY_KEY: Record<string, Collection> = Object.fromEntries(
  COLLECTIONS.map((c) => [c.key, c]),
);
