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

  it("states the published portfolio count as 183 and no longer rounds it to 180+", () => {
    assert.match(llmsTxt, /183 ภาพ/);
    assert.match(llmsFullTxt, /183 ภาพ/);
    assert.doesNotMatch(llmsTxt, /180\+/);
    assert.doesNotMatch(llmsFullTxt, /180\+/);
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
