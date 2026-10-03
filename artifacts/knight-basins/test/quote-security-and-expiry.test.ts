import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
// SavedQuotePage takes the live stone list as a prop since job-210, so match its name rather than an empty "()".
const savedQuoteStart = appSource.indexOf("function SavedQuotePage(");
const savedQuoteEnd = appSource.indexOf("function ", savedQuoteStart + "function SavedQuotePage(".length);
const savedQuoteSource = appSource.slice(savedQuoteStart, savedQuoteEnd);
const quoteBuilderStart = appSource.indexOf("function QuotePage(");
const quoteBuilderEnd = appSource.indexOf("function ", quoteBuilderStart + "function QuotePage(".length);
const quoteBuilderSource = appSource.slice(quoteBuilderStart, quoteBuilderEnd);

test("saved customer quote only prints and displays the formal quote", () => {
  assert.doesNotMatch(savedQuoteSource, /button-print-saved-workshop/);
  assert.doesNotMatch(savedQuoteSource, /button-saved-sheet-mode-workshop/);
  assert.doesNotMatch(savedQuoteSource, /quote-sheet-type-switch/);
  assert.doesNotMatch(savedQuoteSource, /WorkshopProductionSheet/);
  assert.match(savedQuoteSource, /<FormalQuote\b/);
  assert.match(savedQuoteSource, /ใช้ได้ถึง \{formatQuoteDate\(expiryDate\)\} · 30 วัน/);
});

test("the public quote builder does not expose workshop production documents", () => {
  assert.doesNotMatch(quoteBuilderSource, /WorkshopProductionSheet/);
  assert.doesNotMatch(quoteBuilderSource, /button-sheet-mode-workshop/);
  assert.doesNotMatch(quoteBuilderSource, /button-print-workshop/);
  assert.doesNotMatch(quoteBuilderSource, /quote-sheet-type-switch/);
  assert.match(quoteBuilderSource, /<FormalQuote\b/);
});

test("expired quote API errors show the expiration notice and sales contact actions", () => {
  assert.match(appSource, /function isExpiredPublicQuoteError/);
  assert.match(savedQuoteSource, /isExpiredPublicQuoteError\(error\)/);
  assert.match(savedQuoteSource, /status-saved-quote-expired/);
  assert.match(savedQuoteSource, /if \(isExpiredPublicQuoteError\(error\)\) setQuoteExpired\(true\)/);
  assert.match(savedQuoteSource, /button-contact-expired-quote-line/);
  assert.match(savedQuoteSource, /button-contact-expired-quote-phone/);
  assert.match(savedQuoteSource, /เกิน 45 วัน/);
});