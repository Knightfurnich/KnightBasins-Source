// SCAFFOLD (job-193): placeholder so the work order's SCOPE path resolves and
// the shared types exist up front. The implementer replaces the body of
// suggestStonesForPhoto with the real vision call, following the Gemini Vision
// request pattern already proven in lib/sketch-vision.ts (inline_data +
// responseMimeType: "application/json"). Do not ship as-is.

export type StoneMatchCandidate = {
  code: string;
  name: string;
  /** Pinned official photo used for the visual comparison (may be null). */
  slabImageUrl: string | null;
};

export type StoneMatch = {
  code: string;
  name: string;
  reason: string;
};

export type StoneMatchResult =
  | { status: "ok"; matches: StoneMatch[] }
  | { status: "not-configured" }
  | { status: "failed"; message: string };

/**
 * Ranks the catalog colours a customer photo looks closest to.
 *
 * Rules the implementation must keep:
 * - the model may only choose from the candidates passed in (never invent a
 *   code or a name),
 * - prices are attached from our own catalog row afterwards, never by the model,
 * - the answer is capped (3 by default) and returned in the model's rank order.
 */
export async function suggestStonesForPhoto(
  _imageBuffer: Buffer,
  _mimeType: string,
  _candidates: readonly StoneMatchCandidate[],
): Promise<StoneMatchResult> {
  return { status: "not-configured" };
}
