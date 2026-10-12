/*
 * job 465-C - same measurement as qa/tools/contrast-probe.js (the probe file itself is untouched; its PROBE_SOURCE is read
 * from disk and only the selector label is widened), but each failing point is reported with its full class list so a
 * fix can target the right class. Output: grouped rows (theme, route, ratio, fg, bg, tag.classes, count, sample text).
 *
 *   node qa/tools/contrast-classes-465c.mjs <baseUrl> <theme: light|dark> <out.json> <route> [route ...]
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [base, theme, outFile, ...routes] = process.argv.slice(2);
const chrome = process.env.CHROME_BIN ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const probeText = readFileSync(new URL("./contrast-probe.js", import.meta.url), "utf8");
const start = probeText.indexOf("const PROBE_SOURCE = function");
const end = probeText.indexOf("\n  const print = ");
let source = probeText.slice(start + "const PROBE_SOURCE = ".length, end).trim().replace(/;$/, "");
// widen the label: every class, and the whole testid
source = source.replace(
  /const first = node\.className\.trim\(\)\.split\(\/\\s\+\/\)\.filter\(\(c\) => !\/\^\(dark\|hover\|sm\|md\|lg\):\/\.test\(c\)\)\[0\];\s*if \(first\) s \+= "\." \+ first;/,
  'const first = node.className.trim().split(/\\s+/).filter((c) => !/^(dark|hover|sm|md|lg):/.test(c)).join("."); if (first) s += "." + first;',
);
source = source.replace(
  /if \(node\.dataset && node\.dataset\.testid\) s \+= '\[data-testid="' \+ node\.dataset\.testid \+ '"\]';/,
  `if (node.dataset && node.dataset.testid) s += '[data-testid="' + node.dataset.testid + '"]' + (typeof node.className === "string" ? "." + node.className.trim().split(/\\s+/).join(".") : "");`,
);

// also report which ancestor supplied the background (class list), so a fix can target the surface itself
source = source.replace("if (c && c[3] > 0.5) return c;", "if (c && c[3] > 0.5) { window.__bgNode = node; return c; }");
source = source.replace("text: ownText.slice(0, 40),", 'text: ownText.slice(0, 40), bgel: window.__bgNode ? window.__bgNode.tagName.toLowerCase() + "." + (typeof window.__bgNode.className === "string" ? window.__bgNode.className.trim().split(/\s+/).slice(0, 5).join(".") : "") : "",');
if (!source.includes('.join(".")')) throw new Error("probe label patch did not apply");

const port = 9300 + Math.floor(Math.random() * 300);
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, "--headless=new", "--disable-gpu", "--no-sandbox", `--user-data-dir=${mkdtempSync(join(tmpdir(), "chai-465c-"))}`, "about:blank"], { stdio: "ignore" });
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

const out = [];
for (const route of routes) {
  await cdp("Page.navigate", { url: base + route });
  await sleep(3500);
  await cdp("Runtime.evaluate", { expression: `localStorage.setItem("knight-storefront-theme","${theme}"); location.reload();` });
  await sleep(3500);
  const r = await cdp("Runtime.evaluate", { expression: `(${source})({})`, returnByValue: true });
  const report = r.result?.value;
  if (!report) { out.push({ route, error: "no report" }); continue; }
  const groups = new Map();
  for (const row of report.rows) {
    const label = row.selector.split(" > ").pop().replace(/(KF\d+|-\d{6,}(-\d+)?(-[a-z]+)?)/g, "*").replace(/(item-update|card-product|button-quote-basin|link-basin-studio|select-edge)-[^"\]]*/g, "$1-*");
    const key = `${row.fg}|${row.bg}|${label}|${row.bgel}`;
    const g = groups.get(key) ?? { route, theme, ratio: row.ratio, fg: row.fg, bg: row.bg, size: row.size, label, bgel: row.bgel, count: 0, sample: row.text };
    g.count++;
    groups.set(key, g);
  }
  out.push(...groups.values());
}
writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(`wrote ${out.length} groups -> ${outFile}`);
socket.close(); proc.kill(); process.exit(0);
