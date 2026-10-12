/*
 * job 465-C - blind spot of qa/tools/contrast-probe.js: it returns "unmeasurable" (and so never reports) any text whose
 * ancestor chain has a background-image, which includes every gradient. This lists elements that carry a gradient
 * *and* text, with the gradient's end colours and the text colour, so the probe's blind areas can be checked by hand.
 *
 *   node qa/tools/gradient-scan-465c.mjs <baseUrl> <theme> <route> [route ...]
 */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [base, theme, ...routes] = process.argv.slice(2);
const chrome = process.env.CHROME_BIN ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = 9100 + Math.floor(Math.random() * 300);
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, "--headless=new", "--disable-gpu", "--no-sandbox", `--user-data-dir=${mkdtempSync(join(tmpdir(), "chai-465c-g-"))}`, "about:blank"], { stdio: "ignore" });
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
const scan = `(() => [...document.querySelectorAll("body *")].filter((e) => { const s = getComputedStyle(e); return s.backgroundImage.includes("gradient") && e.getBoundingClientRect().width > 50 && (e.innerText || "").trim().length > 2; }).map((e) => { const s = getComputedStyle(e); return e.tagName.toLowerCase() + "." + String(e.className).slice(0, 50) + " | " + (s.backgroundImage.match(/rgba?\\([^)]*\\)/g) || []).slice(0, 2).join(" ") + " | text " + s.color; }))()`;
for (const route of routes) {
  await cdp("Page.navigate", { url: base + route });
  await sleep(3000);
  await cdp("Runtime.evaluate", { expression: `localStorage.setItem("knight-storefront-theme","${theme}"); location.reload();` });
  await sleep(3500);
  const r = await cdp("Runtime.evaluate", { expression: scan, returnByValue: true });
  console.log(`${theme} ${route}`);
  for (const line of r.result?.value ?? []) console.log("   ", line);
}
socket.close(); proc.kill(); process.exit(0);
