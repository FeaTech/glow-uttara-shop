/** Indian-rupee and date formatting helpers used across the storefront. */

export function formatINR(value: number | null | undefined): string {
  return `₹${(value ?? 0).toLocaleString("en-IN")}`;
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function discountPercent(price: number, compare?: number | null): number | null {
  if (!compare || compare <= price) return null;
  return Math.round(((compare - price) / compare) * 100);
}

export const PLACEHOLDER_IMAGE =
  "https://placehold.co/600x600/efe6da/9c7a52?text=FEALuxy";

export function productImage(images: unknown, index = 0): string {
  const arr = Array.isArray(images) ? (images as string[]) : [];
  return arr[index] ?? PLACEHOLDER_IMAGE;
}
