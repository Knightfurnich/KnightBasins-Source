/*
 * job 463-C (D/E/F) - evidence for the footer, /readme address and /price-guide map link through Chrome DevTools.
 *
 *   node qa/tools/footer-evidence-463c.mjs <label> [baseUrl]
 *
 * Writes into qa/images/chai-round26/: <label>-footer-{1440,390}.png (the shared footer on "/"),
 * <label>-priceguide-{1440,390}.png (the closing "NEXT STEP" block of /price-guide) and <label>-footer-measure.json
 * (real texts of the address lines, the website label and the map links: href / target / rel / box size).
 * Read-only against the app; no real customer data.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const label = process.argv[2] ?? "run";
const base = process.argv[3] ?? "http://localhost:5173";
const chrome = process.env.CHROME_BIN ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const outDir = new URL("../images/chai-round26/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(outDir, { recursive: true });

const port = 9700 + Math.floor(Math.random() * 200);
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, "--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${mkdtempSync(join(tmpdir(), "chai-463c-f-"))}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let url = "";
for (let i = 0; i < 60 && !url; i++) {
  try { url = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl ?? ""; } catch {}
  if (!url) await sleep(500);
}
const socket = new WebSocket(url);
await new Promise((r) => socket.addEventListener("open", r, { once: true }));
let id = 0;
const waiting = new Map();
socket.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.error ? w.rej(new Error(m.error.message)) : w.res(m.result ?? {}); } });
const cdp = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); socket.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;
await cdp("Page.enable");

const footerMeasure = `(() => {
  const footer = document.querySelector('footer.site-footer');
  const link = (testid) => { const a = document.querySelector('[data-testid="' + testid + '"]'); if (!a) return null; const r = a.getBoundingClientRect(); return { text: a.textContent.trim(), href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel'), w: Math.round(r.width), h: Math.round(r.height) }; };
  return {
    addressLines: [...document.querySelectorAll('.footer-address div')].map((d) => d.textContent.trim()),
    websiteKeys: [...document.querySelectorAll('.footer-contact-item')].map((e) => e.textContent.trim()).filter((t) => t.includes('www.knightfurnich.com')),
    mapLink: link('link-footer-map'), oldMapsLink: link('link-footer-maps'),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    footerH: Math.round(footer.getBoundingClientRect().height),
  };
})()`;
const guideMeasure = `(() => { const a = document.querySelector('[data-testid="link-price-guide-map"]'); if (!a) return { mapLink: null, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth }; const r = a.getBoundingClientRect(); return { mapLink: { text: a.textContent.trim(), href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel'), w: Math.round(r.width), h: Math.round(r.height) }, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth }; })()`;

async function clip(name, find) {
  const rect = await ev(`(() => { const e = ${find}; e.scrollIntoView(); const r = e.getBoundingClientRect(); return { x: 0, y: r.top + scrollY - 8, width: document.documentElement.clientWidth, height: r.height + 16 }; })()`);
  const { data } = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { ...rect, scale: 1 } });
  writeFileSync(join(outDir, `${label}-${name}.png`), Buffer.from(data, "base64"));
}
const result = { label, baseline: base, at: new Date().toISOString() };
for (const [vp, w, h, mobile, dsf] of [["1440", 1440, 900, false, 1], ["390", 390, 844, true, 2]]) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dsf, mobile });
  await cdp("Page.navigate", { url: `${base}/` });
  await sleep(5000);
  result[`footer${vp}`] = await ev(footerMeasure);
  await clip(`footer-${vp}`, "document.querySelector('footer.site-footer')");
  await cdp("Page.navigate", { url: `${base}/price-guide` });
  await sleep(5000);
  result[`priceGuide${vp}`] = await ev(guideMeasure);
  await clip(`priceguide-${vp}`, `document.querySelector('[data-testid="link-price-guide-final-quote"]').closest('section')`);
}
writeFileSync(join(outDir, `${label}-footer-measure.json`), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
socket.close(); proc.kill(); process.exit(0);
