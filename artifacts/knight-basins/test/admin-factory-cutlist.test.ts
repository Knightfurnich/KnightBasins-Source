import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const componentSource = readFileSync(
  new URL("../src/admin/FactoryCutListModal.tsx", import.meta.url),
  "utf8",
);
const leadsManagerSource = readFileSync(
  new URL("../src/admin/LeadsManager.tsx", import.meta.url),
  "utf8",
);
const studioModelSource = readFileSync(
  new URL("../src/data/studio-model.ts", import.meta.url),
  "utf8",
);

describe("admin factory cut-list", () => {
  it("reads saved Studio data and calculates the total stone area", () => {
    assert.match(componentSource, /objectRecord\(root\.state\) \?\? root/);
    assert.match(componentSource, /studioPieces\(safeState\)/);
    assert.match(componentSource, /studioAreaSqM\(resolvedPieces\)/);
    assert.match(componentSource, /data\.totalAreaSqM\.toFixed\(3\)/);
  });

  it("shows panel dimensions and all four saved edge statuses", () => {
    assert.match(componentSource, /studioRectangleSize\(rectangle\)/);
    assert.match(componentSource, /const SIDES: FactoryCutListSide\[\] = \["top", "right", "bottom", "left"\]/);
    assert.match(componentSource, /studioSideStatusLabel\(status\)/);
    assert.match(componentSource, /สีหิน:/);
  });

  it("reports basin cutout dimensions and individual 100 mm edge clearances", () => {
    assert.match(componentSource, /placementCutSize\(effectivePlacement\)/);
    assert.match(componentSource, /left: placement\.xMm - panel\.xMm/);
    assert.match(componentSource, /right: panel\.xMm \+ panelSize\.widthMm/);
    assert.match(componentSource, /top: placement\.yMm - panel\.yMm/);
    assert.match(componentSource, /bottom: panel\.yMm \+ panelSize\.heightMm/);
    assert.match(studioModelSource, /export const STUDIO_BASIN_SAFETY_MARGIN_MM = 100/);
    assert.match(componentSource, /value >= STUDIO_BASIN_SAFETY_MARGIN_MM/);
    assert.match(componentSource, /factory-cutlist-clearances-/);
    assert.match(componentSource, /ผ่านเกณฑ์ ≥ \$\{STUDIO_BASIN_SAFETY_MARGIN_MM\} มม\. ทุกด้าน/);
  });

  it("provides a printable factory sheet with a technician checklist", () => {
    assert.match(componentSource, /function printSheetHtml\(/);
    assert.match(componentSource, /window\.open\("", "_blank"\)/);
    assert.match(componentSource, /printWindow\.document\.write\(printSheetHtml\(lead, data, basins, checks\)\)/);
    assert.match(componentSource, /factory-cutlist-technician-checklist/);
    assert.match(componentSource, /checkbox-factory-cutlist-check-/);
  });

  it("adds the modal action to both the table row and card view", () => {
    assert.match(leadsManagerSource, /import \{ FactoryCutListModal \} from "\.\/FactoryCutListModal"/);
    assert.equal(
      (leadsManagerSource.match(/<FactoryCutListModal lead=\{lead\} \/>/g) ?? []).length,
      2,
    );
    assert.match(componentSource, /button-open-factory-cutlist-/);
    assert.match(componentSource, /dialog-factory-cutlist-/);
  });
});