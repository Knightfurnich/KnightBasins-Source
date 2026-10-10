import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it, mock } from "node:test";
import cookieParser from "cookie-parser";
import { build } from "esbuild";
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
      // `leadKey` is a fresh randomUUID, so it is excluded from the substring scan: measured
      // 0.56% of UUIDs contain "999", which made the old whole-row scan flaky (it failed CI once).
      // Everything the visitor sent must still be absent from every other stored field.
      const storedFields = Object.fromEntries(Object.entries(saved).filter(([key]) => key !== "leadKey"));
      const storedJson = JSON.stringify(storedFields);
      for (const clientValue of ["999", "U-somebody-elses-account", "คนที่ไม่ใช่ผม"]) {
        assert.ok(!storedJson.includes(clientValue), `no client value (${clientValue}) leaked into the stored row`);
      }
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

  it("a request without the session cookie never touches the session store", async () => {
    const { pool } = await import("@workspace/db");
    const sessionStoreQueries: string[] = [];
    const realQuery = pool.query;
    // Stand-in for the session store: record the touch, never dial a database.
    (pool as { query: unknown }).query = async (config: unknown) => {
      sessionStoreQueries.push(typeof config === "string" ? config : String((config as { text?: string }).text));
      throw new Error("session store stub: unreachable");
    };
    const warn = mock.method(console, "warn", () => {});
    const originalSecret = process.env["SESSION_SECRET"];
    process.env["SESSION_SECRET"] = "portfolio-inquiry-identity-test-secret";
    const database = createFakeDatabase();
    const server = await startRouter(database, undefined, true); // no options => real resolver

    try {
      const post = (cookie?: string) =>
        fetch(`${server.url}/api/public/portfolio/inquiry`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
          body: JSON.stringify(inquiryBody),
        });

      // Control: a correctly signed session cookie does reach the store (here it is
      // unreachable, so the lead is saved unbound -- fail-open). Without this the
      // zero below would hold just as well for a spy that never fires.
      const payload = Buffer.from(JSON.stringify({ token: "control-session-token" })).toString("base64url");
      const signature = createHmac("sha256", "portfolio-inquiry-identity-test-secret").update(payload).digest("hex");
      const withCookie = await post(`knight_line_session=${payload}.${signature}`);
      assert.equal(withCookie.status, 201, "a failing session lookup must not cost the lead");
      assert.equal(sessionStoreQueries.length, 1, "control: a signed session cookie must query the session store");
      assert.equal(database.records[0]?.["customerAccountId"], null);

      sessionStoreQueries.length = 0;
      warn.mock.resetCalls();
      const anonymous = await post();
      assert.equal(anonymous.status, 201);
      assert.deepEqual(sessionStoreQueries, [], "no cookie => the session store is not touched");
      assert.equal(warn.mock.callCount(), 0, "no cookie => no lookup was attempted, so nothing was swallowed");
      assert.equal(database.records[1]?.["customerAccountId"], null);
    } finally {
      await server.close();
      warn.mock.restore();
      (pool as { query: unknown }).query = realQuery;
      if (originalSecret === undefined) delete process.env["SESSION_SECRET"];
      else process.env["SESSION_SECRET"] = originalSecret;
    }
  });

  it("the production bundle inlines the session lookup (no runtime import of ./line-auth)", async () => {
    // api-server ships as ONE esbuild bundle (build.mjs). A computed import specifier
    // is invisible to esbuild: dist/ then has no line-auth module, the import fails
    // at runtime, and the fail-open catch hides it -- every lead is saved unbound.
    const result = await build({
      entryPoints: ["src/routes/portfolio.ts"],
      bundle: true,
      write: false,
      external: ["express", "pg", "@workspace/db", "@workspace/db/*"],
      format: "esm",
      logLevel: "silent",
      platform: "node",
      sourcemap: false,
    });
    const output = result.outputFiles[0]!.text;

    assert.ok(
      output.includes("findAuthenticatedAccount"),
      "the session lookup from ./line-auth must be bundled into the output",
    );
    const dynamicImports = [...output.matchAll(/\bimport\(([^)]*)\)/g)].map((match) => match[1]!.trim());
    for (const specifier of dynamicImports) {
      assert.match(
        specifier,
        /^["'][^"']+["']$/,
        `every remaining runtime import() must have a literal specifier, found import(${specifier})`,
      );
    }
    assert.ok(!output.includes("./line-auth"), "no runtime reference to a ./line-auth file may survive the bundle");
  });
});
