import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const portfolioPageSource = readFileSync(
  new URL("../src/pages/PortfolioPage.tsx", import.meta.url),
  "utf8",
);
const inquiryModalSource = readFileSync(
  new URL("../src/components/PortfolioInquiryModal.tsx", import.meta.url),
  "utf8",
);
const appSource = readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);

describe("public portfolio direct inquiry", () => {
  it("offers a direct inquiry button on each portfolio card and in the lightbox", () => {
    assert.match(portfolioPageSource, /data-testid=\{`button-inquire-portfolio-\$\{photo\.id\}`\}/);
    assert.match(portfolioPageSource, /data-testid=\{`button-inquire-portfolio-\$\{zoomItem\.id\}`\}/);
    assert.match(portfolioPageSource, /onClick=\{\(\) => openPortfolioInquiry\(photo\)\}/);
    assert.match(portfolioPageSource, /onClick=\{\(\) => openPortfolioInquiry\(zoomItem\)\}/);
    assert.match(portfolioPageSource, /<PortfolioInquiryModal photo=\{inquiryPhoto\} onClose=\{closeInquiry\} \/>/);
  });

  it("shows the selected real-work photo and title in the inquiry modal", () => {
    assert.match(inquiryModalSource, /data-testid="modal-portfolio-inquiry"/);
    assert.match(inquiryModalSource, /src=\{photo\.url\}/);
    assert.match(inquiryModalSource, /data-testid="text-inquiry-portfolio-title"/);
    assert.match(inquiryModalSource, /photo\.captionTh\?\.trim\(\) \|\| photo\.title/);
    assert.match(inquiryModalSource, /photo\.categoryName/);
  });

  it("shows the selected catalog basin SKU and price in the shared inquiry modal", () => {
    assert.match(inquiryModalSource, /source\?: "portfolio"/);
    assert.match(inquiryModalSource, /source: "catalog"/);
    assert.match(inquiryModalSource, /sku\?: string/);
    assert.match(inquiryModalSource, /priceTHB\?: number/);
    assert.match(inquiryModalSource, /data-testid="text-inquiry-catalog-sku"/);
    assert.match(inquiryModalSource, /data-testid="text-inquiry-catalog-price"/);
    assert.match(inquiryModalSource, /new Intl\.NumberFormat\("th-TH"/);
  });

  it("provides the required phone field and optional contact name and notes", () => {
    assert.match(inquiryModalSource, /data-testid="input-inquiry-phone"/);
    assert.match(inquiryModalSource, /type="tel"/);
    assert.match(inquiryModalSource, /required/);
    assert.match(inquiryModalSource, /placeholder="เช่น 081-xxx-xxxx"/);
    assert.match(inquiryModalSource, /data-testid="input-inquiry-name"/);
    assert.match(inquiryModalSource, /data-testid="input-inquiry-notes"/);
    assert.match(inquiryModalSource, /placeholder="เช่น คอนโดสุขุมวิท \/ ขนาดที่ต้องการ"/);
  });

  it("posts the selected photo and contact details and accepts only 200 or 201", () => {
    assert.match(inquiryModalSource, /fetch\("\/api\/public\/portfolio\/inquiry"/);
    assert.match(inquiryModalSource, /method: "POST"/);
    for (const field of ["photoId", "photoTitle", "photoUrl", "source", "sku", "phone", "name", "notes"]) {
      assert.match(inquiryModalSource, new RegExp(`${field}:`));
    }
    assert.match(inquiryModalSource, /sku: sku \?\? null/);
    assert.match(inquiryModalSource, /response\.status !== 200 && response\.status !== 201/);
    assert.match(inquiryModalSource, /data-testid="button-submit-inquiry"/);
    assert.match(inquiryModalSource, /isSubmitting \? \(/);
    assert.match(inquiryModalSource, /กำลังส่งข้อมูล/);
    assert.match(inquiryModalSource, /ทีมงาน Knight Furnich ได้รับข้อมูลแล้ว จะติดต่อกลับอย่างรวดเร็วที่สุดครับ/);
  });

  it("provides an inquiry link to the Knight Furnich LINE OA with the selected work details", () => {
    assert.match(inquiryModalSource, /data-testid="button-inquiry-line"/);
    assert.match(inquiryModalSource, /line\.me\/R\/oaMessage\/%40789gcnhq/);
    assert.match(inquiryModalSource, /photo\.title/);
    assert.match(inquiryModalSource, /photo\.url/);
  });

  it("adds the fourth basin-card inquiry action without changing the three existing actions", () => {
    const productCardStart = appSource.indexOf("function ProductCard");
    const productCardEnd = appSource.indexOf("function SelectionMarker", productCardStart);
    assert.ok(productCardStart >= 0 && productCardEnd > productCardStart);
    const productCardSource = appSource.slice(productCardStart, productCardEnd);
    const actionPositions = [
      "button-quote-basin-",
      "link-basin-studio-",
      "link-portfolio-basin-",
      "button-inquire-basin-",
    ].map((testId) => productCardSource.indexOf(testId));
    assert.ok(actionPositions.every((position) => position >= 0));
    assert.deepEqual([...actionPositions].sort((left, right) => left - right), actionPositions);
    assert.match(productCardSource, /onClick=\{\(event\) => \{ event\.stopPropagation\(\); setInquiryOpen\(true\); \}\}/);
    assert.match(productCardSource, /<PortfolioInquiryModal\s+source="catalog"\s+sku=\{product\.sku\}/);
  });

  it("adds the fast-lane inquiry action to QuotePage and includes selected catalog context", () => {
    const quotePageStart = appSource.indexOf("function QuotePage");
    const quotePageEnd = appSource.indexOf("\nimport AdminApp", quotePageStart);
    assert.ok(quotePageStart >= 0 && quotePageEnd > quotePageStart);
    const quotePageSource = appSource.slice(quotePageStart, quotePageEnd);
    assert.match(quotePageSource, /data-testid="button-inquire-fast-lane"/);
    assert.match(quotePageSource, /💬 ให้ทีมโทรกลับ \/ ขอราคาเร็ว/);
    assert.match(quotePageSource, /sku=\{fastLaneProduct\?\.sku\}/);
    assert.match(quotePageSource, /priceTHB=\{fastLaneProduct\?\.priceTHB\}/);
    assert.match(quotePageSource, /cart\.map\(\(line\) => `\$\{line\.sku\} × \$\{line\.quantity\}`\)/);
  });

  it("uses static source inspection without dynamically importing the component", () => {
    assert.doesNotMatch(inquiryModalSource, /import\s*\(/);
    assert.doesNotMatch(portfolioPageSource, /import\s*\(/);
    assert.doesNotMatch(appSource, /import\s*\(/);
  });
});