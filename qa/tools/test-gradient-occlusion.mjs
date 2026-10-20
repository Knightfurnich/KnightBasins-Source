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
let cartMode = "complete";
let quantityBackground = "white";
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
  if(req.url==="/471-types"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8"});
    return res.end(`<!doctype html><style>
      body{margin:24px;background:white;color:#173f6b;font:16px Arial}
      input,textarea{display:block;width:180px;height:36px;margin:12px;background:white;color:#949494;border:2px solid #949494;font:16px Arial;padding:4px}
      input::placeholder,textarea::placeholder{color:#949494;opacity:1}
      textarea{height:90px;padding:10px}
      button{color:#949494;background:white;border:0;font:16px Arial;padding:8px}
      svg{width:20px;height:20px}
      label input{display:none}label span{display:inline-block;width:18px;height:18px;border:2px solid #949494}
      </style><main class="storefront-theme-root">
      <input value="17" data-testid="typed-value"><input placeholder="PLACEHOLDER" data-testid="typed-placeholder">
      <textarea placeholder="MULTILINE PLACEHOLDER WRAPS IN THE CONTENT BOX" data-testid="typed-textarea"></textarea>
      <button aria-label="Close" data-testid="typed-times">×</button>
      <span style="color:#949494" data-testid="text-times">×</span>
      <button aria-label="Search" data-testid="typed-svg"><svg aria-hidden="true" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M3 12h18M12 3v18"/></svg></button>
      <button aria-label="Search with title" data-testid="typed-svg-title"><svg aria-hidden="true" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><title>Search</title><path d="M3 12h18M12 3v18"/></svg></button>
      <button data-testid="typed-label" style="color:#173f6b"><svg aria-hidden="true" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M3 12h18"/></svg>Save</button>
      <label><input type="checkbox"><span data-testid="typed-checkbox"></span>Option</label>
      <label><input type="radio"><span data-testid="typed-radio"></span>Choice</label>
      <p style="color:#949494;font-size:24px" data-testid="typed-large">LARGE TEXT</p>
      </main><script>document.querySelector("main").dataset.theme=localStorage.getItem("knight-storefront-theme")</script>`);
  }
  if (req.url === "/471-controls" || req.url === "/quote") {
    res.writeHead(200, {"content-type":"text/html; charset=utf-8"});
    const glyph = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5v14"/></svg>`;
    return res.end(`<!doctype html><html><head><meta charset="UTF-8"><style>${compiledStyles}\n${themeStyles}
      /* TEST ONLY: intentionally undo/restore the now-merged 472-C backing. */
      .storefront-theme-root[data-theme] .control-fixture .line-quantity{background:${quantityBackground}!important}
      .control-fixture{padding:24px;min-height:300px}
      .control-fixture .quote-line{display:flex;flex-wrap:wrap}
      .control-fixture input[type=text]{background:#ffffff;color:#173f6b;font:16px Arial;width:120px;height:36px}
      </style></head><body><div class="storefront-theme-root"><main class="control-fixture">
      <h1 class="quote-heading">CONTROL COVERAGE FIXTURE</h1><input type="text" value="17" data-testid="input-value-control">
      <p data-testid="one-char">7</p><p data-testid="two-char">12</p><div id="cart"></div></main></div>
      <script>
      document.querySelector(".storefront-theme-root").dataset.theme=localStorage.getItem("knight-storefront-theme");
      document.documentElement.dataset.theme=localStorage.getItem("knight-storefront-theme");
      fetch("/api/catalog").then(r=>r.json()).then(()=>{
        const cart=JSON.parse(localStorage.getItem("knight-cart")||"[]");
        document.querySelector("#cart").innerHTML=cart.slice(0,${cartMode === "missing" ? 1 : 2}).map(line=>
          '<div class="quote-line" data-testid="row-quote-'+line.sku+'"><div class="line-quantity">'+
          '<button aria-label="ลดจำนวน" data-testid="minus-'+line.sku+'">${glyph}</button>'+
          '<span data-testid="text-quantity-'+line.sku+'">'+line.quantity+'</span>'+
          '<button aria-label="เพิ่มจำนวน" data-testid="plus-'+line.sku+'">${glyph}</button></div>'+
          '<label class="install-toggle"><input type="checkbox" checked><span></span>ติดตั้ง</label></div>').join("");
      });</script></body></html>`);
  }
  if (req.url === "/api/refresh-control") {
    return setTimeout(()=>{res.writeHead(200,{"content-type":"application/json"});res.end("{}")},1000);
  }
  if (req.url === "/refresh-control" || req.url === "/refresh-change") {
    res.writeHead(200,{"content-type":"text/html; charset=utf-8"});
    return res.end(`<!doctype html><style>body{height:1400px;background:white;color:#173f6b;font:16px Arial}</style>
      <main class="storefront-theme-root"><p>UNCHANGED REFRESH CONTROL</p></main>
      <script>document.querySelector("main").dataset.theme=localStorage.getItem("knight-storefront-theme");
      let started=false;new MutationObserver(()=>{if(!started&&document.getElementById("scan-hide-text")){
      started=true;fetch("/api/refresh-control").then(r=>r.json()).then(()=>{
      ${req.url==="/refresh-change" ? 'document.querySelector("p").textContent="CHANGED REFRESH CONTROL";' : ""}
      })}}).observe(document.head,{childList:true});</script>`);
  }
  if (req.url === "/api/portfolio") {
    res.writeHead(200, { "content-type":"application/json" });
    return res.end(JSON.stringify({items:[{id:1},{id:2}]}));
  }
  if (req.url === "/portfolio") {
    res.writeHead(200, { "content-type":"text/html; charset=utf-8" });
    return res.end(`<!doctype html><main class="storefront-theme-root"><h1>GALLERY READY CONTROL</h1><div id="photos"></div></main>
      <script>document.querySelector("main").dataset.theme=localStorage.getItem("knight-storefront-theme");
      fetch("/api/portfolio").then(r=>r.json()).then(data=>{document.querySelector("#photos").innerHTML=data.items.map(x=>'<button data-testid="portfolio-photo-'+x.id+'">PHOTO '+x.id+'</button>').join("")})</script>`);
  }
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
      <div class="storefront-theme-root" style="padding:20px"><main>
      <h1 data-testid="portfolio-heading">คลังผลงานติดตั้งจริงทั้งหมด</h1>
      <p class="text-sm text-[#a24439] py-12 text-center">โหลดคลังภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>
      <div class="stone-colors"><button><small class="stone-card-prices">แผ่น ฿12,000</small></button></div></main></div>
      <script>document.querySelector(".storefront-theme-root").dataset.theme=localStorage.getItem("knight-storefront-theme")</script>`);
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
  for(const width of [1440,390]){
    const json=join(out,"types-"+width+".json");
    const result=await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[fileURLToPath(new URL("./gradient-scan-465c.mjs",import.meta.url)),`http://127.0.0.1:${server.address().port}`,"light","/471-types","--all","--json",json],{env:{...process.env,SCAN_WIDTH:String(width)},stdio:["ignore","pipe","pipe"]});
      let log="";child.stdout.on("data",d=>log+=d);child.stderr.on("data",d=>log+=d);child.on("error",reject);child.on("exit",status=>status===0?resolve(log):reject(Error(log)));
    });
    const [r]=JSON.parse(readFileSync(json,"utf8"));
    const row=(id,control)=>{const x=r.rows.find(x=>x.selector.includes("["+id+"]")&&(!control||x.control===control));assert.ok(x,id+" measured: "+result);return x;};
    for(const id of ["typed-times","typed-svg","typed-svg-title","typed-checkbox","typed-radio"]){
      const x=row(id);assert.equal(x.category,"ui");assert.equal(x.threshold,3);assert.ok(x.ratio>=3&&x.ratio<4.5,id+" 3.04 UI must pass");
    }
    const value=row("typed-value","input-value"),border=row("typed-value","input-border"),placeholder=row("typed-placeholder","placeholder"),textTimes=row("text-times"),textarea=row("typed-textarea","placeholder");
    for(const x of [value,placeholder,textTimes,textarea]){assert.equal(x.category,"text");assert.equal(x.threshold,4.5);assert.ok(x.ratio<4.5);}
    assert.equal(border.category,"ui");assert.equal(border.threshold,3);assert.ok(border.ratio>=3);
    assert.equal(row("typed-large").threshold,3);assert.equal(row("typed-large").category,"text");
    assert.ok(r.excluded.some(x=>x.category==="decorative"&&x.reason.includes("Save")));
    assert.ok(!r.excluded.some(x=>x.selector.includes("typed-svg")),"sole meaningful icon with aria-label must stay measured");
    console.log("PASS revision 2 "+width+": same ~3.04 ink passes UI 3.0, fails text/value/placeholder 4.5; input border separately UI; companion decorative SVG reason retained");
  }
  if(process.argv.includes("--classification-only")){
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));process.exit(0);
  }
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
  const run = (route, name, timeout = "10000", theme = "dark", width = "390") => new Promise((resolve, reject) => {
    const json = join(out, name + ".json"), started = Date.now();
    const child = spawn(process.execPath, [fileURLToPath(new URL("./gradient-scan-465c.mjs", import.meta.url)),
      `http://127.0.0.1:${server.address().port}`, theme, route, "--all", "--json", json, "--ready-timeout", timeout],
      { env: {...process.env, SCAN_WIDTH:width}, stdio:["ignore","pipe","pipe"] });
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
  // H: actual paired-pixel scanner sees the exact 472-C bad foreground/backing.
  // Restore only a test-page CSS rule, never ThemeToggle/App/index.css.
  for (const width of ["1440", "390"]) {
    quantityBackground = "white";
    const bad = await run("/quote#cart", "quantity-bad-"+width, "10000", "dark", width);
    assert.equal(bad.status,0,bad.log);
    const [red] = JSON.parse(readFileSync(bad.json,"utf8"));
    const quantity = red.rows.filter(r=>r.stepper);
    assert.equal(quantity.length,6);
    assert.ok(quantity.every(r=>r.ratio<4.5 && Math.abs(r.ratio-1.16)<0.08 && !r.occluded),JSON.stringify(quantity));
    assert.ok(red.rows.some(r=>r.control==="input-value"&&r.text==="17"&&r.ratio>=4.5));
    assert.ok(red.rows.some(r=>r.text==="7"&&r.shortText));
    assert.ok(red.rows.some(r=>r.text==="12"&&r.shortText));
    assert.equal(red.coverage.checkboxes,2,JSON.stringify(red.unmeasurable));
    console.log(`PASS F/H dark ${width}: 6 visible stepper rows RED; `+quantity.map(r=>`${r.selector} "${r.text}" ${r.ratio} fg=${r.fg} bg=${r.bg}`).join("; "));
    quantityBackground = "var(--card-paper)";
    const good = await run("/quote#cart", "quantity-restored-"+width, "10000", "dark", width);
    assert.equal(good.status,0,good.log);
    const [green] = JSON.parse(readFileSync(good.json,"utf8"));
    assert.equal(green.coverage.stepper,6);
    assert.ok(green.rows.filter(r=>r.stepper).every(r=>r.ratio>=4.5));
    console.log(`PASS H dark ${width}: restored test backing; 6 stepper rows GREEN; ratios=`+green.rows.filter(r=>r.stepper).map(r=>r.ratio));
    quantityBackground = "white";
    const light = await run("/quote#cart", "quantity-light-"+width, "10000", "light", width);
    assert.equal(light.status,0,light.log);
    const [bright] = JSON.parse(readFileSync(light.json,"utf8"));
    assert.ok(bright.rows.filter(r=>r.stepper).every(r=>r.ratio>=4.5));
    console.log(`PASS F light ${width}: original white backing still GREEN; 6 stepper rows, input value, checkbox and short-text coverage`);
  }
  cartMode = "missing";
  const missing = await run("/quote#cart", "missing-cart", "1800");
  assert.equal(missing.status,2,missing.log);
  assert.match(missing.log,/ยังไม่ได้ตรวจ \(หน้าโหลดไม่จบ: \/quote#cart\)/);
  assert.equal(existsSync(missing.json),false,"No empty or partial cart may produce a passing result");
  console.log("PASS G missing seeded cart row: exit 2; "+missing.log.trim());
  cartMode = "complete";
  const portfolio = await run("/portfolio", "portfolio");
  assert.equal(portfolio.status,0,portfolio.log);
  const [gallery] = JSON.parse(readFileSync(portfolio.json,"utf8"));
  assert.equal(gallery.readiness.gallery,2);
  assert.equal(gallery.readiness.responses["/api/catalog"],undefined);
  console.log("PASS standalone portfolio: its own gallery API and two photos; no catalogue-hook requirement");
  const refresh = await run("/refresh-control","refresh");
  assert.equal(refresh.status,0,refresh.log);
  const [refreshed] = JSON.parse(readFileSync(refresh.json,"utf8"));
  assert.equal(refreshed.capture.settled.pending,0);
  assert.equal(refreshed.capture.settled.responses["/api/refresh-control"],200);
  assert.ok(refreshed.rows.some(r=>r.text==="UNCHANGED REFRESH CONTROL"&&r.ratio>=4.5));
  console.log("PASS capture-time refresh: consumed successful response, unchanged captured DOM, pending=0");
  const changed = await run("/refresh-change","refresh-change");
  assert.equal(changed.status,2,changed.log);
  assert.match(changed.log,/ยังไม่ได้ตรวจ.*data changed during pixel capture/);
  assert.equal(existsSync(changed.json),false);
  console.log("PASS capture-time content mutation: exit 2, no stale pixel result");
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
