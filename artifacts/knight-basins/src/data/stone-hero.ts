import type { StoneColor } from "./catalog";

export function stoneHeroFrame(
  colors: ReadonlyArray<StoneColor>,
  index: number,
  fallbackColor: StoneColor,
  failedImageUrls: ReadonlySet<string> = new Set(),
) {
  const heroColors = colors.length ? colors : [fallbackColor];
  const color = heroColors[((index % heroColors.length) + heroColors.length) % heroColors.length] ?? fallbackColor;
  const imageUrl = color.imageUrl?.trim() ?? "";

  return {
    color,
    imageUrl,
    showImage: Boolean(imageUrl) && !failedImageUrls.has(imageUrl),
  };
}