/*
 * sweep-467c.mjs - ONE script that sweeps every storefront route in BOTH themes with both measuring tools (job 467-C, E).
 *
 *   node qa/tools/sweep-467c.mjs <baseUrl> [--sitemap https://knightbasins.com/sitemap.xml] [--out qa/images/chai-round29/sweep] [--extra /a,/b#state]
 *
 *   routes = every <loc> of the sitemap (fetched, never typed by hand) + the routes outside it
 *            (/profile /handover /track /quote/view, and /quote#cart = /quote with two basin lines in the cart)
 *   tools  = qa/tools/contrast-probe.js (David's: solid backgrounds only) and qa/tools/gradient-scan-465c.mjs (real pixels: sees
 *            gradients / photos / overlays). A route passes when the pixel scan has no failing text other than
 *            - the LINE green login button (boss decision, 2.26 kept), and
 *            - text inside a hero block (hero rule #449 is frozen: reported, not counted).
 *   output = a table on stdout + <out>/sweep-<theme>.json ; exit code 1 when any route has a failing text outside those two groups
 *            (so a CI job can run it; wiring it into .github/** needs David's separate approval and is NOT done here).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const sitemapUrl = opt("--sitemap", "https://knightbasins.com/sitemap.xml");
const outDir = opt("--out", "qa/images/chai-round29/sweep");
const extra = opt("--extra", "/profile,/handover,/track,/quote/view,/quote#cart").split(",").filter(Boolean);
const base = (args[0] ?? "http://localhost:5173").replace(/\/$/, "");
mkdirSync(outDir, { recursive: true });

const xml = await (await fetch(sitemapUrl)).text();
const fromSitemap = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname || "/");
const routes = [...new Set([...fromSitemap, ...extra])];
console.log(`sitemap ${sitemapUrl}: ${fromSitemap.length} routes -> ${fromSitemap.join(" ")}`);
console.log(`outside the sitemap: ${extra.join(" ")}\n`);

const env = { ...process.env, MSYS_NO_PATHCONV: "1" };
const verdict = [];
for (const theme of ["dark", "light"]) {
  const json = join(outDir, `sweep-${theme}.json`);
  const scan = spawnSync("node", [join(here, "gradient-scan-465c.mjs"), base, theme, ...routes, "--json", json], { encoding: "utf8", env, maxBuffer: 1 << 28 });
  if (scan.status !== 0) { console.error(scan.stderr || scan.stdout); process.exit(2); }
  const results = JSON.parse(readFileSync(json, "utf8"));
  for (const r of results) {
    const route = r.target.split("#")[0];
    const probe = r.target.includes("#") ? null : spawnSync("node", [join(here, "contrast-probe.js"), base + route, theme], { encoding: "utf8", env: { ...env, CHROME_BIN: process.env.CHROME_BIN ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" } });
    const probeFail = probe ? Number((probe.stdout.match(/ต่ำกว่าเกณฑ์:\s*(\d+)/) ?? [])[1] ?? NaN) : null;
    const line = r.rows.filter((x) => /button-line-login/.test(x.selector));
    const hero = r.rows.filter((x) => x.hero && !/button-line-login/.test(x.selector));
    const real = r.rows.filter((x) => !x.hero && !/button-line-login/.test(x.selector));
    verdict.push({ theme, target: r.target, checked: r.checked, probeFail, scanFail: r.failing, line: line.length, hero: hero.length, real: real.length, overflowPx: r.overflow.scrollWidth - r.overflow.clientWidth, worst: real[0] ? `${real[0].ratio} ${real[0].selector} "${real[0].text}"` : "" });
  }
}
const pad = (s, n) => String(s).padEnd(n);
console.log(pad("theme", 6) + pad("route", 16) + pad("checked", 8) + pad("probe", 6) + pad("scan", 6) + pad("LINE", 5) + pad("hero#449", 9) + pad("REAL", 5) + pad("overflow", 9) + "worst real row");
for (const v of verdict) console.log(pad(v.theme, 6) + pad(v.target, 16) + pad(v.checked, 8) + pad(v.probeFail ?? "-", 6) + pad(v.scanFail, 6) + pad(v.line, 5) + pad(v.hero, 9) + pad(v.real, 5) + pad(v.overflowPx + "px", 9) + v.worst);
writeFileSync(join(outDir, "sweep-summary.json"), JSON.stringify(verdict, null, 1));
const bad = verdict.filter((v) => v.real > 0 || v.overflowPx > 0);
console.log(`\n${bad.length ? "FAIL" : "PASS"}: ${bad.length} route/theme pair(s) with failing text outside the LINE button and the frozen hero blocks (or horizontal overflow)`);
process.exit(bad.length ? 1 : 0);
