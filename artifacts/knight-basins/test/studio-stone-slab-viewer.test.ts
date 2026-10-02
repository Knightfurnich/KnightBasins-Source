import assert from "node:assert/strict";
import * as fs from "node:fs";
import { describe, it } from "node:test";

const studioPageSource = fs.readFileSync(
  new URL("../src/components/StudioPage.tsx", import.meta.url),
  "utf8",
);
const viewerSource = fs.readFileSync(
  new URL("../src/components/StoneSlabViewer.tsx", import.meta.url),
  "utf8",
);

describe("Studio stone slab viewer source", () => {
  it("imports the viewer and only shows it when a slab image is available", () => {
    assert.match(studioPageSource, /import \{ StoneSlabViewer \} from "\.\/StoneSlabViewer";/);
    assert.match(studioPageSource, /activeStone\.slabImageUrl && activeStoneSlabImages\.length > 0/);
    assert.match(studioPageSource, /mode === "studio" && stone\.slabImageUrl && slabImages\.length > 0/);
  });

  it("uses the requested active and per-stone button test IDs", () => {
    assert.match(studioPageSource, /buttonTestId="button-studio-active-stone-slab-open"/);
    assert.match(studioPageSource, /buttonTestId=\{`button-studio-stone-slab-\$\{stone\.code\}`\}/);
    assert.match(studioPageSource, /event\.stopPropagation\(\)/);
  });

  it("puts the slab image first and removes duplicate gallery URLs", () => {
    assert.match(studioPageSource, /function stoneSlabViewerImages\(/);
    assert.match(studioPageSource, /if \(!slabImageUrl\) return \[\]/);
    assert.match(studioPageSource, /Array\.from\(new Set\(\[/);
    assert.match(studioPageSource, /slabImageUrl,\s*\.\.\.\(stone\.galleryImageUrls \?\? \[\]\)/);
  });

  it("allows Studio instances to customize the viewer trigger", () => {
    assert.match(studioPageSource, /buttonLabel="ดูลายแผ่นจริง"/);
    assert.match(viewerSource, /buttonLabel\?: string/);
    assert.match(viewerSource, /buttonTestId\?: string/);
  });
});