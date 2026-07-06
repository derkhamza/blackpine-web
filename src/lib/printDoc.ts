// Reliable client-side printing of a full HTML document.
//
// The old approach — window.open("") + document.write + an injected
// `window.onload = () => window.print()` — is fragile on desktop: the pop-up can
// be blocked, or the initial about:blank load event fires BEFORE the written
// script is parsed, so print() never runs and the window just sits there blank
// (or the browser discards the orphan pop-up). The user then lands back on the
// previous screen with nothing printed.
//
// Printing through a hidden iframe avoids all of that: the document renders
// in-page and the print dialog is driven from the parent, so nothing opens in a
// new tab and nothing "disappears". @page rules in the document are still
// honoured (pre-printed-paper designs keep working).
export function printHtmlDocument(html: string): void {
  // Drop any self-invoking print script the caller embedded — we trigger the
  // print here so it fires exactly once, after layout.
  const doc = html.replace(/<script>[\s\S]*?window\.print[\s\S]*?<\/script>/gi, "");

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const cw = iframe.contentWindow;
  if (!cw) { iframe.remove(); return; }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    setTimeout(() => { try { iframe.remove(); } catch { /* already gone */ } }, 500);
  };

  const doPrint = () => {
    try {
      cw.focus();
      cw.onafterprint = cleanup;
      cw.print();
      // Some browsers never fire onafterprint — clean up defensively.
      setTimeout(cleanup, 60_000);
    } catch {
      cleanup();
    }
  };

  cw.document.open();
  cw.document.write(doc);
  cw.document.close();

  // Print once the iframe document (and its images / letterhead) have laid out.
  // If the load event already fired, print on the next tick.
  if (cw.document.readyState === "complete") setTimeout(doPrint, 150);
  else iframe.addEventListener("load", () => setTimeout(doPrint, 150), { once: true });
}
