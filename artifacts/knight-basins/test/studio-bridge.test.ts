import assert from "node:assert/strict";
import test from "node:test";
import {
  applyStudioBridgeToState,
  buildStudioBridgeUrl,
  parseStudioBridgeParams,
  type StudioBridgeParams,
} from "../src/data/studio-bridge.ts";
import { studioPieceEdges, type StudioState } from "../src/data/studio-model.ts";

const baseState = (): StudioState => ({
  mode: "studio",
  shape: "I",
  dimensions: { depthMm: 600, runAMm: 1800, runBMm: 0, runCMm: 0 },
  backsplash: { enabled: false, heightMm: 120 },
  location: "bangkok-metro",
  vat: false,
  quoteFormat: "US",
  stoneColors: [],
  activeStone: "",
  basinSkus: [],
  basinPlacements: [],
});

test("buildStudioBridgeUrl: 'i' shape produces the documented URL shape", () => {
  const url = buildStudioBridgeUrl({ shape: "i", runAMm: 1980, depthMm: 450, stoneColor: "NB091", basinSku: "KF025", source: "sketch" });
  assert.equal(url, "/studio?from=sketch&shape=i&runA=1980&depth=450&stone=NB091&basin=KF025");
});

test("buildStudioBridgeUrl: 'l-left'/'l-right' shapes include runB", () => {
  const left = buildStudioBridgeUrl({ shape: "l-left", runAMm: 1800, runBMm: 1200, depthMm: 600 });
  assert.equal(left, "/studio?shape=l-left&runA=1800&runB=1200&depth=600");
  const right = buildStudioBridgeUrl({ shape: "l-right", runAMm: 1800, runBMm: 1200, depthMm: 600 });
  assert.equal(right, "/studio?shape=l-right&runA=1800&runB=1200&depth=600");
});

test("buildStudioBridgeUrl: 'u' shape includes both runB and runC", () => {
  const url = buildStudioBridgeUrl({ shape: "u", runAMm: 1500, runBMm: 1200, runCMm: 1200, depthMm: 600 });
  assert.equal(url, "/studio?shape=u&runA=1500&runB=1200&runC=1200&depth=600");
});

test("buildStudioBridgeUrl: percent-encodes a stone color/basin SKU with special characters", () => {
  const url = buildStudioBridgeUrl({ shape: "i", runAMm: 1980, depthMm: 450, stoneColor: "NB 091", basinSku: "KF/025" });
  const parsed = new URL(url, "http://localhost");
  assert.equal(parsed.searchParams.get("stone"), "NB 091");
  assert.equal(parsed.searchParams.get("basin"), "KF/025");
});

test("parseStudioBridgeParams: round-trips a plain 'i' shape URL", () => {
  const url = buildStudioBridgeUrl({ shape: "i", runAMm: 1980, depthMm: 450, stoneColor: "NB091", basinSku: "KF025", source: "sketch" });
  const params = parseStudioBridgeParams(url.split("?")[1]!);
  assert.deepEqual(params, { shape: "i", runAMm: 1980, depthMm: 450, stoneColor: "NB091", basinSku: "KF025", source: "sketch" });
});

test("parseStudioBridgeParams: accepts a URLSearchParams instance directly", () => {
  const params = parseStudioBridgeParams(new URLSearchParams("shape=i&runA=1980&depth=450"));
  assert.equal(params?.shape, "i");
  assert.equal(params?.runAMm, 1980);
  assert.equal(params?.depthMm, 450);
});

test("parseStudioBridgeParams: accepts values written with units (1.98m / 198cm)", () => {
  const params = parseStudioBridgeParams("shape=i&runA=1.98m&depth=45cm");
  assert.equal(params?.runAMm, 1980);
  assert.equal(params?.depthMm, 450);

  const params2 = parseStudioBridgeParams("shape=i&runA=198cm&depth=0.45m");
  assert.equal(params2?.runAMm, 1980);
  assert.equal(params2?.depthMm, 450);
});

test("parseStudioBridgeParams: rejects a missing/unrecognized shape", () => {
  assert.equal(parseStudioBridgeParams("runA=1980&depth=450"), null);
  assert.equal(parseStudioBridgeParams("shape=circle&runA=1980&depth=450"), null);
});

test("parseStudioBridgeParams: rejects garbage, negative, and out-of-range dimension values", () => {
  assert.equal(parseStudioBridgeParams("shape=i&runA=abc&depth=450"), null, "non-numeric runA");
  assert.equal(parseStudioBridgeParams("shape=i&runA=-1980&depth=450"), null, "negative runA");
  assert.equal(parseStudioBridgeParams("shape=i&runA=0&depth=450"), null, "zero runA");
  assert.equal(parseStudioBridgeParams("shape=i&runA=1980&depth=NaN"), null, "non-numeric depth");
  assert.equal(parseStudioBridgeParams("shape=i&runA=100&depth=450"), null, "runA below the 400mm floor");
  assert.equal(parseStudioBridgeParams("shape=i&runA=8000&depth=450"), null, "runA above the 6000mm ceiling");
  assert.equal(parseStudioBridgeParams("shape=i&runA=1980&depth=100"), null, "depth below the 300mm floor");
  assert.equal(parseStudioBridgeParams("shape=i&runA=1980&depth=2000"), null, "depth above the 1200mm ceiling");
});

test("parseStudioBridgeParams: returns null for an empty query string", () => {
  assert.equal(parseStudioBridgeParams(""), null);
});

test("parseStudioBridgeParams: rejects 'l-left'/'l-right' without a valid runB, and 'u' without a valid runC", () => {
  assert.equal(parseStudioBridgeParams("shape=l-left&runA=1800&depth=600"), null, "l-left needs runB");
  assert.equal(parseStudioBridgeParams("shape=l-right&runA=1800&runB=-600&depth=600"), null, "negative runB");
  assert.equal(parseStudioBridgeParams("shape=u&runA=1500&runB=1200&depth=600"), null, "u needs runC too");
  const ok = parseStudioBridgeParams("shape=u&runA=1500&runB=1200&runC=1200&depth=600");
  assert.equal(ok?.runBMm, 1200);
  assert.equal(ok?.runCMm, 1200);
});

test("applyStudioBridgeToState: 'i' shape builds a single piece with the exact requested dimensions", () => {
  const params: StudioBridgeParams = { shape: "i", runAMm: 1980, depthMm: 450 };
  const next = applyStudioBridgeToState(baseState(), params);
  assert.equal(next.pieces?.length, 1);
  assert.equal(next.pieces?.[0]?.rectangles[0]?.widthMm, 1980);
  assert.equal(next.pieces?.[0]?.rectangles[0]?.lengthMm, 450);
  assert.equal(next.activePieceId, next.pieces?.[0]?.id);
});

test("applyStudioBridgeToState: 'u' shape builds 3 panels with joints locked between the back run and both legs", () => {
  const params: StudioBridgeParams = { shape: "u", runAMm: 1500, runBMm: 1200, runCMm: 1200, depthMm: 600 };
  const next = applyStudioBridgeToState(baseState(), params);
  const piece = next.pieces![0]!;
  assert.equal(piece.rectangles.length, 3);
  const [backRun, leftLeg, rightLeg] = piece.rectangles;
  assert.equal(backRun?.widthMm, 1500);
  assert.equal(backRun?.lengthMm, 600);
  assert.equal(leftLeg?.widthMm, 600, "leg's width must be the shared counter depth");
  assert.equal(leftLeg?.lengthMm, 1200, "leg's length must be its own run (runBMm)");
  assert.equal(rightLeg?.lengthMm, 1200);

  const edges = studioPieceEdges(piece);
  const leftLegTop = edges.find((edge) => edge.rectangleId === leftLeg!.id && edge.side === "top");
  const rightLegTop = edges.find((edge) => edge.rectangleId === rightLeg!.id && edge.side === "top");
  assert.equal(leftLegTop?.exposedLengthMm, 0, "the joint between the back run and the left leg must be locked");
  assert.equal(rightLegTop?.exposedLengthMm, 0, "the joint between the back run and the right leg must be locked");
  assert.equal(piece.hasCustomEdges, true);
});

test("applyStudioBridgeToState: replaces any existing pieces instead of appending to them", () => {
  const existing = baseState();
  existing.pieces = [{ id: "old-piece", name: "เก่า", rectangles: [{ id: "old-1", widthMm: 999, lengthMm: 999, xMm: 0, yMm: 0, rotation: 0 }], sideStatuses: {} }];
  const next = applyStudioBridgeToState(existing, { shape: "i", runAMm: 1980, depthMm: 450 });
  assert.equal(next.pieces?.length, 1);
  assert.notEqual(next.pieces?.[0]?.id, "old-piece");
});

test("applyStudioBridgeToState: sets stoneColors/activeStone only when stoneColor is given", () => {
  const withStone = applyStudioBridgeToState(baseState(), { shape: "i", runAMm: 1980, depthMm: 450, stoneColor: "NB091" });
  assert.deepEqual(withStone.stoneColors, ["NB091"]);
  assert.equal(withStone.activeStone, "NB091");
  assert.equal(withStone.stoneSelectionSource, "user");

  const withoutStone = applyStudioBridgeToState(baseState(), { shape: "i", runAMm: 1980, depthMm: 450 });
  assert.deepEqual(withoutStone.stoneColors, []);
  assert.equal(withoutStone.activeStone, "");
});

test("applyStudioBridgeToState: adds a basin placement and SKU only when basinSku is given", () => {
  const withBasin = applyStudioBridgeToState(baseState(), { shape: "i", runAMm: 1980, depthMm: 450, basinSku: "KF025" });
  assert.deepEqual(withBasin.basinSkus, ["KF025"]);
  assert.equal(withBasin.basinPlacements.length, 1);
  assert.equal(withBasin.basinPlacements[0]?.sku, "KF025");
  assert.equal(withBasin.basinPlacements[0]?.pieceId, withBasin.pieces?.[0]?.id);

  const withoutBasin = applyStudioBridgeToState(baseState(), { shape: "i", runAMm: 1980, depthMm: 450 });
  assert.equal(withoutBasin.basinPlacements.length, 0);
});

test("applyStudioBridgeToState: does not mutate the state object it was given", () => {
  const original = baseState();
  const snapshot = JSON.parse(JSON.stringify(original));
  applyStudioBridgeToState(original, { shape: "i", runAMm: 1980, depthMm: 450, stoneColor: "NB091", basinSku: "KF025" });
  assert.deepEqual(original, snapshot);
});
