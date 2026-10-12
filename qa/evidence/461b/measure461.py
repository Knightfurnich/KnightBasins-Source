#!/usr/bin/env python3
"""job 461-B - measure the three footer tap targets (data-testids exist in both trees) before/after."""
import json
import subprocess
import time
import urllib.request

from playwright.sync_api import sync_playwright

WORK = "/workspace/89502fb4-0ea2-4102-9a54-af17cdc53eb5/work"
CHROME = "/opt/playwright-browsers/chromium-1209/chrome-linux64/chrome"
IDS = ["link-footer-knightfurnich", "link-footer-hinsangkhro", "link-network-footer-price-guide"]
JS = """(ids) => {
  const links = ids.map((id) => document.querySelector('[data-testid="' + id + '"]')).filter(Boolean);
  const foot = document.querySelector('footer');
  const b = (el) => el.getBoundingClientRect();
  return {
    found: links.length,
    targets: links.map((l) => ({
      testid: l.getAttribute('data-testid'),
      heightPx: +b(l).height.toFixed(1),
      widthPx: Math.round(b(l).width),
      xPx: Math.round(b(l).x), yPx: Math.round(b(l).y),
      lineHeightPx: getComputedStyle(l).lineHeight,
      display: getComputedStyle(l).display,
    })),
    linesUsed: [...new Set(links.map((l) => Math.round(b(l).y)))].length,
    footerHeightPx: foot ? Math.round(b(foot).height) : null,
    pageOverflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}"""


def serve(dist, port):
    proc = subprocess.Popen(["node", f"{WORK}/tmp461/srv461.cjs", dist, str(port)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    end = time.time() + 25
    while time.time() < end:
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=2).read(64)
            return proc
        except Exception:
            time.sleep(0.3)
    proc.kill()
    raise SystemExit(f"harness {dist} not up")


def main():
    trees = {"before": "/tmp/qwenwork/before-dist",
             "after": f"{WORK}/kbsrc/artifacts/knight-basins/dist/public"}
    out = {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=CHROME, args=["--no-sandbox"])
        for i, (tag, dist) in enumerate(trees.items()):
            proc = serve(dist, 3691 + i)
            out[tag] = {}
            for width in (390, 360, 768, 1440):
                page = browser.new_page(viewport={"width": width, "height": 1000})
                page.goto(f"http://127.0.0.1:{3691 + i}/", wait_until="domcontentloaded")
                page.wait_for_timeout(3000)
                out[tag][str(width)] = page.evaluate(JS, IDS)
                page.locator("footer").screenshot(path=f"{WORK}/tmp461/footer-{tag}-{width}.png")
                page.close()
                row = out[tag][str(width)]
                print(tag, width, "h:", [t["heightPx"] for t in row["targets"]], "lines:", row["linesUsed"],
                      "overflow:", row["pageOverflowPx"], "footer:", row["footerHeightPx"], "found:", row["found"])
            proc.kill()
        browser.close()
    json.dump(out, open("/tmp/qwenwork/m461.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("ok")


main()
