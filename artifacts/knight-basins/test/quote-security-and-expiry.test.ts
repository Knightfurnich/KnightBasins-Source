import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
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

// ---------------------------------------------------------------------------------------------------------
// job-219: PaymentSlipUpload tells the customer when the server refused the slip because the link expired.
// ---------------------------------------------------------------------------------------------------------

const EXPIRED_SLIP_MESSAGE = "ลิงก์ใบเสนอราคานี้หมดอายุแล้ว (เกิน 45 วัน) ไม่สามารถแนบสลิปได้ กรุณาติดต่อทีมขายเพื่อประเมินราคาใหม่";
const slipStart = appSource.indexOf("function PaymentSlipUpload(");
const slipEnd = appSource.indexOf("function isExpiredPublicQuoteError(", slipStart);
const slipSource = appSource.slice(slipStart, slipEnd);

/** The real `upload` handler of PaymentSlipUpload, cut out of App.tsx and run against stub state setters and a stub fetch. */
function runSlipUpload(respond: () => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>) {
  const from = slipSource.indexOf("const upload = async () => {");
  const to = slipSource.indexOf("return <div className=\"saved-quote-payment\"");
  assert.ok(from >= 0 && to > from, "upload handler not found");
  const handler = stripTypeScriptTypes(`async function run(file, setUploading, setResult, setFile, inputRef, publicQuoteToken, fetch, FormData, PAYMENT_SLIP_EXPIRED_MESSAGE) {\n${slipSource.slice(from, to)}\n  await upload();\n}`);
  const run = new Function(`${handler}\nreturn run;`)() as (...args: unknown[]) => Promise<void>;
  const results: unknown[] = [];
  const uploading: boolean[] = [];
  const fileChanges: unknown[] = [];
  const requests: Array<{ url: string; method: string }> = [];
  class FakeFormData { entries: Array<[string, unknown]> = []; append(key: string, value: unknown) { this.entries.push([key, value]); } }
  const fakeFetch = async (url: string, init: { method: string }) => { requests.push({ url, method: init.method }); return respond(); };
  const inputRef = { current: { value: "slip.png" } };
  const done = run({ name: "slip.png" }, (value: boolean) => uploading.push(value), (value: unknown) => results.push(value), (value: unknown) => fileChanges.push(value), inputRef, "token-123", fakeFetch, FakeFormData, EXPIRED_SLIP_MESSAGE);
  return { done, results, uploading, fileChanges, requests, inputRef };
}
const json = (status: number, body: unknown) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("the expired-slip message is the exact wording the boss approved, in a red (is-rejected) alert", () => {
  assert.ok(appSource.includes(`const PAYMENT_SLIP_EXPIRED_MESSAGE = "${EXPIRED_SLIP_MESSAGE}";`));
  assert.match(slipSource, /message: PAYMENT_SLIP_EXPIRED_MESSAGE, expired: true/);
  assert.match(slipSource, /role=\{result\.expired \? "alert" : "status"\}/);
  assert.match(slipSource, /data-expired=\{result\.expired \? "true" : undefined\}/);
  assert.match(slipSource, /result\.status === "verified" \? "is-verified" : result\.status === "needs_review" \? "is-review" : "is-rejected"/);
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  assert.match(css, /\.saved-quote-payment-result\.is-rejected \{ color: #a24439;/, "is-rejected is the red alert style");
});

test("HTTP 410 quote_expired shows the expiry notice, keeps the chosen file and does not pretend the slip was checked", async () => {
  const { done, results, fileChanges, uploading } = runSlipUpload(json(410, { error: "quote_expired", message: "ลิงก์ใบเสนอราคานี้หมดอายุแล้ว (เกิน 45 วัน) กรุณาติดต่อทีมขายเพื่อประเมินราคาใหม่" }));
  await done;
  assert.deepEqual(results, [null, { status: "rejected", message: EXPIRED_SLIP_MESSAGE, expired: true }]);
  assert.deepEqual(fileChanges, [], "the file is not cleared as if it had been accepted");
  assert.deepEqual(uploading, [true, false], "the button comes back");
});

test("the notice also shows for a 410 whose body is not JSON, and for the quote_expired code on any status", async () => {
  const notJson = runSlipUpload(async () => ({ ok: false, status: 410, json: async () => { throw new SyntaxError("Unexpected token <"); } }));
  await notJson.done;
  assert.deepEqual(notJson.results.at(-1), { status: "rejected", message: EXPIRED_SLIP_MESSAGE, expired: true });
  const codeOnly = runSlipUpload(json(400, { error: "quote_expired" }));
  await codeOnly.done;
  assert.deepEqual(codeOnly.results.at(-1), { status: "rejected", message: EXPIRED_SLIP_MESSAGE, expired: true });
});

test("other outcomes are unchanged: a verified slip, a server error with its own message, and a network failure", async () => {
  const verified = runSlipUpload(json(201, { status: "verified", verifiedAmountThb: 12500, senderName: "นาย ทดสอบ" }));
  await verified.done;
  assert.equal((verified.results.at(-1) as { status: string; expired?: boolean }).status, "verified");
  assert.equal((verified.results.at(-1) as { expired?: boolean }).expired, undefined);
  assert.equal(verified.fileChanges.length, 1, "an accepted slip clears the file input");

  const serverError = runSlipUpload(json(500, { message: "ระบบขัดข้อง" }));
  await serverError.done;
  assert.deepEqual(serverError.results.at(-1), { status: "rejected", message: "ระบบขัดข้อง" });

  const offline = runSlipUpload(async () => { throw new Error("Failed to fetch"); });
  await offline.done;
  assert.deepEqual(offline.results.at(-1), { status: "rejected", message: "Failed to fetch" });
  assert.notEqual((offline.results.at(-1) as { message: string }).message, EXPIRED_SLIP_MESSAGE);
});

test("the slip is still posted to the same endpoint with the quote token", async () => {
  const { done, requests } = runSlipUpload(json(410, { error: "quote_expired" }));
  await done;
  assert.deepEqual(requests, [{ url: "/api/leads/payment-slip", method: "POST" }]);
});
