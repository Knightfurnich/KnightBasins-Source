import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import { STONE_COLORS, basinProductFromCatalog } from "../../knight-basins/src/data/catalog.ts";
import { createBasinPlacement, studioEstimate, type StudioState } from "../../knight-basins/src/data/studio-model.ts";
import { SERVER_PRICING_KEY, loadPricingCatalog, type PricingCatalog } from "../src/lib/price-integrity.ts";
import { FIXTURE_BASIN_ROWS, fixtureBasinSku, pricingOnlyDatabase, quickPurchaseData, withPricingCatalog } from "./price-guard-fixtures.ts";
import { importTypeScriptModule } from "./route-harness.ts";

// job-231: POST /api/leads refuses a request for a quotation that says nothing about what is being quoted. Before the
// guard, `status: "quote_requested"` with no studioData was saved and given a quote number, so a bot could post bare
// requests and fill the lead list. The refusal is 400 STUDIO_DATA_REQUIRED and nothing is saved.
//
// The storefront's own autosave (new_lead / selecting) goes out with orderMode "quick-purchase" and no studioData; the
// "does not touch ..." tests below pin that it keeps working. A hand-drawn sketch is described by its picture instead.

type LeadRouteModule = typeof import("../src/routes/leads.ts");
type Row = Record<string, unknown>;

const REFUSED_BODY = {
  error: "STUDIO_DATA_REQUIRED",
  message: "คำขอใบเสนอราคาต้องแนบข้อมูลผังเคาน์เตอร์หรือรายการสินค้าที่เลือก",
};

function tableNameOf(table: unknown): string {
  return String((table as Record<symbol, unknown>)[Symbol.for("drizzle:Name")]);
}

/** Fake database: inserts into customer_leads are recorded in `saved`, audit rows in `audits`; the pricing tables come from withPricingCatalog. */
function createFakeDatabase() {
  const saved: Row[] = [];
  const audits: Row[] = [];
  const base = {
    select: () => {
      const builder = { from: () => builder, where: () => builder, limit: async () => [] as Row[] };
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
        onConflictDoUpdate: () => builder,
        returning: async () => {
          saved.push(values);
          return [{ id: saved.length, ...values }];
        },
      };
      return builder;
    },
  };
  return { database: withPricingCatalog(base), saved, audits };
}

async function waitForAudit(audits: Row[]) {
  for (let attempt = 0; attempt < 50 && audits.length === 0; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 10));
}

const originalEnv = { DATABASE_URL: process.env["DATABASE_URL"], SESSION_SECRET: process.env["SESSION_SECRET"] };
let catalog: PricingCatalog;

before(async () => {
  process.env["DATABASE_URL"] = "postgres://lead-spam-guard-test";
  process.env["SESSION_SECRET"] = "lead-spam-guard-test-secret";
  catalog = await loadPricingCatalog(pricingOnlyDatabase());
});

after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function startRoute(database: unknown) {
  // a fresh copy of the route per test: the route's rate limiter (30 requests a minute per address) lives in the module
  const routeModule = await importTypeScriptModule<LeadRouteModule>("src/routes/leads.ts");
  const app = express();
  app.use(express.json());
  app.use("/api", routeModule.createLeadsRouter(database as never));
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

async function postLead(url: string, body: Row) {
  const response = await fetch(`${url}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, body: (await response.json()) as Row };
}

/** Runs `run` against a fresh route and fake database, and always closes the server. */
async function withRoute<T>(run: (ctx: { url: string; saved: Row[]; audits: Row[] }) => Promise<T>): Promise<T> {
  const { database, saved, audits } = createFakeDatabase();
  const server = await startRoute(database);
  try {
    return await run({ url: server.url, saved, audits });
  } finally {
    await server.close();
  }
}

function leadBody(overrides: Row = {}) {
  return {
    leadKey: "lead-spam-guard-0001",
    status: "quote_requested",
    source: "quote_builder",
    name: "คุณทดสอบ",
    phone: "0812345678",
    productSkus: [fixtureBasinSku(25000)],
    orderMode: "quick-purchase",
    studioData: quickPurchaseData(60990),
    ...overrides,
  };
}

/** The same request without the studioData key at all, as a bot that skips it would send it. */
function withoutStudioData(overrides: Row = {}) {
  const { studioData: _omitted, ...rest } = leadBody(overrides);
  return rest;
}

async function assertRefused(url: string, saved: Row[], body: Row, label: string) {
  const result = await postLead(url, body);
  assert.equal(result.status, 400, label);
  assert.deepEqual(result.body, REFUSED_BODY, label);
  assert.equal("quoteNumber" in result.body, false, `${label}: no quote number in the answer`);
  assert.equal("publicQuoteToken" in result.body, false, `${label}: no quote link in the answer`);
  assert.equal(saved.length, 0, `${label}: nothing is written to the database`);
}

// ---- an honest studio quote, worked out by hand (the same board as server-price-guard-promptpay.test.ts) -----------------
//   stone 1.8 m x 0.6 m = 1.08 m2 x 8,000 = 8,640 + basin 25,000 + install 5,000 + small-job minimum 5,000 = 43,640

const RECTANGLE = { id: "piece-1-1", widthMm: 1800, lengthMm: 600, xMm: 0, yMm: 0, rotation: 0 as const, label: "A" };

function studioPayload() {
  const piece = { id: "piece-1", name: "Piece 1", rectangles: [{ ...RECTANGLE }], sideStatuses: {} };
  const placement = createBasinPlacement(basinProductFromCatalog(FIXTURE_BASIN_ROWS.find((row) => row.sku === fixtureBasinSku(25000))!), 0, piece.id, RECTANGLE.id);
  const state = {
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
    basinSkus: [placement.sku],
    basinPlacements: [placement],
  } as unknown as StudioState;
  const previous = STONE_COLORS.slice();
  STONE_COLORS.splice(0, STONE_COLORS.length, ...catalog.stoneColors);
  try {
    const estimate = studioEstimate(state, catalog.products);
    return { state, estimate, notification: { total: estimate.totalTHB } };
  } finally {
    STONE_COLORS.splice(0, STONE_COLORS.length, ...previous);
  }
}

describe("job-231: a quotation request without studioData is refused", () => {
  it("refuses quote_requested with no studioData key: 400 STUDIO_DATA_REQUIRED, no row, no quote number", async () => {
    await withRoute(async ({ url, saved }) => {
      await assertRefused(url, saved, withoutStudioData(), "key missing");
    });
  });

  it("refuses studioData that is null, an empty object, or holds only the server's own key", async () => {
    await withRoute(async ({ url, saved }) => {
      await assertRefused(url, saved, leadBody({ studioData: null }), "null");
      await assertRefused(url, saved, leadBody({ studioData: {} }), "empty object");
      // serverPricing belongs to the server (a client-supplied one is dropped), so it is not data about the quote
      await assertRefused(url, saved, leadBody({ studioData: { [SERVER_PRICING_KEY]: { verifiedTotalTHB: 1, verifiedAt: "2026-10-03T00:00:00.000Z" } } }), "only serverPricing");
    });
  });

  it("refuses whatever orderMode the request names, including none and sketch without a picture", async () => {
    await withRoute(async ({ url, saved }) => {
      for (const orderMode of ["studio", "quick-purchase", "sketch", undefined]) {
        await assertRefused(url, saved, withoutStudioData({ orderMode }), `orderMode ${String(orderMode)}`);
      }
      // a sketch with an empty or blank sketchUrl has no picture either
      for (const sketchUrl of ["", "   ", null]) {
        await assertRefused(url, saved, withoutStudioData({ orderMode: "sketch", sketchUrl }), `sketchUrl ${JSON.stringify(sketchUrl)}`);
      }
    });
  });

  it("refuses a request that supplies a quote number of its own without studioData, whatever its status", async () => {
    await withRoute(async ({ url, saved }) => {
      // otherwise the bot only has to say "selecting" and name a quote number to get one stored with a quote link
      for (const status of ["new_lead", "selecting", "closed"]) {
        await assertRefused(url, saved, withoutStudioData({ status, quoteNumber: "Oct 26 / US / 111111" }), `status ${status}`);
      }
      await assertRefused(url, saved, withoutStudioData({ status: "selecting", quoteNumber: "   " }), "blank quote number");
    });
  });

  it("answers a bare burst the same way every time and stores nothing", async () => {
    await withRoute(async ({ url, saved }) => {
      for (let index = 0; index < 25; index += 1) {
        await assertRefused(url, saved, withoutStudioData({ leadKey: `lead-bot-burst-${String(index).padStart(4, "0")}` }), `request ${index}`);
      }
    });
  });

  it("records the refusal in the audit trail without the sender's contact details", async () => {
    await withRoute(async ({ url, audits }) => {
      await postLead(url, withoutStudioData({ orderMode: "studio" }));
      await waitForAudit(audits);
      assert.equal(audits.length, 1);
      const row = audits[0]!;
      assert.equal(row["action"], "lead.upsert");
      assert.equal(row["status"], "error");
      assert.equal(row["errorCode"], "STUDIO_DATA_REQUIRED");
      assert.equal(row["targetId"], "lead-spam-guard-0001");
      assert.deepEqual(row["details"], { leadKey: "lead-spam-guard-0001", status: "quote_requested", orderMode: "studio", source: "quote_builder" });
      assert.ok(!JSON.stringify(row).includes("0812345678"), "the phone number is not written to the audit row");
      assert.ok(!JSON.stringify(row).includes("คุณทดสอบ"), "the name is not written to the audit row");
    });
  });
});

describe("job-231: a quotation request with studioData is saved as before", () => {
  it("accepts an honest quick-purchase quote and issues a quote number and link", async () => {
    await withRoute(async ({ url, saved }) => {
      const { status, body } = await postLead(url, leadBody());
      assert.equal(status, 200);
      assert.equal(typeof body["quoteNumber"], "string");
      assert.ok(String(body["quoteNumber"]).length > 0);
      assert.equal(typeof body["publicQuoteToken"], "string");
      assert.equal(saved.length, 1);
      assert.equal((saved[0]!["studioData"] as Row)["total"], 60990);
    });
  });

  it("accepts an honest studio quote (43,640) and issues a quote number and link", async () => {
    await withRoute(async ({ url, saved }) => {
      const payload = studioPayload();
      assert.equal(payload.estimate.totalTHB, 43_640, "the hand-calculated total");
      const { status, body } = await postLead(url, leadBody({ orderMode: "studio", source: "studio", studioData: payload }));
      assert.equal(status, 200);
      assert.equal(typeof body["quoteNumber"], "string");
      assert.equal(typeof body["publicQuoteToken"], "string");
      assert.equal(saved.length, 1);
      assert.equal(((saved[0]!["studioData"] as Row)[SERVER_PRICING_KEY] as Row)["verifiedTotalTHB"], 43_640);
    });
  });

  it("accepts a quote number the client supplies when the quote itself comes with studioData", async () => {
    await withRoute(async ({ url, saved }) => {
      const { status, body } = await postLead(url, leadBody({ status: "selecting", quoteNumber: "Oct 26 / US / 222222" }));
      assert.equal(status, 200);
      assert.equal(body["quoteNumber"], "Oct 26 / US / 222222");
      assert.equal(saved.length, 1);
    });
  });
});

describe("job-231: does not touch the requests that carry no quotation", () => {
  it("keeps the storefront autosave working: new_lead and selecting, orderMode quick-purchase, studioData null or missing", async () => {
    await withRoute(async ({ url, saved }) => {
      let count = 0;
      for (const status of ["new_lead", "selecting"]) {
        for (const orderMode of ["quick-purchase", "studio", "sketch", undefined]) {
          for (const studioData of [null, undefined, {}]) {
            count += 1;
            const body = leadBody({ leadKey: `lead-autosave-${String(count).padStart(4, "0")}`, status, orderMode, studioData });
            const { status: code, body: answer } = await postLead(url, body);
            assert.equal(code, 200, `${status} / ${String(orderMode)} / ${JSON.stringify(studioData)}`);
            assert.equal(answer["quoteNumber"] ?? null, null, "an autosave never gets a quote number");
          }
        }
      }
      assert.equal(saved.length, count);
    });
  });

  it("still accepts a hand-drawn sketch with a picture and no studioData", async () => {
    await withRoute(async ({ url, saved }) => {
      const sketch = { orderMode: "sketch", source: "sketch", sketchUrl: "/uploads/sketch-1.jpg", productSkus: [], studioData: undefined };
      const asked = await postLead(url, withoutStudioData({ ...sketch, leadKey: "lead-sketch-quote-0001" }));
      assert.equal(asked.status, 200, "sketch asking for a quotation");
      assert.equal(typeof asked.body["quoteNumber"], "string");
      const saving = await postLead(url, withoutStudioData({ ...sketch, leadKey: "lead-sketch-draft-0001", status: "new_lead" }));
      assert.equal(saving.status, 200, "sketch saved as a draft");
      assert.equal(saved.length, 2);
      assert.equal(saved[0]!["sketchUrl"], "/uploads/sketch-1.jpg");
    });
  });

  it("does not change the other refusals: a tampered total is still PRICE_VERIFICATION_FAILED, a malformed body still 400 invalid", async () => {
    await withRoute(async ({ url, saved }) => {
      const tampered = await postLead(url, leadBody({ studioData: quickPurchaseData(60990, { total: 100, subtotal: 100 }) }));
      assert.equal(tampered.status, 400);
      assert.equal(tampered.body["error"], "PRICE_VERIFICATION_FAILED");
      const malformed = await postLead(url, { status: "quote_requested" });
      assert.equal(malformed.status, 400);
      assert.notEqual(malformed.body["error"], "STUDIO_DATA_REQUIRED");
      assert.equal(saved.length, 0);
    });
  });
});
