// Server-side price integrity guard (Zero-Trust for client-submitted
// numbers): the studio calculator that produces `total`/`studioData` runs
// entirely in the browser, so this file never trusts those numbers at face
// value. A tampered payload -- a negative total, NaN/Infinity smuggled
// through JSON as a string, or an absurdly large number no real quote could
// reach -- is caught here before it ever reaches the database or a
// payment/notification flow.

/** A quote of exactly 0 THB is unusual but not a tamper signal by itself; only a negative total is. */
const MIN_QUOTE_TOTAL_THB = 0;
/** No real Knight Basins order approaches this figure -- past it is either a bug upstream or a deliberately forged payload, never a legitimate large order. */
const MAX_QUOTE_TOTAL_THB = 50_000_000;
/** 50 meters -- far beyond any real counter/basin run. Guards against a client sending a dimension that's off by orders of magnitude (unit-confusion or a deliberately huge number), the same class of bug documented for parseDimensionToMm in sketch-vision.ts. */
const MAX_DIMENSION_MM = 50_000;

export type QuoteTotalVerification = {
  verifiedTotal: number | null;
  isTampered: boolean;
};

/**
 * Reads the same total-shaped fields `quoteTotalTHB` in routes/leads.ts does
 * (top-level `total`, or the nested `notification`/`quickQuote`/`estimate`
 * variants different studio flows write), but treats an out-of-range or
 * non-numeric result as tampering rather than silently trusting it.
 *
 * `verifiedTotal` is null whenever no *safe* number was found -- either
 * nothing was present, or the only value present was tampered -- never a
 * clamped or best-effort guess, so a caller can't mistake a rejected value
 * for a real quote total.
 */
export function verifyAndSanitizeQuoteTotal(studioData: unknown): QuoteTotalVerification {
  if (!studioData || typeof studioData !== "object") return { verifiedTotal: null, isTampered: false };

  const data = studioData as {
    total?: unknown;
    notification?: { total?: unknown };
    quickQuote?: { total?: unknown };
    estimate?: { totalTHB?: unknown };
  };
  const rawValue = data.notification?.total ?? data.total ?? data.quickQuote?.total ?? data.estimate?.totalTHB;
  if (rawValue === undefined || rawValue === null) return { verifiedTotal: null, isTampered: false };

  // A string, boolean, NaN, or +/-Infinity could never come from the real
  // studio calculator, which always writes a finite number -- that's a
  // tamper signal, not just "missing data".
  if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
    return { verifiedTotal: null, isTampered: true };
  }
  if (rawValue < MIN_QUOTE_TOTAL_THB || rawValue > MAX_QUOTE_TOTAL_THB) {
    return { verifiedTotal: null, isTampered: true };
  }
  return { verifiedTotal: Math.round(rawValue), isTampered: false };
}

/**
 * True only when both dimensions are finite, strictly positive, and within
 * a sane real-world ceiling for a single stone/basin panel run. Used
 * wherever a client-supplied width/depth feeds a price or layout
 * calculation server-side.
 */
export function validateNumericDimensions(widthMm: number, depthMm: number): boolean {
  return [widthMm, depthMm].every(
    (value) => typeof value === "number" && Number.isFinite(value) && value > 0 && value <= MAX_DIMENSION_MM,
  );
}
