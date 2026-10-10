import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, describe, it } from "node:test";
import {
  formatTHB,
  INSTALLATION_PRICE,
  STONE_COLORS,
  STONE_INSTALLED_MIN_BANGKOK_SQM,
  STONE_INSTALLED_MIN_PROVINCE_SQM,
  STONE_SMALL_JOB_BANGKOK_FEE,
  STONE_SMALL_JOB_PROVINCE_FEE,
  VAT_RATE,
} from "../src/data/catalog.ts";
import {
  breadcrumbItemsForPath,
  buildBreadcrumbListJsonLd,
  buildPriceGuideJsonLd,
  type OfferRange,
} from "../src/data/structured-data.ts";
import { ROUTE_META } from "../src/components/RouteMeta.logic.ts";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const appRoot = join(testDirectory, "..");
const pagePath = join(appRoot, "src/pages/PriceGuidePage.tsx");
const appSource = readFileSync(join(appRoot, "src/App.tsx"), "utf8");
const pageSource = readFileSync(pagePath, "utf8");
const sitemap = readFileSync(join(appRoot, "public/sitemap.xml"), "utf8");
const tsxLoaderPath = join(appRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");
const pageUrl = pathToFileURL(pagePath).href;

const BASIN_INSTALLATION_FREE_FROM = 3;
const NIGHT_WORK_START = "20:00";
const NIGHT_WORK_END = "05:00";

const HARNESS_SCRIPT = `
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
const { default: PriceGuidePage, PRICE_GUIDE_INSTALLATION_RATES, PRICE_GUIDE_SCHEMA_PRICES } = await import(${JSON.stringify(pageUrl)});
const page = createElement(
  Router,
  { hook: () => ["/price-guide", () => {}] },
  createElement(PriceGuidePage),
);
process.stdout.write(JSON.stringify({
  markup: renderToStaticMarkup(page),
  ratePrices: PRICE_GUIDE_INSTALLATION_RATES.map((tier) => tier.price),
  schemaPrices: PRICE_GUIDE_SCHEMA_PRICES,
  basinInstallationFreeFrom: ${BASIN_INSTALLATION_FREE_FROM},
  nightWorkStart: ${JSON.stringify(NIGHT_WORK_START)},
  nightWorkEnd: ${JSON.stringify(NIGHT_WORK_END)},
}));
`;

type PageHarness = {
  markup: string;
  ratePrices: number[];
  schemaPrices: { sheet: OfferRange | null; installed: OfferRange | null };
  basinInstallationFreeFrom: number;
  nightWorkStart: string;
  nightWorkEnd: string;
};

let pageHarness: PageHarness;
let harnessDirectory: string | undefined;

before(() => {
  if (!existsSync(tsxLoaderPath)) {
    throw new Error(`Expected tsx's loader at ${tsxLoaderPath}; run "pnpm install" at the repo root.`);
  }
  harnessDirectory = mkdtempSync(join(appRoot, "node_modules", ".knight-price-guide-test-"));
  const tsconfigPath = join(harnessDirectory, "tsconfig.override.json");
  const harnessPath = join(harnessDirectory, "render.mjs");
  writeFileSync(
    tsconfigPath,
    JSON.stringify({
      extends: join(appRoot, "tsconfig.json").replace(/\\/g, "/"),
      compilerOptions: { jsx: "react-jsx" },
    }),
  );
  writeFileSync(harnessPath, HARNESS_SCRIPT);
  const stdout = execFileSync(
    process.execPath,
    ["--import", pathToFileURL(tsxLoaderPath).href, harnessPath],
    {
      cwd: appRoot,
      env: { ...process.env, TSX_TSCONFIG_PATH: tsconfigPath },
      encoding: "utf8",
    },
  );
  pageHarness = JSON.parse(stdout) as PageHarness;
});

after(() => {
  if (harnessDirectory) rmSync(harnessDirectory, { recursive: true, force: true });
});

function visibleText(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

describe("price guide page", () => {
  it("renders a Thai title and all six required content topics", () => {
    const text = visibleText(pageHarness.markup);
    assert.equal((pageHarness.markup.match(/<h1\b/g) ?? []).length, 1);
    for (const heading of [
      "ราคาเคาน์เตอร์หินสังเคราะห์",
      "3 วิธีสั่งซื้อและช่วงราคา",
      "วิธีคิดพื้นที่และวัดหน้างาน",
      "ค่าดำเนินการและขั้นต่ำ",
      "วิธีเลือกสีให้เหมาะกับงาน",
      "วิธีดูแลรักษาผิวหินสังเคราะห์",
      "คำถามที่พบบ่อย",
    ]) {
      assert.ok(text.includes(heading), `Missing required page heading: ${heading}`);
    }
  });

  it("renders the installed price tiers from the live stone catalogue", () => {
    const catalogueTiers = [
      ...new Set(
        STONE_COLORS.flatMap((stone) =>
          stone.installedPriceTHB === null ? [] : [stone.installedPriceTHB],
        ),
      ),
    ].sort((first, second) => first - second);

    // job-277 brought VW342 "Aria Whisper" back at 12,000 a sqm, so the catalogue now carries four rates.
    assert.equal(catalogueTiers.length, 4, "the guide expects the four current installed-price tiers");
    assert.deepEqual(pageHarness.ratePrices, catalogueTiers);
    for (const tier of catalogueTiers) {
      assert.ok(
        visibleText(pageHarness.markup).includes(formatTHB(tier)),
        `The guide should render the catalogue's ${formatTHB(tier)} installed rate`,
      );
    }
    assert.match(pageSource, /STONE_COLORS\.flatMap/);
    assert.match(pageSource, /formatTHB\(tier\.price\)/);
  });

  it("matches published fees, area minimums and VAT to the application constants", () => {
    const text = visibleText(pageHarness.markup);
    for (const amount of [
      STONE_SMALL_JOB_BANGKOK_FEE,
      STONE_SMALL_JOB_PROVINCE_FEE,
      INSTALLATION_PRICE,
    ]) {
      assert.ok(text.includes(formatTHB(amount)), `Missing current fee ${formatTHB(amount)}`);
    }
    assert.ok(text.includes(`${STONE_INSTALLED_MIN_BANGKOK_SQM} ตร.ม.`));
    assert.ok(text.includes(`${STONE_INSTALLED_MIN_PROVINCE_SQM} ตร.ม.`));
    assert.ok(text.includes(`${Math.round(VAT_RATE * 100)}%`));
    assert.ok(text.includes(`น้อยกว่า ${pageHarness.basinInstallationFreeFrom} ชุด`));
    assert.ok(text.includes(`ตั้งแต่ ${pageHarness.basinInstallationFreeFrom} ชุดขึ้นไป`));
    assert.ok(text.includes(`${pageHarness.nightWorkStart}–${pageHarness.nightWorkEnd}`));
  });

  it("directs raw-sheet shoppers to the live catalogue without inventing a sheet price", () => {
    const card = pageHarness.markup.match(
      /<section[^>]*data-testid="raw-slab-guidance"[^>]*>([\s\S]*?)<\/section>/,
    );
    assert.ok(card, "Missing raw-sheet guidance");
    assert.doesNotMatch(card[1], /฿\s*[\d,]+|\b\d[\d,]*\s*บาท/);
    assert.match(card[1], /href="\/stone"/);
  });

  it("links to stone, quote and portfolio without nofollow on internal links", () => {
    const anchors = [...pageHarness.markup.matchAll(/<a\b[^>]*href="\/[^"]+"[^>]*>/g)].map(
      (match) => match[0],
    );
    const destinations = anchors.map((anchor) => anchor.match(/\bhref="([^"]+)"/)?.[1]);
    for (const destination of ["/stone", "/quote", "/portfolio"]) {
      assert.ok(destinations.includes(destination), `Missing internal link to ${destination}`);
    }
    for (const anchor of anchors) {
      assert.doesNotMatch(anchor, /\brel="[^"]*\bnofollow\b/i);
    }
    assert.match(appSource, /data-testid="link-footer-price-guide"/);
    assert.match(appSource, /href="\/price-guide"/);
  });

  it("registers unique route metadata and includes one canonical sitemap entry", () => {
    const metadata = ROUTE_META["/price-guide"];
    assert.ok(metadata, "RouteMeta must index the price-guide route");
    assert.match(metadata.title, /ราคาเคาน์เตอร์หินสังเคราะห์/);
    assert.ok(metadata.description.length > 0);
    const urls = [...sitemap.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) => match[1].trim());
    assert.equal(urls.length, 12);
    assert.equal(urls.filter((url) => url === "https://knightbasins.com/price-guide").length, 1);
    assert.match(appSource, /<Route path="\/price-guide" component=\{PriceGuidePage\} \/>/);
  });

  it("publishes offers read from the catalogue, never from the schema module", () => {
    // job-274 forbade prices in route JSON-LD; Google then reported "Either 'offers', 'review', or
    // 'aggregateRating' should be specified" for both Product nodes. The rule is now: publish the
    // bands the page already shows, taken from STONE_COLORS — so this test reads the page's own
    // schema input and compares it to the catalogue, not to a number typed in the test either.
    const schema = buildPriceGuideJsonLd(pageHarness.schemaPrices);
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    assert.deepEqual(graph.map((entity) => entity["@type"]), ["Product", "Service"]);
    assert.equal((graph[0].brand as Record<string, unknown>)["@id"], "https://knightbasins.com/#organization");
    assert.equal((graph[1].provider as Record<string, unknown>)["@id"], "https://knightbasins.com/#organization");

    const offers = graph[0].offers as Array<Record<string, unknown>>;
    assert.equal(offers.length, 2, "the Product must carry one band per buying option");
    const installed = offers.find((offer) => offer["@id"] === "https://knightbasins.com/price-guide#offer-installed")!;
    const sheet = offers.find((offer) => offer["@id"] === "https://knightbasins.com/price-guide#offer-sheet")!;
    const installedPrices = STONE_COLORS.map((stone) => stone.installedPriceTHB).filter((price): price is number => price !== null);
    const sheetPrices = STONE_COLORS.map((stone) => stone.sheetPriceTHB).filter((price): price is number => price !== null);
    assert.equal(installed.lowPrice, Math.min(...installedPrices));
    assert.equal(installed.highPrice, Math.max(...installedPrices));
    assert.equal(sheet.lowPrice, Math.min(...sheetPrices));
    assert.equal(sheet.highPrice, Math.max(...sheetPrices));
    assert.equal(installed.priceCurrency, "THB");
    assert.equal(installed.availability, "https://schema.org/InStock");
    assert.equal((installed.priceSpecification as Record<string, unknown>).unitText, "ตร.ม.");
    assert.equal((sheet.priceSpecification as Record<string, unknown>).unitText, "แผ่น");
    // A rating is never invented: only an Offer is published.
    assert.equal(/"(?:aggregateRating|review|rating)"/i.test(JSON.stringify(schema)), false);

    const breadcrumbs = breadcrumbItemsForPath("/price-guide");
    assert.deepEqual(breadcrumbs, [
      { name: "หน้าแรก", path: "/" },
      { name: "ราคาและวิธีเลือกหินสังเคราะห์", path: "/price-guide" },
    ]);
    const breadcrumbSchema = buildBreadcrumbListJsonLd(breadcrumbs ?? []);
    assert.equal(breadcrumbSchema["@type"], "BreadcrumbList");
    assert.equal(
      (breadcrumbSchema.itemListElement as Array<Record<string, unknown>>)[1]?.item,
      "https://knightbasins.com/price-guide",
    );
  });

  it("omits offers instead of inventing a price when the catalogue has none", () => {
    const empty = buildPriceGuideJsonLd({ sheet: null, installed: null });
    const product = (empty["@graph"] as Array<Record<string, unknown>>)[0];
    assert.equal("offers" in product, false);
    assert.equal(/"price/i.test(JSON.stringify(empty)), false);
  });
});

// job-286 A/C/D: the comparison table, the per-route social card, and the footer label.
const STONE_COLOR_LIST = STONE_COLORS;
// Live measurement on 8 Oct 2026: /studio-guide renders 267 words and /price-guide 220. The two files keep
// their own tests, so the target is restated here rather than imported.
const STUDIO_GUIDE_WORDS = 267;

describe("price guide comparison table (job-286 A)", () => {
  const range = (values: ReadonlyArray<number>) => {
    const low = Math.min(...values);
    const high = Math.max(...values);
    return low === high ? formatTHB(low) : `${formatTHB(low)}–${formatTHB(high)}`;
  };
  const installedRange = range(STONE_COLOR_LIST.map((s) => s.installedPriceTHB).filter((v): v is number => v !== null));
  const sheetRange = range(STONE_COLOR_LIST.map((s) => s.sheetPriceTHB).filter((v): v is number => v !== null));

  it("compares the three ways of buying in a real table, not three cards", () => {
    assert.equal((pageHarness.markup.match(/<table\b/g) ?? []).length >= 1, true, "the page still has no <table>");
    assert.equal((pageHarness.markup.match(/<thead\b/g) ?? []).length >= 1, true, "a table without <thead> is not machine-readable");
    assert.equal((pageHarness.markup.match(/<th scope="row"/g) ?? []).length >= 3, true, "each buying option should be a row header");
  });

  it("quotes the price range from the catalogue instead of a typed number", () => {
    const text = visibleText(pageHarness.markup);
    assert.ok(text.includes(installedRange), `expected the installed range ${installedRange} on the page`);
    assert.ok(text.includes(sheetRange), `expected the sheet range ${sheetRange} on the page`);
    for (const tier of pageHarness.ratePrices) {
      assert.ok(text.includes(formatTHB(tier)), `installed rate ${tier} is missing from the rendered page`);
    }
  });

  it("keeps the page as substantial as the studio guide, and prices only where the table shows them", () => {
    const words = visibleText(pageHarness.markup).split(/\s+/).length;
    assert.ok(words >= STUDIO_GUIDE_WORDS, `the guide renders ${words} words, below /studio-guide's ${STUDIO_GUIDE_WORDS}`);
    // Every number in the schema must be a number the page prints too (job-274 rule, updated
    // for Google's "offers should be specified"): no offer band may exist that the table lacks.
    const schema = JSON.stringify(buildPriceGuideJsonLd(pageHarness.schemaPrices));
    const text = visibleText(pageHarness.markup);
    for (const band of [installedRange, sheetRange]) {
      assert.ok(text.includes(band), `the page must show ${band}`);
    }
    for (const price of [Math.min(...pageHarness.ratePrices), Math.max(...pageHarness.ratePrices)]) {
      assert.ok(schema.includes(`"lowPrice":${price}`) || schema.includes(`"highPrice":${price}`)
        || schema.includes(`"lowPrice":${price},`) || schema.includes(`"highPrice":${price},`),
        `offer bound ${price} must come from the catalogue rates the page lists`);
    }
  });
});

describe("per-route social cards and the footer release label (job-286 C/D)", () => {
  it("gives the crawler pages their own og:image, and only with files that exist", () => {
    const withImage = Object.entries(ROUTE_META).filter(([, entry]) => "image" in entry);
    assert.ok(withImage.length >= 3, `expected at least 3 routes with their own card, found ${withImage.length}`);
    const paths = new Set(withImage.map(([, entry]) => entry.image!.path));
    assert.equal(paths.size >= 3, true, "routes may not all point at the same picture");
    for (const [path, entry] of withImage) {
      const image = entry.image!;
      assert.ok(existsSync(join(appRoot, "public", image.path.slice(1))), `${path} points at a missing file ${image.path}`);
      assert.equal(image.width > 0 && image.height > 0, true, `${path} needs real dimensions`);
      assert.ok(image.alt.length > 10, `${path} needs a descriptive alt`);
    }
  });

  it("reads the footer release label from the release log instead of typing it", () => {
    assert.match(appSource, /const LATEST_UPDATE_VERSION = UPDATE_RELEASES\[0\]\?\.version/);
    assert.equal(appSource.includes("บันทึกการอัปเดต (v2."), false, "the version must not be hard-coded in the footer");
  });
});
