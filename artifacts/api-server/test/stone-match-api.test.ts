/**
 * ใบงาน 266 (บอย) — เทสต์เส้นทาง POST /api/admin/stone-match
 *
 * ครบตามข้อ (ก)-(จ) ของใบงาน:
 *   (ก) ไม่มีคุกกี้แอดมิน → 401 / มีคุกกี้แต่ไม่มีสิทธิ์ installed-stones → 403 (และห้ามเรียก AI)
 *   (ข) ไฟล์ไม่ใช่ภาพ → 400
 *   (ค) ภาพใหญ่เกิน 8 MB → 413
 *   (ง) matcher ปิด (ไม่มี model/credentials) → 200 + ข้อความไทย (ไม่ใช่ 500)
 *   (จ) เคสสำเร็จ (multipart จริงแบบที่หน้าแอดมินส่ง) → โครงสร้าง matches ถูกต้อง
 * ทุกเคสฉีก dependencies (matcher/loadCandidates) ออก — ห้ามยิง Vertex จริงในเทสต์
 *
 * ยังมีเคสเสริม: rate limit 10 ครั้ง/นาที → 429 ที่คำขอที่ 11
 */
import assert from "node:assert/strict";
import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import http from "node:http";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { clearRateLimitStore } from "../src/lib/rate-limit.ts";

type StoneMatchModule = typeof import("../src/routes/stone-match.ts");
type StoneMatchRouterDeps = Parameters<StoneMatchModule["createStoneMatchRouter"]>[0];

const ADMIN_SESSION_COOKIE = "knight_admin_session";
const ORIGINAL_ENV = {
  SESSION_SECRET: process.env["SESSION_SECRET"],
  DATABASE_URL: process.env["DATABASE_URL"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  ADMIN_PERMISSIONS: process.env["ADMIN_PERMISSIONS"],
};

let stoneMatchModule: StoneMatchModule;

before(async () => {
  process.env["SESSION_SECRET"] = "stone-match-api-test-session-secret";
  // กันเผลอต่อฐานข้อมูลจริง: โครงสร้างตารางเท่านั้นที่ถูกโหลด (pg ไม่ connect จนกว่าจะ query)
  process.env["DATABASE_URL"] = "postgres://stone-match-api-test@127.0.0.1:5432/stone-match-api-test";
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
  stoneMatchModule = await import("../src/routes/stone-match.ts");
});

after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  clearRateLimitStore();
});

afterEach(() => {
  delete process.env["ADMIN_PERMISSIONS"];
  delete process.env["ADMIN_ROLE"];
});

type RunningServer = { url: string; close: () => Promise<void> };

function listen(app: Express): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });
}

/** แอปจำลอง: body parser + cookie parser + เส้นทางจริงที่ mount ใต้ /api เหมือนแอปจริง */
async function startServer(deps: StoneMatchRouterDeps = {}): Promise<RunningServer> {
  const app = express();
  // แอปจริงจำกัด JSON ที่ 256kb (app.ts) — เคส 413 ของใบงานทดสอบการ์ด 8MB ในตัวเส้นทางเอง
  // จึงต้องยก limit ให้ body ขนาด 8MB+ ถึงมือ handler ได้
  app.use(express.json({ limit: "16mb" }));
  app.use(cookieParser());
  app.use("/api", stoneMatchModule.createStoneMatchRouter(deps));
  const server = await listen(app);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function adminCookie() {
  return { Cookie: `${ADMIN_SESSION_COOKIE}=${createAdminToken()}` };
}

/** body multipart/form-data จริง ๆ แบบที่หน้าแอดมินส่ง (field "file") */
function multipartImage(contentType: string, content: Buffer, filename = "room.jpg") {
  const boundary = "----stoneMatchTestBoundary";
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    body: Buffer.concat([head, content, tail]),
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
  };
}

/** ลายเซ็น JPEG จริง + ข้อมูลส่วนที่เหลือ (ตรวจผ่าน hasFileSignature ของ image-upload) */
function fakeJpeg(sizeBytes = 2048): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(Math.max(0, sizeBytes - 4), 0x42)]);
}

type MatchSpy = {
  calls: Array<{ mimeType: string; codes: string[] }>;
  matcher: NonNullable<StoneMatchRouterDeps["matchPhoto"]>;
};

function matchSpy(result: import("../src/lib/stone-matcher.ts").StoneMatchResult): MatchSpy {
  const calls: MatchSpy["calls"] = [];
  return {
    calls,
    matcher: async (_buffer, mimeType, candidates) => {
      calls.push({ mimeType, codes: candidates.map((candidate) => candidate.code) });
      return result;
    },
  };
}

const EMPTY_CANDIDATES_LOADER: NonNullable<StoneMatchRouterDeps["loadCandidates"]> = async () => [
  { code: "KZ802", name: "Kenz802 White", slabImageUrl: null },
  { code: "BW010", name: "Bright White", slabImageUrl: null },
];

describe("POST /api/admin/stone-match", () => {
  it("(ก) ไม่มีคุกกี้แอดมิน → 401 และไม่เรียก AI", async () => {
    const spy = matchSpy({ status: "ok", matches: [] });
    const server = await startServer({ matchPhoto: spy.matcher, loadCandidates: EMPTY_CANDIDATES_LOADER });
    try {
      const response = await fetch(`${server.url}/api/admin/stone-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: fakeJpeg(64).toString("base64"), mimeType: "image/jpeg" }),
      });
      assert.equal(response.status, 401);
      assert.equal(spy.calls.length, 0, "ห้ามเรียก AI เมื่อไม่มีสิทธิ์");
    } finally {
      await server.close();
    }
  });

  it("(ก) มีคุกกี้แต่ไม่มีสิทธิ์ installed-stones → 403 และไม่เรียก AI", async () => {
    // ADMIN_ROLE=viewer เพื่อให้ ADMIN_PERMISSIONS มีผล (owner ได้สิทธิ์ครบทุกเมนูโดยไม่สน env)
    process.env["ADMIN_ROLE"] = "viewer";
    process.env["ADMIN_PERMISSIONS"] = "leads";
    const spy = matchSpy({ status: "ok", matches: [] });
    const server = await startServer({ matchPhoto: spy.matcher, loadCandidates: EMPTY_CANDIDATES_LOADER });
    try {
      const response = await fetch(`${server.url}/api/admin/stone-match`, {
        method: "POST",
        headers: { ...adminCookie(), "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: fakeJpeg(64).toString("base64"), mimeType: "image/jpeg" }),
      });
      assert.equal(response.status, 403);
      const payload = await response.json();
      assert.equal(payload.code, "ADMIN_PERMISSION_REQUIRED");
      assert.equal(spy.calls.length, 0, "ห้ามเรียก AI เมื่อไม่มีสิทธิ์");
    } finally {
      await server.close();
    }
  });

  it("(ข) ไฟล์ไม่ใช่ภาพ → 400", async () => {
    const spy = matchSpy({ status: "ok", matches: [] });
    const server = await startServer({ matchPhoto: spy.matcher, loadCandidates: EMPTY_CANDIDATES_LOADER });
    try {
      const response = await fetch(`${server.url}/api/admin/stone-match`, {
        method: "POST",
        headers: { ...adminCookie(), "Content-Type": "application/json" },
        // เป็นข้อความล้วน ๆ ไม่ใช่ภาพ แม้จะประกาศ mimeType เป็นภาพก็ตาม
        body: JSON.stringify({ imageBase64: Buffer.from("not an image at all").toString("base64"), mimeType: "image/jpeg" }),
      });
      assert.equal(response.status, 400);
      const payload = await response.json();
      assert.equal(payload.ok, false);
      assert.equal(spy.calls.length, 0, "ห้ามเรียก AI เมื่อไฟล์ไม่ใช่ภาพ");
    } finally {
      await server.close();
    }
  });

  it("(ค) ภาพใหญ่เกิน 8 MB → 413 พร้อมข้อความไทย", async () => {
    const spy = matchSpy({ status: "ok", matches: [] });
    const server = await startServer({ matchPhoto: spy.matcher, loadCandidates: EMPTY_CANDIDATES_LOADER });
    try {
      const oversized = Buffer.alloc(8 * 1024 * 1024 + 1, 0x41);
      const response = await fetch(`${server.url}/api/admin/stone-match`, {
        method: "POST",
        headers: { ...adminCookie(), "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: oversized.toString("base64"), mimeType: "image/jpeg" }),
      });
      assert.equal(response.status, 413);
      const payload = await response.json();
      assert.equal(payload.ok, false);
      assert.match(payload.message, /8 MB/);
      assert.equal(spy.calls.length, 0, "ห้ามเรียก AI เมื่อภาพใหญ่เกินเพดาน");
    } finally {
      await server.close();
    }
  });

  it("(ง) matcher ปิด (ไม่มี model/credentials) → 200 + ข้อความไทย ไม่ใช่ 500", async () => {
    const spy = matchSpy({ status: "not-configured" });
    const server = await startServer({ matchPhoto: spy.matcher, loadCandidates: EMPTY_CANDIDATES_LOADER });
    try {
      const response = await fetch(`${server.url}/api/admin/stone-match`, {
        method: "POST",
        headers: { ...adminCookie(), "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: fakeJpeg(128).toString("base64"), mimeType: "image/jpeg" }),
      });
      assert.equal(response.status, 200, "ระบบปิดอยู่ต้องเป็น 200 ห้าม 500");
      const payload = await response.json();
      assert.equal(payload.ok, false);
      assert.equal(payload.code, "not-configured");
      assert.match(payload.message, /ยังไม่พร้อมใช้งาน/);
      assert.equal(spy.calls.length, 1);
    } finally {
      await server.close();
    }
  });

  it("(จ) เคสสำเร็จ (multipart) → โครงสร้าง matches ถูกต้อง ครบ code/name/reason/confidence", async () => {
    const spy = matchSpy({
      status: "ok",
      matches: [{ code: "KZ802", name: "Kenz802 White", reason: "โทนขาวใกล้เคียงกับภาพห้องมากที่สุด" }],
    });
    const server = await startServer({ matchPhoto: spy.matcher, loadCandidates: EMPTY_CANDIDATES_LOADER });
    try {
      const form = multipartImage("image/jpeg", fakeJpeg());
      const response = await fetch(`${server.url}/api/admin/stone-match`, {
        method: "POST",
        headers: { ...adminCookie(), ...form.headers },
        body: form.body,
      });
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.ok, true);
      assert.equal(payload.matches.length, 1);
      const match = payload.matches[0];
      assert.equal(match.code, "KZ802");
      assert.equal(match.name, "Kenz802 White");
      assert.equal(typeof match.reason, "string");
      // ห้ามแต่งตัวเลขความมั่นใจขึ้นเอง — contract ของ matcher ไม่มีคะแนน ต้องเป็น null
      assert.equal(match.confidence, null);
      assert.equal(match.hasSlabReference, false);
      assert.ok(!Number.isNaN(Date.parse(payload.dataAsOf)), "dataAsOf ต้องเป็นวันเวลาที่อ่านได้");
      // เรียก AI ครั้งเดียว พร้อมรายชื่อสีจาก loadCandidates จริง
      assert.equal(spy.calls.length, 1);
      assert.equal(spy.calls[0]!.mimeType, "image/jpeg");
      assert.deepEqual(spy.calls[0]!.codes, ["KZ802", "BW010"]);
      // ห้ามรั่วข้อมูลอ่อนไหวกลับมา
      const raw = JSON.stringify(payload);
      assert.ok(!/VERTEX|Bearer|private_key|SESSION_SECRET/i.test(raw), "ห้ามคืนค่า env/คีย์ กลับไปยังผู้ใช้");
    } finally {
      await server.close();
    }
  });

  it("(เสริม) rate limit 10 ครั้ง/นาที → คำขอที่ 11 ได้ 429", async () => {
    const spy = matchSpy({ status: "ok", matches: [] });
    const server = await startServer({ matchPhoto: spy.matcher, loadCandidates: EMPTY_CANDIDATES_LOADER });
    try {
      const send = () =>
        fetch(`${server.url}/api/admin/stone-match`, {
          method: "POST",
          headers: { ...adminCookie(), "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: fakeJpeg(64).toString("base64"), mimeType: "image/jpeg" }),
        });
      for (let index = 0; index < 10; index += 1) {
        const response = await send();
        assert.equal(response.status, 200, `คำขอที่ ${index + 1} ต้องผ่าน`);
      }
      const limited = await send();
      assert.equal(limited.status, 429);
      assert.equal(spy.calls.length, 10, "คำขอที่โดน rate limit ห้ามเรียก AI");
    } finally {
      await server.close();
    }
  });
});
