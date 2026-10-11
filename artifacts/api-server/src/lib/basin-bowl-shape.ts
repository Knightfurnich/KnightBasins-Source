/**
 * What the bowl of a basin looks like. job 438-C added KF003 / KF006 (same stone, outside size, bowl size and price, so
 * the cards read the same); job 442-C surveyed the other 26 models. Every value was read off the model's HD product
 * picture (`/kb/images/basin-hd/<SKU>.jpg`) and cross-checked against its main photo, never guessed:
 *  - a shape is filled in only when the outline of the bowl is clear in the picture;
 *  - `bowlOverflowHole` is `false` only when the whole rear wall of the bowl is in view and no hole shows, `true` when a
 *    hole shows, and `null` when the picture cannot settle it;
 *  - anything the picture does not settle stays `null` ("ภาพไม่ชัด") — see test/fixtures/bowl-shape-survey.json for the
 *    reason, per model.
 * KF029 / KF030 are not wash basins (owner ruling, job 442-C): they never get a value. No database column: the API adds
 * these three keys on the way out, like the media fields.
 *
 * The same table sits in `knight-basins/src/data/catalog.ts` (BASIN_BOWL_SHAPES) for the built-in copy;
 * test/basin-bowl-shape.test.ts fails if the two drift apart or if a model leaves the surveyed list.
 */
export type BowlShape = "rounded-rectangle" | "oval" | "round" | "rectangle" | "square" | "rounded-square";

export type BasinBowlShapeFields = {
  /** Machine value. `null` = not checked. */
  bowlShape: BowlShape | null;
  /** Ready-to-print Thai text for cards and quotes. `null` = not checked. */
  bowlShapeLabel: string | null;
  /** Whether the bowl has an overflow hole. `null` = not checked. */
  bowlOverflowHole: boolean | null;
};

const SHAPE_TEXT: Readonly<Record<BowlShape, string>> = {
  "rounded-rectangle": "หลุมสี่เหลี่ยมมุมมน",
  oval: "หลุมวงรี",
  round: "หลุมกลม",
  rectangle: "หลุมสี่เหลี่ยมมุมเหลี่ยม",
  square: "หลุมสี่เหลี่ยมจัตุรัสมุมเหลี่ยม",
  "rounded-square": "หลุมสี่เหลี่ยมจัตุรัสมุมมน",
};

/** `null` shape = looked at, picture not clear enough (kept out of the table on purpose; see the survey fixture). */
const CHECKED_BOWLS: Readonly<Record<string, { shape: BowlShape; overflowHole: boolean | null }>> = {
  KF001: { shape: "rounded-rectangle", overflowHole: false },
  KF002: { shape: "rounded-rectangle", overflowHole: false },
  KF003: { shape: "rounded-rectangle", overflowHole: false },
  KF004: { shape: "rounded-rectangle", overflowHole: false },
  KF005: { shape: "rounded-rectangle", overflowHole: false },
  KF006: { shape: "oval", overflowHole: true },
  KF008: { shape: "oval", overflowHole: false },
  KF011: { shape: "rectangle", overflowHole: null },
  KF012: { shape: "rectangle", overflowHole: null },
  KF013: { shape: "rectangle", overflowHole: null },
  KF014: { shape: "rectangle", overflowHole: false },
  KF015: { shape: "rectangle", overflowHole: null },
  KF016: { shape: "rectangle", overflowHole: false },
  KF017: { shape: "rectangle", overflowHole: false },
  KF018: { shape: "rectangle", overflowHole: false },
  KF019: { shape: "square", overflowHole: false },
  KF020: { shape: "square", overflowHole: false },
  KF021: { shape: "square", overflowHole: false },
  KF022: { shape: "rounded-square", overflowHole: null },
  KF023: { shape: "round", overflowHole: null },
  KF024: { shape: "round", overflowHole: null },
  KF025: { shape: "round", overflowHole: null },
  KF026: { shape: "round", overflowHole: false },
  KF027: { shape: "rectangle", overflowHole: null },
  KF028: { shape: "rounded-rectangle", overflowHole: null },
};

function bowlLabel(shape: BowlShape, overflowHole: boolean | null) {
  const hole = overflowHole === true ? " มีรูน้ำล้น" : overflowHole === false ? " ไม่มีรูน้ำล้น" : "";
  return `${SHAPE_TEXT[shape]}${hole}`;
}

export function bowlShapeFields(sku: string): BasinBowlShapeFields {
  const checked = CHECKED_BOWLS[sku.trim().toUpperCase()];
  return checked
    ? { bowlShape: checked.shape, bowlShapeLabel: bowlLabel(checked.shape, checked.overflowHole), bowlOverflowHole: checked.overflowHole }
    : { bowlShape: null, bowlShapeLabel: null, bowlOverflowHole: null };
}

export function withBasinBowlShape<T extends { sku: string }>(basin: T): T & BasinBowlShapeFields {
  return { ...basin, ...bowlShapeFields(basin.sku) };
}

export const CHECKED_BOWL_SKUS: ReadonlyArray<string> = Object.keys(CHECKED_BOWLS);
