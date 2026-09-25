import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const pageUrl = new URL("../src/pages/PortfolioPage.tsx", import.meta.url);
const pageSource = await readFile(pageUrl, "utf8");
const pageAst = ts.createSourceFile(
  fileURLToPath(pageUrl),
  pageSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const helperNames = ["filterPortfolioPhotos", "portfolioInquiryUrl"] as const;

type TestPhoto = {
  id: string;
  category: string;
  categoryName: string;
  icon: string;
  url: string;
  width: number;
  height: number;
  title: string;
  captionTh?: string;
};

function loadPortfolioHelpers() {
  const helpers = pageAst.statements.filter(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement)
      && Boolean(statement.name)
      && helperNames.includes(statement.name!.text as (typeof helperNames)[number]),
  );
  assert.equal(
    helpers.length,
    helperNames.length,
    "PortfolioPage should declare each tested search and inquiry helper",
  );
  const helperSource = helpers
    .map((helper) => pageSource.slice(helper.getStart(pageAst), helper.end).replace(/^export\s+/, ""))
    .join("\n");
  const exportList = helperNames.join(", ");
  const compiled = ts.transpileModule(
    `${helperSource}\nreturn { ${exportList} };`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  return new Function(compiled)() as {
    filterPortfolioPhotos: (photos: readonly TestPhoto[], search: string) => TestPhoto[];
    portfolioInquiryUrl: () => string;
  };
}

const { filterPortfolioPhotos, portfolioInquiryUrl } = loadPortfolioHelpers();

function photo(overrides: Partial<TestPhoto> = {}): TestPhoto {
  return {
    id: "photo-1",
    category: "bathroom",
    categoryName: "งานห้องน้ำ",
    icon: "🛁",
    url: "/portfolio/photo-1.jpg",
    width: 1200,
    height: 900,
    title: "อ่างล้างหน้าคู่",
    captionTh: "อ่างคู่พร้อมเคาน์เตอร์",
    ...overrides,
  };
}

describe("portfolio inquiry and instant search", () => {
  it("searches Thai captions and category names", () => {
    const bathroom = photo();
    const kitchen = photo({
      id: "photo-2",
      category: "kitchen",
      categoryName: "งานครัว",
      title: "Kitchen island",
      captionTh: "เคาน์เตอร์ครัว",
    });

    assert.deepEqual(filterPortfolioPhotos([bathroom, kitchen], "อ่างคู่"), [bathroom]);
    assert.deepEqual(filterPortfolioPhotos([bathroom, kitchen], "งานครัว"), [kitchen]);
  });

  it("matches English search case-insensitively in captions and category slugs", () => {
    const kitchen = photo({
      category: "kitchen",
      categoryName: "งานครัว",
      title: "Kitchen island",
      captionTh: "Modern Counter",
    });

    assert.deepEqual(filterPortfolioPhotos([kitchen], "mOdErN"), [kitchen]);
    assert.deepEqual(filterPortfolioPhotos([kitchen], "KITCHEN"), [kitchen]);
  });

  it("returns all loaded photos for a blank search", () => {
    const photos = [photo(), photo({ id: "photo-2", category: "kitchen" })];
    assert.deepEqual(filterPortfolioPhotos(photos, "   "), photos);
  });

  it("builds the requested LINE inquiry URL", () => {
    assert.equal(portfolioInquiryUrl(), "https://line.me/R/ti/p/@789gcnhq");
  });

  it("renders the search field, clear action, and lightbox CTAs", () => {
    assert.match(pageSource, /data-testid="input-portfolio-search"/);
    assert.match(pageSource, /ค้นหาผลงาน เช่น อ่างคู่, ครัว, ผนัง, เคาน์เตอร์\.\.\./);
    assert.match(pageSource, /data-testid="button-clear-portfolio-search"/);
    assert.match(pageSource, /data-testid="portfolio-lightbox-category"/);
    assert.match(pageSource, /data-testid="portfolio-lightbox-caption-text"/);
    assert.match(pageSource, /target="_blank"\s+rel="noopener noreferrer"/);
    assert.match(pageSource, /href="\/studio"/);
  });
});