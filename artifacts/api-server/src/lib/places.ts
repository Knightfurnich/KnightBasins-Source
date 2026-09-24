// Powers the worksite address autocomplete box on /studio (the Replit-built
// WorksiteAddressAutocomplete component). Must use the Places API (New)
// autocomplete endpoint -- the legacy maps.googleapis.com/maps/api/place
// endpoint answers REQUEST_DENIED because this project's Google Cloud
// project only has the new API enabled.

const GOOGLE_PLACES_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const MAX_SUGGESTIONS = 5;

export type WorksiteAddressSuggestion = {
  placeId: string;
  text: string;
  primaryText: string;
  secondaryText: string;
};

export type PlacesAutocompleteResult =
  | { ok: true; suggestions: WorksiteAddressSuggestion[] }
  | { ok: false; reason: "not-configured" | "upstream-error" };

function placesApiKey(): string | null {
  const apiKey = process.env["GOOGLE_PLACES_API_KEY"];
  return apiKey && apiKey.trim() ? apiKey : null;
}

export function placesAutocompleteConfigured(): boolean {
  return placesApiKey() !== null;
}

type PlacePredictionResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
};

/**
 * Fetch Thai worksite address suggestions for an autocomplete query. Never
 * throws -- configuration gaps and upstream failures both come back as a
 * typed `ok: false` result so the route can map them to the right status
 * code without inspecting error internals.
 */
export async function fetchWorksiteAddressSuggestions(input: string): Promise<PlacesAutocompleteResult> {
  const apiKey = placesApiKey();
  if (!apiKey) return { ok: false, reason: "not-configured" };

  let payload: unknown;
  try {
    const response = await fetch(GOOGLE_PLACES_AUTOCOMPLETE_URL, {
      method: "POST",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input, includedRegionCodes: ["th"], languageCode: "th" }),
    });
    if (!response.ok) return { ok: false, reason: "upstream-error" };
    payload = await response.json().catch(() => null);
  } catch {
    return { ok: false, reason: "upstream-error" };
  }

  const body = payload as PlacePredictionResponse | null;
  const suggestions: WorksiteAddressSuggestion[] = [];
  for (const item of body?.suggestions ?? []) {
    const prediction = item.placePrediction;
    const placeId = prediction?.placeId;
    const text = prediction?.text?.text;
    if (!placeId || !text) continue;
    suggestions.push({
      placeId,
      text,
      primaryText: prediction?.structuredFormat?.mainText?.text ?? text,
      secondaryText: prediction?.structuredFormat?.secondaryText?.text ?? "",
    });
    if (suggestions.length >= MAX_SUGGESTIONS) break;
  }

  return { ok: true, suggestions };
}
