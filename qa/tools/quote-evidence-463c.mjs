/*
 * job 463-C - evidence for the formal quote (LINE name, factory-hours line, bank box) through Chrome DevTools.
 *
 *   node qa/tools/quote-evidence-463c.mjs <label> [baseUrl]
 *
 * Needs a running dev server (default http://localhost:5173) and Chrome at CHROME_BIN (default: the Windows install).
 * It seeds a test cart + a test customer into localStorage (no real data), opens /quote, presses "ออกใบเสนอราคาทางการ",
 * then for 1440 / 390 / print-A4 it writes into qa/images/chai-round26/:
 *   <label>-quote-<vp>.png   (clip of the notes + totals + bank + signature area)
 *   <label>-a4.pdf           (Page.printToPDF, A4)
 *   <label>-measure.json     (font sizes, positions, overflow, the real texts of the LINE line and the factory-hours line)
 * Read-only against the app: nothing is sent anywhere, no real customer data is used.
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

const port = 9400 + Math.floor(Math.random() * 300);
const profile = mkdtempSync(join(tmpdir(), "chai-463c-"));
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, "--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(500);
  }
  throw new Error("Chrome did not start");
}

const socket = new WebSocket(await wsUrl());
await new Promise((r) => socket.addEventListener("open", r, { once: true }));
let id = 0;
const waiting = new Map();
socket.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { const { res, rej } = waiting.get(m.id); waiting.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result ?? {}); }
});
const cdp = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); socket.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;

const cart = [{ sku: "KF003", quantity: 1, installationSelected: false }, { sku: "KF025", quantity: 2, installationSelected: false }, { sku: "KF029", quantity: 1, installationSelected: false }];
const customer = { name: "ลูกค้า ทดสอบ", company: "บริษัท ทดสอบ จำกัด", phone: "0800000000", address: "1 ถนนทดสอบ กรุงเทพฯ" };
await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.setItem('knight-cart', ${JSON.stringify(JSON.stringify(cart))}); localStorage.setItem('knight-customer', ${JSON.stringify(JSON.stringify(customer))}); localStorage.setItem('knight-quote-format','US'); localStorage.setItem('knight-quote-serial','1246');` });

const measure = `(() => {
  const sheet = document.querySelector('[data-testid="formal-quote-sheet"]');
  const bank = document.querySelector('.formal-bank-details');
  const notes = document.querySelector('.formal-notes');
  const totals = document.querySelector('.formal-totals');
  const sr = sheet.getBoundingClientRect(), br = bank.getBoundingClientRect(), nr = notes.getBoundingClientRect(), tr = totals.getBoundingClientRect();
  const fs = (e) => getComputedStyle(e).fontSize;
  const pickup = [...document.querySelectorAll('.formal-notes p')].map((p) => p.textContent.trim()).find((t) => t.includes('เวลารับสินค้าที่โรงงาน'));
  const footerLine = [...document.querySelectorAll('.footer-contact-item')].map((e) => e.textContent.trim()).find((t) => t.startsWith('LINE'));
  return {
    viewport: innerWidth, docClient: document.documentElement.clientWidth, docScroll: document.documentElement.scrollWidth,
    sheet: { w: Math.round(sr.width), scrollW: sheet.scrollWidth, clientW: sheet.clientWidth },
    bank: { parentClass: bank.parentElement.className, left: Math.round(br.left - sr.left), top: Math.round(br.top - sr.top), w: Math.round(br.width), h: Math.round(br.height),
      fontSize: fs(bank), children: [...bank.children].map((c) => ({ text: c.textContent.trim().slice(0, 40), fontSize: fs(c), fontWeight: getComputedStyle(c).fontWeight })),
      belowNotes: br.top >= nr.bottom - 0.5, insideSheet: br.left >= sr.left - 0.5 && br.right <= sr.right + 0.5, widthShareOfSheet: Math.round((br.width / sr.width) * 100) },
    totals: { left: Math.round(tr.left - sr.left), w: Math.round(tr.width), text: totals.textContent.replace(/\\s+/g, ' ').trim() },
    pickupLine: pickup, footerLine,
    placeholderAnywhere: document.body.innerText.includes('\${'),
  };
})()`;

async function shot(name, selectorTop, selectorBottom) {
  const rect = await ev(`(() => { const a = document.querySelector('${selectorTop}').getBoundingClientRect(); const b = document.querySelector('${selectorBottom}').getBoundingClientRect(); const sx = scrollX, sy = scrollY;
    const left = Math.max(0, Math.min(a.left, b.left) + sx - 8); return { x: left, y: a.top + sy - 12, width: Math.min(document.documentElement.scrollWidth - left, Math.max(a.right, b.right) + sx - left + 8), height: b.bottom - a.top + 24 }; })()`);
  const { data } = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { ...rect, scale: 1 } });
  writeFileSync(join(outDir, `${label}-quote-${name}.png`), Buffer.from(data, "base64"));
}
async function open(width, height, mobile, dsf = 1) {
  await cdp("Emulation.setEmulatedMedia", { media: "screen" });
  await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dsf, mobile });
  await cdp("Page.navigate", { url: `${base}/quote` });
  await sleep(6000);
  await ev(`document.querySelector('[data-testid="button-generate-quote"]').click()`);
  await sleep(2500);
}

const result = { label, baseline: base, at: new Date().toISOString() };
await open(1440, 900, false);
result.desktop1440 = await ev(measure);
await shot("1440", ".formal-notes", ".formal-quote-signature");
await ev(`document.querySelector('footer.site-footer, .site-footer')?.scrollIntoView()`);
result.footerLineText = await ev(`[...document.querySelectorAll('.footer-contact-item')].map((e) => e.textContent.trim()).find((t) => t.startsWith('LINE'))`);

await open(390, 844, true, 2);
result.mobile390 = await ev(measure);
await shot("390", ".formal-notes", ".formal-quote-signature");

await open(794, 1123, false);
await cdp("Emulation.setEmulatedMedia", { media: "print" });
await sleep(800);
result.printA4 = await ev(measure);
await shot("a4", ".formal-notes", ".formal-quote-signature");
const pdf = await cdp("Page.printToPDF", { paperWidth: 8.27, paperHeight: 11.69, printBackground: true, preferCSSPageSize: true });
const pdfBuffer = Buffer.from(pdf.data, "base64");
writeFileSync(join(outDir, `${label}-a4.pdf`), pdfBuffer);
result.pdf = { bytes: pdfBuffer.length, pages: (pdfBuffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length };

writeFileSync(join(outDir, `${label}-measure.json`), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
socket.close();
proc.kill();
process.exit(0);
