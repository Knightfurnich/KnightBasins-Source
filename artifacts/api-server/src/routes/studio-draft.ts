import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Router, type IRouter, type Response } from "express";

const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Alphanumeric plus "_"/"-" only -- no "/" or "." so a draftKey can never
// escape the drafts directory, whether it was generated here or supplied by
// the client to resume/overwrite an existing draft.
const DRAFT_KEY_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

function draftsDir(): string {
  return path.resolve(process.env["STUDIO_DRAFTS_DIR"] ?? path.resolve(process.cwd(), "uploads/studio_drafts"));
}

/** Returns undefined for any draftKey that fails the charset check or would resolve outside draftsDir(). */
function resolveDraftPath(draftKey: string): string | undefined {
  if (!DRAFT_KEY_PATTERN.test(draftKey)) return undefined;
  const dir = draftsDir();
  const filePath = path.resolve(dir, `${draftKey}.json`);
  if (path.dirname(filePath) !== dir) return undefined;
  return filePath;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

type StudioDraftBody = {
  draftKey?: string;
  shape: string;
  dimensions: Record<string, unknown>;
  stoneColor?: string;
  basinSku?: string;
  basinPlacements?: unknown[];
  edges?: Record<string, unknown>;
  customerInfo?: Record<string, unknown>;
};

type StudioDraftRecord = {
  draftKey: string;
  shape: string;
  dimensions: Record<string, unknown>;
  stoneColor?: string;
  basinSku?: string;
  basinPlacements?: unknown[];
  edges?: Record<string, unknown>;
  customerInfo?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

function parseDraftBody(body: unknown): StudioDraftBody | undefined {
  if (!isPlainObject(body)) return undefined;
  const { draftKey, shape, dimensions, stoneColor, basinSku, basinPlacements, edges, customerInfo } = body;

  if (draftKey !== undefined && typeof draftKey !== "string") return undefined;
  if (typeof shape !== "string" || !shape.trim()) return undefined;
  if (!isPlainObject(dimensions)) return undefined;
  if (stoneColor !== undefined && typeof stoneColor !== "string") return undefined;
  if (basinSku !== undefined && typeof basinSku !== "string") return undefined;
  if (basinPlacements !== undefined && !Array.isArray(basinPlacements)) return undefined;
  if (edges !== undefined && !isPlainObject(edges)) return undefined;
  if (customerInfo !== undefined && !isPlainObject(customerInfo)) return undefined;

  return { draftKey, shape, dimensions, stoneColor, basinSku, basinPlacements, edges, customerInfo };
}

function invalid(res: Response, message: string) {
  return res.status(400).json({ message });
}

function draftNotFound(res: Response) {
  return res.status(404).json({ message: "แบบร่างไม่พบหรือหมดอายุแล้ว" });
}

async function readDraftRecord(filePath: string): Promise<StudioDraftRecord | undefined> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as StudioDraftRecord;
  } catch {
    return undefined;
  }
}

const router: IRouter = Router();

router.post("/studio/draft", async (req, res, next) => {
  const parsed = parseDraftBody(req.body);
  if (!parsed) return invalid(res, "Invalid studio draft payload");

  const requestedKey = parsed.draftKey?.trim();
  const draftKey = requestedKey && requestedKey.length > 0 ? requestedKey : `dft_${randomBytes(12).toString("hex")}`;
  const filePath = resolveDraftPath(draftKey);
  if (!filePath) return invalid(res, "Invalid draft key");

  try {
    const existing = requestedKey ? await readDraftRecord(filePath) : undefined;
    const now = new Date();
    const record: StudioDraftRecord = {
      draftKey,
      shape: parsed.shape,
      dimensions: parsed.dimensions,
      stoneColor: parsed.stoneColor,
      basinSku: parsed.basinSku,
      basinPlacements: parsed.basinPlacements,
      edges: parsed.edges,
      customerInfo: parsed.customerInfo,
      createdAt: existing?.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + DRAFT_TTL_MS).toISOString(),
    };

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(record), "utf8");

    return res.status(existing ? 200 : 201).json({
      draftKey,
      resumeUrl: `/studio?draft=${encodeURIComponent(draftKey)}`,
      expiresAt: record.expiresAt,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/studio/draft/:draftKey", async (req, res, next) => {
  const filePath = resolveDraftPath(req.params.draftKey);
  if (!filePath) return invalid(res, "Invalid draft key");

  try {
    const record = await readDraftRecord(filePath);
    if (!record) return draftNotFound(res);
    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      await rm(filePath, { force: true });
      return draftNotFound(res);
    }
    return res.status(200).json(record);
  } catch (error) {
    return next(error);
  }
});

export default router;
