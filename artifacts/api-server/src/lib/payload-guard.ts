// API Body & JSON Payload Size Guard: a second line of defense behind
// express.json()'s own byte-size `limit` (see app.ts). A raw byte limit
// alone doesn't catch a "nested object bomb" -- a deeply nested structure
// like `{a:{a:{a:...}}}` repeated thousands of times, or an object with an
// enormous number of keys, can stay well under a byte-size cap while still
// being expensive for downstream code (recursive serialization, ORM
// mapping, logging) to walk. This module checks structure, not bytes.

export type PayloadValidationResult = {
  safe: boolean;
  reason?: string;
};

/** Matches the job's own stated thresholds: >10 levels of nesting, or >500 keys total across the whole payload, is treated as a Nested Object Bomb attempt. */
const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_MAX_KEYS = 500;

/**
 * Walks `payload` and rejects as soon as either bound is crossed -- it never
 * keeps recursing past `maxDepth` (so a pathologically deep payload can't
 * blow this function's own call stack either) and never keeps counting keys
 * past `maxKeys`. Only plain objects and arrays count toward depth/keys;
 * primitives (string/number/boolean/null) are leaves and never recurse.
 */
export function validatePayloadDepthAndSize(
  payload: unknown,
  maxDepth: number = DEFAULT_MAX_DEPTH,
  maxKeys: number = DEFAULT_MAX_KEYS,
): PayloadValidationResult {
  let totalKeys = 0;

  function walk(value: unknown, depth: number): PayloadValidationResult | null {
    if (depth > maxDepth) {
      return { safe: false, reason: `Payload nesting exceeds the maximum allowed depth of ${maxDepth}` };
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const violation = walk(item, depth + 1);
        if (violation) return violation;
      }
      return null;
    }
    if (value !== null && typeof value === "object") {
      for (const key of Object.keys(value as Record<string, unknown>)) {
        totalKeys += 1;
        if (totalKeys > maxKeys) {
          return { safe: false, reason: `Payload has more than the maximum allowed ${maxKeys} keys` };
        }
        const violation = walk((value as Record<string, unknown>)[key], depth + 1);
        if (violation) return violation;
      }
      return null;
    }
    return null;
  }

  return walk(payload, 0) ?? { safe: true };
}
