/**
 * Real stone texture on the Studio canvas (job-211).
 *
 * The plan shows the active stone's own close-up photo (its catalog imageUrl) instead of a flat tone; print layout,
 * saved-draft cards and the saved quote stay flat. StudioFootprint is rendered for real (tsx + react-dom/server,
 * like the admin component tests); the loading hook is cut out of StudioPage.tsx and run against a stub React and a
 * stub Image; the rest of the wiring is checked as source text.
 *
 * Why imageUrl and not slabImageUrl: slabImageUrl is the whole slab photographed on the factory floor (dark concrete
 * round a trapezoid of stone, caption along the bottom), which cannot be laid over a sheet; imageUrl is a flat
 * close-up of the stone for 60 of the 64 colours.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, describe, it } from "node:test";

const testDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(testDir, "..");
const tsxLoaderPath = join(appRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");
const footprintUrl = pathToFileURL(join(appRoot, "src/components/StudioFootprint.tsx")).href;
const modelUrl = pathToFileURL(join(appRoot, "src/data/studio-model.ts")).href;
const studioPage = readFileSync(join(appRoot, "src/components/StudioPage.tsx"), "utf8");
const footprintSource = readFileSync(join(appRoot, "src/components/StudioFootprint.tsx"), "utf8");

const TEXTURE_URL = "https://knightbasins.example.test/api/uploads/catalog-vd345.png?v=1";
const TRICKY_URL = 'https://example.test/a b/(x)"y".jpg';
const ASPECT = 2.78; // a 745 x 268 catalog photo

const HARNESS_SCRIPT = `
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const { StudioFootprint, stoneTextureScalePercent, STONE_TEXTURE_EDGE_CROP } = await import(${JSON.stringify(footprintUrl)});
const model = await import(${JSON.stringify(modelUrl)});
const edges = { top: "normal", right: "normal", bottom: "normal", left: "normal" };
const piece = { ...model.buildCustomShapePiece("piece-1", "l-left", [
  { widthMm: 1800, depthMm: 600, edges }, { widthMm: 600, depthMm: 1200, edges },
]), name: "ชิ้นงาน 1" };
const render = (props) => renderToStaticMarkup(createElement(StudioFootprint, { piece, testId: "canvas", ...props }));
const coverViolations = [];
for (const [w, h] of [[600, 600], [1800, 600], [3200, 600], [600, 1200], [600, 3000], [1000, 1000]]) {
  for (const aspect of [0.82, 1, 1.4, 2.78, 4.9]) {
    const photoWidth = (stoneTextureScalePercent(w, h, aspect) / 100) * w;
    if (photoWidth < w * STONE_TEXTURE_EDGE_CROP - 1e-6) coverViolations.push(w + "x" + h + " @" + aspect + " too narrow");
    if (photoWidth / aspect < h * STONE_TEXTURE_EDGE_CROP - 1e-6) coverViolations.push(w + "x" + h + " @" + aspect + " too short");
  }
}
process.stdout.write(JSON.stringify({
  coverViolations,
  edgeCrop: STONE_TEXTURE_EDGE_CROP,
  scales: [
    [1800, 600, 2.78], [600, 1200, 2.78], [1800, 600, 1], [600, 1200, 1], [1800, 600, 0.82], [600, 2400, 1],
    [1800, 600, 0], [1800, 600, NaN], [0, 600, 2], [600, 0, 2],
  ].map(([w, h, a]) => stoneTextureScalePercent(w, h, a)),
  textured: render({ stoneTone: "#fbfaf4", stoneTexture: ${JSON.stringify(TEXTURE_URL)}, stoneTextureAspect: ${ASPECT} }),
  flat: render({ stoneTone: "#fbfaf4" }),
  dark: render({ stoneTone: "#1a1a1a", stoneTexture: ${JSON.stringify(TEXTURE_URL)}, stoneTextureAspect: 1 }),
  tricky: render({ stoneTone: "#fbfaf4", stoneTexture: ${JSON.stringify(TRICKY_URL)}, stoneTextureAspect: 1 }),
  noAspect: render({ stoneTone: "#fbfaf4", stoneTexture: ${JSON.stringify(TEXTURE_URL)} }),
  withChild: render({ stoneTone: "#fbfaf4", stoneTexture: ${JSON.stringify(TEXTURE_URL)}, stoneTextureAspect: 1, children: createElement("span", { "data-testid": "child-note" }, "note") }),
}));
`;

type Harness = {
  coverViolations: string[];
  edgeCrop: number;
  scales: number[];
  textured: string;
  flat: string;
  dark: string;
  tricky: string;
  noAspect: string;
  withChild: string;
};
let harness: Harness;
let tmpDir: string | undefined;

before(() => {
  if (!existsSync(tsxLoaderPath)) throw new Error(`Expected tsx's loader at ${tsxLoaderPath}; run "pnpm install" at the repo root.`);
  tmpDir = mkdtempSync(join(appRoot, "node_modules", ".studio-real-stone-texture-test-"));
  const tsconfigPath = join(tmpDir, "tsconfig.override.json");
  const harnessPath = join(tmpDir, "harness.mjs");
  writeFileSync(tsconfigPath, JSON.stringify({ extends: join(appRoot, "tsconfig.json").replace(/\\/g, "/"), compilerOptions: { jsx: "react-jsx" } }), "utf8");
  writeFileSync(harnessPath, HARNESS_SCRIPT, "utf8");
  const stdout = execFileSync(process.execPath, ["--import", pathToFileURL(tsxLoaderPath).href, harnessPath], {
    cwd: appRoot,
    env: { ...process.env, TSX_TSCONFIG_PATH: tsconfigPath },
    encoding: "utf8",
  });
  harness = JSON.parse(stdout) as Harness;
});

after(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

const rectangleTags = (markup: string) => markup.match(/<div class="studio-piece-rectangle[^"]*"[^>]*>/g) ?? [];
const sizesOf = (markup: string) => rectangleTags(markup).map((tag) => Number(tag.match(/background-size:(\d+)% auto/)?.[1]));

describe("StudioFootprint paints the stone photo on every sheet", () => {
  it("every rectangle of an L-shaped piece gets a background-image pointing at the photo, centred and not tiled", () => {
    const tags = rectangleTags(harness.textured);
    assert.equal(tags.length, 2);
    for (const tag of tags) {
      assert.ok(tag.includes(`background-image:url(&quot;${TEXTURE_URL.replace(/&/g, "&amp;")}&quot;)`), tag);
      assert.match(tag, /background-position:50% 50%/);
      assert.match(tag, /background-repeat:no-repeat/);
    }
  });

  it("sizes each sheet's photo to cover that sheet, from the photo's proportions", () => {
    // 745 x 268 photo (2.78): the 1800 x 600 sheet is covered by width alone; the 600 x 1200 leg needs 1200 x 2.78 = 3336 mm of width
    assert.deepEqual(sizesOf(harness.textured), [115, 640]);
    assert.deepEqual(sizesOf(harness.noAspect), [115, 230], "an unknown proportion is treated as square, never as a missing size");
  });

  it("stoneTextureScalePercent: cover + 15% for every proportion, falling back to 115% on bad input", () => {
    assert.equal(harness.edgeCrop, 1.15);
    // [1800x600 @2.78, 600x1200 @2.78, 1800x600 @1, 600x1200 @1, 1800x600 @0.82, 600x2400 @1, then four bad inputs]
    assert.deepEqual(harness.scales, [115, 640, 115, 230, 115, 460, 115, 115, 115, 115]);
  });

  it("the enlarged photo always covers the whole sheet with the 15% edge crop to spare (6 sheet shapes x 5 photo shapes)", () => {
    assert.deepEqual(harness.coverViolations, []);
  });

  it("without a texture no rectangle carries an inline background (the stylesheet's flat tone and speckle stay)", () => {
    for (const tag of rectangleTags(harness.flat)) assert.doesNotMatch(tag, /background/);
    assert.doesNotMatch(harness.flat, /background-image/);
  });

  it("keeps the flat tone variable underneath the photo as the fallback, and the ink colours chosen from the tone", () => {
    assert.match(harness.textured, /--studio-stone-tone:#fbfaf4/);
    assert.match(harness.textured, /--studio-stone-ink:#17324a/, "light stone keeps dark ink");
    assert.match(harness.dark, /--studio-stone-ink:#ffffff/, "dark stone keeps white ink over the photo");
  });

  it("quotes the address safely, so odd characters cannot break out of url()", () => {
    const tag = rectangleTags(harness.tricky)[0]!;
    assert.match(tag, /background-image:url\(&quot;https:\/\/example\.test\/a b\/\(x\)\\&quot;y\\&quot;\.jpg&quot;\)/);
  });

  it("still renders the dimension labels and children (the photo sits behind them, not instead of them)", () => {
    assert.match(harness.textured, /<span class="studio-piece-size">1800 × 600<\/span>/);
    assert.match(harness.textured, /<span class="studio-piece-size">600 × 1200<\/span>/);
    assert.match(harness.withChild, /data-testid="child-note"/);
  });

  it("is opt-in: StudioFootprint takes the texture from props and fetches nothing itself", () => {
    assert.match(footprintSource, /stoneTexture\?: string;/);
    assert.match(footprintSource, /stoneTextureAspect\?: number;/);
    assert.doesNotMatch(footprintSource, /new Image\(|fetch\(|slabImageUrl|quoteImageUrl|imageUrl/);
  });
});

describe("only the active stone's close-up photo is loaded (useLoadedStoneTexture, run for real)", () => {
  const start = studioPage.indexOf("function useLoadedStoneTexture(");
  const end = studioPage.indexOf("function stoneSlabViewerImages(", start);
  assert.ok(start >= 0 && end > start, "useLoadedStoneTexture not found");
  const source = stripTypeScriptTypes(studioPage.slice(start, end));

  type FakeImageInstance = { src: string; naturalWidth: number; naturalHeight: number; onload: null | (() => void); onerror: null | (() => void) };
  type Texture = { url: string; aspect: number } | undefined;

  /** A one-component React stand-in: state survives re-renders, effects run when asked and clean up before the next one. */
  const mount = () => {
    const images: FakeImageInstance[] = [];
    class FakeImage {
      src = "";
      naturalWidth = 0;
      naturalHeight = 0;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      constructor() { images.push(this); }
    }
    let state: unknown;
    let initialised = false;
    let cleanup: void | (() => void);
    let pending: null | (() => void | (() => void)) = null;
    let lastDeps: unknown[] | undefined;
    const useState = (initial: unknown) => {
      if (!initialised) { state = initial; initialised = true; }
      return [state, (next: unknown) => { state = next; rerender(); }];
    };
    const useEffect = (effect: () => void | (() => void), deps: unknown[]) => {
      if (lastDeps && deps.every((dep, index) => Object.is(dep, lastDeps![index]))) return;
      lastDeps = deps;
      pending = effect;
    };
    const hook = new Function("useState", "useEffect", "Image", `${source}\nreturn useLoadedStoneTexture;`)(useState, useEffect, FakeImage) as (url: string | undefined) => Texture;
    let currentUrl: string | undefined;
    let result: Texture;
    function flushEffects() {
      while (pending) {
        const effect = pending;
        pending = null;
        if (typeof cleanup === "function") cleanup();
        cleanup = effect();
      }
    }
    function rerender() { result = hook(currentUrl); flushEffects(); }
    return {
      images,
      render(url: string | undefined) { currentUrl = url; rerender(); return result; },
      get value() { return result; },
      load(index: number, naturalWidth: number, naturalHeight: number) {
        const image = images[index]!;
        image.naturalWidth = naturalWidth;
        image.naturalHeight = naturalHeight;
        image.onload?.();
      },
    };
  };

  it("asks for nothing when no stone is active", () => {
    const component = mount();
    assert.equal(component.render(undefined), undefined);
    assert.equal(component.images.length, 0);
  });

  it("requests exactly the one photo, and shows it, with its proportions, only once it has loaded", () => {
    const component = mount();
    assert.equal(component.render(TEXTURE_URL), undefined, "flat tone while the photo is on its way");
    assert.deepEqual(component.images.map((image) => image.src), [TEXTURE_URL]);
    component.load(0, 745, 268);
    assert.deepEqual(component.value, { url: TEXTURE_URL, aspect: 745 / 268 });
  });

  it("treats a photo that reports no size as square instead of failing", () => {
    const component = mount();
    component.render(TEXTURE_URL);
    component.load(0, 0, 0);
    assert.deepEqual(component.value, { url: TEXTURE_URL, aspect: 1 });
  });

  it("switching stone drops the old photo at once and ignores a late answer for it", () => {
    const component = mount();
    component.render(TEXTURE_URL);
    component.load(0, 600, 600);
    assert.equal(component.value?.url, TEXTURE_URL);
    const other = "https://knightbasins.example.test/api/uploads/catalog-bw010.jpg";
    assert.equal(component.render(other), undefined);
    assert.deepEqual(component.images.map((image) => image.src), [TEXTURE_URL, other]);
    component.images[0]!.onload?.();
    assert.equal(component.value, undefined, "the first photo's late load must not show");
    component.load(1, 744, 269);
    assert.equal(component.value?.url, other);
  });

  it("a photo that fails to load leaves the flat tone", () => {
    const component = mount();
    component.render(TEXTURE_URL);
    component.images[0]!.onerror!();
    assert.equal(component.value, undefined);
  });

  it("never touches slabImageUrl or quoteImageUrl", () => {
    assert.doesNotMatch(source, /slabImageUrl|quoteImageUrl/);
  });
});

describe("StudioPage wiring", () => {
  it("hands the canvas the active stone's imageUrl (not the slab photo, not the quote image), only when a stone is chosen", () => {
    assert.match(studioPage, /const activeStoneTexture = useLoadedStoneTexture\(state\.activeStone \? activeStoneColor\.imageUrl : undefined\);/);
    assert.match(studioPage, /stoneTexture=\{activeStoneTexture\?\.url\}\s+stoneTextureAspect=\{activeStoneTexture\?\.aspect\}/);
    assert.doesNotMatch(studioPage, /useLoadedStoneTexture\([^)]*(slabImageUrl|quoteImageUrl)/);
  });

  it("the live canvas editor forwards both to its StudioFootprint", () => {
    assert.match(studioPage, /<StudioFootprint piece=\{piece\} stoneTone=\{stoneTone\} stoneTexture=\{stoneTexture\} stoneTextureAspect=\{stoneTextureAspect\} zoom=\{zoom\}/);
    assert.match(studioPage, /\/\*\* Loaded photo of the active stone, or undefined \(flat tone only\)\. \*\/\s+stoneTexture\?: string;\s+stoneTextureAspect\?: number;/);
  });

  it("is passed in exactly one place: print layout, saved-draft cards, the legacy editor and the quote stay flat", () => {
    assert.equal((studioPage.match(/stoneTexture=\{/g) ?? []).length, 2, "one for the editor, one for its footprint");
    const between = (from: string, to: string) => studioPage.slice(studioPage.indexOf(from), studioPage.indexOf(to));
    assert.doesNotMatch(between("function StudioPrintLayout(", "function StudioDraftCard("), /stoneTexture/);
    assert.doesNotMatch(between("function StudioDraftCard(", "function StudioDraftDrawer("), /stoneTexture/);
    assert.doesNotMatch(between("function StudioPieceEditorLegacy(", "function StudioPieceEditor("), /stoneTexture/);
    assert.match(between("function StudioPrintLayout(", "function StudioDraftCard("), /stoneTone=\{stoneColorByName\(state\.activeStone, stoneColors\)\.tone\} className="studio-print-canvas"/);
    assert.doesNotMatch(readFileSync(join(appRoot, "src/App.tsx"), "utf8"), /stoneTexture/);
  });

  it("shows the sample-texture note over the canvas (bottom left, clear of the joint hint on the right), only while the photo is showing", () => {
    assert.match(studioPage, /\{stoneTexture && <span className="pointer-events-none absolute bottom-1 left-2[^"]*" data-testid="text-studio-stone-texture-note">ลายหินตัวอย่างเพื่อการแสดงผล · หน้างานจริงขึ้นกับลายแร่ธรรมชาติ<\/span>\}/);
  });

  it("styles the note with utility classes only (no stylesheet changes)", () => {
    const note = studioPage.match(/<span className="(pointer-events-none[^"]*)" data-testid="text-studio-stone-texture-note"/)?.[1] ?? "";
    assert.ok(note.length > 0);
    assert.doesNotMatch(note, /\bstudio-/);
  });

  it("leaves the price and export code alone", () => {
    const hook = studioPage.slice(studioPage.indexOf("function useLoadedStoneTexture("), studioPage.indexOf("function stoneSlabViewerImages("));
    assert.doesNotMatch(hook, /studioEstimate|createStudioDxf|downloadStudio|printStudioLayout/);
  });
});
