import { createPortal } from "react-dom";
import { formatDateTime, formatINR } from "@/lib/format";

export interface InvoiceOrder {
  id: string;
  created_at: string;
  status: string;
  payment_status: string;
  payment_method?: string | null;
  customer_email?: string | null;
  coupon_code?: string | null;
  subtotal_inr?: number | null;
  discount_inr: number;
  taxes_inr?: number | null;
  shipping_inr?: number | null;
  payment_fee_inr?: number | null;
  total_inr: number;
  shipping_address: any;
  order_items: Array<{
    id: string;
    name: string;
    variant_name?: string | null;
    quantity: number;
    price_inr: number;
  }>;
}

/**
 * Printable invoice. Hidden on screen; the global `@media print` rules in
 * styles.css reveal only this node so the browser prints a clean document.
 */
export function OrderInvoice({
  order,
  customerName,
  customerPhone,
}: {
  order: InvoiceOrder;
  customerName?: string | null;
  customerPhone?: string | null;
}) {
  // Client-only (portals need document.body). Rendered synchronously so callers
  // can mount it and print within the same user gesture — a deferred mount
  // breaks popup/print permission on tablets and phones.
  if (typeof document === "undefined") return null;

  const address = order.shipping_address ?? {};
  const subtotal =
    order.subtotal_inr ??
    order.order_items.reduce((sum, i) => sum + i.price_inr * i.quantity, 0);

  return createPortal(
    <div id="print-invoice" aria-hidden="true">
      <div className="invoice-sheet">
        <header className="invoice-head">
          <div>
            <p className="invoice-brand">FEA GLAM</p>
            <p className="invoice-muted">Korean beauty inspired</p>
            <p className="invoice-muted">care@feaglam.com · feaglam.com</p>
          </div>
          <div className="invoice-right">
            <p className="invoice-title">Invoice</p>
            <p className="invoice-muted">Order #{order.id.slice(0, 8).toUpperCase()}</p>
            <p className="invoice-muted">{formatDateTime(order.created_at)}</p>
          </div>
        </header>

        <section className="invoice-cols">
          <div>
            <p className="invoice-label">Billed to</p>
            <p>{customerName || order.customer_email || "Customer"}</p>
            {order.customer_email && customerName ? <p className="invoice-muted">{order.customer_email}</p> : null}
            {customerPhone ? <p className="invoice-muted">{customerPhone}</p> : null}
          </div>
          <div>
            <p className="invoice-label">Ship to</p>
            <p style={{ fontWeight: 600 }}>{customerName || order.customer_email || "Customer"}</p>
            <p>
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ""}
            </p>
            <p>
              {address.city}, {address.state} — {address.pincode}
            </p>
            <p>{address.country}</p>
            {customerPhone ? <p>Phone: {customerPhone}</p> : null}
          </div>
          <div>
            <p className="invoice-label">Status</p>
            <p className="invoice-capitalize">Order: {order.status}</p>
            <p className="invoice-capitalize">Payment: {order.payment_status}</p>
            {order.payment_method ? <p className="invoice-capitalize">Method: {order.payment_method}</p> : null}
          </div>
        </section>

        <table className="invoice-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="invoice-num">Qty</th>
              <th className="invoice-num">Price</th>
              <th className="invoice-num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.name}
                  {item.variant_name ? <span className="invoice-muted"> — {item.variant_name}</span> : null}
                </td>
                <td className="invoice-num">{item.quantity}</td>
                <td className="invoice-num">{formatINR(item.price_inr)}</td>
                <td className="invoice-num">{formatINR(item.price_inr * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-totals">
          <div>
            <span>Subtotal</span>
            <span>{formatINR(subtotal)}</span>
          </div>
          {order.discount_inr > 0 && (
            <div>
              <span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
              <span>−{formatINR(order.discount_inr)}</span>
            </div>
          )}
          <div>
            <span>Shipping</span>
            <span>{order.shipping_inr ? formatINR(order.shipping_inr) : "Free"}</span>
          </div>
          {(order.taxes_inr ?? 0) > 0 && (
            <div>
              <span>Taxes</span>
              <span>{formatINR(order.taxes_inr)}</span>
            </div>
          )}
          {(order.payment_fee_inr ?? 0) > 0 && (
            <div>
              <span>Payment processing fee</span>
              <span>{formatINR(order.payment_fee_inr)}</span>
            </div>
          )}
          <div className="invoice-total">
            <span>Total</span>
            <span>{formatINR(order.total_inr)}</span>
          </div>
        </div>

        <footer className="invoice-foot">
          <p>Thank you for shopping with FEA Glam.</p>
          <p className="invoice-muted">This is a computer-generated invoice and does not require a signature.</p>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
