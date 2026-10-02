import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/components/SalesGuide.tsx", import.meta.url),
  "utf8",
);

test("sales guide embeds real installation showcase marquee", () => {
  assert.match(source, /<InstallationShowcase \/>/);
  assert.match(source, /data-testid="guide-section-showcase"/);
});

test("sales guide provides direct links to the 4 knowledge and design hubs", () => {
  assert.match(source, /href="\/portfolio"/);
  assert.match(source, /data-testid="link-guide-hub-portfolio"/);
  assert.match(source, /href="\/site-prep"/);
  assert.match(source, /data-testid="link-guide-hub-site-prep"/);
  assert.match(source, /href="\/studio-guide"/);
  assert.match(source, /data-testid="link-guide-hub-studio-guide"/);
  assert.match(source, /href="\/updates"/);
  assert.match(source, /data-testid="link-guide-hub-updates"/);
});

test("sales guide channel 3 mentions camera capture and AI smart reader", () => {
  assert.match(source, /ถ่ายรูปสดจากกล้องหน้างาน/);
  assert.match(source, /ระบบ AI ช่วยอ่านลายมือ/);
});
