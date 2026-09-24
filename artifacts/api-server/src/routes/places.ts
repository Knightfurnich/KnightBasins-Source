// Powers the worksite address autocomplete box on /studio (the Replit-built
// WorksiteAddressAutocomplete component). Must use the Places API (New)
// autocomplete endpoint -- the legacy maps.googleapis.com/maps/api/place
// endpoint answers REQUEST_DENIED because this project's Google Cloud
// project only has the new API enabled.

import { Router, type IRouter } from "express";
import { createRateLimiter } from "../lib/rate-limit";

const GOOGLE_PLACES_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const MAX_SUGGESTIONS = 5;

type WorksiteAddressSuggestion = {
  placeId: string;
  text: string;
  primaryText: string;
  secondaryText: string;
};

type PlacesAutocompleteResult =
  | { ok: true; suggestions: WorksiteAddressSuggestion[] }
  | { ok: false; reason: "not-configured" | "upstream-error" };

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

function placesApiKey(): string | null {
  const apiKey = process.env["GOOGLE_PLACES_API_KEY"];
  return apiKey && apiKey.trim() ? apiKey : null;
}

/**
 * Fetch Thai worksite address suggestions for an autocomplete query. Never
 * throws -- configuration gaps and upstream failures both come back as a
 * typed `ok: false` result so the route can map them to the right status
 * code without inspecting error internals.
 */
async function fetchWorksiteAddressSuggestions(input: string): Promise<PlacesAutocompleteResult> {
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

const router: IRouter = Router();

const placesAutocompleteRateLimit = createRateLimiter({ name: "places-autocomplete", max: 30, windowMs: 60 * 1000 });

router.get("/places/autocomplete", placesAutocompleteRateLimit, async (req, res, next) => {
  try {
    const rawInput = req.query["input"];
    const input = typeof rawInput === "string" ? rawInput.trim() : "";
    if (input.length < 3 || input.length > 250) {
      res.status(400).json({ message: "input must be between 3 and 250 characters" });
      return;
    }

    const result = await fetchWorksiteAddressSuggestions(input);
    if (!result.ok) {
      res
        .status(result.reason === "not-configured" ? 503 : 502)
        .json({
          message: result.reason === "not-configured"
            ? "Address suggestions are not configured"
            : "Address suggestion provider is unavailable",
        });
      return;
    }

    res.json({ suggestions: result.suggestions });
  } catch (error) {
    next(error);
  }
});

export default router;
