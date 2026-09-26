// Carries a shape/dimension spec from the /sketch page (either read off a
// customer's sketch by AI, or typed/corrected by the sales team) across to
// the 2D Studio (/studio) as a URL query string, instead of a temporary
// client-side state blob that a page refresh or a shared link would lose.
//
// Note on the import below: the job doc for this module wrote the import as
// "@/data/studio-model" (the Vite alias every .tsx component in this app
// uses). That alias only resolves under the Vite bundler though, and this
// module's own EVIDENCE requirement runs its test file directly with
// `node --experimental-strip-types --test` (no bundler) -- exactly like
// studio-export.ts, the other plain-.ts data module next to this one, which
// already imports studio-model.ts by relative path for that same reason. So
// this file does the same, to keep it runnable standalone.
import {
  buildCustomShapePiece,
  type SideStatus,
  type StudioCustomShapePanel,
  type StudioPreset,
  type StudioSide,
  type StudioState,
} from "./studio-model.ts";

export type StudioBridgeParams = {
  shape: StudioPreset;
  runAMm: number;
  depthMm: number;
  runBMm?: number;
  runCMm?: number;
  stoneColor?: string;
  basinSku?: string;
  source?: string;
};

const STUDIO_BRIDGE_SHAPES: readonly StudioPreset[] = ["i", "l-left", "l-right", "u"];
const RUN_MM_RANGE = { min: 400, max: 6000 };
const DEPTH_MM_RANGE = { min: 300, max: 1200 };

function inRange(value: number, range: { min: number; max: number }) {
  return value >= range.min && value <= range.max;
}

/**
 * Builds the /studio URL that carries one shape/dimension spec across as a
 * query string. Every value round-trips through parseStudioBridgeParams
 * unchanged (millimeters, no unit suffix) -- URLSearchParams handles percent
 * -encoding stoneColor/basinSku, so neither needs sanitizing here.
 */
export function buildStudioBridgeUrl(params: StudioBridgeParams): string {
  const search = new URLSearchParams();
  if (params.source) search.set("from", params.source);
  search.set("shape", params.shape);
  search.set("runA", String(Math.round(params.runAMm)));
  if (params.runBMm !== undefined) search.set("runB", String(Math.round(params.runBMm)));
  if (params.runCMm !== undefined) search.set("runC", String(Math.round(params.runCMm)));
  search.set("depth", String(Math.round(params.depthMm)));
  if (params.stoneColor) search.set("stone", params.stoneColor);
  if (params.basinSku) search.set("basin", params.basinSku);
  return `/studio?${search.toString()}`;
}

/**
 * Reads one raw query-param value as a millimeter length. Accepts a bare
 * number (the canonical form buildStudioBridgeUrl itself writes, already in
 * mm -- there's no "customer's handwriting" ambiguity here to disambiguate
 * by magnitude, unlike the AI sketch-vision parser) or one explicitly
 * suffixed with mm/cm/m. Anything else -- missing, empty, non-numeric,
 * zero or negative -- returns null rather than guessing.
 */
function parseMmParam(value: string | null): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(mm|cm|m)?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = (match[2] ?? "").toLowerCase();
  if (unit === "cm") return Math.round(amount * 10);
  if (unit === "m") return Math.round(amount * 1000);
  return Math.round(amount);
}

/**
 * Reads a StudioBridgeParams back out of a /studio URL's query string.
 * Returns null -- never a partially-valid object -- when the shape is
 * missing/unrecognized, when runAMm/depthMm are missing or outside a
 * realistic counter's range, or when a shape that needs a leg length
 * (l-left/l-right need runB, u needs both runB and runC) doesn't have a
 * valid one: a malformed leg would make applyStudioBridgeToState build the
 * wrong shape silently, which is worse than just refusing the whole thing.
 */
export function parseStudioBridgeParams(search: string | URLSearchParams): StudioBridgeParams | null {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;

  const shapeRaw = params.get("shape");
  if (!shapeRaw || !(STUDIO_BRIDGE_SHAPES as readonly string[]).includes(shapeRaw)) return null;
  const shape = shapeRaw as StudioPreset;

  const runAMm = parseMmParam(params.get("runA"));
  if (runAMm === null || !inRange(runAMm, RUN_MM_RANGE)) return null;

  const depthMm = parseMmParam(params.get("depth"));
  if (depthMm === null || !inRange(depthMm, DEPTH_MM_RANGE)) return null;

  const needsRunB = shape === "l-left" || shape === "l-right" || shape === "u";
  const needsRunC = shape === "u";
  const runBMm = parseMmParam(params.get("runB"));
  const runCMm = parseMmParam(params.get("runC"));
  if (needsRunB && (runBMm === null || !inRange(runBMm, RUN_MM_RANGE))) return null;
  if (needsRunC && (runCMm === null || !inRange(runCMm, RUN_MM_RANGE))) return null;

  const stoneColor = params.get("stone")?.trim();
  const basinSku = params.get("basin")?.trim();
  const source = params.get("from")?.trim();

  return {
    shape,
    runAMm,
    depthMm,
    ...(needsRunB ? { runBMm: runBMm! } : {}),
    ...(needsRunC ? { runCMm: runCMm! } : {}),
    ...(stoneColor ? { stoneColor } : {}),
    ...(basinSku ? { basinSku } : {}),
    ...(source ? { source } : {}),
  };
}

const STUDIO_BRIDGE_PIECE_ID = "studio-bridge-1";
const STUDIO_BRIDGE_BASIN_ID = "studio-bridge-basin-1";

/**
 * Turns validated bridge params into buildCustomShapePiece's panel list.
 * Mirrors Task 74's own panel convention: the back run's widthMm is its run
 * length and depthMm is the counter's depth, while a leg panel's widthMm is
 * that same counter depth (the leg's own short dimension) and its depthMm is
 * the leg's run length. Every edge starts "normal" -- the bridge only
 * establishes the shape; the customer/sales team sets real finishes on the
 * Studio page afterward, same as building any other piece from scratch.
 */
function buildBridgePanels(params: StudioBridgeParams): StudioCustomShapePanel[] {
  const normalEdges: Record<StudioSide, SideStatus> = { top: "normal", right: "normal", bottom: "normal", left: "normal" };
  const panels: StudioCustomShapePanel[] = [{ widthMm: params.runAMm, depthMm: params.depthMm, edges: { ...normalEdges } }];
  if (params.shape === "l-left" || params.shape === "l-right" || params.shape === "u") {
    panels.push({ widthMm: params.depthMm, depthMm: params.runBMm ?? 0, edges: { ...normalEdges } });
  }
  if (params.shape === "u") {
    panels.push({ widthMm: params.depthMm, depthMm: params.runCMm ?? 0, edges: { ...normalEdges } });
  }
  return panels;
}

/**
 * Applies a bridge spec to a StudioState: builds the piece via
 * buildCustomShapePiece (Task 74) -- which locks any joint side automatically
 * -- and replaces state.pieces with it, since the bridge is for seeding a
 * fresh Studio session from a sketch, not merging into whatever pieces
 * happened to already be there. Stone color and basin SKU are optional: they
 * only touch stoneColors/activeStone/basinSkus/basinPlacements when present.
 */
export function applyStudioBridgeToState(state: StudioState, params: StudioBridgeParams): StudioState {
  const piece = buildCustomShapePiece(STUDIO_BRIDGE_PIECE_ID, params.shape, buildBridgePanels(params));
  const next: StudioState = { ...state, pieces: [piece], activePieceId: piece.id };

  if (params.stoneColor) {
    next.stoneColors = next.stoneColors.includes(params.stoneColor) ? next.stoneColors : [...next.stoneColors, params.stoneColor];
    next.activeStone = params.stoneColor;
    next.stoneSelectionSource = "user";
  }

  if (params.basinSku) {
    next.basinSkus = next.basinSkus.includes(params.basinSku) ? next.basinSkus : [...next.basinSkus, params.basinSku];
    next.basinPlacements = [
      ...next.basinPlacements,
      { id: STUDIO_BRIDGE_BASIN_ID, sku: params.basinSku, pieceId: piece.id, xMm: 50, yMm: 50, widthMm: null, depthMm: null },
    ];
  }

  return next;
}
