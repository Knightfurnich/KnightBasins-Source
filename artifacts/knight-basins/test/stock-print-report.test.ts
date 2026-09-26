import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const [stockPageSource, stylesheet] = await Promise.all([
  readFile(new URL("../src/admin/StockInventoryPage.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/index.css", import.meta.url), "utf8"),
]);

test("stock inventory exposes an A4 print action that opens the browser print dialog", () => {
  assert.match(stockPageSource, /data-testid="button-stock-print"/);
  assert.match(stockPageSource, /aria-label="พิมพ์รายงานสต็อก A4"/);
  assert.match(stockPageSource, /<Printer\b/);
  assert.match(stockPageSource, /onClick=\{handlePrintReport\}/);
  assert.match(stockPageSource, /window\.requestAnimationFrame\(\(\) => window\.print\(\)\)/);
});

test("stock print header includes the company, selected brand, Thai date, and inventory totals", () => {
  assert.match(stockPageSource, /data-testid="stock-print-header"/);
  assert.match(stockPageSource, /KNIGHT FURNICH/);
  assert.match(stockPageSource, /รายงานสต็อกแผ่นหินสังเคราะห์/);
  assert.match(stockPageSource, /data-testid="stock-print-brand"/);
  assert.match(stockPageSource, /data-testid="stock-print-date"/);
  assert.match(stockPageSource, /timeZone: "Asia\/Bangkok"/);
  assert.match(stockPageSource, /data-testid="stock-print-total-colors"/);
  assert.match(stockPageSource, /data-testid="stock-print-total-sheets"/);
  assert.match(stockPageSource, /const printableItems = useMemo\([\s\S]*?sortStockItems\(group\.items/);
});

test("stock print stylesheet is A4-specific, uncluttered, and repeats table headings", () => {
  const printStyles = stylesheet.slice(stylesheet.lastIndexOf("@page stock-inventory-report"));

  assert.match(printStyles, /@page stock-inventory-report\s*\{[^}]*size:\s*A4 portrait/s);
  assert.match(printStyles, /page:\s*stock-inventory-report/);
  assert.match(printStyles, /html:has\(\.stock-inventory-page\)\s*\{\s*background:\s*#fff\s*!important;/s);
  assert.match(printStyles, /\.admin-app\s*\{\s*min-height:\s*0\s*!important;/s);
  assert.match(printStyles, /\.admin-main\s*\{[^}]*background:\s*#fff\s*!important;/s);
  assert.match(printStyles, /body:has\(\.stock-inventory-page\)\s+\.site-header[\s\S]*?display:\s*none\s*!important/);
  assert.match(printStyles, /body:has\(\.stock-inventory-page\)\s+\.admin-sidebar[\s\S]*?display:\s*none\s*!important/);
  assert.match(printStyles, /body:has\(\.stock-inventory-page\)\s+\.stock-toolbar[\s\S]*?display:\s*none\s*!important/);
  assert.match(printStyles, /\.stock-inventory-page \.stock-line-column\s*\{\s*display:\s*none\s*!important/s);
  assert.match(printStyles, /\.stock-print-table thead\s*\{\s*display:\s*table-header-group/s);
  assert.match(printStyles, /border:\s*1px solid #333\s*!important/);
  assert.match(printStyles, /print-color-adjust:\s*exact/);
  assert.match(printStyles, /break-inside:\s*avoid/);
});