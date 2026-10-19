// Real Chromium controls: covered text, partial overlays, and fixed text must
// remain distinct from genuinely low-contrast visible glyphs.
import http from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, mkdtempSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const out = mkdtempSync(join(tmpdir(), "contrast-occlusion-"));
let fixtureMode = "delayed";
const themeSource = readFileSync(new URL("../../artifacts/knight-basins/src/components/ThemeToggle.tsx", import.meta.url), "utf8");
const themeLiteral = themeSource.match(/export const STOREFRONT_THEME_STYLES = `([\s\S]*?)`;/)?.[1];
assert.ok(themeLiteral, "Read the real application theme stylesheet");
// Evaluate only this trusted static CSS template, not the TSX module.
const themeStyles = Function("return `" + themeLiteral + "`;")();
const assets = new URL("../../artifacts/knight-basins/dist/public/assets/", import.meta.url);
const cssName = readdirSync(assets).find(n=>n.endsWith(".css"));
assert.ok(cssName, "Build the actual application CSS before browser controls");
const compiledStyles = readFileSync(new URL(cssName, assets), "utf8");
const server = http.createServer((req, res) => {
  if (req.url === "/sitemap.xml") {
    res.writeHead(200, { "content-type":"application/xml" });
    return res.end("<urlset>"+["/stone",...Array.from({length:11},(_,i)=>"/fixture-"+i)].map(p=>"<url><loc>https://example.test"+p+"</loc></url>").join("")+"</urlset>");
  }
  if (req.url.startsWith("/api/catalog")) {
    if (fixtureMode === "blocked") return; // deliberately never delivers data
    return setTimeout(() => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ basins: [], sheetStones: ["T1", "T2", "T3"].map(code=>({code,active:true})), installedStones: [] }));
    }, 700);
  }
  if (req.url === "/stone") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><style>body{background:white;color:#173f6b}button{background:white;color:#173f6b}</style>
      <main class="storefront-theme-root"><header class="stone-hero"><h1>READY STONE CONTROL</h1></header>
      <div class="stone-colors"><button><small>FALLBACK</small><small class="stone-card-prices">แผ่น ฿12,000</small></button></div></main>
      <script>
      document.querySelector("main").dataset.theme=localStorage.getItem("knight-storefront-theme");
      fetch("/api/catalog").then(r=>r.json()).then(data=>{
        const grid=document.querySelector(".stone-colors"), card=x=>'<button><small>'+x.code+'</small><small class="stone-card-prices">แผ่น ฿12,000</small></button>';
        grid.innerHTML=card(data.sheetStones[0]);
        setTimeout(()=>{grid.innerHTML=data.sheetStones.map(card).join("")},900);
      });</script>`);
  }
  if (req.url === "/470-colors") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><style>${compiledStyles}</style><style>${themeStyles}</style>
      <main class="storefront-theme-root" style="padding:20px">
      <p class="text-sm text-[#a24439] py-12 text-center">โหลดคลังภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>
      <div class="stone-colors"><button><small class="stone-card-prices">แผ่น ฿12,000</small></button></div></main>
      <script>document.querySelector("main").dataset.theme=localStorage.getItem("knight-storefront-theme")</script>`);
  }
  res.writeHead(200, { "content-type": "text/html" });
  res.end(`<!doctype html><html><head><style>
    body { margin:0; background:#fff; height:1400px }
    span { position:absolute;left:30px;font:16px Arial }
    .covered { top:80px;color:#eee }
    .photo { position:absolute;top:70px;left:20px;width:280px;height:60px;background:#ddd;z-index:1 }
    .bad { top:180px;color:#8b9dae }
    .good { top:240px;color:#173f6b }
    .partial-good { top:1350px;color:#173f6b }
    .partial-bad { top:1290px;color:#8b9dae }
    .overlay { position:fixed;left:180px;width:120px;height:40px;background:#173f6b;z-index:10 }
    .overlay.good { bottom:15px;top:auto }
    .overlay.bad { bottom:75px;top:auto }
    .fixed-good { position:fixed;bottom:130px;left:30px;color:#173f6b;z-index:20 }
    .boundary { top:890px;color:#eee }
    .boundary-photo { position:absolute;top:865px;left:20px;width:340px;height:75px;background:#ddd;z-index:1 }
  </style></head><body><main class="storefront-theme-root">
    <span class="covered">COVERED LOW CONTRAST LABEL</span><div class="photo"></div>
    <span class="bad">VISIBLE LOW CONTRAST CONTROL</span>
    <span class="good">VISIBLE PASSING CONTROL</span>
    <span class="partial-good">PARTIALLY COVERED PASSING CONTROL</span>
    <span class="partial-bad">PARTIALLY COVERED FAILING CONTROL</span>
    <div class="overlay good"></div><div class="overlay bad"></div>
    <span class="fixed-good">FIXED PASSING CONTROL</span>
    <span class="boundary">BOUNDARY COVERED CONTROL</span><div class="boundary-photo"></div>
  </main><script>
    document.querySelector('main').dataset.theme=localStorage.getItem('knight-storefront-theme')||'light';
    const el=document.querySelector('.boundary'),range=document.createRange();
    range.selectNodeContents(el);const box=range.getBoundingClientRect();
    el.style.top=(890+899.75-box.top-box.height/2)+'px';
  </script></body></html>`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  for (const width of [1440, 390]) for (const theme of ["dark", "light"]) {
    const json = join(out, `${theme}-${width}.json`);
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [
        fileURLToPath(new URL("./gradient-scan-465c.mjs", import.meta.url)),
        `http://127.0.0.1:${server.address().port}`, theme, "/occlusion", "--all", "--json", json,
      ], { env: { ...process.env, SCAN_WIDTH: String(width) }, stdio: ["ignore", "pipe", "pipe"] });
      let log = "";
      child.stdout.on("data", chunk => { log += chunk; });
      child.stderr.on("data", chunk => { log += chunk; });
      child.on("error", reject);
      child.on("exit", status => status === 0 ? resolve(status) : reject(Error(log)));
    });
    assert.equal(code, 0);
    const [result] = JSON.parse(readFileSync(json, "utf8"));
    const covered = result.unmeasurable.find(row => row.text === "COVERED LOW CONTRAST LABEL");
    assert.equal(covered?.status, "occluded / มองไม่เห็น");
    assert.equal(covered.visibilitySamples.length, 9);
    assert.ok(covered.visibilitySamples.every(point => !point.visible && point.coveringElement.endsWith("div.photo")));
    const boundary = result.unmeasurable.find(row => row.text === "BOUNDARY COVERED CONTROL");
    assert.equal(boundary?.status, "occluded / มองไม่เห็น");
    assert.equal(boundary.visibilitySamples.length, 9);
    assert.ok(boundary.visibilitySamples.every(point => !point.visible && point.coveringElement.endsWith("div.boundary-photo")));
    for (const text of ["VISIBLE LOW CONTRAST CONTROL", "PARTIALLY COVERED FAILING CONTROL"]) {
      const row = result.rows.find(row => row.text === text);
      assert.ok(row && row.ratio < 4.5 && !row.occluded, `${text} must still fail`);
    }
    for (const text of ["VISIBLE PASSING CONTROL", "PARTIALLY COVERED PASSING CONTROL", "FIXED PASSING CONTROL"]) {
      const row = result.rows.find(row => row.text === text);
      assert.ok(row && row.ratio >= 4.5 && !row.occluded, `${text} must remain measured and pass`);
    }
    assert.ok(result.capture.pixelOcclusion.some(tile => Object.keys(tile.coveringElements).some(name => name.includes("div.overlay"))));
    console.log(`PASS ${theme} ${width}: nine-point occlusion, partial good/bad, fixed text; ratios ${result.rows.map(row => `${row.text}=${row.ratio}`).join("; ")}`);
  }
  const run = (route, name, timeout = "10000", theme = "dark") => new Promise((resolve, reject) => {
    const json = join(out, name + ".json"), started = Date.now();
    const child = spawn(process.execPath, [fileURLToPath(new URL("./gradient-scan-465c.mjs", import.meta.url)),
      `http://127.0.0.1:${server.address().port}`, theme, route, "--all", "--json", json, "--ready-timeout", timeout],
      { env: {...process.env, SCAN_WIDTH:"390"}, stdio:["ignore","pipe","pipe"] });
    let log="";
    child.stdout.on("data", c=>{log+=c;}); child.stderr.on("data", c=>{log+=c;}); child.on("error",reject);
    child.on("exit", status=>resolve({status,log,json,elapsed:Date.now()-started}));
  });
  const delayed = await run("/stone", "delayed");
  assert.equal(delayed.status, 0, delayed.log);
  const [ready] = JSON.parse(readFileSync(delayed.json,"utf8"));
  assert.equal(ready.readiness.colors, 3);
  assert.equal(ready.readiness.prices, 3);
  assert.equal(ready.readiness.stableObservations, 2);
  assert.ok(delayed.elapsed >= 1600);
  console.log("PASS delayed API + two-stage DOM: all 3 cards/prices measured, never the stable fallback or partial first card");
  fixtureMode = "blocked";
  const blocked = await run("/stone", "blocked", "1500");
  assert.equal(blocked.status, 2, blocked.log);
  assert.match(blocked.log, /ยังไม่ได้ตรวจ \(หน้าโหลดไม่จบ: \/stone\)/);
  assert.equal(existsSync(blocked.json), false, "No partial measured result on timeout");
  console.log("PASS blocked /api/catalog: exit 2; " + blocked.log.trim());
  const blockedSweep = await new Promise((resolve,reject)=>{
    const base=`http://127.0.0.1:${server.address().port}`;
    const child=spawn(process.execPath,[fileURLToPath(new URL("./sweep-467c.mjs",import.meta.url)),base,
      "--sitemap",base+"/sitemap.xml","--extra","/occlusion","--out",join(out,"blocked-sweep")],
      {env:{...process.env,SCAN_WIDTH:"390",SCAN_READY_TIMEOUT_MS:"1500"},stdio:["ignore","pipe","pipe"]});
    let log="";child.stdout.on("data",c=>{log+=c});child.stderr.on("data",c=>{log+=c});
    child.on("error",reject);child.on("exit",status=>resolve({status,log}));
  });
  assert.equal(blockedSweep.status,2,blockedSweep.log);
  assert.match(blockedSweep.log,/ยังไม่ได้ตรวจ \(หน้าโหลดไม่จบ: \/stone\)/);
  console.log("PASS full sweep blocked catalogue: exit 2, ยังไม่ได้ตรวจ (หน้าโหลดไม่จบ: /stone)");
  const colors = await run("/470-colors", "colors");
  assert.equal(colors.status, 0, colors.log);
  const [colorResult] = JSON.parse(readFileSync(colors.json,"utf8"));
  for (const text of ["โหลดคลังภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", "แผ่น ฿12,000"]) {
    const row=colorResult.rows.find(r=>r.text===text);
    assert.ok(row && row.ratio >= 4.5, `${text}: ${JSON.stringify(row)}`);
    console.log(`PASS real app CSS fixture dark 390: ${text}; ratio=${row.ratio}; foreground=${row.fg}; sampled background=${row.bg}`);
  }
  const lightColors = await run("/470-colors", "colors-light", "10000", "light");
  assert.equal(lightColors.status, 0, lightColors.log);
  const [lightResult] = JSON.parse(readFileSync(lightColors.json,"utf8"));
  const lightPrice = lightResult.rows.find(r=>r.text==="แผ่น ฿12,000");
  assert.ok(lightPrice && lightPrice.ratio >= 4.5);
  console.log(`PASS real app CSS fixture light 390: price ratio=${lightPrice.ratio}; sampled background=${lightPrice.bg}`);
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
