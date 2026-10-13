/*
 * gradient-scan-465c.mjs - contrast scanner that SEES gradients and photos (closes the blind spot of
 * qa/tools/contrast-probe.js, which returns "unmeasurable" for any text whose ancestor chain has a background-image).
 *
 * Method (job 466-C, option "a"): for every text-bearing element it records the computed text colour, then makes ALL text
 * transparent, takes a real full-page screenshot (so gradients, photos, opacity, overlays are all rendered exactly as the
 * customer sees them), and samples the pixels BEHIND each element's text box. The ratio is the WCAG ratio of the text
 * colour over each sampled pixel; the reported value is the 10th-percentile (the worst realistic pixel, ignoring a few
 * anti-aliased outliers). Rows below 4.5 (3.0 for large text) are listed, plus a list of every gradient / photo surface that
 * carries text with its status.
 *
 *   node qa/tools/gradient-scan-465c.mjs <baseUrl> <theme: light|dark> <route[#state]> [route[#state] ...]
 *     [--json out.json] [--all]        --all prints every row of the named routes, not only failures
 *   states: /quote#cart (two basin lines in the cart: totals / VAT row / grand total are shown) - and, only for /sketch: #initial (default) #upload (a generated test PNG is attached; needs the mock API fixture
 *   qa/tools/mock-api-466c.mjs for POST /api/sketch/analyze) #cutout (clicks the first "add basin cut-out") #form
 *
 * Read-only against the app; the test image is a generated grey PNG, no customer data.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import zlib from "node:zlib";

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const jsonOut = flag("--json");
const shotPrefix = flag("--shot"); // e.g. qa/images/chai-round28/after  -> <prefix>-<route>-<state>-<theme>-<width>.png (taken with the text visible)
const showAll = args.includes("--all"); if (showAll) args.splice(args.indexOf("--all"), 1);
const undo468 = args.includes("--undo468"); if (undo468) args.splice(args.indexOf("--undo468"), 1);
const [base, theme, ...targets] = args;
const chrome = process.env.CHROME_BIN ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/usr/bin/google-chrome");
const viewport = Number(process.env.SCAN_WIDTH ?? 1440);
if (!existsSync(chrome)) { console.error(`Chrome unavailable at ${chrome} — contrast was NOT checked`); process.exit(2); }

// ---- tiny grey PNG for the upload state (no dependency) ----
function makePng(w = 240, h = 160) {
  const crc = (buf) => { let c, crcT = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; } let x = 0xffffffff; for (const b of buf) x = crcT[(x ^ b) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; const v = 200 + ((x + y) % 30); raw[o] = v; raw[o + 1] = v; raw[o + 2] = v; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const pngPath = join(mkdtempSync(join(tmpdir(), "scan466-")), "test-sketch.png");
writeFileSync(pngPath, makePng());

const port = 9000 + Math.floor(Math.random() * 300);
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-features=OverlayScrollbar", `--user-data-dir=${mkdtempSync(join(tmpdir(), "chai-466c-"))}`, "about:blank"], { stdio: "ignore" });
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
await cdp("Page.enable"); await cdp("DOM.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: viewport, height: 900, deviceScaleFactor: 1, mobile: false });
await cdp("Emulation.setEmulatedMedia", { features: [{name:"prefers-reduced-motion",value:"reduce"}] });

// ---- page-side: collect text elements (before text is hidden) ----
const COLLECT = `(() => {
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const rgba = (c) => { ctx.clearRect(0,0,1,1); ctx.fillStyle = "#000"; ctx.fillStyle = c; ctx.fillRect(0,0,1,1); const d = ctx.getImageData(0,0,1,1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const label = (el) => { const p = []; let n = el; while (n && n.tagName !== "HTML" && p.length < 3) { let s = n.tagName.toLowerCase(); if (n.dataset && n.dataset.testid) s += '[' + n.dataset.testid + ']'; else if (typeof n.className === "string" && n.className.trim()) s += "." + n.className.trim().split(/\\s+/)[0]; p.unshift(s); n = n.parentElement; } return p.join(" > "); };
  const surface = (el) => { // nearest ancestor (or self) that paints a background-image or an opaque colour
    let n = el, img = null;
    while (n) { const s = getComputedStyle(n); if (s.backgroundImage && s.backgroundImage !== "none" && !img) img = n; const c = rgba(s.backgroundColor); if (c[3] > 0.5 && !img) return { node: n, kind: "solid" }; if (img) return { node: img, kind: /url\\(/.test(getComputedStyle(img).backgroundImage) ? "image" : "gradient" }; n = n.parentElement; }
    return { node: document.body, kind: "solid" };
  };
  const out = []; const els = []; let moving = 0;
  document.querySelectorAll("body *").forEach((el) => {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
    if (own.length < 3) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || parseFloat(s.opacity) < 0.3) return;
    let hidden = false; for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.3) { hidden = true; break; } }
    if (hidden) return;
    const size = parseFloat(s.fontSize), bold = parseInt(s.fontWeight, 10) >= 700, large = size >= 24 || (size >= 18.66 && bold);
    const surf = surface(el);
    // sample only the boxes the element's OWN text occupies (a <label> also contains its <input>; a <button> its icon)
    const rects = [];
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim().length) { const rg = document.createRange(); rg.selectNodeContents(n); for (const q of rg.getClientRects()) if (q.width > 1 && q.height > 1) rects.push({ x: q.left + scrollX, y: q.top + scrollY, w: q.width, h: q.height }); }
    if (!rects.length) return;
    // job 467-C: text scrolled out of an overflow:hidden/auto ancestor (the marquee track, a carousel) is not on screen - skip it
    const q0 = rects[0], cxm = q0.x - scrollX + q0.w / 2, cym = q0.y - scrollY + q0.h / 2; let clipped = false;
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.overflowX === "visible" && cs.overflowY === "visible") continue; const nb = n.getBoundingClientRect(); if ((cs.overflowX !== "visible" && (cxm < nb.left || cxm > nb.right)) || (cs.overflowY !== "visible" && (cym < nb.top || cym > nb.bottom))) { clipped = true; break; } }
    if (clipped) return;
    // a horizontally auto-scrolling track (the installation marquee moves between this pass and the screenshot): its rows are
    // reported as "moving" and checked by arithmetic in the report instead of by pixels
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && n.scrollWidth > n.clientWidth + 2) { moving++; return; } }
    els.push(el);
    el.style.setProperty("--contrast-original-shadow", s.textShadow);
    out.push({ selector: label(el), productLabel: el.matches(".product-index,.art-note"), hero: !!el.closest('.catalog-hero,.stone-hero,.quote-heading'), text: own.slice(0, 48), fg: rgba(s.color), shadow:s.textShadow, size, large, rects,
      kind: surf.kind, surf: label(surf.node), surfImage: surf.kind === "solid" ? "" : getComputedStyle(surf.node).backgroundImage.slice(0, 90) });
  });
  // drop text that is covered by something else at its first box (pop-overs, sticky bars): the customer cannot see it there
  const keep = out.map((row, i) => { const q = row.rects[0]; window.scrollTo(0, Math.max(0, q.y - 300)); const top = document.elementFromPoint(q.x + q.w / 2 - scrollX, q.y + q.h / 2 - scrollY); return row.productLabel || !top || els[i] === top || els[i].contains(top) || top.contains(els[i]); });
  window.scrollTo(0, 0);
  const visible = out.filter((_, i) => keep[i]);
  // job 467-C: a sticky box (the quote / config summary asides) is drawn at a shifted place by a beyond-viewport capture, so the pixels
  // behind its text were read from the page behind it. At scrollY=0 a sticky box sits at its natural spot: pin it there as relative.
  document.querySelectorAll("body *").forEach((n) => { if (getComputedStyle(n).position === "sticky") { n.style.setProperty("position", "relative", "important"); n.style.setProperty("top", "auto", "important"); } });
  const style = document.createElement("style"); style.id = "scan-hide-text";
  style.textContent = "*{transition:none!important;color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:var(--contrast-original-shadow,none)!important;caret-color:transparent!important} svg,svg *{visibility:hidden!important} ::placeholder{color:transparent!important}";
  document.head.appendChild(style);
  return { ov: { innerWidth: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }, rows: visible, covered: out.length - visible.length, moving, height: Math.min(document.documentElement.scrollHeight, 60000), width: document.documentElement.clientWidth, theme: (document.querySelector(".storefront-theme-root") || {}).dataset?.theme ?? null };
})()`;

// ---- page-side: sample pixels behind each element ----
// job 467-C: a single Page.captureScreenshot taller than ~16k px comes back blank (black) below that, which made rows low on
// the home page read "bg rgb(0,0,0)". The page is therefore captured in 4000px tiles and stitched on one canvas before sampling.
const SAMPLE = (tiles, visTiles, rows, totalHeight) => `(async () => {
  const rows = ${JSON.stringify(rows)};
  const tiles = ${JSON.stringify(tiles)};
  const visTiles = ${JSON.stringify(visTiles)};
  const first = new Image(); first.src = "data:image/png;base64," + tiles[0].b64; await first.decode();
  const cv = document.createElement("canvas"); cv.width = first.width; cv.height = ${totalHeight};
  const cx = cv.getContext("2d", { willReadFrequently: true });
  for (const tl of tiles) { const im = new Image(); im.src = "data:image/png;base64," + tl.b64; await im.decode(); cx.drawImage(im, 0, tl.y); }
  const img = { width: cv.width, height: cv.height };
  // the same page with the text SHOWN: a text whose pixels are identical with and without its colour is not painted at all
  // (covered by a photo / an overlay with pointer-events:none) - the customer cannot see it, so it is not a contrast failure
  const cv2 = document.createElement("canvas"); cv2.width = first.width; cv2.height = ${totalHeight};
  const cx2 = cv2.getContext("2d", { willReadFrequently: true });
  for (const tl of visTiles) { const im = new Image(); im.src = "data:image/png;base64," + tl.b64; await im.decode(); cx2.drawImage(im, 0, tl.y); }
  const painted = (row) => {
    let diff = 0;
    for (const rc of row.rects) {
      const x0 = Math.max(0, Math.floor(rc.x)), y0 = Math.max(0, Math.floor(rc.y));
      const w = Math.max(1, Math.min(img.width - x0, Math.ceil(rc.w))), h = Math.max(1, Math.min(img.height - y0, Math.ceil(rc.h)));
      if (y0 >= img.height) continue;
      const a = cx.getImageData(x0, y0, w, h).data, b = cx2.getImageData(x0, y0, w, h).data;
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 6 || Math.abs(a[i + 1] - b[i + 1]) > 6 || Math.abs(a[i + 2] - b[i + 2]) > 6) diff++;
    }
    return diff >= 25;
  };
  const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  return rows.map((row) => {
    if (!painted(row)) return { ...row, ratio: null, unpainted: true };
    const ratios = []; let sr = 0, sg = 0, sb = 0, n = 0;
    for (const rc of row.rects) {
      const inset = rc.w > 14 && rc.h > 14 ? 1 : 0;
      const x0 = Math.max(0, Math.floor(rc.x) + inset), y0 = Math.max(0, Math.floor(rc.y) + inset);
      if (y0 >= img.height) continue;
      const w = Math.max(1, Math.min(img.width - x0, Math.floor(rc.w) - 2 * inset)), h = Math.max(1, Math.min(img.height - y0, Math.floor(rc.h) - 2 * inset));
      const data = cx.getImageData(x0, y0, w, h).data;
      const visible = row.hero || row.productLabel ? cx2.getImageData(x0,y0,w,h).data : null;
      const step = visible ? 1 : Math.max(1, Math.floor(Math.sqrt((w * h) / 150)));
      for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
        const o = (y * w + x) * 4; const r = data[o], g = data[o + 1], b = data[o + 2];
        if (visible && (Math.max(Math.abs(visible[o]-r),Math.abs(visible[o+1]-g),Math.abs(visible[o+2]-b)) <= 6 ||
          Math.max(Math.abs(visible[o]-row.fg[0]),Math.abs(visible[o+1]-row.fg[1]),Math.abs(visible[o+2]-row.fg[2])) > 24)) continue;
        sr += r; sg += g; sb += b; n++;
        const a = row.fg[3]; const fr = row.fg[0] * a + r * (1 - a), fg = row.fg[1] * a + g * (1 - a), fb = row.fg[2] * a + b * (1 - a);
        const l1 = lum(fr, fg, fb), l2 = lum(r, g, b);
        ratios.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
      }
    }
    if (!ratios.length) return { ...row, ratio: null };
    ratios.sort((p, q) => p - q);
    return { ...row, ratio: Math.round(ratios[Math.floor(ratios.length * 0.1)] * 100) / 100, ratioMin: Math.round(ratios[0] * 100) / 100, bg: [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)] };
  });
})()`;

async function applyState(state) {
  if (!state || state === "initial") return;
  if (state === "faq") { await ev(`document.querySelectorAll("details").forEach((d) => { d.open = true; })`); await sleep(500); return; } // /studio-guide with every FAQ open
  if (state === "cart") { // /quote with two basin lines in the cart (the summary aside shows totals, VAT row, grand total)
    await ev(`localStorage.setItem("knight-cart", JSON.stringify([{ sku: "KF001", quantity: 2, installationSelected: true }, { sku: "KF009", quantity: 1, installationSelected: false }])); location.reload();`);
    await sleep(4000);
    return;
  }
  if (state === "upload" || state === "cutout" || state === "form") {
    const { root } = await cdp("DOM.getDocument", { depth: -1 });
    const found = await cdp("DOM.querySelectorAll", { nodeId: root.nodeId, selector: 'input[type="file"]' });
    if (found.nodeIds?.length) await cdp("DOM.setFileInputFiles", { nodeId: found.nodeIds[0], files: [pngPath] });
    await sleep(3500);
  }
  if (state === "cutout") {
    await ev(`(() => { const b = [...document.querySelectorAll("button")].find((x) => /เพิ่มช่องเจาะอ่าง/.test(x.textContent)); if (b) b.click(); })()`);
    await sleep(1500);
  }
  if (state === "form") {
    await ev(`(() => { const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value"); d.set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); }; document.querySelectorAll(".studio-contact-grid input[type=text],.studio-contact-grid input[type=tel],.studio-contact-grid input[type=email]").forEach((el, i) => { if (/ที่อยู่/.test(el.placeholder || "")) return; set(el, ["ทดสอบ ระบบ", "0812345678", "test@example.com"][i % 3]); }); // the address field is left empty: it opens a transient auto-complete pop-over })()`);
    await sleep(800);
    await ev(`document.activeElement && document.activeElement.blur(); document.body.click();`); // close the address auto-complete pop-over (transient)
    await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape" });
    await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: 3, y: 3, button: "left", clickCount: 1 });
    await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: 3, y: 3, button: "left", clickCount: 1 });
    await sleep(1200);
  }
}

const all = [];
for (const target of targets) {
  const [route, state] = target.split("#");
  await cdp("Page.navigate", { url: base + route });
  await sleep(2500);
  await ev(`localStorage.setItem("knight-storefront-theme","${theme}"); location.reload();`);
  await sleep(3500);
  await applyState(state);
  // Settle lazy images and reveal observers before BOTH captures, not only the hidden capture.
  await ev(`(async () => {
    await document.fonts.ready;
    const style=document.createElement("style"); style.textContent="*{animation:none!important;transition:none!important;scroll-behavior:auto!important}"; document.head.appendChild(style);
    document.querySelectorAll("img").forEach((im)=>{im.loading="eager";});
    for(let y=0;y<document.documentElement.scrollHeight;y+=700){scrollTo(0,y);await new Promise(r=>requestAnimationFrame(r));}
    scrollTo(0,0);
    await Promise.race([Promise.all([...document.images].map(im=>im.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,2500))]);
    document.querySelectorAll("body *").forEach(n=>{if(getComputedStyle(n).position==="sticky"){n.style.setProperty("position","relative","important");n.style.setProperty("top","auto","important");}});
  })()`);
  await sleep(300);
  if (undo468) {
    const removed = await ev(`(() => {
      let count=0;
      for(const sheet of document.styleSheets){
        let rules;try{rules=sheet.cssRules;}catch{continue;}
        for(let i=rules.length-1;i>=0;i--){
          const r=rules[i];if(!r.selectorText||!r.style)continue;const sel=r.selectorText,color=r.style.color;
          if(sel.includes('[data-theme="light"]')&&(sel.includes('.product-index')&&color==='rgb(52, 73, 91)'||(sel.includes('.quote-main .eyebrow')||sel.includes('.footer-meta'))&&color==='rgb(75, 98, 118)')||
            sel.includes('[data-theme="dark"]')&&sel.includes('.catalog-hero, .stone-hero, .quote-heading')&&r.style.textShadow.includes('rgb(7, 17, 31)')){sheet.deleteRule(i);count++;}
        }
      }
      return count;
    })()`);
    if(!removed){proc.kill();throw new Error("Reversal removed no rules — baseline was NOT checked");}
  }
  if (shotPrefix) {
    const h = await ev("Math.min(document.documentElement.scrollHeight, 900)");
    const vis = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: viewport, height: h, scale: 1 } });
    writeFileSync(`${shotPrefix}-${route.replace(/\//g, "") || "home"}-${state ?? "initial"}-${theme}-${viewport}.png`, Buffer.from(vis.data, "base64"));
    if (route === "/") for (const sku of ["KF003", "KF006"]) {
      const box = await ev(`(() => {const el=document.querySelector('[data-testid="card-product-${sku}"]');if(!el)return null;const r=el.getBoundingClientRect();return{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()`);
      if(box){const card=await cdp("Page.captureScreenshot",{format:"png",captureBeyondViewport:true,clip:box});writeFileSync(`${shotPrefix}-${sku}-${theme}-${viewport}.png`,Buffer.from(card.data,"base64"));}
    }
  }
  const visTiles = [];
  const hVis = await ev("Math.min(document.documentElement.scrollHeight, 60000)");
  for (let y = 0; y < hVis; y += 4000) {
    const part = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y, width: viewport, height: Math.min(4000, hVis - y), scale: 1 } });
    visTiles.push({ y, b64: part.data });
  }
  const collected = await ev(COLLECT);
  if(!collected?.rows?.length||collected.theme!==theme||collected.ov.innerWidth!==viewport){proc.kill();throw new Error(`${target}: missing text, wrong theme or viewport — contrast was NOT checked`);}
  await sleep(300);
  const tiles = [];
  for (let y = 0; y < collected.height; y += 4000) {
    const part = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y, width: collected.width, height: Math.min(4000, collected.height - y), scale: 1 } });
    tiles.push({ y, b64: part.data });
  }
  if (process.env.SCAN_SAVE_HIDDEN) writeFileSync(process.env.SCAN_SAVE_HIDDEN, Buffer.from(tiles[0].b64, "base64")); // debug: the first tile of the background-only render the pixels are sampled from
  const sampled = await ev(SAMPLE(tiles, visTiles, collected.rows, collected.height));
  const unpainted = sampled.filter((r) => r.unpainted);
  const rows = sampled.filter((r) => r.ratio != null).map((r) => ({ ...r, threshold: r.large ? 3 : 4.5 }));
  const failing = rows.filter((r) => r.ratio < r.threshold).sort((a, b) => a.ratio - b.ratio);
  console.log(`\n=== ${target}  theme=${collected.theme}  checked=${rows.length}  failing(p10 ratio < threshold)=${failing.length}`);
  console.log(`  overflow: innerWidth=${collected.ov.innerWidth} clientWidth=${collected.ov.clientWidth} scrollWidth=${collected.ov.scrollWidth} -> ${collected.ov.scrollWidth - collected.ov.clientWidth}px`);
  if (unpainted.length) console.log(`  excluded: ${unpainted.length} text(s) not painted (identical pixels with the text shown and hidden: covered by a photo/overlay) e.g. ${[...new Set(unpainted.map((r) => r.selector.split(" > ").pop()))].slice(0, 4).join(", ")}`);
  if (collected.moving) console.log(`  excluded: ${collected.moving} text(s) inside a horizontally auto-scrolling track (position changes between measure and screenshot) - verify by arithmetic`);
  for (const r of (showAll ? rows.sort((a, b) => a.ratio - b.ratio) : failing)) {
    console.log(`  ${String(r.ratio).padEnd(6)}| need ${r.threshold} | ${r.kind.padEnd(8)}| text rgb(${r.fg.slice(0, 3).join(",")}) on bg~rgb(${r.bg.join(",")}) | ${r.size}px | ${r.selector} | "${r.text}"`);
  }
  // surfaces (gradient / photo) that carry text
  const surfaces = new Map();
  for (const r of rows) if (r.kind !== "solid") {
    const k = r.surf; const s = surfaces.get(k) ?? { surface: k, kind: r.kind, image: r.surfImage, texts: 0, worst: 99 };
    s.texts++; s.worst = Math.min(s.worst, r.ratio); surfaces.set(k, s);
  }
  if (surfaces.size) {
    console.log(`  -- gradient / photo surfaces carrying text (${surfaces.size}):`);
    for (const s of surfaces.values()) console.log(`     ${s.kind.padEnd(8)}| worst ratio ${String(s.worst).padEnd(6)}| ${s.texts} text(s) | ${s.surface} | ${s.image}`);
  }
  const coverage={heroes:rows.filter(r=>r.hero).length,productLabels:rows.filter(r=>r.productLabel).length};
  const requiredMissing=sampled.filter(r=>(r.hero||r.productLabel)&&r.ratio==null&&!r.unpainted);
  if((["/","/stone","/quote"].includes(route)&&!coverage.heroes)||(route==="/"&&!coverage.productLabels)||requiredMissing.length){proc.kill();throw new Error(`${target}: required hero/product-label pixels were NOT checked: ${JSON.stringify({coverage,missing:requiredMissing.map(r=>r.selector)})}`);}
  all.push({ target, theme: collected.theme, overflow: collected.ov, checked: rows.length, failing: failing.length, coverage, exclusions:{covered:collected.covered,moving:collected.moving,unpainted}, rows: showAll ? rows : failing, surfaces: [...surfaces.values()] });
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(all, null, 1));
socket.close(); proc.kill(); process.exit(0);
