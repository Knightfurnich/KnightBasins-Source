// Fabrication Geometry & Cutout Clash Validator: backend-side safety checks
// on the counter/basin layout a studioData payload describes, independent of
// whatever the client-side studio calculator already checked. Real stone
// cracks at the factory saw if a basin is cut too close to a slab edge or a
// hole straddles the glued joint between two panels -- these checks exist to
// catch that before a job is ever sent to production, not to duplicate the
// client's own UI validation.

/** Knight Furnich's hard safety floor: never lower this. A basin cutout closer than this to any counter edge leaves the stone too thin there and it cracks. */
export const MIN_BASIN_CLEARANCE_MM = 100;

const MIN_RUN_LENGTH_MM = 100;
const MAX_RUN_LENGTH_MM = 10_000;
const MIN_DEPTH_MM = 100;
const MAX_DEPTH_MM = 3_000;

const KNOWN_SHAPES = ["I", "L", "U"] as const;
type FabricationShape = (typeof KNOWN_SHAPES)[number];

export type BasinClearanceResult = {
  valid: boolean;
  minClearanceMm: number;
};

/**
 * Checks the stone margin left on all 4 sides (left/right/front/back) once a
 * basin cutout of `basinWidthMm` x `basinDepthMm` is placed at `(xMm, yMm)`
 * -- the cutout's top-left corner, in the same mm coordinate space as
 * `counterWidthMm` x `counterDepthMm` -- inside a counter piece. `valid` is
 * true only when every side clears `MIN_BASIN_CLEARANCE_MM`; a NaN/Infinity
 * input naturally fails every comparison below and comes back invalid
 * rather than needing a separate guard.
 */
export function validateBasinClearance(
  counterWidthMm: number,
  counterDepthMm: number,
  basinWidthMm: number,
  basinDepthMm: number,
  xMm: number,
  yMm: number,
): BasinClearanceResult {
  const left = xMm;
  const right = counterWidthMm - (xMm + basinWidthMm);
  const front = yMm;
  const back = counterDepthMm - (yMm + basinDepthMm);
  const minClearanceMm = Math.min(left, right, front, back);

  return {
    valid: minClearanceMm >= MIN_BASIN_CLEARANCE_MM,
    minClearanceMm,
  };
}

/**
 * True when a basin cutout rectangle (`cutoutX`/`cutoutY` top-left corner,
 * `cutoutW`/`cutoutH` size) crosses any of the given panel-joint points --
 * i.e. the hole would be cut straight through the glued seam between two
 * stone panels of an L or U shape, weakening the bond there. Bounds are
 * inclusive: a joint sitting exactly on the cutout's edge still counts as a
 * clash, matching this module's conservative safety stance elsewhere.
 */
export function checkCutoutJointClash(
  cutoutX: number,
  cutoutY: number,
  cutoutW: number,
  cutoutH: number,
  joints: Array<{ x: number; y: number }>,
): boolean {
  return joints.some(
    (joint) =>
      joint.x >= cutoutX &&
      joint.x <= cutoutX + cutoutW &&
      joint.y >= cutoutY &&
      joint.y <= cutoutY + cutoutH,
  );
}

export type FabricationPiece = {
  shape: string;
  runAMm: number;
  depthMm: number;
  runBMm?: number;
  runCMm?: number;
};

export type PieceFabricationResult = {
  valid: boolean;
  reason?: string;
};

function isValidRunLength(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= MIN_RUN_LENGTH_MM && value <= MAX_RUN_LENGTH_MM;
}

function isValidDepth(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= MIN_DEPTH_MM && value <= MAX_DEPTH_MM;
}

/**
 * Validates a counter piece's shape and dimensions before fabrication: the
 * shape must be one of the 3 known ones ("I"/"L"/"U", case-insensitive), the
 * main run (`runAMm`) and `depthMm` must fall inside the real-world bounds a
 * stone slab can be, and an L shape must additionally carry a valid
 * `runBMm` (its second leg) while a U shape needs both `runBMm` and
 * `runCMm` (its second and third legs) -- an I shape needs neither.
 */
export function validatePieceFabrication(piece: FabricationPiece): PieceFabricationResult {
  const shape = piece.shape.toUpperCase() as FabricationShape;
  if (!KNOWN_SHAPES.includes(shape)) {
    return { valid: false, reason: `Unknown shape: "${piece.shape}"` };
  }
  if (!isValidRunLength(piece.runAMm)) {
    return { valid: false, reason: `runAMm must be between ${MIN_RUN_LENGTH_MM}mm and ${MAX_RUN_LENGTH_MM}mm` };
  }
  if (!isValidDepth(piece.depthMm)) {
    return { valid: false, reason: `depthMm must be between ${MIN_DEPTH_MM}mm and ${MAX_DEPTH_MM}mm` };
  }

  const requiredRuns: Array<{ name: "runBMm" | "runCMm"; value: number | undefined }> =
    shape === "L" ? [{ name: "runBMm", value: piece.runBMm }]
    : shape === "U" ? [{ name: "runBMm", value: piece.runBMm }, { name: "runCMm", value: piece.runCMm }]
    : [];

  for (const run of requiredRuns) {
    if (run.value === undefined) {
      return { valid: false, reason: `Shape "${shape}" requires ${run.name}` };
    }
    if (!isValidRunLength(run.value)) {
      return { valid: false, reason: `${run.name} must be between ${MIN_RUN_LENGTH_MM}mm and ${MAX_RUN_LENGTH_MM}mm` };
    }
  }

  return { valid: true };
}
