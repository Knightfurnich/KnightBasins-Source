const CENTRAL_MEDIA_ORIGIN = "https://api.srv1964473.hstgr.cloud/kb/images";

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

export function withBasinMedia<T extends { sku: string }>(basin: T) {
  const storedImageUrl = "imageUrl" in basin && typeof basin.imageUrl === "string"
    ? basin.imageUrl.trim()
    : "";
  const isLegacyBrokenImage = storedImageUrl.includes("/kb/images/basins/");
  return {
    ...basin,
    imageUrl: storedImageUrl && !isLegacyBrokenImage
      ? storedImageUrl
      : basinImageUrl(basin.sku),
    uploadedVideoUrl: "videoUrl" in basin && typeof basin.videoUrl === "string" && basin.videoUrl.trim()
      ? basin.videoUrl.trim()
      : null,
    videoUrl: "videoUrl" in basin && typeof basin.videoUrl === "string" && basin.videoUrl.trim()
      ? basin.videoUrl.trim()
      : basinVideoUrl(basin.sku),
  };
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
  return { ...stone, imageUrl: stone.imageUrl?.trim() || slabImageUrl(stone.code) };
}