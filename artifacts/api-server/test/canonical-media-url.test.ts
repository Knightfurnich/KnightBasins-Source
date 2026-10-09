import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, describe, it, mock } from "node:test";
import {
  CANONICAL_MEDIA_ORIGIN,
  basinImageUrl,
  basinVideoUrl,
  canonicalMediaUrl,
  slabImageUrl,
  withBasinCategory,
  withBasinMedia,
  withStoneMedia,
} from "../src/lib/catalog-media.ts";
import { suggestStonesForPhoto } from "../src/lib/stone-matcher.ts";

// job-290: every media URL the API sends out is on the one public host. Rows saved before the move still hold URLs on the
// old per-server hosts; they are rewritten on the way out and the database is not touched. These fixtures spell the old
// hosts out on purpose: they are the input the helper has to catch.
const OLD_WEB = "https://knightbasins.srv1964473.hstgr.cloud";
const OLD_API = "https://api.srv1964473.hstgr.cloud";
const NEW = "https://knightbasins.com";

describe("canonicalMediaUrl", () => {
  it("moves the web host and the api host to knightbasins.com and keeps path and ?v=", () => {
    assert.equal(canonicalMediaUrl(`${OLD_WEB}/api/uploads/catalog-abc.png?v=mu46zh2e`), `${NEW}/api/uploads/catalog-abc.png?v=mu46zh2e`);
    assert.equal(canonicalMediaUrl(`${OLD_API}/kb/images/slab/BW010.png`), `${NEW}/kb/images/slab/BW010.png`);
    assert.equal(canonicalMediaUrl(`${OLD_API}/kb/images/basin-videos/KF024.mp4?v=2&x=y%20z`), `${NEW}/kb/images/basin-videos/KF024.mp4?v=2&x=y%20z`);
  });

  it("keeps the hash, forces https, drops credentials and is not fooled by letter case", () => {
    assert.equal(canonicalMediaUrl("http://knightbasins.srv1964473.hstgr.cloud/a/b.png?v=1#top"), `${NEW}/a/b.png?v=1#top`);
    assert.equal(canonicalMediaUrl("https://user:secret@api.srv1964473.hstgr.cloud/a.png"), `${NEW}/a.png`);
    assert.equal(canonicalMediaUrl("HTTPS://API.SRV1964473.HSTGR.CLOUD/Slab/BW010.PNG"), `${NEW}/Slab/BW010.PNG`);
  });

  it("returns a URL that is already on the new host exactly as given", () => {
    const url = `${NEW}/kb/images/slab/BW010.png?v=3`;
    assert.equal(canonicalMediaUrl(url), url);
    assert.equal(canonicalMediaUrl(`${NEW}/`), `${NEW}/`);
  });

  it("returns a relative path unchanged and never adds a domain to it", () => {
    for (const path of ["/api/uploads/a.png?v=1", "/kb/images/slab/x.png", "uploads/a.png", "../a.png", "//cdn.example.com/a.png"]) {
      assert.equal(canonicalMediaUrl(path), path, path);
    }
  });

  it("returns an outside host unchanged, including look-alikes of the old host", () => {
    for (const url of [
      "https://example.com/a.png",
      "https://images.unsplash.com/photo-1?w=800",
      "https://evil-srv1964473.hstgr.cloud/a.png",
      "https://api.srv1964473.hstgr.cloud.evil.example/a.png",
      "https://srv1964473.hstgr.cloud/a.png",
      "https://knightbasins.srv1964473.hstgr.cloud.example/a.png",
    ]) {
      assert.equal(canonicalMediaUrl(url), url, url);
    }
  });

  it("returns empty, null, undefined, blank text and unparsable text as they were", () => {
    assert.equal(canonicalMediaUrl(""), "");
    assert.equal(canonicalMediaUrl("   "), "   ");
    assert.equal(canonicalMediaUrl(null), null);
    assert.equal(canonicalMediaUrl(undefined), undefined);
    assert.equal(canonicalMediaUrl("https://"), "https://");
    assert.equal(canonicalMediaUrl("not a url"), "not a url");
  });

  it("the generated defaults are already on the new host", () => {
    assert.equal(CANONICAL_MEDIA_ORIGIN, NEW);
    assert.equal(basinImageUrl("KF002"), `${NEW}/kb/images/basin-hd/KF002.jpg`);
    assert.equal(basinVideoUrl("KF024"), `${NEW}/kb/images/basin-videos/KF024.mp4`);
    assert.equal(slabImageUrl("BW010"), `${NEW}/kb/images/slab/BW010.png`);
  });
});

/** Rows shaped like the database rows the /api/catalog route reads. */
const BASIN_ROWS = [
  {
    id: 1, sku: "KF001", category: "counter", categoryId: 1, active: true, priceTHB: 19000,
    imageUrl: `${OLD_WEB}/api/uploads/catalog-kf001.png?v=aa`,
    quoteImageUrl: `${OLD_API}/api/uploads/quote-kf001.png?v=bb`,
    topViewImageUrl: `${OLD_WEB}/api/uploads/top-kf001.png`,
    videoUrl: `${OLD_API}/kb/images/basin-videos/KF001.mp4?v=cc`,
    galleryImageUrls: [`${OLD_WEB}/api/uploads/g1.png?v=1`, `${NEW}/api/uploads/g2.png`, "https://example.com/g3.png", `${OLD_API}/api/uploads/g4.png`],
  },
  {
    id: 2, sku: "KF002", category: "counter", categoryId: 1, active: true, priceTHB: 17000,
    imageUrl: "", quoteImageUrl: null, videoUrl: "", galleryImageUrls: [],
  },
];
const STONE_ROWS = [
  {
    id: 1, code: "BW010", name: "Bright White", active: true,
    imageUrl: `${OLD_API}/api/uploads/catalog-bw010.png?v=dd`,
    quoteImageUrl: `${OLD_WEB}/api/uploads/quote-bw010.png`,
    slabImageUrl: `${OLD_API}/kb/images/slab/BW010.png`,
    galleryImageUrls: [`${OLD_WEB}/api/uploads/s1.png`, `${OLD_API}/api/uploads/s2.png?v=2`],
  },
  { id: 2, code: "EG501", name: "Glaring White", active: true, imageUrl: null, quoteImageUrl: null, slabImageUrl: null, galleryImageUrls: [] },
];
const CATEGORIES = [{ id: 1, name: "อ่างเคาน์เตอร์" }];

/** The same composition routes/catalog.ts getCatalogData() builds. */
function catalogPayload() {
  return {
    basins: BASIN_ROWS.map((basin) => withBasinCategory(withBasinMedia(basin), CATEGORIES)),
    categories: CATEGORIES,
    installedStones: STONE_ROWS.map(withStoneMedia),
    sheetStones: STONE_ROWS.map(withStoneMedia),
  };
}

describe("catalogue payload", () => {
  it("withBasinMedia moves every image and video field, the top view and each gallery entry", () => {
    const [first, second] = catalogPayload().basins;
    assert.equal(first?.imageUrl, `${NEW}/api/uploads/catalog-kf001.png?v=aa`);
    assert.equal(first?.quoteImageUrl, `${NEW}/api/uploads/quote-kf001.png?v=bb`);
    assert.equal(first?.topViewImageUrl, `${NEW}/api/uploads/top-kf001.png`);
    assert.equal(first?.videoUrl, `${NEW}/kb/images/basin-videos/KF001.mp4?v=cc`);
    assert.equal(first?.uploadedVideoUrl, `${NEW}/kb/images/basin-videos/KF001.mp4?v=cc`);
    assert.deepEqual(first?.galleryImageUrls, [`${NEW}/api/uploads/g1.png?v=1`, `${NEW}/api/uploads/g2.png`, "https://example.com/g3.png", `${NEW}/api/uploads/g4.png`]);
    // A basin with nothing stored gets the generated defaults, which are on the new host already.
    assert.equal(second?.imageUrl, `${NEW}/kb/images/basin-hd/KF002.jpg`);
    assert.equal(second?.videoUrl, `${NEW}/kb/images/basin-videos/KF002.mp4`);
    assert.equal(second?.quoteImageUrl, null);
    assert.equal(second?.uploadedVideoUrl, null);
  });

  it("withStoneMedia moves imageUrl, quoteImageUrl, slabImageUrl and the gallery, and fills a missing image from the slab default", () => {
    const [first, second] = catalogPayload().installedStones;
    assert.equal(first?.imageUrl, `${NEW}/api/uploads/catalog-bw010.png?v=dd`);
    assert.equal(first?.quoteImageUrl, `${NEW}/api/uploads/quote-bw010.png`);
    assert.equal(first?.slabImageUrl, `${NEW}/kb/images/slab/BW010.png`);
    assert.deepEqual(first?.galleryImageUrls, [`${NEW}/api/uploads/s1.png`, `${NEW}/api/uploads/s2.png?v=2`]);
    assert.equal(second?.imageUrl, `${NEW}/kb/images/slab/EG501.png`);
    assert.equal(second?.slabImageUrl, null);
  });

  it("the JSON the route sends has no old-host string left, every stored link comes out canonical, and the shape is unchanged", () => {
    const payload = catalogPayload();
    const json = JSON.stringify(payload);
    assert.ok(!json.includes("srv1964473"), "an old-host link survived in the payload");

    // Every link that was stored comes out as its canonical twin, none is dropped and none is left behind.
    const stored = JSON.stringify({ basins: BASIN_ROWS, stones: STONE_ROWS }).match(/https:\/\/[^"]+/g) ?? [];
    assert.equal(stored.length, 13, "the fixture stores 8 basin links and 5 stone links");
    for (const url of stored) assert.ok(json.includes(canonicalMediaUrl(url)), `${url} did not come out as ${canonicalMediaUrl(url)}`);

    assert.equal(payload.basins.length, BASIN_ROWS.length);
    assert.equal(payload.installedStones.length, STONE_ROWS.length);
    for (const [index, row] of BASIN_ROWS.entries()) {
      for (const key of Object.keys(row)) assert.ok(key in payload.basins[index]!, `basin field ${key} went missing`);
    }
    for (const [index, row] of STONE_ROWS.entries()) {
      for (const key of Object.keys(row)) assert.ok(key in payload.installedStones[index]!, `stone field ${key} went missing`);
    }
    // Nothing else about the rows changes: ids, prices, codes, names and the active flag are exactly as stored.
    assert.equal(payload.basins[0]?.priceTHB, 19000);
    assert.equal(payload.installedStones[0]?.name, "Bright White");
    assert.equal(payload.installedStones[0]?.active, true);
  });

  it("a row without a top-view or slab field does not gain one", () => {
    const basin = withBasinMedia({ sku: "KF009", imageUrl: `${OLD_WEB}/a.png` });
    assert.ok(!("topViewImageUrl" in basin));
    const stone = withStoneMedia({ code: "ST9", imageUrl: `${OLD_WEB}/a.png` });
    assert.ok(!("slabImageUrl" in stone) && !("galleryImageUrls" in stone));
    assert.equal(stone.imageUrl, `${NEW}/a.png`);
  });
});

describe("the other places that send a link out", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");

  it("/site-photos/showcase and the public job tracker rewrite the photo link", () => {
    assert.match(read("../src/routes/catalog.ts"), /imageUrl: canonicalMediaUrl\(row\.imageUrl\)/);
    assert.match(read("../src/routes/leads.ts"), /imageUrl: canonicalMediaUrl\(photo\.imageUrl\)/);
  });

  it("the stone matcher names no old host: it takes the origin from the shared constant", () => {
    const source = read("../src/lib/stone-matcher.ts");
    assert.ok(!source.includes("srv1964473"));
    assert.match(source, /const SLAB_IMAGE_ORIGIN = CANONICAL_MEDIA_ORIGIN;/);
    assert.match(source, /slabImageUrl: canonicalMediaUrl\(/);
  });
});

describe("stone matcher with a slab link stored on an old host", () => {
  const originalEnv = {
    projectId: process.env["VERTEX_AI_PROJECT_ID"],
    location: process.env["VERTEX_AI_LOCATION"],
    model: process.env["VERTEX_AI_MODEL"],
    json: process.env["GOOGLE_SERVICE_ACCOUNT_JSON"],
    credentials: process.env["GOOGLE_APPLICATION_CREDENTIALS"],
    disabled: process.env["GOOGLE_SERVICE_ACCOUNT_DISABLED"],
  };
  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };

  afterEach(() => {
    mock.restoreAll();
    restore("VERTEX_AI_PROJECT_ID", originalEnv.projectId);
    restore("VERTEX_AI_LOCATION", originalEnv.location);
    restore("VERTEX_AI_MODEL", originalEnv.model);
    restore("GOOGLE_SERVICE_ACCOUNT_JSON", originalEnv.json);
    restore("GOOGLE_APPLICATION_CREDENTIALS", originalEnv.credentials);
    restore("GOOGLE_SERVICE_ACCOUNT_DISABLED", originalEnv.disabled);
  });

  it("fetches the reference photo from the new host and never contacts the old one", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs1", format: "pem" },
      publicKeyEncoding: { type: "pkcs1", format: "pem" },
    });
    process.env["VERTEX_AI_PROJECT_ID"] = "canonical-media-test";
    process.env["VERTEX_AI_LOCATION"] = "asia-southeast1";
    process.env["VERTEX_AI_MODEL"] = "test-model";
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = JSON.stringify({ client_email: "", private_key: privateKey });
    delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
    delete process.env["GOOGLE_SERVICE_ACCOUNT_DISABLED"];

    const urls: string[] = [];
    mock.method(globalThis, "fetch", async (input: string | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "canonical-media-test-token" }), { status: 200 });
      }
      if (url.startsWith(`${NEW}/kb/images/slab/`)) {
        return new Response(Buffer.from([0x89, 0x50, 0x4e, 0x47]), { status: 200, headers: { "Content-Type": "image/png" } });
      }
      if (url.includes("aiplatform.googleapis.com")) {
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ matches: [{ code: "ST001", reason: "Similar." }] }) }] } }] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await suggestStonesForPhoto(Buffer.from([0x10, 0x20, 0x30]), "image/jpeg", [
      { code: "ST001", name: "Cloud White", slabImageUrl: `${OLD_API}/kb/images/slab/ST001.png` },
    ]);

    assert.equal(result.status, "ok");
    assert.ok(urls.includes(`${NEW}/kb/images/slab/ST001.png`), "the reference photo was not requested from the new host");
    assert.ok(!urls.some((url) => url.includes("srv1964473")), "the old host was contacted");
  });
});
