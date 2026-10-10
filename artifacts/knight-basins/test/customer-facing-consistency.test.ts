import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

/**
 * job 422-B (บอย): the copy/numbers a customer actually reads, and the floating assistant
 * that used to sit on top of the LINE button at 360px. Source-level by design (this repo has
 * no DOM test runner) -- every assertion here maps to a rule that a screenshot or a grep proved.
 */
const modalSource = await readFile(new URL("../src/components/PortfolioInquiryModal.tsx", import.meta.url), "utf8");
const supportSource = await readFile(new URL("../src/components/KnightSupport.tsx", import.meta.url), "utf8");
const channelsSource = await readFile(new URL("../src/data/contact-channels.ts", import.meta.url), "utf8");
const sitemapSource = await readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8");
const clientSources = { modalSource, supportSource, channelsSource } as const;

describe("customer is told what happens next after submitting (422-B A)", () => {
  it("replaces the vague 'will contact soon' with a reply window, working hours and status paths", () => {
    assert.match(modalSource, /data-testid="list-inquiry-next-steps"/);
    assert.match(modalSource, /\{SALES_REPLY_WINDOW\}/);
    assert.match(modalSource, /\{SALES_WORKING_HOURS\}/);
    assert.match(modalSource, /ไม่ต้องพิมพ์ซ้ำ/);
    assert.match(modalSource, /data-testid="text-inquiry-backup-phone"/);
    assert.match(modalSource, /เช็กสถานะ/);
    // no dead-end left: the hand-written time estimate ("รวดเร็วที่สุด") is gone from the modal
    assert.doesNotMatch(modalSource, /จะติดต่อกลับอย่างรวดเร็วที่สุด/);
  });

  it("the window + hours are read from one module that already mirrors the site's own copy", () => {
    assert.match(channelsSource, /export const SALES_REPLY_WINDOW = "ภายใน 24 ชั่วโมง"/);
    assert.doesNotMatch(modalSource, /ภายใน 24 ชั่วโมง"|ภายใน 1 ชั่วโมง/); // literal dates live only in data/
    // App.tsx (out of this job's scope) says the same thing -- provenance, not invention:
    //   src/App.tsx:1479  "ทีมขาย Knight Furnich จะติดต่อกลับภายใน 24 ชั่วโมงทำการ"
  });
});

describe("one source for contact details (422-B C)", () => {
  it("customer-visible numbers are dashed, and the ordered list is primary then backups", () => {
    assert.equal(
      /export const CONTACT_PHONES = \[([\s\S]*?)\] as const;/.exec(channelsSource)![1].replace(/\s|\/\*.*?\*\//g, ""),
      "CONTACT_PHONE_PRIMARY,CONTACT_PHONE_BACKUP_SALES,CONTACT_PHONE_BACKUP_TEAM,",
    );
    for (const literal of channelsSource.match(/"\d{3}-\d{3}-\d{4}"/g) ?? []) {
      assert.ok(/^\0?"\d{3}-\d{3}-\d{4}"$/.test(literal), `dashed format expected, got ${literal}`);
    }
    assert.match(channelsSource, /export const CONTACT_PHONE_PRIMARY = "094-496-1949"/);
    assert.match(channelsSource, /CONTACT_PHONE_BACKUP_SALES = "091-978-2292"/);
    assert.match(channelsSource, /CONTACT_PHONE_BACKUP_TEAM = "089-762-2209"/);
  });

  it("the modal never hand-writes a phone number -- it renders from the module", () => {
    assert.match(modalSource, /contactPhonesText\(\)/);
    assert.match(modalSource, /telHref\(CONTACT_PHONE_PRIMARY\)/);
    // every phone that shows up in the rendered copy comes from the module (no bare 0xx literals
    // outside tel: hrefs) -- measured by stripping hrefs first so href shape stays exempt
    const modalCopy = modalSource.replace(/href=\{telHref\([^)]*\)\}/g, "");
    const bare = modalCopy.match(/(?<![\d-])0\d{2}-?\d{3}-?\d{4}(?![\d-])/g) ?? [];
    assert.deepEqual(bare, [], `phone literals must not be hardcoded in the modal: ${bare.join(", ")}`);
  });

  it("retired/test numbers stay out of the storefront bundle", () => {
    for (const forbidden of ["080-606-4444", "061-845-9666"]) {
      for (const [name, source] of Object.entries({ modalSource, supportSource })) {
        assert.ok(!source.includes(forbidden), `${forbidden} must not appear in ${name}`);
      }
    }
    // the two files that still contain them are reported, not silently edited:
    //  - src/components/WorkshopProductionSheet.tsx:25 (โรงงาน/เอกสารผลิต, component นี้ไม่มีใคร import ใน src)
    //  - artifacts/api-server/src/routes/support.ts   (ขอบเขตชัย -- ใบ 421-C)
    // และ "0135553014" ที่รายงาน 420-B เกรปเจอ = ชิ้นส่วนของเลขประจำตัวผู้เสียภาษี 13 หลัก
    // (0135553014114) ในไฟล์เดียวกัน ไม่ใช่เบอร์โทร → ไม่ถือว่า fail
    assert.match(supportSource, /น้องไนท์/); // boss ruling 10 ต.ค. 69: keep the assistant's name
  });
});

describe("no duplicate data-testid on the login button (422-B B)", () => {
  it("the shared component keeps `button-line-login`, the inquiry modal opts out", () => {
    assert.equal((modalSource.match(/data-testid="button-line-login-portfolio"/g) ?? []).length, 1);
    assert.equal((modalSource.match(/data-testid="button-line-login"/g) ?? []).length, 0);
    assert.equal((supportSource.match(/testId = "button-line-login"/g) ?? []).length, 1);
    assert.doesNotMatch(modalSource, /button-line-login"/);
  });
});

describe("floating assistant steps aside while a dialog is open (422-B D)", () => {
  it("the dialog announces open/close on one shared window event", () => {
    assert.match(modalSource, /window\.dispatchEvent\(new CustomEvent\(OVERLAY_OPEN_EVENT, \{ detail: \{ open \} \}\)\)/);
    assert.match(modalSource, /announce\(true\)/);
    assert.match(modalSource, /announce\(false\)/);
    assert.match(channelsSource, /export const OVERLAY_OPEN_EVENT = "knightbasins:overlay-open"/);
  });

  it("the launcher hides (not deletes) itself under an overlay, and keeps existing test ids", () => {
    assert.match(supportSource, /window\.addEventListener\(OVERLAY_OPEN_EVENT, onOverlay\)/);
    assert.match(supportSource, /data-overlay-covered=\{coveredByOverlay \? "true" : "false"\}/);
    assert.match(supportSource, /visibility: "hidden", pointerEvents: "none"/);
    assert.match(supportSource, /data-testid="button-knight-support"/);
    assert.doesNotMatch(supportSource, /if \(coveredByOverlay\) return null/);
    assert.ok(!/html[\s\S]{0,80}overflow-x:\s*hidden|body[\s\S]{0,80}overflow-x:\s*hidden/.test(supportSource));
  });
});

describe("sitemap lastmod tracks what actually shipped (422-B E)", () => {
  it("pages whose source changed on 2026-10-10 carry that date", () => {
    const urlsWith = (date: string) =>
      [...sitemapSource.matchAll(/<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<lastmod>([^<]+)<\/lastmod>/g)]
        .filter(([, , d]) => d === date)
        .map(([, u]) => u);
    const today = urlsWith("2026-10-10");
    for (const path of ["/", "/stone", "/price-guide"]) {
      assert.ok(today.includes(`https://knightbasins.com${path}`), `${path} lastmod must be 2026-10-10 (got: ${today.join(" ") || "none"})`);
    }
  });
});
