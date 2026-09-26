import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  basinPlacementsViolatingEdgeClearance,
  placementCrossesPanelJoint,
  type BasinPlacement,
  type StudioPiece,
  type StudioRectangle,
  type StudioState,
} from "../src/data/studio-model.ts";

const leadsManagerSource = readFileSync(
  new URL("../src/admin/LeadsManager.tsx", import.meta.url),
  "utf8",
);

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

test("a Lead fabricationWarnings payload is normalized into a visible safety badge", () => {
  assert.match(leadsManagerSource, /type LeadWithFabricationWarnings = CustomerLead & \{ fabricationWarnings\?: unknown \}/);
  assert.match(leadsManagerSource, /fabricationWarningMessages\(extendedLead\.fabricationWarnings\)/);
  assert.match(leadsManagerSource, /function LeadFabricationSafetyBadge/);
  assert.match(leadsManagerSource, /const FABRICATION_RISK_LABEL = "⚠️ มีจุดเสี่ยงงานช่าง"/);
  assert.match(leadsManagerSource, /data-testid=\{`badge-fabrication-risk-\$\{leadId\}`\}/);
  assert.match(leadsManagerSource, /title=\{summary\}/);
  assert.equal(
    (leadsManagerSource.match(/<LeadFabricationSafetyBadge leadId=\{lead\.id\}/g) ?? []).length,
    2,
    "show the badge in both table rows and Lead cards",
  );
});

test("the displayed fabrication warnings include detected sub-100mm clearance", () => {
  const panel = rectangle("panel-1", { widthMm: 600, lengthMm: 500 });
  const tooClose: BasinPlacement = {
    id: "basin-near-edge",
    sku: "KF001",
    pieceId: "piece-1",
    xMm: 99,
    yMm: 100,
    widthMm: 400,
    depthMm: 300,
    rotation: 0,
  };
  assert.deepEqual(
    basinPlacementsViolatingEdgeClearance(stateFor(piece([panel]), [tooClose]), 100),
    ["basin-near-edge"],
  );
  assert.match(leadsManagerSource, /basinPlacementsViolatingEdgeClearance\(state, STUDIO_BASIN_SAFETY_MARGIN_MM\)/);
  assert.match(leadsManagerSource, /FABRICATION_CLEARANCE_WARNING/);
});

test("the displayed fabrication warnings include basin cutouts crossing panel joints", () => {
  const layout = piece([
    rectangle("panel-a", { widthMm: 1000 }),
    rectangle("panel-b", { xMm: 1000, widthMm: 800 }),
  ]);
  const crossingPlacement: BasinPlacement = {
    id: "basin-crossing-joint",
    sku: "KF001",
    pieceId: "piece-1",
    xMm: 800,
    yMm: 100,
    widthMm: 500,
    depthMm: 300,
    rotation: 0,
  };
  assert.equal(placementCrossesPanelJoint(layout, crossingPlacement), true);
  assert.match(leadsManagerSource, /placementCrossesPanelJoint\(piece, placement\)/);
  assert.match(leadsManagerSource, /FABRICATION_JOINT_WARNING/);
});

test("the fabrication filter supports all, normal, and risky Lead lists", () => {
  assert.match(leadsManagerSource, /type FabricationFilter = "all" \| "normal" \| "risk"/);
  assert.match(leadsManagerSource, /fabricationFilter === "risk"/);
  assert.match(leadsManagerSource, /fabricationFilter === "normal"/);
  assert.match(leadsManagerSource, /fabricationWarningsByLeadId\.has\(lead\.id\)/);
  assert.match(leadsManagerSource, /data-testid="filter-fabrication-risk"/);
  assert.match(leadsManagerSource, /data-testid="filter-fabrication-all"/);
  assert.match(leadsManagerSource, /data-testid="filter-fabrication-normal"/);
  assert.match(leadsManagerSource, /data-testid="filter-fabrication-risk-only"/);
  assert.match(leadsManagerSource, /ความเสี่ยงงานช่าง:/);
});