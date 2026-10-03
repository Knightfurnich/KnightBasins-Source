/**
 * Real stone texture on the Studio canvas (job-211).
 *
 * The plan shows the active stone's own photo (its slabImageUrl, the small ~42 KB slab picture) instead of a
 * flat tone; print layout, saved-draft cards and the saved quote stay flat. StudioFootprint is rendered for
 * real (tsx + react-dom/server, like the admin component tests); the loading hook is cut out of StudioPage.tsx
 * and run against a stub React and a stub Image; the rest of the wiring is checked as source text.
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

const SLAB_URL = "https://api.example.test/kb/images/slab/MU010.jpg";
const QUOTE_URL = "https://api.example.test/kb/images/quote/MU010.png";
const TRICKY_URL = 'https://example.test/a b/(x)"y".jpg';

const HARNESS_SCRIPT = `
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const { StudioFootprint, stoneTextureScalePercent } = await import(${JSON.stringify(footprintUrl)});
const model = await import(${JSON.stringify(modelUrl)});
const edges = { top: "normal", right: "normal", bottom: "normal", left: "normal" };
const piece = { ...model.buildCustomShapePiece("piece-1", "l-left", [
  { widthMm: 1800, depthMm: 600, edges }, { widthMm: 600, depthMm: 1200, edges },
]), name: "ชิ้นงาน 1" };
const render = (props) => renderToStaticMarkup(createElement(StudioFootprint, { piece, testId: "canvas", ...props }));
process.stdout.write(JSON.stringify({
  scales: [[1800, 600], [600, 1200], [600, 1800], [600, 2400], [0, 600], [600, 0], [NaN, 600]].map(([w, h]) => stoneTextureScalePercent(w, h)),
  textured: render({ stoneTone: "#fbfaf4", stoneTexture: ${JSON.stringify(SLAB_URL)} }),
  flat: render({ stoneTone: "#fbfaf4" }),
  dark: render({ stoneTone: "#1a1a1a", stoneTexture: ${JSON.stringify(SLAB_URL)} }),
  tricky: render({ stoneTone: "#fbfaf4", stoneTexture: ${JSON.stringify(TRICKY_URL)} }),
  withChild: render({ stoneTone: "#fbfaf4", stoneTexture: ${JSON.stringify(SLAB_URL)}, children: createElement("span", { "data-testid": "child-note" }, "note") }),
}));
`;

type Harness = { scales: number[]; textured: string; flat: string; dark: string; tricky: string; withChild: string };
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

describe("StudioFootprint paints the stone photo on every sheet", () => {
  it("every rectangle of an L-shaped piece gets a background-image pointing at the slab photo, centred and not tiled", () => {
    const tags = rectangleTags(harness.textured);
    assert.equal(tags.length, 2);
    for (const tag of tags) {
      assert.match(tag, new RegExp(`background-image:url\\(&quot;${SLAB_URL.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}&quot;\\)`));
      assert.match(tag, /background-position:50% 50%/);
      assert.match(tag, /background-repeat:no-repeat/);
    }
  });

  it("shows only the middle of the slab photo: each sheet's photo is enlarged so the factory floor and caption stay out of view", () => {
    const sizes = rectangleTags(harness.textured).map((tag) => Number(tag.match(/background-size:(\d+)% auto/)?.[1]));
    assert.deepEqual(sizes, [400, 400], "1800 x 600 and 600 x 1200 both sit on the 400% minimum");
  });

  it("enlarges a tall sheet's photo further so that no more than half of the photo's height is used", () => {
    // 400% minimum; above it 100 x height / (0.5 x width x 1.3), rounded up: 600 x 1800 -> 462, 600 x 2400 -> 616
    assert.deepEqual(harness.scales, [400, 400, 462, 616, 400, 400, 400]);
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

  it("is opt-in: StudioFootprint takes the texture from a prop and fetches nothing itself", () => {
    assert.match(footprintSource, /stoneTexture\?: string;/);
    assert.doesNotMatch(footprintSource, /new Image\(|fetch\(|slabImageUrl|quoteImageUrl/);
  });
});

describe("only the active stone's small slab photo is loaded (useLoadedStoneTexture, run for real)", () => {
  const start = studioPage.indexOf("function useLoadedStoneTexture(");
  const end = studioPage.indexOf("function stoneSlabViewerImages(", start);
  assert.ok(start >= 0 && end > start, "useLoadedStoneTexture not found");
  const source = stripTypeScriptTypes(studioPage.slice(start, end));

  /** A one-component React stand-in: state survives re-renders, effects run when asked and clean up before the next one. */
  const mount = () => {
    const images: Array<{ src: string; onload: null | (() => void); onerror: null | (() => void) }> = [];
    class FakeImage {
      src = "";
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
    const hook = new Function("useState", "useEffect", "Image", `${source}\nreturn useLoadedStoneTexture;`)(useState, useEffect, FakeImage) as (url: string | undefined) => string | undefined;
    let currentUrl: string | undefined;
    let result: string | undefined;
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
    };
  };

  it("asks for nothing when no stone is active", () => {
    const component = mount();
    assert.equal(component.render(undefined), undefined);
    assert.equal(component.images.length, 0);
  });

  it("requests exactly the one slab photo, and shows it only once it has loaded", () => {
    const component = mount();
    assert.equal(component.render(SLAB_URL), undefined, "flat tone while the photo is on its way");
    assert.deepEqual(component.images.map((image) => image.src), [SLAB_URL]);
    component.images[0]!.onload!();
    assert.equal(component.value, SLAB_URL);
  });

  it("switching stone drops the old photo at once and ignores a late answer for it", () => {
    const component = mount();
    component.render(SLAB_URL);
    component.images[0]!.onload!();
    assert.equal(component.value, SLAB_URL);
    const other = "https://api.example.test/kb/images/slab/BW010.jpg";
    assert.equal(component.render(other), undefined);
    assert.deepEqual(component.images.map((image) => image.src), [SLAB_URL, other]);
    component.images[0]!.onload?.();
    assert.equal(component.value, undefined, "the first photo's late load must not show");
    component.images[1]!.onload!();
    assert.equal(component.value, other);
  });

  it("a photo that fails to load leaves the flat tone", () => {
    const component = mount();
    component.render(SLAB_URL);
    component.images[0]!.onerror!();
    assert.equal(component.value, undefined);
  });

  it("never touches quoteImageUrl", () => {
    assert.doesNotMatch(source, /quoteImageUrl/);
  });
});

describe("StudioPage wiring", () => {
  it("hands the canvas the active stone's slabImageUrl (and nothing larger), only when a stone is chosen", () => {
    assert.match(studioPage, /const activeStoneTexture = useLoadedStoneTexture\(state\.activeStone \? activeStoneColor\.slabImageUrl : undefined\);/);
    assert.match(studioPage, /stoneTexture=\{activeStoneTexture\}/);
    assert.doesNotMatch(studioPage, /useLoadedStoneTexture\([^)]*quoteImageUrl/);
  });

  it("the live canvas editor forwards it to its StudioFootprint", () => {
    assert.match(studioPage, /<StudioFootprint piece=\{piece\} stoneTone=\{stoneTone\} stoneTexture=\{stoneTexture\} zoom=\{zoom\}/);
    assert.match(studioPage, /\/\*\* Loaded photo of the active stone, or undefined \(flat tone only\)\. \*\/\s+stoneTexture\?: string;/);
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

  it("shows the sample-texture note over the canvas, only while the photo is showing", () => {
    assert.match(studioPage, /\{stoneTexture && <span className="pointer-events-none absolute bottom-1 right-2[^"]*" data-testid="text-studio-stone-texture-note">ลายหินตัวอย่างเพื่อการแสดงผล · หน้างานจริงขึ้นกับลายแร่ธรรมชาติ<\/span>\}/);
  });

  it("styles the note with utility classes only (no stylesheet changes)", () => {
    const note = studioPage.match(/<span className="(pointer-events-none[^"]*)" data-testid="text-studio-stone-texture-note"/)?.[1] ?? "";
    assert.ok(note.length > 0);
    assert.doesNotMatch(note, /\bstudio-/);
  });

  it("leaves the price and export code alone", () => {
    const hook = studioPage.slice(studioPage.indexOf("function useLoadedStoneTexture("), studioPage.indexOf("function stoneSlabViewerImages("));
    assert.doesNotMatch(hook, /studioEstimate|createStudioDxf|downloadStudio|printStudioLayout/);
    assert.ok(QUOTE_URL.includes("quote"), "fixture sanity");
  });
});
