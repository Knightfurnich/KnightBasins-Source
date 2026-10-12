/*
 * job 465-C - before/after pictures + horizontal-overflow check for the four pages the work order asks for.
 *
 *   node qa/tools/contrast-shots-465c.mjs <label> <baseUrl>
 *
 * Writes qa/images/chai-round27/<label>-<page>-<theme>-<1440|390>.png and <label>-shots.json (overflowX per shot).
 * "before" is taken from the production domain (= main), "after" from the local build of this branch. Read-only.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const label = process.argv[2] ?? "run";
const base = process.argv[3] ?? "http://localhost:5173";
const chrome = process.env.CHROME_BIN ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const outDir = new URL("../images/chai-round27/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(outDir, { recursive: true });

// page key, route, theme, optional selector to crop to (else the whole page, capped)
const shots = [
  ["price-guide", "/price-guide", "dark", null],
  ["price-guide", "/price-guide", "light", null],
  ["quote", "/quote", "light", null],
  ["home", "/", "dark", ".catalog-toolbar"],
  ["studio", "/studio", "dark", null],
  ["stone-swatch", "/stone", "dark", ".material-swatch"],
].filter(([key]) => !process.env.ONLY || process.env.ONLY.split(",").includes(key));

const port = 9500 + Math.floor(Math.random() * 300);
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, "--headless=new", "--disable-gpu", "--no-sandbox", `--user-data-dir=${mkdtempSync(join(tmpdir(), "chai-465c-shot-"))}`, "about:blank"], { stdio: "ignore" });
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
const ev = async (expression) => (await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value;
await cdp("Page.enable");

const result = { label, base, at: new Date().toISOString(), shots: [] };
for (const [vp, w, h, mobile, dsf] of [["1440", 1440, 900, false, 1], ["390", 390, 844, true, 2]]) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dsf, mobile });
  for (const [key, route, theme, sel] of shots) {
    await cdp("Page.navigate", { url: base + route });
    await sleep(2500);
    await ev(`localStorage.setItem("knight-storefront-theme","${theme}"); location.reload();`);
    await sleep(4000);
    const overflowX = await ev("document.documentElement.scrollWidth - document.documentElement.clientWidth");
    let clip;
    if (sel) {
      clip = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.scrollIntoView(); const r = e.getBoundingClientRect(); return { x: 0, y: r.top + scrollY - 8, width: document.documentElement.clientWidth, height: Math.min(r.height + 700, 1300) }; })()`);
    } else {
      const height = await ev("Math.min(document.documentElement.scrollHeight, 4200)");
      clip = { x: 0, y: 0, width: w, height };
    }
    const { data } = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { ...clip, scale: 1 } });
    const file = `${label}-${key}-${theme}-${vp}.png`;
    writeFileSync(join(outDir, file), Buffer.from(data, "base64"));
    result.shots.push({ file, route, theme, viewport: vp, overflowX });
    console.log(file, "overflowX", overflowX);
  }
}
writeFileSync(join(outDir, `${label}-shots.json`), JSON.stringify(result, null, 2));
socket.close(); proc.kill(); process.exit(0);
