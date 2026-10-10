import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import cookieParser from "cookie-parser";
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

async function startRouter(
  database: unknown,
  options?: Parameters<PortfolioRouteModule["createPortfolioInquiryRouter"]>[1],
  withCookieParser = false,
) {
  const routeModule = await importTypeScriptModule<PortfolioRouteModule>("src/routes/portfolio.ts");
  const app = express();
  app.use(express.json());
  if (withCookieParser) app.use(cookieParser());
  app.use("/api", routeModule.createPortfolioInquiryRouter(database as never, options));
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
    throw new Error("Portfolio inquiry identity test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

const inquiryBody = {
  photoId: "bathroom-077",
  photoTitle: "อ่างล้างหน้าหินขัด",
  photoUrl: "/api/uploads/portfolio/bathroom/bathroom-077.jpg",
  source: "portfolio",
  phone: "0812345678",
  name: "คุณทดสอบ",
  notes: "คอนโดสุขุมวิท",
};

const originalEnv = {
  TELEGRAM_BOT_TOKEN: process.env["TELEGRAM_BOT_TOKEN"],
  TELEGRAM_SALES_CHAT_ID: process.env["TELEGRAM_SALES_CHAT_ID"],
};

before(() => {
  delete process.env["TELEGRAM_BOT_TOKEN"];
  delete process.env["TELEGRAM_SALES_CHAT_ID"];
});

after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("POST /api/public/portfolio/inquiry binds identity from the session only (job 414-B C)", () => {
  it("writes customerAccountId when the visitor has a verified LINE session", async () => {
    const database = createFakeDatabase();
    const seenCookies: Array<string | undefined> = [];
    const server = await startRouter(database, {
      resolveLineAccountId: async (req) => {
        seenCookies.push(req.cookies?.["knight_line_session"]);
        return 412;
      },
    }, true);

    try {
      const response = await fetch(`${server.url}/api/public/portfolio/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: "knight_line_session=session-token-under-test" },
        body: JSON.stringify(inquiryBody),
      });

      assert.equal(response.status, 201);
      assert.equal(database.records.length, 1);
      assert.equal(database.records[0]?.["customerAccountId"], 412);
      assert.deepEqual(seenCookies, ["session-token-under-test"], "the resolver must read the session cookie, not the body");
    } finally {
      await server.close();
    }
  });

  it("leaves the lead unbound for an anonymous visitor", async () => {
    const database = createFakeDatabase();
    const server = await startRouter(database, { resolveLineAccountId: async () => null });

    try {
      const response = await fetch(`${server.url}/api/public/portfolio/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inquiryBody),
      });

      assert.equal(response.status, 201);
      assert.equal(database.records[0]?.["customerAccountId"], null);
    } finally {
      await server.close();
    }
  });

  it("ignores any identity the client tries to send in the body", async () => {
    const database = createFakeDatabase();
    let resolverCalls = 0;
    const server = await startRouter(database, {
      resolveLineAccountId: async () => {
        resolverCalls += 1;
        return null; // no session, however the visitor claims otherwise
      },
    });

    try {
      const response = await fetch(`${server.url}/api/public/portfolio/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...inquiryBody,
          customerAccountId: 999,
          accountId: 999,
          userId: "U-somebody-elses-account",
          lineUserId: "U-somebody-elses-account",
          displayName: "คนที่ไม่ใช่ผม",
        }),
      });
      assert.equal(response.status, 201);

      const saved = database.records[0]!;
      assert.equal(saved["customerAccountId"], null, "a client-supplied account id must never be trusted");
      assert.ok(!JSON.stringify(saved).includes("999"), "no client id leaked into the stored row");
      assert.ok(!JSON.stringify(saved).includes("U-somebody-elses-account"), "no client userId leaked into the stored row");
      assert.ok(!JSON.stringify(saved).includes("คนที่ไม่ใช่ผม"), "no client displayName leaked into the stored row");
      assert.equal(resolverCalls, 1, "identity resolution happens exactly once, server-side");
    } finally {
      await server.close();
    }
  });

  it("fails open: a throwing resolver still saves the lead", async () => {
    const database = createFakeDatabase();
    const server = await startRouter(database, {
      resolveLineAccountId: async () => {
        throw new Error("session store unreachable");
      },
    });

    try {
      const response = await fetch(`${server.url}/api/public/portfolio/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inquiryBody),
      });
      // A broken identity lookup must never cost the team a lead.
      assert.equal(response.status, 201);
      assert.equal(database.records.length, 1);
      assert.equal(database.records[0]?.["customerAccountId"], null);
    } finally {
      await server.close();
    }
  });

  it("production default never touches the session store when no cookie is sent (and needs no DATABASE_URL)", async () => {
    const database = createFakeDatabase();
    assert.equal(process.env["DATABASE_URL"], undefined, "this suite must stay hermetic");
    const server = await startRouter(database); // no options => real resolver

    try {
      const response = await fetch(`${server.url}/api/public/portfolio/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inquiryBody),
      });
      assert.equal(response.status, 201, "an anonymous inquiry must not depend on LINE auth being configured");
      assert.equal(database.records[0]?.["customerAccountId"], null);
    } finally {
      await server.close();
    }
  });
});
