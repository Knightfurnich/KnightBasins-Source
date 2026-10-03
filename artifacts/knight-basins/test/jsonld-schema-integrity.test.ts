/**
 * Automated guard for every JSON-LD source in this app, so a future edit to
 * index.html's structured data (or to structured-data.ts) that breaks the
 * JSON or drops a required entity/field fails CI instead of silently
 * degrading rich results and AI-citation quality in production.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  buildPortfolioStructuredData,
  buildSitePrepStructuredData,
  buildStudioGuideStructuredData,
  buildBasinProductsJsonLd,
  buildBreadcrumbListJsonLd,
  breadcrumbItemsForPath,
  buildFaqPageJsonLd,
} from "../src/data/structured-data.ts";
import { PRODUCTS } from "../src/data/catalog.ts";
import { KNIGHT_FAQ_ITEMS } from "../src/data/faq-data.ts";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function extractLdJsonScripts(html: string): string[] {
  const scripts: string[] = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) scripts.push(match[1]!);
  return scripts;
}

describe("index.html JSON-LD scripts", () => {
  const scripts = extractLdJsonScripts(indexHtml);

  it("has at least one ld+json script block", () => {
    assert.ok(scripts.length > 0);
  });

  it("every ld+json script block is valid JSON with no syntax errors", () => {
    for (const script of scripts) {
      assert.doesNotThrow(() => JSON.parse(script), `invalid JSON in one of the ld+json <script> blocks`);
    }
  });

  it("carries every entity the site depends on for AEO/GEO", () => {
    const graphTypes = new Set(
      scripts.flatMap((script) => {
        const data = JSON.parse(script);
        const graph = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
        return graph.map((node: Record<string, unknown>) => node["@type"]);
      }),
    );
    for (const required of ["HomeAndConstructionBusiness", "WebSite", "SiteNavigationElement", "FAQPage"]) {
      assert.ok(graphTypes.has(required), `missing required entity: ${required}`);
    }
  });

  it("FAQPage has all 10 questions, each with a non-empty question and answer", () => {
    const data = JSON.parse(scripts[0]!);
    const graph = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
    const faqPage = graph.find((node: Record<string, unknown>) => node["@type"] === "FAQPage");
    assert.ok(faqPage, "FAQPage entity not found");
    const mainEntity = faqPage.mainEntity as Array<Record<string, unknown>>;
    assert.equal(mainEntity.length, 10);
    for (const question of mainEntity) {
      assert.equal(question["@type"], "Question");
      assert.ok(typeof question.name === "string" && question.name.trim().length > 0, "empty question text");
      const answer = question.acceptedAnswer as Record<string, unknown>;
      assert.equal(answer["@type"], "Answer");
      assert.ok(typeof answer.text === "string" && answer.text.trim().length > 0, "empty answer text");
    }
  });

  it("keeps the original 6 questions intact alongside the 4 new ones", () => {
    const data = JSON.parse(scripts[0]!);
    const graph = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
    const faqPage = graph.find((node: Record<string, unknown>) => node["@type"] === "FAQPage");
    const questionNames = (faqPage.mainEntity as Array<Record<string, unknown>>).map((q) => q.name);
    for (const original of [
      "เคาน์เตอร์หินสังเคราะห์ของ Knight Furnich ราคาตารางเมตรละเท่าไหร่?",
      "หินสังเคราะห์แท้มีข้อดีกว่าหินแท้อย่างไร?",
      "สั่งผลิตเคาน์เตอร์หินสังเคราะห์ใช้เวลากี่วัน และมีรับประกันไหม?",
      "มีผลงานติดตั้งจริงให้ดูไหม?",
      "ก่อนติดตั้งต้องเตรียมหน้างานอย่างไร?",
      "ขอใบเสนอราคาได้ช่องทางไหน?",
    ]) {
      assert.ok(questionNames.includes(original), `original question dropped: ${original}`);
    }
  });
});

describe("structured-data.ts builder functions stay JSON-serializable", () => {
  it("buildPortfolioStructuredData output round-trips through JSON cleanly", () => {
    const data = buildPortfolioStructuredData([{ slug: "bathroom", name: "งานห้องน้ำ", icon: "🛁", count: 1 }], 1);
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(data)));
  });

  it("buildSitePrepStructuredData output round-trips through JSON cleanly", () => {
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(buildSitePrepStructuredData())));
  });

  it("buildStudioGuideStructuredData output round-trips through JSON cleanly", () => {
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(buildStudioGuideStructuredData())));
  });
});

describe("buildBasinProductsJsonLd integrity", () => {
  it("returns exactly 30 Product nodes, each with name, sku and a valid Offer", () => {
    const data = buildBasinProductsJsonLd(PRODUCTS);
    const graph = data["@graph"] as Array<Record<string, unknown>>;
    assert.equal(graph.length, 30);
    for (const node of graph) {
      assert.equal(node["@type"], "Product");
      assert.ok(typeof node.name === "string" && node.name.length > 0);
      assert.ok(typeof node.sku === "string" && node.sku.length > 0);
      const offers = node.offers as Record<string, unknown>;
      assert.equal(offers["@type"], "Offer");
      assert.equal(typeof offers.price, "number");
      assert.equal(offers.priceCurrency, "THB");
    }
  });

  it("round-trips through JSON cleanly", () => {
    const data = buildBasinProductsJsonLd(PRODUCTS);
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(data)));
  });
});

describe("KNIGHT_FAQ_ITEMS (job-174 single source of truth)", () => {
  it("has exactly 10 items, each with a non-empty question and answer", () => {
    assert.equal(KNIGHT_FAQ_ITEMS.length, 10);
    for (const item of KNIGHT_FAQ_ITEMS) {
      assert.ok(item.question.trim().length > 0, "empty question");
      assert.ok(item.answer.trim().length > 0, "empty answer");
    }
  });

  it("matches index.html's FAQPage word-for-word, proving there is no content drift", () => {
    const scripts = extractLdJsonScripts(indexHtml);
    const data = JSON.parse(scripts[0]!);
    const graph = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
    const faqPage = graph.find((node: Record<string, unknown>) => node["@type"] === "FAQPage");
    const htmlQuestions = (faqPage.mainEntity as Array<Record<string, unknown>>).map((q) => ({
      question: q.name,
      answer: (q.acceptedAnswer as Record<string, unknown>).text,
    }));
    assert.deepEqual(KNIGHT_FAQ_ITEMS, htmlQuestions);
  });
});

describe("buildFaqPageJsonLd integrity", () => {
  it("defaults to KNIGHT_FAQ_ITEMS and emits a valid FAQPage entity", () => {
    const data = buildFaqPageJsonLd();
    assert.equal(data["@context"], "https://schema.org");
    assert.equal(data["@type"], "FAQPage");
    const mainEntity = data.mainEntity as Array<Record<string, unknown>>;
    assert.equal(mainEntity.length, KNIGHT_FAQ_ITEMS.length);
  });

  it("maps every FAQItem to a Question/Answer pair with the right text", () => {
    const mainEntity = buildFaqPageJsonLd().mainEntity as Array<Record<string, unknown>>;
    mainEntity.forEach((question, index) => {
      const source = KNIGHT_FAQ_ITEMS[index]!;
      assert.equal(question["@type"], "Question");
      assert.equal(question.name, source.question);
      const answer = question.acceptedAnswer as Record<string, unknown>;
      assert.equal(answer["@type"], "Answer");
      assert.equal(answer.text, source.answer);
    });
  });

  it("accepts a custom item list (e.g. a test fixture or a subset)", () => {
    const custom = [{ question: "ทดสอบ?", answer: "คำตอบทดสอบ" }];
    const data = buildFaqPageJsonLd(custom);
    const mainEntity = data.mainEntity as Array<Record<string, unknown>>;
    assert.equal(mainEntity.length, 1);
    assert.equal(mainEntity[0]?.name, "ทดสอบ?");
  });

  it("round-trips through JSON cleanly", () => {
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(buildFaqPageJsonLd())));
  });
});

describe("buildBreadcrumbListJsonLd (job-202)", () => {
  const SITE = "https://knightbasins.srv1964473.hstgr.cloud";

  it("emits a schema.org BreadcrumbList with positioned ListItems and absolute URLs", () => {
    const data = buildBreadcrumbListJsonLd([
      { name: "หน้าแรก", path: "/" },
      { name: "ภาพผลงานติดตั้งจริง", path: "/portfolio" },
    ]);
    assert.equal(data["@context"], "https://schema.org");
    assert.equal(data["@type"], "BreadcrumbList");
    const list = data.itemListElement as Array<Record<string, unknown>>;
    assert.deepEqual(list, [
      { "@type": "ListItem", position: 1, name: "หน้าแรก", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "ภาพผลงานติดตั้งจริง", item: `${SITE}/portfolio` },
    ]);
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(data)));
  });

  it("has a trail for /stone, /portfolio, /studio and /quote, each starting at the home page", () => {
    for (const path of ["/stone", "/portfolio", "/studio", "/quote"]) {
      const trail = breadcrumbItemsForPath(path);
      assert.ok(trail, `no breadcrumb trail for ${path}`);
      assert.deepEqual(trail[0], { name: "หน้าแรก", path: "/" });
      assert.equal(trail.length, 2);
      assert.equal(trail[1]!.path, path, "the last crumb is the page itself");
      assert.ok(trail[1]!.name.trim().length > 0);
    }
  });

  it("gives no trail to the home page, private pages or unknown paths", () => {
    for (const path of ["/", "/quote/view", "/profile", "/track", "/admin", "/nope"]) {
      assert.equal(breadcrumbItemsForPath(path), null, `unexpected trail for ${path}`);
    }
  });

  it("is mounted once in App.tsx, through RouteStructuredData, without disturbing the error boundary and banner wrapper", () => {
    const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
    assert.match(app, /breadcrumbItemsForPath\(location\)\s*&&\s*<RouteStructuredData id="breadcrumbs" data=\{buildBreadcrumbListJsonLd\(breadcrumbItemsForPath\(location\)!\)\}/);
  });
});

describe("buildPortfolioStructuredData ImageObject quality (job-202)", () => {
  const photos = [
    { id: "kitchen_1", category: "kitchen", categoryName: "งานครัวและไอส์แลนด์", icon: "🍳", url: "/api/uploads/portfolio/kitchen/a.webp", width: 1600, height: 1200, title: "ท็อปครัวหินสังเคราะห์", captionTh: "ท็อปครัวไร้รอยต่อ" },
    { id: "bath_1", category: "bathroom", categoryName: "งานห้องน้ำ", icon: "🛁", url: "/api/uploads/portfolio/bathroom/b.webp", width: 1200, height: 1600, title: "อ่างล้างหน้า", captionTh: "" },
  ] as unknown as Parameters<typeof buildPortfolioStructuredData>[2];

  const media = (buildPortfolioStructuredData([{ slug: "kitchen", name: "งานครัวและไอส์แลนด์", icon: "🍳", count: 2 }], 2, photos).associatedMedia) as Array<Record<string, unknown>>;

  it("describes only the photos it was given, one ImageObject each", () => {
    assert.equal(media.length, photos.length);
    assert.deepEqual(media.map((node) => node["@id"]), ["https://knightbasins.srv1964473.hstgr.cloud/portfolio#photo-kitchen_1", "https://knightbasins.srv1964473.hstgr.cloud/portfolio#photo-bath_1"]);
    assert.equal(buildPortfolioStructuredData([], 0).associatedMedia, undefined, "no photos, no ImageObjects");
  });

  it("adds a description and keywords drawn from the photo's own caption and category", () => {
    const [kitchen, bath] = media as [Record<string, unknown>, Record<string, unknown>];
    assert.match(String(kitchen.description), /ท็อปครัวไร้รอยต่อ/);
    assert.match(String(kitchen.description), /งานครัวและไอส์แลนด์/);
    assert.match(String(bath.description), /อ่างล้างหน้า/, "falls back to the title when there is no caption");
    for (const node of media) {
      const keywords = String(node.keywords).split(", ");
      assert.ok(keywords.includes(String(node.about)), "the category name is a keyword");
      assert.ok(keywords.includes("Solid Surface"));
    }
  });

  it("keeps the existing fields and claims no licence the site has not granted", () => {
    for (const node of media) {
      for (const field of ["contentUrl", "name", "caption", "about", "width", "height", "creator", "creditText"]) {
        assert.ok(node[field] !== undefined, `ImageObject lost ${field}`);
      }
      assert.equal(node.license, undefined);
      assert.equal(node.acquireLicensePage, undefined);
    }
  });
});
