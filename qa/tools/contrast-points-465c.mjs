/*
 * job 465-C - per-point before/after contrast ratios, measured with the work-order probe's own PROBE_SOURCE
 * (qa/tools/contrast-probe.js, read from disk, untouched) in `all` mode and matched by selector / text.
 *
 *   node qa/tools/contrast-points-465c.mjs <label> <baseUrl>      -> qa/images/chai-round27/<label>-points.json
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [label, base] = process.argv.slice(2);
const chrome = process.env.CHROME_BIN ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const probeText = readFileSync(new URL("./contrast-probe.js", import.meta.url), "utf8");
const source = probeText.slice(probeText.indexOf("const PROBE_SOURCE = ") + "const PROBE_SOURCE = ".length, probeText.indexOf("\n  const print = ")).trim().replace(/;$/, "");

// id, route, theme, match(row) -> bool
const has = (s) => (r) => r.selector.includes(s);
const text = (s) => (r) => r.text.includes(s);
const points = [
  ["A1 CARE card text", "/price-guide", "dark", (r) => r.selector.includes("ul.grid > li") && r.text.includes("เช็ดคราบทั่วไป")],
  ["A1 CARE card text", "/price-guide", "light", (r) => r.selector.includes("ul.grid > li") && r.text.includes("เช็ดคราบทั่วไป")],
  ["A2 NEXT STEP h2", "/price-guide", "dark", (r) => r.selector.includes("h2") && r.text.includes("พร้อมเช็กราคา")],
  ["A2 NEXT STEP h2", "/price-guide", "light", (r) => r.selector.includes("h2") && r.text.includes("พร้อมเช็กราคา")],
  ["A2 NEXT STEP kicker", "/price-guide", "dark", text("NEXT STEP")],
  ["A2 NEXT STEP kicker", "/price-guide", "light", text("NEXT STEP")],
  ["A3 CTA button", "/price-guide", "dark", has("link-price-guide-final-quote")],
  ["A3 CTA button", "/price-guide", "light", has("link-price-guide-final-quote")],
  ["B1 /updates back link", "/updates", "dark", has("link-updates-back-to-store")],
  ["B2 /network card title", "/network", "dark", (r) => r.selector.includes("network-card-knight-furnich") && r.selector.includes("h2")],
  ["B2 /network bottom menu", "/network", "dark", has("link-network-stone")],
  ["C /quote share title", "/quote", "light", (r) => r.selector.includes("quote-share") && r.text.includes("ยืนยันแบบ")],
  ["C /quote share title", "/quote", "dark", (r) => r.selector.includes("quote-share") && r.text.includes("ยืนยันแบบ")],
  ["C /quote generate button", "/quote", "light", has("button-generate-quote")],
  ["D home studio action", "/", "dark", has("link-basin-studio-")],
  ["D home basin-only button", "/", "dark", has("button-quote-basin-")],
  ["E /portfolio tab", "/portfolio", "dark", has("portfolio-tab-bathroom")],
  ["F /stone swatch label", "/stone", "dark", (r) => r.selector.includes("material-swatch") && r.size === "12px"],
  ["G /readme maps button", "/readme", "light", has("link-google-maps-factory")],
  ["G /readme click card", "/readme", "dark", text("คลิกเพื่อเลือกซื้อ")],
  ["H /studio edge 'ปกติ'", "/studio", "dark", has("select-edge-0-top")],
  ["H /studio edge toolbar", "/studio", "dark", has("button-studio-edge-status-upstand")],
  ["H /studio piece heading", "/studio", "dark", (r) => r.selector.includes("studio-piece-card") && r.selector.includes("h4")],
  ["footer contact text", "/", "dark", (r) => r.selector.includes("site-footer") && r.text.includes("โทร")],
];

const port = 9800 + Math.floor(Math.random() * 150);
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, "--headless=new", "--disable-gpu", "--no-sandbox", `--user-data-dir=${mkdtempSync(join(tmpdir(), "chai-465c-p-"))}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws = "";
for (let i = 0; i < 60 && !ws; i++) {
  try { ws = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl ?? ""; } catch {}
  if (!ws) await sleep(500);
}
const socket = new WebSocket(ws);
await new Promise((r) => socket.addEventListener("open", r, { once: true }));
let id = 0;
const waiting = new Map();
socket.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); w(m.result ?? {}); } });
const cdp = (method, params = {}) => new Promise((res) => { const i = ++id; waiting.set(i, res); socket.send(JSON.stringify({ id: i, method, params })); });
await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

const cache = new Map();
const out = [];
for (const [pid, route, theme, match] of points) {
  const key = route + "|" + theme;
  if (!cache.has(key)) {
    await cdp("Page.navigate", { url: base + route });
    await sleep(3000);
    await cdp("Runtime.evaluate", { expression: `localStorage.setItem("knight-storefront-theme","${theme}"); location.reload();` });
    await sleep(3500);
    const r = await cdp("Runtime.evaluate", { expression: `(${source})({all:true,limit:100000})`, returnByValue: true });
    cache.set(key, r.result?.value?.rows ?? []);
  }
  const rows = cache.get(key).filter(match);
  const worst = rows.sort((a, b) => a.ratio - b.ratio)[0];
  out.push({ point: pid, route, theme, matched: rows.length, ratio: worst?.ratio ?? null, threshold: worst?.threshold ?? null, fg: worst?.fg ?? null, bg: worst?.bg ?? null });
  console.log(pid.padEnd(28), theme.padEnd(6), route.padEnd(12), worst ? `${worst.ratio} (need ${worst.threshold}) ${worst.fg} on ${worst.bg}` : "no row (not measurable: background-image or element absent)");
}
writeFileSync(new URL(`../images/chai-round27/${label}-points.json`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), JSON.stringify(out, null, 1));
socket.close(); proc.kill(); process.exit(0);
