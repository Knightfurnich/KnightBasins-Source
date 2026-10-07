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
const { default: PriceGuidePage, PRICE_GUIDE_INSTALLATION_RATES } = await import(${JSON.stringify(pageUrl)});
const page = createElement(
  Router,
  { hook: () => ["/price-guide", () => {}] },
  createElement(PriceGuidePage),
);
process.stdout.write(JSON.stringify({
  markup: renderToStaticMarkup(page),
  ratePrices: PRICE_GUIDE_INSTALLATION_RATES.map((tier) => tier.price),
  basinInstallationFreeFrom: ${BASIN_INSTALLATION_FREE_FROM},
  nightWorkStart: ${JSON.stringify(NIGHT_WORK_START)},
  nightWorkEnd: ${JSON.stringify(NIGHT_WORK_END)},
}));
`;

type PageHarness = {
  markup: string;
  ratePrices: number[];
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

    assert.equal(catalogueTiers.length, 3, "the guide expects the three current installed-price tiers");
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

  it("emits Product and Service JSON-LD without offers, prices or ratings", () => {
    const schema = buildPriceGuideJsonLd();
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    assert.deepEqual(graph.map((entity) => entity["@type"]), ["Product", "Service"]);
    assert.equal((graph[0].brand as Record<string, unknown>)["@id"], "https://knightbasins.com/#organization");
    assert.equal((graph[1].provider as Record<string, unknown>)["@id"], "https://knightbasins.com/#organization");
    assert.doesNotMatch(JSON.stringify(schema), /"(?:offers?|price|aggregateRating|review|rating)"/i);

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
});
