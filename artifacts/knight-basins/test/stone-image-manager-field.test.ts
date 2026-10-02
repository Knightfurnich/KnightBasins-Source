/**
 * Static source inspection for the stone image manager (jobs 187/188).
 *
 * Sheet stones and installed stones manage their photos with the same
 * three-role UI as basins: storefront image, quotation image and a full-slab
 * image (the third role replaces the basin Top View). The admin pages are too
 * large to render in node:test, so this asserts against the real source text.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const component = readFileSync(new URL("../src/admin/StoneImageManagerField.tsx", import.meta.url), "utf8");
const sheetManager = readFileSync(new URL("../src/admin/SheetStonesManager.tsx", import.meta.url), "utf8");
const installedManager = readFileSync(new URL("../src/admin/InstalledStonesManager.tsx", import.meta.url), "utf8");

describe("StoneImageManagerField source", () => {
  it("exposes all three stone image roles and the full-slab action", () => {
    assert.ok(component.includes("ภาพแสดงหน้าร้าน"));
    assert.ok(component.includes("ภาพใบเสนอราคา"));
    assert.ok(component.includes("ภาพแสดงเต็มแผ่น"));
    assert.ok(component.includes("✓ ตั้งเป็นภาพเต็มแผ่น"));
    assert.ok(component.includes("ภาพถ่ายลายหินเต็มแผ่นใหญ่ สำหรับประกอบการตัดสินใจและดูลายก่อนตัดชิ้นงาน"));
  });

  it("mounts the manager in both sheet and installed stone forms", () => {
    assert.match(sheetManager, /<StoneImageManagerField\s/);
    assert.match(installedManager, /<StoneImageManagerField\s/);
  });

  it("numbers the roles 1-2-3 like the basin manager", () => {
    assert.match(component, /1\. ภาพแสดงหน้าร้าน \(\/stone\)/);
    assert.match(component, /2\. ภาพใบเสนอราคา/);
    assert.match(component, /3\. ภาพแสดงเต็มแผ่น \(Full Slab\)/);
    assert.match(component, /ดูลายเต็มแผ่น/);
  });

  it("drops the basin Top View wording", () => {
    // Only the visible wording matters: the shared plain-toggle helper keeps its basin-era name.
    assert.doesNotMatch(component, /ภาพ Top View|ตั้งเป็น Top View|topViewImageUrl|onTopViewImageChange/);
  });

  it("takes the image, quote and slab props with their change handlers", () => {
    for (const prop of ["images", "quoteImageUrl", "slabImageUrl", "onImagesChange", "onQuoteImageChange", "onSlabImageChange"]) {
      assert.match(component, new RegExp(`\\b${prop}\\b`), `missing prop ${prop}`);
    }
    // Slab handler is required (stones always carry the role), unlike the basin's optional Top View.
    assert.match(component, /onSlabImageChange: \(url: string \| null\) => void;/);
  });

  it("keeps the gallery controls: add, move, make primary, toggle roles, delete", () => {
    assert.match(component, /\+ เพิ่มภาพใหม่/);
    assert.match(component, /aria-label="เลื่อนไปทางซ้าย"/);
    assert.match(component, /aria-label="เลื่อนไปทางขวา"/);
    assert.match(component, /ตั้งเป็นภาพหลัก/);
    assert.match(component, /ตั้งเป็นภาพใบเสนอราคา/);
    assert.match(component, /aria-label=\{`ลบภาพที่ \$\{index \+ 1\}`\}/);
    for (const id of ["primary", "quote", "full-slab"]) {
      assert.match(component, new RegExp("data-testid=\\{`button-stone-image-" + id + "-\\$\\{index\\}`\\}"));
    }
  });

  it("caps the gallery at one storefront image plus the four gallery slots the API accepts", () => {
    assert.match(component, /max = 5,/);
  });

  it("clears a role pin when the pinned image is removed", () => {
    assert.match(component, /removedUrl === quoteImageUrl\) onQuoteImageChange\(null\)/);
    assert.match(component, /removedUrl === slabImageUrl\) onSlabImageChange\(null\)/);
  });

  it("keeps the quote image following the storefront image until one is pinned", () => {
    assert.match(component, /activeQuoteUrl = quoteImageUrl \|\| primaryUrl/);
    assert.match(component, /nextQuoteImageUrl\(quoteImageUrl, images\[0\], url\)/);
  });

  // The admin owner already rejected an overlay tile for basins: the control
  // text covered the photo and object-cover cropped it. Stone patterns need the
  // whole picture visible, so the stone tile uses the same strip-below layout.
  it("shows each photo uncropped with the controls in a strip below it", () => {
    assert.match(component, /className="h-full w-full object-contain"/);
    assert.doesNotMatch(component, /object-cover/);
    assert.doesNotMatch(component, /absolute inset-x-0 bottom-0 flex flex-col/);
    assert.match(component, /border-t border-\[var\(--line\)\] p-1\.5/);
  });
});

for (const [name, source] of Object.entries({ SheetStonesManager: sheetManager, InstalledStonesManager: installedManager })) {
  describe(`${name} wiring`, () => {
    it("replaces the single-image upload field", () => {
      assert.doesNotMatch(source, /ImageUploadField/);
    });

    it("stores the first image as imageUrl and the rest as the gallery", () => {
      assert.match(source, /form\.setValue\("imageUrl", images\[0\] \?\? ""/);
      assert.match(source, /form\.setValue\("galleryImageUrls", images\.slice\(1\)/);
      assert.match(source, /form\.setValue\("quoteImageUrl", url/);
      assert.match(source, /form\.setValue\("slabImageUrl", url/);
    });

    it("sends every role in the save payload and keeps the other form fields", () => {
      assert.match(source, /const payload = \{\s*\.\.\.values,/);
      assert.match(source, /galleryImageUrls: z\.array\(/);
      assert.match(source, /quoteImageUrl: z\.string\(\)/);
      assert.match(source, /slabImageUrl: z\.string\(\)/);
      for (const field of ["sortOrder", "aliases", "active"]) {
        assert.match(source, new RegExp(`name="${field}"`));
      }
    });
  });
}

describe("stone price fields stay in the forms", () => {
  it("sheet stones keep all three price tiers", () => {
    for (const name of ["basePriceTHB", "price10PlusTHB", "price50PlusTHB"]) {
      assert.match(sheetManager, new RegExp(`name="${name}"`));
    }
  });

  it("installed stones keep the per-sqm price and category", () => {
    assert.match(installedManager, /name="pricePerSqmTHB"/);
    assert.match(installedManager, /name="categoryId"/);
  });
});
