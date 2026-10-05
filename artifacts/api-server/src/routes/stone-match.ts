/**
 * ใบงาน 266 (บอย / Freebuff) — เส้นทาง API "จับคู่สีหินจากภาพ" สำหรับแอดมิน.
 *
 * POST /api/admin/stone-match
 *   รับภาพ 1 ภาพ (multipart field "file"/"image" หรือ JSON { imageBase64, mimeType }) แล้วเรียก
 *   suggestStonesForPhoto() จาก lib/stone-matcher.ts — ห้ามแก้ไฟล์นั้น (คงสภาพตามใบงาน 248:
 *   temperature 0 + env-driven model ต้องอยู่ครบทุกบรรทัด)
 *
 *   การป้องกัน (เรียงลำดับ): createAdminAuthMiddleware → 401 ถ้าไม่มี/คุกกี้หมดอายุ
 *     · createRateLimiter({ name: "admin-stone-match", max: 10, windowMs: 60_000 }) → 429
 *     · requireAdminPermission("installed-stones", "view") → 403 ถ้าไม่มีสิทธิ์
 *   รูปแบบไฟล์: เฉพาะ image/jpeg · image/png · image/webp (พร้อมตรวจลายเซ็นไฟล์จริง) → 400
 *   ขนาดภาพ: ≤ 8 MB → 413
 *   matcher ปิด (ไม่มี model/credentials) → HTTP 200 + ข้อความไทย — ห้าม 500
 *   ไม่คืน path ไฟล์ · ชื่อไฟล์ต้นทาง · ค่า env · คีย์ · ชื่อโมเดล กลับไปยังผู้ใช้
 *
 * ทำไมต้องแบ่งเรียกเป็นชุด (วัดจริง 4 ต.ค. 69): ภาพ slab ทั้งแคตตาล็อกหนักรวม ~59 MB
 * (79 รหัส × เฉลี่ย 771 KB) เกินเพดาน payload ของ Vertex ต่อ 1 ครั้งอย่างมาก จึงจัดชุด
 * (≤12 ภาพ/ชุด และ ≤10 MB ต่อชุด) เรียก suggestStonesForPhoto() แบบขนานต่อรอบ แล้วนำผู้ชนะ
 * ของทุกชุดมาเรียกนัดชิงเพื่อจัดอันดับข้ามชุด — ผลลัพธ์ที่คืนคือนัดชิงเท่านั้น ไม่มีการเดาสี
 * และไม่มีการสร้างรหัส/ชื่อสีขึ้นเองฝั่งเซิร์ฟเวอร์ (ทุก code ต้องมาจาก candidate จริง)
 */
import { Router, type NextFunction, type Request, type Response } from "express";
import { asc, eq } from "drizzle-orm";
import { db, installedStonePrices, sheetStonePrices } from "@workspace/db";
import { createAdminAuthMiddleware, requireAdminPermission } from "../middlewares/admin-auth.ts";
import { createRateLimiter } from "../lib/rate-limit.ts";
import { readMultipartForm } from "../lib/image-upload.ts";
import { slabImageUrl as centralSlabImageUrl } from "../lib/catalog-media.ts";
import {
  suggestStonesForPhoto,
  type StoneMatchCandidate,
  type StoneMatchResult,
} from "../lib/stone-matcher.ts";

/** เพดานของใบงาน: ภาพเดียวต้องไม่เกิน 8 MB — เกินต้องตอบ 413 (ไม่ใช่ 500). */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** ชุดต่อ 1 ครั้ง: น้อยกว่าเพดาน payload ของ Vertex อย่างปลอดภัย (base64 บวม 4/3). */
const MAX_BATCH_IMAGES = 12;
const MAX_BATCH_BYTES = 10 * 1024 * 1024;
/** จำนวนรอบแข่งสูงสุด (79 สี → รอบ 1 ได้ผู้ชนะ ≤21 → รอบ 2 → นัดชิง): กันลูปไม่รู้จบ. */
const MAX_TOURNAMENT_ROUNDS = 4;

/** ตรวจภาพอ้างอิง slab ด้วย HEAD ก่อนส่งเข้าชุด — รูปตาย (404) ต้องไม่ทำให้ทั้งเคสพัง (ตามสคริปต์ยิงจริงของเดวิด ใบ 248). */
const SLAB_CHECK_TTL_MS = 15 * 60 * 1000;
const SLAB_CHECK_TIMEOUT_MS = 8_000;
const SLAB_CHECK_CONCURRENCY = 6;
const MAX_SLAB_IMAGE_BYTES = 5 * 1024 * 1024;
const ESTIMATED_SLAB_BYTES = 800 * 1024;

const NOT_CONFIGURED_MESSAGE = "ระบบจับคู่สีหินยังไม่พร้อมใช้งาน กรุณาแจ้งผู้ดูแลระบบ";
const NO_CANDIDATES_MESSAGE = "ไม่พบสีหินในระบบสำหรับใช้เปรียบเทียบ";
const MATCH_FAILED_FALLBACK_MESSAGE = "ไม่สามารถจับคู่สีหินจากภาพได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง";
const IMAGE_TOO_LARGE_MESSAGE = "ภาพมีขนาดใหญ่เกิน 8 MB กรุณาลดขนาดภาพแล้วลองใหม่";
const INVALID_IMAGE_MESSAGE = "ไฟล์ที่อัปโหลดไม่ใช่ภาพ JPG, PNG หรือ WEBP กรุณาเลือกไฟล์ภาพใหม่";
const MISSING_IMAGE_MESSAGE = "ไม่พบไฟล์ภาพในคำขอ กรุณาเลือกภาพก่อนกดเปรียบเทียบ";

/** ข้อผิดพลาดที่เกิดจากคำขอของผู้ใช้ — ตอบด้วยเลขสถานะตามใบงาน ไม่ใช่ 500. */
class StoneMatchRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "StoneMatchRequestError";
    this.status = status;
    this.code = code;
  }
}

export type StoneMatchDeps = {
  /** เรียกตัวจับคู่จริง — เทสต์ฉีกตัวนี้แทนเพื่อไม่ให้ยิง Vertex จริง. */
  matchPhoto: (
    imageBuffer: Buffer,
    mimeType: string,
    candidates: readonly StoneMatchCandidate[],
  ) => Promise<StoneMatchResult>;
  /** โหลดรายชื่อสีหินที่ใช้เทียบ (สี active จากแคตตาล็อกฐานข้อมูล). */
  loadCandidates: () => Promise<StoneMatchCandidate[]>;
};

type PreparedCandidate = StoneMatchCandidate & {
  /** ขนาดไฟล์ภาพอ้างอิง (bytes) สำหรับจัดชุด — 0 เมื่อไม่มีภาพอ้างอิง. */
  slabBytes: number;
};

function normalizeImageMimeType(value: string | null | undefined): string | null {
  const mimeType = value?.split(";")[0]?.trim().toLowerCase();
  if (mimeType === "image/jpg") return "image/jpeg";
  return mimeType && ALLOWED_IMAGE_MIME_TYPES.has(mimeType) ? mimeType : null;
}

/** ตรวจว่าไฟล์เป็นภาพจริงตามชนิดที่ประกาศ — กัน JSON/base64 ที่เป็นข้อมูลอย่างอื่น. */
function hasImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12
      && buffer.subarray(0, 4).toString("ascii") === "RIFF"
      && buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

/** ดึงภาพจากคำขอ: multipart (เส้นทางที่หน้าแอดมินใช้) หรือ JSON { imageBase64, mimeType }. */
async function extractImage(req: Request): Promise<{ buffer: Buffer; mimeType: string }> {
  const contentType = String(req.headers["content-type"] ?? "");
  if (contentType.toLowerCase().startsWith("multipart/form-data")) {
    let media: Awaited<ReturnType<typeof readMultipartForm>>["media"];
    try {
      ({ media } = await readMultipartForm(req, "image", { maxFiles: 1 }));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      if (/too large/i.test(detail)) {
        throw new StoneMatchRequestError(413, "image-too-large", IMAGE_TOO_LARGE_MESSAGE);
      }
      throw new StoneMatchRequestError(400, "invalid-image", INVALID_IMAGE_MESSAGE);
    }
    const file = media[0];
    if (!file) throw new StoneMatchRequestError(400, "invalid-image", MISSING_IMAGE_MESSAGE);
    const mimeType = normalizeImageMimeType(file.contentType);
    if (!mimeType) throw new StoneMatchRequestError(400, "invalid-image", INVALID_IMAGE_MESSAGE);
    if (file.buffer.length > MAX_IMAGE_BYTES) {
      throw new StoneMatchRequestError(413, "image-too-large", IMAGE_TOO_LARGE_MESSAGE);
    }
    if (!hasImageSignature(file.buffer, mimeType)) {
      throw new StoneMatchRequestError(400, "invalid-image", INVALID_IMAGE_MESSAGE);
    }
    return { buffer: file.buffer, mimeType };
  }

  const body = req.body as { imageBase64?: unknown; mimeType?: unknown } | undefined;
  if (!body || typeof body !== "object") {
    throw new StoneMatchRequestError(400, "missing-image", MISSING_IMAGE_MESSAGE);
  }
  if (typeof body.imageBase64 !== "string" || !body.imageBase64.trim()) {
    throw new StoneMatchRequestError(400, "missing-image", MISSING_IMAGE_MESSAGE);
  }
  const mimeType = normalizeImageMimeType(typeof body.mimeType === "string" ? body.mimeType : null);
  if (!mimeType) throw new StoneMatchRequestError(400, "invalid-image", INVALID_IMAGE_MESSAGE);
  const buffer = Buffer.from(body.imageBase64, "base64");
  if (buffer.length === 0) throw new StoneMatchRequestError(400, "invalid-image", INVALID_IMAGE_MESSAGE);
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new StoneMatchRequestError(413, "image-too-large", IMAGE_TOO_LARGE_MESSAGE);
  }
  if (!hasImageSignature(buffer, mimeType)) {
    throw new StoneMatchRequestError(400, "invalid-image", INVALID_IMAGE_MESSAGE);
  }
  return { buffer, mimeType };
}

// ---------------------------------------------------------------------------
// ภาพอ้างอิง slab: ที่อยู่ต้องผ่าน allowlist เดียวกับตัวจับคู่ (matcher จะ throw
// กับ URL นอกกฎ) และควรตอบ 200 ก่อนส่งเข้าชุด กันรูปตายทำให้ทั้งเคสล้ม
// ---------------------------------------------------------------------------

const CENTRAL_SLAB_ORIGIN = new URL(centralSlabImageUrl("_probe")).origin;
const CENTRAL_SLAB_PATH_PREFIX = "/kb/images/slab/";

type SlabProbe = { ok: boolean; bytes: number; checkedAt: number };
const slabProbeCache = new Map<string, SlabProbe>();

function isAllowedSlabUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:"
      && url.origin === CENTRAL_SLAB_ORIGIN
      && url.pathname.startsWith(CENTRAL_SLAB_PATH_PREFIX)
      && !url.username
      && !url.password
    );
  } catch {
    return false;
  }
}

function centralSlabUrlFor(code: string): string {
  return centralSlabImageUrl(code);
}

async function probeSlabImage(url: string): Promise<SlabProbe> {
  const cached = slabProbeCache.get(url);
  const now = Date.now();
  if (cached && now - cached.checkedAt < SLAB_CHECK_TTL_MS) return cached;

  let probe: SlabProbe;
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "error",
      signal: AbortSignal.timeout(SLAB_CHECK_TIMEOUT_MS),
    });
    const length = Number(response.headers.get("content-length"));
    const bytes = Number.isFinite(length) && length > 0 ? length : ESTIMATED_SLAB_BYTES;
    probe = { ok: response.ok && bytes <= MAX_SLAB_IMAGE_BYTES, bytes, checkedAt: now };
  } catch {
    // เครือข่ายขัดข้องชั่วคราว: อย่าตัดสินว่าภาพตาย — ให้ตัวจับคู่ตัดสินเองตามกลไกเดิม
    // และอย่าจำผลนี้นาน (ครบ TTL จะลองใหม่)
    probe = { ok: true, bytes: ESTIMATED_SLAB_BYTES, checkedAt: now - SLAB_CHECK_TTL_MS + 60_000 };
  }
  slabProbeCache.set(url, probe);
  return probe;
}

async function mapWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex++];
      if (item !== undefined) await task(item);
    }
  });
  await Promise.all(workers);
}

/** เตรียม candidate ต่อคำขอ: ตัด URL นอก allowlist + ยืนยันว่าภาพอ้างอิงโหลดได้ (HEAD cache 15 นาที). */
async function prepareCandidates(candidates: readonly StoneMatchCandidate[]): Promise<PreparedCandidate[]> {
  const prepared: PreparedCandidate[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const code = candidate.code?.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const name = candidate.name?.trim() || code;
    const storedUrl = candidate.slabImageUrl?.trim() || null;
    prepared.push({
      code,
      name,
      // URL ที่ matcher จะ reject ต้องไม่ถูกส่งไปตั้งแต่แรก — เก็บสีไว้เทียบได้ (แบบไม่มีภาพอ้างอิง)
      slabImageUrl: storedUrl && isAllowedSlabUrl(storedUrl) ? storedUrl : null,
      slabBytes: 0,
    });
  }

  const withUrl = prepared.filter((candidate) => candidate.slabImageUrl !== null);
  await mapWithConcurrency(withUrl, SLAB_CHECK_CONCURRENCY, async (candidate) => {
    const probe = await probeSlabImage(candidate.slabImageUrl!);
    if (probe.ok) {
      candidate.slabBytes = probe.bytes;
    } else {
      // ภาพยังอยู่ในตาราง แต่โหลดไม่ได้จริง: สีนี้ยังถูกเสนอได้ (allowed list) แต่ไม่มีภาพอ้างอิงให้โมเดลเทียบ
      candidate.slabImageUrl = null;
      candidate.slabBytes = 0;
    }
  });
  return prepared;
}

// ---------------------------------------------------------------------------
// การแข่งขันเป็นชุด: ทุกภาพอ้างอิงรวมกันเกินเพดาน payload ต่อ 1 ครั้งของ Vertex
// จึงจับชุด ≤12 ภาพ/≤10 MB แล้วเอาผู้ชนะแต่ละชุดมาชิงกันรอบถัดไป → อันดับสุดท้าย
// ได้จากการเรียกนัดชิงครั้งเดียว (ห้ามเอาอันดับข้ามชุดมาเทียบกันตรง ๆ — เทียบกันไม่ได้)
// ---------------------------------------------------------------------------

type ImageInput = { buffer: Buffer; mimeType: string };

function packBatches(candidates: readonly PreparedCandidate[]): PreparedCandidate[][] {
  const withImage = candidates.filter((candidate) => candidate.slabImageUrl !== null);
  const withoutImage = candidates.filter((candidate) => candidate.slabImageUrl === null);

  const batches: PreparedCandidate[][] = [];
  let current: PreparedCandidate[] = [];
  let currentBytes = 0;
  const flush = () => {
    if (current.length > 0) batches.push(current);
    current = [];
    currentBytes = 0;
  };
  for (const candidate of withImage) {
    if (
      current.length > 0
      && (current.length >= MAX_BATCH_IMAGES || currentBytes + candidate.slabBytes > MAX_BATCH_BYTES)
    ) {
      flush();
    }
    current.push(candidate);
    currentBytes += candidate.slabBytes;
  }
  flush();

  if (batches.length === 0) {
    // ไม่มีสีไหนมีภาพอ้างอิงใช้ได้เลย — เทียบแบบมีชุดเดียว (โมเดลจะให้เหตุผลตามชื่อสี)
    return withoutImage.length > 0 ? [withoutImage] : [];
  }
  // สีที่ไม่มีภาพอ้างอิง: กระจายแบบ round-robin ทุกชุด (ไม่ซ้ำกันหลายชุด) เพื่อให้ทุกสีได้โอกาสถูกเสนอ
  withoutImage.forEach((candidate, index) => {
    batches[index % batches.length]!.push(candidate);
  });
  return batches;
}

async function runMatchTournament(
  deps: StoneMatchDeps,
  image: ImageInput,
  candidates: readonly PreparedCandidate[],
): Promise<StoneMatchResult> {
  let current: PreparedCandidate[] = [...candidates];
  for (let round = 0; round < MAX_TOURNAMENT_ROUNDS; round += 1) {
    const batches = packBatches(current);
    if (batches.length === 0) return { status: "ok", matches: [] };
    if (batches.length === 1) {
      return await deps.matchPhoto(image.buffer, image.mimeType, batches[0]);
    }

    const results = await Promise.all(
      batches.map((batch) => deps.matchPhoto(image.buffer, image.mimeType, batch)),
    );
    // ชุดใด status ไม่ใช่ ok (matcher ปิด/ยิงพัง) → ส่งต่อสถานะนั้นทั้งเคส ห้ามเก๊ผล
    const notOk = results.find((result) => result.status !== "ok");
    if (notOk) return notOk;

    const byCode = new Map(current.map((candidate) => [candidate.code, candidate]));
    const winners: PreparedCandidate[] = [];
    const seen = new Set<string>();
    for (const result of results) {
      if (result.status !== "ok") continue;
      for (const match of result.matches) {
        const candidate = byCode.get(match.code);
        if (candidate && !seen.has(candidate.code)) {
          seen.add(candidate.code);
          winners.push(candidate);
        }
      }
    }
    if (winners.length === 0) return { status: "ok", matches: [] };
    current = winners;
  }
  // ถึงเพดานรอบโดยยังไม่ถึงนัดชิง: ไม่แต่งอันดับเอง — คืนว่างตามจริง (ไม่เดาสี)
  return { status: "ok", matches: [] };
}

async function handleStoneMatch(
  req: Request,
  res: Response,
  deps: StoneMatchDeps,
  next: NextFunction,
): Promise<void> {
  try {
    const image = await extractImage(req);
    const loaded = await deps.loadCandidates();
    const candidates = loaded.filter((candidate) => typeof candidate?.code === "string" && candidate.code.trim());
    if (candidates.length === 0) {
      res.status(200).json({ ok: false, code: "no-candidates", message: NO_CANDIDATES_MESSAGE });
      return;
    }

    const prepared = await prepareCandidates(candidates);
    const result = await runMatchTournament(deps, image, prepared);

    if (result.status === "not-configured") {
      // ยังไม่มี model/credentials — ระบบ "ปิดอยู่" ไม่ใช่พัง: ต้อง 200 + ข้อความไทย ห้าม 500
      res.status(200).json({ ok: false, code: "not-configured", message: NOT_CONFIGURED_MESSAGE });
      return;
    }
    if (result.status === "failed") {
      // ตัวจับคู่ส่งข้อความไทยคงที่มาให้แล้ว (ไม่มีรายละเอียดผู้ให้บริการปนอยู่)
      res.status(200).json({
        ok: false,
        code: "failed",
        message: result.message.trim() || MATCH_FAILED_FALLBACK_MESSAGE,
      });
      return;
    }

    const byCode = new Map(prepared.map((candidate) => [candidate.code, candidate]));
    res.status(200).json({
      ok: true,
      matches: result.matches.map((match) => ({
        code: match.code,
        name: match.name,
        reason: match.reason,
        // contract ของ suggestStonesForPhoto (ใบงาน 193/248 ห้ามแก้) ไม่มีคะแนนความมั่นใจ
        // และห้ามแต่งตัวเลขขึ้นเอง (กติกา "รหัสสี = ตัวตนของสี" / ห้ามเดา) — คืน null ตรง ๆ
        confidence: null,
        hasSlabReference: Boolean(byCode.get(match.code)?.slabImageUrl),
      })),
      dataAsOf: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof StoneMatchRequestError) {
      res.status(error.status).json({ ok: false, code: error.code, message: error.message });
      return;
    }
    next(error);
  }
}

/** โหลดสีหินทั้งหมดที่ active อยู่ (ติดตั้ง + ขายแผ่น) — ห้ามเดาสี: ทุก code มาจากแถวจริง. */
async function loadCatalogCandidates(): Promise<StoneMatchCandidate[]> {
  const [installed, sheet] = await Promise.all([
    db.select().from(installedStonePrices).where(eq(installedStonePrices.active, true))
      .orderBy(asc(installedStonePrices.sortOrder), asc(installedStonePrices.id)),
    db.select().from(sheetStonePrices).where(eq(sheetStonePrices.active, true))
      .orderBy(asc(sheetStonePrices.sortOrder), asc(sheetStonePrices.id)),
  ]);

  const byCode = new Map<string, StoneMatchCandidate>();
  for (const row of [...installed, ...sheet]) {
    const code = row.code?.trim();
    if (!code || byCode.has(code)) continue;
    const stored = row.slabImageUrl?.trim() || null;
    byCode.set(code, {
      code,
      name: row.name?.trim() || code,
      // ภาพอ้างอิง: ค่าที่บันทึกไว้ถ้าผ่าน allowlist เดียวกับ matcher มิฉะนั้นใช้ภาพกลางของแคตตาล็อก
      slabImageUrl: stored && isAllowedSlabUrl(stored) ? stored : centralSlabUrlFor(code),
    });
  }
  return [...byCode.values()];
}

export function createStoneMatchRouter(dependencies: Partial<StoneMatchDeps> = {}) {
  const deps: StoneMatchDeps = {
    matchPhoto: suggestStonesForPhoto,
    loadCandidates: loadCatalogCandidates,
    ...dependencies,
  };
  const router = Router();
  const stoneMatchRateLimit = createRateLimiter({
    name: "admin-stone-match",
    max: 10,
    windowMs: 60 * 1000,
  });

  router.post(
    "/admin/stone-match",
    createAdminAuthMiddleware(),
    stoneMatchRateLimit,
    requireAdminPermission("installed-stones", "view"),
    (req, res, next) => {
      void handleStoneMatch(req, res, deps, next);
    },
  );
  return router;
}

/** ตัวที่แอปใช้จริง (deps จริง: แคตตาล็อกฐานข้อมูล + suggestStonesForPhoto). */
export const stoneMatchRouter = createStoneMatchRouter();

export default stoneMatchRouter;
