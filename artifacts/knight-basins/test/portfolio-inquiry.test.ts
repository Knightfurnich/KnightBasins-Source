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
    for (const field of ["photoId", "photoTitle", "photoUrl", "phone", "name", "notes"]) {
      assert.match(inquiryModalSource, new RegExp(`${field}:`));
    }
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

  it("uses static source inspection without dynamically importing the component", () => {
    assert.doesNotMatch(inquiryModalSource, /import\s*\(/);
    assert.doesNotMatch(portfolioPageSource, /import\s*\(/);
  });
});