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
