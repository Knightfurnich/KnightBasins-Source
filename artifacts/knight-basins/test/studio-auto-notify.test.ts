/**
 * Static source inspection for the Studio auto-notify (job-196).
 *
 * Asking for a quotation from the 2D Studio used to save the lead and open the
 * quotation page without telling the sales team: the alert only went out if the
 * customer pressed the "send to Telegram" button on that page. `submitStudio`
 * now sends it itself, and a failed alert must never keep the customer away
 * from their quotation. App.tsx is too large to render in node:test, so this
 * asserts against the real source text.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";

const appSource = fs.readFileSync(new URL("../src/App.tsx", import.meta.url), "utf-8");

function sliceBetween(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `missing "${start}"`);
  const to = source.indexOf(end, from);
  assert.ok(to > from, `missing "${end}" after "${start}"`);
  return source.slice(from, to);
}

const submitStudio = sliceBetween(appSource, "const submitStudio = async", "const initialBasinSkus");
const submitQuote = sliceBetween(appSource, "const submitQuote = async", "const submitStudio = async");

describe("studio auto-notify sales (job-196)", () => {
  it("sends the sales notification for the saved lead's public quote token", () => {
    assert.match(submitStudio, /notifyQuoteMutation\.mutateAsync\(\{\s*data:\s*\{\s*token:\s*lead\.publicQuoteToken\s*\}\s*\}\)/);
  });

  it("notifies only after the lead is saved and the quote link exists, then navigates", () => {
    const saved = submitStudio.indexOf('syncLead("quote_requested", "studio"');
    const linkCheck = submitStudio.indexOf("ระบบยังไม่ได้สร้างลิงก์ใบเสนอราคา");
    const notify = submitStudio.indexOf("notifyQuoteMutation.mutateAsync");
    const navigate = submitStudio.indexOf("setLocation(");
    assert.ok(saved >= 0 && linkCheck > saved, "link check follows the save");
    assert.ok(notify > linkCheck, "the alert is sent after the link check");
    assert.ok(navigate > notify, "navigation comes after the alert attempt");
  });

  it("keeps a failed alert from blocking the customer's quotation page", () => {
    const tryBlock = sliceBetween(submitStudio, "try {", "} catch");
    assert.match(tryBlock, /notifyQuoteMutation\.mutateAsync/);
    const catchBlock = sliceBetween(submitStudio, "} catch (error) {", "const notificationQuery");
    assert.doesNotMatch(catchBlock, /\bthrow\b/, "the catch must not rethrow");
    assert.match(catchBlock, /notificationMessage\s*=/);
    // Navigation sits outside the try/catch, so it runs on success and on failure.
    assert.ok(submitStudio.lastIndexOf("setLocation(") > submitStudio.indexOf("const notificationQuery"));
  });

  it("passes the outcome to the quotation page as ?notification=, like the storefront quote", () => {
    assert.match(submitStudio, /notificationQuery\s*=\s*notificationMessage\s*\?\s*`&notification=\$\{encodeURIComponent\(notificationMessage\)\}`\s*:\s*""/);
    assert.match(submitStudio, /setLocation\(`\/quote\/view\?token=\$\{encodeURIComponent\(lead\.publicQuoteToken\)\}\$\{notificationQuery\}`\)/);
  });

  it("matches the storefront quote's fallback wording when the alert fails", () => {
    const fallback = /"บันทึกแล้ว แต่ส่งแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่"/;
    assert.match(submitStudio, fallback);
    assert.match(submitQuote, fallback);
  });

  it("still saves the lead from the Studio exactly as before", () => {
    assert.match(submitStudio, /studioData:\s*\{\s*state,\s*estimate,\s*notification,\s*worksitePlaceId\s*\}/);
    assert.match(submitStudio, /orderMode:\s*"studio"/);
    assert.match(submitStudio, /throw new Error\("ระบบยังไม่ได้สร้างลิงก์ใบเสนอราคา"\)/);
  });

  it("leaves the storefront quote's opt-in notify as it was", () => {
    assert.match(submitQuote, /submitQuote = async \(snapshot: QuickQuoteSnapshot, notify = false/);
    assert.match(submitQuote, /if \(notify\) \{/);
  });
});
