import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

/**
 * job 463-C rev.1-2 (D website label, E map link, F address roles) are at the end of this file.
 * job 463-C (owner's three notes on the quote, 12 Oct 2026):
 *   A  the LINE OA is called "KnightBasins", not "KnightBot" - everywhere in the app code and public files
 *   B  the factory-hours line printed the literal text `${PLANT_PICKUP_HOURS}` (a plain string, not a template)
 *   C  the "บัญชีรับเงิน" box sits under the details, full width, with the account number readable
 * `src/index.css` is frozen: C is done with inline style only.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const app = read("src/App.tsx");
const guide = read("src/components/SalesGuide.tsx");
const css = read("src/index.css");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe("463-C · A · LINE OA name", () => {
  it("no 'KnightBot' is left in the app code or the public files", () => {
    const files = [...walk(join(root, "src")), ...walk(join(root, "public"))].filter((f) => /\.(tsx?|css|txt|md|json|html|xml)$/.test(f));
    const hits = files.filter((f) => /KnightBot/i.test(readFileSync(f, "utf8"))).map((f) => f.replace(root, ""));
    assert.deepEqual(hits, []);
  });

  it("the footer and /readme print the OA as KnightBasins, with the same OA id", () => {
    assert.match(app, /<strong>@789gcnhq<\/strong> \(KnightBasins\)/);
    assert.match(guide, /<strong>LINE Official :<\/strong> @789gcnhq \(KnightBasins\)/);
  });

  it("the OA id and the add-friend link are unchanged", () => {
    assert.match(app, /line\.me\/R\/ti\/p\/@789gcnhq/);
    assert.ok(read("public/llms-full.txt").includes("@789gcnhq (KnightBasins /"));
  });
});

describe("463-C · B · factory hours line", () => {
  const block = app.slice(app.indexOf("const QUOTE_PRODUCT_DETAILS = ["), app.indexOf("] as const;", app.indexOf("const QUOTE_PRODUCT_DETAILS = [")));
  const lines = [...block.matchAll(/^\s*"([^"\n]*)",?\s*$/gm)].map((m) => m[1]);

  it("the quote's detail lines were found", () => {
    assert.ok(lines.length >= 7, `found ${lines.length} lines`);
  });

  it("prints the real hours, once, with the Saturday hours at the end", () => {
    const hours = lines.find((l) => l.startsWith("เวลารับสินค้าที่โรงงาน"));
    assert.equal(hours, "เวลารับสินค้าที่โรงงาน (ไม่ใช่เวลาทำการ): จันทร์–ศุกร์ 08:00–17:00 · เสาร์ 08:30–11:30");
    assert.equal((hours as string).match(/เสาร์/g)?.length, 1, "Saturday must not be repeated");
  });

  it("no customer-facing line carries a placeholder (`${...}` inside a plain string)", () => {
    for (const line of lines) assert.ok(!line.includes("${"), `placeholder left in: ${line}`);
    // the same mistake anywhere in the two files: a plain double-quoted string with ${...} in it
    for (const [name, source] of [["App.tsx", app], ["SalesGuide.tsx", guide]] as const) {
      const bad = source.split("\n").filter((l) => /^\s*"[^"\n]*\$\{[^"\n]*"[,;]?\s*$/.test(l));
      assert.deepEqual(bad, [], `${name} has a plain string with a placeholder`);
    }
  });

  it("the unused constant is no longer imported by the quote", () => {
    assert.doesNotMatch(app, /PLANT_PICKUP_HOURS/);
  });
});

describe("463-C · C · bank box under the details", () => {
  const fn = app.slice(app.indexOf("function FormalQuote("), app.indexOf("type SavedStudioPayload"));
  const sidebar = fn.slice(fn.indexOf('<div className="formal-summary-sidebar">'), fn.indexOf("{/* job 463-C: the bank box"));
  const after = fn.slice(fn.indexOf("{/* job 463-C: the bank box"));
  const bankOpen = after.indexOf('className="formal-bank-details"');
  const bank = after.slice(bankOpen, after.indexOf("</div>", bankOpen));

  it("the bank box is no longer in the summary sidebar", () => {
    assert.ok(sidebar.length > 0);
    assert.doesNotMatch(sidebar, /formal-bank-details/);
    assert.doesNotMatch(sidebar, /บัญชีรับเงิน/);
  });

  it("the sidebar still holds the totals, the net amount and the Thai number text", () => {
    assert.match(sidebar, /className="formal-totals"/);
    assert.match(sidebar, /รวมก่อนส่วนลด/);
    assert.match(sidebar, /ภาษีมูลค่าเพิ่ม 7%/);
    assert.match(sidebar, /className="formal-grand-total"[\s\S]*formatTHB\(total\)[\s\S]*thaiNumberText\(total\)/);
  });

  it("it comes after the notes/totals row and before the signature, outside the two-column row", () => {
    const bottom = fn.indexOf('className={`formal-quote-bottom formal-quote-bottom--');
    const notes = fn.indexOf('className="formal-notes formal-notes-container"');
    const bankAt = fn.indexOf('className="formal-bank-details"');
    const signature = fn.indexOf('className="formal-quote-signature"');
    assert.ok(bottom >= 0 && notes > bottom && bankAt > notes && signature > bankAt);
    // totals </div>, sidebar </div> and the row </div> all close before the bank box opens
    const sidebarAt = fn.indexOf('<div className="formal-summary-sidebar">');
    assert.match(fn.slice(sidebarAt, bankAt), /<\/div>\s*<\/div>\s*<\/div>\s*\{\/\* job 463-C/);
  });

  it("is full width (inline), so the frozen 54%/66% rules cannot narrow it", () => {
    assert.match(bank, /width: "100%"/);
    assert.match(bank, /marginLeft: 0/);
    assert.match(bank, /breakInside: "avoid"/);
  });

  it("the account number is bold and at least 15px; the other lines at least 13px", () => {
    const number = after.match(/data-testid="formal-bank-account-number" style=\{\{([^}]*)\}\}>\{COMPANY_DETAILS\.bankAccountNumber\}/);
    assert.ok(number, "account number span not found");
    const size = Number(number[1].match(/fontSize:\s*(\d+(?:\.\d+)?)/)?.[1]);
    assert.ok(size >= 15, `account number font ${size}`);
    assert.match(number[1], /fontWeight:\s*800/);
    const others = [...after.slice(0, after.indexOf("COMPANY_DETAILS.bankAccountNumber")).matchAll(/fontSize:\s*(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
    assert.ok(others.length >= 3 && others.every((n) => n >= 13), `other lines ${others.join(",")}`);
  });

  it("still prints the bank, branch, account name and number from COMPANY_DETAILS", () => {
    for (const field of ["bankName", "bankBranch", "bankAccountName", "bankAccountNumber"]) {
      assert.match(bank + after.slice(bankOpen, bankOpen + 900), new RegExp(`COMPANY_DETAILS\\.${field}`));
    }
    assert.match(app, /bankAccountNumber: "574-1-18925-4"/);
  });

  it("src/index.css is untouched by this job (its old widths stay, nothing mentions 463-C)", () => {
    assert.doesNotMatch(css, /463-C/);
    assert.match(css, /\.formal-quote-bottom--of \.formal-bank-details \{ width: 54\.8387%; \}/);
    assert.match(css, /\.formal-quote-bottom--us \.formal-bank-details \{ width: 66\.6667%; \}/);
  });
});

const pricePage = read("src/pages/PriceGuidePage.tsx");
const MAP_URL = "https://maps.app.goo.gl/o47RDTQAWZTfB4HYA";
const REGISTERED = "35/170, 35/267 หมู่ที่ 1 ซอยร่วมสุข 8/13 ถนนติวานนท์-แจ้งวัฒนะ ต.บ้านใหม่ อ.เมือง จ.ปทุมธานี 12000";

describe("463-C · D · website label", () => {
  it("the guide and the footer call the site list 'เครือข่ายเว็บไซต์', not 'เว็บไซต์หลัก'", () => {
    assert.match(guide, /<strong>เครือข่ายเว็บไซต์ :<\/strong> <a href="https:\/\/www\.knightfurnich\.com"/);
    assert.match(app, /<span className="footer-contact-key">เครือข่ายเว็บไซต์<\/span>\s*<span><a href="https:\/\/www\.knightfurnich\.com"/);
    assert.doesNotMatch(app + guide, /เว็บไซต์หลัก/);
  });
});

describe("463-C · E · map link", () => {
  it("the footer has a 'แผนที่ / นำทาง' link to the shared map pin, in a new tab", () => {
    const m = app.match(/<a[^>]*data-testid="link-footer-map"[^>]*>[\s\S]*?<\/a>/) ?? app.match(/<a[\s\S]{0,300}data-testid="link-footer-map"[\s\S]*?<\/a>/);
    assert.ok(m, "link-footer-map not found");
    assert.ok(m[0].includes(`href="${MAP_URL}"`));
    assert.match(m[0], /target="_blank"/);
    assert.match(m[0], /rel="noreferrer"/);
    assert.match(m[0], /แผนที่ \/ นำทาง/);
  });

  it("/price-guide has the same link, in a new tab", () => {
    const m = pricePage.match(/<a[\s\S]{0,400}data-testid="link-price-guide-map"[\s\S]*?<\/a>/);
    assert.ok(m, "link-price-guide-map not found");
    assert.ok(m[0].includes(`href="${MAP_URL}"`));
    assert.match(m[0], /target="_blank"/);
    assert.match(m[0], /rel="noreferrer"/);
    assert.match(m[0], /แผนที่ \/ นำทาง/);
    assert.match(m[0], /min-h-11/, "tap target");
  });

  it("the existing Google Maps link in the footer is kept", () => {
    assert.match(app, /data-testid="link-footer-maps"/);
  });
});

describe("463-C · F · address roles (showroom 8/1, head office 8/13)", () => {
  it("the footer labels 8/13 as the head office / tax-invoice address, not the factory", () => {
    assert.ok(app.includes(`สำนักงานใหญ่ (ที่อยู่ออกใบกำกับภาษี): ${REGISTERED}`));
    assert.doesNotMatch(app, /โรงงานผลิต: 35\/170/);
    assert.match(app, /โชว์รูม: 35\/633 ซอยร่วมสุข 8\/1 /);
  });

  it("/readme shows the showroom (8/1), no longer 8/13", () => {
    assert.match(guide, /โชว์รูม: 35\/633 ซอยร่วมสุข 8\/1 ตำบลบ้านใหม่/);
    assert.doesNotMatch(guide, /ซอยร่วมสุข 8\/13/);
  });

  it("the quote header prints the full registered address (8/13)", () => {
    assert.ok(app.includes(`address: "${REGISTERED}",`));
    assert.match(app, /<p>\{COMPANY_DETAILS\.address\} · \{COMPANY_DETAILS\.phones\}<\/p>/);
    assert.doesNotMatch(app, /address: "โรงงาน \/ สำนักงานใหญ่ ปทุมธานี"/);
  });

  it("the constant that contradicted the owner's hours is gone", () => {
    assert.doesNotMatch(read("src/data/contact-channels.ts"), /PLANT_PICKUP_HOURS/);
  });
});
