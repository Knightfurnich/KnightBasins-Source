/**
 * job 438-C: what the bowl of a basin looks like, for the two models whose cards say the same thing (KF003 / KF006:
 * same stone, same outside size, same bowl size, same price). The facts were read off the product pictures
 * (`/kb/images/basin-hd/KF003.jpg` and `…/KF006.jpg`), not guessed. Every other model answers `null` until somebody
 * checks its picture — an unknown shape is never filled in. No database column: the API adds these three keys on the
 * way out, like the media fields.
 *
 * The same two entries sit in `knight-basins/src/data/catalog.ts` (BASIN_BOWL_SHAPES) for the built-in copy;
 * test/basin-bowl-shape.test.ts fails if the two lists drift apart.
 */
export type BowlShape = "rounded-rectangle" | "oval";

export type BasinBowlShapeFields = {
  /** Machine value. `null` = not checked. */
  bowlShape: BowlShape | null;
  /** Ready-to-print Thai text for cards and quotes. `null` = not checked. */
  bowlShapeLabel: string | null;
  /** Whether the bowl has an overflow hole. `null` = not checked. */
  bowlOverflowHole: boolean | null;
};

const CHECKED_BOWLS: Readonly<Record<string, { shape: BowlShape; overflowHole: boolean; label: string }>> = {
  KF003: { shape: "rounded-rectangle", overflowHole: false, label: "หลุมสี่เหลี่ยมมุมมน ไม่มีรูน้ำล้น" },
  KF006: { shape: "oval", overflowHole: true, label: "หลุมวงรี มีรูน้ำล้น" },
};

export function bowlShapeFields(sku: string): BasinBowlShapeFields {
  const checked = CHECKED_BOWLS[sku.trim().toUpperCase()];
  return checked
    ? { bowlShape: checked.shape, bowlShapeLabel: checked.label, bowlOverflowHole: checked.overflowHole }
    : { bowlShape: null, bowlShapeLabel: null, bowlOverflowHole: null };
}

export function withBasinBowlShape<T extends { sku: string }>(basin: T): T & BasinBowlShapeFields {
  return { ...basin, ...bowlShapeFields(basin.sku) };
}

export const CHECKED_BOWL_SKUS: ReadonlyArray<string> = Object.keys(CHECKED_BOWLS);
