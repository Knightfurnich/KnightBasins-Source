/*
 * gradient-scan-465c.mjs - contrast scanner that SEES gradients and photos (closes the blind spot of
 * qa/tools/contrast-probe.js, which returns "unmeasurable" for any text whose ancestor chain has a background-image).
 *
 * Method (job 466-C, option "a"): for every text-bearing element it records the computed text colour, then makes ALL text
 * transparent, takes a real full-page screenshot (so gradients, photos, opacity, overlays are all rendered exactly as the
 * customer sees them), and samples the pixels BEHIND each element's text box. The ratio is the WCAG ratio of the text
 * colour over each sampled pixel; the reported value is the 10th-percentile (the worst realistic pixel, ignoring a few
 * anti-aliased outliers). Text uses 4.5 (3.0 for large text); meaningful UI uses
 * 3.0 under WCAG 1.4.11. Decorative exclusions have an explicit reason.
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
import { classifyContrastRow } from "./contrast-row-policy.mjs";

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const jsonOut = flag("--json");
const shotPrefix = flag("--shot"); // e.g. qa/images/chai-round28/after  -> <prefix>-<route>-<state>-<theme>-<width>.png (taken with the text visible)
const readyTimeout = Number(flag("--ready-timeout") ?? process.env.SCAN_READY_TIMEOUT_MS ?? 30000);
if (!Number.isFinite(readyTimeout) || readyTimeout < 500 || readyTimeout > 120000) throw new Error("Invalid readiness timeout");
const showAll = args.includes("--all"); if (showAll) args.splice(args.indexOf("--all"), 1);
const undo468 = args.includes("--undo468"); if (undo468) args.splice(args.indexOf("--undo468"), 1);
const [base, theme, ...targets] = args;
const chrome = process.env.CHROME_BIN ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/usr/bin/google-chrome");
const viewport = Number(process.env.SCAN_WIDTH ?? 1440);
const CART = [{ sku: "KF001", quantity: 2, installationSelected: true }, { sku: "KF009", quantity: 1, installationSelected: false }];
// Width-specific positive coverage, not a contrast allowlist. Every measurable row still counts.
// Other product labels are behind photos, or have no recoverable glyph interior at this width;
// they remain individually recorded as NOT MEASURABLE (with reason), never silently passed.
const REQUIRED_LABELS_BY_WIDTH = {
  1440: ["KF029", "KF030"],
  390: ["KF019", "KF020", "KF021", "KF023", "KF025", "KF026", "KF028", "KF029", "KF030"],
};
if (!REQUIRED_LABELS_BY_WIDTH[viewport]) throw new Error(`No coverage contract for width ${viewport} — contrast was NOT checked`);
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
// Installed before React: do not confuse offline fallback cards, a failed query,
// or a partially consumed JSON response with a completed catalogue.
await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
  try { localStorage.setItem("knight-storefront-theme", ${JSON.stringify(theme)}); } catch {}
  const state = window.__contrastLoad = { pending: 0, responses: {}, data: {}, mutations: 0 };
  const original = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const url = new URL(args[0] instanceof Request ? args[0].url : args[0], location.href);
    if (!url.pathname.startsWith("/api/")) return original(...args);
    state.pending++;
    try {
      const response = await original(...args);
      response.clone().text().then(text => {
        if (["/api/catalog", "/api/portfolio"].includes(url.pathname)) state.data[url.pathname] = JSON.parse(text);
        state.responses[url.pathname] = response.status;
      }).catch(() => { state.responses[url.pathname] = 0; }).finally(() => { state.pending--; });
      return response;
    } catch (error) {
      state.responses[url.pathname] = 0; state.pending--; throw error;
    }
  };
  addEventListener("DOMContentLoaded", () => {
    new MutationObserver(() => { state.mutations++; }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }, { once: true });
})();` });
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
  const visibleLabel = el => {
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),parts=[];
    while(walker.nextNode()){
      const node=walker.currentNode,parent=node.parentElement;
      if(!node.textContent.trim()||parent.closest("svg,script,style,[aria-hidden=true]"))continue;
      const range=document.createRange();range.selectNodeContents(node);
      const rect=range.getBoundingClientRect(),cs=getComputedStyle(parent);
      if(rect.width>1&&rect.height>1&&cs.visibility!=="hidden"&&cs.display!=="none"&&parseFloat(cs.opacity)>.0)parts.push(node.textContent.trim());
    }
    return parts.join(" ").trim();
  };
  const out = []; const els = []; const excluded = []; let moving = 0;
  document.querySelectorAll("body *").forEach((el) => {
    let own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
    // aria-hidden on an icon-only button is NOT enough to call it decorative.
    // Only exclude a companion SVG when it duplicates a visible text label.
    if(el.matches("svg[aria-hidden=true]")){
      const host=el.closest("button,[role=button],a,label");
      const text=host ? visibleLabel(host) : "";
      if(text && host.getBoundingClientRect().width>0 && getComputedStyle(host).visibility!=="hidden")
        excluded.push({selector:label(el),category:"decorative",threshold:null,reason:"aria-hidden companion SVG duplicates visible label: "+text.slice(0,48)});
    }
    // F: the old own.length < 3 silently lost quantities and every 1–2 character label.
    // Input values are DOM properties, and SVG-only buttons have NO text nodes.
    const field = el.matches('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=password]):not([type=range]):not([type=color]),textarea');
    const input = field && !!el.value;
    const placeholder = field && !el.value && !!el.placeholder;
    const icon = el.matches("button,[role=button],a") && !visibleLabel(el) && el.querySelector("svg");
    const iconText = !!el.closest("button,[role=button]") && /^[×✕✖+−–↶↷⧉↺↻←→‹›]$/.test(own) && visibleLabel(el.closest("button,[role=button]"))===own;
    const checkbox = el.matches('label > input[type=checkbox] + span,[role=checkbox],label > input[type=radio] + span,[role=radio]');
    const radio = checkbox && (el.matches("[role=radio]") || el.previousElementSibling?.type==="radio");
    const control = input ? "input-value" : placeholder ? "placeholder" : icon ? "icon-currentColor" : iconText ? "icon-text" : checkbox ? radio ? "custom-radio" : "custom-checkbox" : null;
    if (input) own = el.value;
    if (placeholder) own = el.placeholder;
    if (icon) own = el.getAttribute("aria-label") || el.getAttribute("title") || "[icon]";
    if (checkbox) own = "[checkbox " + (el.previousElementSibling?.checked || el.getAttribute("aria-checked")==="true" ? "checked" : "unchecked") + "]";
    if (!own) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || parseFloat(s.opacity) < 0.3) return;
    let hidden = false; for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.3) { hidden = true; break; } }
    if (hidden) return;
    const textStyle = placeholder ? getComputedStyle(el,"::placeholder") : s;
    const size = parseFloat(textStyle.fontSize), bold = parseInt(textStyle.fontWeight, 10) >= 700, large = size >= 24 || (size >= 18.66 && bold);
    const surf = surface(el);
    // sample only the boxes the element's OWN text occupies (a <label> also contains its <input>; a <button> its icon)
    const rects = [];
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim().length) { const rg = document.createRange(); rg.selectNodeContents(n); for (const q of rg.getClientRects()) if (q.width > 1 && q.height > 1) rects.push({ x: q.left + scrollX, y: q.top + scrollY, w: q.width, h: q.height }); }
    let foreground = s.color;
    if (input || placeholder) {
      ctx.font = textStyle.font || s.font;
      const width = Math.min(ctx.measureText(own).width, r.width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight));
      const x = s.textAlign === "center" ? r.left + (r.width-width)/2 : s.textAlign === "right" || s.textAlign === "end" ? r.right-parseFloat(s.paddingRight)-width : r.left+parseFloat(s.paddingLeft)+parseFloat(s.borderLeftWidth);
      // A textarea paints at its padded top, not the vertically centred input
      // baseline. Its whole content box covers native wrapping/newlines; paired
      // glyph differences still discard every empty background pixel.
      if(el.tagName==="TEXTAREA"){
        const left=parseFloat(s.paddingLeft)+parseFloat(s.borderLeftWidth),top=parseFloat(s.paddingTop)+parseFloat(s.borderTopWidth);
        rects.push({x:r.left+scrollX+left,y:r.top+scrollY+top,w:Math.max(1,r.width-left-parseFloat(s.paddingRight)-parseFloat(s.borderRightWidth)),h:Math.max(1,r.height-top-parseFloat(s.paddingBottom)-parseFloat(s.borderBottomWidth))});
      }else rects.push({x:x+scrollX,y:r.top+scrollY+Math.max(0,(r.height-size*1.3)/2),w:Math.max(1,width),h:Math.min(r.height,size*1.3)});
      foreground = textStyle.webkitTextFillColor && textStyle.webkitTextFillColor!=="currentcolor" ? textStyle.webkitTextFillColor : textStyle.color;
    }
    if (icon) {
      const b=icon.getBoundingClientRect(), ink=icon.querySelector("path,line,polyline,circle,rect")||icon, cs=getComputedStyle(ink);
      foreground=cs.stroke!=="none" ? cs.stroke : cs.fill!=="none" ? cs.fill : s.color;
      rects.push({x:b.left+scrollX,y:b.top+scrollY,w:b.width,h:b.height});
    }
    if (checkbox) {
      const checked=el.previousElementSibling?.checked||el.getAttribute("aria-checked")==="true";
      const mark=getComputedStyle(el,"::after");
      foreground=checked && mark.content!=="none" ? mark.borderBottomColor : s.borderTopColor;
      const inset=checked && mark.content!=="none" ? 4 : 0;
      // A semantic checkbox can be a selectable card. Its outline is the ink,
      // not every image/text pixel inside the card.
      const outline=el.matches("[role=checkbox]") && mark.content==="none";
      rects.push({x:r.left+scrollX+inset,y:r.top+scrollY+inset,w:Math.max(1,r.width-2*inset),h:outline?Math.max(2,Math.ceil(parseFloat(s.borderTopWidth))+1):Math.max(1,r.height-2*inset)});
      el.setAttribute("data-contrast-checkbox","");
    }
    const ink=rgba(foreground);
    if(placeholder)ink[3]*=parseFloat(textStyle.opacity);
    if(control)for(let n=el;n;n=n.parentElement)ink[3]*=parseFloat(getComputedStyle(n).opacity);
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
     let fixed = false;
     for (let n = el; n; n = n.parentElement) if (getComputedStyle(n).position === "fixed") { fixed = true; break; }
     out.push({ selector: label(el), control, disabled:!!el.disabled, shortText: !control && own.length <= 2, stepper: !!el.closest(".line-quantity"), fixed, productLabel: el.matches(".product-index,.art-note"), hero: !!el.closest('.catalog-hero,.stone-hero,.quote-heading'), text: own.slice(0, 48), fg: ink, shadow:s.textShadow, size, large, rects,
      kind: surf.kind, surf: label(surf.node), surfImage: surf.kind === "solid" ? "" : getComputedStyle(surf.node).backgroundImage.slice(0, 90) });
  });
  // Borders are a separate UI row, never a reason to lower the input's text or
  // placeholder threshold. Retain repeated node identity for paired hit tests.
  document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=color]),textarea,select').forEach(el=>{
    const s=getComputedStyle(el),r=el.getBoundingClientRect(),width=parseFloat(s.borderTopWidth),ink=rgba(s.borderTopColor);
    if(r.width<2||r.height<2||s.visibility==="hidden"||s.display==="none")return;
    for(let n=el;n;n=n.parentElement){const cs=getComputedStyle(n);if(cs.display==="none"||cs.visibility==="hidden"||parseFloat(cs.opacity)<.3)return;ink[3]*=parseFloat(cs.opacity);}
    if(!width||s.borderTopStyle==="none"||s.borderTopStyle==="hidden"||ink[3]===0)return;
    for(let n=el.parentElement;n&&n!==document.body;n=n.parentElement){
      const cs=getComputedStyle(n),box=n.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+width/2;
      if((cs.overflowX!=="visible"&&(x<box.left||x>box.right))||(cs.overflowY!=="visible"&&(y<box.top||y>box.bottom)))return;
      if((cs.overflowX==="auto"||cs.overflowX==="scroll")&&n.scrollWidth>n.clientWidth+2){moving++;return;}
    }
    el.setAttribute("data-contrast-input-border","");
    let fixed=false;for(let n=el;n;n=n.parentElement)if(getComputedStyle(n).position==="fixed")fixed=true;
    const surf=surface(el);els.push(el);
    out.push({selector:label(el),control:"input-border",disabled:!!el.disabled,shortText:false,stepper:false,
      fixed,productLabel:false,hero:false,text:"[input border]",fg:ink,size:0,large:false,
      rects:[{x:r.left+scrollX+Math.min(r.width/4,8),y:r.top+scrollY,w:Math.max(1,r.width-Math.min(r.width/2,16)),h:Math.max(2,Math.ceil(width)+1)}],
      kind:surf.kind,surf:label(surf.node),surfImage:surf.kind==="solid"?"":getComputedStyle(surf.node).backgroundImage.slice(0,90)});
  });
   // Retain node identity for hit tests at the ACTUAL capture scroll position.
   // A probe at an unrelated scroll position misses floating overlays.
   window.__contrastTextEls = els;
  window.scrollTo(0, 0);
  // job 467-C: a sticky box (the quote / config summary asides) is drawn at a shifted place by a beyond-viewport capture, so the pixels
  // behind its text were read from the page behind it. At scrollY=0 a sticky box sits at its natural spot: pin it there as relative.
  document.querySelectorAll("body *").forEach((n) => { if (getComputedStyle(n).position === "sticky") { n.style.setProperty("position", "relative", "important"); n.style.setProperty("top", "auto", "important"); } });
  const style = document.createElement("style"); style.id = "scan-hide-text";
   style.textContent = "*{transition:none!important;color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:var(--contrast-original-shadow,none)!important;caret-color:transparent!important} svg,svg *{visibility:hidden!important} ::placeholder{color:transparent!important} [data-contrast-checkbox],[data-contrast-checkbox]::before,[data-contrast-checkbox]::after,[data-contrast-input-border]{border-color:transparent!important;color:transparent!important;box-shadow:none!important}";
  document.head.appendChild(style);
    return { ov: { innerWidth: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }, rows: out, excluded, moving, height: Math.min(document.documentElement.scrollHeight, 60000), width: document.documentElement.clientWidth, theme: (document.querySelector(".storefront-theme-root") || {}).dataset?.theme ?? null };
})()`;

// ---- page-side: sample pixels behind each element ----
// Stitch paired 900px viewport screenshots. Avoid giant captures (blank below ~16k)
// and beyond-viewport clip reflow on classic-scrollbar layouts.
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
  // Fixed text belongs to the first viewport, not a later tile's page backdrop.
  const fixedCv = document.createElement("canvas"); fixedCv.width = first.width; fixedCv.height = first.height;
  const fixedCx = fixedCv.getContext("2d", { willReadFrequently: true }); fixedCx.drawImage(first, 0, 0);
  const fixedShown = new Image(); fixedShown.src = "data:image/png;base64," + visTiles[0].b64; await fixedShown.decode();
  const fixedVisCv = document.createElement("canvas"); fixedVisCv.width = first.width; fixedVisCv.height = first.height;
  const fixedVisCx = fixedVisCv.getContext("2d", { willReadFrequently: true }); fixedVisCx.drawImage(fixedShown, 0, 0);
  const masks = tiles.map(t => new Set(t.blocked));
  const painted = (row) => {
    let diff = 0;
    for (const rc of row.rects) {
      const x0 = Math.max(0, Math.floor(rc.x)), y0 = Math.max(0, Math.floor(rc.y));
      const w = Math.max(1, Math.min(img.width - x0, Math.ceil(rc.w))), h = Math.max(1, Math.min(img.height - y0, Math.ceil(rc.h)));
      if (y0 >= img.height) continue;
      const a = (row.fixed ? fixedCx : cx).getImageData(x0, y0, w, h).data, b = (row.fixed ? fixedVisCx : cx2).getImageData(x0, y0, w, h).data;
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 6 || Math.abs(a[i + 1] - b[i + 1]) > 6 || Math.abs(a[i + 2] - b[i + 2]) > 6) diff++;
    }
    return diff >= (row.control || row.shortText ? 1 : 25);
  };
  const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  return rows.map((row, rowIndex) => {
     if (row.occluded) return { ...row, ratio: null };
    if (!painted(row)) return { ...row, ratio: null, unpainted: true };
    const ratios = []; let sr = 0, sg = 0, sb = 0, n = 0;
    for (const rc of row.rects) {
      const inset = rc.w > 14 && rc.h > 14 ? 1 : 0;
      const x0 = Math.max(0, Math.floor(rc.x) + inset), y0 = Math.max(0, Math.floor(rc.y) + inset);
      if (y0 >= img.height) continue;
      const w = Math.max(1, Math.min(img.width - x0, Math.floor(rc.w) - 2 * inset)), h = Math.max(1, Math.min(img.height - y0, Math.floor(rc.h) - 2 * inset));
      const data = (row.fixed ? fixedCx : cx).getImageData(x0, y0, w, h).data;
      const visible = row.hero || row.productLabel || row.control || row.shortText ? (row.fixed ? fixedVisCx : cx2).getImageData(x0,y0,w,h).data : null;
      const step = visible ? 1 : Math.max(1, Math.floor(Math.sqrt((w * h) / 150)));
      for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
        let tile = 0;
        if (!row.fixed) for (let i = tiles.length - 1; i >= 0; i--) if (y0 + y >= tiles[i].y && y0 + y < tiles[i].y + 900) { tile = i; break; }
        if (masks[tile].has(rowIndex + ":" + (x0 + x) + ":" + (y0 + y))) continue;
        const o = (y * w + x) * 4; const r = data[o], g = data[o + 1], b = data[o + 2];
        if (visible && (Math.max(Math.abs(visible[o]-r),Math.abs(visible[o+1]-g),Math.abs(visible[o+2]-b)) <= 6 ||
          !row.control && Math.max(Math.abs(visible[o]-row.fg[0]),Math.abs(visible[o+1]-row.fg[1]),Math.abs(visible[o+2]-row.fg[2])) > 24)) continue;
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

// Hit-test the exact pixels the sampler will use, in the same viewport as its
// paired images. Partial occlusion must not turn an overlay into text backing.
// Nine own-text probes remain explicit evidence for every fully covered row.
const HIT_TEST = (rows, width) => `(() => {
  const rows = ${JSON.stringify(rows)}, width = ${width};
  const blocked = [], probes = [], covers = {};
  const label = el => { const p=[]; for(let n=el;n&&n.tagName!=="HTML"&&p.length<3;n=n.parentElement){let s=n.tagName.toLowerCase();if(n.dataset?.testid)s+="["+n.dataset.testid+"]";else if(typeof n.className==="string"&&n.className.trim())s+="."+n.className.trim().split(/\\s+/)[0];p.unshift(s);}return p.join(" > "); };
  rows.forEach((row,i) => {
    if(row.fixed && scrollY!==0)return;
    const el=window.__contrastTextEls[i];
    // Chromium can round 899.75 to 900 and return null at a 900px viewport edge.
    // Hit the integer pixel we sampled, never a subpixel beyond its boundary.
    const hit=(x,y)=>{const top=document.elementFromPoint(Math.floor(x),Math.floor(y-scrollY));return {visible:!!top&&(top===el||el.contains(top)),coveringElement:top?label(top):null};};
    row.rects.forEach((rc,ri)=>{
      for(const fx of [.2,.5,.8])for(const fy of [.2,.5,.8]){
        const x=Math.floor(rc.x+rc.w*fx),y=Math.floor(rc.y+rc.h*fy);
        if(x<0||x>=innerWidth||y<scrollY||y>=scrollY+innerHeight)continue;
        probes.push({row:i,key:ri+":"+fx+":"+fy,x,y,...hit(x,y)});
      }
      const inset=rc.w>14&&rc.h>14?1:0;
      const x0=Math.max(0,Math.floor(rc.x)+inset),y0=Math.max(0,Math.floor(rc.y)+inset);
      const w=Math.max(1,Math.min(width-x0,Math.floor(rc.w)-2*inset));
      const h=Math.max(1,Math.floor(rc.h)-2*inset);
      const step=row.hero||row.productLabel||row.control||row.shortText?1:Math.max(1,Math.floor(Math.sqrt(w*h/150)));
      for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){
        const px=x0+x,py=y0+y;
        if(py<scrollY||py>=scrollY+innerHeight)continue;
        const result=hit(px+.5,py+.5);
        if(!result.visible){
          blocked.push(i+":"+px+":"+py);
          const key=result.coveringElement||"outside viewport";
          covers[key]=(covers[key]||0)+1;
        }
      }
    });
  });
  return {blocked,probes,covers};
})()`;

async function applyState(state) {
  if (!state || state === "initial") return;
  if (state === "faq") { await ev(`document.querySelectorAll("details").forEach((d) => { d.open = true; })`); await sleep(500); return; } // /studio-guide with every FAQ open
  if (state === "cart") { // /quote with two basin lines in the cart (the summary aside shows totals, VAT row, grand total)
    await ev(`localStorage.setItem("knight-cart", JSON.stringify(${JSON.stringify(CART)})); location.reload();`);
    const deadline = Date.now() + readyTimeout;
    while (!(await ev(`document.readyState==="complete" && JSON.stringify(JSON.parse(localStorage.getItem("knight-cart")||"[]"))===${JSON.stringify(JSON.stringify(CART))} && !!window.__contrastLoad`))) {
      if (Date.now() >= deadline) notReady("/quote#cart", "cart reload timeout");
      await sleep(100);
    }
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

function notReady(target, detail) {
  console.error(`ยังไม่ได้ตรวจ (หน้าโหลดไม่จบ: ${target}) — ${detail}`);
  socket.close(); proc.kill(); process.exit(2);
}

// Two consecutive unchanged observations are necessary, but never sufficient:
// required API success, actual cards, loaded fonts/images and no pending fetches
// are also mandatory. A stable error/empty fallback must not pass.
async function waitReady(target, cartRequired = false) {
  const route = target.split("#")[0];
  const storefront = ["/", "/stone", "/portfolio", "/price-guide", "/site-prep", "/studio-guide", "/quote", "/studio", "/sketch", "/readme", "/updates", "/network", "/profile", "/handover", "/track", "/quote/view"].includes(route);
  // Standalone pages do not mount Storefront's catalogue hook.
  const needsCatalog = ["/", "/stone", "/quote", "/studio", "/sketch", "/network", "/profile", "/quote/view"].includes(route);
  const deadline = Date.now() + readyTimeout;
  let previous = "", stable = 0, last;
  while (Date.now() < deadline) {
    last = await ev(`(() => {
      const state = window.__contrastLoad;
      const count = selector => document.querySelectorAll(selector).length;
      const root = document.querySelector(".storefront-theme-root");
      const apiOK = path => state?.responses[path] >= 200 && state.responses[path] < 300;
      const catalog = state?.data["/api/catalog"];
      const products = count(".product-card"), colors = count(".stone-colors button:has(> .stone-card-prices)"), prices = count(".stone-card-prices");
      const gallery = count('[data-testid^="portfolio-photo-"]');
      const expectedCart = ${JSON.stringify(CART)};
      const cartRows = count('.quote-line[data-testid^="row-quote-"]'), quantityBoxes=count(".quote-line .line-quantity");
      const cartOK = cartRows === expectedCart.length && quantityBoxes === expectedCart.length &&
        expectedCart.every(line => {
          const row=document.querySelector('[data-testid="row-quote-'+line.sku+'"]'),box=row?.querySelector(".line-quantity");
          return box && box.getBoundingClientRect().width>0 && box.querySelectorAll("button").length===2 &&
            box.querySelector("span")?.textContent.trim()===String(line.quantity);
        });
      const actualCodes = [...document.querySelectorAll(".stone-colors button > small:not(.stone-card-prices)")].map(n=>n.textContent.trim()).sort();
      const matchingStoneSet = ["sheetStones", "installedStones"].some(key => {
        const codes = catalog?.[key]?.filter(x=>x.active !== false).map(x=>x.code).sort();
        return codes?.length > 0 && JSON.stringify(codes) === JSON.stringify(actualCodes);
      });
      const loading = /กำลังโหลดคลังภาพ|โหลดคลังภาพไม่สำเร็จ/.test(document.body?.innerText ?? "");
      const busy = [...document.querySelectorAll(".animate-spin,[aria-busy=true]")].some(n=>{
        const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width>0&&r.height>0&&s.visibility!=="hidden"&&s.display!=="none";
      });
      const routeOK = ${JSON.stringify(route)} === "/" ? products > 0 && products === catalog?.basins?.filter(x=>x.active !== false).length :
        ${JSON.stringify(route)} === "/stone" ? colors > 0 && prices === colors && matchingStoneSet :
        ${JSON.stringify(route)} === "/portfolio" ? apiOK("/api/portfolio") && !loading &&
          gallery === state?.data["/api/portfolio"]?.items?.length &&
          (gallery > 0 || /ยังไม่มีภาพในหมวดนี้/.test(document.body?.innerText ?? "")) :
        ${JSON.stringify(route)} === "/site-prep" ? apiOK("/api/portfolio") : true;
      document.querySelectorAll("img").forEach(im => { im.loading = "eager"; });
      const ok = document.readyState === "complete" && !!state && state.pending === 0 && !busy &&
        document.fonts.status === "loaded" && [...document.images].every(im => im.complete) &&
        (!${storefront} || !!root) && (!${needsCatalog} || apiOK("/api/catalog")) && routeOK && (!${cartRequired} || cartOK);
      return { ok, pending: state?.pending, responses: state?.responses, products, colors, prices, gallery,
        cart: ${cartRequired} ? {expected:expectedCart.length,rows:cartRows,quantityBoxes,ok:cartOK} : null,
        signature: JSON.stringify([state?.mutations, products, colors, prices, gallery, cartRows, quantityBoxes, document.body?.textContent?.length, document.documentElement.scrollHeight]) };
    })()`);
    if (last?.ok && last.signature === previous) stable++; else stable = 0;
    if (stable >= 2) return { ...last, stableObservations: stable, timeoutMs: readyTimeout };
    previous = last?.signature;
    await sleep(200);
  }
  notReady(target, JSON.stringify(last));
}

const all = [];
for (const target of targets) {
  const [route, state] = target.split("#");
  await cdp("Page.navigate", { url: base + route });
  // Page.navigate returns before document replacement. Wait for the new route,
  // not the previous page (or a transient null document during navigation).
  const navigationDeadline = Date.now() + readyTimeout;
  while (!(await ev(`location.pathname === ${JSON.stringify(route)} && document.readyState === "complete" && !!window.__contrastLoad`))) {
    if (Date.now() >= navigationDeadline) notReady(target, "navigation timeout");
    await sleep(100);
  }
  // Trigger all lazy images before readiness checks, not midway through sampling.
  await ev(`document.querySelectorAll("img").forEach(im => { im.loading = "eager"; });`);
  await waitReady(target);
  await applyState(state);
  // Settle lazy images and reveal observers before BOTH captures, not only the hidden capture.
  await ev(`(async () => {
    await document.fonts.ready;
    const style=document.createElement("style"); style.textContent="*{animation:none!important;transition:none!important;scroll-behavior:auto!important}"; document.head.appendChild(style);
    document.querySelectorAll("img").forEach((im)=>{im.loading="eager";});
    for(let y=0;y<document.documentElement.scrollHeight;y+=700){scrollTo(0,y);await new Promise(r=>requestAnimationFrame(r));}
    scrollTo(0,0);
    document.querySelectorAll("body *").forEach(n=>{if(getComputedStyle(n).position==="sticky"){n.style.setProperty("position","relative","important");n.style.setProperty("top","auto","important");}});
  })()`);
  const readiness = await waitReady(target, state === "cart");
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
  const collected = await ev(COLLECT);
  if(!collected?.rows?.length||collected.theme!==theme||collected.ov.innerWidth!==viewport){proc.kill();throw new Error(`${target}: missing text, wrong theme or viewport — contrast was NOT checked`);}
  // Paired viewport captures never change document width for a beyond-viewport
  // clip. On classic-scrollbar mobile layouts a 390px clip can reflow 375px
  // content, moving a label onto pixels belonging to a different element.
  // Both images use the SAME scroll position/layout; record actual (clamped) y.
  const visTiles = [], tiles = [];
  for (let y = 0; y < collected.height; y += 900) {
    const actualY = await ev(`(async () => {
      document.getElementById("scan-hide-text").disabled = true;
      scrollTo(0, ${y}); await new Promise(r => requestAnimationFrame(r));
      return scrollY;
    })()`);
    const shown = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const hit = await ev(HIT_TEST(collected.rows, viewport));
    await ev('document.getElementById("scan-hide-text").disabled = false');
    const hidden = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    visTiles.push({ y: actualY, b64: shown.data });
     tiles.push({ y: actualY, b64: hidden.data, ...hit });
    if (actualY + 900 >= collected.height) break;
  }
  const probeMaps = collected.rows.map(() => new Map());
  for (const tile of tiles) for (const p of tile.probes) probeMaps[p.row].set(p.key, p);
  collected.rows.forEach((row, i) => {
    row.visibilitySamples = [...probeMaps[i].values()];
    row.occluded = row.visibilitySamples.length > 0 && row.visibilitySamples.every(p => !p.visible && p.coveringElement);
    row.coveringElements = [...new Set(row.visibilitySamples.filter(p => !p.visible).map(p => p.coveringElement).filter(Boolean))];
  });
  collected.covered = collected.rows.filter(r => r.occluded).length;
  if (process.env.SCAN_SAVE_HIDDEN) writeFileSync(process.env.SCAN_SAVE_HIDDEN, Buffer.from(tiles[0].b64, "base64")); // debug: the first tile of the background-only render the pixels are sampled from
  const sampled = (await ev(SAMPLE(tiles, visTiles, collected.rows, collected.height))).map(r=>({...r,...classifyContrastRow(r)}));
  // React content must not change between collection and the paired captures.
  const captureLoad = () => ev("({ mutations: window.__contrastLoad?.mutations, pending: window.__contrastLoad?.pending, responses: window.__contrastLoad?.responses })");
  let afterCapture = await captureLoad();
  // A periodic refresh can start after a ready capture begins. Wait for its
  // consumed response, then accept only if the captured DOM never changed.
  // A hung/failed refresh or any content mutation still fails closed.
  if (afterCapture?.pending) {
    await waitReady(target, state === "cart");
    afterCapture = await captureLoad();
  }
  const beforeMutations = JSON.parse(readiness.signature)[0];
  if (afterCapture?.mutations !== beforeMutations || afterCapture?.pending) notReady(target, `data changed during pixel capture: before=${beforeMutations}; after=${JSON.stringify(afterCapture)}`);
  const unpainted = sampled.filter((r) => r.unpainted);
  const rows = sampled.filter((r) => r.ratio != null);
  const missingControls=sampled.filter(r=>r.control && !r.occluded && r.ratio==null);
  if(missingControls.length)notReady(target,"control pixels NOT MEASURABLE: "+JSON.stringify(missingControls.map(r=>({selector:r.selector,control:r.control,unpainted:r.unpainted}))));
  // A cart with six unmeasured quantity glyphs is NOT a passing cart.
  if (state === "cart" && rows.filter(r=>r.stepper).length !== CART.length * 3)
    notReady(target, "cart quantity coverage incomplete: expected " + CART.length * 3 + " measured number/icon rows");
  const failing = rows.filter((r) => r.ratio < r.threshold).sort((a, b) => a.ratio - b.ratio);
  console.log(`\n=== ${target}  theme=${collected.theme}  checked=${rows.length}  failing(p10 ratio < threshold)=${failing.length}`);
  console.log(`  overflow: innerWidth=${collected.ov.innerWidth} clientWidth=${collected.ov.clientWidth} scrollWidth=${collected.ov.scrollWidth} -> ${collected.ov.scrollWidth - collected.ov.clientWidth}px`);
  if (unpainted.length) console.log(`  excluded: ${unpainted.length} text(s) not painted (identical pixels with the text shown and hidden: covered by a photo/overlay) e.g. ${[...new Set(unpainted.map((r) => r.selector.split(" > ").pop()))].slice(0, 4).join(", ")}`);
  if (collected.moving) console.log(`  excluded: ${collected.moving} text(s) inside a horizontally auto-scrolling track (position changes between measure and screenshot) - verify by arithmetic`);
  for(const r of collected.excluded)console.log("  excluded decorative: "+r.selector+" — "+r.reason);
  for (const r of (showAll ? rows.sort((a, b) => a.ratio - b.ratio) : failing)) {
    console.log(`  ${String(r.ratio).padEnd(6)}| need ${r.threshold} | ${r.category} ${r.criterion} | ${r.kind.padEnd(8)}| text rgb(${r.fg.slice(0, 3).join(",")}) on bg~rgb(${r.bg.join(",")}) | ${r.size}px | ${r.selector} | "${r.text}"`);
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
  const coverage={heroes:rows.filter(r=>r.hero).length,productLabels:rows.filter(r=>r.productLabel).length,
    inputs:rows.filter(r=>r.control==="input-value").length,icons:rows.filter(r=>r.control==="icon-currentColor"||r.control==="icon-text").length,
    placeholders:rows.filter(r=>r.control==="placeholder").length,inputBorders:rows.filter(r=>r.control==="input-border").length,
    text:rows.filter(r=>r.category==="text").length,ui:rows.filter(r=>r.category==="ui").length,decorative:collected.excluded.length,
    checkboxes:rows.filter(r=>r.control==="custom-checkbox"||r.control==="custom-radio").length,shortText:rows.filter(r=>r.shortText).length,stepper:rows.filter(r=>r.stepper).length};
  const requiredLabels = route === "/" ? REQUIRED_LABELS_BY_WIDTH[viewport].map(sku=>`article[card-product-${sku}] > div.product-art > span.art-note`) : [];
   const occluded = sampled.filter(r=>r.occluded);
   const requiredMissing = [...sampled.filter(r=>r.hero&&r.ratio==null).map(r=>r.selector),
     ...requiredLabels.filter(selector=>!rows.some(r=>r.selector===selector)&&!unpainted.some(r=>r.selector===selector)&&!occluded.some(r=>r.selector===selector))];
  const unmeasurable = sampled.filter(r=>r.ratio==null).map(r=>({
    selector:r.selector,text:r.text,width:viewport,theme:collected.theme,required:r.hero||requiredLabels.includes(r.selector),
     status:r.occluded ? "occluded / มองไม่เห็น" : "NOT MEASURABLE / วัดไม่ได้",
     coveringElements:r.coveringElements,visibilitySamples:r.visibilitySamples,
     reason:r.occluded ? "document.elementFromPoint: every sampled own-text point is covered by " + r.coveringElements.join("; ") :
       r.unpainted ? "Visible and hidden pixels identical: text covered by photo/overlay; no painted text pixels detected" :
      "Visible/hidden pixel difference detected, but no reliable glyph-interior samples at this viewport width",
  }));
   for(const row of unmeasurable)console.log(`  ${row.status} @${viewport}: ${row.selector} "${row.text}" — ${row.reason}`);
  all.push({ target, theme: collected.theme, width:viewport, readiness: { ...readiness, signature: undefined }, overflow: collected.ov, checked: rows.length, failing: failing.length,
     capture:{method:"paired viewport screenshots with capture-position elementFromPoint pixel masks",settled:afterCapture,viewportWidth:viewport,layoutWidth:collected.width,tileY:tiles.map(t=>t.y),
       pixelOcclusion:tiles.map(t=>({y:t.y,blocked:t.blocked,coveringElements:t.covers}))},
    coverage:{...coverage,requiredLabels,requiredMissing},excluded:collected.excluded,unmeasurable,
     exclusions:{covered:collected.covered,moving:collected.moving,unpainted,occluded}, rows: showAll ? rows : failing, surfaces: [...surfaces.values()] });
  if(jsonOut)writeFileSync(jsonOut, JSON.stringify(all,null,1));
  if((["/","/stone","/quote"].includes(route)&&!coverage.heroes)||requiredMissing.length){socket.close();proc.kill();throw new Error(`${target}: required hero/product-label pixels were NOT checked: ${JSON.stringify({width:viewport,coverage,missing:requiredMissing})}`);}
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(all, null, 1));
socket.close(); proc.kill(); process.exit(0);
