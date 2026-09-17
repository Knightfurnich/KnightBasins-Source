import assert from "node:assert/strict";
import test from "node:test";
import { stoneHeroFrame } from "../src/data/stone-hero.ts";
import type { StoneColor } from "../src/data/catalog.ts";

const fallbackColor: StoneColor = {
  code: "BW010",
  name: "Bright White",
  tone: "#f5f3eb",
  sheetPriceTHB: 7500,
  installedPriceTHB: 5900,
  documentCodes: [],
};

const imageColor: StoneColor = {
  ...fallbackColor,
  code: "MU010",
  name: "Evermoin Ultra Bright",
  imageUrl: " https://cdn.example.test/mu010.jpg ",
};

test("stone hero rotates catalog colors without using the selected color as its index", () => {
  const frame = stoneHeroFrame([fallbackColor, imageColor], 1, fallbackColor);

  assert.equal(frame.color.code, "MU010");
  assert.equal(frame.imageUrl, "https://cdn.example.test/mu010.jpg");
  assert.equal(frame.showImage, true);
});

test("stone hero falls back to the catalog tone when an image is missing or failed", () => {
  const missingImage = stoneHeroFrame([fallbackColor], 0, imageColor);
  const failedImage = stoneHeroFrame([imageColor], 0, fallbackColor, new Set(["https://cdn.example.test/mu010.jpg"]));

  assert.equal(missingImage.color.code, "BW010");
  assert.equal(missingImage.imageUrl, "");
  assert.equal(missingImage.showImage, false);
  assert.equal(failedImage.color.code, "MU010");
  assert.equal(failedImage.showImage, false);
});

test("stone hero wraps rotation indexes without changing the catalog entries", () => {
  const frame = stoneHeroFrame([fallbackColor, imageColor], 3, fallbackColor);

  assert.equal(frame.color.code, "MU010");
  assert.equal(frame.color.tone, imageColor.tone);
});