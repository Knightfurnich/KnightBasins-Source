// Portfolio catalog I/O and safety helpers, shared by routes/portfolio.ts's
// public read routes and the admin write routes (upload/delete/duplicates)
// added in job-102. Kept separate from the route file so the
// read-catalog/write-catalog-atomically/resolve-a-safe-file-path concerns
// can be tested and reasoned about independently of Express request/response
// plumbing.
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

export type PortfolioItem = {
  id: string;
  category: string;
  categoryName: string;
  icon: string;
  filename: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  title: string;
};

export type PortfolioCatalog = { updatedAt: string; total: number; items: PortfolioItem[] };

/** Safe, empty catalog shape returned whenever catalog.json is missing (ENOENT) or unreadable (malformed JSON, permissions, etc.). */
export function emptyCatalog(): PortfolioCatalog {
  return { updatedAt: new Date().toISOString(), total: 0, items: [] };
}

function catalogPath(uploadDir: string): string {
  return join(uploadDir, "portfolio", "catalog.json");
}

/**
 * Never throws: a missing file or invalid JSON both degrade to
 * emptyCatalog() (logging which one, and why) rather than surfacing as a
 * 500 to every route built on top of this (see Task 100's
 * SECURITY_AUDIT_REPORT-adjacent fix for the original bug this codifies).
 */
export async function loadCatalog(uploadDir: string): Promise<PortfolioCatalog> {
  const path = catalogPath(uploadDir);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    console.warn("Portfolio catalog.json is missing; falling back to an empty catalog", {
      path,
      code: (error as NodeJS.ErrnoException)?.code,
    });
    return emptyCatalog();
  }

  let parsed: Partial<PortfolioCatalog>;
  try {
    parsed = JSON.parse(raw) as Partial<PortfolioCatalog>;
  } catch (error) {
    console.warn("Portfolio catalog.json is not valid JSON; falling back to an empty catalog", {
      path,
      error: error instanceof Error ? error.message : error,
    });
    return emptyCatalog();
  }

  const items = Array.isArray(parsed.items) ? parsed.items : [];
  // The import contains a handful of duplicate ids (two files ingested under
  // the same id, e.g. counter_001). Ids drive the allowlist, the visibility
  // map and the React keys, so a repeated id renders the same photo twice and
  // inflates the public count. Keep the first occurrence of each id.
  const seen = new Set<string>();
  const uniqueItems = items.filter((item) => {
    if (!item || typeof item.id !== "string" || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return {
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    total: uniqueItems.length,
    items: uniqueItems,
  };
}

/**
 * Atomic write: the new content lands fully in a temp file in the same
 * directory (so the rename below stays on one filesystem, guaranteeing
 * atomicity) before replacing catalog.json in a single `rename` syscall --
 * a reader can never observe a half-written file, even if two writes race or
 * the process is killed mid-write.
 */
export async function saveCatalog(uploadDir: string, catalog: PortfolioCatalog): Promise<void> {
  const path = catalogPath(uploadDir);
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });
  const tempPath = join(directory, `.catalog.json.tmp-${randomBytes(6).toString("hex")}`);
  await writeFile(tempPath, JSON.stringify(catalog, null, 2), "utf8");
  await rename(tempPath, path);
}

/** `<category>_<NNN>`, the same style as the existing legacy-imported ids (e.g. "counter_001"), skipping any number already in `existingIds`. */
export function generatePortfolioId(category: string, existingIds: Iterable<string>): string {
  const existing = existingIds instanceof Set ? existingIds : new Set(existingIds);
  let serial = existing.size + 1;
  let candidate = `${category}_${String(serial).padStart(3, "0")}`;
  while (existing.has(candidate)) {
    serial += 1;
    candidate = `${category}_${String(serial).padStart(3, "0")}`;
  }
  return candidate;
}

/** A bare filename/category segment: no path separator, and not "." or ".." -- the only two single-segment values `path.resolve` treats specially. */
function isSafePathSegment(value: string): boolean {
  return value.length > 0 && !value.includes("/") && !value.includes("\\") && value !== "." && value !== "..";
}

/**
 * Resolves where a portfolio image with this `category`/`filename` lives (or
 * would be written) on disk, or `null` if either input isn't a safe single
 * path segment -- the caller must treat `null` as an outright refusal to
 * touch any file at all, never as "fall back to some other path". This is
 * what keeps both the upload write and the delete unlink inside
 * uploads/portfolio/ no matter what a caller (or a corrupted catalog entry)
 * supplies.
 */
export function resolvePortfolioFilePath(uploadDir: string, category: string, filename: string): string | null {
  if (!isSafePathSegment(category) || !isSafePathSegment(filename)) return null;
  const portfolioRoot = resolve(uploadDir, "portfolio");
  const resolved = resolve(portfolioRoot, category, filename);
  if (!resolved.startsWith(`${portfolioRoot}${sep}`)) return null;
  return resolved;
}

export type ImageDimensions = { width: number; height: number };

function readJpegDimensions(buffer: Buffer): ImageDimensions | null {
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === undefined || marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9) break;
    const length = buffer.readUInt16BE(offset + 2);
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame && offset + 9 <= buffer.length) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

/** Only the byte-aligned "VP8X" extended header is supported -- classic
 * lossy (VP8) / lossless (VP8L) WebP pack width/height into bit-level
 * fields this doesn't unpack. Callers treat a null result the same as any
 * other unparseable image (width/height default to 0), which is a cosmetic
 * gap, not a functional one. */
function readWebpDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 30 || buffer.toString("ascii", 12, 16) !== "VP8X") return null;
  const widthMinusOne = buffer.readUIntLE(24, 3);
  const heightMinusOne = buffer.readUIntLE(27, 3);
  return { width: widthMinusOne + 1, height: heightMinusOne + 1 };
}

/**
 * Reads width/height straight from each format's own header bytes (no
 * decoding of pixel data), matching `contentType` as already validated by
 * image-upload.ts's magic-byte check. Never throws; returns null when the
 * format isn't recognized or the buffer is too short to contain the
 * relevant header fields.
 */
export function readImageDimensions(buffer: Buffer, contentType: string): ImageDimensions | null {
  try {
    if (contentType === "image/png" && buffer.length >= 24) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (contentType === "image/gif" && buffer.length >= 10) {
      return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    }
    if (contentType === "image/jpeg") {
      return readJpegDimensions(buffer);
    }
    if (contentType === "image/webp") {
      return readWebpDimensions(buffer);
    }
  } catch {
    return null;
  }
  return null;
}

export function portfolioExtensionForContentType(contentType: string): string | null {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[contentType] ?? null;
}

/** New, server-generated filename for an uploaded portfolio photo -- never derived from the client's own filename, so it can't carry a path-traversal payload. */
/**
 * Legacy import: the portfolio used to be seeded from LINE photo dumps, and those file names carried the customer's
 * own words ("LINE_ALBUM_บ้านคุณ‹name›‹particle›"). The URL of a finished photo is public and never rotates, so a
 * customer's name became part of a permanent, indexable address -- and now part of anything an AI cites from it.
 * Uploads since job-102 already get server-generated opaque names from generatePortfolioFilename(); this is only
 * about the rows that predate that, so the patterns below stay narrow and err toward reporting, not hiding.
 */
const PERSONAL_NAME_IN_FILENAME = [/LINE_ALBUM/i, /\u0e1a\u0e49\u0e32\u0e19\u0e04\u0e38\u0e13/, /\u0e04\u0e38\u0e13/, /\u0e04\u0e23\u0e31\u0e1a/, /\u0e04\u0e38\u0e13\u0e19\u0e49\u0e2d\u0e22/, /\u0e19\u0e49\u0e2d\u0e07/, /\u0e1c\u0e39\u0e49/];

export function looksPersonalPortfolioFilename(filename: string): boolean {
  return PERSONAL_NAME_IN_FILENAME.some((pattern) => pattern.test(filename));
}

/** The rows that still publish a person or a site contact in their public URL, oldest id first. */
export function findPersonalPortfolioFilenames(items: ReadonlyArray<Pick<PortfolioItem, "id" | "category" | "filename">>) {
  return items
    .filter((item) => looksPersonalPortfolioFilename(item.filename))
    .sort((left, right) => left.id.localeCompare(right.id, "en"));
}

/**
 * A rename plan: new names come from the same generator the upload route uses, so nothing about the customer survives
 * and nothing depends on a hand-written slug. The id never changes, which is what keeps the visibility map and the
 * React keys valid across a rename.
 */
export function planPortfolioFilenameAnonymization(
  items: ReadonlyArray<Pick<PortfolioItem, "id" | "category" | "filename">>,
  now: () => number = Date.now,
): Array<{ id: string; category: string; from: string; to: string }> {
  const affected = findPersonalPortfolioFilenames(items);
  return affected.map((item, index) => {
    const extension = item.filename.slice(item.filename.lastIndexOf("."));
    const serial = (now() + index).toString(36);
    const token = randomBytes(6).toString("hex");
    return {
      id: item.id,
      category: item.category,
      from: item.filename,
      to: `${item.category}_${serial}_${token}${extension}`,
    };
  });
}

/**
 * Execute a plan on disk and in catalog.json: same-directory rename (one filesystem, like saveCatalog's temp file),
 * then one atomic catalog write. Any failure aborts before the catalog is replaced, so a half-renamed set cannot be
 * published; a file that is already gone is reported and skipped rather than fatal, because the catalog is the record.
 */
export async function applyPortfolioFilenameAnonymization(
  uploadDir: string,
  catalog: PortfolioCatalog,
  plan: ReadonlyArray<{ id: string; category: string; from: string; to: string }>,
): Promise<{ renamed: string[]; missing: string[]; catalog: PortfolioCatalog }> {
  const renamed: string[] = [];
  const missing: string[] = [];
  const byId = new Map(plan.map((step) => [step.id, step]));
  const moved: Array<{ id: string; from: string; to: string }> = [];

  for (const step of plan) {
    const source = resolvePortfolioFilePath(uploadDir, step.category, step.from);
    if (!source) throw new Error(`refused to touch ${step.from}: path escapes the uploads root`);
    const target = resolvePortfolioFilePath(uploadDir, step.category, step.to);
    if (!target) throw new Error(`refused to write ${step.to}: path escapes the uploads root`);
    try {
      await rename(source, target);
      renamed.push(step.id);
      moved.push(step);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") missing.push(step.id);
      else throw error;
    }
  }

  const items = catalog.items.map((item) => {
    const step = byId.get(item.id);
    if (!step || !moved.some((entry) => entry.id === item.id)) return item;
    return { ...item, filename: step.to, url: `/api/uploads/portfolio/${item.category}/${step.to}` };
  });
  const nextCatalog = { ...catalog, items, updatedAt: new Date().toISOString() };
  if (moved.length) await saveCatalog(uploadDir, nextCatalog);
  return { renamed, missing, catalog: moved.length ? nextCatalog : catalog };
}

export function generatePortfolioFilename(category: string, extension: string): string {
  const serial = Date.now().toString(36);
  const token = randomBytes(6).toString("hex");
  return `${category}_${serial}_${token}.${extension}`;
}
