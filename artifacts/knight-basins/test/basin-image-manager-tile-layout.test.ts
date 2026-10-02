/**
 * Static source inspection for the admin basin image manager tile layout.
 *
 * The old tile was a 96x128px box with a full-bleed control overlay rendered at
 * text-[14px], so the three stacked controls wrapped, overflowed the tile and
 * covered the whole photo -- the owner reported "text too large, no room to
 * show every option" and "image not fully visible". The controls now live in a
 * strip BELOW the image and the image is object-contain, so the photo can never
 * be covered or cropped. App.tsx / admin pages are too large to render here, so
 * this asserts against the real source text.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("../src/admin/BasinImageManagerField.tsx", import.meta.url),
  "utf8",
);

describe("BasinImageManagerField tile layout", () => {
  it("renders the photo with object-contain so no image is cropped", () => {
    assert.match(source, /className="h-full w-full object-contain"/);
    assert.doesNotMatch(source, /h-full w-full object-cover/);
  });

  it("keeps the controls in a strip below the image instead of overlaying it", () => {
    // The control block must not be an absolute overlay anymore.
    assert.doesNotMatch(source, /absolute inset-x-0 bottom-0 flex flex-col/);
    assert.match(source, /border-t border-\[var\(--line\)\] p-1/);
  });

  it("uses small control text that fits the tile width", () => {
    assert.match(source, /rounded-sm border px-1 py-1 text-\[10px\] leading-tight/);
    assert.doesNotMatch(source, /text-\[14px\] text-white underline decoration-dotted/);
  });

  it("keeps every per-image control reachable and labelled", () => {
    assert.match(source, /data-testid=\{`button-basin-image-primary-\$\{index\}`\}/);
    assert.match(source, /data-testid=\{`button-basin-image-quote-\$\{index\}`\}/);
    assert.match(source, /data-testid=\{`button-basin-image-topview-\$\{index\}`\}/);
    assert.match(source, /aria-label="เลื่อนไปทางซ้าย"/);
    assert.match(source, /aria-label="เลื่อนไปทางขวา"/);
    assert.match(source, /ตั้งเป็นภาพหลัก/);
    assert.match(source, /ตั้งเป็นภาพใบเสนอราคา/);
    assert.match(source, /ตั้งเป็น Top View/);
  });

  it("picks the primary image without hiding the reorder arrows", () => {
    // Both moveTo arrows render for every tile, including the primary one.
    const leftArrows = source.match(/aria-label="เลื่อนไปทางซ้าย"/g) ?? [];
    const rightArrows = source.match(/aria-label="เลื่อนไปทางขวา"/g) ?? [];
    assert.equal(leftArrows.length, 1);
    assert.equal(rightArrows.length, 1);
  });
});
