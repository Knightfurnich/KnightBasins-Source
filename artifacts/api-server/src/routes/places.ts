import { Router, type IRouter } from "express";
import { fetchWorksiteAddressSuggestions } from "../lib/places";
import { createRateLimiter } from "../lib/rate-limit";

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
