/**
 * job 443-B — the guard that was missing when KF003 got a kitchen photo saved as its
 * main image: an upload went straight from the file picker into the record, with
 * nothing on screen tying the picture to the model it was about to overwrite.
 *
 * Everything here is pure (no React, no network at import time) so the rules are
 * testable, and nothing ever guesses: an unreadable size is reported as unknown and
 * a missing standard HD file is reported as missing.
 */

/** Shortest side a catalogue photo should have (both store and quote prints wash out below this). */
export const STANDARD_MIN_PX = 600;

/** SKU shape we are willing to build a path from (`KF003`, `TALL-1`; never a path-traversal string). */
const SAFE_SKU = /^[A-Z0-9][A-Z0-9-]{1,23}$/;

export type ImageSize = { width: number; height: number };

/**
 * The stock HD photo for a model, on the same origin as the admin app.
 * `null` means "we cannot name a file for this model" -- callers must not fall back to
 * a sibling product's image, which is exactly how the wrong photo got in the first place.
 */
export function standardHdImageUrl(sku: string | null | undefined): string | null {
  const code = String(sku ?? "").trim().toUpperCase();
  if (!SAFE_SKU.test(code)) return null;
  return `/kb/images/basin-hd/${code}.jpg`;
}

/** Only a real 2xx with an image payload counts as "this file exists". */
export function standardHdIsReal(response: { status: number; headers?: { get?: (name: string) => string | null } }): boolean {
  if (response.status < 200 || response.status > 299) return false;
  const type = response.headers?.get?.("content-type") ?? "";
  // A soft 404 that answers with the SPA's index.html must never look like a photo.
  if (type && !type.includes("image/")) return false;
  return true;
}

export async function probeStandardHdImage(
  url: string,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): Promise<boolean> {
  try {
    const head = await fetchImpl(url, { method: "HEAD", cache: "no-store" });
    if (standardHdIsReal(head)) return true;
    // Some static servers refuse HEAD; a tiny ranged GET is the honest second look.
    const get = await fetchImpl(url, { method: "GET", headers: { Range: "bytes=0-15" }, cache: "no-store" });
    return standardHdIsReal(get);
  } catch {
    return false;
  }
}

export function minSide(size: ImageSize | null): number | null {
  if (!size) return null;
  const { width, height } = size;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return Math.min(width, height);
}

/** Warning (never a block): one side is under the catalogue minimum. */
export function isBelowStandard(size: ImageSize | null): boolean {
  const side = minSide(size);
  return side !== null && side < STANDARD_MIN_PX;
}

/** Reads real pixel size; `null` when the browser cannot decode it (unreadable ≠ small). */
export function readImageSizeFromElement(img: { naturalWidth?: number; naturalHeight?: number }): ImageSize | null {
  const width = img?.naturalWidth ?? 0;
  const height = img?.naturalHeight ?? 0;
  if (!width || !height) return null;
  return { width, height };
}

export function loadImageSize(src: string): Promise<ImageSize | null> {
  if (typeof Image !== "function") return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    const done = (size: ImageSize | null) => {
      img.onload = null;
      img.onerror = null;
      resolve(size);
    };
    img.onload = () => done(readImageSizeFromElement(img));
    img.onerror = () => done(null);
    img.src = src;
  });
}

/** "KF003 · kitchen.jpg · 4000×2667 px" — unknown size is labelled, never invented. */
export function pendingImageSummary(input: { sku?: string | null; label: string; size: ImageSize | null }): string {
  const parts = [input.sku?.trim() || "ไม่ระบุรุ่น", input.label];
  parts.push(input.size ? `${input.size.width}×${input.size.height} px` : "วัดขนาดไม่ได้");
  return parts.join(" · ");
}

export function sizeWarningText(size: ImageSize | null): string {
  const side = minSide(size);
  if (!size || side === null) {
    return "วัดความกว้าง×ยาวไม่ได้ — กดยืนยันได้ถ้าคุณเห็นภาพย่อตรงรุ่น (เราไม่เดาขนาด)";
  }
  if (!isBelowStandard(size)) return "";
  return `ด้านที่สั้นที่สุด ${side} px ต่ำกว่า ${MIN_SIDE_TEXT}`;
}

// one constant so the warning sentence can never drift from the threshold
const MIN_SIDE_TEXT = `${STANDARD_MIN_PX} px — ภาพจะแตกบนการ์ดและในใบเสนอราคา (ยังบันทึกได้ เพราะเป็นคำเตือนไม่ใช่การบล็อก)`;
