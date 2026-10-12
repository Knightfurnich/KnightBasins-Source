import http from "node:http";
// read-only pass-through of public GET /api/* to production (no writes, no DB access of our own).
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
  if (req.method === "POST" && req.url.startsWith("/api/sketch/analyze")) {
    req.resume();
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify(fixture));
  }
  if (req.method !== "GET") { req.resume(); res.writeHead(405); return res.end("{}"); }
  try {
    const r = await fetch("https://knightbasins.com" + req.url);
    res.writeHead(r.status, { "content-type": r.headers.get("content-type") ?? "application/json" });
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch { res.writeHead(502); res.end("{}"); }
}).listen(8080, "127.0.0.1");
