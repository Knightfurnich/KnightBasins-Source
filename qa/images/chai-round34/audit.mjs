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

const [mode, base, theme, widthArg, outArg] = process.argv.slice(2);
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
async function open(route, cart) {
  await cdp("Page.navigate", { url: base + route });
  await sleep(2000);
  await ev(`localStorage.setItem("knight-storefront-theme","${theme}"); ${cart ? `localStorage.setItem("knight-cart", JSON.stringify([{ sku: "KF001", quantity: 2, installationSelected: true }, { sku: "KF009", quantity: 1, installationSelected: false }]));` : ""} location.reload();`);
  await sleep(3500);
}

const RATIO = `
const __cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
const rgba = (c) => { __cv.clearRect(0,0,1,1); __cv.fillStyle = "#000"; __cv.fillStyle = c; __cv.fillRect(0,0,1,1); const d = __cv.getImageData(0,0,1,1).data; return [d[0], d[1], d[2], d[3] / 255]; };
const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const l1 = lum(a[0], a[1], a[2]), l2 = lum(b[0], b[1], b[2]); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
const over = (fg, bg) => [fg[0] * fg[3] + bg[0] * (1 - fg[3]), fg[1] * fg[3] + bg[1] * (1 - fg[3]), fg[2] * fg[3] + bg[2] * (1 - fg[3]), 1];
const surface = (el) => { let n = el; const stack = []; const els = []; let blocked = false; while (n) { const s = getComputedStyle(n); const c = rgba(s.backgroundColor); if (c[3] > 0) { stack.push(c); els.push(n); } if (c[3] >= 0.99) break; if (s.backgroundImage !== "none") { blocked = true; break; } n = n.parentElement; } let out = [255,255,255,1]; for (const c of stack.reverse()) out = over(c, out); return { c: out, els, blocked }; };
const solidBg = (el) => surface(el).c;
const visible = (el) => { if (!el.getClientRects().length) return false; for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const s = getComputedStyle(n); if (s.visibility === "hidden" || s.display === "none" || parseFloat(s.opacity) < 0.3) return false; } return true; };
`;

if (mode === "qty") {
  await open("/quote", true);
  const rows = await ev(`(() => { ${RATIO}
    return [...document.querySelectorAll(".line-quantity")].map((q) => {
      const bg = solidBg(q); const qs = getComputedStyle(q);
      const span = q.querySelector("span"), btns = [...q.querySelectorAll("button")];
      const sc = rgba(getComputedStyle(span).color), sbg = solidBg(span);
      const r = q.getBoundingClientRect();
      return { box: { bgCss: qs.backgroundColor, bg: bg.slice(0,3).map(Math.round), border: qs.borderTopColor, size: [Math.round(r.width), Math.round(r.height)] },
        number: { text: span.textContent, fg: sc.slice(0,3), bg: sbg.slice(0,3).map(Math.round), ratio: +ratio(sc, sbg).toFixed(2), size: getComputedStyle(span).fontSize, minWidth: getComputedStyle(span).minWidth },
        icons: btns.map((b) => { const bc = rgba(getComputedStyle(b).color), bb = solidBg(b), svg = b.querySelector("svg"); const st = svg ? getComputedStyle(svg).stroke : ""; const sc2 = svg ? rgba(st) : bc; return { label: b.getAttribute("aria-label"), color: getComputedStyle(b).color, stroke: st, bg: bb.slice(0,3).map(Math.round), ratio: +ratio(sc2, bb).toFixed(2), btnSize: [Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height)] }; }),
        rect: { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }, row: (() => { const row = q.closest("[data-testid^=row-quote]") || q.closest(".quote-line"); const rr = row.getBoundingClientRect(); return { x: rr.x + scrollX, y: rr.y + scrollY, w: rr.width, h: rr.height }; })() };
    }); })()`);
  console.log(JSON.stringify({ theme, width, rows: rows.map((x) => ({ box: x.box, number: x.number, icons: x.icons })) }, null, 1));
  if (outArg) {
    const rr = rows[0].row; const pad = 12;
    const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: Math.max(0, rr.x - pad), y: Math.max(0, rr.y - pad), width: Math.min(width, rr.w + 2 * pad), height: rr.h + 2 * pad, scale: 2 } });
    writeFileSync(`${outArg}-${theme}-${width}.png`, Buffer.from(shot.data, "base64"));
  }
} else if (mode === "rules") {
  const routes = ["/", "/stone", "/quote#cart", "/studio", "/sketch", "/studio-guide", "/portfolio", "/price-guide", "/readme", "/updates", "/network", "/site-prep", "/profile", "/handover", "/track", "/quote/view"];
  const agg = new Map();
  for (const route of routes) {
    const [path, state] = route.split("#");
    await open(path, state === "cart");
    const res = await ev(`(() => { ${RATIO}
      const out = [];
      const solidLiteral = (st) => { const bg = st.getPropertyValue("background-color"); const sh = st.getPropertyValue("background"); const img = st.getPropertyValue("background-image"); const raw = (bg + " " + sh + " " + img); if (/var\\(/.test(raw)) return null; if (/gradient|url\\(/.test(img + sh)) return null; const v = bg || sh; if (!v || /^(transparent|inherit|initial|unset|none|currentcolor)$/i.test(v.trim())) return null; const c = rgba(v.split(" url")[0].replace(/\\s+(no-repeat|repeat|center|fixed|scroll).*$/i, "")); return c[3] >= 0.5 ? v : null; };
      const walk = (rules, media) => { for (const r of rules) { if (r.type === 1) { const v = solidLiteral(r.style); if (v) out.push({ selector: r.selectorText, value: v, media }); } else if (r.cssRules && r.type === 4) walk(r.cssRules, r.conditionText || r.media.mediaText); else if (r.cssRules && r.type === 12) { /* @supports */ walk(r.cssRules, media); } else if (r.cssRules && r.constructor.name === "CSSLayerBlockRule") walk(r.cssRules, media); } };
      for (const sh of document.styleSheets) { try { walk(sh.cssRules, ""); } catch {} }
      const seen = new Map();
      for (const r of out) {
        let els = []; try { els = [...document.querySelectorAll(r.selector)]; } catch { continue; }
        for (const el of els) {
          const cs = getComputedStyle(el); const bg = rgba(cs.backgroundColor); if (bg[3] < 0.5 || cs.backgroundImage !== "none") continue; // the rule must really be what paints this element
          const want = rgba(r.value.split(" url")[0]); if (Math.abs(want[0] - bg[0]) > 1 || Math.abs(want[1] - bg[1]) > 1 || Math.abs(want[2] - bg[2]) > 1) continue; // ... and it must win the cascade
          if (!visible(el)) continue;
          const texts = [];
          const consider = (node, fg, label, size) => { const sf = surface(node); if (sf.blocked || !sf.els.includes(el)) return; texts.push({ t: label, fg, bg: sf.c, ratio: ratio(over(fg, sf.c), sf.c), size }); };
          const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          while (w.nextNode()) { const tn = w.currentNode; if (!tn.textContent.trim()) continue; const p = tn.parentElement; if (!visible(p)) continue; const ps = getComputedStyle(p); consider(p, rgba(ps.color), tn.textContent.trim().slice(0, 30), ps.fontSize); }
          for (const svg of el.querySelectorAll("svg")) { if (!visible(svg)) continue; const st = getComputedStyle(svg).stroke; if (st && st !== "none") consider(svg, rgba(st), "[icon]", "icon"); }
          for (const inp of el.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]),textarea,select")) { if (!visible(inp)) continue; consider(inp, rgba(getComputedStyle(inp).color), "[input text]", "input"); const ph = getComputedStyle(inp, "::placeholder").color; if (inp.placeholder) consider(inp, rgba(ph), "[placeholder]", "input"); }
          const worst = texts.length ? texts.reduce((a, b) => (a.ratio < b.ratio ? a : b)) : null;
          const key = r.selector + "||" + r.value;
          const prev = seen.get(key) ?? { selector: r.selector, value: r.value, media: r.media, count: 0, measured: 0, worst: null };
          prev.count++; if (texts.length) prev.measured++; if (worst && (!prev.worst || worst.ratio < prev.worst.ratio)) prev.worst = { ratio: +worst.ratio.toFixed(2), text: worst.t, fg: worst.fg.slice(0, 3).join(","), bg: worst.bg.slice(0, 3).map(Math.round).join(","), el: el.tagName.toLowerCase() + (el.dataset.testid ? "[" + el.dataset.testid + "]" : "") };
          seen.set(key, prev);
        }
      }
      return { rules: out.length, hits: [...seen.values()], all: out.map((o) => o.selector + "||" + o.value) };
    })()`);
    for (const h of res.hits) {
      const k = h.selector + "||" + h.value; const prev = agg.get(k) ?? { selector: h.selector, value: h.value, media: h.media, routes: [], count: 0, worst: null };
      prev.count += h.count; prev.measured = (prev.measured ?? 0) + h.measured; if (!prev.routes.includes(route)) prev.routes.push(route);
      if (h.worst && (!prev.worst || h.worst.ratio < prev.worst.ratio)) prev.worst = { ...h.worst, route };
      agg.set(k, prev);
    }
    for (const a of res.all) { const k = a; if (!agg.has(k)) { const [selector, value] = a.split("||"); agg.set(k, { selector, value, routes: [], count: 0, worst: null }); } }
    console.error(`${route} rules=${res.rules} painted-hits=${res.hits.length}`);
  }
  const list = [...agg.values()].sort((a, b) => (a.worst?.ratio ?? 99) - (b.worst?.ratio ?? 99));
  if (outArg) writeFileSync(outArg, JSON.stringify({ theme, width, rules: list }, null, 1));
  console.log(`theme=${theme} width=${width} literal-solid rules=${list.length} painted on the swept routes=${list.filter((x) => x.count).length} with text below 4.5=${list.filter((x) => x.worst && x.worst.ratio < 4.5).length}`);
  for (const x of list.filter((x) => x.worst && x.worst.ratio < 4.5)) console.log(`  ${x.worst.ratio} | ${x.selector} | ${x.value} | ${x.worst.el} "${x.worst.text}" rgb(${x.worst.fg}) on rgb(${x.worst.bg}) | ${x.routes.join(" ")}`);
}
socket.close(); proc.kill(); process.exit(0);
