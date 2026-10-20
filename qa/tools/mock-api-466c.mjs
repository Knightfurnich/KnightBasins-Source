import http from "node:http";
// 471-R option B: public read-only data AND /api/uploads media need the proxy.
// Cache successful immutable response bytes for this process's three rounds;
// never cache failures or silently substitute an empty catalogue/gallery.
const cache = new Map();
const inflight = new Map();
async function publicGet(url) {
  if (cache.has(url)) return { ...cache.get(url), source: "cache", attempts: [] };
  if (inflight.has(url)) return { ...await inflight.get(url), source: "coalesced" };
  const task = (async () => {
    const attempts = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      const started = performance.now();
      try {
        const response = await fetch("https://knightbasins.com" + url, { signal: AbortSignal.timeout(5000) });
        const body = Buffer.from(await response.arrayBuffer());
        attempts.push({ attempt, status: response.status, ms: +(performance.now()-started).toFixed(1) });
        const result = {status:response.status,body,type:response.headers.get("content-type")??"application/octet-stream",attempts,source:"upstream"};
        if (response.ok) { cache.set(url,result); return result; }
        if (response.status < 500 && response.status !== 429) return result;
      } catch {
        attempts.push({attempt,status:0,ms:+(performance.now()-started).toFixed(1)});
      }
    }
    return {status:502,body:Buffer.from('{"error":"Public preview upstream unavailable after 3 attempts"}'),type:"application/json",attempts,source:"upstream-failed"};
  })();
  inflight.set(url,task);
  try { return await task; } finally { inflight.delete(url); }
}
// job 466-C: POST /api/sketch/analyze answers with a fixed TEST fixture (no real customer data, nothing is sent anywhere).
const fixture = {
  items: [{
    shape: "L", confidence: "high", notes: "ตัวอย่างข้อมูลทดสอบ — ตรวจสอบขนาดที่อ่านได้", runAMm: 2400, depthMm: 600, workpieceCount: 2,
    workpieces: [
      { id: "w1", label: "ชิ้นงาน 1", shape: "L", dimensionsSummary: "2400 × 600 mm", notes: "",
        panels: [{ panelIndex: 0, label: "แผ่นหลัก", lengthMm: 2400, depthMm: 600 }, { panelIndex: 1, label: "แผ่นต่อ", lengthMm: 1200, depthMm: 600 }],
        edges: [{ side: "top", status: "wall-flush", note: "" }, { side: "front", status: "open-edge", note: "" }, { side: "left", status: "upstand", note: "" }],
        cutouts: [{ type: "basin", description: "อ่างล้างหน้ากลางแผ่น", count: 1 }] },
      { id: "w2", label: "ชิ้นงาน 2", shape: "I", dimensionsSummary: "1800 × 600 mm", notes: "",
        panels: [{ panelIndex: 0, label: "แผ่นหลัก", lengthMm: 1800, depthMm: 600 }],
        edges: [{ side: "top", status: "wall-flush", note: "" }],
        cutouts: [] },
    ],
  }],
};
http.createServer(async (req, res) => {
  const started = performance.now();
  const path = new URL(req.url, "http://fixture.invalid").pathname;
  let evidence = {};
  let logged = false;
  const log = status => {
    if(logged)return; logged=true;
    console.log(`${req.method} ${path} ${status} ${(performance.now() - started).toFixed(1)}ms ${JSON.stringify(evidence)}`);
  };
  res.on("finish", () => log(res.statusCode));
  res.on("close", () => { if(!res.writableFinished){evidence={...evidence,error:"client-aborted"};log(499);} });
  if (req.method === "POST" && req.url.startsWith("/api/sketch/analyze")) {
    req.resume();
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify(fixture));
  }
  if (req.method !== "GET") { req.resume(); res.writeHead(405); return res.end("{}"); }
  if (!path.startsWith("/api/") || req.url.startsWith("//") || req.url.includes("\\")) {
    res.writeHead(404); return res.end("{}");
  }
  const result = await publicGet(req.url);
  evidence = {source:result.source,attempts:result.attempts};
  res.writeHead(result.status, { "content-type": result.type });
  res.end(result.body);
}).listen(Number(process.env.CONTRAST_API_PORT ?? 8080), "127.0.0.1");
