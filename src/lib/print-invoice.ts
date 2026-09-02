/**
 * Prints the currently rendered invoice by cloning it into a same-origin
 * iframe and printing that document.
 *
 * Printing the live page relies on `@media print` rules to hide the app shell,
 * which iOS (Safari and Chrome, both WKWebView) frequently renders as a blank
 * page. An isolated iframe document contains only the invoice markup, so every
 * browser prints exactly what it sees.
 */
export function printInvoice(nodeId = "print-invoice") {
  if (typeof document === "undefined") return;

  const source = document.getElementById(nodeId);
  if (!source) {
    window.print();
    return;
  }

  const styles = Array.from(
    document.querySelectorAll('style, link[rel="stylesheet"]'),
  )
    .map((node) => node.outerHTML)
    .join("\n");

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    window.print();
    return;
  }

  doc.open();
  doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invoice</title>
    ${styles}
    <style>
      @page { margin: 14mm; }
      html, body { background: #fff; margin: 0; padding: 0; }
      #${nodeId} { display: block !important; position: static !important; width: 100%; color: #111; }
      @media print {
        html, body { height: auto; overflow: visible; }
      }
    </style>
  </head>
  <body>${source.outerHTML}</body>
</html>`);
  doc.close();

  const cleanup = () => {
    window.setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1000);
  };

  const run = () => {
    window.setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.print();
      }
      cleanup();
    }, 300);
  };

  if (doc.readyState === "complete") run();
  else iframe.addEventListener("load", run, { once: true });
}
