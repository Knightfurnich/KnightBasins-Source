/**
 * What the bowl of a basin looks like (shape only).
 *
 * THE DATABASE IS THE SOURCE OF TRUTH (job 449-C). The value lives in `basin_prices.bowl_shape` and is edited in the
 * admin. `NULL` there means "not specified": the card prints no line and `bowlShapeLabel` is `null`. Clearing a value in
 * the admin hides it — nothing falls back to anything.
 *
 * The table `SEED_BOWL_SHAPES` below is NOT read when a customer is answered. It is the reference the two migrations were
 * written from (025 seeded KF003 / KF006 / KF025, 026 the other 22) and the oracle the tests compare the database values
 * against, so "what customers see before and after the move is identical" stays checkable. Do not import it from a route.
 *
 * History: job 438-C added KF003 / KF006 (same stone, outside size, bowl size and price, so the cards read the same);
 * job 442-C surveyed the other models from their HD pictures (`/kb/images/basin-hd/<SKU>.jpg`, cross-checked against the
 * main photo), never guessed: a shape is filled in only when the outline of the bowl is clear; anything the picture does
 * not settle stays `null` ("ภาพไม่ชัด" — KF007, KF009, KF010) and KF029 / KF030 are not wash basins (owner ruling).
 * See test/fixtures/bowl-shape-survey.json for the reason, per model.
 *
 * The overflow hole is NOT a spec of a model (every basin can be ordered with or without one), so no label says anything
 * about it and `bowlOverflowHole` stays in the contract only as an always-`null` key. The Thai label is built here from
 * the shape code and never stored.
 *
 * The same table sits in `knight-basins/src/data/catalog.ts` (BASIN_BOWL_SHAPES) for the web's offline copy;
 * test/basin-bowl-shape.test.ts fails if the two drift apart.
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

/** Seed reference only (see the header): never read on the customer path. A model that is not listed has no value. */
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

/**
 * The seed table's answer for a model — what the migrations put into the database. For tests and tooling only: a route
 * must answer from the row (`resolveBowlShape`), never from here.
 */
export function seedBowlShapeFields(sku: string): BasinBowlShapeFields {
  return fieldsFor(CHECKED_BOWLS[sku.trim().toUpperCase()] ?? null);
}

export const BOWL_SHAPES: ReadonlyArray<BowlShape> = Object.keys(SHAPE_TEXT) as BowlShape[];

export function isBowlShape(value: unknown): value is BowlShape {
  return typeof value === "string" && (BOWL_SHAPES as ReadonlyArray<string>).includes(value);
}

export type BowlShapeSource = "database" | "none";

/**
 * The value a customer sees, from the row alone: a known shape in `bowl_shape` is shown; an empty column — or something
 * unknown typed by hand in SQL — means "not specified" (no line, nothing invented, nothing falls back).
 */
export function resolveBowlShape(row: { sku?: string; bowlShape?: unknown }): { fields: BasinBowlShapeFields; source: BowlShapeSource } {
  return isBowlShape(row.bowlShape)
    ? { fields: fieldsFor(row.bowlShape), source: "database" }
    : { fields: fieldsFor(null), source: "none" };
}

export function withBasinBowlShape<T extends { sku: string }>(basin: T): T & BasinBowlShapeFields {
  return { ...basin, ...resolveBowlShape(basin).fields };
}

/** The models the seed table (and so the migrations) give a value to. */
export const SEEDED_BOWL_SKUS: ReadonlyArray<string> = Object.keys(CHECKED_BOWLS);

/**
 * Body of PUT /admin/basins/:id/bowl-shape — `bowlShape` is required; `null` clears the column (the column is emptied: no line). A leftover `bowlOverflowHole` key is accepted only as `null` (an older client), never as a value.
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

/**
 * job 447-C (item C): one line for the whole catalogue, sent by GET /api/catalog as `basinOverflowNote`. The overflow
 * hole is a made-to-order option, not a spec of a model, so no card says "with" or "without" — this note is the only place
 * the subject is named, and the web prints it from the API instead of typing it (one place to edit). Wording approved by
 * the owner on 11 Oct 2026.
 */
export const BASIN_OVERFLOW_NOTE = "อ่างทุกรุ่นสั่งทำได้ทั้งแบบมีและไม่มีรูน้ำล้น (ปกติโรงงานทำให้แบบไม่มี) — ถ้าต้องการแบบมี แจ้งทีมขายได้";

/** The catalogue-level notes GET /api/catalog adds next to the rows. Added keys only. */
export function catalogOrderNotes(): { basinOverflowNote: string } {
  return { basinOverflowNote: BASIN_OVERFLOW_NOTE };
}
