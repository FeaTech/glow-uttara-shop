/**
 * Prints the rendered invoice (`#print-invoice`) as an isolated document.
 *
 * Two strategies, in order of reliability:
 *
 *  1. A real `window.open` tab. Desktop browsers and — crucially — iOS/iPadOS
 *     Safari print this correctly. iOS ignores `print()` called on a hidden
 *     sub-frame and instead prints the top page, which the app's global
 *     `@media print` rules blank out, so the old iframe-only path produced an
 *     empty sheet on tablets and phones.
 *  2. A hidden same-origin iframe, used only when the popup is blocked. This
 *     still works on desktop, where sub-frame printing is supported.
 *
 * Both documents inline every readable stylesheet rather than linking it, so
 * nothing depends on a second network fetch completing before `print()` fires.
 */
export function printInvoice(nodeId = "print-invoice") {
  if (typeof document === "undefined") return;

  const source = document.getElementById(nodeId);
  if (!source) {
    window.print();
    return;
  }

  const doc = buildDocument(nodeId, source.outerHTML);

  // Preferred path: a real tab/window.
  const win = window.open("", "_blank");
  if (win && win.document) {
    win.document.open();
    win.document.write(doc);
    win.document.close();
    return;
  }

  // Fallback: hidden iframe (popup blocked).
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentDocument;
  if (!frameDoc) {
    iframe.remove();
    window.print();
    return;
  }

  const cleanup = () =>
    window.setTimeout(() => iframe.remove(), 60_000);
  const run = () =>
    window.setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.print();
      }
      cleanup();
    }, 300);

  frameDoc.open();
  frameDoc.write(doc);
  frameDoc.close();

  if (frameDoc.readyState === "complete") run();
  else iframe.addEventListener("load", run, { once: true });
}

/** Full standalone HTML for the print document, CSS inlined, self-printing. */
function buildDocument(nodeId: string, bodyHTML: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invoice</title>
    <style>
${collectCss()}
      @page { margin: 14mm; }
      html, body { background: #fff; margin: 0; padding: 0; }
      #${nodeId} { display: block !important; position: static !important; width: 100%; color: #111; }
      @media print { html, body { height: auto; overflow: visible; } }
    </style>
  </head>
  <body>
    ${bodyHTML}
    <script>
      (function () {
        function go() { try { window.focus(); window.print(); } catch (e) {} }
        window.addEventListener("load", function () { window.setTimeout(go, 250); });
        window.onafterprint = function () { window.setTimeout(function () { try { window.close(); } catch (e) {} }, 100); };
      })();
    </script>
  </body>
</html>`;
}

/** Serialise every stylesheet we can read; reference the rest by @import. */
function collectCss(): string {
  const imports: string[] = [];
  let body = "";
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules;
    } catch {
      rules = null; // cross-origin (e.g. Google Fonts)
    }
    if (rules) {
      for (const rule of Array.from(rules)) {
        if (rule.type === CSSRule.IMPORT_RULE) imports.push(rule.cssText);
        else body += rule.cssText + "\n";
      }
    } else if (sheet.href) {
      imports.push(`@import url("${sheet.href}");`);
    }
  }
  return `${imports.join("\n")}\n${body}`;
}
