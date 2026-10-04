// job-259: the figures of a hand-sketch request are the server's. studioData.sketchOrder (each piece's size, stone and basins,
// the order type, collect-at-factory) is priced again with the database catalogue by the same function the page used, and the
// result is what the saved lead, the sales message and the admin lead card all show.

import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import { fixtureBasinSku, FIXTURE_BASIN_ROWS, FIXTURE_SHEET_STONE_ROWS, pricingOnlyDatabase, withPricingCatalog } from "./price-guard-fixtures.ts";
import { importTypeScriptModule } from "./route-harness.ts";
import { STONE_COLORS, basinProductFromCatalog, stoneColorsFromCatalog } from "../../knight-basins/src/data/catalog.ts";
import { resolveSketchPiece, sketchOrderNotification, sketchOrderSnapshot, type SketchQuoteContext } from "../../knight-basins/src/data/sketch-order.ts";
import { loadPricingCatalog, priceSketchOrder, verifyAndSanitizeQuoteTotal, withSketchOrderPricing } from "../src/lib/price-integrity.ts";

type LeadsModule = typeof import("../src/routes/leads.ts");
type NotificationModule = typeof import("../src/lib/sales-notifications.ts");
type Row = Record<string, unknown>;

const originalEnv = {
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  NOTIFY_CHANNEL: process.env["NOTIFY_CHANNEL"],
  TELEGRAM_BOT_TOKEN: process.env["TELEGRAM_BOT_TOKEN"],
  TELEGRAM_SALES_CHAT_ID: process.env["TELEGRAM_SALES_CHAT_ID"],
};
const originalFetch = globalThis.fetch;

before(() => {
  process.env["DATABASE_URL"] = "postgres://sketch-order-server-pricing-test";
  process.env["SESSION_SECRET"] = "sketch-order-server-pricing-test-secret";
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});
after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

// Two installed colours (8,000 and the 9,500 patterned rate, both per m2 of length x depth) and the fixture basins.
const INSTALLED_ROWS = [
  { id: 1, code: "TEST-ST1", name: "Stone TEST-ST1", tone: "light", imageUrl: null, galleryImageUrls: [], quoteImageUrl: null, slabImageUrl: null, aliases: [], active: true, sortOrder: 1, pricePerSqmTHB: 8000 },
  { id: 2, code: "TEST-ST2", name: "Stone TEST-ST2", tone: "light", imageUrl: null, galleryImageUrls: [], quoteImageUrl: null, slabImageUrl: null, aliases: [], active: true, sortOrder: 2, pricePerSqmTHB: 9500 },
];
const TABLES = { installed_stone_prices: INSTALLED_ROWS };
const catalog = {
  products: FIXTURE_BASIN_ROWS.map((row) => basinProductFromCatalog(row as never)),
  stoneColors: stoneColorsFromCatalog(INSTALLED_ROWS as never, FIXTURE_SHEET_STONE_ROWS as never),
};

/** Runs the page's own calculation with the fixture catalogue (the installed rate is read from STONE_COLORS). */
function asThePage<T>(calculate: () => T): T {
  const previous = STONE_COLORS.slice();
  STONE_COLORS.splice(0, STONE_COLORS.length, ...catalog.stoneColors);
  try {
    return calculate();
  } finally {
    STONE_COLORS.splice(0, STONE_COLORS.length, ...previous);
  }
}

// The end-to-end case of the work order: two pieces, two colours, three basin sets spread over them, Bangkok, VAT.
//   A: 2000 x 1000 = 2.000 m2 x 8,000 = 16,000 + basin 15,000
//   B: 1500 x 1000 = 1.500 m2 x 9,500 = 14,250 + basins 20,000 + 25,000
//   area 3.5 m2 < 5 -> small-job fee 5,000 once; 3 basin sets -> installation 15,000 waived
//   subtotal 16,000 + 14,250 + 60,000 + 0 + 5,000 = 95,250 · VAT 7% 6,667.5 -> 6,668 · total 101,918
const pieces = [
  resolveSketchPiece({ key: "a", label: "ชิ้นงาน 1", lengthMm: 2000, depthMm: 1000, panels: [], basinCutouts: 1 }, { stoneCode: "TEST-ST1", basinSkus: [fixtureBasinSku(15000)] }),
  resolveSketchPiece({ key: "b", label: "ชิ้นงาน 2", lengthMm: 1500, depthMm: 1000, panels: [], basinCutouts: 2 }, { stoneCode: "TEST-ST2", basinSkus: [fixtureBasinSku(20000), fixtureBasinSku(25000)] }),
];
const context = (extra: Partial<SketchQuoteContext> = {}): SketchQuoteContext => ({ orderType: "fabrication", stoneColors: catalog.stoneColors, products: catalog.products, location: "bangkok-metro", vat: true, ...extra });

/** studioData as the page sends it: the order snapshot and the notification it built, next to the old single-stone estimate. */
function pageStudioData(extra: Partial<SketchQuoteContext> = {}) {
  return asThePage(() => {
    const notification = sketchOrderNotification(pieces, context(extra));
    return {
      mode: "sketch",
      sketchOrder: sketchOrderSnapshot(pieces, context(extra)),
      items: notification.items,
      notification,
      // what the single-stone studio estimate gave before: one colour over the whole area, a fee per piece
      estimate: { stoneAreaSqM: 3.5, counterAreaSqM: 3.5, stoneUnitPriceTHB: 8000, stoneTotalTHB: 28000, subtotalTHB: 30000, vatAmountTHB: 2100, totalTHB: 32100 },
    } as Record<string, unknown>;
  });
}

describe("job-259: the server prices a sketch order from sketchOrder, per piece, with the job's charges once", () => {
  it("(ง) end to end: page total = server total = 101,918 (worked out by hand above)", () => {
    const page = pageStudioData();
    assert.equal((page["sketchOrder"] as Row)["totalTHB"], 101918);
    assert.equal((page["notification"] as Row)["total"], 101918);
    const server = priceSketchOrder(page, catalog)!;
    assert.equal(server.quote.stoneTotalTHB, 16000 + 14250);
    assert.equal(server.quote.basinTotalTHB, 60000);
    assert.equal(server.quote.basinSets, 3);
    assert.equal(server.quote.installationTHB, 0);
    assert.equal(server.quote.installationDiscountTHB, 15000);
    assert.equal(server.quote.smallJobFeeTHB, 5000);
    assert.equal(server.quote.subtotalTHB, 95250);
    assert.equal(server.quote.vatTHB, 6668);
    assert.equal(server.quote.totalTHB, 101918);
  });

  it("(ง) every reader of the saved lead gets the same total: sketchOrder, notification, estimate and quoteTotalTHB", () => {
    const saved = withSketchOrderPricing(pageStudioData(), priceSketchOrder(pageStudioData(), catalog)!);
    assert.equal((saved["sketchOrder"] as Row)["totalTHB"], 101918);
    assert.equal(((saved["sketchOrder"] as Row)["totals"] as Row)["totalTHB"], 101918);
    assert.equal((saved["sketchOrder"] as Row)["pricedBy"], "server");
    assert.equal((saved["notification"] as Row)["total"], 101918);
    assert.equal((saved["notification"] as Row)["subtotal"], 95250);
    assert.equal((saved["notification"] as Row)["vatAmount"], 6668);
    const estimate = saved["estimate"] as Row;
    assert.equal(estimate["totalTHB"], 101918, "the single-stone 32,100 is gone");
    assert.equal(estimate["stoneAreaSqM"], 3.5);
    assert.equal(estimate["stoneUnitPriceTHB"], null, "two colours have no single rate");
    assert.equal(verifyAndSanitizeQuoteTotal(saved).verifiedTotal, 101918);
  });

  it("(ง) the client's own totals are not trusted: a tampered sketchOrder total and piece prices are priced again", () => {
    const tampered = pageStudioData();
    const order = tampered["sketchOrder"] as Row;
    order["totalTHB"] = 1;
    order["totals"] = { totalTHB: 1, smallJobFeeTHB: 0 };
    for (const piece of order["pieces"] as Row[]) piece["quote"] = { status: "ok", stoneTotalTHB: 1, lineTotalTHB: 1 };
    assert.equal(priceSketchOrder(tampered, catalog)!.quote.totalTHB, 101918);
  });

  it("(จ) collecting at the factory: no installation and no small-job fee on the server either", () => {
    const server = priceSketchOrder(pageStudioData({ pickup: true }), catalog)!;
    assert.equal(server.quote.pickup, true);
    assert.equal(server.quote.requestedInstallationTHB, 0);
    assert.equal(server.quote.smallJobFeeTHB, 0);
    assert.equal(server.quote.subtotalTHB, 90250);
    assert.equal(server.quote.totalTHB, 90250 + 6318);
  });

  it("no sketchOrder, or nothing priceable in it: nothing to price, and nothing throws", () => {
    assert.equal(priceSketchOrder({}, catalog), null);
    assert.equal(priceSketchOrder(null, catalog), null);
    assert.equal(priceSketchOrder({ sketchOrder: { pieces: [{ label: "x", lengthMm: 1000, depthMm: 600, stoneCode: null, cutouts: [] }] } }, catalog), null);
    assert.doesNotThrow(() => priceSketchOrder({ sketchOrder: { pieces: "nope" } }, catalog));
  });

  it("reads the catalogue from the database through the same loader as the price guard", async () => {
    const loaded = await loadPricingCatalog(pricingOnlyDatabase(TABLES));
    assert.equal(priceSketchOrder(pageStudioData(), loaded)!.quote.totalTHB, 101918);
  });
});

// ---- the route and the sales message ---------------------------------------------------------------------------------

function createRouteDatabase(tables: Record<string, unknown> = TABLES) {
  const saved: Row[] = [];
  const base = {
    execute: async () => ({ rows: [{ last_value: 1 }] }),
    select: () => {
      const builder = { from: () => builder, where: () => builder, limit: async () => [] };
      return builder;
    },
    insert: (table: unknown) => {
      const isAudit = String((table as Record<symbol, unknown>)[Symbol.for("drizzle:Name")]) === "system_audit_logs";
      let values: Row = {};
      const builder = {
        values(next: Row) {
          values = next;
          return isAudit ? Promise.resolve() : builder;
        },
        onConflictDoUpdate() {
          return builder;
        },
        returning: async () => {
          saved.push(values);
          return [{ id: saved.length, createdAt: new Date(), ...values }];
        },
      };
      return builder;
    },
  };
  return { database: withPricingCatalog(base, tables as never), saved };
}

async function startRoute(database: unknown) {
  const routeModule = await importTypeScriptModule<LeadsModule>("src/routes/leads.ts");
  const app = express();
  app.use(express.json());
  app.use("/api", routeModule.createLeadsRouter(database as never));
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ message: "Internal server error" });
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server has no TCP address");
  return { url: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))) };
}

async function postSketch(database: unknown, studioData: Row) {
  const uploadDirectory = await mkdtemp(path.join(os.tmpdir(), "sketch-order-pricing-"));
  const originalUploadDirectory = process.env["UPLOAD_DIR"];
  process.env["UPLOAD_DIR"] = uploadDirectory;
  delete process.env["NOTIFY_CHANNEL"];
  const server = await startRoute(database);
  try {
    const formData = new FormData();
    formData.append("metadata", JSON.stringify({
      leadKey: "lead-sketch-pricing",
      status: "new_lead",
      source: "hand_sketch",
      name: "คุณทดสอบ",
      phone: "0812345678",
      project: "บ้านทดสอบ",
      productSkus: [],
      orderMode: "sketch",
      studioData,
    }));
    formData.append("file", new Blob([Buffer.from("89504e470d0a1a0a", "hex")], { type: "image/png" }), "sketch.png");
    const response = await fetch(`${server.url}/api/leads/sketch`, { method: "POST", body: formData });
    return response.status;
  } finally {
    await server.close();
    await rm(uploadDirectory, { force: true, recursive: true });
    if (originalUploadDirectory === undefined) delete process.env["UPLOAD_DIR"];
    else process.env["UPLOAD_DIR"] = originalUploadDirectory;
  }
}

describe("job-259: POST /api/leads/sketch saves the server's figures", () => {
  it("(ง) the saved lead carries 101,918 in sketchOrder, notification and estimate, not the page's single-stone 32,100", async () => {
    const { database, saved } = createRouteDatabase();
    const warn = console.warn;
    console.warn = () => {};
    try {
      assert.ok((await postSketch(database, pageStudioData())) < 300);
    } finally {
      console.warn = warn;
    }
    assert.equal(saved.length, 1);
    const studioData = saved[0]!["studioData"] as Row;
    assert.equal((studioData["sketchOrder"] as Row)["pricedBy"], "server");
    assert.equal((studioData["sketchOrder"] as Row)["totalTHB"], 101918);
    assert.equal((studioData["notification"] as Row)["total"], 101918);
    assert.equal((studioData["estimate"] as Row)["totalTHB"], 101918);
    assert.ok(Array.isArray(studioData["sketchUrls"]));
  });

  it("a request whose page total was tampered with is still saved with the server's figure", async () => {
    const { database, saved } = createRouteDatabase();
    const tampered = pageStudioData();
    (tampered["sketchOrder"] as Row)["totalTHB"] = 1;
    (tampered["notification"] as Row)["total"] = 1;
    const warnings: unknown[][] = [];
    const warn = console.warn;
    console.warn = (...args: unknown[]) => { warnings.push(args); };
    try {
      assert.ok((await postSketch(database, tampered)) < 300);
    } finally {
      console.warn = warn;
    }
    assert.equal(((saved[0]!["studioData"] as Row)["notification"] as Row)["total"], 101918);
    assert.ok(warnings.some((args) => String(args[0]).includes("differs from the page")));
  });

  it("if the catalogue cannot be read, the request is still saved as the page sent it", async () => {
    const { database, saved } = createRouteDatabase({ installed_stone_prices: null });
    const broken = new Proxy(database, {
      get(target, property, receiver) {
        if (property !== "select") return Reflect.get(target, property, receiver);
        return () => ({ from: () => ({ where: () => ({ orderBy: () => Promise.reject(new Error("catalogue down")) }) }) });
      },
    });
    const warn = console.warn;
    console.warn = () => {};
    try {
      assert.ok((await postSketch(broken, pageStudioData())) < 300);
    } finally {
      console.warn = warn;
    }
    assert.equal(((saved[0]!["studioData"] as Row)["notification"] as Row)["total"], 101918, "the page's own (job-level) figure");
  });

  it("(ง) the sales message shows the same total and how the job was priced, with the small-job fee once", async () => {
    const studioData = withSketchOrderPricing(pageStudioData(), priceSketchOrder(pageStudioData(), catalog)!);
    process.env["NOTIFY_CHANNEL"] = "telegram";
    process.env["TELEGRAM_BOT_TOKEN"] = "test-token";
    process.env["TELEGRAM_SALES_CHAT_ID"] = "test-chat";
    let body = "";
    globalThis.fetch = async (_input, init) => {
      body = String(init?.body ?? "");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const notifications = await importTypeScriptModule<NotificationModule>("src/lib/sales-notifications.ts");
    const result = await notifications.notifySketch({ name: "คุณทดสอบ", phone: "0812345678", project: "บ้านทดสอบ", productSkus: [], quoteNumber: null, orderMode: "sketch", studioData, sketchUrl: "/api/uploads/sketch.png" }, "https://example.com");
    assert.equal(result.notificationStatus, "notified");
    const text = (JSON.parse(body) as { caption?: string }).caption ?? "";
    assert.match(text, /ยอดรวมสุทธิ: 101,918 บาท/);
    assert.match(text, /ยอดก่อน VAT: 95,250 บาท/);
    assert.match(text, /วิธีคำนวณ \(รวมทั้งงาน\):/);
    assert.match(text, /ชิ้นงาน 1: หิน TEST-ST1 2 ตร\.ม\. × ฿8,000 = ฿16,000/);
    assert.match(text, /ชิ้นงาน 2: หิน TEST-ST2 1\.5 ตร\.ม\. × ฿9,500 = ฿14,250/);
    assert.match(text, /ค่าติดตั้งอ่าง 3 ชุด = ฟรี \(3 ชุดขึ้นไป\)/);
    assert.equal(text.match(/ค่าดำเนินการงานพื้นที่เล็ก \(รวมทั้งงาน/g)?.length, 1);
    assert.doesNotMatch(text, /32,100/);
  });

  it("(จ) a collect-at-factory order says so in the message and lists no service charge", async () => {
    const studioData = withSketchOrderPricing(pageStudioData({ pickup: true }), priceSketchOrder(pageStudioData({ pickup: true }), catalog)!);
    process.env["NOTIFY_CHANNEL"] = "telegram";
    process.env["TELEGRAM_BOT_TOKEN"] = "test-token";
    process.env["TELEGRAM_SALES_CHAT_ID"] = "test-chat";
    let body = "";
    globalThis.fetch = async (_input, init) => {
      body = String(init?.body ?? "");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const notifications = await importTypeScriptModule<NotificationModule>("src/lib/sales-notifications.ts");
    await notifications.notifySketch({ name: "คุณทดสอบ", phone: "0812345678", project: "บ้านทดสอบ", productSkus: [], quoteNumber: null, orderMode: "sketch", studioData, sketchUrl: "/api/uploads/sketch.png" }, "https://example.com");
    const text = (JSON.parse(body) as { caption?: string }).caption ?? "";
    assert.match(text, /ลูกค้ามารับเองที่โรงงาน — ไม่คิดค่าดำเนินการติดตั้ง/);
    assert.doesNotMatch(text, /ค่าติดตั้งอ่าง|ค่าดำเนินการงานพื้นที่เล็ก/);
    assert.match(text, /ยอดรวมสุทธิ: 96,568 บาท/);
  });
});
