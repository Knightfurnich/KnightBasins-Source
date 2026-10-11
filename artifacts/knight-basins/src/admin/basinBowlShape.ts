/**
 * job 446-B — the pieces of the bowl-shape editor that must not guess.
 *
 * Two hard rules from the job drive the shape of this file:
 *  · the shape wording belongs to the API (`bowlShapeLabel` is computed from the code
 *    server-side); the admin UI may show labels it *received*, never invent them — so
 *    every label here is read off the rows that came back from `GET /api/admin/basins`;
 *  · `null` is a real value ("ไม่ระบุ") and must be savable; saving only ever writes the
 *    single `bowl_shape` column through the dedicated route (job 445-C) so the generic
 *    basin PUT can never blank it and this editor can never blank anything else.
 */

export type BowlShapeValue = {
  bowlShape: string | null;
  bowlShapeLabel?: string | null;
  bowlShapeSource?: string | null;
};

export type ShapeOption = { code: string; label: string | null };

/**
 * Read the shape fields off an admin row. The generated `BasinPrice` type is owned by
 * job 445-C and does not know these keys yet, so the read is done by name and stays
 * `null` — never a default — when the API has not shipped them.
 */
export function readBowlShapeValue(row: unknown): BowlShapeValue {
  if (typeof row !== "object" || row === null) return { bowlShape: null, bowlShapeLabel: null, bowlShapeSource: null };
  const record = row as Record<string, unknown>;
  return {
    bowlShape: typeof record.bowlShape === "string" ? record.bowlShape : null,
    bowlShapeLabel: typeof record.bowlShapeLabel === "string" ? record.bowlShapeLabel : null,
    bowlShapeSource: typeof record.bowlShapeSource === "string" ? record.bowlShapeSource : null,
  };
}

/**
 * The option list, built only from what the API already told us about real models.
 * A code never seen with a label is kept with `label: null` (we show the code, not a
 * translation we made up). No rows, no options — the editor stays shut.
 */
export function deriveShapeOptions(rows: ReadonlyArray<unknown>): ShapeOption[] {
  const byCode = new Map<string, string | null>();
  for (const item of rows) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as Record<string, unknown>;
    const code = typeof row.bowlShape === "string" ? row.bowlShape.trim() : "";
    if (!code) continue;
    const label = typeof row.bowlShapeLabel === "string" && row.bowlShapeLabel.trim() ? row.bowlShapeLabel.trim() : null;
    if (!byCode.has(code) || (byCode.get(code) === null && label)) byCode.set(code, label);
  }
  return [...byCode.entries()].map(([code, label]) => ({ code, label })).sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * The label to show for a code. Only the API's own text is used; "ไม่ระบุ" is the
 * job's wording for a null value (job 445-C/446-B) — not a description of any shape.
 */
export function labelForCode(options: ReadonlyArray<ShapeOption>, code: string | null, fallbackLabel?: string | null): string {
  if (!code) return "ไม่ระบุ";
  const known = options.find((option) => option.code === code)?.label ?? null;
  return known || (fallbackLabel && fallbackLabel.trim()) || code;
}

/** The only two places a bowl shape can come from now (job 446-B + 441-B). */
export const BOWL_SHAPE_SOURCES = ["database", "none"] as const;
export type BowlShapeSource = (typeof BOWL_SHAPE_SOURCES)[number];

export function isBowlShapeSource(value: unknown): value is BowlShapeSource {
  return typeof value === "string" && (BOWL_SHAPE_SOURCES as readonly string[]).includes(value);
}

/**
 * Where the value on screen came from — job 446-B: there are two states, not three.
 *  · `database` — the `bowl_shape` column holds an answer (job 445-C);
 *  · `none` — the column is empty, so the editor offers "ไม่ระบุ";
 *  · anything else (including the retired `builtin`, which job 441-B deleted together with
 *    the front-end shape survey) gets **no wording** — we do not describe a source we do not know.
 */
export function sourceBadge(source: string | null | undefined, databaseLabel = "จากฐานข้อมูล"): string {
  if (!isBowlShapeSource(source)) return "";
  return source === "database" ? `(${databaseLabel})` : "(ยังไม่ระบุ)";
}

/** Body for PUT /api/admin/basins/:id/bowl-shape — one key only; null clears to "ไม่ระบุ". */
export function bowlShapePatchBody(nextCode: string | null): { bowlShape: string | null } {
  return { bowlShape: nextCode };
}

/** Confirm line: which model, from what, to what — the point is never editing the wrong SKU. */
export function confirmShapeSummary(input: { sku: string; from: string; to: string }): string {
  return `เปลี่ยนรูปทรงอ่างของ ${input.sku}: ${input.from} → ${input.to}`;
}

/**
 * The server is the authority on what it accepts. When it refuses the body we send,
 * we surface its own message instead of papering over it with a guessed second shape.
 */
export async function saveBowlShape(
  fetchImpl: typeof fetch,
  basinId: number,
  nextCode: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await fetchImpl(`/api/admin/basins/${basinId}/bowl-shape`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(bowlShapePatchBody(nextCode)),
    });
    if (response.ok) return { ok: true };
    let message = "";
    try {
      const data = (await response.json()) as { message?: unknown };
      message = typeof data?.message === "string" ? data.message : "";
    } catch {
      message = "";
    }
    return { ok: false, message: message || `บันทึกไม่สำเร็จ (HTTP ${response.status})` };
  } catch {
    return { ok: false, message: "บันทึกไม่สำเร็จ: เครือข่ายขัดข้อง ค่าเดิมไม่ถูกเปลี่ยน" };
  }
}
