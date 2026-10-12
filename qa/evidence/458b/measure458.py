#!/usr/bin/env python3
"""job 458-B - measure the standalone page headers with a real browser (read-only evidence).

    ./measure458.py <label> <distDir> <outJson>

For each standalone route and each viewport (390, 360, 768, 1440) it records:
  clientWidth / scrollWidth / their difference - the job requires 0 everywhere, and `overflow-x`
  masking is forbidden, so a non-zero number is a real horizontal scroll, not a hidden one;
  the height of the page's header box (the job requires the same height on every page);
  the smallest tap target in the header (job 431-B E / the team floor is 44 px);
  the link back home (text + whether it exists);
  for the 390/1440 runs, a screenshot of the header strip.

It never types a Thai word of its own: the words it reports come from the page itself.
"""
import json
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

WORK = "/workspace/89502fb4-0ea2-4102-9a54-af17cdc53eb5/work"
CHROME = "/opt/playwright-browsers/chromium-1209/chrome-linux64/chrome"
SHOTS = f"{WORK}/kbsrc/qa/images/boy-round25"
ROUTES = ["/readme", "/site-prep", "/portfolio", "/price-guide"]
WIDTHS = [390, 360, 768, 1440]

MEASURE = """() => {
  const de = document.documentElement;
  const header = document.querySelector('header');
  const box = (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
  const links = header ? [...header.querySelectorAll('a,button')] : [];
  const strip = header ? header.querySelector('.main-nav') : null;
  return {
    clientWidth: de.clientWidth,
    scrollWidth: de.scrollWidth,
    overflowPx: de.scrollWidth - de.clientWidth,
    headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null,
    headerTop: header ? Math.round(header.getBoundingClientRect().top) : null,
    headerTestid: header ? header.getAttribute('data-testid') : null,
    headerClasses: header ? header.getAttribute('class') : null,
    homeLink: (() => {
      if (!header) return null;
      const a = header.querySelector('a[href="/"]');
      return a ? { text: a.innerText.replace(/\\s+/g, ' ').trim(), testid: a.getAttribute('data-testid'), box: box(a) } : null;
    })(),
    backToStore: (() => {
      if (!header) return null;
      const a = header.querySelector('[data-testid$="-back-to-store"]');
      return a ? { text: a.innerText.replace(/\\s+/g, ' ').trim(), testid: a.getAttribute('data-testid'), box: box(a) } : null;
    })(),
    menuItems: links.map((a) => ({ text: a.innerText.replace(/\\s+/g, ' ').trim(), h: Math.round(a.getBoundingClientRect().height) })).filter((x) => x.text),
    minTapHeight: links.length ? Math.min(...links.map((a) => Math.round(a.getBoundingClientRect().height))) : null,
    menuScrolls: strip ? strip.scrollWidth > strip.clientWidth : null,
    tapTargets: links.map((el) => { const b = el.getBoundingClientRect(); return {
      text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 24),
      w: Math.round(b.width), h: Math.round(b.height) }; }),
    contrast: (() => {
      // WCAG ratio of an idle menu link against what the customer actually sees behind it:
      // the header paints a translucent colour, so it is composited over the page background first.
      const parse = (c) => (c.match(/[\d.]+/g) || [0, 0, 0]).map(Number);
      const lum = ([r, g, b]) => [r, g, b].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); })
        .reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0);
      const blend = (fg, bg) => fg.map((v, i) => v * (fg[3] ?? 1) + bg[i] * (1 - (fg[3] ?? 1)));
      const background = document.body ? getComputedStyle(document.body).backgroundColor : 'rgb(255,255,255)';
      const head = header ? getComputedStyle(header).backgroundColor : background;
      const base = parse(background).length === 4 ? parse(background) : parse(background);
      const over = blend(parse(head), base);
      const link = strip ? strip.querySelector('a:not(.is-active):not(.quote-link)') : null;
      if (!link) return null;
      const fg = parse(getComputedStyle(link).color).slice(0, 3);
      const l1 = lum(fg), l2 = lum(over);
      return { linkText: link.innerText.trim(), ratio: +(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05))).toFixed(2),
               linkColor: getComputedStyle(link).color, headerBackground: head };
    })(),
    menuCue: strip ? getComputedStyle(strip, '::after').content : null,
    bodyHasPriceGuideNav: !!document.querySelector('[data-testid="standalone-top-nav"]'),
  };
}"""


def serve(dist: str, port: int):
    proc = subprocess.Popen(["node", f"{WORK}/tmp458/srv458.cjs", dist, str(port)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT, start_new_session=True)
    deadline = time.time() + 30
    while time.time() < deadline:
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=2).read()
            return proc
        except Exception:
            time.sleep(0.3)
    proc.kill()
    raise SystemExit("harness did not start")


def main() -> None:
    label, dist, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    port = 3580 if label.startswith("before") else 3581
    proc = serve(dist, port)
    results, errors = {}, []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=CHROME, args=["--no-sandbox"])
        for route in ROUTES:
            page = browser.new_page(viewport={"width": 1440, "height": 1200})
            page.on("pageerror", lambda e: errors.append(f"{route}: {str(e)[:160]}"))
            for width in WIDTHS:
                page.set_viewport_size({"width": width, "height": 1200})
                page.goto(f"http://127.0.0.1:{port}{route}", wait_until="load")
                page.wait_for_timeout(1500)
                got = page.evaluate(MEASURE)
                results[f"{route}@{width}"] = got
                if width in (390, 1440):
                    try:
                        page.locator("header").screenshot(path=f"{SHOTS}/{label.upper()}-{route.strip('/')}-{width}.png")
                    except Exception as error:
                        got["screenshotError"] = str(error)[:120]
                print(f"{label} {route}@{width}: overflow={got['overflowPx']} header={got['headerHeight']} "
                      f"minTap={got['minTapHeight']} contrast={(got.get('contrast') or {}).get('ratio')} "
                      f"menuScrolls={got['menuScrolls']} cue={str(got['menuCue'])[:12]}")
            page.close()
        browser.close()
    proc.kill()
    heights = {route: {f"{w}px": results[f"{route}@{w}"]["headerHeight"] for w in WIDTHS} for route in ROUTES}
    payload = {
        "job": "458-B standalone page headers",
        "label": label,
        "dist": dist.replace(f"{WORK}/", ""),
        "environment": "Linux sandbox, node v22.23.3, chromium 145.0.7632.18 headless, JavaScript on, /api stubbed to 500",
        "how": f"python3 {WORK}/tmp458/measure458.py (read-only harness {WORK}/tmp458/srv458.cjs)",
        "overflowRule": "scrollWidth - clientWidth must be 0 on every page at every width (no overflow-x masking)",
        "headerHeights": heights,
        "sameHeightOnEveryPage": {f"{w}px": len({heights[r][f"{w}px"] for r in ROUTES}) == 1 for w in WIDTHS},
        "pages": results,
        "pageErrors": errors,
    }
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=1)
    bad = {k: v["overflowPx"] for k, v in results.items() if v["overflowPx"]}
    print("header heights:", json.dumps(heights, ensure_ascii=False))
    print("same height per width:", payload["sameHeightOnEveryPage"])
    print("OVERFLOW:", bad if bad else "none", "| pageErrors:", len(errors))


main()
