/**
 * The FAQPage the shared shell carries is the homepage's, and a route that does not render an FAQ must not
 * advertise it: an AI that cites the markup lands the reader on a page without the text. This is the drop
 * step from scripts/prerender.mjs, kept here in its own module so the escape hatch below is testable without
 * building the site.
 *
 * Policy (job-277/job-285, unchanged by job-288): the homepage keeps its FAQ, every other route loses an
 * inherited one, and a route that really renders FAQ of its own marks its block with data-route-schema="faq".
 */

/**
 * The static shell carries the ten-question FAQPage that the homepage answers on screen; rendering the shared head
 * into every route made eleven pages advertise answers they never showed, and an AI citing them would send a reader
 * to a page without the text. A route that really renders an FAQ marks its own block with data-route-schema="faq",
 * which is the flag this keeps; anything inherited disappears.
 */
export function dropInheritedFaqJsonLd(html, route) {
  if (route.path === "/") return html;
  let next = html;
  for (const block of html.match(/<script\b[^>]*\btype="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi) ?? []) {
    if (!block.includes("FAQPage") || /data-route-schema=/i.test(block)) continue;
    const body = block.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "");
    let doc;
    try {
      doc = JSON.parse(body);
    } catch {
      throw new Error(`[prerender] ${route.path}: an inherited FAQPage block cannot be parsed.`);
    }
    const kept = (doc["@graph"] ?? []).filter((node) => node?.["@type"] !== "FAQPage");
    if (kept.length === (doc["@graph"] ?? []).length) continue;
    if (Object.keys(doc).some((key) => key !== "@context" && key !== "@graph")) {
      throw new Error(`[prerender] ${route.path}: FAQPage shares a block with other top-level keys; widen this helper instead of dropping data.`);
    }
    next = next.replace(block, kept.length
      ? `<script type="application/ld+json">${JSON.stringify({ "@context": doc["@context"], "@graph": kept }).replace(/</g, "\u003c")}</script>`
      : "");
  }
  // Same question the loop above asked, and asked of the same subset: only an *inherited* block may not survive.
  // A block the route flagged as its own is the documented escape hatch, so it is blanked out of the copy first -
  // testing `next` itself made the build throw on exactly the case the flag exists for (job-288). Anything
  // unflagged still stops the build, and the flag is not a way to ship a homepage FAQ on a page with no questions.
  const inheritedOnly = next.replace(/<script\b[^>]*\bdata-route-schema=[^>]*>[\s\S]*?<\/script>/gi, "");
  if (inheritedOnly.includes("FAQPage")) {
    throw new Error(`[prerender] ${route.path}: an FAQPage survives although the route renders none - give the block data-route-schema="faq".`);
  }
  return next;
}
