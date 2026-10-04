import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

// job-256: the /sketch page wiring, as source-level checks (the page imports React and path aliases node cannot load).
// The rules themselves are tested on the pure functions in sketch-order.test.ts.

const source = readFileSync(new URL("../src/components/StudioPage.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const sketchLayout = source.slice(source.indexOf('data-testid="studio-sketch-flow"'), source.indexOf("  ) : (\n    <div className={`studio-design-layout ${isSimpleStudioMode"));

describe("sketch page: pictures are shown whole", () => {
  it("both pictures are contained, not cropped, with the style on the <img> itself (index.css is frozen)", () => {
    assert.match(source, /<img className="studio-sketch-analysis-preview" style=\{\{ objectFit: "contain", width: "100%", height: "auto", minHeight: 0, maxHeight: "45vh" \}\}/);
    assert.match(source, /<img className="studio-sketch-slot-preview" style=\{\{ objectFit: "contain", width: "100%", height: "100%"/);
    assert.match(source, /<article className="studio-sketch-analysis-card" style=\{\{ gridTemplateColumns: "minmax\(0, 1fr\)" \}\}/);
  });
});

describe("sketch page: order of the steps and what each one offers", () => {
  it("picture, sizes, stone per piece, basin per cut-out, order type", () => {
    const ids = ["step-studio-sketch-upload", "step-studio-sketch-dimensions", "step-studio-sketch-stone", "step-studio-sketch-basin", "step-studio-sketch-order-type"];
    const positions = ids.map((id) => sketchLayout.indexOf(`data-testid="${id}"`));
    assert.ok(positions.every((position) => position > -1), "all five steps exist");
    assert.deepEqual([...positions].sort((a, b) => a - b), positions, "in that order");
  });

  it("every size the AI read is an editable box: overall size and each panel, one set per piece", () => {
    for (const id of ["input-sketch-length-${pieceIndex}", "input-sketch-depth-${pieceIndex}", "input-sketch-panel-length-${pieceIndex}-${panel.index}", "input-sketch-panel-depth-${pieceIndex}-${panel.index}"]) {
      assert.ok(sketchLayout.includes("data-testid={`" + id + "`}"), id);
    }
    assert.match(sketchLayout, /พื้นที่ต่อชิ้นงาน: <strong data-testid=\{`text-sketch-piece-area-\$\{pieceIndex\}`\}>/);
    assert.match(sketchLayout, /warning-sketch-length-\$\{pieceIndex\}/);
  });

  it("stone is picked per piece and starts as ยังไม่เลือกสีหิน; the shared shortlist is gone from the sketch flow", () => {
    assert.match(sketchLayout, /data-testid=\{`select-sketch-stone-\$\{pieceIndex\}`\}/);
    assert.match(sketchLayout, /<option value="">— \{SKETCH_NO_STONE_MESSAGE\} —<\/option>/);
    assert.match(sketchLayout, /value=\{piece\.stoneCode \?\? ""\}/);
    assert.doesNotMatch(sketchLayout, /StudioShortlists/);
  });

  it("a basin is picked per cut-out from KF001-KF030, with the customer's-own-basin choice and an optional size", () => {
    assert.match(sketchLayout, /data-testid=\{`select-sketch-basin-\$\{pieceIndex\}-\$\{cutoutIndex\}`\}/);
    assert.match(sketchLayout, /sketchBasinOptions\.map/);
    assert.match(sketchLayout, /<option value=\{SKETCH_OWN_BASIN\}>\{SKETCH_OWN_BASIN_LABEL\}<\/option>/);
    assert.match(sketchLayout, /itemCutout\.specified \? `หลุม \$\{itemCutout\.label\} มม\.` : SKETCH_BASIN_NOT_IN_CATALOG/);
    assert.match(sketchLayout, /ขนาดหลุมเจาะ \(ไม่บังคับ — กรอกหรือไม่กรอกก็ได้\)/);
    assert.match(sketchLayout, /SKETCH_OWN_BASIN_WARNING/);
    assert.match(sketchLayout, /SKETCH_OWN_BASIN_NO_SIZE_NOTE/);
    assert.doesNotMatch(sketchLayout.slice(sketchLayout.indexOf("input-sketch-own-basin-size")), /required|aria-required/);
  });

  it("the order type is a choice of two with installed tops first, and a sheet count appears only for sheets", () => {
    assert.match(source, /useState<SketchOrderType>\(DEFAULT_SKETCH_ORDER_TYPE\)/);
    assert.match(sketchLayout, /input-sketch-order-type-\$\{type\.value\}/);
    assert.match(sketchLayout, /sketchOrderType === "sheet" && resolvedSketchPieces\.map/);
    assert.match(sketchLayout, /input-sketch-sheets-\$\{pieceIndex\}/);
  });
});

describe("sketch page: prices appear only after a stone is picked, and come from the system calculator", () => {
  it("the estimate rows show ยังไม่เลือกสีหิน for a piece without a stone, and the total says so when nothing is priced", () => {
    assert.match(source, /quote\.status === "no-stone" \? SKETCH_NO_STONE_MESSAGE : quote\.message/);
    assert.match(source, /mode === "sketch" && sketchOrderQuoteResult\.pricedCount === 0 \? SKETCH_NO_STONE_MESSAGE/);
  });

  it("the page does no price arithmetic of its own: quoteSketchOrder (studioEstimate / stoneSheetUnitPrice) is the only source", () => {
    assert.match(source, /const sketchOrderQuoteResult = quoteSketchOrder\(resolvedSketchPieces, sketchQuoteContext\);/);
    assert.match(source, /totalTHB: sketchOrderQuoteResult\.totalTHB/);
    assert.doesNotMatch(sketchLayout, /priceTHB \*|installedPriceTHB \*|sheetPriceTHB \*/);
  });

  it("a customer's own basin gets no basin line and no installation, and goes to sales as a note", () => {
    assert.match(source, /A basin the customer buys themselves has no line at all/);
    assert.match(source, /product = sku && sku !== SKETCH_OWN_BASIN \? basinProducts\.find/);
    assert.match(source, /notes: \[safeContact\.notes, sketchOrderNote\]/);
  });

  it("the request carries the confirmed sizes, picks and order type (sketchOrder), and is blocked until each piece is ready", () => {
    assert.match(source, /sketchOrder: sketchSnapshot,/);
    assert.match(source, /if \(!sketchOrderReady\) \{\s*setResult\(sketchSizesValid \? "กรุณาเลือกสีหินให้ครบทุกชิ้นงานก่อนส่ง"/);
  });
});

describe("studio mode is unchanged", () => {
  it("Studio still renders StudioShortlists and the old estimate lines; only sketch mode takes the new branch", () => {
    assert.match(source, /<StudioShortlists \{\.\.\.studioShortlistsProps\} \/>\n      \{mode === "studio" \? \(/);
    assert.match(source, /showSketchEstimateLines \? sketchEstimateLines : <div className="studio-estimate-lines">/);
    assert.match(source, /\{mode !== "sketch" && <StudioStoneComparison/);
  });
});
