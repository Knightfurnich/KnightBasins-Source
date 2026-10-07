import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ROUTE_META } from "../src/components/RouteMeta.logic.ts";

// job-203: the colour count in public copy must be one phrase, everywhere.
// The live catalog has 64 active colours per mode (68 distinct codes), so the
// copy says "more than 60" rather than pinning a number that drifts.
const COLOUR_PHRASE = "กว่า 60 เฉดสี";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

const indexHtml = read("../index.html");
const llmsTxt = read("../public/llms.txt");
const llmsFullTxt = read("../public/llms-full.txt");
const homeDescription = ROUTE_META["/"]?.description ?? "";

const publicCopy: Array<[string, string]> = [
  ["index.html", indexHtml],
  ["public/llms.txt", llmsTxt],
  ["public/llms-full.txt", llmsFullTxt],
  ["src/components/RouteMeta.logic.ts", read("../src/components/RouteMeta.logic.ts")],
];

function metaContent(selector: "name" | "property", key: string): string {
  const match = indexHtml.match(new RegExp(`<meta ${selector}="${key}" content="([^"]*)"`));
  assert.ok(match, `index.html has no <meta ${selector}="${key}">`);
  return match[1]!;
}

describe("stone colour count copy (job-203)", () => {
  it("the home route description states the shared colour phrase", () => {
    assert.ok(homeDescription.includes(COLOUR_PHRASE), `ROUTE_META["/"] lost "${COLOUR_PHRASE}"`);
  });

  it("index.html meta, og and twitter descriptions are the home route description, word for word", () => {
    for (const [selector, key] of [["name", "description"], ["property", "og:description"], ["name", "twitter:description"]] as const) {
      assert.equal(metaContent(selector, key), homeDescription, `${key} drifted from ROUTE_META["/"].description`);
    }
  });

  it("the raw-slab offer in index.html JSON-LD uses the shared phrase in name and description", () => {
    const offer = indexHtml.match(/"name": "แผ่นหินสังเคราะห์ดิบ[^"]*",\s*"description": "([^"]*)"/);
    assert.ok(offer, "could not find the raw-slab OfferCatalog in index.html");
    assert.ok(offer[0].includes(`แผ่นหินสังเคราะห์ดิบ ${COLOUR_PHRASE}`), "OfferCatalog name lost the shared phrase");
    assert.ok(offer[1]!.includes(COLOUR_PHRASE), "OfferCatalog description lost the shared phrase");
  });

  it("llms.txt names the colour count on the stone catalogue line and on the raw-slab line", () => {
    // job-277/282: the catalogue carries a fourth installed rate (Aria Whisper, 12,000), so the line moves with it.
    assert.match(llmsTxt, new RegExp(`แคตตาล็อกหินสังเคราะห์ \\(${COLOUR_PHRASE} 4 เรตราคา\\)`));
    assert.match(llmsTxt, new RegExp(`แผ่นหินสังเคราะห์ดิบ[^\\n]*มีให้เลือก${COLOUR_PHRASE}`));
  });

  it("llms-full.txt raw-slab section uses the shared phrase", () => {
    assert.match(llmsFullTxt, new RegExp(`มีให้เลือก${COLOUR_PHRASE}`));
  });

  for (const [name, text] of publicCopy) {
    it(`${name} has no stale "74 สี" / "74 เฉดสี"`, () => {
      assert.doesNotMatch(text, /74\s*(สี|เฉดสี)/);
    });

    it(`${name} states no colour count other than "${COLOUR_PHRASE}"`, () => {
      const counts = [...text.matchAll(/(กว่า\s*)?(\d+)\s*(?:เฉดสี|สี(?![ก-๙]))/g)];
      for (const match of counts) {
        assert.equal(match[0].replace(/\s+/g, " "), COLOUR_PHRASE, `${name} claims a different colour count: "${match[0]}"`);
      }
    });
  }
});
