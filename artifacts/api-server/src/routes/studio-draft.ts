import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Router, type IRouter, type Response } from "express";
import { clientKey, createRateLimiter } from "../lib/rate-limit";

const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const STUDIO_DRAFT_RETENTION_MS = 24 * 60 * 60 * 1000;

// Alphanumeric plus "_"/"-" only -- no "/" or "." so a draftKey can never
// escape the drafts directory, whether it was generated here or supplied by
// the client to resume/overwrite an existing draft.
const DRAFT_KEY_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

function draftsDir(): string {
  return path.resolve(process.env["STUDIO_DRAFTS_DIR"] ?? path.resolve(process.cwd(), "uploads/studio_drafts"));
}

function isMissingPathError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export async function cleanupExpiredStudioDrafts(
  retentionDays = 30,
): Promise<{ scanned: number; deleted: number }> {
  if (!Number.isFinite(retentionDays) || retentionDays < 0) {
    throw new RangeError("retentionDays must be a finite, non-negative number");
  }

  const directory = draftsDir();
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isMissingPathError(error)) return { scanned: 0, deleted: 0 };
    throw error;
  }

  const cutoff = Date.now() - retentionDays * STUDIO_DRAFT_RETENTION_MS;
  let scanned = 0;
  let deleted = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;

    const filePath = path.join(directory, entry.name);
    let fileStats;
    try {
      fileStats = await stat(filePath);
    } catch (error) {
      if (isMissingPathError(error)) continue;
      throw error;
    }

    if (!fileStats.isFile()) continue;
    scanned += 1;
    if (fileStats.mtimeMs <= cutoff) {
      await rm(filePath, { force: true });
      deleted += 1;
    }
  }

  return { scanned, deleted };
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

const studioDraftCreateRateLimit = createRateLimiter({
  name: "rl:studio-draft-create",
  max: 20,
  windowMs: 15 * 60 * 1000,
  key: (req) => {
    // clientKey applies the trusted-proxy checks; strip its User-Agent fingerprint
    // so changing that header cannot create a new bucket for the same IP.
    const resolvedKey = clientKey(req);
    const fingerprintSeparator = resolvedKey.lastIndexOf("#");
    return fingerprintSeparator === -1
      ? resolvedKey
      : resolvedKey.slice(0, fingerprintSeparator);
  },
});

router.post("/studio/draft", studioDraftCreateRateLimit, async (req, res, next) => {
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
