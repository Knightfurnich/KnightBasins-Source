import assert from "node:assert/strict";
import { after, afterEach, before, describe, it, mock } from "node:test";
import express from "express";
import { importTypeScriptModule } from "./route-harness.ts";

type PortfolioRouteModule = typeof import("../src/routes/portfolio.ts");

type StoredLead = Record<string, unknown> & { id: number };

function createFakeDatabase() {
  const records: StoredLead[] = [];
  const database = {
    insert: () => {
      let values: Record<string, unknown>;
      const builder = {
        values(next: Record<string, unknown>) {
          values = next;
          return builder;
        },
        returning: async () => {
          const saved = { ...values, id: records.length + 1 } as StoredLead;
          records.push(saved);
          return [saved];
        },
      };
      return builder;
    },
    records,
  };
  return database;
}

async function startPortfolioInquiryRoute(database: unknown) {
  const routeModule = await importTypeScriptModule<PortfolioRouteModule>("src/routes/portfolio.ts");
  const app = express();
  app.use(express.json());
  app.use("/api", routeModule.createPortfolioInquiryRouter(database as never));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ message: error instanceof Error ? error.message : "Internal server error" });
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Portfolio inquiry route test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

const originalEnv = {
  TELEGRAM_BOT_TOKEN: process.env["TELEGRAM_BOT_TOKEN"],
  TELEGRAM_SALES_CHAT_ID: process.env["TELEGRAM_SALES_CHAT_ID"],
};

before(() => {
  // No Telegram credentials configured in this test environment -- the route
  // must treat that as "skip the alert" and never attempt a real network
  // call, matching the established pattern in sales-notifications.ts.
  delete process.env["TELEGRAM_BOT_TOKEN"];
  delete process.env["TELEGRAM_SALES_CHAT_ID"];
});

after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

afterEach(() => {
  mock.restoreAll();
});

describe("POST /api/public/portfolio/inquiry", () => {
  it("saves a new lead and returns 201 with a success message", async () => {
    const database = createFakeDatabase();
    const server = await startPortfolioInquiryRoute(database);

    try {
      const response = await fetch(`${server.url}/api/public/portfolio/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId: "bathroom-012",
          photoTitle: "อ่างล้างหน้าหินขัดลายหินอ่อน",
          photoUrl: "/api/uploads/portfolio/bathroom/bathroom-012.jpg",
          phone: "0812345678",
          name: "คุณทดสอบ",
          notes: "สนใจแบบเดียวกันที่คอนโด",
        }),
      });
      const body = await response.json() as Record<string, unknown>;

      assert.equal(response.status, 201);
      assert.equal(body["success"], true);
      assert.equal(typeof body["message"], "string");
      assert.ok((body["message"] as string).length > 0);
      assert.equal(body["leadId"], 1);

      assert.equal(database.records.length, 1);
      const saved = database.records[0]!;
      assert.equal(saved["phone"], "0812345678");
      assert.equal(saved["source"], "portfolio");
      assert.equal(saved["orderMode"], "quick-purchase");
      assert.equal(saved["status"], "new");
      assert.equal(saved["sketchUrl"], "/api/uploads/portfolio/bathroom/bathroom-012.jpg");
      assert.equal(typeof saved["leadKey"], "string");
      assert.ok((saved["leadKey"] as string).length > 0);
      assert.match(saved["notes"] as string, /bathroom-012/);
      assert.match(saved["notes"] as string, /สนใจแบบเดียวกันที่คอนโด/);
    } finally {
      await server.close();
    }
  });

  it("falls back to a generic name and still saves the lead when name is omitted", async () => {
    const database = createFakeDatabase();
    const server = await startPortfolioInquiryRoute(database);

    try {
      const response = await fetch(`${server.url}/api/public/portfolio/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId: "kitchen-004",
          photoTitle: "เคาน์เตอร์ครัวหินควอทซ์",
          photoUrl: "/api/uploads/portfolio/kitchen/kitchen-004.jpg",
          phone: "0898765432",
        }),
      });

      assert.equal(response.status, 201);
      assert.equal(database.records[0]?.["name"], "ลูกค้าสนใจสั่งผลิตจากภาพผลงาน");
    } finally {
      await server.close();
    }
  });

  it("rejects an empty or too-short phone number with 400", async () => {
    const database = createFakeDatabase();
    const server = await startPortfolioInquiryRoute(database);

    try {
      const response = await fetch(`${server.url}/api/public/portfolio/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId: "bathroom-012",
          photoTitle: "อ่างล้างหน้าหินขัดลายหินอ่อน",
          photoUrl: "/api/uploads/portfolio/bathroom/bathroom-012.jpg",
          phone: "081234",
        }),
      });
      const body = await response.json() as Record<string, unknown>;

      assert.equal(response.status, 400);
      assert.equal(body["message"], "กรุณาระบุเบอร์โทรศัพท์ที่ติดต่อได้");
      assert.equal(database.records.length, 0);
    } finally {
      await server.close();
    }
  });

  it("rejects a missing photoId with 400", async () => {
    const database = createFakeDatabase();
    const server = await startPortfolioInquiryRoute(database);

    try {
      const response = await fetch(`${server.url}/api/public/portfolio/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoTitle: "อ่างล้างหน้าหินขัดลายหินอ่อน",
          photoUrl: "/api/uploads/portfolio/bathroom/bathroom-012.jpg",
          phone: "0812345678",
        }),
      });

      assert.equal(response.status, 400);
      assert.equal(database.records.length, 0);
    } finally {
      await server.close();
    }
  });

  it("sends a Telegram alert card when credentials are configured", async () => {
    process.env["TELEGRAM_BOT_TOKEN"] = "test-token";
    process.env["TELEGRAM_SALES_CHAT_ID"] = "-1004361494281";
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const realFetch = globalThis.fetch;
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.includes("api.telegram.org")) return realFetch(input as never, init);
      calls.push({ url, body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const database = createFakeDatabase();
    const server = await startPortfolioInquiryRoute(database);

    try {
      const response = await fetch(`${server.url}/api/public/portfolio/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId: "bathroom-012",
          photoTitle: "อ่างล้างหน้าหินขัดลายหินอ่อน",
          photoUrl: "/api/uploads/portfolio/bathroom/bathroom-012.jpg",
          phone: "0812345678",
          name: "คุณทดสอบ",
          notes: "สนใจแบบเดียวกันที่คอนโด",
        }),
      });

      assert.equal(response.status, 201);
      assert.equal(calls.length, 1);
      assert.match(calls[0]!.url, /^https:\/\/api\.telegram\.org\/bottest-token\/sendMessage$/);
      assert.equal(calls[0]!.body["chat_id"], "-1004361494281");
      const text = calls[0]!.body["text"] as string;
      assert.match(text, /มีลูกค้าสนใจสั่งผลิตจากภาพผลงานจริง/);
      assert.match(text, /bathroom-012/);
      assert.match(text, /0812345678/);
      assert.match(text, /ระบบ Knight Basins Portfolio Lead Engine/);
      assert.equal((text.match(/━━━━━━━━━━━━━━━━━━━/g) ?? []).length, 2);
    } finally {
      await server.close();
      delete process.env["TELEGRAM_BOT_TOKEN"];
      delete process.env["TELEGRAM_SALES_CHAT_ID"];
    }
  });
});
