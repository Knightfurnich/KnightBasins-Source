/**
 * Resolves a Google Maps link (in any format the sales team might paste into
 * a lead's notes or a LINE message) into verified coordinates + a standard
 * navigation URL. Never guesses -- an unresolvable link throws so a
 * technician is never sent to a wrong address.
 */

const FETCH_TIMEOUT_MS = 8_000;

const DATA_PARAM_PATTERN = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;
const PATH_COORD_PATTERN = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,[^/]*)?/;
const RAW_COORD_PATTERN = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*°?\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*°?\s*$/;

export type ResolvedFrom = "short-link" | "path" | "data-param" | "query" | "raw-coords";

export interface ResolvedMapsLocation {
  lat: number;
  lng: number;
  navUrl: string;
  resolvedFrom: ResolvedFrom;
  sourceUrl: string;
}

interface Coords {
  lat: number;
  lng: number;
}

export function buildNavigationUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function assertValidRange(lat: number, lng: number): void {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new Error("invalid-maps-link");
  }
}

function isShortLink(url: URL): boolean {
  if (url.hostname === "maps.app.goo.gl") return true;
  if (url.hostname === "goo.gl" && url.pathname.startsWith("/maps")) return true;
  return false;
}

function extractRawCoords(text: string): Coords | null {
  const match = RAW_COORD_PATTERN.exec(text);
  if (!match) return null;
  return { lat: Number(match[1]), lng: Number(match[2]) };
}

function extractFromNonShortUrl(url: URL): { coords: Coords; resolvedFrom: ResolvedFrom } | null {
  const full = url.toString();

  const dataMatch = DATA_PARAM_PATTERN.exec(full);
  if (dataMatch) {
    return { coords: { lat: Number(dataMatch[1]), lng: Number(dataMatch[2]) }, resolvedFrom: "data-param" };
  }

  const pathMatch = PATH_COORD_PATTERN.exec(full);
  if (pathMatch) {
    return { coords: { lat: Number(pathMatch[1]), lng: Number(pathMatch[2]) }, resolvedFrom: "path" };
  }

  const query = url.searchParams.get("query") ?? url.searchParams.get("q");
  if (query) {
    const queryCoords = extractRawCoords(query.trim());
    if (queryCoords) return { coords: queryCoords, resolvedFrom: "query" };
  }

  return null;
}

async function followShortLink(url: URL): Promise<URL> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { redirect: "follow", signal: controller.signal });
    const finalUrl = (response as { url?: string }).url;
    return new URL(finalUrl && finalUrl.length > 0 ? finalUrl : url.toString());
  } catch {
    throw new Error("invalid-maps-link");
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveMapsLink(input: string): Promise<ResolvedMapsLocation> {
  const trimmed = typeof input === "string" ? input.trim() : "";
  if (!trimmed) throw new Error("invalid-maps-link");

  let url: URL | null = null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") url = parsed;
  } catch {
    url = null;
  }

  if (url) {
    if (isShortLink(url)) {
      const finalUrl = await followShortLink(url);
      const extracted = extractFromNonShortUrl(finalUrl);
      if (!extracted) throw new Error("invalid-maps-link");
      assertValidRange(extracted.coords.lat, extracted.coords.lng);
      return {
        lat: extracted.coords.lat,
        lng: extracted.coords.lng,
        navUrl: buildNavigationUrl(extracted.coords.lat, extracted.coords.lng),
        resolvedFrom: "short-link",
        sourceUrl: trimmed,
      };
    }

    const extracted = extractFromNonShortUrl(url);
    if (!extracted) throw new Error("invalid-maps-link");
    assertValidRange(extracted.coords.lat, extracted.coords.lng);
    return {
      lat: extracted.coords.lat,
      lng: extracted.coords.lng,
      navUrl: buildNavigationUrl(extracted.coords.lat, extracted.coords.lng),
      resolvedFrom: extracted.resolvedFrom,
      sourceUrl: trimmed,
    };
  }

  const raw = extractRawCoords(trimmed);
  if (!raw) throw new Error("invalid-maps-link");
  assertValidRange(raw.lat, raw.lng);
  return {
    lat: raw.lat,
    lng: raw.lng,
    navUrl: buildNavigationUrl(raw.lat, raw.lng),
    resolvedFrom: "raw-coords",
    sourceUrl: trimmed,
  };
}
