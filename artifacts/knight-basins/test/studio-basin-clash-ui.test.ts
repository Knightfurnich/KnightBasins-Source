import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  basinPlacementsViolatingEdgeClearance,
  placementCrossesPanelJoint,
  STUDIO_BASIN_SAFETY_MARGIN_MM,
  type BasinPlacement,
  type StudioPiece,
  type StudioRectangle,
  type StudioState,
} from "../src/data/studio-model.ts";

const studioPageSource = readFileSync(new URL("../src/components/StudioPage.tsx", import.meta.url), "utf8");

const rectangle = (id: string, overrides: Partial<StudioRectangle> = {}): StudioRectangle => ({
  id,
  widthMm: 1000,
  lengthMm: 800,
  xMm: 0,
  yMm: 0,
  rotation: 0,
  ...overrides,
});

const piece = (rectangles: StudioRectangle[]): StudioPiece => ({
  id: "piece-1",
  name: "ชิ้นงาน 1",
  rectangles,
  sideStatuses: {},
});

function stateFor(layout: StudioPiece, basinPlacements: BasinPlacement[]): Pick<StudioState, "pieces" | "shape" | "dimensions" | "basinPlacements"> {
  return {
    pieces: [layout],
    shape: "I",
    dimensions: { depthMm: 800, runAMm: 1000, runBMm: 0, runCMm: 0 },
    basinPlacements,
  };
}

test("Studio uses the 100mm minimum and warns when any basin edge clearance is under it", () => {
  assert.equal(STUDIO_BASIN_SAFETY_MARGIN_MM, 100);
  assert.match(studioPageSource, /const MIN_BASIN_CLEARANCE_MM = STUDIO_BASIN_SAFETY_MARGIN_MM/);
  assert.match(studioPageSource, /basinPlacementsViolatingEdgeClearance\(state, MIN_BASIN_CLEARANCE_MM\)/);

  const panel = rectangle("panel-1", { widthMm: 600, lengthMm: 500 });
  const tooClose = {
    id: "basin-near-edge",
    sku: "KF001",
    pieceId: "piece-1",
    xMm: 99,
    yMm: 100,
    widthMm: 400,
    depthMm: 300,
    rotation: 0,
  };
  const exactlySafe = { ...tooClose, id: "basin-exactly-safe", xMm: 100 };
  assert.deepEqual(basinPlacementsViolatingEdgeClearance(stateFor(piece([panel]), [tooClose]), 100), ["basin-near-edge"]);
  assert.deepEqual(basinPlacementsViolatingEdgeClearance(stateFor(piece([panel]), [exactlySafe]), 100), []);
  assert.match(studioPageSource, /⚠️ ระยะขอบหินรอบอ่างต้องไม่น้อยกว่า 100 มม\./);
  assert.match(studioPageSource, /STUDIO_BASIN_CLEARANCE_WARNING/);
});

test("Studio warns when a basin cutout crosses a panel joint", () => {
  const layout = piece([
    rectangle("panel-a", { widthMm: 1000 }),
    rectangle("panel-b", { xMm: 1000, widthMm: 800 }),
  ]);
  const crossingPlacement = {
    xMm: 800,
    yMm: 100,
    widthMm: 500,
    depthMm: 300,
  };

  assert.equal(placementCrossesPanelJoint(layout, crossingPlacement), true);
  assert.match(studioPageSource, /estimate\.crossJointPlacements/);
  assert.match(studioPageSource, /⚠️ ตำแหน่งอ่างวางทับแนวรอยต่อแผ่นหิน กรุณาขยับอ่างให้อยู่ภายในแผ่นเดียวกัน/);
  assert.match(studioPageSource, /STUDIO_BASIN_JOINT_WARNING/);
});

test("the Studio quote action is disabled while a basin clash warning is active", () => {
  assert.match(studioPageSource, /const hasBasinClash = mode === "studio" && studioLayoutApplied/);
  assert.equal(
    (studioPageSource.match(/disabled=\{submitting \|\| linkedLeadUnavailable \|\| hasBasinClash\}/g) ?? []).length,
    2,
    "both desktop and mobile Studio submit actions must be disabled",
  );
  assert.ok(studioPageSource.includes('"button-mobile-studio-submit"}'));
  assert.match(studioPageSource, /aria-describedby=\{hasBasinClash \? "status-studio-issues-summary"/);
  assert.match(studioPageSource, /data-testid="status-studio-issues-summary"/);
});