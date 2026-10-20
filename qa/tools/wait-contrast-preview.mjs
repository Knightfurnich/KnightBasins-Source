// No production dependency. Fail closed and print both service logs on deadline.
import { readFileSync } from "node:fs";
const base = process.argv[2] ?? "http://127.0.0.1:5173";
const deadline = Date.now() + Number(process.env.PREVIEW_READY_TIMEOUT_MS ?? 30000);
let missing = ["/", "/api/catalog", "/api/portfolio"];
while (Date.now() < deadline) {
  missing = (await Promise.all(["/", "/api/catalog", "/api/portfolio"].map(async path => {
    try {
      const response = await fetch(base + path, { signal: AbortSignal.timeout(1500) });
      if (response.status !== 200) return path;
      if (path === "/") { if (!(await response.text()).includes("<html")) return path; }
      else {
        const data = await response.json();
        if (!Array.isArray(path.endsWith("catalog") ? data.basins : data.items)) return path;
      }
      return null;
    } catch { return path; }
  }))).filter(Boolean);
  if (!missing.length) { console.log("READY: / /api/catalog /api/portfolio (HTTP 200, bodies consumed)"); process.exit(0); }
  await new Promise(resolve => setTimeout(resolve, 200));
}
for (const path of missing) console.error(`ยังไม่ได้ตรวจ (หน้าโหลดไม่จบ: ${path})`);
for (const path of ["/tmp/contrast-api.log", "/tmp/contrast-web.log"]) {
  try { console.error(path + "\n" + readFileSync(path, "utf8")); } catch { console.error(path + ": unavailable"); }
}
process.exit(2);
