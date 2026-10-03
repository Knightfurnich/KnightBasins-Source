import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { importTypeScriptModule } from "./route-harness.ts";

// The context the support chat (น้องไนท์) is given about the logged-in customer's open quotations. After job-234-r removed
// support.ts's import of `quoteTotalTHB`, this function threw a ReferenceError for every customer who had at least one open
// quotation, so the chat answered 500 instead of replying. tsc caught it; nothing at runtime was covering it.

type SupportRouteModule = typeof import("../src/routes/support.ts");
type Row = Record<string, unknown>;

const originalEnv = { DATABASE_URL: process.env["DATABASE_URL"], SESSION_SECRET: process.env["SESSION_SECRET"] };
let support: SupportRouteModule;

before(async () => {
  process.env["DATABASE_URL"] = "postgres://support-customer-context-test";
  process.env["SESSION_SECRET"] = "support-customer-context-test-secret";
  support = await importTypeScriptModule<SupportRouteModule>("src/routes/support.ts");
});

after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

/** The two queries the summary makes: the customer's open leads (select with fields ... limit) and the slips of those leads (select().from().where()). */
function fakeDatabase(leads: Row[], slips: Row[] = []) {
  return {
    select: (fields?: unknown) => {
      const isLeadQuery = fields !== undefined;
      const builder = {
        from: () => builder,
        where: () => (isLeadQuery ? builder : Promise.resolve(slips)),
        orderBy: () => builder,
        limit: async () => leads,
      };
      return builder;
    },
  } as never;
}

const account = { id: 7, fullName: "คุณทดสอบ" } as never;

describe("buildCustomerContextSummary", () => {
  it("lists an open quotation with its number, status and total (60,990)", async () => {
    const database = fakeDatabase([{ id: 1, quoteNumber: "QT-202610-US-0001", status: "quote_requested", studioData: { total: 60990 } }]);
    const summary = await support.buildCustomerContextSummary(account, database);
    assert.match(summary, /^กำลังคุยกับลูกค้า "คุณทดสอบ"/);
    assert.ok(summary.includes("ใบเสนอราคา QT-202610-US-0001"), summary);
    assert.ok(summary.includes("สถานะ: ขอใบเสนอราคาแล้ว รอทีมขายติดต่อกลับ"), summary);
    assert.ok(summary.includes(`ยอดรวม ${(60990).toLocaleString("th-TH")} บาท`), summary);
  });

  it("leaves the total out when the quotation carries none, and notes the latest slip", async () => {
    const database = fakeDatabase(
      [{ id: 2, quoteNumber: null, status: "quote_sent", studioData: null }],
      [{ leadId: 2, status: "verified" }],
    );
    const summary = await support.buildCustomerContextSummary(account, database);
    assert.ok(summary.includes("ใบเสนอราคา 2"), "falls back to the lead id when there is no quote number");
    assert.ok(!summary.includes("ยอดรวม"), summary);
    assert.ok(summary.includes("สลิปล่าสุด: ยืนยันแล้ว"), summary);
  });

  it("says so when the customer has no open quotation", async () => {
    const summary = await support.buildCustomerContextSummary(account, fakeDatabase([]));
    assert.ok(summary.includes("ยังไม่มีใบเสนอราคาที่เปิดอยู่ในระบบ"), summary);
  });
});
