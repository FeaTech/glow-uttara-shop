# Admin Orders: search + filters

Today the Orders page only has a date-range picker and pagination. Everything else (status, payment, customer) has to be found by eye. This adds a search bar and the filters that actually matter for running fulfilment.

## What you get

A filter bar above the table:

- **Search box** — type an order number (e.g. `A1B2C3D4` or the full ID), a customer email, a customer name, or a coupon code. Results update as you type (short debounce).
- **Order status** — All / Pending / Processing / Shipped / Delivered / Cancelled.
- **Payment status** — All / Pending / Paid / Failed / Refunded.
- **Payment method** — All / Razorpay (online) / Cash on delivery.
- **Date range** — the existing picker, kept as-is.
- **Sort** — Newest first (default), Oldest first, Highest value, Lowest value.
- **Clear all** — one button that resets every filter, shown only when a filter is active.

Supporting behaviour:

- Active filters show as small removable chips so it is obvious why the list is short.
- The header line updates to "12 of 340 orders · filtered".
- All filters live in the page URL, so a filtered view can be bookmarked or shared with another admin, and going back keeps your place.
- Changing any filter resets to page 1.
- Empty state changes from "No orders yet." to "No orders match these filters." with a clear-filters link.

## Technical notes

- `listOrdersSchema` in `src/lib/admin.functions.ts` gains: `q`, `paymentStatus`, `paymentMethod`, `sort`. `status` already exists but is not wired to the UI yet.
- Search is handled server-side in `adminListOrders`:
  - If the term looks like a UUID prefix, match on `orders.id`.
  - Otherwise match `customer_email` and `coupon_code` with a case-insensitive `ilike`, plus a name lookup against `profiles.full_name` (trigram index already exists via `pg_trgm`) to collect matching `user_id`s and include those orders. Combined with `.or(...)`.
- Sorting maps to `order("created_at" | "total_inr", { ascending })`.
- Count stays `{ count: "exact" }` so pagination remains correct under filters.
- `src/routes/admin.orders.tsx`: extend `validateSearch` with the new params (plain strings with defaults, clamped in the component), add a `FilterBar` block above the table, debounce the search input (~300ms) before pushing it into the URL, and include all params in the react-query key.
- Realtime invalidation and the existing status/payment update dropdowns are untouched.

## Optional (say the word)

- Export the filtered result set to CSV.
- Quick chips for "Needs action" (pending + paid) and "Payment failed".
