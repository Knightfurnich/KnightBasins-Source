import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { buildNavigationUrl, resolveMapsLink } from "../src/lib/maps-location.ts";

afterEach(() => {
  mock.restoreAll();
});

/** Mocks global fetch to simulate a short link's redirect landing on `finalUrl`, without any real network call. */
function mockRedirectTo(finalUrl: string) {
  mock.method(globalThis, "fetch", async () => ({ url: finalUrl, ok: true }) as unknown as Response);
}

describe("buildNavigationUrl", () => {
  it("builds a standard mobile-usable Google Maps navigation link", () => {
    assert.equal(
      buildNavigationUrl(13.7563, 100.5018),
      "https://www.google.com/maps/dir/?api=1&destination=13.7563,100.5018",
    );
  });
});

describe("resolveMapsLink: short link (follow redirect)", () => {
  it("follows a maps.app.goo.gl short link and reads coordinates from the redirect target", async () => {
    mockRedirectTo("https://www.google.com/maps/place/Some+Place/@13.7563,100.5018,17z/data=!3m1!1e3");
    const result = await resolveMapsLink("https://maps.app.goo.gl/xxxxx");
    assert.equal(result.resolvedFrom, "short-link");
    assert.equal(result.lat, 13.7563);
    assert.equal(result.lng, 100.5018);
    assert.equal(result.navUrl, "https://www.google.com/maps/dir/?api=1&destination=13.7563,100.5018");
    assert.equal(result.sourceUrl, "https://maps.app.goo.gl/xxxxx");
  });

  it("follows a goo.gl/maps short link the same way", async () => {
    mockRedirectTo("https://www.google.com/maps/search/?api=1&query=13.7563,100.5018");
    const result = await resolveMapsLink("https://goo.gl/maps/xxxxx");
    assert.equal(result.resolvedFrom, "short-link");
    assert.equal(result.lat, 13.7563);
    assert.equal(result.lng, 100.5018);
  });

  it("throws when the short link's redirect target has no resolvable coordinates", async () => {
    mockRedirectTo("https://www.google.com/maps/place/Some+Place/");
    await assert.rejects(() => resolveMapsLink("https://maps.app.goo.gl/xxxxx"), /invalid-maps-link/);
  });

  it("throws when following the short link fails (network error / timeout)", async () => {
    mock.method(globalThis, "fetch", async () => {
      throw new Error("network down");
    });
    await assert.rejects(() => resolveMapsLink("https://maps.app.goo.gl/xxxxx"), /invalid-maps-link/);
  });
});

describe("resolveMapsLink: long link with @lat,lng in the path", () => {
  it("reads coordinates from the @lat,lng,zoom path segment", async () => {
    const result = await resolveMapsLink("https://www.google.com/maps/place/ชื่อสถานที่/@13.7563,100.5018,17z/data=!3m1!1e3");
    assert.equal(result.resolvedFrom, "path");
    assert.equal(result.lat, 13.7563);
    assert.equal(result.lng, 100.5018);
  });

  it("handles negative coordinates in the path", async () => {
    const result = await resolveMapsLink("https://www.google.com/maps/place/x/@-13.7563,-100.5018,17z");
    assert.equal(result.lat, -13.7563);
    assert.equal(result.lng, -100.5018);
  });
});

describe("resolveMapsLink: detailed data param (!3d!4d)", () => {
  it("prefers the !3d!4d pinned point over the @lat,lng viewport center when both are present", async () => {
    const result = await resolveMapsLink(
      "https://www.google.com/maps/place/x/@10.0000,20.0000,17z/data=!4m5!3m4!1s0x0:0x0!8m2!3d13.7563!4d100.5018",
    );
    assert.equal(result.resolvedFrom, "data-param");
    assert.equal(result.lat, 13.7563);
    assert.equal(result.lng, 100.5018);
  });
});

describe("resolveMapsLink: search query (?api=1&query=lat,lng)", () => {
  it("reads coordinates from the query parameter", async () => {
    const result = await resolveMapsLink("https://www.google.com/maps/search/?api=1&query=13.7563,100.5018");
    assert.equal(result.resolvedFrom, "query");
    assert.equal(result.lat, 13.7563);
    assert.equal(result.lng, 100.5018);
  });
});

describe("resolveMapsLink: raw coordinates", () => {
  it("accepts plain 'lat,lng' text", async () => {
    const result = await resolveMapsLink("13.7563,100.5018");
    assert.equal(result.resolvedFrom, "raw-coords");
    assert.equal(result.lat, 13.7563);
    assert.equal(result.lng, 100.5018);
  });

  it("accepts spaces and degree signs around the numbers", async () => {
    const result = await resolveMapsLink("13.7563° , 100.5018°");
    assert.equal(result.resolvedFrom, "raw-coords");
    assert.equal(result.lat, 13.7563);
    assert.equal(result.lng, 100.5018);
  });

  it("accepts negative raw coordinates", async () => {
    const result = await resolveMapsLink("-13.7563,-100.5018");
    assert.equal(result.lat, -13.7563);
    assert.equal(result.lng, -100.5018);
  });
});

describe("resolveMapsLink: rejects unresolvable input", () => {
  it("throws invalid-maps-link for empty input", async () => {
    await assert.rejects(() => resolveMapsLink(""), /invalid-maps-link/);
    await assert.rejects(() => resolveMapsLink("   "), /invalid-maps-link/);
  });

  it("throws invalid-maps-link for a plain URL with no coordinates anywhere", async () => {
    await assert.rejects(() => resolveMapsLink("https://www.google.com/maps/place/some-place-with-no-coords/"), /invalid-maps-link/);
  });

  it("throws invalid-maps-link for unrelated text", async () => {
    await assert.rejects(() => resolveMapsLink("ร้านไนท์เฟอร์นิช ถนนสุขุมวิท"), /invalid-maps-link/);
  });
});

describe("resolveMapsLink: out-of-range coordinates must throw, never clamp or guess", () => {
  it("throws when latitude is outside -90..90", async () => {
    await assert.rejects(() => resolveMapsLink("95.0000,100.5018"), /invalid-maps-link/);
    await assert.rejects(() => resolveMapsLink("-95.0000,100.5018"), /invalid-maps-link/);
  });

  it("throws when longitude is outside -180..180", async () => {
    await assert.rejects(() => resolveMapsLink("13.7563,185.0000"), /invalid-maps-link/);
    await assert.rejects(() => resolveMapsLink("13.7563,-185.0000"), /invalid-maps-link/);
  });

  it("throws for out-of-range coordinates found via the path segment too", async () => {
    await assert.rejects(() => resolveMapsLink("https://www.google.com/maps/place/x/@95.0000,200.0000,17z"), /invalid-maps-link/);
  });
});
