// Real Chromium controls: covered text, partial overlays, and fixed text must
// remain distinct from genuinely low-contrast visible glyphs.
import http from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const out = mkdtempSync(join(tmpdir(), "contrast-occlusion-"));
const server = http.createServer((req, res) => {
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
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
