/**
 * Guards the public Thai copy against stray non-Thai script characters.
 *
 * Caught on PR #164 review: the FAQ answer "มีผลงานติดตั้งจริงให้ดูไหม?" shipped the
 * opening word as Khmer "មានครับ" (U+1798 U+17B6 U+1793) in three public files --
 * index.html JSON-LD, llms-full.txt and faq-data.ts. The wording is quoted by AI
 * crawlers and rendered next to the FAQ on the storefront, so a wrong-language word
 * is a visible customer-facing defect, not a cosmetic one.
 *
 * The check is deliberately narrow: these files are Thai + Latin + digits, so any
 * character from a neighbouring script (Khmer, Lao, Myanmar, CJK, Cyrillic) is a bug.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const PUBLIC_COPY_FILES = [
  "../src/data/faq-data.ts",
  "../index.html",
  "../public/llms.txt",
  "../public/llms-full.txt",
];

/** Characters that are legal in the public Thai/English copy. */
const ALLOWED_NON_THAI_RANGES: Array<[number, number]> = [
  [0x0000, 0x007f], // ASCII: Latin, digits, punctuation
  [0x00a0, 0x00ff], // Latin-1 supplement (º, ×, ฿-adjacent marks)
  [0x0e00, 0x0e7f], // Thai
  [0x2010, 0x205e], // general punctuation: quotes, dashes, ellipsis
  [0x20a0, 0x20bf], // currency signs (฿, €, $)
  [0x2190, 0x21ff], // arrows used in the copy
  [0x2200, 0x22ff], // mathematical operators used in the copy (≥, ⊗, ⊞)
  [0x2500, 0x257f], // box drawing
  [0x25a0, 0x25ff], // geometric shapes used as bullets
  [0x2600, 0x27bf], // misc symbols / dingbats used as bullets
  [0x2e80, 0x2eff], // CJK radicals reached by the ideographic full stop 。 in Thai copy
  [0x3000, 0x303f], // CJK punctuation (、。)
  [0xff00, 0xffef], // fullwidth forms
  [0x1f000, 0x1faff], // emoji
  [0xfe0f, 0xfe0f], // variation selector
  [0x200b, 0x200d], // zero-width space / joiner
];

function isAllowed(codePoint: number): boolean {
  return ALLOWED_NON_THAI_RANGES.some(([low, high]) => codePoint >= low && codePoint <= high);
}

function findStrayCharacters(text: string): Array<{ character: string; codePoint: string; context: string }> {
  const found = new Map<string, { character: string; codePoint: string; context: string }>();
  for (const [index, character] of [...text].entries()) {
    const codePoint = character.codePointAt(0)!;
    if (isAllowed(codePoint)) continue;
    const key = codePoint.toString(16);
    if (found.has(key)) continue;
    const start = Math.max(0, index - 20);
    found.set(key, {
      character,
      codePoint: `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`,
      context: [...text].slice(start, index + 20).join("").replace(/\s+/g, " ").trim(),
    });
  }
  return [...found.values()];
}

describe("public Thai copy contains no stray foreign-script characters (job-164)", () => {
  for (const relativePath of PUBLIC_COPY_FILES) {
    it(`${relativePath} uses only Thai, Latin, digits and punctuation`, () => {
      const text = readFileSync(new URL(relativePath, import.meta.url), "utf8");
      const stray = findStrayCharacters(text);
      assert.deepEqual(
        stray,
        [],
        `unexpected script characters: ${stray.map((entry) => `${entry.codePoint} "${entry.character}" near "${entry.context}"`).join(" | ")}`,
      );
    });
  }

  it("keeps the FAQ portfolio answer readable, with the Thai word มี not the Khmer មាន", () => {
    const faq = readFileSync(new URL("../src/data/faq-data.ts", import.meta.url), "utf8");
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const llmsFull = readFileSync(new URL("../public/llms-full.txt", import.meta.url), "utf8");
    for (const [name, source] of [["faq-data.ts", faq], ["index.html", html], ["llms-full.txt", llmsFull]] as const) {
      assert.match(source, /มีครับ Knight Furnich/, `${name} must open the portfolio answer with "มีครับ"`);
      assert.doesNotMatch(source, /[\u1780-\u17ff]/, `${name} must not contain Khmer characters`);
    }
  });

  it("keeps the published portfolio count consistent at 333 across the public claims", () => {
    const faq = readFileSync(new URL("../src/data/faq-data.ts", import.meta.url), "utf8");
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const llms = readFileSync(new URL("../public/llms.txt", import.meta.url), "utf8");
    const llmsFull = readFileSync(new URL("../public/llms-full.txt", import.meta.url), "utf8");
    for (const [name, source] of [["faq-data.ts", faq], ["index.html", html], ["llms.txt", llms], ["llms-full.txt", llmsFull]] as const) {
      assert.match(source, /333/, `${name} must state the published count of 333`);
      assert.doesNotMatch(source, /180\+|กว่า 180/, `${name} must not keep the retired 180+ wording`);
    }
  });
});
