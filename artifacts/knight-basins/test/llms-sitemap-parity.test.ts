import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";

import {
  INSTALLATION_PRICE,
  STONE_COLORS,
  STONE_INSTALLED_MIN_BANGKOK_SQM,
  STONE_INSTALLED_MIN_PROVINCE_SQM,
  STONE_SHEET_SIZE,
  STONE_SHEET_THICKNESS,
  STONE_SMALL_JOB_BANGKOK_FEE,
  STONE_SMALL_JOB_PROVINCE_FEE,
  VAT_RATE,
} from "../src/data/catalog.ts";
import { buildPriceGuideJsonLd } from "../src/data/structured-data.ts";
import { ROUTE_META } from "../src/components/RouteMeta.logic.ts";

// job-282: llms.txt and llms-full.txt are what an AI crawler reads when it does not run JavaScript, and
// nothing generates them — so they drift silently. Two drifts happened at once here: /price-guide and
// /network shipped in the sitemap but never reached llms.txt, and the price-guide page grew a fourth
// installed rate (VW342 Aria Whisper, 12,000 a sqm, restored in job 277) that the AI copy still did not
// mention. These locks keep both files in step with the app that actually prices the work.
//
// No number below is written by hand. The rates come from STONE_COLORS, the fees and thresholds from the
// catalogue constants, and the basin-set / night-work policy from the price-guide page's own source — so
// changing the app changes the test's expectation before the prose can fall behind.

const ORIGIN = "https://knightbasins.com";
const sitemap = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
const llmsTxt = readFileSync(new URL("../public/llms.txt", import.meta.url), "utf8");
const llmsFullTxt = readFileSync(new URL("../public/llms-full.txt", import.meta.url), "utf8");
const priceGuidePage = readFileSync(new URL("../src/pages/PriceGuidePage.tsx", import.meta.url), "utf8");

const baht = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const pathOf = (url: string) => {
  const trimmed = url.replace(ORIGIN, "").replace(/[.,;]+$/, "");
  return trimmed === "" ? "/" : trimmed;
};

const sitemapPaths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => pathOf(match[1]).replace(/\/$/, "") || "/");
const llmsPaths = [...llmsTxt.matchAll(new RegExp(`${ORIGIN.replace(/[.]/g, "\\$&")}[A-Za-z0-9/_.-]*`, "g"))]
  .map((match) => pathOf(match[0]).replace(/\/$/, "") || "/");

/** llms.txt documents the AI files themselves, which are deliberately absent from the sitemap. */
const AI_FILES_OUTSIDE_SITEMAP = ["/llms-full.txt", "/llms.txt"];

// The four installed rates, read the same way the price-guide page reads them.
const installedTiers = [...new Set(
  STONE_COLORS.map((stone) => stone.installedPriceTHB).filter((price): price is number => price !== null),
)].sort((first, second) => first - second);

const constantOf = (source: string, name: string): string => {
  const match = source.match(new RegExp(`const ${name} = ["]?([^"\n;]+)["]?;`));
  assert.ok(match, `${name} must still exist in PriceGuidePage.tsx for the AI copy to be verifiable`);
  return match[1].trim();
};
const basinFreeFrom = constantOf(priceGuidePage, "BASIN_INSTALLATION_FREE_FROM");
const nightStart = constantOf(priceGuidePage, "NIGHT_WORK_START");
const nightEnd = constantOf(priceGuidePage, "NIGHT_WORK_END");
const priceGuideSection = llmsFullTxt.slice(llmsFullTxt.indexOf("## 14."));

describe("llms.txt covers every page the sitemap advertises (job-282 A)", () => {
  it("no sitemap URL is missing from llms.txt", () => {
    const missing = sitemapPaths.filter((path) => !llmsPaths.includes(path));
    assert.deepEqual(missing, [], `llms.txt must link ${sitemapPaths.length} sitemap pages, missing: ${missing.join(" · ")}`);
  });

  it("the price-guide and the network page are listed as named entries, not bare urls", () => {
    // Matching the Thai label literally would depend on the Unicode order of vowel and tone marks, so what gets
    // locked is the shape of the line — a bold label followed by the URL, exactly like every other entry.
    for (const path of ["/price-guide", "/network"]) {
      const line = llmsTxt.split("\n").find((entry) => entry.trim().endsWith(`${ORIGIN}${path}`));
      assert.ok(line, `llms.txt must carry its own line for ${path}`);
      assert.match(line, /^- \*\*.+\*\* https:\/\/knightbasins\.com\/[a-z-]+$/, `${path} must be listed as "- **label:** url", like every other entry`);
    }
  });

  it("llms.txt does not point at pages that are not in the sitemap", () => {
    const extra = [...new Set(llmsPaths)].filter((path) => !sitemapPaths.includes(path) && !AI_FILES_OUTSIDE_SITEMAP.includes(path));
    assert.deepEqual(extra, [], `llms.txt links pages the sitemap never declares: ${extra.join(" · ")}`);
  });
});

describe("llms-full.txt copies the app's numbers, not remembered ones (job-282 B)", () => {
  it("carries a price-guide section that names the page and the contact network", () => {
    assert.ok(llmsFullTxt.includes("## 14."), "llms-full.txt must keep a numbered section for /price-guide");
    assert.ok(llmsFullTxt.includes(`${ORIGIN}/price-guide`), "the price-guide URL must appear in llms-full.txt");
    assert.ok(priceGuideSection.includes(`${ORIGIN}/network`), "the new section must point at /network as well");
  });

  it("lists every installed rate the catalogue actually sells", () => {
    assert.equal(installedTiers.length, 4, `the catalogue sells ${installedTiers.length} installed rates, expected 4 after job 277 restored Aria Whisper`);
    for (const price of installedTiers) {
      assert.ok(priceGuideSection.includes(`${baht.format(price)} บาท / ตร.ม.`), `llms-full.txt §14 must state the ${baht.format(price)} rate`);
    }
  });

  it("states the small-job thresholds and fees from the catalogue constants", () => {
    assert.ok(priceGuideSection.includes(`${STONE_INSTALLED_MIN_BANGKOK_SQM} ตร.ม.`), "bangkok minimum area");
    assert.ok(priceGuideSection.includes(`${baht.format(STONE_SMALL_JOB_BANGKOK_FEE)} บาท / งาน`), "bangkok small-job fee");
    assert.ok(priceGuideSection.includes(`${STONE_INSTALLED_MIN_PROVINCE_SQM} ตร.ม.`), "province minimum area");
    assert.ok(priceGuideSection.includes(`${baht.format(STONE_SMALL_JOB_PROVINCE_FEE)} บาท / งาน`), "province small-job fee");
  });

  it("states the basin, night-work, VAT and sheet rules the price-guide page shows", () => {
    assert.ok(priceGuideSection.includes(`${basinFreeFrom} ชุด`), `the free-installation threshold (${basinFreeFrom} sets) must be quoted as the page says it`);
    assert.ok(priceGuideSection.includes(`${baht.format(INSTALLATION_PRICE)} บาท / ชุด`), "basin installation fee");
    assert.ok(priceGuideSection.includes(`${baht.format(INSTALLATION_PRICE)} บาท / คืน`), "night-work fee");
    assert.ok(priceGuideSection.includes(`${nightStart}–${nightEnd}`), "night-work window");
    assert.ok(priceGuideSection.includes(`VAT ${Math.round(VAT_RATE * 100)}%`), "VAT rate");
    assert.ok(priceGuideSection.includes(STONE_SHEET_SIZE) && priceGuideSection.includes(STONE_SHEET_THICKNESS), "standard sheet size and thickness");
  });

  it("publishes the catalogue price bands Google asks for, and nothing more", () => {
    // job-274 kept prices out of structured data; Google then refused the Product with
    // "Either 'offers', 'review', or 'aggregateRating' should be specified". Offers now come from
    // the catalogue via the page, so the check is: offers exist, are priced in THB, and no rating
    // is ever invented alongside them.
    const schema = buildPriceGuideJsonLd({ sheet: { lowPrice: 4900, highPrice: 12000, unitText: "แผ่น", offerCount: 64 }, installed: { lowPrice: 7500, highPrice: 12000, unitText: "ตร.ม.", offerCount: 65 } }, ROUTE_META["/price-guide"]?.image?.path);
    const json = JSON.stringify(schema);
    assert.equal(json.includes('"offers"'), true, "the Product must carry offers");
    assert.equal(json.includes('"priceCurrency":"THB"'), true, "offers must be priced in THB");
    for (const forbidden of ["aggregateRating", "review", '"rating"']) {
      assert.equal(json.includes(forbidden), false, `the price-guide JSON-LD must not carry ${forbidden}`);
    }
  });

  it("the Product's image is the route's own picture, a full URL to a file that exists (job-413)", () => {
    const meta = ROUTE_META["/price-guide"]!.image!;
    const schema = buildPriceGuideJsonLd({ sheet: { lowPrice: 4900, highPrice: 12000, unitText: "แผ่น", offerCount: 64 } }, meta.path);
    const product = (schema["@graph"] as Array<Record<string, unknown>>)[0];
    assert.equal(product.image, `${ORIGIN}${meta.path}`);
    const file = new URL(`../public${meta.path}`, import.meta.url);
    assert.ok(existsSync(file), `${meta.path} is missing from public/`);
    assert.ok(statSync(file).size > 30_000, `${meta.path} is too small to be a real picture`);
    assert.equal(JSON.stringify(schema).includes("aggregateRating"), false);
    // No picture handed in means no image key -- never a guessed path.
    assert.equal("image" in (buildPriceGuideJsonLd({})["@graph"] as Array<Record<string, unknown>>)[0], false);
  });
});

describe("every rate list in the copy names all four rates (job-283)", () => {
  // "฿7,500 / ฿8,500 / ฿9,500" once sat in four places at once — llms-full.txt, the studio-guide page,
  // the studio-guide JSON-LD and llms.txt. Catalogue changes reach the price calculators automatically and
  // the price-guide page builds its own tier list from STONE_COLORS, but a hand-written list of rates just
  // keeps printing the old number until a customer or an AI model notices. Every "฿ / ฿ / …" run in the copy
  // is therefore compared against the tiers the catalogue sells today.
  const expected = installedTiers.map((price) => `\u0e3f${baht.format(price)}`).join(" / ");
  const copied: Array<[string, string]> = [
    ["public/llms.txt", llmsTxt],
    ["public/llms-full.txt", llmsFullTxt],
    ["src/data/structured-data.ts", readFileSync(new URL("../src/data/structured-data.ts", import.meta.url), "utf8")],
    ["src/pages/StudioGuidePage.tsx", readFileSync(new URL("../src/pages/StudioGuidePage.tsx", import.meta.url), "utf8")],
  ];

  it("a rate list exists in the copy at all, so this test cannot pass by deleting the copy", () => {
    const lists = copied.flatMap(([, text]) => [...text.matchAll(/\u0e3f[\d,]+(?: \/ \u0e3f[\d,]+)+/g)]);
    assert.ok(lists.length >= 3, `expected the studio-guide rate list in at least three places, found ${lists.length}`);
  });

  it("no copy still prints a short rate list", () => {
    for (const [file, text] of copied) {
      for (const match of text.matchAll(/\u0e3f[\d,]+(?: \/ \u0e3f[\d,]+)+/g)) {
        assert.equal(match[0], expected, `${file} lists "${match[0]}" but the catalogue sells ${expected}`);
      }
    }
  });
});
