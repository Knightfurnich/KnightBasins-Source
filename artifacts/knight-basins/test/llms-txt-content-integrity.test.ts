/**
 * Guards llms.txt / llms-full.txt -- the files AI crawlers read directly,
 * without rendering the page -- against falling behind the real site.
 * These are plain marketing text, not generated from code, so there is no
 * single source of truth to diff against structurally; instead this checks
 * that the content known to matter for AI citation (the FAQ, in particular,
 * via KNIGHT_FAQ_ITEMS) stays present verbatim, and that newer pages/content
 * (comparison table standards, /updates) are referenced at all.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { KNIGHT_FAQ_ITEMS } from "../src/data/faq-data.ts";

const llmsTxt = readFileSync(new URL("../public/llms.txt", import.meta.url), "utf8");
const llmsFullTxt = readFileSync(new URL("../public/llms-full.txt", import.meta.url), "utf8");

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const EXPECTED_PUBLIC_PORTFOLIO_IMAGE_COUNT = 333;
const PORTFOLIO_FAQ_QUESTION = "มีผลงานติดตั้งจริงให้ดูไหม?";

function extractPublicImageCount(text: string, label: string): number {
  const match = text.match(/(\d+)\s*ภาพ/);
  assert.ok(match, label + " must state the public portfolio image count");
  return Number(match[1]);
}

describe("llms.txt", () => {
  it("lists the /updates release log in the navigation", () => {
    assert.match(llmsTxt, /https:\/\/knightbasins\.srv1964473\.hstgr\.cloud\/updates/);
  });

  it("cites the material comparison standards", () => {
    for (const standard of ["UBC CLASS 1", "ASTM G22", "NEMA LD3", "LC 50"]) {
      assert.ok(llmsTxt.includes(standard), `missing standard: ${standard}`);
    }
  });
});

describe("llms-full.txt", () => {
  it("includes the material comparison table with all 4 standards", () => {
    for (const standard of ["UBC CLASS 1", "ASTM G22", "NEMA LD3", "LC 50"]) {
      assert.ok(llmsFullTxt.includes(standard), `missing standard: ${standard}`);
    }
    assert.match(llmsFullTxt, /หินสังเคราะห์ Modified/);
    assert.match(llmsFullTxt, /หินธรรมชาติ \(แกรนิต\/หินอ่อน\)/);
  });

  it("references the /updates release log", () => {
    assert.match(llmsFullTxt, /https:\/\/knightbasins\.srv1964473\.hstgr\.cloud\/updates/);
  });

  it("carries every KNIGHT_FAQ_ITEMS question and answer verbatim (drift guard)", () => {
    for (const item of KNIGHT_FAQ_ITEMS) {
      assert.ok(llmsFullTxt.includes(item.question), `missing question: ${item.question}`);
      assert.ok(llmsFullTxt.includes(item.answer), `missing answer for: ${item.question}`);
    }
  });
});

describe("llms.txt / llms-full.txt stay in step with the site (job-202)", () => {
  const updatesSource = readFileSync(new URL("../src/pages/UpdatesPage.tsx", import.meta.url), "utf8");
  const latestRelease = updatesSource.match(/version:\s*"(v\d+\.\d+\.\d+)"/)?.[1];

  it("names the latest release from the /updates page and links to it", () => {
    assert.ok(latestRelease, "could not read the latest version from UpdatesPage.tsx");
    assert.ok(llmsTxt.includes(latestRelease!), `llms.txt does not mention ${latestRelease}`);
    assert.ok(llmsFullTxt.includes(`**${latestRelease} (`), `llms-full.txt release log does not start with ${latestRelease}`);
  });

  it("keeps the verified public image count consistent across FAQ data, homepage JSON-LD, and crawler files", () => {
    const portfolioFaq = KNIGHT_FAQ_ITEMS.find((item) => item.question === PORTFOLIO_FAQ_QUESTION);
    assert.ok(portfolioFaq, "portfolio FAQ must exist in faq-data.ts");

    const marker = "<script type=\"application/ld+json\">";
    const scriptStart = indexHtml.indexOf(marker);
    assert.ok(scriptStart >= 0, "index.html must contain JSON-LD");
    const jsonStart = indexHtml.indexOf(">", scriptStart) + 1;
    const jsonEnd = indexHtml.indexOf("</script>", jsonStart);
    assert.ok(jsonEnd > jsonStart, "index.html JSON-LD block must close");
    const root = JSON.parse(indexHtml.slice(jsonStart, jsonEnd));
    const graph = Array.isArray(root["@graph"]) ? root["@graph"] : [root];
    const navigation = graph.find((node: Record<string, unknown>) => node["@type"] === "SiteNavigationElement");
    const navigationLabel = (navigation?.name as string[] | undefined)?.find((name) => name.includes("ภาพ"));
    assert.ok(navigationLabel, "index.html navigation must state the portfolio image count");
    const faqPage = graph.find((node: Record<string, unknown>) => node["@type"] === "FAQPage");
    const pageFaq = (faqPage?.mainEntity as Array<Record<string, unknown>> | undefined)?.find((item) => item.name === PORTFOLIO_FAQ_QUESTION);
    const pageAnswer = (pageFaq?.acceptedAnswer as Record<string, unknown> | undefined)?.text;
    assert.equal(typeof pageAnswer, "string", "index.html FAQPage must state the portfolio image count");

    const llmsPortfolioLine = llmsTxt.split(/\r?\n/).find((line) => line.includes("/portfolio") && line.includes("ภาพ"));
    assert.ok(llmsPortfolioLine, "llms.txt must state the portfolio image count");
    const portfolioStart = llmsFullTxt.indexOf("## 7.");
    const portfolioEnd = llmsFullTxt.indexOf("\n## 8.", portfolioStart);
    assert.ok(portfolioStart >= 0 && portfolioEnd > portfolioStart, "llms-full.txt must contain the portfolio section");
    const portfolioSection = llmsFullTxt.slice(portfolioStart, portfolioEnd);
    const llmsFullCountLine = portfolioSection.split(/\r?\n/).find((line) => line.includes("คัดสรรแล้ว") && line.includes("ภาพ"));
    assert.ok(llmsFullCountLine, "llms-full.txt portfolio section must state the image count");

    const counts = {
      faqData: extractPublicImageCount(portfolioFaq.answer, "faq-data.ts"),
      homepageNavigation: extractPublicImageCount(navigationLabel, "index.html navigation"),
      homepageFaq: extractPublicImageCount(String(pageAnswer), "index.html FAQPage"),
      llmsTxt: extractPublicImageCount(llmsPortfolioLine, "llms.txt"),
      llmsFull: extractPublicImageCount(llmsFullCountLine, "llms-full.txt"),
    };
    assert.deepEqual(counts, {
      faqData: EXPECTED_PUBLIC_PORTFOLIO_IMAGE_COUNT,
      homepageNavigation: EXPECTED_PUBLIC_PORTFOLIO_IMAGE_COUNT,
      homepageFaq: EXPECTED_PUBLIC_PORTFOLIO_IMAGE_COUNT,
      llmsTxt: EXPECTED_PUBLIC_PORTFOLIO_IMAGE_COUNT,
      llmsFull: EXPECTED_PUBLIC_PORTFOLIO_IMAGE_COUNT,
    });
    for (const [label, text] of [
      ["faq-data.ts", portfolioFaq.answer],
      ["index.html navigation", navigationLabel],
      ["index.html FAQPage", String(pageAnswer)],
      ["llms.txt", llmsPortfolioLine],
      ["llms-full.txt", llmsFullCountLine],
    ] as const) {
      assert.doesNotMatch(text, /(?:180\+|180|183)\s*ภาพ/, label + " must not retain a previous count");
    }
  });

  for (const [name, text] of [["llms.txt", llmsTxt], ["llms-full.txt", llmsFullTxt]] as const) {
    it(`${name} has the kitchen tops section with the claims the KB already backs`, () => {
      assert.match(text, /ท็อปเคาน์เตอร์ครัวหินสังเคราะห์ \(Kitchen Tops \/ Worktops\)/);
      for (const claim of ["ไร้รอยต่อ", "ปลอดภัยต่ออาหาร", "LC 50", "ไม่บวมน้ำ", "ขัดเคลือบผิวใหม่ได้"]) {
        assert.ok(text.includes(claim), `${name} lost: ${claim}`);
      }
    });

    it(`${name} points to the 2D Studio and the quotation page`, () => {
      assert.match(text, /https:\/\/knightbasins\.srv1964473\.hstgr\.cloud\/studio\b/);
      assert.match(text, /https:\/\/knightbasins\.srv1964473\.hstgr\.cloud\/quote\b/);
    });

    it(`${name} answers the four common AI query intents`, () => {
      for (const intent of ["ท็อปครัวหินสังเคราะห์ราคาเท่าไหร่", "ร้านสั่งตัดท็อปครัวหินสังเคราะห์"]) {
        assert.ok(text.includes(intent), `${name} is missing the intent: ${intent}`);
      }
      assert.match(text, /เคาน์เตอร์ครัวหินสังเคราะห์ (vs|กับ) ?แกรนิต/);
      assert.match(text, /ร้านทำท็อปครัว[^\n]*กรุงเทพ[^\n]*ปริมณฑล/);
    });

    it(`${name} only quotes the three KB stone rates`, () => {
      const rates = new Set([...text.matchAll(/([\d,]+)\s*บาท\s*\/\s*ตร\.ม\./g)].map((match) => match[1]));
      assert.deepEqual([...rates].sort(), ["7,500", "8,500", "9,500"]);
    });
  }

  it("keeps team members and installers out of the public files", () => {
    for (const text of [llmsTxt, llmsFullTxt]) {
      assert.doesNotMatch(text, /เดวิด|คุณนพ|Aunnop|Sengmanee/);
    }
  });
});
