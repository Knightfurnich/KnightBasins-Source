import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const notificationsSource = readFileSync(new URL("../../api-server/src/lib/sales-notifications.ts", import.meta.url), "utf8");

function sliceBetween(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `missing "${start}"`);
  const to = source.indexOf(end, from);
  assert.ok(to > from, `missing "${end}" after "${start}"`);
  return source.slice(from, to);
}

// SavedQuotePage now takes the live stone list as a prop (job-210), so match its name, not an empty "()".
const savedQuoteStart = appSource.indexOf("function SavedQuotePage(");
const savedQuoteSource = appSource.slice(
  savedQuoteStart,
  appSource.indexOf("function ", savedQuoteStart + "function SavedQuotePage(".length),
);
const submitQuote = sliceBetween(appSource, "const submitQuote = async", "const submitStudio = async");
const submitStudio = sliceBetween(appSource, "const submitStudio = async", "const initialBasinSkus");

// The decision itself, taken verbatim from SavedQuotePage and run on real inputs.
const guardExpression = savedQuoteSource.match(/const notificationWasAlreadySent =([^;]+);/)?.[1];
assert.ok(guardExpression, "could not find the notificationWasAlreadySent expression in SavedQuotePage");
const wasAlreadySent = new Function(
  "notifiedFromThisPage",
  "notifiedParam",
  "notificationMessage",
  `return (${guardExpression});`,
) as (notifiedFromThisPage: boolean, notifiedParam: string | null, notificationMessage: string) => boolean;

const FAILURE_MESSAGE = "บันทึกแล้ว แต่ส่งแจ้งเตือน Telegram ไม่สำเร็จ กรุณาลองใหม่";

test("notified=1 hides the repeat-send button whatever the notification wording is", () => {
  assert.equal(wasAlreadySent(false, "1", "ทีมขายรับเรื่องของคุณเรียบร้อย"), true);
  assert.equal(wasAlreadySent(false, "1", ""), true);
  assert.equal(wasAlreadySent(false, "true", "ข้อความอื่นทั้งหมด"), true);
});

test("an old link with no notified parameter still hides the button on the original success wording", () => {
  assert.equal(wasAlreadySent(false, null, "ส่งแจ้งเตือน Telegram แล้ว"), true);
  assert.equal(wasAlreadySent(false, null, "ส่งแบบร่างเข้า Telegram แล้ว"), true);
  assert.equal(wasAlreadySent(false, null, "ส่งแจ้งเตือน LINE แล้ว"), true);
});

test("a failed or missing notification keeps the send button", () => {
  assert.equal(wasAlreadySent(false, null, FAILURE_MESSAGE), false);
  assert.equal(wasAlreadySent(false, null, "กำลังส่งแจ้งเตือน..."), false);
  assert.equal(wasAlreadySent(false, null, ""), false);
  assert.equal(wasAlreadySent(false, "0", FAILURE_MESSAGE), false);
});

test("once a notified parameter is present the wording is no longer consulted", () => {
  assert.equal(wasAlreadySent(false, "0", "ส่งแจ้งเตือน Telegram แล้ว"), false);
});

test("a send made from this page hides the button on its own structured status", () => {
  assert.equal(wasAlreadySent(true, null, "ข้อความใหม่ที่ไม่มีคำเดิม"), true);
  assert.match(savedQuoteSource, /const \[notifiedFromThisPage, setNotifiedFromThisPage\] = useState\(false\)/);
  assert.match(savedQuoteSource, /if \(result\.notificationStatus === "notified"\) setNotifiedFromThisPage\(true\)/);
});

test("the old-link fallback agrees with every message the API can return today", () => {
  const successes = [...notificationsSource.matchAll(/notificationStatus: "notified", message: "([^"]+)"/g)].map((match) => match[1]!);
  const failures = [...notificationsSource.matchAll(/missingNotification\(\s*"([^"]+)"/g)].map((match) => match[1]!);
  assert.ok(successes.length >= 3, "expected the API's success messages in sales-notifications.ts");
  assert.ok(failures.length >= 3, "expected the API's failure messages in sales-notifications.ts");
  for (const message of successes) assert.equal(wasAlreadySent(false, null, message), true, `success message not recognised: ${message}`);
  for (const message of failures) assert.equal(wasAlreadySent(false, null, message), false, `failure message hides the button: ${message}`);
});

test("SavedQuotePage reads the notified query parameter and keeps the existing notification message and UI", () => {
  assert.match(savedQuoteSource, /get\("notified"\)/);
  assert.match(savedQuoteSource, /get\("notification"\)\s*\?\?\s*""/, "The saved quote should continue reading its existing notification query message");
  assert.match(savedQuoteSource, /ส่งข้อมูลถึงทีมขายแล้ว/);
  assert.match(savedQuoteSource, /data-testid="status-saved-quote-notification"/, "Keep the original notification message visible");
  assert.match(
    savedQuoteSource,
    /\{notificationWasAlreadySent\s*\?\s*<p[^>]*>ส่งข้อมูลถึงทีมขายแล้ว<\/p>\s*:\s*<button[^>]*onClick=\{sendNotification\}[^>]*data-testid="button-send-saved-quote-notification"/,
    "Without a successful notification, the original send button remains available",
  );
  assert.match(
    savedQuoteSource,
    /notifyMutation\.mutateAsync\(\{ data: \{ token: publicQuoteToken \} \}\)/,
    "The existing notification mutation remains in place",
  );
});

for (const [name, source] of [["submitQuote", submitQuote], ["submitStudio", submitStudio]] as const) {
  test(`${name} adds notified=1 only when the API reports notificationStatus "notified"`, () => {
    assert.match(source, /let notified = false;/);
    assert.match(source, /notified = result\.notificationStatus === "notified";/);
    const catchBlock = sliceBetween(source, "} catch (error) {", "const notificationQuery");
    assert.doesNotMatch(catchBlock, /notified\s*=\s*(true|result)/, "a thrown error must never mark the notification as sent");
    assert.match(
      source,
      /notificationQuery\s*=\s*notificationMessage\s*\?\s*`&notification=\$\{encodeURIComponent\(notificationMessage\)\}\$\{notified \? "&notified=1" : ""\}`\s*:\s*""/,
      "keep &notification=<message> and add &notified=1 behind the flag",
    );
  });
}
