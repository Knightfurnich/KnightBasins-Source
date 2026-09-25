import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request, Response } from "express";
import { importTypeScriptModule } from "./route-harness.ts";

type RateLimitModule = typeof import("../src/lib/rate-limit.ts");
type LeadRouteModule = typeof import("../src/routes/leads.ts");
type QuoteAccessModule = typeof import("../src/lib/quote-access.ts");

function fakeRequest(overrides: Record<string, unknown> = {}) {
  return {
    ip: "203.0.113.1",
    socket: { remoteAddress: "203.0.113.1" },
    ...overrides,
  } as unknown as Request;
}

function fakeResponse() {
  const state = { statusCode: 200, body: undefined as unknown, headers: {} as Record<string, string> };
  const res = {
    setHeader(name: string, value: string) {
      state.headers[name] = value;
      return res;
    },
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(body: unknown) {
      state.body = body;
      return res;
    },
  } as unknown as Response;
  return { res, state };
}

describe("createRateLimiter sweep behavior", () => {
  it("prunes expired buckets once the store grows past the sweep threshold", async () => {
    const rateLimit = await importTypeScriptModule<RateLimitModule>("src/lib/rate-limit.ts");
    rateLimit.clearRateLimitStore();

    // windowMs is long enough that none of the 1,200 fill entries below can
    // expire mid-loop (the loop itself takes well under 200ms) -- otherwise
    // the sweep-on-threshold check would start firing partway through the
    // loop and the store size after filling would be unpredictable.
    const limiter = rateLimit.createRateLimiter({
      name: "sweep-test",
      max: 1,
      windowMs: 200,
      key: (req) => String((req as unknown as { testKey: string }).testKey),
    });

    // Fill the store past the 1,000-entry sweep threshold.
    for (let i = 0; i < 1200; i += 1) {
      const { res } = fakeResponse();
      limiter(fakeRequest({ testKey: `expired-${i}` }), res, () => {});
    }
    assert.equal(rateLimit.rateLimitStoreSize(), 1200);

    // Guarantee every entry inserted above is now past its 200ms window.
    await new Promise((resolve) => setTimeout(resolve, 350));

    // This request's own bucket is freshly created (not expired), but
    // firing it should trigger a sweep of the other expired ones because
    // the store is over the threshold.
    const { res: triggerRes } = fakeResponse();
    limiter(fakeRequest({ testKey: "trigger" }), triggerRes, () => {});

    const sizeAfterSweep = rateLimit.rateLimitStoreSize();
    assert.ok(
      sizeAfterSweep < 1200,
      `expected expired buckets to be swept (size was ${sizeAfterSweep})`,
    );
    assert.ok(sizeAfterSweep <= 5, `expected only the fresh bucket to remain (size was ${sizeAfterSweep})`);

    rateLimit.clearRateLimitStore();
  });

  it("still enforces the limit and exposes clearRateLimitStore for test isolation", async () => {
    const rateLimit = await importTypeScriptModule<RateLimitModule>("src/lib/rate-limit.ts");
    rateLimit.clearRateLimitStore();
    assert.equal(rateLimit.rateLimitStoreSize(), 0);

    const limiter = rateLimit.createRateLimiter({ name: "basic-test", max: 2, windowMs: 60_000 });
    const req = fakeRequest();

    const first = fakeResponse();
    let nextCalled = 0;
    limiter(req, first.res, () => { nextCalled += 1; });
    const second = fakeResponse();
    limiter(req, second.res, () => { nextCalled += 1; });
    const third = fakeResponse();
    limiter(req, third.res, () => { nextCalled += 1; });

    assert.equal(nextCalled, 2);
    assert.equal(third.state.statusCode, 429);

    rateLimit.clearRateLimitStore();
  });
});

describe("GET /quotes rate limiting", () => {
  function createFakeLeadDatabase(lead: Record<string, unknown>) {
    return {
      select: () => {
        const builder = {
          from: () => builder,
          where: () => builder,
          limit: async () => [lead],
        };
        return builder;
      },
    };
  }

  async function startLeadsRoute(database: unknown) {
    const routeModule = await importTypeScriptModule<LeadRouteModule>("src/routes/leads.ts");
    const express = (await import("express")).default;
    const app = express();
    app.use(express.json());
    app.use("/api", routeModule.createLeadsRouter(database as never));
    const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
      listener.once("error", reject);
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("Leads route test server did not expose a TCP address");
    }
    return {
      url: `http://127.0.0.1:${address.port}`,
      close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
    };
  }

  it("returns 429 once GET /quotes is called more than 60 times in the window", async () => {
    const originalSecret = process.env["SESSION_SECRET"];
    const originalDatabaseUrl = process.env["DATABASE_URL"];
    process.env["SESSION_SECRET"] = "rate-limit-quotes-test-secret";
    process.env["DATABASE_URL"] = "postgres://rate-limit-quotes-test";

    const quoteAccess = await importTypeScriptModule<QuoteAccessModule>("src/lib/quote-access.ts");
    const accessSecret = quoteAccess.createQuoteAccessSecret();
    const quoteNumber = "Sep 26 / US / 000777";
    const token = quoteAccess.createPublicQuoteToken(quoteNumber, accessSecret);

    const lead = {
      id: 777,
      quoteNumber,
      quoteAccessSecret: accessSecret,
      orderMode: "studio",
      studioData: { total: 12345 },
    };

    const server = await startLeadsRoute(createFakeLeadDatabase(lead));
    try {
      let lastStatus = 0;
      for (let i = 0; i < 61; i += 1) {
        const response = await fetch(`${server.url}/api/quotes?token=${encodeURIComponent(token)}`);
        lastStatus = response.status;
        if (i < 60) assert.equal(response.status, 200, `request ${i + 1} should still be within quota`);
      }
      assert.equal(lastStatus, 429, "the 61st request within the window should be rate limited");
    } finally {
      await server.close();
      if (originalSecret === undefined) delete process.env["SESSION_SECRET"];
      else process.env["SESSION_SECRET"] = originalSecret;
      if (originalDatabaseUrl === undefined) delete process.env["DATABASE_URL"];
      else process.env["DATABASE_URL"] = originalDatabaseUrl;
    }
  });
});
