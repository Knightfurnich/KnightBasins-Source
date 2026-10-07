/**
 * Uploaded photos keep their generated name for the life of the record - nothing overwrites them in place, and the
 * portfolio/gallery rows point straight at the file - so re-fetching them on every visit is pure waste. Measured on
 * the live site before this existed, a photo answered `cache-control: public, max-age=0` while /portfolio and
 * /site-prep publish 333 and 59 of them.
 *
 * Thirty days is the default, and the window itself is where the saving is: express.static answers a weak ETag, so a
 * visitor who does revalidate still gets 200 rather than a 304 (asserted in test/uploads-cache-headers.test.ts).
 * UPLOADS_CACHE_MAX_AGE is the ops valve: "0" goes back to a conditional request on every visit, for the rare restore
 * or re-sync that has to be visible at once
 * (nginx cannot cache these itself - /api/ is proxied whole, and a blanket header there would hit the JSON API too).
 */
export const DEFAULT_UPLOADS_CACHE_MAX_AGE = "30d";

export function uploadsCacheMaxAge(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env["UPLOADS_CACHE_MAX_AGE"]?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_UPLOADS_CACHE_MAX_AGE;
}

/** The shape express.static accepts for the two options this project sets; kept structural so no type import is needed. */
export type UploadsStaticOptions = { maxAge: string };

export function uploadsStaticOptions(env: NodeJS.ProcessEnv = process.env): UploadsStaticOptions {
  return { maxAge: uploadsCacheMaxAge(env) };
}
