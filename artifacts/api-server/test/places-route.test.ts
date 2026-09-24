import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { serveTypeScriptRoute } from "./route-harness.ts";

const originalApiKey = process.env["GOOGLE_PLACES_API_KEY"];
const realFetch = globalThis.fetch;

afterEach(() => {
  mock.restoreAll();
  if (originalApiKey === undefined) delete process.env["GOOGLE_PLACES_API_KEY"];
  else process.env["GOOGLE_PLACES_API_KEY"] = originalApiKey;
});

function mockGooglePlacesFetch(handler: (body: Record<string, unknown>, headers: Record<string, string>) => Response) {
  mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("places.googleapis.com")) {
      return handler(JSON.parse(String(init?.body ?? "{}")), (init?.headers as Record<string, string>) ?? {});
    }
    return realFetch(input as never, init);
  });
}

describe("GET /places/autocomplete", () => {
  it("returns 503 when GOOGLE_PLACES_API_KEY is not configured", async () => {
    delete process.env["GOOGLE_PLACES_API_KEY"];
    let calledGoogle = false;
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      if (String(input).includes("places.googleapis.com")) calledGoogle = true;
      return realFetch(input as never, init);
    });
    const route = await serveTypeScriptRoute("src/routes/places.ts");
    try {
      const response = await fetch(`${route.url}/api/places/autocomplete?input=สุขุมวิท`);
      assert.equal(response.status, 503);
      assert.equal(calledGoogle, false);
    } finally {
      await route.close();
    }
  });

  it("returns 400 when input is shorter than 3 characters", async () => {
    process.env["GOOGLE_PLACES_API_KEY"] = "test-key";
    const route = await serveTypeScriptRoute("src/routes/places.ts");
    try {
      const response = await fetch(`${route.url}/api/places/autocomplete?input=สข`);
      assert.equal(response.status, 400);
    } finally {
      await route.close();
    }
  });

  it("returns 400 when input exceeds 250 characters", async () => {
    process.env["GOOGLE_PLACES_API_KEY"] = "test-key";
    const route = await serveTypeScriptRoute("src/routes/places.ts");
    try {
      const response = await fetch(`${route.url}/api/places/autocomplete?input=${"ก".repeat(251)}`);
      assert.equal(response.status, 400);
    } finally {
      await route.close();
    }
  });

  it("returns 400 when input is missing", async () => {
    process.env["GOOGLE_PLACES_API_KEY"] = "test-key";
    const route = await serveTypeScriptRoute("src/routes/places.ts");
    try {
      const response = await fetch(`${route.url}/api/places/autocomplete`);
      assert.equal(response.status, 400);
    } finally {
      await route.close();
    }
  });

  it("calls the Places API (New) endpoint with the API key header and Thai region/language, returning up to 5 mapped suggestions", async () => {
    process.env["GOOGLE_PLACES_API_KEY"] = "test-key-123";
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: Record<string, unknown> = {};
    mockGooglePlacesFetch((body, headers) => {
      capturedBody = body;
      capturedHeaders = headers;
      capturedUrl = "captured";
      return new Response(
        JSON.stringify({
          suggestions: Array.from({ length: 7 }, (_, index) => ({
            placePrediction: {
              placeId: `place-${index}`,
              text: { text: `${index} ถนนสุขุมวิท กรุงเทพฯ` },
              structuredFormat: {
                mainText: { text: `บ้านเลขที่ ${index}` },
                secondaryText: { text: "ถนนสุขุมวิท กรุงเทพฯ" },
              },
            },
          })),
        }),
        { status: 200 },
      );
    });
    const route = await serveTypeScriptRoute("src/routes/places.ts");
    try {
      const response = await fetch(`${route.url}/api/places/autocomplete?input=สุขุมวิท`);
      assert.equal(response.status, 200);
      const payload = await response.json() as { suggestions: Array<{ placeId: string; text: string; primaryText: string; secondaryText: string }> };
      assert.equal(payload.suggestions.length, 5);
      assert.deepEqual(payload.suggestions[0], {
        placeId: "place-0",
        text: "0 ถนนสุขุมวิท กรุงเทพฯ",
        primaryText: "บ้านเลขที่ 0",
        secondaryText: "ถนนสุขุมวิท กรุงเทพฯ",
      });
      assert.equal(capturedUrl, "captured");
      assert.equal(capturedHeaders["X-Goog-Api-Key"], "test-key-123");
      assert.deepEqual(capturedBody, { input: "สุขุมวิท", includedRegionCodes: ["th"], languageCode: "th" });
    } finally {
      await route.close();
    }
  });

  it("falls back to the full text and an empty secondaryText when Google omits structuredFormat", async () => {
    process.env["GOOGLE_PLACES_API_KEY"] = "test-key";
    mockGooglePlacesFetch(() =>
      new Response(
        JSON.stringify({
          suggestions: [{ placePrediction: { placeId: "place-1", text: { text: "หน้าเมืองเชียงใหม่" } } }],
        }),
        { status: 200 },
      ));
    const route = await serveTypeScriptRoute("src/routes/places.ts");
    try {
      const response = await fetch(`${route.url}/api/places/autocomplete?input=เชียงใหม่`);
      assert.equal(response.status, 200);
      const payload = await response.json() as { suggestions: Array<{ placeId: string; text: string; primaryText: string; secondaryText: string }> };
      assert.deepEqual(payload.suggestions, [
        { placeId: "place-1", text: "หน้าเมืองเชียงใหม่", primaryText: "หน้าเมืองเชียงใหม่", secondaryText: "" },
      ]);
    } finally {
      await route.close();
    }
  });

  it("returns an empty suggestions array when Google has no matches", async () => {
    process.env["GOOGLE_PLACES_API_KEY"] = "test-key";
    mockGooglePlacesFetch(() => new Response(JSON.stringify({}), { status: 200 }));
    const route = await serveTypeScriptRoute("src/routes/places.ts");
    try {
      const response = await fetch(`${route.url}/api/places/autocomplete?input=ไม่มีจริง`);
      assert.equal(response.status, 200);
      const payload = await response.json() as { suggestions: unknown[] };
      assert.deepEqual(payload.suggestions, []);
    } finally {
      await route.close();
    }
  });

  it("returns 502 when Google responds with a non-2xx status", async () => {
    process.env["GOOGLE_PLACES_API_KEY"] = "test-key";
    mockGooglePlacesFetch(() => new Response(JSON.stringify({ error: { message: "REQUEST_DENIED" } }), { status: 403 }));
    const route = await serveTypeScriptRoute("src/routes/places.ts");
    try {
      const response = await fetch(`${route.url}/api/places/autocomplete?input=สุขุมวิท`);
      assert.equal(response.status, 502);
    } finally {
      await route.close();
    }
  });

  it("returns 502 when the request to Google times out or fails", async () => {
    process.env["GOOGLE_PLACES_API_KEY"] = "test-key";
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("places.googleapis.com")) throw new Error("network unreachable");
      return realFetch(input as never, init);
    });
    const route = await serveTypeScriptRoute("src/routes/places.ts");
    try {
      const response = await fetch(`${route.url}/api/places/autocomplete?input=สุขุมวิท`);
      assert.equal(response.status, 502);
    } finally {
      await route.close();
    }
  });

  it("returns 429 once the rate limit is exceeded", async () => {
    process.env["GOOGLE_PLACES_API_KEY"] = "test-key";
    mockGooglePlacesFetch(() => new Response(JSON.stringify({ suggestions: [] }), { status: 200 }));
    const route = await serveTypeScriptRoute("src/routes/places.ts");
    try {
      let lastStatus = 200;
      for (let i = 0; i < 31; i += 1) {
        const response = await fetch(`${route.url}/api/places/autocomplete?input=สุขุมวิท`);
        lastStatus = response.status;
      }
      assert.equal(lastStatus, 429);
    } finally {
      await route.close();
    }
  });
});
