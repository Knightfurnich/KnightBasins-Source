#!/usr/bin/env python3
"""job 461-B rev 1 - measure every footer .footer-owner-link (real DOM boxes), before and after.

    ./measure461b.py

The nine footer links are identified by href (only two of them have a data-testid), and the three
sister-site links handled in the first round are marked so the report can show they stayed fixed while
the other six were raised. Also recorded: how many lines the footer's meta strip occupies, the footer
height, and scrollWidth - clientWidth (GOAL C: no horizontal overflow, no overflow-x masking).
"""
import json
import subprocess
import time
import urllib.request

from playwright.sync_api import sync_playwright

WORK = "/workspace/89502fb4-0ea2-4102-9a54-af17cdc53eb5/work"
CHROME = "/opt/playwright-browsers/chromium-1209/chrome-linux64/chrome"
WIDTHS = (390, 360, 768, 1440)
ROUND_ONE = {"https://www.knightfurnich.com/", "https://xn--42cf7czb6aef3bfnp2mrg.com/", "/price-guide"}
JS = """() => [...document.querySelectorAll('footer a.footer-owner-link')].map((l) => {
  const r = l.getBoundingClientRect(), cs = getComputedStyle(l);
  return {
    href: l.getAttribute('href'),
    testid: l.getAttribute('data-testid') || null,
    label: (l.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 34),
    heightPx: +r.height.toFixed(1), widthPx: Math.round(r.width),
    xPx: Math.round(r.x), yPx: Math.round(r.y),
    lineHeightPx: cs.lineHeight, display: cs.display, sized: l.getAttribute('style') ? 'yes' : 'no',
    inMetaBar: !!l.closest('.footer-meta-bar'),
  };
})"""


def row_groups(links):
    """Group footer links into the lines they sit on: [{line, x columns, heights}] with a 10 px tolerance."""
    rows = []
    for link in sorted(links, key=lambda l: (l["yPx"], l["xPx"])):
        for row in rows:
            if abs(row["yPx"] - link["yPx"]) <= 10:
                row["xPx"].append(link["xPx"]); row["heightPx"].append(link["heightPx"])
                break
        else:
            rows.append({"yPx": link["yPx"], "xPx": [link["xPx"]], "heightPx": [link["heightPx"]]})
    for row in rows:
        row["xPx"] = sorted(row["xPx"]); row["heightPx"] = sorted(set(row["heightPx"]))
    return rows


def serve(dist: str, port: int):
    proc = subprocess.Popen(["node", f"{WORK}/tmp461b/srv461b.cjs", dist, str(port)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    end = time.time() + 25
    while time.time() < end:
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=2).read(64)
            return proc
        except Exception:
            time.sleep(0.3)
    proc.kill()
    raise SystemExit(f"harness for {dist} did not start")


def main():
    trees = {"before": "/tmp/qwenwork/before461b-dist",
             "after": f"{WORK}/kbsrc/artifacts/knight-basins/dist/public"}
    out = {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=CHROME, args=["--no-sandbox", "--disable-dev-shm-usage"])
        for index, (tag, dist) in enumerate(trees.items()):
            proc = serve(dist, 3761 + index)
            out[tag] = {}
            for width in WIDTHS:
                page = browser.new_page(viewport={"width": width, "height": 1200})
                page.goto(f"http://127.0.0.1:{3761 + index}/", wait_until="domcontentloaded")
                page.wait_for_timeout(3200)
                links = page.evaluate(JS)
                meta = [l for l in links if l["inMetaBar"]]
                page.locator("footer").screenshot(path=f"{WORK}/tmp461b/footer-{tag}-{width}.png")
                out[tag][str(width)] = {
                    "links": links,
                    "metaBarHeightsPx": [l["heightPx"] for l in meta],
                    # row grouping uses a 10 px tolerance, so a few px of baseline offset is not a new line
                    "metaBarRows": row_groups(meta),
                    "metaBarLines": len(row_groups(meta)),
                    "allAtLeast44": all(l["heightPx"] >= 44 for l in links),
                    "minHeightPx": min((l["heightPx"] for l in links), default=None),
                    "footerHeightPx": page.evaluate("() => Math.round(document.querySelector('footer').getBoundingClientRect().height)"),
                    "pageOverflowPx": page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth"),
                }
                row = out[tag][str(width)]
                print(tag, width, "min:", row["minHeightPx"], "all>=44:", row["allAtLeast44"],
                      "lines:", row["metaBarLines"], "overflow:", row["pageOverflowPx"], "footer:", row["footerHeightPx"])
                page.close()
            proc.kill()
        browser.close()
    json.dump(out, open("/tmp/qwenwork/m461b.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("written /tmp/qwenwork/m461b.json")


main()
