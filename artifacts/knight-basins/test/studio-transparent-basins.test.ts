/**
 * Transparent top-view basin assets and their styling (job-212).
 *
 * The 30 cut-out PNGs live in public/assets/basins-transparent/ (served at /assets/basins-transparent/KFxxx.png).
 * The tests read the real files: every one must be a PNG with a real alpha channel (decoded here with zlib, not
 * just a header check) and round basins must be masked round. The CSS tests read src/index.css and pin the
 * object-fit / drop-shadow / no-frame rules of the .studio-basin-* real top-view block, and that nothing else in
 * the stylesheet picked up that shadow.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";
import { describe, it } from "node:test";

import { PRODUCTS } from "../src/data/catalog.ts";

const testDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(testDir, "..");
const assetDir = join(appRoot, "public/assets/basins-transparent");
const css = readFileSync(join(appRoot, "src/index.css"), "utf8").replace(/\r\n/g, "\n");
const studioPage = readFileSync(join(appRoot, "src/components/StudioPage.tsx"), "utf8");

const SKUS = Array.from({ length: 30 }, (_, index) => `KF${String(index + 1).padStart(3, "0")}`);
/** Same rule StudioPage.isRoundBasinProduct applies to a catalog entry. */
const ROUND_PATTERN = /(?:[Øø]|\bD\s*\d|round|circle|กลม)/i;
const roundSkus = PRODUCTS
  .filter((product) => ROUND_PATTERN.test(`${product.basinDimensions ?? ""} ${product.dimensions ?? ""} ${product.category ?? ""}`))
  .map((product) => product.sku);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type DecodedPng = { width: number; height: number; colorType: number; bitDepth: number; alpha: Uint8Array | null; hasTransparencyChunk: boolean };

/** Minimal PNG reader: 8-bit, non-interlaced RGBA or grey+alpha (what the cut-outs use). Returns the alpha plane. */
function decodePng(buffer: Buffer): DecodedPng {
  assert.ok(buffer.subarray(0, 8).equals(PNG_SIGNATURE), "not a PNG");
  let offset = 8;
  let header: { width: number; height: number; bitDepth: number; colorType: number; interlace: number } | null = null;
  const data: Buffer[] = [];
  let hasTransparencyChunk = false;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") header = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), bitDepth: body[8]!, colorType: body[9]!, interlace: body[12]! };
    else if (type === "IDAT") data.push(body);
    else if (type === "tRNS") hasTransparencyChunk = true;
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  assert.ok(header, "no IHDR");
  const { width, height, bitDepth, colorType, interlace } = header;
  if (colorType !== 6 && colorType !== 4) return { width, height, colorType, bitDepth, alpha: null, hasTransparencyChunk };
  assert.equal(bitDepth, 8, "only 8-bit alpha PNGs are decoded here");
  assert.equal(interlace, 0, "interlaced PNGs are not decoded here");
  const bytesPerPixel = colorType === 6 ? 4 : 2;
  const stride = width * bytesPerPixel;
  const raw = inflateSync(Buffer.concat(data));
  assert.equal(raw.length, (stride + 1) * height, "unexpected decompressed size");
  const previous = new Uint8Array(stride);
  const current = new Uint8Array(stride);
  const alpha = new Uint8Array(width * height);
  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)]!;
    const line = raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1));
    for (let index = 0; index < stride; index += 1) {
      const left = index >= bytesPerPixel ? current[index - bytesPerPixel]! : 0;
      const up = previous[index]!;
      const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel]! : 0;
      let value = line[index]!;
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const distanceLeft = Math.abs(estimate - left);
        const distanceUp = Math.abs(estimate - up);
        const distanceUpLeft = Math.abs(estimate - upLeft);
        value += distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft ? left : distanceUp <= distanceUpLeft ? up : upLeft;
      } else assert.equal(filter, 0, `unknown PNG filter ${filter}`);
      current[index] = value & 255;
    }
    for (let column = 0; column < width; column += 1) alpha[row * width + column] = current[column * bytesPerPixel + bytesPerPixel - 1]!;
    previous.set(current);
  }
  return { width, height, colorType, bitDepth, alpha, hasTransparencyChunk };
}

const decoded = new Map<string, DecodedPng>();
for (const sku of SKUS) {
  const file = join(assetDir, `${sku}.png`);
  if (existsSync(file)) decoded.set(sku, decodePng(readFileSync(file)));
}
const share = (alpha: Uint8Array, predicate: (value: number) => boolean) => alpha.reduce((count, value) => count + (predicate(value) ? 1 : 0), 0) / alpha.length;

describe("the 30 transparent top-view PNGs (job-212)", () => {
  it("has exactly one PNG and one WebP per catalog model KF001-KF030, plus only the manifest and the contact sheet", () => {
    assert.ok(existsSync(assetDir), "public/assets/basins-transparent is missing");
    const names = readdirSync(assetDir).sort();
    assert.deepEqual(names.filter((name) => /^KF\d{3}\.png$/.test(name)), SKUS.map((sku) => `${sku}.png`), "one PNG per model");
    assert.deepEqual(names.filter((name) => /^KF\d{3}\.webp$/.test(name)), SKUS.map((sku) => `${sku}.webp`), "one WebP per model");
    assert.deepEqual(names.filter((name) => !/^KF\d{3}\./.test(name)), ["contact-sheet-all-30.jpg", "manifest.json"], "anything else in this folder is served publicly - add it here on purpose");
    for (const sku of SKUS) assert.ok(PRODUCTS.some((product) => product.sku === sku), `${sku} is not in the catalog`);
  });

  it("manifest.json lists the 30 files with their real size and checksum prefix", () => {
    const manifest = JSON.parse(readFileSync(join(assetDir, "manifest.json"), "utf8")) as { count: number; items: Array<{ sku: string; file: string; bytes: number; sha256_16: string }> };
    assert.equal(manifest.count, 30);
    assert.deepEqual(manifest.items.map((item) => item.sku), SKUS);
    for (const item of manifest.items) {
      assert.equal(item.file, `assets/basins-transparent/${item.sku}.png`);
      const bytes = readFileSync(join(assetDir, `${item.sku}.png`));
      assert.equal(item.bytes, bytes.length, `${item.sku}: manifest size is out of date`);
      assert.equal(item.sha256_16, createHash("sha256").update(bytes).digest("hex").slice(0, 16), `${item.sku}: manifest checksum is out of date - the image changed without regenerating manifest.json`);
    }
  });

  it("every file is a real PNG with an alpha channel (RGBA or grey+alpha, 8 bit)", () => {
    for (const sku of SKUS) {
      const png = decoded.get(sku);
      assert.ok(png, `${sku}.png is missing`);
      assert.ok(png.colorType === 6 || png.colorType === 4, `${sku}.png has colour type ${png.colorType}: no alpha channel`);
      assert.equal(png.bitDepth, 8, sku);
    }
  });

  it("the alpha channel is actually used: every image has fully transparent pixels and a solid body", () => {
    for (const sku of SKUS) {
      const alpha = decoded.get(sku)!.alpha!;
      assert.ok(alpha.some((value) => value === 0), `${sku}.png has no fully transparent pixel`);
      assert.ok(share(alpha, (value) => value === 255) > 0.5, `${sku}.png is mostly see-through`);
    }
  });

  it("round basins are masked round: a quarter of the square is transparent outside the circle, in every round model", () => {
    assert.deepEqual(roundSkus, ["KF023", "KF024", "KF025", "KF026"], "the catalog's round models changed - update the expectation with the images");
    for (const sku of roundSkus) {
      const png = decoded.get(sku)!;
      const transparent = share(png.alpha!, (value) => value < 10);
      // a circle inside its square leaves 1 - pi/4 = 21.5% outside it
      assert.ok(transparent > 0.18 && transparent < 0.25, `${sku}: ${(transparent * 100).toFixed(1)}% transparent, expected about 21%`);
      assert.equal(png.alpha![0], 0, `${sku}: the top-left corner must be transparent`);
      assert.equal(png.alpha![png.width * png.height - 1], 0, `${sku}: the bottom-right corner must be transparent`);
      assert.equal(png.alpha![Math.floor(png.height / 2) * png.width + Math.floor(png.width / 2)], 255, `${sku}: the centre must be solid`);
    }
  });

  it("rectangular products keep their whole outline (almost nothing but the outer corner pixels is removed)", () => {
    for (const sku of SKUS.filter((candidate) => !roundSkus.includes(candidate))) {
      const transparent = share(decoded.get(sku)!.alpha!, (value) => value < 10);
      assert.ok(transparent < 0.01, `${sku}: ${(transparent * 100).toFixed(2)}% transparent - a rectangular product should not be cut into`);
    }
  });

  it("the PNGs are web-sized: under 1.5 MB each, 20 MB for all thirty", () => {
    let total = 0;
    for (const sku of SKUS) {
      const bytes = statSync(join(assetDir, `${sku}.png`)).size;
      assert.ok(bytes < 1.5 * 1024 * 1024, `${sku}.png is ${(bytes / 1024 / 1024).toFixed(2)} MB`);
      total += bytes;
    }
    assert.ok(total < 20 * 1024 * 1024, `${(total / 1024 / 1024).toFixed(1)} MB in total`);
  });

  it("the PNG decoder itself rejects a file that is not a PNG, and reads alpha (incl. the Sub filter) from hand-built ones", () => {
    assert.throws(() => decodePng(Buffer.from("GIF89a")), /not a PNG/);
    const chunk = (type: string, body: Buffer) => {
      const head = Buffer.alloc(8);
      head.writeUInt32BE(body.length, 0);
      head.write(type, 4, "ascii");
      return Buffer.concat([head, body, Buffer.alloc(4)]); // the CRC is not checked by the reader
    };
    const png = (colorType: number, scanlines: number[]) => {
      const ihdr = Buffer.alloc(13);
      ihdr.writeUInt32BE(2, 0);
      ihdr.writeUInt32BE(scanlines.length / (colorType === 6 ? 9 : 5), 4);
      ihdr[8] = 8;
      ihdr[9] = colorType;
      return Buffer.concat([PNG_SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.from(scanlines))), chunk("IEND", Buffer.alloc(0))]);
    };
    // one RGBA row, no filter: a transparent pixel then an opaque one
    assert.deepEqual([...decodePng(png(6, [0, 9, 9, 9, 0, 9, 9, 9, 255])).alpha!], [0, 255]);
    // one RGBA row with the Sub filter: the second pixel is stored as a difference from the first (40 + 215 = 255)
    assert.deepEqual([...decodePng(png(6, [1, 10, 20, 30, 40, 1, 1, 1, 215])).alpha!], [40, 255]);
    // grey + alpha
    assert.deepEqual([...decodePng(png(4, [0, 7, 0, 7, 255])).alpha!], [0, 255]);
    // no alpha channel at all (RGB) reports none
    assert.equal(decodePng(png(2, [])).alpha, null);
  });
});

/** Every `selector { body }` rule of the stylesheet (media blocks flattened - the rules of interest are top level). */
function cssRules(source: string) {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...withoutComments.matchAll(/(^|\n)([^{}\n][^{}]*?)\s*\{([^{}]*)\}/g)].map((match) => ({ selector: match[2]!.trim(), body: match[3]! }));
}
const rules = cssRules(css);
const ruleFor = (selector: string) => rules.find((rule) => rule.selector === selector);
const declarations = (body: string) => new Map(body.split(";").map((item) => item.trim()).filter(Boolean).map((item) => {
  const separator = item.indexOf(":");
  return [item.slice(0, separator).trim(), item.slice(separator + 1).trim()] as const;
}));

describe("top-view styling in src/index.css (job-212)", () => {
  const image = ruleFor(".studio-basin-real-topview-img");
  const wrapper = ruleFor(".studio-basin-top-view--real");

  it("the image fits inside its box (object-fit: contain, not cover) so the whole cut-out shows", () => {
    assert.ok(image, ".studio-basin-real-topview-img rule is missing");
    assert.equal(declarations(image.body).get("object-fit"), "contain");
    for (const rule of rules.filter((candidate) => candidate.selector.split(",").some((part) => part.trim().startsWith(".studio-basin-real-topview-img")))) {
      assert.notEqual(declarations(rule.body).get("object-fit"), "cover", rule.selector);
    }
  });

  it("the cut-out casts a small drop-shadow of its own outline", () => {
    assert.equal(declarations(image!.body).get("filter"), "drop-shadow(0 2px 5px rgba(0, 0, 0, 0.25))");
  });

  it("no frame is left: no border, background, box-shadow, radius or clipping on the image or its wrapper", () => {
    assert.ok(wrapper, ".studio-basin-top-view--real rule is missing");
    for (const rule of [image!, wrapper]) {
      const map = declarations(rule.body);
      for (const property of ["border", "border-radius", "background", "background-color", "box-shadow", "outline"]) {
        assert.equal(map.has(property), false, `${rule.selector} still sets ${property}`);
      }
    }
    assert.equal(declarations(wrapper.body).get("overflow"), "visible", "overflow: hidden would clip the drop-shadow");
    assert.equal(rules.some((rule) => /^\.studio-basin-(top-view--real|real-topview-img)\.is-(round|rectangular)$/.test(rule.selector)), false, "the old shape-specific clipping rules are gone");
  });

  it("nothing outside the .studio-basin-* / .studio-placement-visual blocks uses that shadow", () => {
    const withShadow = rules.filter((rule) => rule.body.includes("drop-shadow(0 2px 5px rgba(0, 0, 0, 0.25))"));
    assert.ok(withShadow.length >= 1);
    for (const rule of withShadow) {
      assert.ok(rule.selector.split(",").every((part) => /^\.studio-(basin-|placement-visual)/.test(part.trim())), `${rule.selector} carries the basin drop-shadow`);
    }
  });

  it("the component still uses exactly these class names for the real photo", () => {
    assert.match(studioPage, /studio-basin-top-view studio-basin-top-view--real \$\{shapeClass\}/);
    assert.match(studioPage, /className=\{`studio-basin-real-topview-img \$\{shapeClass\}`\}/);
  });

  it("adds no new custom property, import or @font-face while at it", () => {
    const start = css.indexOf("/* The real top-view photos are transparent PNG cut-outs (job-212)");
    const end = css.indexOf(".studio-basin-top-view.is-round {", start);
    assert.ok(start > 0 && end > start);
    assert.doesNotMatch(css.slice(start, end), /@import|@font-face|(^|[\s;{])--[a-z][\w-]*\s*:/);
  });

  it("the CSS rule parser itself reads a rule", () => {
    assert.deepEqual(cssRules("/* note */\n.a { b: c; }\n.d, .e { f: g; h: i }"), [{ selector: ".a", body: " b: c; " }, { selector: ".d, .e", body: " f: g; h: i " }]);
  });
});
