/**
 * What the bowl of a basin looks like (shape only). job 438-C added KF003 / KF006 (same stone, outside size, bowl size and
 * price, so the cards read the same); job 442-C surveyed the other models from their HD pictures
 * (`/kb/images/basin-hd/<SKU>.jpg`, cross-checked against the main photo), never guessed:
 *  - a shape is filled in only when the outline of the bowl is clear in the picture;
 *  - anything the picture does not settle stays `null` ("ภาพไม่ชัด") — see test/fixtures/bowl-shape-survey.json for the
 *    reason, per model.
 * KF029 / KF030 are not wash basins (owner ruling, job 442-C): they never get a value.
 *
 * job 445-C (revision 2): the value lives in ONE editable column, `basin_prices.bowl_shape`, and the Thai label is built
 * here from the shape code — never stored. The overflow hole is NOT a spec of a model (every basin can be ordered with or
 * without one), so no label says anything about it and `bowlOverflowHole` stays in the contract only as an always-`null`
 * key, so nothing on the web side breaks; no code may decide anything from it.
 *
 * The same built-in table sits in `knight-basins/src/data/catalog.ts` (BASIN_BOWL_SHAPES);
 * test/basin-bowl-shape.test.ts fails if the two drift apart or if a model leaves the surveyed list.
 */
export type BowlShape = "rounded-rectangle" | "oval" | "round" | "rectangle" | "square" | "rounded-square";

export type BasinBowlShapeFields = {
  /** Machine value. `null` = not specified. */
  bowlShape: BowlShape | null;
  /** Ready-to-print Thai text for cards and quotes, built from `bowlShape`. `null` = not specified. */
  bowlShapeLabel: string | null;
  /** Kept for the contract only: always `null` (the overflow hole is a made-to-order option, not a spec). */
  bowlOverflowHole: null;
};

const SHAPE_TEXT: Readonly<Record<BowlShape, string>> = {
  "rounded-rectangle": "หลุมสี่เหลี่ยมมุมมน",
  oval: "หลุมวงรี",
  round: "หลุมกลม",
  rectangle: "หลุมสี่เหลี่ยมมุมเหลี่ยม",
  square: "หลุมสี่เหลี่ยมจัตุรัสมุมเหลี่ยม",
  "rounded-square": "หลุมสี่เหลี่ยมจัตุรัสมุมมน",
};

/** The built-in table: what the API answers when the row's own column is empty. A model that is not listed has no value. */
const CHECKED_BOWLS: Readonly<Record<string, BowlShape>> = {
  KF001: "rounded-rectangle",
  KF002: "rounded-rectangle",
  KF003: "rounded-rectangle",
  KF004: "rounded-rectangle",
  KF005: "rounded-rectangle",
  KF006: "oval",
  KF008: "oval",
  KF011: "rectangle",
  KF012: "rectangle",
  KF013: "rectangle",
  KF014: "rectangle",
  KF015: "rectangle",
  KF016: "rectangle",
  KF017: "rectangle",
  KF018: "rectangle",
  KF019: "square",
  KF020: "square",
  KF021: "square",
  KF022: "rounded-square",
  KF023: "round",
  KF024: "round",
  KF025: "round",
  KF026: "round",
  KF027: "rectangle",
  KF028: "rounded-rectangle",
};

const bowlLabel = (shape: BowlShape) => SHAPE_TEXT[shape];

const fieldsFor = (shape: BowlShape | null): BasinBowlShapeFields => ({
  bowlShape: shape,
  bowlShapeLabel: shape === null ? null : bowlLabel(shape),
  bowlOverflowHole: null,
});

/** The built-in table only (no database): what the API answered before job 445-C, and the fallback now. */
export function bowlShapeFields(sku: string): BasinBowlShapeFields {
  return fieldsFor(CHECKED_BOWLS[sku.trim().toUpperCase()] ?? null);
}

export const BOWL_SHAPES: ReadonlyArray<BowlShape> = Object.keys(SHAPE_TEXT) as BowlShape[];

export function isBowlShape(value: unknown): value is BowlShape {
  return typeof value === "string" && (BOWL_SHAPES as ReadonlyArray<string>).includes(value);
}

export type BowlShapeSource = "database" | "builtin" | "none";

/**
 * job 445-C: the value a customer sees. The row's own column (`bowl_shape`, edited in the admin) wins when it holds a known
 * shape; a row whose column is empty (or holds something unknown, e.g. typed by hand in SQL) falls back to the built-in
 * table, so a card never loses its line and nothing errors.
 */
export function resolveBowlShape(row: { sku: string; bowlShape?: unknown }): { fields: BasinBowlShapeFields; source: BowlShapeSource } {
  if (isBowlShape(row.bowlShape)) return { fields: fieldsFor(row.bowlShape), source: "database" };
  const builtin = bowlShapeFields(row.sku);
  return { fields: builtin, source: builtin.bowlShape === null ? "none" : "builtin" };
}

export function withBasinBowlShape<T extends { sku: string }>(basin: T): T & BasinBowlShapeFields {
  return { ...basin, ...resolveBowlShape(basin).fields };
}

export const CHECKED_BOWL_SKUS: ReadonlyArray<string> = Object.keys(CHECKED_BOWLS);

/**
 * Body of PUT /admin/basins/:id/bowl-shape — `bowlShape` is required; `null` clears the column (the built-in table then
 * answers). A leftover `bowlOverflowHole` key is accepted only as `null` (an older client), never as a value.
 */
export function parseBowlShapeInput(body: unknown):
  | { ok: true; value: { bowlShape: BowlShape | null } }
  | { ok: false; message: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, message: "Body must be an object" };
  const input = body as Record<string, unknown>;
  if (!("bowlShape" in input)) return { ok: false, message: "bowlShape is required (use null for not specified)" };
  const { bowlShape } = input;
  if (bowlShape !== null && !isBowlShape(bowlShape)) return { ok: false, message: `bowlShape must be null or one of: ${BOWL_SHAPES.join(", ")}` };
  if (input["bowlOverflowHole"] !== undefined && input["bowlOverflowHole"] !== null) {
    return { ok: false, message: "bowlOverflowHole is not a field of a model (the overflow hole is a made-to-order option)" };
  }
  return { ok: true, value: { bowlShape } };
}
