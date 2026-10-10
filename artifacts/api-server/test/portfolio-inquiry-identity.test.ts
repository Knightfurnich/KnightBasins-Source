import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, afterEach, before, describe, it, mock } from "node:test";
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

describe("POST /api/public/portfolio/inquiry notifies the bound customer on LINE (job 417-C)", () => {
  const hermesEnv = ["HERMES_API_URL", "HERMES_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_SALES_CHAT_ID"] as const;
  const savedEnv = Object.fromEntries(hermesEnv.map((key) => [key, process.env[key]]));
  const photoUrl = "/api/uploads/portfolio/bathroom/bathroom-077.jpg";
  const lineId = "U-line-id-from-the-account-row";

  type HermesCall = { url: string; method?: string; authorization: string | null; body: Record<string, unknown> };
  type TelegramCall = { url: string; body: Record<string, unknown> };

  function installFetchMock(options: { hermes?: (call: HermesCall) => Response | Promise<Response> } = {}) {
    const hermesCalls: HermesCall[] = [];
    const telegramCalls: TelegramCall[] = [];
    const realFetch = globalThis.fetch;
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://hermes.test/")) {
        const call: HermesCall = {
          url,
          method: init?.method,
          authorization: new Headers(init?.headers).get("authorization"),
          body: JSON.parse(String(init?.body)),
        };
        hermesCalls.push(call);
        return options.hermes
          ? options.hermes(call)
          : new Response(JSON.stringify({ ok: true, pushed: true, mirrored: true }), { status: 200 });
      }
      if (url.includes("api.telegram.org")) {
        telegramCalls.push({ url, body: JSON.parse(String(init?.body)) });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return realFetch(input as never, init);
    });
    return { hermesCalls, telegramCalls };
  }

  function configure({ hermes = true, telegram = false } = {}) {
    for (const key of hermesEnv) delete process.env[key];
    if (hermes) {
      process.env["HERMES_API_URL"] = "https://hermes.test/";
      process.env["HERMES_API_KEY"] = "hermes-key-under-test";
    }
    if (telegram) {
      process.env["TELEGRAM_BOT_TOKEN"] = "telegram-token-under-test";
      process.env["TELEGRAM_SALES_CHAT_ID"] = "-100123";
    }
  }

  const post = (url: string, body: Record<string, unknown> = inquiryBody) =>
    fetch(`${url}/api/public/portfolio/inquiry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  afterEach(() => {
    mock.restoreAll();
    for (const key of hermesEnv) {
      const value = savedEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("case 1: a lead bound to an account with a LINE id sends exactly one notice, and the team card has no photo link", async () => {
    configure({ telegram: true });
    const { hermesCalls, telegramCalls } = installFetchMock();
    const server = await startRouter(createFakeDatabase(), {
      resolveLineAccountId: async () => ({ accountId: 412, lineUserId: lineId }),
    });

    try {
      const response = await post(server.url, { ...inquiryBody, photoUrl });
      assert.equal(response.status, 201);

      assert.equal(hermesCalls.length, 1, "one notice per lead, no retries");
      const call = hermesCalls[0]!;
      assert.equal(call.url, "https://hermes.test/knight/line/notify");
      assert.equal(call.method, "POST");
      assert.equal(call.authorization, "Bearer hermes-key-under-test");
      assert.deepEqual(Object.keys(call.body).sort(), ["text", "user_id"]);
      assert.equal(call.body["user_id"], lineId);
      const text = call.body["text"] as string;
      assert.match(text, /^สวัสดีค่ะ/);
      assert.ok(text.includes(`${server.url}${photoUrl}`), `the notice links this lead's photo as an absolute URL, got: ${text}`);
      assert.ok(text.length <= 1900, "Hermes caps the text at 1,900 characters");
      assert.ok(
        !text.includes("0812345678") && !text.includes("คุณทดสอบ") && !text.includes("คอนโดสุขุมวิท"),
        "no contact details or notes in the customer message",
      );

      assert.equal(telegramCalls.length, 1, "the team is still alerted");
      const card = telegramCalls[0]!.body["text"] as string;
      assert.match(card, /bathroom-077/);
      assert.ok(!card.includes("ดูภาพผลงาน"), "the photo-link line is gone from the team card");
      assert.ok(!card.includes(photoUrl), "the photo URL is not in the team card");
      assert.ok(card.includes("ผูกกับบัญชีลูกค้า #412"), "the binding line is untouched");
    } finally {
      await server.close();
    }
  });

  it("case 1b: the target id comes from the verified account row -- a client-supplied user id or text is ignored", async () => {
    configure();
    const { hermesCalls } = installFetchMock();
    const server = await startRouter(createFakeDatabase(), {
      resolveLineAccountId: async () => ({ accountId: 412, lineUserId: "U-the-real-owner" }),
    });

    try {
      const response = await post(server.url, {
        ...inquiryBody,
        photoUrl,
        user_id: "U-victim",
        userId: "U-victim",
        lineUserId: "U-victim",
        line_user_id: "U-victim",
        text: "ข้อความที่ผู้ใช้พยายามฝัง",
        message: "ข้อความที่ผู้ใช้พยายามฝัง",
      });
      assert.equal(response.status, 201);
      assert.equal(hermesCalls.length, 1);
      assert.equal(hermesCalls[0]!.body["user_id"], "U-the-real-owner");
      const serialised = JSON.stringify(hermesCalls[0]!.body);
      assert.ok(!serialised.includes("U-victim"), "no client id reached Hermes");
      assert.ok(!serialised.includes("ข้อความที่ผู้ใช้พยายามฝัง"), "no client text reached Hermes");
    } finally {
      await server.close();
    }
  });

  it("case 1c: the LINE id is read from the account row the session proved (real resolver, stubbed session store)", async () => {
    configure();
    const { hermesCalls } = installFetchMock();
    const { pool } = await import("@workspace/db");
    const realQuery = pool.query;
    const lookups: unknown[] = [];
    // The session lookup selects (id, line_user_id, ...) from customer_sessions JOIN
    // customer_accounts and drizzle maps the row by position: id first, lineUserId second.
    (pool as { query: unknown }).query = async (config: unknown) => {
      lookups.push(config);
      return { rows: [[77, "U-from-customer-accounts-row"]], rowCount: 1, fields: [] };
    };
    const originalSecret = process.env["SESSION_SECRET"];
    process.env["SESSION_SECRET"] = "portfolio-inquiry-identity-test-secret";
    const database = createFakeDatabase();
    const server = await startRouter(database, undefined, true); // no options => real resolver

    try {
      const payload = Buffer.from(JSON.stringify({ token: "session-token-under-test" })).toString("base64url");
      const signature = createHmac("sha256", "portfolio-inquiry-identity-test-secret").update(payload).digest("hex");
      const response = await fetch(`${server.url}/api/public/portfolio/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `knight_line_session=${payload}.${signature}` },
        body: JSON.stringify({ ...inquiryBody, photoUrl, user_id: "U-victim" }),
      });
      assert.equal(response.status, 201);
      assert.equal(lookups.length, 1, "the session store was asked exactly once");
      assert.equal(database.records[0]?.["customerAccountId"], 77, "the lead is bound to the account id from the row");
      assert.equal(hermesCalls.length, 1);
      assert.equal(hermesCalls[0]!.body["user_id"], "U-from-customer-accounts-row");
    } finally {
      await server.close();
      (pool as { query: unknown }).query = realQuery;
      if (originalSecret === undefined) delete process.env["SESSION_SECRET"];
      else process.env["SESSION_SECRET"] = originalSecret;
    }
  });

  it("case 2: an anonymous lead, or an account without a LINE id, never calls Hermes", async () => {
    configure({ telegram: true });
    const { hermesCalls, telegramCalls } = installFetchMock();
    const resolvers = [
      async () => null,
      async () => 412, // legacy numeric result: bound, but no LINE id to message
      async () => ({ accountId: 412, lineUserId: null }),
      async () => ({ accountId: 412, lineUserId: "" }),
    ];

    for (const resolveLineAccountId of resolvers) {
      const server = await startRouter(createFakeDatabase(), { resolveLineAccountId });
      try {
        const response = await post(server.url, { ...inquiryBody, photoUrl, user_id: "U-victim", lineUserId: "U-victim" });
        assert.equal(response.status, 201);
      } finally {
        await server.close();
      }
    }

    assert.equal(hermesCalls.length, 0, "nobody to message => Hermes is not called");
    assert.equal(telegramCalls.length, resolvers.length, "every lead still reaches the team");
  });

  it("case 3: Hermes failing (400, 502, not a friend, network error) keeps the lead, the 201 and the team card", async () => {
    const failures: Array<[string, () => Response | Promise<Response>]> = [
      ["400", () => new Response(JSON.stringify({ ok: false, error: "bad" }), { status: 400 })],
      ["502", () => new Response("bad gateway", { status: 502 })],
      ["200 pushed:false (not a friend)", () => new Response(JSON.stringify({ ok: true, pushed: false }), { status: 200 })],
      ["network error", () => { throw new TypeError("fetch failed"); }],
    ];

    for (const [label, hermes] of failures) {
      configure({ telegram: true });
      const warn = mock.method(console, "warn", () => {});
      const { hermesCalls, telegramCalls } = installFetchMock({ hermes });
      const database = createFakeDatabase();
      const server = await startRouter(database, {
        resolveLineAccountId: async () => ({ accountId: 412, lineUserId: lineId }),
      });

      try {
        const response = await post(server.url, { ...inquiryBody, photoUrl });
        assert.equal(response.status, 201, `${label}: a failed notice must not fail the inquiry`);
        assert.equal(database.records.length, 1, `${label}: the lead is saved`);
        assert.equal(database.records[0]?.["customerAccountId"], 412, `${label}: still bound to the account`);
        assert.equal(telegramCalls.length, 1, `${label}: the team is still alerted`);
        assert.equal(hermesCalls.length, 1, `${label}: no retry`);
        assert.ok(
          warn.mock.calls.some((call) => String(call.arguments[0]).includes("customer LINE notice")),
          `${label}: the failure is logged`,
        );
        const logged = JSON.stringify(warn.mock.calls.map((call) => call.arguments));
        assert.ok(!logged.includes(lineId), `${label}: the customer's LINE id is not logged`);
      } finally {
        await server.close();
        mock.restoreAll();
      }
    }
  });

  it("case 4: Hermes not configured => skipped silently, lead still saved and the team still alerted", async () => {
    configure({ hermes: false, telegram: true });
    const warn = mock.method(console, "warn", () => {});
    const { hermesCalls, telegramCalls } = installFetchMock();
    const database = createFakeDatabase();
    const server = await startRouter(database, {
      resolveLineAccountId: async () => ({ accountId: 412, lineUserId: lineId }),
    });

    try {
      const response = await post(server.url, { ...inquiryBody, photoUrl });
      assert.equal(response.status, 201);
      assert.equal(database.records.length, 1);
      assert.equal(hermesCalls.length, 0);
      assert.equal(telegramCalls.length, 1);
      assert.equal(warn.mock.callCount(), 0, "silent skip: nothing to warn about when the feature is simply off");
    } finally {
      await server.close();
    }
  });

  it("a photo link that is not on our own uploads path is left out of the customer message", async () => {
    configure();
    const { hermesCalls } = installFetchMock();
    const server = await startRouter(createFakeDatabase(), {
      resolveLineAccountId: async () => ({ accountId: 412, lineUserId: lineId }),
    });

    try {
      const hostileLinks = [
        "https://evil.example/api/uploads/portfolio/x.jpg",
        "javascript:alert(1)",
        "//evil.example/api/uploads/x.jpg",
        "/admin/secret",
        "ดูรูปที่นี่ https://evil.example",
      ];
      for (const hostile of hostileLinks) {
        const response = await post(server.url, { ...inquiryBody, photoUrl: hostile });
        assert.equal(response.status, 201);
      }
      assert.equal(hermesCalls.length, hostileLinks.length, "the customer is still told the team will call back");
      for (const call of hermesCalls) {
        const text = call.body["text"] as string;
        assert.ok(
          !text.includes("evil.example") && !text.includes("javascript") && !text.includes("/admin/secret"),
          `untrusted link leaked: ${text}`,
        );
        assert.ok(!text.includes("รูปที่สนใจ"), "no link line when the link cannot be trusted");
        assert.match(text, /ทีมงานจะติดต่อกลับ/);
      }
    } finally {
      await server.close();
    }
  });
});
