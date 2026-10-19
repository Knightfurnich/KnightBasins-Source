/*
 * sweep-467c.mjs - ONE script that sweeps every storefront route in BOTH themes with both measuring tools (job 467-C, E).
 *
 *   node qa/tools/sweep-467c.mjs <baseUrl> [--sitemap https://knightbasins.com/sitemap.xml] [--out qa/images/chai-round29/sweep] [--extra /a,/b#state]
 *
 *   routes = every <loc> of the sitemap (fetched, never typed by hand) + the routes outside it
 *            (/profile /handover /track /quote/view, and /quote#cart = /quote with two basin lines in the cart)
 *   tools  = qa/tools/contrast-probe.js (David's: solid backgrounds only) and qa/tools/gradient-scan-465c.mjs (real pixels: sees
 *            gradients / photos / overlays). A route passes when the pixel scan has no failing text other than
 *            - only the unchanged white-on-green LINE login button (boss decision, 2.26 kept).
 *   Heroes now count. Missing browser, route coverage, or measurements FAIL explicitly.
 *   SCAN_WIDTH=1440/390: the CI job uses a two-width matrix, each case capped at ten minutes.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const compareDir = opt("--compare-rounds", null);
if (compareDir) {
  const summaries = [];
  const walk = dir => { for (const entry of readdirSync(dir, { withFileTypes:true })) {
    const path=join(dir,entry.name);
    if(entry.isDirectory()) walk(path);
    else if(entry.name==="sweep-summary.json") summaries.push(path);
  }};
  walk(compareDir);
  if(summaries.length!==4) throw Error(`Expected four complete same-commit sweep summaries, got ${summaries.length}`);
  for(const width of [1440,390]){
    const load = round => {
      const paths=summaries.filter(p=>p.includes(`contrast-${width}-round${round}/`));
      if(paths.length!==1)throw Error(`Missing/duplicate ${width} round ${round}`);
      const data=JSON.parse(readFileSync(paths[0],"utf8"));
      if(data.length!==34||data.some(r=>r.real||r.overflowPx||!r.readiness?.ok))throw Error(`Incomplete/failing ${width} round ${round}`);
      return data.map(r=>({theme:r.theme,target:r.target,checked:r.checked,real:r.real,overflowPx:r.overflowPx,
        occluded:r.occluded,notMeasurable:r.notMeasurable,coverage:r.coverage}));
    };
    const first=load(1),second=load(2);
    if(JSON.stringify(first)!==JSON.stringify(second))throw Error(`${width}: route counts/coverage/verdicts differ across rounds`);
    for(const r of first)console.log(`STABLE ${width} ${r.theme} ${r.target}: checked=${r.checked} occluded=${r.occluded} notMeasurable=${r.notMeasurable} REAL=${r.real} overflow=${r.overflowPx}`);
  }
  console.log("PASS: both widths, 34 pairs each, identical readiness-gated counts, coverage, exclusions and verdicts across two rounds");
  process.exit(0);
}
const sitemapUrl = opt("--sitemap", "https://knightbasins.com/sitemap.xml");
const outDir = opt("--out", "qa/images/replit-round30/sweep");
const extra = opt("--extra", "/profile,/handover,/track,/quote/view,/quote#cart").split(",").filter(Boolean);
const base = (args[0] ?? "http://localhost:5173").replace(/\/$/, "");
const chrome = process.env.CHROME_BIN ?? "/usr/bin/google-chrome";
if (!existsSync(chrome)) { console.error(`Chrome unavailable at ${chrome} — contrast was NOT checked`); process.exit(2); }
mkdirSync(outDir, { recursive: true });

const response = await fetch(sitemapUrl);
if (!response.ok) throw new Error(`Sitemap HTTP ${response.status} — contrast was NOT checked`);
const xml = await response.text();
const fromSitemap = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname || "/");
if (fromSitemap.length !== 12) throw new Error(`Expected 12 sitemap routes, received ${fromSitemap.length} — contrast was NOT checked`);
const routes = [...new Set([...fromSitemap, ...extra])];
console.log(`sitemap ${sitemapUrl}: ${fromSitemap.length} routes -> ${fromSitemap.join(" ")}`);
console.log(`outside the sitemap: ${extra.join(" ")}\n`);

const ALLOWLIST = [{
  name: "Owner-approved LINE green login, white text on #06c755 (2.26)",
  matches: (row) => /button\[button-line-login\](?: >|$)/.test(row.selector) &&
    row.fg.slice(0, 3).every((c) => c === 255) &&
    row.bg.every((c, i) => Math.abs(c - [6, 199, 85][i]) <= 2) && Math.abs(row.ratio - 2.26) <= 0.06,
}];
const env = { ...process.env, CHROME_BIN: chrome, MSYS_NO_PATHCONV: "1" };
const verdict = [];
const probeTasks = [];
for (const theme of ["dark", "light"]) {
  const json = join(outDir, `sweep-${theme}.json`);
  const scan = spawnSync("node", [join(here, "gradient-scan-465c.mjs"), base, theme, ...routes, "--all", "--json", json], { encoding: "utf8", env, maxBuffer: 1 << 28, timeout: 240000 });
  writeFileSync(join(outDir, `pixel-${theme}.log`), scan.stdout + scan.stderr);
  if (scan.status !== 0) { console.error(scan.stderr || scan.stdout); process.exit(2); }
  const results = JSON.parse(readFileSync(json, "utf8"));
  if (results.length !== routes.length || results.some((r, i) => r.target !== routes[i] || r.theme !== theme || !r.checked)) throw new Error("Incomplete pixel coverage — contrast was NOT checked");
  for (const r of results) {
    const route = r.target.split("#")[0];
    const failures = r.rows.filter((x) => x.ratio < x.threshold);
    const line = failures.filter((x) => ALLOWLIST.some((entry) => entry.matches(x)));
    const real = failures.filter((x) => !ALLOWLIST.some((entry) => entry.matches(x)));
    const hero = real.filter((x) => x.hero);
    const v = { theme, target: r.target, checked: r.checked, readiness:r.readiness,
      occluded:r.unmeasurable.filter(x=>x.status.startsWith("occluded")).length,
      notMeasurable:r.unmeasurable.filter(x=>!x.status.startsWith("occluded")).length,
      coverage: r.coverage, unmeasurable:r.unmeasurable, probeFail: null, scanFail: r.failing, line: line.length, hero: hero.length, real: real.length, overflow: r.overflow, overflowPx: r.overflow.scrollWidth - r.overflow.clientWidth, worst: real[0] ? `${real[0].ratio} ${real[0].selector} "${real[0].text}"` : "" };
    verdict.push(v);
    if (!r.target.includes("#")) probeTasks.push(async () => {
      const output = await new Promise((resolve, reject) => {
        const child = spawn("node", [join(here, "contrast-probe.js"), base + route, theme], { env });
        let text = "";
        child.stdout.on("data", (chunk) => { text += chunk; });
        child.stderr.on("data", (chunk) => { text += chunk; });
        const timer = setTimeout(() => child.kill(), 45000);
        child.on("error", reject);
        child.on("exit", (code) => { clearTimeout(timer); code === 0 || code === 1 ? resolve(text) : reject(new Error(`${route}: probe failed — contrast was NOT checked\n${text}`)); });
      });
      writeFileSync(join(outDir, `probe-${theme}-${route.replace(/\//g, "") || "home"}.log`), output);
      const count = output.match(/ต่ำกว่าเกณฑ์:\s*(\d+)/)?.[1];
      if (count === undefined) throw new Error(`${route}: probe produced no measurement — contrast was NOT checked`);
      v.probeFail = Number(count);
    });
  }
}
for (let i = 0; i < probeTasks.length; i += 4) await Promise.all(probeTasks.slice(i, i + 4).map((run) => run()));
const pad = (s, n) => String(s).padEnd(n);
console.log(pad("theme", 6) + pad("route", 16) + pad("checked", 8) + pad("probe", 6) + pad("scan", 6) + pad("LINE", 5) + pad("hero", 9) + pad("REAL", 5) + pad("overflow", 9) + "worst real row");
for (const v of verdict) console.log(pad(v.theme, 6) + pad(v.target, 16) + pad(v.checked, 8) + pad(v.probeFail ?? "-", 6) + pad(v.scanFail, 6) + pad(v.line, 5) + pad(v.hero, 9) + pad(v.real, 5) + pad(v.overflowPx + "px", 9) + v.worst);
for (const v of verdict) console.log(`coverage ${v.theme} ${v.target}: checked=${v.checked} occluded=${v.occluded} notMeasurable=${v.notMeasurable}`);
writeFileSync(join(outDir, "sweep-summary.json"), JSON.stringify(verdict, null, 1));
const bad = verdict.filter((v) => v.real > 0 || v.overflowPx > 0);
console.log(`\n${bad.length ? "FAIL" : "PASS"}: ${bad.length} route/theme pair(s) with failing text outside the declared LINE allowlist (including heroes), or horizontal overflow`);
process.exit(bad.length ? 1 : 0);
