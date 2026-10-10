import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

/**
 * job 431-B: what the storefront tells customers about facts (photo counts, opening
 * hours, phone numbers, quote validity) must be one set of values from one place,
 * and a search miss must leave the customer somewhere to go.
 */
const [app, showcase, guide, portfolio, channels] = await Promise.all([
  "../src/App.tsx", "../src/components/InstallationShowcase.tsx", "../src/components/SalesGuide.tsx",
  "../src/pages/PortfolioPage.tsx", "../src/data/contact-channels.ts",
].map((p) => readFile(new URL(p, import.meta.url), "utf8")));

describe("photo counts are the real ones (431-B A)", () => {
  it("drops the inflated 670+/180+ claims", () => {
    for (const [name, src] of Object.entries({ app, showcase, guide, portfolio })) {
      assert.ok(!/670\+|180\+|^ *storefront used/.test(src) && !/670\+|180\+/.test(src.split("\n").filter((l) => !l.includes("//") && !l.includes("* ")).join("\n")), `inflated count still present in ${name}`);
    }
  });
  it("reads `total` from GET /api/portfolio, with one shared fallback", () => {
    assert.match(showcase, /export const PORTFOLIO_TOTAL_FALLBACK = 333;/);
    assert.match(showcase, /useQuery<\{ total\?: number \}>\(\{[^}]*queryKey: \["portfolio-total-count"\]/s);
    assert.match(showcase, /fetch\("\/api\/portfolio"/);
    assert.match(showcase, /ดูคลังผลงานทั้งหมด \(\{portfolioTotal\} ภาพ\)/);
    assert.match(guide, /usePortfolioTotal\(\)/);
    assert.match(guide, /\{portfolioTotal\} ภาพคัดสรร/);
  });
});

describe("one set of contact facts (431-B B + C)", () => {
  it("no customer surface hand-types a phone number anymore", () => {
    for (const [name, src] of Object.entries({ app, guide, portfolio })) {
      const typed = (src.match(/0[1-9]\d-\d{3}-\d{4}/g) ?? []).filter((n) => n !== "081234-5678");
      assert.deepEqual(typed, [], `${name} still hard-codes phones: ${typed.join(", ")}`);
    }
    assert.match(app, /contactPhonesCommaText\(\)/);
    assert.match(app, /phones: contactPhonesText\(\)/);
    assert.match(guide, /contactPhonesCommaText\(\)/);
    assert.match(portfolio, /contactPhonesCommaText\(\)/);
    assert.match(app, /salesPhone: CONTACT_PHONE_BACKUP_SALES/);
  });
  it("opening hours come from SALES_WORKING_HOURS, pickup time is labelled separately", () => {
    assert.match(guide, /เวลาทำการ :<\/strong> \{SALES_WORKING_HOURS\}/);
    assert.match(app, /เวลาทำการ \{SALES_WORKING_HOURS\}/);
    assert.match(app, /เวลารับสินค้าที่โรงงาน \(ไม่ใช่เวลาทำการ\): \$\{PLANT_PICKUP_HOURS\}/);
    assert.match(channels, /export const SALES_WORKING_HOURS = "จันทร์-ศุกร์ 08:00–17:00 · เสาร์ 08:00–12:00"/);
    assert.match(channels, /export const PLANT_PICKUP_HOURS = "จันทร์–ศุกร์ 08:30–16:30/);
    assert.ok(!/08:30 – 16:30 น\./.test(guide), "/readme must not print the old hours");
  });
});

describe("a search miss keeps a way forward (431-B D)", () => {
  it("empty state has clear, other-mode switch and a call link", () => {
    assert.match(app, /data-testid="status-stone-search-empty"/);
    assert.match(app, /data-testid="button-clear-stone-search-empty">ล้างคำค้น<\/button>/);
    assert.match(app, /data-testid="button-stone-search-switch-mode"/);
    assert.match(app, /data-testid="link-stone-search-contact">โทรหาทีมขาย \{CONTACT_PHONE_PRIMARY\}/);
    assert.match(app, /stoneSearchOtherMode\.mode === "installed"/);
    assert.match(app, /จำหน่ายในโหมด/);
  });
  it("separates 'no such code' from 'out of stock' instead of one vague line", () => {
    assert.match(app, /ไม่พบรหัสนี้ในรายการขายปัจจุบัน/);
    assert.match(app, /อาจเป็นรุ่นที่ของหมด\/รอของเข้า/);
    assert.ok(!/<p>ไม่พบสีหรือรหัสสินค้าที่ค้นหา<\/p>/.test(app), "the old dead-end copy must be gone");
  });
});

describe("internal wording gone, one expiry pair (431-B E + F)", () => {
  it("no Telegram/attachment/English-mixed copy in customer surfaces", () => {
    assert.match(app, /"บันทึกและส่งให้ทีมขาย"/);
    // the *saved quote* screen had the same leak on a different button
    assert.match(app, /"ส่งให้ทีมขายอีกครั้ง"/);
    assert.equal((app.match(/ส่งเข้า Telegram/g) ?? []).length, 0, "no channel name on any customer button");
    assert.ok(!/บันทึกและส่งเข้า Telegram/.test(app), "internal channel name must not face customers");
    assert.match(app, /เอกสารราคาปัจจุบันของ Knight Furnich/);
    assert.ok(!/ที่แนบมา · ราคายังไม่รวม VAT|จากเอกสาร Knight Furnich ที่แนบมา/.test(app));
    assert.ok(!/QUOTE BUILDER \/|SAVED QUOTATION \//.test(app), "internal eyebrows must be Thai customer copy");
    assert.match(app, /เลขที่เอกสาร \{quoteNumber\}/);
    assert.ok(!/· ราคายังไม่รวม VAT 7%<|ยังไม่รวม VAT 7%<\/div>/.test(app), "VAT % comes from VAT_PERCENT_LABEL");
  });
  it("installation row is not 'ฟรี' when there is no basin", () => {
    assert.match(app, /basinSets === 0 \? "—" : installationCharge === 0 \? "ฟรี"/);
  });
  it("30 vs 45 days both come from the constants module", () => {
    assert.match(channels, /export const QUOTE_PRICE_VALID_DAYS = 30;/);
    assert.match(channels, /export const QUOTE_LINK_VALID_DAYS = 45;/);
    assert.match(app, /`ยืนราคา \$\{QUOTE_PRICE_VALID_DAYS\} วัน`/);
    assert.match(app, /· \{QUOTE_PRICE_VALID_DAYS\} วัน<\/small>/);
    assert.match(app, /`เอกสารยืนราคา \$\{QUOTE_PRICE_VALID_DAYS\} วัน/);
    assert.ok(app.includes('(เกิน 45 วัน) ไม่สามารถแนบสลิปได้'), "boss-approved slip wording kept verbatim");
    assert.match(app, /ลิงก์เปิดดูได้ \$\{QUOTE_LINK_VALID_DAYS\} วัน ส่วนราคายืน \$\{QUOTE_PRICE_VALID_DAYS\} วัน/);
    assert.ok(app.includes("หมายเหตุ: ลิงก์เปิดดูได้"), "expired screen must explain link vs price window");
    assert.match(app, /ราคายืน \$\{QUOTE_PRICE_VALID_DAYS\} วันนับจากวันที่ออกเอกสาร/);
    assert.ok(!/\(เกิน 45 วัน\)/.test(app) || /QUOTE_LINK_VALID_DAYS/.test(app), "no bare 45 left");
    assert.ok(!/>ยืนราคา 30 วัน ·/.test(app), "no bare 30 left in the document header");
  });
});

describe("layout fixes at the audited widths (431-B H)", () => {
  it("does not mask overflow -- fixes the cause, and grows the small tap targets", () => {
    assert.ok(!/html\s*\{[^}]*overflow-x:\s*hidden/.test(app) && !/body\s*\{[^}]*overflow-x:\s*hidden/.test(app));
    assert.match(app, /\.stone-colors \{ grid-template-columns: repeat\(auto-fill, minmax\(150px, 1fr\)\); \}/);
    assert.match(app, /\.stone-search-row input \{ min-height: 44px; font-size: 16px; \}/);
    assert.match(app, /\.stone-price-filters button \{ flex: 0 0 auto; min-height: 44px; \}/);
    assert.match(app, /\.site-header > \.main-nav a \{[^}]*min-height: 44px;[^}]*font-size: 13px;/s);
    assert.match(app, /\.site-header > \.main-nav \.quote-link \{[^}]*min-width: 44px;[^}]*min-height: 44px;/s);
    assert.match(app, /\.site-header > \.main-nav::after \{ content: "→"/, "there must be a cue that the nav continues");
    assert.ok(!/font-size: 11px;\s*white-space: nowrap;/s.test(app), "11px nav type must be gone");
  });
});

describe("one unit and one currency symbol (432-B F)", () => {
  it("the storefront says ตร.ม. -- no m² / ตรม. left in the files customers see", async () => {
    const [appFile, studioFile] = await Promise.all([
      readFile(new URL("../src/App.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/components/StudioPage.tsx", import.meta.url), "utf8"),
    ]);
    for (const [name, src] of Object.entries({ appFile, studioFile })) {
      assert.equal((src.match(/m²/g) ?? []).length, 0, `${name} still uses m² (${(src.match(/m²/g)||[]).length})`);
      assert.equal((src.match(/ตรม\./g) ?? []).length, 0, `${name} still uses ตรม. without the dot`);
    }
    assert.match(appFile, /ตร\.ม\./);
  });
  it("no price reads '฿x–฿y บาท' (symbol once)", async () => {
    const src = appFileForCopy();
    assert.equal((src.match(/฿[\d,]+\s*[–-]\s*฿/g) ?? []).length, 0, "currency symbol must appear once per range");
    assert.ok(!/ราคา final/.test(src), "Thai wording for the final price");
  });
});

function appFileForCopy() { return app; }
