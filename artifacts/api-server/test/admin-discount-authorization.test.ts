import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, describe, it } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import { STONE_COLORS, basinProductFromCatalog } from "../../knight-basins/src/data/catalog.ts";
import { createBasinPlacement, studioEstimate, type StudioState } from "../../knight-basins/src/data/studio-model.ts";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import {
  SERVER_PRICING_KEY,
  loadPricingCatalog,
  repriceStudioQuoteAsStaff,
  staffLeversFromStamp,
  staffLeversFromState,
  verifyAndRecalculateQuoteTotal,
  withServerPricing,
  type PricingCatalog,
} from "../src/lib/price-integrity.ts";
import { FIXTURE_BASIN_ROWS, fixtureBasinSku, pricingOnlyDatabase, withPricingCatalog } from "./price-guard-fixtures.ts";
import { importTypeScriptModule } from "./route-harness.ts";

// job-229: staff may give a discount (and set the open-edge price); public customers never can.
//
// The studio page's linked-lead mode saves through PATCH /api/admin/leads/:id, a route that already requires the
// leads:edit permission. There the server prices the quote with exactly the levers the staff member set, rewrites every
// total the quote carries, and stamps the result; the payment QR trusts that stamp. Every expected number is worked out
// by hand in a comment.
//
// Fixture catalog (price-guard-fixtures.ts): basins TESTB-15000 / TESTB-25000 (priced at their names); stone TEST-ST1 at
// 8,000 per m2 installed and 5,000 per sheet.

type AdminRouteModule = { createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1] };
type LeadRouteModule = typeof import("../src/routes/leads.ts");
type QuoteAccessModule = typeof import("../src/lib/quote-access.ts");

const BASIN_25000 = fixtureBasinSku(25000);
const BASIN_15000 = fixtureBasinSku(15000);

async function fixtureCatalog(): Promise<PricingCatalog> {
  return loadPricingCatalog(pricingOnlyDatabase());
}

// ---- the studio state and what the browser computes for it ------------------------------------------------------------

const RECTANGLE = { id: "piece-1-1", widthMm: 1800, lengthMm: 600, xMm: 0, yMm: 0, rotation: 0 as const, label: "A" };

function studioState(overrides: Partial<StudioState> = {}, sideStatuses: Record<string, string> = {}, basinSkus: string[] = [BASIN_25000]): StudioState {
  const piece = { id: "piece-1", name: "Piece 1", rectangles: [{ ...RECTANGLE }], sideStatuses };
  const placements = basinSkus.map((sku, index) => createBasinPlacement(basinProductFromCatalog(FIXTURE_BASIN_ROWS.find((row) => row.sku === sku)!), index, piece.id, RECTANGLE.id));
  return {
    mode: "studio",
    shape: "I",
    dimensions: { depthMm: 600, runAMm: 1800, runBMm: 0, runCMm: 0 },
    pieces: [piece],
    activePieceId: piece.id,
    backsplash: { enabled: false, heightMm: 120 },
    upstandHeightMm: 120,
    openEdgePricePerMTHB: null,
    discountTHB: 0,
    location: "bangkok-metro",
    vat: false,
    quoteFormat: "US",
    stoneColors: [],
    activeStone: "TEST-ST1",
    stoneSelectionSource: "user",
    basinSkus: [...new Set(placements.map((placement) => placement.sku))],
    basinPlacements: placements,
    ...overrides,
  } as unknown as StudioState;
}

function browserEstimate(state: StudioState, catalog: PricingCatalog) {
  const previous = STONE_COLORS.slice();
  STONE_COLORS.splice(0, STONE_COLORS.length, ...catalog.stoneColors);
  try {
    return studioEstimate(state, catalog.products);
  } finally {
    STONE_COLORS.splice(0, STONE_COLORS.length, ...previous);
  }
}

/** The studioData a customer's submission leaves in the database: state, estimate and the formal notification snapshot. */
function customerStudioData(state: StudioState, catalog: PricingCatalog) {
  const estimate = browserEstimate(state, catalog);
  return {
    state,
    estimate,
    notification: {
      items: [{ kind: "basin", code: BASIN_25000, description: "basin", quantity: 1 }],
      grossSubtotal: estimate.grossSubtotalTHB,
      discountAmount: estimate.grossSubtotalTHB - estimate.subtotalTHB,
      subtotal: estimate.subtotalTHB,
      vatAmount: estimate.vatAmountTHB,
      total: estimate.totalTHB,
      vat: state.vat,
    },
    worksitePlaceId: null,
  };
}

// Hand calculation for studioState() (1.8 x 0.6 m board, 25,000 basin, Bangkok, no VAT, no edges):
//   stone 1.08 m2 x 8,000 = 8,640; basin 25,000; installation 1 x 5,000; small job 5,000 (under 5 m2) -> gross 43,640
const GROSS = 43_640;
// staff discount 5,000: 43,640 - 5,000 = 38,640
const DISCOUNTED = 38_640;

// ---- a database that knows the tables the two routers touch ------------------------------------------------------------

type Row = Record<string, unknown>;

function tableNameOf(table: unknown): string {
  return String((table as Record<symbol, unknown>)[Symbol.for("drizzle:Name")]);
}

function createFakeDatabase(lead: Row | null, extras: { apiKeys?: Row[] } = {}) {
  const leads: Row[] = lead ? [{ ...lead }] : [];
  const apiKeys = extras.apiKeys ?? [];
  const audits: Row[] = [];
  const inserted: Row[] = [];
  const conflictSets: Row[] = [];
  let leadWrites = 0;
  const base = {
    select: () => {
      const builder = {
        from: (table: unknown) => {
          const name = tableNameOf(table);
          const rows = name === "customer_leads" ? leads : name === "admin_api_keys" ? apiKeys : [];
          const query = { where: () => query, limit: async () => rows.map((row) => ({ ...row })) };
          return query;
        },
      };
      return builder;
    },
    update: (table: unknown) => {
      const name = tableNameOf(table);
      let changes: Row = {};
      const builder = {
        set(values: Row) {
          changes = values;
          return builder;
        },
        where: () => {
          const result = {
            returning: async () => {
              if (name !== "customer_leads" || leads.length === 0) return [];
              leadWrites += 1;
              Object.assign(leads[0]!, changes);
              return [{ ...leads[0]! }];
            },
            then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve().then(resolve, reject),
          };
          return result;
        },
      };
      return builder;
    },
    insert: (table: unknown) => {
      const isAudit = tableNameOf(table) === "system_audit_logs";
      let values: Row = {};
      const builder = {
        values(next: Row) {
          values = next;
          if (isAudit) {
            audits.push(next);
            return Promise.resolve();
          }
          return builder;
        },
        onConflictDoUpdate(arg: { set: Row }) {
          conflictSets.push(arg.set);
          return builder;
        },
        returning: async () => {
          inserted.push(values);
          return [{ id: inserted.length, ...values }];
        },
      };
      return builder;
    },
  };
  return {
    database: withPricingCatalog(base),
    leads,
    audits,
    inserted,
    conflictSets,
    leadWrites: () => leadWrites,
  };
}

async function waitForAudit(audits: Row[], count = 1) {
  for (let attempt = 0; attempt < 60 && audits.length < count; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 10));
}

// ---- the two routers on one test server --------------------------------------------------------------------------------

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
};
let adminModule: AdminRouteModule;
let leadsModule: LeadRouteModule;
let quoteAccess: QuoteAccessModule;

before(async () => {
  process.env["ADMIN_PASSWORD"] = "admin-discount-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-discount-test";
  process.env["SESSION_SECRET"] = "admin-discount-test-session-secret";
  delete process.env["ADMIN_ROLE"];
  adminModule = await importTypeScriptModule<AdminRouteModule>("src/routes/admin-router.ts");
  leadsModule = await importTypeScriptModule<LeadRouteModule>("src/routes/leads.ts");
  quoteAccess = await importTypeScriptModule<QuoteAccessModule>("src/lib/quote-access.ts");
});

after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function startServer(database: unknown) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", adminModule.createAdminRouter(database));
  app.use("/api", leadsModule.createLeadsRouter(database as never));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ message: "Internal server error", detail: error instanceof Error ? error.message : String(error) });
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server has no TCP address");
  return { url: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))) };
}

const QUOTE_NUMBER = "Oct 26 / US / 292929";
const ACCESS_SECRET = "c".repeat(64);
const OWNER_COOKIE = () => `knight_admin_session=${createAdminToken()}`;

/** A studio lead as a customer's submission leaves it (stamped by POST /leads). */
async function customerLead(overrides: Row = {}, state = studioState()): Promise<Row> {
  const catalog = await fixtureCatalog();
  const data = customerStudioData(state, catalog);
  return {
    id: 7,
    leadKey: "lead-admin-discount-0001",
    status: "quote_requested",
    notes: null,
    name: "คุณทดสอบ",
    phone: "0812345678",
    quoteNumber: QUOTE_NUMBER,
    quoteAccessSecret: ACCESS_SECRET,
    orderMode: "studio",
    studioData: withServerPricing(data, data.estimate.totalTHB),
    ...overrides,
  };
}

/** What the studio page's linked mode sends: the lead's studioData plus the state/estimate it computed. */
function staffSave(state: StudioState, catalog: PricingCatalog, existing: Row, extra: Row = {}) {
  const estimate = browserEstimate(state, catalog);
  return { status: "quote_requested", notes: null, studioData: { ...(existing["studioData"] as Row), state, estimate, worksitePlaceId: null, ...extra } };
}

async function patchLead(url: string, body: Row, headers: Record<string, string> = { cookie: OWNER_COOKIE() }) {
  const response = await fetch(`${url}/api/admin/leads/7`, { method: "PATCH", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, body: (await response.json()) as Row };
}

async function requestQr(url: string, paymentType = "full") {
  const token = quoteAccess.createPublicQuoteToken(QUOTE_NUMBER, ACCESS_SECRET);
  const response = await fetch(`${url}/api/public/quotes/promptpay-qr`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, paymentType }) });
  return { status: response.status, body: (await response.json()) as Row };
}

// ================================================================================================================
// 1. The pricing function
// ================================================================================================================

describe("job-229: pricing a quote for staff", () => {
  it("reads the levers a studio payload asks for, and nothing when it asks for none", () => {
    assert.equal(staffLeversFromState({ state: studioState() }), null);
    assert.deepEqual(staffLeversFromState({ state: studioState({ discountTHB: 5000 }) }), { staffDiscountTHB: 5000, staffOpenEdgePricePerMTHB: null });
    assert.deepEqual(staffLeversFromState({ state: studioState({ openEdgePricePerMTHB: 1000 }) }), { staffDiscountTHB: 0, staffOpenEdgePricePerMTHB: 1000 });
    assert.deepEqual(staffLeversFromState({ state: studioState({ discountTHB: 300, openEdgePricePerMTHB: 0 }) }), { staffDiscountTHB: 300, staffOpenEdgePricePerMTHB: 0 });
    for (const discountTHB of [-5, Number.NaN, "5000", null, undefined]) {
      assert.equal(staffLeversFromState({ state: studioState({ discountTHB: discountTHB as never }) }), null, `discount ${String(discountTHB)} is not a lever`);
    }
    assert.equal(staffLeversFromState({}), null);
    assert.equal(staffLeversFromState(null), null);
  });

  it("applies a staff discount: 43,640 - 5,000 = 38,640, and rewrites every total the quote carries", async () => {
    const catalog = await fixtureCatalog();
    const data = customerStudioData(studioState({ discountTHB: 5000 }), catalog) as unknown as Record<string, unknown>;
    // the customer's old, undiscounted notification is what the studio page leaves behind when staff save
    data["notification"] = customerStudioData(studioState(), catalog).notification;

    const result = await repriceStudioQuoteAsStaff(data, catalog, staffLeversFromState(data), { memberId: 5 });
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.equal(result.total, DISCOUNTED);
    const out = result.studioData;
    assert.equal((out["estimate"] as Row)["totalTHB"], DISCOUNTED);
    assert.deepEqual(
      Object.fromEntries(["grossSubtotal", "discountAmount", "subtotal", "vatAmount", "total"].map((key) => [key, (out["notification"] as Row)[key]])),
      { grossSubtotal: GROSS, discountAmount: 5000, subtotal: DISCOUNTED, vatAmount: 0, total: DISCOUNTED },
    );
    assert.equal(((out["state"] as Row)["discountTHB"]), 5000);
    const stamp = out[SERVER_PRICING_KEY] as Row;
    assert.equal(stamp["verifiedTotalTHB"], DISCOUNTED);
    assert.equal(stamp["staffDiscountTHB"], 5000);
    assert.equal(stamp["authorizedByMemberId"], 5);
    assert.equal("authorizedBy" in stamp || "actorName" in stamp || "staffEmail" in stamp, false, "no staff name or e-mail in data the customer can read");
  });

  it("applies VAT after the discount: (43,640 - 5,000) x 1.07", async () => {
    // subtotal 38,640; VAT 7% = 2,704.8 -> 2,705; total 41,345
    const catalog = await fixtureCatalog();
    const data = customerStudioData(studioState({ discountTHB: 5000, vat: true }), catalog) as unknown as Record<string, unknown>;
    const result = await repriceStudioQuoteAsStaff(data, catalog, staffLeversFromState(data), { memberId: null });
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.total, 41_345);
      assert.equal((result.studioData["notification"] as Row)["vatAmount"], 2_705);
    }
  });

  it("carries the open-edge price lever the same way (a zero price is accepted and charges nothing)", async () => {
    // NOTE: the shared pricing model's own validity check for the open-edge price (studio-model.ts, openEdgePriceInvalid:
    // `Math.round(price * 100) !== price`) currently flags every price except 0 as invalid, in the browser as well as here.
    // That is reported separately; this test only covers what the server owns: the lever is read, priced through the model
    // and stamped. Once the model accepts real prices, staff open-edge prices flow through the same code unchanged.
    const catalog = await fixtureCatalog();
    const data = customerStudioData(studioState({ openEdgePricePerMTHB: 0, discountTHB: 4000 }, { "piece-1-1:left": "open-edge" }), catalog) as unknown as Record<string, unknown>;
    const levers = staffLeversFromState(data);
    assert.deepEqual(levers, { staffDiscountTHB: 4000, staffOpenEdgePricePerMTHB: 0 });
    const result = await repriceStudioQuoteAsStaff(data, catalog, levers, { memberId: null });
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.equal(result.total, GROSS - 4000, "43,640 - 4,000; a 600 mm open edge at 0 per metre adds nothing");
    const stamp = result.studioData[SERVER_PRICING_KEY] as Row;
    assert.equal(stamp["staffOpenEdgePricePerMTHB"], 0);
  });

  it("takes a discount away: no levers prices the quote at 43,640 again and the stamp carries nothing staff-made", async () => {
    const catalog = await fixtureCatalog();
    const data = customerStudioData(studioState({ discountTHB: 0 }), catalog) as unknown as Record<string, unknown>;
    const result = await repriceStudioQuoteAsStaff(data, catalog, null, { memberId: 5 });
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.equal(result.total, GROSS);
    assert.equal(staffLeversFromStamp(result.studioData), null);
    assert.equal((result.studioData[SERVER_PRICING_KEY] as Row)["verifiedTotalTHB"], GROSS);
  });

  it("refuses a discount above the amount it applies to, a negative or over-precise open-edge price, and a state it cannot price", async () => {
    const catalog = await fixtureCatalog();
    const refuse = async (state: unknown, reason: string) => {
      const data = { state } as Record<string, unknown>;
      const result = await repriceStudioQuoteAsStaff(data, catalog, staffLeversFromState(data), { memberId: null });
      assert.deepEqual(result, { ok: false, reason });
    };
    await refuse(studioState({ discountTHB: 50_000 }), "discount-invalid"); // more than the 43,640 it could take off
    await refuse(studioState({ openEdgePricePerMTHB: -1 }), "open-edge-price-invalid");
    await refuse(studioState({ openEdgePricePerMTHB: 10.123 }), "open-edge-price-invalid");
    await refuse({ shape: "I" }, "studio-state-invalid");
    await refuse(undefined, "studio-state-missing");
  });

  it("customers are unchanged: the public check still prices a typed discount at 0", async () => {
    const catalog = await fixtureCatalog();
    const typed = { state: studioState({ discountTHB: 5000 }), notification: { total: GROSS } };
    const honest = await verifyAndRecalculateQuoteTotal("studio", typed, catalog);
    assert.equal(honest.isTampered, false);
    assert.equal(honest.calculatedTotal, GROSS);
    assert.equal(honest.discountIgnoredTHB, 5000);

    const discounted = await verifyAndRecalculateQuoteTotal("studio", { state: studioState({ discountTHB: 5000 }), notification: { total: DISCOUNTED } }, catalog);
    assert.equal(discounted.isTampered, true, "a total that includes a customer's discount is refused");
    assert.equal(discounted.calculatedTotal, GROSS);
  });
});

// ================================================================================================================
// 2. PATCH /api/admin/leads/:id
// ================================================================================================================

describe("job-229: PATCH /api/admin/leads/:id gives a staff discount", () => {
  it("accepts a signed-in staff discount, stores the server's total, and answers with it", async () => {
    const catalog = await fixtureCatalog();
    const existing = await customerLead();
    const { database, leads } = createFakeDatabase(existing);
    const server = await startServer(database);
    try {
      const { status, body } = await patchLead(server.url, staffSave(studioState({ discountTHB: 5000 }), catalog, existing));
      assert.equal(status, 200);
      const studioData = body["studioData"] as Row;
      assert.equal(((studioData[SERVER_PRICING_KEY]) as Row)["verifiedTotalTHB"], DISCOUNTED);
      assert.equal((studioData["notification"] as Row)["total"], DISCOUNTED, "the customer's quote page now shows the discounted total");
      assert.equal((studioData["notification"] as Row)["discountAmount"], 5000);
      assert.equal(((studioData["state"]) as Row)["discountTHB"], 5000);
      assert.deepEqual(leads[0]!["studioData"], studioData, "what is stored is what was answered");
    } finally {
      await server.close();
    }
  });

  it("does not let staff enter an arbitrary total: a forged estimate and notification are replaced by the server's number", async () => {
    const catalog = await fixtureCatalog();
    const existing = await customerLead();
    const { database } = createFakeDatabase(existing);
    const server = await startServer(database);
    try {
      const body = staffSave(studioState({ discountTHB: 5000 }), catalog, existing, { notification: { total: 100, subtotal: 100 }, total: 100 });
      (body.studioData["estimate"] as Row)["totalTHB"] = 100;
      const result = await patchLead(server.url, body);
      assert.equal(result.status, 200);
      const studioData = result.body["studioData"] as Row;
      assert.equal((studioData["estimate"] as Row)["totalTHB"], DISCOUNTED);
      assert.equal((studioData["notification"] as Row)["total"], DISCOUNTED);
      assert.equal(studioData["total"], DISCOUNTED);
      assert.equal((studioData[SERVER_PRICING_KEY] as Row)["verifiedTotalTHB"], DISCOUNTED);
    } finally {
      await server.close();
    }
  });

  it("ignores a serverPricing stamp sent in the request", async () => {
    const catalog = await fixtureCatalog();
    const existing = await customerLead();
    const { database } = createFakeDatabase(existing);
    const server = await startServer(database);
    try {
      const forged = { verifiedTotalTHB: 1, staffDiscountTHB: 99_999, verifiedAt: "2020-01-01T00:00:00.000Z" };
      const result = await patchLead(server.url, staffSave(studioState({ discountTHB: 5000 }), catalog, existing, { [SERVER_PRICING_KEY]: forged }));
      assert.equal(result.status, 200);
      const stamp = (result.body["studioData"] as Row)[SERVER_PRICING_KEY] as Row;
      assert.equal(stamp["verifiedTotalTHB"], DISCOUNTED);
      assert.equal(stamp["staffDiscountTHB"], 5000);
    } finally {
      await server.close();
    }
  });

  it("a forged stamp cannot be used to get around the QR check, even on a save that sets no discount", async () => {
    // No lever on this save, so nothing is repriced and the request's own serverPricing is the only thing that could
    // reach the database: it must be dropped, leaving the stamp the server wrote earlier -- and the edited total
    // (1 baht) must then be refused when the customer asks for a QR.
    const existing = await customerLead();
    const { database, leads } = createFakeDatabase(existing);
    const server = await startServer(database);
    try {
      const forged = { status: "quote_requested", notes: null, studioData: { notification: { total: 1 }, [SERVER_PRICING_KEY]: { verifiedTotalTHB: 1, verifiedAt: "2026-10-03T00:00:00.000Z" } } };
      const { status, body } = await patchLead(server.url, forged);
      assert.equal(status, 200);
      assert.equal(((body["studioData"] as Row)[SERVER_PRICING_KEY] as Row)["verifiedTotalTHB"], GROSS, "the stored stamp is still the one the server wrote");
    } finally {
      await server.close();
    }
    const customer = createFakeDatabase(leads[0]!);
    const customerServer = await startServer(customer.database);
    try {
      const qr = await requestQr(customerServer.url);
      assert.equal(qr.status, 400, "a 1-baht total that the server never priced gets no QR");
      assert.equal(qr.body["error"], "PRICE_VERIFICATION_FAILED");
      assert.equal("qrPayload" in qr.body, false);
    } finally {
      await customerServer.close();
    }
  });

  it("writes an audit row saying who gave the discount, from what total to what total", async () => {
    const catalog = await fixtureCatalog();
    const existing = await customerLead();
    const { database, audits } = createFakeDatabase(existing);
    const server = await startServer(database);
    try {
      const { status } = await patchLead(server.url, staffSave(studioState({ discountTHB: 5000 }), catalog, existing));
      assert.equal(status, 200);
      await waitForAudit(audits);
      assert.equal(audits.length, 1);
      const row = audits[0]!;
      assert.equal(row["action"], "lead.discount_applied");
      assert.equal(row["actorType"], "admin");
      assert.equal(row["actorName"], "เจ้าของระบบ (รหัสผ่าน)");
      assert.equal(row["targetId"], QUOTE_NUMBER);
      assert.equal(row["status"], "success");
      const details = row["details"] as Row;
      assert.equal(details["discountTHB"], 5000);
      assert.equal(details["previousDiscountTHB"], 0);
      assert.equal(details["previousTotal"], GROSS);
      assert.equal(details["newTotal"], DISCOUNTED);
      assert.equal(details["leadId"], 7);
    } finally {
      await server.close();
    }
  });

  it("audits a removed discount, and writes nothing when the same discount is saved again", async () => {
    const catalog = await fixtureCatalog();
    const existing = await customerLead();
    const { database, leads, audits } = createFakeDatabase(existing);
    const server = await startServer(database);
    try {
      const first = await patchLead(server.url, staffSave(studioState({ discountTHB: 5000 }), catalog, leads[0]!));
      assert.equal(first.status, 200);
      await waitForAudit(audits, 1);
      assert.equal(audits.length, 1);

      // the very same discount saved again: repriced, nothing new to report
      const again = await patchLead(server.url, staffSave(studioState({ discountTHB: 5000 }), catalog, leads[0]!));
      assert.equal(again.status, 200);
      await new Promise((resolve) => setTimeout(resolve, 80));
      assert.equal(audits.length, 1, "no second row for an unchanged discount");

      // the discount taken away: the quote goes back to 43,640 and the removal is on record
      const removed = await patchLead(server.url, staffSave(studioState({ discountTHB: 0 }), catalog, leads[0]!));
      assert.equal(removed.status, 200);
      assert.equal(((removed.body["studioData"] as Row)[SERVER_PRICING_KEY] as Row)["verifiedTotalTHB"], GROSS);
      assert.equal(((removed.body["studioData"] as Row)["notification"] as Row)["total"], GROSS);
      assert.equal(staffLeversFromStamp(removed.body["studioData"]), null);
      await waitForAudit(audits, 2);
      assert.equal(audits.length, 2);
      assert.equal(audits[1]?.["action"], "lead.discount_removed");
      const details = audits[1]?.["details"] as Row;
      assert.equal(details["previousDiscountTHB"], 5000);
      assert.equal(details["previousTotal"], DISCOUNTED);
      assert.equal(details["newTotal"], GROSS);
    } finally {
      await server.close();
    }
  });

  it("refuses a discount made through an API key", async () => {
    const catalog = await fixtureCatalog();
    const existing = await customerLead();
    const token = `kbw_${"a1".repeat(20)}`;
    const apiKeys = [{ id: 1, name: "automation", tokenHash: createHash("sha256").update(token).digest("hex"), scopes: ["leads:edit"], revokedAt: null, expiresAt: null }];
    const { database, leads, audits } = createFakeDatabase(existing, { apiKeys });
    const server = await startServer(database);
    try {
      const { status, body } = await patchLead(server.url, staffSave(studioState({ discountTHB: 5000 }), catalog, existing), { authorization: `Bearer ${token}` });
      assert.equal(status, 403);
      assert.equal(body["code"], "PRICING_REQUIRES_STAFF_LOGIN");
      assert.deepEqual(leads[0]!["studioData"], existing["studioData"], "nothing was saved");
      await waitForAudit(audits);
      assert.equal(audits[0]?.["action"], "lead.discount_rejected");
      assert.equal(audits[0]?.["actorName"], "API key: automation");
    } finally {
      await server.close();
    }
  });

  it("refuses a read-only role and an unauthenticated caller before any pricing happens", async () => {
    const catalog = await fixtureCatalog();
    const existing = await customerLead();
    const { database, leads } = createFakeDatabase(existing);
    const server = await startServer(database);
    try {
      const anonymous = await patchLead(server.url, staffSave(studioState({ discountTHB: 5000 }), catalog, existing), {});
      assert.equal(anonymous.status, 401);
      process.env["ADMIN_ROLE"] = "viewer";
      try {
        const viewer = await patchLead(server.url, staffSave(studioState({ discountTHB: 5000 }), catalog, existing));
        assert.equal(viewer.status, 403);
      } finally {
        delete process.env["ADMIN_ROLE"];
      }
      assert.deepEqual(leads[0]!["studioData"], existing["studioData"], "nothing was saved");
    } finally {
      await server.close();
    }
  });

  it("refuses a discount larger than the quote, saves nothing, and audits the refusal", async () => {
    const catalog = await fixtureCatalog();
    const existing = await customerLead();
    const { database, leads, audits } = createFakeDatabase(existing);
    const server = await startServer(database);
    try {
      const { status, body } = await patchLead(server.url, staffSave(studioState({ discountTHB: 50_000 }), catalog, existing));
      assert.equal(status, 400);
      assert.equal(body["error"], "STAFF_PRICING_INVALID");
      assert.deepEqual(leads[0]!["studioData"], existing["studioData"]);
      await waitForAudit(audits);
      assert.equal(audits[0]?.["action"], "lead.discount_rejected");
      assert.equal((audits[0]?.["details"] as Row)["reason"], "discount-invalid");
    } finally {
      await server.close();
    }
  });

  it("leaves every other edit alone: notes, staffDimensions and a plain layout save are not repriced", async () => {
    const existing = await customerLead();
    const { database, audits } = createFakeDatabase(existing);
    const queried: string[] = [];
    const watching = new Proxy(database, {
      get(target, property, receiver) {
        if (property !== "select") return Reflect.get(target, property, receiver);
        return (...args: unknown[]) => {
          const inner = (target as { select: (...a: unknown[]) => { from: (t: unknown) => unknown } }).select(...args);
          return new Proxy(inner, {
            get(innerTarget, innerProperty, innerReceiver) {
              if (innerProperty !== "from") return Reflect.get(innerTarget, innerProperty, innerReceiver);
              return (table: unknown) => {
                queried.push(tableNameOf(table));
                return innerTarget.from(table);
              };
            },
          });
        };
      },
    });
    const server = await startServer(watching);
    try {
      const notes = await patchLead(server.url, { status: "quote_requested", notes: "โทรกลับพรุ่งนี้" });
      assert.equal(notes.status, 200);
      const dims = await patchLead(server.url, { status: "quote_requested", notes: null, staffDimensions: { widthMm: 600, lengthMm: 1800, depthMm: 200 } });
      assert.equal(dims.status, 200);
      assert.deepEqual((dims.body["studioData"] as Row)["staffDimensions"], { widthMm: 600, lengthMm: 1800, depthMm: 200 });
      assert.equal((((dims.body["studioData"]) as Row)[SERVER_PRICING_KEY] as Row)["verifiedTotalTHB"], GROSS, "the customer's stamp is untouched");
      assert.equal(queried.filter((name) => name.endsWith("_prices")).length, 0, "no price table was read for an edit that does not touch pricing");
      assert.equal(audits.length, 0);
    } finally {
      await server.close();
    }
  });

  it("does not reprice a quote that is not a studio quote, whatever its state says", async () => {
    const catalog = await fixtureCatalog();
    const existing = await customerLead({ orderMode: "quick-purchase" });
    const { database, audits } = createFakeDatabase(existing);
    const server = await startServer(database);
    try {
      const { status, body } = await patchLead(server.url, staffSave(studioState({ discountTHB: 5000 }), catalog, existing));
      assert.equal(status, 200);
      assert.equal(((body["studioData"] as Row)[SERVER_PRICING_KEY] as Row)["staffDiscountTHB"], undefined, "no staff discount is stamped on a quick-purchase quote");
      assert.equal(audits.length, 0);
    } finally {
      await server.close();
    }
  });
});

// ================================================================================================================
// 3. The customer's side
// ================================================================================================================

describe("job-229: the customer opens a quote staff discounted", () => {
  it("builds the payment QR for the discounted total: full, 50% and 30%", async () => {
    const catalog = await fixtureCatalog();
    const existing = await customerLead();
    const staffDb = createFakeDatabase(existing);
    const staffServer = await startServer(staffDb.database);
    try {
      const saved = await patchLead(staffServer.url, staffSave(studioState({ discountTHB: 5000 }), catalog, existing));
      assert.equal(saved.status, 200);
    } finally {
      await staffServer.close();
    }

    // the customer comes back to the quote staff saved (the database now holds what the PATCH stored)
    const customerDb = createFakeDatabase(staffDb.leads[0]!);
    const customerServer = await startServer(customerDb.database);
    try {
      const full = await requestQr(customerServer.url, "full");
      assert.equal(full.status, 200);
      assert.equal(full.body["amountThb"], DISCOUNTED);
      assert.match(String(full.body["qrPayload"]), /38640\.00/);
      assert.equal((await requestQr(customerServer.url, "deposit_50")).body["amountThb"], 19_320);
      assert.equal((await requestQr(customerServer.url, "deposit_30")).body["amountThb"], 11_592); // 38,640 x 30% = 11,592
    } finally {
      await customerServer.close();
    }
  });

  it("keeps the discounted price after the catalog changes (the stamp, not today's prices, decides)", async () => {
    const catalog = await fixtureCatalog();
    const existing = await customerLead();
    const staffDb = createFakeDatabase(existing);
    const staffServer = await startServer(staffDb.database);
    try {
      await patchLead(staffServer.url, staffSave(studioState({ discountTHB: 5000 }), catalog, existing));
    } finally {
      await staffServer.close();
    }
    const raised = { installed_stone_prices: [{ id: 1, code: "TEST-ST1", name: "Stone TEST-ST1", tone: "light", imageUrl: null, galleryImageUrls: [], quoteImageUrl: null, slabImageUrl: null, aliases: [], active: true, sortOrder: 1, pricePerSqmTHB: 9000 }] };
    const base = createFakeDatabase(staffDb.leads[0]!);
    const customerServer = await startServer(withPricingCatalog(base.database, raised));
    try {
      const { status, body } = await requestQr(customerServer.url);
      assert.equal(status, 200);
      assert.equal(body["amountThb"], DISCOUNTED);
    } finally {
      await customerServer.close();
    }
  });

  it("a customer who types a discount is still refused, and cannot copy the staff stamp into their own quote", async () => {
    const catalog = await fixtureCatalog();
    const posting = createFakeDatabase(null);
    const server = await startServer(posting.database);
    try {
      const state = studioState({ discountTHB: 5000 });
      const stamp = { verifiedTotalTHB: DISCOUNTED, staffDiscountTHB: 5000, authorizedByMemberId: 5, verifiedAt: "2026-10-03T00:00:00.000Z" };
      const body = {
        leadKey: "lead-admin-discount-0002", status: "quote_requested", source: "studio", name: "คุณลูกค้า", phone: "0899999999", productSkus: [BASIN_25000], orderMode: "studio",
        studioData: { ...customerStudioData(state, catalog), [SERVER_PRICING_KEY]: stamp },
      };
      const response = await fetch(`${server.url}/api/leads`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      assert.equal(response.status, 400);
      assert.equal(((await response.json()) as Row)["error"], "PRICE_VERIFICATION_FAILED");
      assert.equal(posting.inserted.length, 0, "nothing was saved");
    } finally {
      await server.close();
    }
  });

  it("a customer's own re-save of a staff-discounted quote goes back to the standard price (their discount is 0)", async () => {
    const catalog = await fixtureCatalog();
    const existing = await customerLead();
    const staffDb = createFakeDatabase(existing);
    const staffServer = await startServer(staffDb.database);
    try {
      await patchLead(staffServer.url, staffSave(studioState({ discountTHB: 5000 }), catalog, existing));
    } finally {
      await staffServer.close();
    }
    const resaving = createFakeDatabase(staffDb.leads[0]!);
    const server = await startServer(resaving.database);
    try {
      const body = { leadKey: "lead-admin-discount-0001", status: "quote_requested", source: "studio", name: "คุณทดสอบ", phone: "0812345678", productSkus: [BASIN_25000], orderMode: "studio", studioData: customerStudioData(studioState(), catalog) };
      const response = await fetch(`${server.url}/api/leads`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      assert.equal(response.status, 200);
      const stamp = (resaving.inserted[0]?.["studioData"] as Row)[SERVER_PRICING_KEY] as Row;
      assert.equal(stamp["verifiedTotalTHB"], GROSS);
      assert.equal(stamp["staffDiscountTHB"], undefined);
    } finally {
      await server.close();
    }
  });

  it("a customer's autosave without a quote does not erase the quote (or the staff discount) already saved", async () => {
    // The storefront saves the lead again whenever the customer adds another product, with no studioData. That used to
    // set studio_data to NULL: the layout, the stamp and any staff discount were gone and the quote link answered 404.
    const catalog = await fixtureCatalog();
    const existing = await customerLead();
    const { database, conflictSets, inserted } = createFakeDatabase(existing);
    const server = await startServer(database);
    try {
      const autosave = { leadKey: "lead-admin-discount-0001", status: "selecting", source: "knight_support", productSkus: [BASIN_25000], orderMode: "studio", studioData: null };
      const response = await fetch(`${server.url}/api/leads`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(autosave) });
      assert.equal(response.status, 200);
      assert.equal("studioData" in conflictSets[0]!, false, "the update leaves studio_data alone");

      // a real new quote still replaces the old one
      const quote = { ...autosave, status: "quote_requested", name: "คุณทดสอบ", phone: "0812345678", studioData: customerStudioData(studioState(), catalog) };
      const replaced = await fetch(`${server.url}/api/leads`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(quote) });
      assert.equal(replaced.status, 200);
      assert.equal(((conflictSets[1]?.["studioData"] as Row)[SERVER_PRICING_KEY] as Row)["verifiedTotalTHB"], GROSS);
      assert.equal(inserted.length, 2);
    } finally {
      await server.close();
    }
  });

  it("customers without a discount are unaffected: an ordinary stamped quote still gets its QR", async () => {
    const existing = await customerLead();
    const { database } = createFakeDatabase(existing);
    const server = await startServer(database);
    try {
      const { status, body } = await requestQr(server.url);
      assert.equal(status, 200);
      assert.equal(body["amountThb"], GROSS);
    } finally {
      await server.close();
    }
  });
});
