/*
 * audit.mjs - job 472-C evidence tool (lives next to the evidence, NOT in qa/tools/**: that folder belongs to Replit).
 *
 *   node audit.mjs qty   <baseUrl> <light|dark> <width> [shotPrefix]   measure + photograph the quote-line quantity box (/quote with 2 lines in the cart)
 *   node audit.mjs rules <baseUrl> <light|dark> <width> [out.json]      B: every stylesheet rule that paints a literal solid colour
 *                                                                        (not var(--x), not a gradient) -> the elements it really paints on
 *                                                                        the storefront routes -> worst WCAG ratio of the text inside, read
 *                                                                        from the browser's computed styles (not from reading the CSS)
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [mode, base, theme, widthArg, outArg, routeArg] = process.argv.slice(2);
const width = Number(widthArg || 1440);
const chrome = process.env.CHROME_BIN ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = 9400 + Math.floor(Math.random() * 300);
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, "--headless=new", "--disable-gpu", "--no-sandbox", `--user-data-dir=${mkdtempSync(join(tmpdir(), "chai-472c-"))}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws = "";
for (let i = 0; i < 60 && !ws; i++) { try { ws = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl ?? ""; } catch {} if (!ws) await sleep(500); }
const socket = new WebSocket(ws);
await new Promise((r) => (socket.onopen = r));
let id = 0; const pending = new Map();
socket.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const cdp = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (d) => (d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result))); socket.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
async function open(route, cart, studio) {
  await cdp("Page.navigate", { url: base + route });
  await sleep(2000);
  await ev(`localStorage.setItem("knight-storefront-theme","${theme}"); ${cart ? `localStorage.setItem("knight-cart", JSON.stringify([{ sku: "KF001", quantity: 2, installationSelected: true }, { sku: "KF009", quantity: 1, installationSelected: false }]));` : ""} location.reload();`);
  await sleep(3500);
  await ev(`(() => { const s = document.createElement("style"); s.textContent = "*,*::before,*::after{animation:none!important;transition:none!important}"; document.head.appendChild(s); })()`); // measure the settled state, not a fade-in frame
  await sleep(300);
}

// usage: node shots.mjs _ <base> <theme> <width> <prefix>  -> <prefix>-<name>-<theme>-<width>.png (element clips, 2x)
import { writeFileSync as wf } from "node:fs";
const jobs = [
  { name: "nav", route: "/", sel: ".site-header", wait: ".site-header" },
  { name: "cards", route: "/", sel: ".product-grid", wait: "article.product-card", maxH: 460, withSearch: true },
  { name: "search", route: "/", sel: ".catalog-toolbar", wait: ".search-field" },
  { name: "quote-row", route: "/quote#cart", sel: "[data-testid^=row-quote]", wait: ".vat-row label" },
  { name: "quote-summary", route: "/quote#cart", sel: ".quote-summary", wait: ".vat-row label", maxH: 520 },
  { name: "studio-top", route: "/studio", sel: ".studio-progress", wait: ".studio-progress-step-icon", parent: 2 },
  { name: "studio-toolbar", route: "/studio", sel: ".studio-draft-toolbar-actions", wait: ".studio-draft-toolbar-actions", parent: 1 },
  { name: "portfolio-search", route: "/portfolio", sel: ".portfolio-search-bar", wait: ".portfolio-search-bar input" },
];
let lastRoute = "";
for (const j of jobs) {
  const [path, st] = j.route.split("#");
  if (j.route !== lastRoute) { await open(path, st === "cart"); lastRoute = j.route; }
  for (let i = 0; i < 25 && !(await ev(`!!document.querySelector(${JSON.stringify(j.wait)})`)); i++) await sleep(1000);
  await sleep(400);
  const r = await ev(`(() => { let el = document.querySelector(${JSON.stringify(j.sel)}); for (let i = 0; i < ${j.parent ?? 0}; i++) el = el.parentElement; const b = el.getBoundingClientRect(); return { x: b.x + scrollX, y: b.y + scrollY, w: b.width, h: b.height }; })()`);
  const pad = 10;
  const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: Math.min(width, r.w + 2 * pad), height: Math.min(j.maxH ?? 700, r.h + 2 * pad), scale: 1 } });
  wf(`${outArg}-${j.name}-${theme}-${width}.png`, Buffer.from(shot.data, "base64"));
}
console.log("shots", theme, width);
socket.close(); proc.kill(); process.exit(0);
