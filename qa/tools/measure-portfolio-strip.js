/*
 * job 460-C - live measurement of /portfolio (category strip + tap targets).
 * Paste into the browser console (or run through the Browser pane's javascript tool) on /portfolio,
 * at 390 / 360 / 768 / 1440 px. It reads only; it changes nothing on the page.
 * Returns JSON: page overflow, strip numbers (chips past the right edge, partly visible chips), the
 * cue elements, and every interactive element under 44 px (header is reported separately).
 */
(async () => {
  await new Promise((r) => setTimeout(r, 1500));
  const de = document.documentElement;
  const strip = document.querySelector('[data-testid="portfolio-category-tabs"]');
  if (!strip) return JSON.stringify({ error: "strip not found" });
  const sr = strip.getBoundingClientRect();
  const chips = [...strip.querySelectorAll("button")];
  const rects = chips.map((c) => c.getBoundingClientRect());
  const label = (el) => (el.getAttribute("data-testid") || el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24);
  const partial = rects
    .map((r, i) => ({ chip: label(chips[i]), visible: Math.round(Math.min(r.right, sr.right) - Math.max(r.left, sr.left)), width: Math.round(r.width) }))
    .filter((x) => x.visible > 0 && x.visible < x.width);
  const cue = (side) => {
    const el = document.querySelector(`[data-testid="portfolio-category-cue-${side}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { shown: r.width > 0 && cs.opacity !== "0" && cs.display !== "none", width: Math.round(r.width), opacity: cs.opacity, pointerEvents: cs.pointerEvents };
  };
  const header = document.querySelector("header");
  const targets = [...document.querySelectorAll("a,button,input,select,textarea,[role=button]")]
    .map((e) => {
      const r = e.getBoundingClientRect();
      return { id: label(e), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, inHeader: !!(header && header.contains(e)) };
    })
    .filter((x) => x.w > 0 && (x.w < 44 || x.h < 44));
  const vw = de.clientWidth;
  return JSON.stringify({
    viewport: { vw, docScrollWidth: de.scrollWidth, diff: de.scrollWidth - de.clientWidth },
    strip: {
      client: strip.clientWidth, scroll: strip.scrollWidth, scrollLeft: Math.round(strip.scrollLeft), overflowX: getComputedStyle(strip).overflowX,
      chips: chips.length, chipsPastRightEdge: rects.filter((r) => r.right > sr.right + 0.5).length, partlyVisible: partial,
      chipHeights: [...new Set(rects.map((r) => Math.round(r.height * 10) / 10))],
    },
    cue: { start: cue("start"), end: cue("end") },
    elementsWiderThanViewportOutsideStrip: [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > vw + 0.5 && !strip.contains(e); }).length,
    under44: { outsideHeader: targets.filter((x) => !x.inHeader && !/^(portfolio-tab-|ทั้งหมด)/.test(x.id)), headerOnly: targets.filter((x) => x.inHeader), chipsUnder44: targets.filter((x) => /^(portfolio-tab-|ทั้งหมด)/.test(x.id)).length },
  });
})();
