import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const viewer = readFileSync(new URL("../src/components/StoneSlabViewer.tsx", import.meta.url), "utf8");
const catalog = readFileSync(new URL("../src/data/catalog.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

describe("StoneSlabViewer source", () => {
  it("renders a portal-backed full slab viewer with existing basin gallery classes", () => {
    assert.match(viewer, /ดูภาพเต็มแผ่น/);
    assert.match(viewer, /data-testid="button-stone-slab-open"/);
    assert.match(viewer, /data-testid="stone-slab-overlay"/);
    assert.match(viewer, /createPortal\([\s\S]*document\.body/);
    assert.match(viewer, /className="basin-gallery-overlay"/);
    assert.match(viewer, /className="basin-gallery-close"/);
    assert.match(viewer, /document\.body\.style\.overflow\s*=\s*"hidden"/);
    assert.match(viewer, /event\.key\s*===\s*"Escape"/);
    assert.match(viewer, /^(?![\s\S]*^\s*\.[A-Za-z_-][\w-]*\s*\{)[\s\S]*$/m);
  });

  it("adds all image role fields to StoneColor and CatalogStoneRecord", () => {
    assert.match(catalog, /export type StoneColor\s*=\s*\{[\s\S]*?galleryImageUrls\?:\s*string\[\]/);
    assert.match(catalog, /export type StoneColor\s*=\s*\{[\s\S]*?quoteImageUrl\?:\s*string/);
    assert.match(catalog, /export type StoneColor\s*=\s*\{[\s\S]*?slabImageUrl\?:\s*string/);
    assert.match(catalog, /export type CatalogStoneRecord\s*=\s*\{[\s\S]*?galleryImageUrls\?:\s*string\[\]\s*\|\s*null/);
    assert.match(catalog, /export type CatalogStoneRecord\s*=\s*\{[\s\S]*?quoteImageUrl\?:\s*string\s*\|\s*null/);
    assert.match(catalog, /export type CatalogStoneRecord\s*=\s*\{[\s\S]*?slabImageUrl\?:\s*string\s*\|\s*null/);
  });

  it("uses slab images on StonePage and quote-specific imagery in QuoteStoneRow", () => {
    assert.match(app, /function StonePage[\s\S]*?color\.slabImageUrl/);
    assert.match(app, /function StonePage[\s\S]*?color\.galleryImageUrls/);
    assert.match(app, /function QuoteStoneRow[\s\S]*?selectedStone\.quoteImageUrl\s*\?\?\s*selectedStone\.imageUrl/);
  });
});