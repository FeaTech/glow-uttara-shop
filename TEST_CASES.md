# FEA Glam / Glow Uttara Shop — QA Test Cases

This is the release test plan for the storefront, customer account, checkout, coupons, referrals, reviews, and admin panel. Execute the smoke suite on every deployment and the full regression suite before release.

## Test data and roles

Use a disposable Supabase project or test database. Never use real customer or payment data.

| Data | Purpose |
|---|---|
| `customer1@example.test` | Existing customer with orders, addresses, wishlist, and review |
| `customer2@example.test` | Existing customer with no order in the current month |
| `newcustomer@example.test` | Newly registered customer with no orders |
| `admin@example.test` | User with the admin role |
| `nonadmin@example.test` | Authenticated customer without admin role |
| Product A | In-stock, no variants |
| Product B | In-stock, multiple variants |
| Product C | Out of stock |
| Coupon `ALL10` | Everyone, 10% off, min order ₹1,000, max discount ₹500 |
| Coupon `FIXED200` | Fixed ₹200 off, min order ₹1,000 |
| Coupon `MONTHLY2` | Everyone, monthly customer limit 2, overall limit 10 |
| Coupon `GLOBAL1` | Overall usage limit 1 |
| Coupon `NEW10` | New-customers eligibility |
| Coupon `EXPIRED` | Expired coupon |
| Coupon `FUTURE` | Starts in the future |

Record for every case: build/version, browser/device, test user, input data, actual result, screenshot/video, console/network errors, and pass/fail.

## Priority and execution

- **P0:** Blocks login, checkout, payment, security, order creation, or data integrity.
- **P1:** Core customer/admin feature is broken or produces an incorrect business result.
- **P2:** Non-critical UI, validation, accessibility, or reporting issue.

## A. Smoke tests — run on every deployment

| ID | Pri | Test | Expected result |
|---|---|---|---|
| SM-01 | P0 | Open home page as a logged-out user | Page loads without uncaught errors; logo says “KOREAN BEAUTY INSPIRED”; products/categories render. |
| SM-02 | P0 | Open product listing and product detail | Listing, image, price, stock, variant controls, and add-to-cart work. |
| SM-03 | P0 | Register a new customer and sign in | Account is created, session persists, and header shows “Welcome, [name]”. |
| SM-04 | P0 | Add an in-stock product to cart | Cart count and cart contents update correctly. |
| SM-05 | P0 | Complete a COD checkout | One order is created with correct items, totals, address, and pending payment status. |
| SM-06 | P0 | Open order history and order detail | Customer sees the new order and only their own data. |
| SM-07 | P0 | Apply a valid coupon during checkout | Discount is calculated server-side and total decreases correctly. |
| SM-08 | P0 | Sign in as admin and open dashboard | Admin dashboard loads; non-admin cannot access it. |
| SM-09 | P1 | Open admin customer row | Full customer details dialog opens with profile, addresses, and orders. |
| SM-10 | P1 | Create and edit a coupon as admin | Coupon saves and appears with monthly limit and no lifetime-limit field. |
| SM-11 | P0 | Run production build | `npm run build` succeeds with no TypeScript/build errors. |

## B. Public storefront and navigation

| ID | Pri | Test | Expected result |
|---|---|---|---|
| PUB-01 | P1 | Load home page on desktop, tablet, and mobile | Layout has no overlap, horizontal scroll, or clipped content. |
| PUB-02 | P1 | Navigate every header/footer link | Each link opens the correct route and preserves expected navigation state. |
| PUB-03 | P1 | Use browser Back/Forward on listing/detail/cart | Route and visible state remain consistent. |
| PUB-04 | P1 | Refresh every public route | Route reloads successfully without a blank page or 404. |
| PUB-05 | P1 | Open an invalid product slug | Friendly not-found state appears; application does not crash. |
| PUB-06 | P1 | Search/filter/sort products, if present | Results match the selected query/filter and empty results are handled clearly. |
| PUB-07 | P1 | Open a category with no products | Empty state is useful and does not throw an error. |
| PUB-08 | P1 | Product with missing image, long name, zero rating, or zero price | Safe fallback image/text and non-overflowing layout are shown. |
| PUB-09 | P1 | Product with multiple images | Images load, change correctly, and do not show the wrong product. |
| PUB-10 | P2 | Subscribe with valid email | Success message appears and duplicate subscription is handled gracefully. |
| PUB-11 | P2 | Subscribe with blank, malformed, very long, or mixed-case email | Client/server validation rejects invalid input without exposing internals. |
| PUB-12 | P2 | Submit contact/FAQ forms, if available | Required fields validate; successful and failed submissions are understandable. |
| PUB-13 | P2 | Open robots/sitemap routes | Valid response format is returned and no app error is shown. |
| PUB-14 | P2 | Use keyboard only | All interactive controls are reachable and operable in logical order. |
| PUB-15 | P2 | Use screen reader/zoom to 200% | Labels, focus, headings, dialogs, and contrast remain usable. |

## C. Authentication and session handling

| ID | Pri | Test | Expected result |
|---|---|---|---|
| AUTH-01 | P0 | Register with valid unique email/password | Account is created or confirmation flow is shown according to environment settings. |
| AUTH-02 | P1 | Register with duplicate email | Clear error; no duplicate profile is created. |
| AUTH-03 | P1 | Register with blank, invalid, short, and very long values | Validation is enforced client and server side. |
| AUTH-04 | P0 | Sign in with valid credentials | User reaches intended page and session is established. |
| AUTH-05 | P1 | Sign in with wrong password or unknown email | Generic safe error; no account enumeration. |
| AUTH-06 | P1 | Sign out | Session is cleared, protected routes redirect, and cached private data disappears. |
| AUTH-07 | P0 | Open `/checkout`, `/orders`, `/profile`, `/wishlist`, or `/referrals` logged out | User is redirected to authentication without losing safe navigation context. |
| AUTH-08 | P1 | Refresh after login | Session remains valid and welcome name is correct. |
| AUTH-09 | P1 | Change display name/profile details | Saved value appears in header and profile after refresh. |
| AUTH-10 | P1 | Request password reset with valid, unknown, malformed, and blank email | Safe response and correct email flow; no sensitive details leak. |
| AUTH-11 | P0 | Use expired/used/altered reset token | Reset is rejected safely and user can request a new one. |
| AUTH-12 | P1 | Open admin route as non-admin | Access is denied server-side, not only hidden in UI. |
| AUTH-13 | P0 | Tamper with auth cookie/JWT or change user ID in request | Request is rejected; no cross-account access. |
| AUTH-14 | P1 | Sign out in one tab while another tab is open | Other tab reacts safely and does not continue private mutations. |

## D. Catalog, variants, cart, and wishlist

| ID | Pri | Test | Expected result |
|---|---|---|---|
| CAT-01 | P1 | View product with no variant | Correct add-to-cart behavior and quantity are shown. |
| CAT-02 | P1 | View product with required variants | Variant must be selected before add-to-cart; selected SKU/price/stock is used. |
| CAT-03 | P1 | Switch variants with different prices/stock | Price, stock, image, and selected value update together. |
| CAT-04 | P0 | Add quantity 1, increase, decrease, and remove | Inventory/cart totals update exactly; quantity never becomes negative or zero unexpectedly. |
| CAT-05 | P0 | Add more than available stock | UI and server reject excess quantity. |
| CAT-06 | P0 | Product becomes out of stock while in cart | Checkout revalidates and prevents overselling. |
| CAT-07 | P1 | Add same product/variant twice | Expected behavior is consistent: merged quantity or separate lines, never duplicate accidental stock deduction. |
| CAT-08 | P1 | Refresh cart and sign out/sign in again | Persisted cart behavior matches product requirements and does not leak between users. |
| CAT-09 | P1 | Add/remove wishlist item while logged in | Item is added/removed once and persists after refresh. |
| CAT-10 | P1 | Click wishlist while logged out | User is prompted to sign in; no anonymous private record is created. |
| CAT-11 | P1 | Rapidly click add-to-cart/wishlist | No duplicate mutation, race-condition corruption, or misleading success state. |
| CAT-12 | P2 | Use very long product text and unusual Unicode characters | UI remains safe, readable, and correctly encoded. |

## E. Checkout, pricing, inventory, and orders

| ID | Pri | Test | Expected result |
|---|---|---|---|
| ORD-01 | P0 | Checkout with one item and valid address | Order contains exact item, quantity, subtotal, shipping, discount, and total. |
| ORD-02 | P0 | Checkout with multiple items and variants | Each order item preserves correct product/variant name, price, and quantity. |
| ORD-03 | P1 | Save, edit, select, and delete addresses | Address ownership and default/selected behavior are correct. |
| ORD-04 | P0 | Submit blank, malformed, overlong, or script-containing address fields | Validation rejects unsafe/invalid input and does not corrupt order data. |
| ORD-05 | P0 | Submit checkout twice or double-click Place Order | At most one order is created for one intentional submission. |
| ORD-06 | P0 | Checkout with empty cart | Order cannot be created. |
| ORD-07 | P0 | Cart price changes before submit | Server uses authoritative current product price; client cannot set a lower price. |
| ORD-08 | P0 | Inventory changes between validation and order insert | Transaction/RPC prevents overselling and leaves inventory/order consistent. |
| ORD-09 | P1 | COD order | Payment method is COD and status fields are correct. |
| ORD-10 | P0 | Order creation/database failure | User sees recoverable error; no partial order, stock, or coupon reservation remains. |
| ORD-11 | P1 | Open order list with zero, one, and many orders | Correct empty/loading/paginated states and newest-first ordering. |
| ORD-12 | P0 | Open an order belonging to another user by changing URL ID | Access is denied/not found. |
| ORD-13 | P1 | Cancel eligible order | Status, inventory restoration, coupon release, payment/referral effects follow policy exactly. |
| ORD-14 | P1 | Attempt cancellation after shipped/delivered/cancelled | UI and server reject invalid transition. |
| ORD-15 | P1 | Admin changes order status through every valid transition | Allowed transitions work; invalid transitions are rejected and audited if applicable. |
| ORD-16 | P1 | Order status/payment emails | Correct recipient, order number, amount, status, and no sensitive data leakage. |

## F. Coupon tests — overall and monthly limits

Coupon acceptance must be rechecked on the server at order creation. Lifetime usage must not exist in the UI, API payload, schema, or active database behavior.

| ID | Pri | Test | Expected result |
|---|---|---|---|
| CUP-01 | P0 | Apply valid percentage coupon above minimum order | Discount is `floor(subtotal × percentage / 100)` and total is correct. |
| CUP-02 | P0 | Apply valid fixed-value coupon | Discount equals fixed value but never exceeds eligible subtotal. |
| CUP-03 | P1 | Use lowercase, uppercase, surrounding spaces, and invalid code | Normalization works where intended; invalid code is rejected safely. |
| CUP-04 | P1 | Subtotal exactly at, below, and above minimum | Boundary at minimum is accepted; below minimum is rejected with remaining amount. |
| CUP-05 | P1 | Percentage discount above max discount | Discount is capped at max discount. |
| CUP-06 | P1 | Null/zero max discount and zero/negative values | Valid configurations work; invalid negative/unsafe values cannot be saved. |
| CUP-07 | P0 | Inactive coupon | Coupon is rejected even if dates and limits are valid. |
| CUP-08 | P0 | Coupon before start time, exactly at start, after start | Date boundary follows configured timezone/instant. |
| CUP-09 | P0 | Coupon before expiry, exactly at expiry, after expiry | Expiry boundary follows product policy and server time. |
| CUP-10 | P0 | Overall limit = 1 with two different customers | First successful reservation wins; second is rejected atomically. |
| CUP-11 | P0 | Overall limit reached | Validation and reserve RPC both reject; used count never exceeds limit. |
| CUP-12 | P0 | Monthly limit = 2; same customer uses twice | Both uses succeed and monthly count becomes 2. |
| CUP-13 | P0 | Same customer attempts third use in same calendar month | Rejected; count remains 2. |
| CUP-14 | P0 | Two customers use same monthly-limited coupon | Each customer has an independent monthly count. |
| CUP-15 | P0 | Month boundary test at 23:59/00:00 Asia/Kolkata | New calendar month starts a fresh count; previous month is not counted. |
| CUP-16 | P1 | Validate coupon in cart, then wait until expiry before submit | Order-time validation rejects it; no order/usage increment. |
| CUP-17 | P0 | Two concurrent orders consume last global use | Exactly one reservation succeeds; no negative/over-limit counts. |
| CUP-18 | P0 | Order fails after coupon reservation | Usage and redemption are released exactly once. |
| CUP-19 | P0 | Cancel/refund an order using a coupon | Coupon release behavior matches business policy and is not double-released. |
| CUP-20 | P1 | Reapply/change/remove coupon in checkout | Only one coupon affects totals; stale discount cannot remain. |
| CUP-21 | P1 | Coupon code over max length, SQL-like text, HTML, Unicode | Validation is safe and no code/query injection occurs. |
| CUP-22 | P1 | New-customer coupon with no completed order | Accepted. |
| CUP-23 | P1 | New-customer coupon for customer with any prior non-cancelled order | Rejected. |
| CUP-24 | P1 | Eligibility value `everyone`, `new_customers`, unsupported future value | Everyone works; new-customer rule works; unsupported values fail safely. |
| CUP-25 | P0 | Inspect admin form and API payload | No per-customer lifetime field or lifetime value is sent/stored. |
| CUP-26 | P1 | Create/edit/delete coupon with duplicate code | Duplicate code is rejected; existing coupon remains unchanged. |
| CUP-27 | P1 | Admin enters decimal, empty, huge, negative, or non-numeric limits | Clear validation; database constraints also protect integrity. |
| CUP-28 | P1 | Coupon with no usage limit/monthly limit | Unlimited dimension behaves as unlimited, subject to other rules. |
| CUP-29 | P0 | Try to reserve coupon directly as anon/customer | RPC cannot be abused to forge usage or redeem for another user. |
| CUP-30 | P1 | Review usage counts after success, failure, cancellation, and month rollover | `used_count`, monthly usage, and redemptions reconcile with order records. |

## G. Razorpay/online payment

| ID | Pri | Test | Expected result |
|---|---|---|---|
| PAY-01 | P0 | Start online payment with valid order | Razorpay order is created for exact server total and correct currency. |
| PAY-02 | P0 | Complete successful payment | Payment is verified server-side; order becomes paid exactly once. |
| PAY-03 | P0 | Payment failed/cancelled/dismissed | Order is not marked paid; user gets retry/recovery path. |
| PAY-04 | P0 | Tamper with payment ID, signature, amount, or order ID | Verification rejects the request. |
| PAY-05 | P0 | Replay successful payment callback | Idempotent handling prevents duplicate updates/emails/stock effects. |
| PAY-06 | P1 | Pay an already-paid order | Server rejects duplicate payment attempt. |
| PAY-07 | P1 | Payment service unavailable/timeout | No stuck spinner forever; order remains recoverable and error is safe. |
| PAY-08 | P1 | COD and online totals differ after coupon | Both methods use the same authoritative final total. |
| PAY-09 | P0 | Refund/cancel paid order | Payment status and customer communication are correct; refund is not promised unless initiated. |
| PAY-10 | P1 | Missing Razorpay configuration | Clear admin/deployment error; secrets never appear in browser/logs. |

## H. Customer profile, addresses, reviews, and referrals

| ID | Pri | Test | Expected result |
|---|---|---|---|
| CUS-01 | P1 | View/update profile with valid values | Changes persist and are reflected after reload. |
| CUS-02 | P0 | Attempt to read/update another customer profile/address | RLS/server authorization blocks access. |
| CUS-03 | P1 | Admin opens customer row | Full details include profile, all addresses, order summary/details, and empty-state handling. |
| CUS-04 | P1 | Admin opens customer with deleted/missing address/product/order relation | Dialog remains usable and shows safe fallback. |
| REV-01 | P1 | View product reviews logged out | Public reviews load newest-first without private fields. |
| REV-02 | P1 | Verified purchaser creates review | Review saves with correct rating/text/product/user. |
| REV-03 | P1 | Non-purchaser attempts review | Verification rule is enforced server-side. |
| REV-04 | P1 | User edits/deletes own review | Only own review is affected and rating aggregates update correctly. |
| REV-05 | P0 | User changes review/product/user ID in request | RLS prevents modifying someone else’s review or another product. |
| REF-01 | P1 | View referral code and counts | Correct direct/indirect counts and history are shown. |
| REF-02 | P1 | Register using valid referral code | Relationship is recorded once and cannot be self-referred. |
| REF-03 | P1 | Use invalid, duplicate, circular, or case-variant referral code | Invalid/circular relationships are rejected; valid normalization is consistent. |
| REF-04 | P1 | Complete/cancel/refund referred order | Commission status/amount follows policy and does not duplicate. |
| REF-05 | P1 | Admin approves, pays, cancels, adjusts commission | Only valid transitions are accepted; audit record is accurate. |

## I. Admin panel

| ID | Pri | Test | Expected result |
|---|---|---|---|
| ADM-01 | P0 | Load dashboard as admin | Stats load and date filters produce correct values. |
| ADM-02 | P1 | Test today/week/month/custom date ranges | Boundaries, timezone, empty ranges, and invalid ranges are correct. |
| ADM-03 | P0 | List/search customers | Correct customers, counts, names, emails, and empty state. |
| ADM-04 | P1 | View full customer details | Addresses and orders belong to selected customer only. |
| ADM-05 | P1 | Create/edit/delete product | Required validation, image handling, category, price, stock, and safe deletion. |
| ADM-06 | P0 | Create/edit/delete variant | SKU uniqueness, price, stock, required fields, and product association work. |
| ADM-07 | P0 | Update product and variant stock | Stock cannot become invalid; concurrent updates do not lose changes. |
| ADM-08 | P1 | Delete product/category with dependent data | Correct restriction/cascade behavior and user-friendly error. |
| ADM-09 | P1 | List/filter/update orders | Filters, status, payment status, and customer data are accurate. |
| ADM-10 | P1 | Review moderation | Admin can remove inappropriate review; customer cannot remove another review. |
| ADM-11 | P1 | Coupon form validation | Percentage/fixed fields, dates, limits, eligibility, active switch, and description validate. |
| ADM-12 | P0 | Confirm no lifetime coupon control remains | Form, edit modal, API payload, generated types, and active database schema omit lifetime limit. |
| ADM-13 | P1 | Admin API called by non-admin | Every admin server function returns forbidden; hiding links is insufficient. |
| ADM-14 | P0 | Admin attempts mass/forged update | Server validates ownership/role/input and rejects unauthorized fields. |
| ADM-15 | P2 | Refresh after mutation and open in second admin tab | Data remains consistent; stale cache is invalidated. |

## J. Database, RLS, API, and security

| ID | Pri | Test | Expected result |
|---|---|---|---|
| SEC-01 | P0 | Anonymous read/write to each private table | RLS blocks private reads/writes; public catalog reads only what is intended. |
| SEC-02 | P0 | Customer reads another customer’s orders/cart/wishlist/addresses | No rows or forbidden response. |
| SEC-03 | P0 | Customer writes another user ID into insert/update payload | Server/RLS ignores or rejects forged ownership. |
| SEC-04 | P0 | Direct browser call to service-role-only coupon tables/RPC | Service role stays server-only; client cannot read or mutate usage/redemptions. |
| SEC-05 | P0 | Inspect client bundle, HTML, logs, and network traffic | Supabase service-role key, payment secret, and private data never appear. |
| SEC-06 | P1 | Try SQL injection, XSS, HTML, and template strings in all text inputs | Values are parameterized/escaped and never execute. |
| SEC-07 | P1 | Replay, reorder, or alter mutation requests | Authorization, validation, idempotency, and state transitions remain enforced. |
| SEC-08 | P1 | Send oversized JSON, huge quantities, long strings, and malformed UUIDs | Safe validation/error; no crash or excessive resource use. |
| SEC-09 | P0 | Trigger many coupon/order requests concurrently | No race-condition oversell, double discount, negative count, or duplicate order. |
| SEC-10 | P1 | Verify security headers/CORS/cookie flags in deployed environment | Production headers and cookies follow security policy. |
| SEC-11 | P1 | Error from database/payment/email provider | User sees generic actionable message; logs contain enough diagnosis but no secrets. |
| SEC-12 | P1 | Verify migration from clean database and from existing database | All migrations apply in order; lifetime removal migration is safe when columns are already absent. |

## K. Reliability, compatibility, and performance

| ID | Pri | Test | Expected result |
|---|---|---|---|
| REL-01 | P1 | Simulate slow API on every loading screen | Skeleton/loading state appears and no duplicate requests occur. |
| REL-02 | P1 | Disconnect network during read and mutation | Error/retry state is clear; local state does not falsely claim success. |
| REL-03 | P1 | Refresh during checkout/payment callback | Order/payment recovery is deterministic and idempotent. |
| REL-04 | P1 | Test Chrome, Edge, Firefox, Safari latest versions | Core flows work consistently. |
| REL-05 | P1 | Test Android and iOS mobile browsers | Touch controls, keyboard, date inputs, dialogs, and payment handoff work. |
| REL-06 | P2 | Test reduced motion, dark/light system settings, and high contrast | App remains usable and readable. |
| REL-07 | P1 | Load large catalog, many orders, and many reviews | Pagination/query performance is acceptable; no browser freeze. |
| REL-08 | P1 | Run Lighthouse/basic performance check | No blocking console errors; acceptable LCP/CLS/accessibility for release target. |
| REL-09 | P0 | Run `npm run lint` and `npm run build` | Both complete without new errors. Existing warnings must be reviewed, not ignored. |
| REL-10 | P1 | Verify realtime updates for inventory/order/admin views, if enabled | Updates are scoped, correctly rendered, and do not expose private data. |

## L. Release acceptance checklist

- [ ] All P0 cases pass.
- [ ] No open critical/high security or payment defects.
- [ ] COD and online payment totals reconcile with database records.
- [ ] Coupon overall and monthly counts reconcile after success, failure, cancellation, and month rollover.
- [ ] No lifetime coupon field/column/API behavior remains.
- [ ] Customer details are isolated by authorization and admin details are complete.
- [ ] Product/variant inventory cannot be oversold under concurrent checkout.
- [ ] `npm run lint` and `npm run build` pass.
- [ ] Database migrations apply successfully to a clean and existing test database.
- [ ] Browser/mobile smoke suite passes after deployment.
- [ ] Rollback plan and database backup are confirmed.

## Suggested automation order

1. Add unit tests for coupon evaluation, discount rounding/capping, date boundaries, and monthly usage.
2. Add database/RPC tests for atomic reservation/release, RLS, inventory, and order transitions.
3. Add browser tests for auth, product/cart, checkout, coupon, customer details, and admin authorization.
4. Run API/security and concurrency tests in CI against an isolated Supabase project.
5. Keep payment-provider tests in sandbox mode and use mocked success/failure/replay callbacks.
