/**
 * job-290: the one public host every media URL leaves the API on (the single-domain rule of job-272). Rows saved before
 * the move still carry full URLs on the old per-server hosts (LEGACY_MEDIA_HOST_SUFFIX); they are rewritten on the way out
 * and the database itself is not touched.
 */
export const CANONICAL_MEDIA_ORIGIN = "https://knightbasins.com";
const LEGACY_MEDIA_HOST_SUFFIX = ".srv1964473.hstgr.cloud";
const CENTRAL_MEDIA_ORIGIN = `${CANONICAL_MEDIA_ORIGIN}/kb/images`;

/**
 * Empty / null / undefined and relative paths come back unchanged (no domain is added). An absolute http(s) URL on a host
 * ending in LEGACY_MEDIA_HOST_SUFFIX becomes `https://knightbasins.com` + the same path, query and hash (a `?v=` cache
 * key survives). Every other host, including the canonical one, is returned exactly as given.
 */
export function canonicalMediaUrl<T extends string | null | undefined>(url: T): T {
  if (typeof url !== "string") return url;
  const value = url.trim();
  if (!/^https?:\/\//i.test(value)) return url;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return url;
  }
  if (!parsed.hostname.toLowerCase().endsWith(LEGACY_MEDIA_HOST_SUFFIX)) return url;
  return `${CANONICAL_MEDIA_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}` as T;
}

/** Rewrites the named URL fields of a row (a string, or every string of an array) and leaves all other fields as they are. */
function canonicalFields<T extends object>(row: T, keys: ReadonlyArray<string>): T {
  const next = { ...row } as Record<string, unknown>;
  for (const key of keys) {
    const value = next[key];
    if (typeof value === "string") next[key] = canonicalMediaUrl(value);
    else if (Array.isArray(value)) next[key] = value.map((item) => (typeof item === "string" ? canonicalMediaUrl(item) : item));
  }
  return next as T;
}

const BASIN_MEDIA_FIELDS = ["imageUrl", "quoteImageUrl", "topViewImageUrl", "videoUrl", "uploadedVideoUrl", "galleryImageUrls"];
const STONE_MEDIA_FIELDS = ["imageUrl", "quoteImageUrl", "slabImageUrl", "galleryImageUrls"];

export function basinVideoUrl(sku: string) {
  return `${CENTRAL_MEDIA_ORIGIN}/basin-videos/${encodeURIComponent(sku)}.mp4`;
}

export function slabImageUrl(code: string) {
  return `${CENTRAL_MEDIA_ORIGIN}/slab/${encodeURIComponent(code)}.png`;
}

export function basinImageUrl(sku: string) {
  return `${CENTRAL_MEDIA_ORIGIN}/basin-hd/${encodeURIComponent(sku)}.jpg`;
}

export function normalizeDimension(value: string | null | undefined) {
  if (!value) return value ?? null;
  return value.replace(/\bD\s*(?=\d)/gi, "Ø");
}

export function normalizeBasinFields(input: {
  sku: string;
  dimensions: string;
  basinDimensions?: string | null;
  bowlMm?: string | null;
}) {
  const sku = input.sku.trim().toUpperCase();
  const bowlMm = sku === "KF029" || sku === "KF030"
    ? null
    : normalizeDimension(input.bowlMm ?? input.basinDimensions);

  return {
    ...input,
    sku,
    dimensions: normalizeDimension(input.dimensions) ?? "",
    basinDimensions: bowlMm,
    bowlMm,
  };
}

export function normalizedGalleryImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((url): url is string => typeof url === "string")
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
}

export function normalizedNullableImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function withBasinMedia<T extends { sku: string }>(basin: T) {
  const storedImageUrl = "imageUrl" in basin && typeof basin.imageUrl === "string"
    ? basin.imageUrl.trim()
    : "";
  const isLegacyBrokenImage = storedImageUrl.includes("/kb/images/basins/");
  return canonicalFields({
    ...basin,
    imageUrl: storedImageUrl && !isLegacyBrokenImage
      ? storedImageUrl
      : basinImageUrl(basin.sku),
    galleryImageUrls: normalizedGalleryImageUrls(
      "galleryImageUrls" in basin ? (basin as { galleryImageUrls?: unknown }).galleryImageUrls : undefined,
    ),
    quoteImageUrl: normalizedNullableImageUrl(
      "quoteImageUrl" in basin ? (basin as { quoteImageUrl?: unknown }).quoteImageUrl : undefined,
    ),
    uploadedVideoUrl: "videoUrl" in basin && typeof basin.videoUrl === "string" && basin.videoUrl.trim()
      ? basin.videoUrl.trim()
      : null,
    videoUrl: "videoUrl" in basin && typeof basin.videoUrl === "string" && basin.videoUrl.trim()
      ? basin.videoUrl.trim()
      : basinVideoUrl(basin.sku),
  }, BASIN_MEDIA_FIELDS);
}

export function withBasinCategory<T extends { category: string; categoryId?: number | null }>(
  basin: T,
  categories: Array<{ id: number; name: string }>,
) {
  const category = basin.categoryId
    ? categories.find((item) => item.id === basin.categoryId)?.name
    : undefined;
  return { ...basin, category: category ?? basin.category };
}

export function withStoneMedia<T extends { code: string; imageUrl?: string | null }>(stone: T) {
  return canonicalFields({ ...stone, imageUrl: stone.imageUrl?.trim() || slabImageUrl(stone.code) }, STONE_MEDIA_FIELDS);
}