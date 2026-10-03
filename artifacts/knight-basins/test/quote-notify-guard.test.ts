import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const savedQuoteSource = appSource.slice(
  appSource.indexOf("function SavedQuotePage()"),
  appSource.indexOf("function ", appSource.indexOf("function SavedQuotePage()") + "function SavedQuotePage()".length),
);

test("a successful notification in the quote URL replaces the repeat-send button", () => {
  assert.match(
    savedQuoteSource,
    /get\("notification"\)\s*\?\?\s*""/,
    "The saved quote should continue reading its existing notification query message",
  );
  assert.match(
    savedQuoteSource,
    /notificationWasAlreadySent\s*=\s*notificationMessage\.startsWith\("ส่ง"\)\s*&&\s*notificationMessage\.includes\("แล้ว"\)/,
    "Only a success message should mark the notification as already sent",
  );
  assert.match(savedQuoteSource, /ส่งข้อมูลถึงทีมขายแล้ว/);
  assert.match(savedQuoteSource, /data-testid="status-saved-quote-notification"/, "Keep the original notification message visible");
});

test("saved quote links without a success message retain the existing send path", () => {
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