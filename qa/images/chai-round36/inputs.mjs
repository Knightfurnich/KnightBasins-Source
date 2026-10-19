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

/*
 * inputs.mjs - job 475-C evidence tool: every visible input / select / textarea on the customer routes, and the contrast of the boundary
 * that makes the field perceivable (WCAG 1.4.11, 3:1), read from the real browser (computed styles, opacity-aware, animations frozen).
 *   node inputs.mjs _ <baseUrl> <light|dark> <width> <out.json>
 * boundary of a field = its own border (any side with width > 0) or its own fill; when the field draws neither, the nearest ancestor that
 * encloses it and draws a border / fill (e.g. .search-field) is the boundary. Ratio = min(boundary vs the surface outside, boundary vs the
 * field's inside). Lives next to the evidence (qa/tools/** belongs to Replit).
 */
import { writeFileSync as wf } from "node:fs";
const LIB = `(() => {
  const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const rgba = (c) => { cv.clearRect(0,0,1,1); cv.fillStyle = "#000"; cv.fillStyle = c; cv.fillRect(0,0,1,1); const d = cv.getImageData(0,0,1,1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const l1 = lum(a[0], a[1], a[2]), l2 = lum(b[0], b[1], b[2]); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const over = (fg, bg, a) => [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
  const opac = (n) => { let o = 1; for (; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
  const surface = (el, includeSelf) => { const layers = []; let n = includeSelf ? el : el.parentElement; while (n && n.nodeType === 1) { const s = getComputedStyle(n); if (s.backgroundImage !== "none") { const st = [...s.backgroundImage.matchAll(/rgba?[(]([0-9]+)[^0-9]+([0-9]+)[^0-9]+([0-9]+)/g)].map((m) => [+m[1], +m[2], +m[3]]); const mean = st.length ? [0, 1, 2].map((i) => st.reduce((x, y) => x + y[i], 0) / st.length) : [128, 128, 128]; layers.push([[mean[0], mean[1], mean[2], 1], opac(n)]); break; } const c = rgba(s.backgroundColor); const a = c[3] * opac(n); if (a > 0) layers.push([c, a]); if (c[3] >= 0.99 && opac(n) >= 0.99) break; n = n.parentElement; } let out = [255,255,255,1]; for (const [c, a] of layers.reverse()) out = over(c, out, a); return out; };
  const R = (v) => Math.round(v * 100) / 100;
  const rgbs = (c) => "rgb(" + c.slice(0, 3).map(Math.round).join(",") + ")";
  const visible = (el) => { if (!el.getClientRects().length) return false; const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false; for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const s = getComputedStyle(n); if (s.visibility === "hidden" || s.display === "none" || parseFloat(s.opacity) < 0.3) return false; } return true; };
  const label = (el) => { const t = el.dataset.testid; const base = el.tagName.toLowerCase() + (el.type && el.tagName === "INPUT" ? "[" + el.type + "]" : ""); return t ? base + "[" + t + "]" : base + (el.className ? "." + String(el.className).trim().split(" ")[0] : "") + (el.name ? "[name=" + el.name + "]" : ""); };
  // how a box shows its edge: strongest border side (any width > 0) else its fill
  const edge = (el) => { const s = getComputedStyle(el); const outside = surface(el, false); const inside = surface(el, true); const out = []; for (const side of ["Top", "Right", "Bottom", "Left"]) { const w = parseFloat(s["border" + side + "Width"]); if (!w || s["border" + side + "Style"] === "none") continue; const c = rgba(s["border" + side + "Color"]); if (c[3] === 0) continue; const eff = over(c, outside, c[3] * opac(el)); out.push({ kind: "border-" + side.toLowerCase(), w, color: eff, ratio: Math.min(ratio(eff, outside), ratio(eff, inside)), outside, inside }); } const ring = s.boxShadow.match(/(rgba?[(][^)]*[)]) 0px 0px 0px ([0-9.]+)px inset/); if (ring) { const c = rgba(ring[1]); const eff = over(c, outside, c[3] * opac(el)); out.push({ kind: "ring", w: parseFloat(ring[2]), color: eff, ratio: Math.min(ratio(eff, outside), ratio(eff, inside)), outside, inside }); } const fill = rgba(s.backgroundColor); if (fill[3] > 0.05 && s.backgroundImage === "none") { const eff = over(fill, outside, fill[3] * opac(el)); out.push({ kind: "fill", w: 0, color: eff, ratio: ratio(eff, outside), outside, inside: eff }); } out.sort((a, b) => b.ratio - a.ratio); return out; };
  return { rgba, ratio, over, opac, surface, R, rgbs, visible, label, edge };
})()`;
const SCAN = `(() => { const L = ${LIB}; const { R, rgbs, visible, label, edge } = L; const out = [];
  const sel = 'input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]):not([type=range]):not([type=color]):not([type=submit]):not([type=button]),select,textarea';
  for (const el of document.querySelectorAll(sel)) { if (!visible(el)) continue; if (el.disabled && false) continue;
    let host = el, via = "self", edges = edge(el);
    if (!edges.some((e) => (e.kind.startsWith("border") || e.kind === "ring")) && (!edges.length || edges[0].ratio < 3)) { let n = el.parentElement; for (let i = 0; i < 3 && n && n !== document.body; i++, n = n.parentElement) { const e = edge(n); const r = n.getBoundingClientRect(), q = el.getBoundingClientRect(); if (e.length && (!edges.length || e[0].ratio > edges[0].ratio) && r.width >= q.width * 0.9 && r.height >= q.height * 0.9 && r.width < q.width * 3.5 + 120) { host = n; via = "wrapper " + L.label(n); edges = e; break; } } }
    const best = edges[0];
    const r = el.getBoundingClientRect();
    out.push({ field: label(el), host: via, type: el.tagName === "INPUT" ? el.type : el.tagName.toLowerCase(), box: Math.round(r.width) + "x" + Math.round(r.height), placeholder: (el.placeholder || "").slice(0, 24), boundary: best ? best.kind : "none", borderW: best ? best.w : 0, edgeRgb: best ? rgbs(best.color) : "-", outsideRgb: best ? rgbs(best.outside) : "-", insideRgb: best ? rgbs(best.inside) : "-", ratio: best ? R(best.ratio) : 0 }); }
  return out; })()`;

const plan = [
  { route: "/", wait: "article.product-card" },
  { route: "/stone", wait: ".search-field input" },
  { route: "/portfolio", wait: ".portfolio-search-bar input" },
  { route: "/price-guide", wait: "main" },
  { route: "/site-prep", wait: "main" },
  { route: "/studio-guide", wait: "main" },
  { route: "/quote#cart", wait: ".customer-grid input" },
  { route: "/studio", wait: ".studio-progress-step-icon", states: ["initial", "contact"] },
  { route: "/sketch", wait: "main", states: ["initial", "upload"] },
  { route: "/readme", wait: "main" },
  { route: "/updates", wait: "main" },
  { route: "/network", wait: "main" },
  { route: "/profile", wait: "main" },
  { route: "/handover", wait: "main" },
  { route: "/track", wait: "main" },
  { route: "/quote/view", wait: "main" },
];
// a generated grey png for the /sketch upload state
import zlib from "node:zlib";
function makePng(w = 240, h = 160) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (buf) => { let x = 0xffffffff; for (const b of buf) x = crcT[(x ^ b) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; const v = 200 + ((x + y) % 30); raw[o] = v; raw[o + 1] = v; raw[o + 2] = v; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const pngPath = join(mkdtempSync(join(tmpdir(), "inputs475-")), "t.png"); writeFileSync(pngPath, makePng());

const rows = [];
for (const step of plan) {
  const [path, st] = step.route.split("#");
  await open(path, st === "cart");
  for (let i = 0; i < 25 && !(await ev(`!!document.querySelector(${JSON.stringify(step.wait)})`)); i++) await sleep(1000);
  await sleep(700);
  for (const state of step.states ?? ["initial"]) {
    if (state === "upload") {
      const { root } = await cdp("DOM.getDocument", { depth: -1 });
      const found = await cdp("DOM.querySelectorAll", { nodeId: root.nodeId, selector: 'input[type="file"]' });
      if (found.nodeIds?.length) await cdp("DOM.setFileInputFiles", { nodeId: found.nodeIds[0], files: [pngPath] });
      await sleep(3500);
    }
    if (state === "contact") { // /studio: open every collapsed section / step so the contact fields are in the DOM
      await ev(`(() => { for (const d of document.querySelectorAll("details")) d.open = true; for (const b of document.querySelectorAll("button")) if (/ข้อมูลติดต่อ|ส่งแบบ|ขอใบเสนอ/.test(b.textContent) && b.getClientRects().length) { try { b.click(); } catch {} break; } })()`);
      await sleep(1500);
    }
    const found = await ev(SCAN);
    for (const f of found) rows.push({ route: step.route, state, ...f });
  }
}
wf(outArg, JSON.stringify({ theme, width, base, rows }, null, 1));
const bad = rows.filter((r) => r.ratio < 3);
console.log(`theme=${theme} width=${width} fields=${rows.length} below3=${bad.length}`);
socket.close(); proc.kill(); process.exit(0);
