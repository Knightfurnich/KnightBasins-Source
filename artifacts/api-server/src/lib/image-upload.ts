import crypto from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Request } from "express";

export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;
export const DEFAULT_UPLOAD_RETENTION_HOURS = 24;
export const UPLOAD_DIR = process.env["UPLOAD_DIR"] ?? path.resolve(process.cwd(), "uploads");
const PUBLIC_UPLOAD_ORIGIN = process.env["PUBLIC_UPLOAD_ORIGIN"] ?? "";
const UPLOAD_RETENTION_HOURS = parseRetentionHours(process.env["UPLOAD_RETENTION_HOURS"]);

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const MANAGED_FILENAME = /^(?:catalog|sketch|slip)-[a-z0-9]+-[a-f0-9]{16}\.(?:jpg|png|webp|gif|mp4|webm|mov)$/i;

export type UploadedMedia = {
  buffer: Buffer;
  contentType: string;
  originalName: string;
};

export type UploadedImage = UploadedMedia;
export type UploadedVideo = UploadedMedia;

export type UploadedImageCleanupResult = {
  retentionHours: number;
  scanned: number;
  removed: string[];
  skippedReferenced: number;
  skippedTooNew: number;
};

export class UploadFileCollisionError extends Error {
  readonly code = "EEXIST";

  constructor(filename: string) {
    super(`An upload with the filename "${filename}" already exists`);
    this.name = "UploadFileCollisionError";
  }
}

function parseRetentionHours(value: string | undefined) {
  if (!value) return DEFAULT_UPLOAD_RETENTION_HOURS;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_UPLOAD_RETENTION_HOURS;
}

function publicUploadPath() {
  if (!PUBLIC_UPLOAD_ORIGIN) return "/api/uploads";
  try {
    return new URL(PUBLIC_UPLOAD_ORIGIN).pathname.replace(/\/+$/, "");
  } catch {
    throw new Error("PUBLIC_UPLOAD_ORIGIN must be a valid URL");
  }
}

function filenameFromUploadUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  if (!PUBLIC_UPLOAD_ORIGIN) return undefined;

  let parsed: URL;
  let origin: URL;
  try {
    parsed = new URL(value);
    origin = new URL(PUBLIC_UPLOAD_ORIGIN);
  } catch {
    return undefined;
  }

  const filename = parsed.pathname.slice(publicUploadPath().length + 1);
  if (
    parsed.origin !== origin.origin ||
    parsed.pathname !== `${publicUploadPath()}/${filename}` ||
    filename.includes("/")
  ) {
    return undefined;
  }

  return MANAGED_FILENAME.test(filename) ? filename : undefined;
}

export function uploadRetentionHours() {
  return UPLOAD_RETENTION_HOURS;
}

/**
 * Remove only old, generated upload files that are not referenced by a catalog row.
 *
 * The caller must provide imageUrl values from every catalog table. The URL is
 * converted back to a filename only when it matches this service's configured
 * public upload origin, so central/static catalog media is never considered.
 */
export async function cleanupUnreferencedUploadedImages(
  referencedUrls: Iterable<unknown>,
  options: { now?: number; retentionHours?: number } = {},
): Promise<UploadedImageCleanupResult> {
  const referencedFilenames = new Set(
    Array.from(referencedUrls, filenameFromUploadUrl).filter(
      (filename): filename is string => Boolean(filename),
    ),
  );
  const retentionHours = options.retentionHours ?? UPLOAD_RETENTION_HOURS;
  const retentionMs = retentionHours * 60 * 60 * 1000;
  const now = options.now ?? Date.now();
  const result: UploadedImageCleanupResult = {
    retentionHours,
    scanned: 0,
    removed: [],
    skippedReferenced: 0,
    skippedTooNew: 0,
  };

  let entries;
  try {
    entries = await readdir(UPLOAD_DIR, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return result;
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !MANAGED_FILENAME.test(entry.name)) continue;
    result.scanned += 1;

    if (referencedFilenames.has(entry.name)) {
      result.skippedReferenced += 1;
      continue;
    }

    const filePath = path.join(UPLOAD_DIR, entry.name);
    const fileStats = await stat(filePath);
    if (now - fileStats.mtimeMs < retentionMs) {
      result.skippedTooNew += 1;
      continue;
    }

    await unlink(filePath);
    result.removed.push(entry.name);
  }

  return result;
}

function headerValue(headers: string, name: string) {
  const line = headers.split("\r\n").find((item) => item.toLowerCase().startsWith(`${name.toLowerCase()}:`));
  return line?.slice(line.indexOf(":") + 1).trim() ?? "";
}

function hasFileSignature(buffer: Buffer, contentType: string) {
  if (contentType === "image/jpeg") return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (contentType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === "image/webp") return buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  if (contentType === "image/gif") return buffer.subarray(0, 6).toString() === "GIF87a" || buffer.subarray(0, 6).toString() === "GIF89a";
  if (contentType === "video/webm") return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (contentType === "video/mp4" || contentType === "video/quicktime") return buffer.subarray(4, 8).toString() === "ftyp";
  return false;
}

function assertRequestSize(req: Request, maxBytes: number, message: string) {
  const declaredLength = Number(req.headers["content-length"]);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes + 1024 * 1024) {
    throw new Error(message);
  }
}

function assertAllowedFile(buffer: Buffer, contentType: string, message: string) {
  if (!hasFileSignature(buffer, contentType)) throw new Error(message);
}

export async function readMultipartMedia(
  req: Request,
  kind: "image" | "video",
): Promise<UploadedMedia> {
  const isImage = kind === "image";
  const maxBytes = isImage ? MAX_IMAGE_UPLOAD_BYTES : MAX_VIDEO_UPLOAD_BYTES;
  const label = isImage ? "image" : "video";
  const allowed = isImage
    ? "Only JPG, PNG, WEBP, and GIF images are allowed"
    : "Only MP4, WEBM, and MOV videos are allowed";
  assertRequestSize(req, maxBytes, isImage ? "Image is too large. Maximum size is 10 MB" : "Video is too large. Maximum size is 100 MB");
  const contentType = req.headers["content-type"] ?? "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error(`A multipart ${label} file is required`);

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes + 1024 * 1024) {
      throw new Error(isImage ? "Image is too large. Maximum size is 10 MB" : "Video is too large. Maximum size is 100 MB");
    }
    chunks.push(buffer);
  }

  const body = Buffer.concat(chunks);
  const boundary = Buffer.from(`--${boundaryMatch[1] ?? boundaryMatch[2]}`);
  const start = body.indexOf(boundary);
  const headerStart = start + boundary.length + 2;
  const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), headerStart);
  if (start < 0 || headerEnd < 0) throw new Error("Invalid multipart upload");

  const headers = body.subarray(headerStart, headerEnd).toString("utf8");
  const partEnd = body.indexOf(boundary, headerEnd + 4);
  if (partEnd < 0) throw new Error("Invalid multipart upload");

  const fileBuffer = body.subarray(headerEnd + 4, partEnd - 2);
  const partType = headerValue(headers, "content-type").toLowerCase();
  const disposition = headerValue(headers, "content-disposition");
  const fieldMatch = disposition.match(/name="([^"]*)"/i);
  const nameMatch = disposition.match(/filename="([^"]*)"/i);
  if (fieldMatch?.[1] !== "file" || !nameMatch?.[1]) throw new Error(isImage ? "Choose an image file" : "Choose a video file");
  if (!MIME_EXTENSIONS[partType] || (isImage ? !partType.startsWith("image/") : !partType.startsWith("video/"))) {
    throw new Error(allowed);
  }
  if (fileBuffer.length === 0 || fileBuffer.length > maxBytes) {
    throw new Error(isImage ? "Image is too large. Maximum size is 10 MB" : "Video is too large. Maximum size is 100 MB");
  }
  assertAllowedFile(fileBuffer, partType, allowed);

  return { buffer: fileBuffer, contentType: partType, originalName: nameMatch[1] };
}

export async function readMultipartImage(req: Request): Promise<UploadedImage> {
  return readMultipartMedia(req, "image");
}

export async function readMultipartVideo(req: Request): Promise<UploadedVideo> {
  return readMultipartMedia(req, "video");
}

export async function readMultipartForm(
  req: Request,
  kind: "image" | "video",
  options: { maxFiles?: number } = {},
) {
  const isImage = kind === "image";
  const maxFiles = options.maxFiles ?? 1;
  const perFileMaxBytes = isImage ? MAX_IMAGE_UPLOAD_BYTES : MAX_VIDEO_UPLOAD_BYTES;
  const maxBytes = perFileMaxBytes * maxFiles;
  assertRequestSize(req, maxBytes, isImage ? "Image is too large. Maximum size is 10 MB" : "Video is too large. Maximum size is 100 MB");
  const contentType = req.headers["content-type"] ?? "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error(`A multipart ${isImage ? "image" : "video"} file is required`);
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes + 1024 * 1024) throw new Error(isImage ? "Image is too large. Maximum size is 10 MB" : "Video is too large. Maximum size is 100 MB");
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks);
  const boundary = Buffer.from(`--${boundaryMatch[1] ?? boundaryMatch[2]}`);
  const fields: Record<string, string> = {};
  let cursor = 0;
  const media: UploadedMedia[] = [];
  while (cursor < body.length) {
    const start = body.indexOf(boundary, cursor);
    if (start < 0) break;
    const headerStart = start + boundary.length + 2;
    if (body.subarray(start + boundary.length, start + boundary.length + 2).toString() === "--") break;
    const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), headerStart);
    if (headerEnd < 0) break;
    const partEnd = body.indexOf(boundary, headerEnd + 4);
    if (partEnd < 0) break;
    const headers = body.subarray(headerStart, headerEnd).toString("utf8");
    const content = body.subarray(headerEnd + 4, partEnd - 2);
    const disposition = headerValue(headers, "content-disposition");
    const fieldName = disposition.match(/name="([^"]*)"/i)?.[1];
    const fileName = disposition.match(/filename="([^"]*)"/i)?.[1];
    if (fieldName === "file" && fileName) {
      if (media.length >= maxFiles) {
        throw new Error(isImage ? `Choose up to ${maxFiles} images` : `Choose up to ${maxFiles} videos`);
      }
      const partType = headerValue(headers, "content-type").toLowerCase();
      if (!MIME_EXTENSIONS[partType] || (isImage ? !partType.startsWith("image/") : !partType.startsWith("video/"))) {
        throw new Error(isImage ? "Only JPG, PNG, WEBP, and GIF images are allowed" : "Only MP4, WEBM, and MOV videos are allowed");
      }
      if (content.length === 0 || content.length > perFileMaxBytes) throw new Error(isImage ? "Image is too large. Maximum size is 10 MB" : "Video is too large. Maximum size is 100 MB");
      assertAllowedFile(content, partType, isImage ? "Only JPG, PNG, WEBP, and GIF images are allowed" : "Only MP4, WEBM, and MOV videos are allowed");
      media.push({ buffer: content, contentType: partType, originalName: fileName });
    } else if (fieldName) {
      fields[fieldName] = content.toString("utf8");
    }
    cursor = partEnd;
  }
  if (!media.length) throw new Error(isImage ? "Choose an image file" : "Choose a video file");
  return { media, fields };
}

export async function saveUploadedMedia(media: UploadedMedia, prefix = "catalog") {
  const extension = MIME_EXTENSIONS[media.contentType];
  if (!extension) throw new Error("Unsupported uploaded media type");
  if (!/^(?:catalog|sketch|slip)$/.test(prefix)) throw new Error("Invalid upload prefix");
  if (!PUBLIC_UPLOAD_ORIGIN && process.env["NODE_ENV"] === "production") {
    throw new Error("PUBLIC_UPLOAD_ORIGIN must be configured in production");
  }
  const version = Date.now().toString(36);
  const token = crypto.randomBytes(8).toString("hex");
  const filename = `${prefix}-${version}-${token}.${extension}`;
  const safeFilename = path.basename(filename);
  if (safeFilename !== filename || !MANAGED_FILENAME.test(safeFilename)) {
    throw new Error("Invalid upload filename");
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  const uploadRoot = path.resolve(UPLOAD_DIR);
  const filePath = path.resolve(uploadRoot, safeFilename);
  if (!filePath.startsWith(`${uploadRoot}${path.sep}`)) throw new Error("Invalid upload filename");
  const fileUrl = new URL(safeFilename, pathToFileURL(`${uploadRoot}${path.sep}`));
  let handle;
  try {
    handle = await open(fileUrl,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new UploadFileCollisionError(filename);
    }
    throw error;
  }
  try {
    await handle.writeFile(media.buffer);
  } catch (error) {
    await unlink(filePath).catch(() => undefined);
    throw error;
  } finally {
    await handle.close();
  }

  return {
    filename,
    contentType: media.contentType,
    size: media.buffer.length,
    originalName: media.originalName,
    version,
    url: `${(PUBLIC_UPLOAD_ORIGIN || "/api/uploads").replace(/\/$/, "")}/${filename}?v=${version}`,
  };
}

export async function removeUploadedMedia(filename: string) {
  const safeFilename = path.basename(filename);
  if (safeFilename !== filename || !MANAGED_FILENAME.test(safeFilename)) {
    throw new Error("Invalid upload filename");
  }

  const uploadRoot = path.resolve(UPLOAD_DIR);
  const filePath = path.resolve(uploadRoot, safeFilename);
  if (!filePath.startsWith(`${uploadRoot}${path.sep}`)) throw new Error("Invalid upload filename");

  try {
    await unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function saveUploadedImage(image: UploadedImage) {
  return saveUploadedMedia(image);
}

export async function saveUploadedVideo(video: UploadedVideo) {
  return saveUploadedMedia(video);
}