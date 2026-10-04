import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, afterEach, before, describe, it, mock } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import { fileURLToPath } from "node:url";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule, serveTypeScriptRoute } from "./route-harness.ts";

// job-237-a: the on/off switch for the น้องไนท์ voice feature. POST /support/speech spends Google Cloud TTS quota per
// character on a public route, so the feature ships OFF and an admin turns it on. Nothing here needs Postgres or Google
// credentials: the database is a fake, and the route's shared `db` is stubbed for the HTTP checks.

type SupportModule = typeof import("../src/routes/support.ts");
type ZodModule = typeof import("../../../lib/api-zod/src/index.ts");
type AdminRouteModule = { createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1] };
type Row = Record<string, unknown>;

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  ADMIN_PERMISSIONS: process.env["ADMIN_PERMISSIONS"],
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env["GOOGLE_SERVICE_ACCOUNT_JSON"],
  GOOGLE_APPLICATION_CREDENTIALS: process.env["GOOGLE_APPLICATION_CREDENTIALS"],
  GOOGLE_SERVICE_ACCOUNT_DISABLED: process.env["GOOGLE_SERVICE_ACCOUNT_DISABLED"],
};

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

let support: SupportModule;
let supportSource: string;
let adminSource: string;
let migration: string;
let schemaSource: string;
let sharedDb: { select: (...args: unknown[]) => unknown };
let SupportVoiceStatusSchema: ZodModule["GetSupportVoiceStatusResponse"];
let UpdateBodySchema: ZodModule["UpdateAdminSupportVoiceBody"];
let SettingResponseSchema: ZodModule["UpdateAdminSupportVoiceResponse"];

/** Read as LF whatever the checkout's line endings are (Windows checks out CRLF), so the slicing below behaves the same everywhere. */
const readSource = async (relative: string) => (await readFile(new URL(relative, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
/** The source with comments removed, so a word in a comment can't satisfy or break an assertion. */
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(\/\/|--).*$/gm, "");

before(async () => {
  process.env["ADMIN_PASSWORD"] = "support-voice-toggle-test-password";
  process.env["DATABASE_URL"] = "postgres://support-voice-toggle-test";
  process.env["SESSION_SECRET"] = "support-voice-toggle-test-session-secret";
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
  // No Google credentials anywhere: if a request got past the switch it would stop at synthesizeSpeech with a 422.
  delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
  delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
  process.env["GOOGLE_SERVICE_ACCOUNT_DISABLED"] = "true";

  support = await importTypeScriptModule<SupportModule>("src/routes/support.ts");
  ({
    GetSupportVoiceStatusResponse: SupportVoiceStatusSchema,
    UpdateAdminSupportVoiceBody: UpdateBodySchema,
    UpdateAdminSupportVoiceResponse: SettingResponseSchema,
  } = await importTypeScriptModule<ZodModule>("../../lib/api-zod/src/index.ts"));
  // the same instance the bundled route imports (it is external to the bundle), so a stub here reaches the route
  ({ db: sharedDb } = (await import("@workspace/db")) as unknown as { db: typeof sharedDb });
  supportSource = await readSource("../src/routes/support.ts");
  adminSource = await readSource("../src/routes/admin-router.ts");
  migration = await readSource("../../../deploy/hostinger/migrations/024_support_voice_enabled.sql");
  schemaSource = await readSource("../../../lib/db/src/schema/index.ts");
});

after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

afterEach(() => {
  mock.restoreAll();
});

/** What `select().from(table).orderBy(..).limit(1)` answers; `rows` may be a function that throws. */
function fakeSettingsDatabase(rows: Row[] | (() => Row[])) {
  return {
    select: () => ({
      from: () => ({
        orderBy: () => ({ limit: async () => (typeof rows === "function" ? rows() : rows) }),
      }),
    }),
  } as never;
}

function stubSharedDb(rows: Row[] | (() => Row[])) {
  mock.method(sharedDb, "select", (fakeSettingsDatabase(rows) as { select: () => unknown }).select);
}

describe("isSupportVoiceEnabled", () => {
  it("is false when the table has no row yet (the feature has never been switched on)", async () => {
    assert.equal(await support.isSupportVoiceEnabled(fakeSettingsDatabase([])), false);
  });

  it("is false when the saved row has enabled=false", async () => {
    assert.equal(await support.isSupportVoiceEnabled(fakeSettingsDatabase([{ id: 1, enabled: false }])), false);
  });

  it("is true only when the saved row has enabled === true", async () => {
    assert.equal(await support.isSupportVoiceEnabled(fakeSettingsDatabase([{ id: 1, enabled: true }])), true);
  });

  it("is false for anything that merely looks true (1, \"true\", missing)", async () => {
    for (const enabled of [1, "true", "t", {}, undefined, null]) {
      assert.equal(await support.isSupportVoiceEnabled(fakeSettingsDatabase([{ id: 1, enabled }])), false, String(enabled));
    }
  });

  it("fails closed: a query that throws answers false instead of leaving voice open", async () => {
    const broken = fakeSettingsDatabase(() => {
      throw new Error("connection refused");
    });
    assert.equal(await support.isSupportVoiceEnabled(broken), false);
  });
});

describe("GET /api/support/voice-status", () => {
  it("answers {enabled:true} with Cache-Control: no-store when an admin switched voice on", async () => {
    stubSharedDb([{ id: 1, enabled: true }]);
    const route = await serveTypeScriptRoute("src/routes/support.ts");
    try {
      const response = await fetch(`${route.url}/api/support/voice-status`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), { enabled: true });
    } finally {
      await route.close();
    }
  });

  it("answers {enabled:false} when there is no row, and also when the database throws", async () => {
    for (const rows of [[], () => { throw new Error("db down"); }] as Array<Row[] | (() => Row[])>) {
      stubSharedDb(rows);
      const route = await serveTypeScriptRoute("src/routes/support.ts");
      try {
        const response = await fetch(`${route.url}/api/support/voice-status`);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.deepEqual(await response.json(), { enabled: false });
      } finally {
        await route.close();
        mock.restoreAll();
      }
    }
  });

  it("returns a body that satisfies the generated zod schema", async () => {
    stubSharedDb([{ id: 1, enabled: true }]);
    const route = await serveTypeScriptRoute("src/routes/support.ts");
    try {
      const body = await (await fetch(`${route.url}/api/support/voice-status`)).json();
      assert.deepEqual(SupportVoiceStatusSchema.parse(body), { enabled: true });
    } finally {
      await route.close();
    }
  });
});

describe("POST /api/support/speech is closed while the switch is off", () => {
  const post = (url: string, text: string) =>
    fetch(`${url}/api/support/speech`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });

  it("answers 503 with the Thai message when the switch is off, before any Google call", async () => {
    stubSharedDb([{ id: 1, enabled: false }]);
    const realFetch = globalThis.fetch;
    const outbound: string[] = [];
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (/googleapis\.com/.test(url)) outbound.push(url);
      return realFetch(input as never, init);
    });
    const route = await serveTypeScriptRoute("src/routes/support.ts");
    try {
      const response = await post(route.url, "สวัสดีค่ะ");
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { message: "ฟีเจอร์เสียงน้องไนท์ปิดใช้งานอยู่" });
      assert.deepEqual(outbound, [], "no request may reach Google while voice is off");
    } finally {
      await route.close();
    }
  });

  it("answers 503 when there is no settings row at all (fresh install)", async () => {
    stubSharedDb([]);
    const route = await serveTypeScriptRoute("src/routes/support.ts");
    try {
      assert.equal((await post(route.url, "สวัสดีค่ะ")).status, 503);
    } finally {
      await route.close();
    }
  });

  it("answers 503 when the settings lookup throws (fail closed)", async () => {
    stubSharedDb(() => {
      throw new Error("db down");
    });
    const route = await serveTypeScriptRoute("src/routes/support.ts");
    try {
      assert.equal((await post(route.url, "สวัสดีค่ะ")).status, 503);
    } finally {
      await route.close();
    }
  });

  it("lets the request through to text-to-speech once the switch is on", async () => {
    stubSharedDb([{ id: 1, enabled: true }]);
    const route = await serveTypeScriptRoute("src/routes/support.ts");
    try {
      const response = await post(route.url, "สวัสดีค่ะ");
      // not configured on purpose: reaching synthesizeSpeech's own "not configured" answer proves the gate let it pass
      assert.equal(response.status, 422);
      assert.match(((await response.json()) as { message: string }).message, /GOOGLE_SERVICE_ACCOUNT_JSON/);
    } finally {
      await route.close();
    }
  });

  it("keeps the 20-per-hour limit: the 21st request is 429 even while the switch is off", async () => {
    stubSharedDb([{ id: 1, enabled: false }]);
    const route = await serveTypeScriptRoute("src/routes/support.ts");
    try {
      let last = 0;
      for (let i = 0; i < 21; i += 1) {
        const response = await post(route.url, `ครั้งที่ ${i}`);
        last = response.status;
        if (i < 20) assert.equal(response.status, 503, `request ${i + 1} is inside the quota and answers 503`);
      }
      assert.equal(last, 429);
    } finally {
      await route.close();
    }
  });
});

describe("source guards (support.ts)", () => {
  it("checks the switch before synthesizeSpeech inside the speech route", () => {
    const code = stripComments(supportSource);
    const start = code.indexOf('router.post("/support/speech"');
    assert.ok(start > -1, "speech route not found");
    const handler = code.slice(start, code.indexOf("\n});", start));
    const gate = handler.indexOf("isSupportVoiceEnabled()");
    const synth = handler.indexOf("synthesizeSpeech(");
    assert.ok(gate > -1, "the route does not call isSupportVoiceEnabled()");
    assert.ok(synth > -1, "the route no longer calls synthesizeSpeech");
    assert.ok(gate < synth, "the switch must be checked before synthesizeSpeech");
    assert.match(handler, /status\(503\)/);
    assert.match(code, /SUPPORT_VOICE_DISABLED_MESSAGE = "ฟีเจอร์เสียงน้องไนท์ปิดใช้งานอยู่"/);
  });

  it("still applies the original 20-per-hour limiter to /support/speech", () => {
    const code = stripComments(supportSource);
    assert.match(code, /createRateLimiter\(\{ name: "support-speech", max: 20, windowMs: 60 \* 60 \* 1000 \}\)/);
    assert.match(code, /router\.post\("\/support\/speech", supportSpeechRateLimit,/);
  });

  it("serves GET /support/voice-status with Cache-Control: no-store", () => {
    const code = stripComments(supportSource);
    const start = code.indexOf('router.get("/support/voice-status"');
    assert.ok(start > -1, "voice-status route not found");
    const handler = code.slice(start, code.indexOf("\n});", start));
    assert.match(handler, /Cache-Control", "no-store"/);
    assert.match(handler, /enabled: await isSupportVoiceEnabled\(\)/);
  });

  it("isSupportVoiceEnabled compares with === true and catches errors into false", () => {
    const code = stripComments(supportSource);
    const start = code.indexOf("export async function isSupportVoiceEnabled");
    const body = code.slice(start, code.indexOf("\n}\n", start));
    assert.match(body, /\.orderBy\(desc\(supportVoiceSettings\.id\)\)\.limit\(1\)/, "must read the latest row, as the admin route does");
    assert.match(body, /row\?\.enabled === true/);
    assert.match(body, /catch \{\s*return false;/);
  });
});

describe("migration 024 and the schema", () => {
  it("adds the column additively and defaults it to false", () => {
    const sql = stripComments(migration);
    assert.match(sql, /ALTER TABLE support_voice_settings ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false;/i);
    assert.doesNotMatch(sql, /DEFAULT\s+true/i);
  });

  it("has no DROP, TRUNCATE or DELETE (deploy.yml refuses the whole run for DROP/TRUNCATE)", () => {
    assert.doesNotMatch(stripComments(migration), /\b(DROP|TRUNCATE|DELETE)\b/i);
  });

  it("declares enabled as a not-null boolean defaulting to false on supportVoiceSettings", () => {
    const start = schemaSource.indexOf('export const supportVoiceSettings = pgTable("support_voice_settings"');
    assert.ok(start > -1, "supportVoiceSettings table not found");
    const table = schemaSource.slice(start, schemaSource.indexOf("});", start));
    assert.match(table, /enabled: boolean\("enabled"\)\.notNull\(\)\.default\(false\)/);
  });
});

describe("source guards (admin-router.ts)", () => {
  it("serializes enabled, treating a missing row as false", () => {
    assert.match(adminSource, /enabled: row\?\.enabled \?\? false/);
  });

  it("saves enabled on both the update path (keeping the old value when omitted) and the insert path (default off)", () => {
    assert.match(adminSource, /enabled: requestedEnabled \?\? existing\.enabled/);
    assert.match(adminSource, /\.values\(\{ voiceName: option\.voiceName, enabled: requestedEnabled \?\? false \}\)/);
  });
});

describe("generated contract", () => {
  it("the PATCH body accepts an optional boolean enabled and still requires voiceName", () => {
    assert.ok(UpdateBodySchema.safeParse({ voiceName: "th-TH-Chirp3-HD-Kore" }).success);
    assert.ok(UpdateBodySchema.safeParse({ voiceName: "th-TH-Chirp3-HD-Kore", enabled: true }).success);
    assert.ok(!UpdateBodySchema.safeParse({ voiceName: "th-TH-Chirp3-HD-Kore", enabled: "yes" }).success);
    assert.ok(!UpdateBodySchema.safeParse({ enabled: true }).success);
  });

  it("the setting response requires enabled, and the status response requires only enabled", () => {
    const base = { voiceName: "th-TH-Chirp3-HD-Kore", languageCode: "th-TH", speakingRate: 1, updatedAt: new Date().toISOString() };
    assert.ok(!SettingResponseSchema.safeParse(base).success);
    assert.ok(SettingResponseSchema.safeParse({ ...base, enabled: false }).success);
    assert.ok(!SupportVoiceStatusSchema.safeParse({}).success);
  });

  it("openapi.yaml declares the status endpoint and the new fields", async () => {
    const yaml = await readSource("../../../lib/api-spec/openapi.yaml");
    assert.match(yaml, /\/support\/voice-status:\s+get:\s+operationId: getSupportVoiceStatus\r?\n/);
    assert.match(yaml, /SupportVoiceStatus:\s+type: object\s+required: \[enabled\]/);
    assert.match(yaml, /required: \[voiceName, languageCode, speakingRate, enabled, updatedAt\]/);
  });
});

/** A one-row, stateful stand-in for support_voice_settings that keeps `enabled` (the older fake in admin-support-voice.test.ts drops it). */
function statefulSettingsDatabase(initial: Row[]) {
  let rows = initial.map((row) => ({ ...row }));
  let nextId = rows.reduce((max, row) => Math.max(max, Number(row["id"])), 0) + 1;
  return {
    snapshot: () => rows,
    select: () => ({ from: () => ({ orderBy: () => ({ limit: async () => [...rows].sort((a, b) => Number(b["id"]) - Number(a["id"])).slice(0, 1) }) }) }),
    insert: () => ({
      values: (data: Row) => ({
        returning: async () => {
          const created = { id: nextId++, languageCode: "th-TH", speakingRate: 1, enabled: false, updatedAt: new Date(), ...data };
          rows.push(created);
          return [created];
        },
      }),
    }),
    update: () => {
      let changes: Row = {};
      const builder = {
        set(values: Row) {
          changes = values;
          return builder;
        },
        // the table holds a single row, so there is nothing to filter
        where: () => ({
          returning: async () => {
            const latest = [...rows].sort((a, b) => Number(b["id"]) - Number(a["id"]))[0];
            if (!latest) return [];
            Object.assign(latest, changes);
            return [latest];
          },
        }),
      };
      return builder;
    },
  };
}

async function startAdminRoute(database: unknown) {
  const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", routeModule.createAdminRouter(database));
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Admin route test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

describe("admin /admin/support-voice carries enabled", () => {
  const cookie = () => `knight_admin_session=${createAdminToken()}`;
  const patch = (url: string, body: unknown) =>
    fetch(`${url}/api/admin/support-voice`, { method: "PATCH", headers: { cookie: cookie(), "content-type": "application/json" }, body: JSON.stringify(body) });

  it("GET reports enabled=false while the table is empty", async () => {
    const server = await startAdminRoute(statefulSettingsDatabase([]));
    try {
      const response = await fetch(`${server.url}/api/admin/support-voice`, { headers: { cookie: cookie() } });
      assert.equal(response.status, 200);
      assert.equal(((await response.json()) as { current: { enabled: boolean } }).current.enabled, false);
    } finally {
      await server.close();
    }
  });

  it("the first save without enabled creates the row switched OFF", async () => {
    const database = statefulSettingsDatabase([]);
    const server = await startAdminRoute(database);
    try {
      const response = await patch(server.url, { voiceName: "th-TH-Chirp3-HD-Zephyr" });
      assert.equal(response.status, 200);
      assert.equal(((await response.json()) as { enabled: boolean }).enabled, false);
      assert.equal(database.snapshot()[0]?.["enabled"], false);
    } finally {
      await server.close();
    }
  });

  it("the first save with enabled:true creates the row switched ON", async () => {
    const database = statefulSettingsDatabase([]);
    const server = await startAdminRoute(database);
    try {
      const response = await patch(server.url, { voiceName: "th-TH-Chirp3-HD-Zephyr", enabled: true });
      assert.equal(((await response.json()) as { enabled: boolean }).enabled, true);
      assert.equal(database.snapshot()[0]?.["enabled"], true);
    } finally {
      await server.close();
    }
  });

  it("changing only the voice keeps an enabled switch on; enabled:false switches it off", async () => {
    const database = statefulSettingsDatabase([
      { id: 1, voiceName: "th-TH-Chirp3-HD-Kore", languageCode: "th-TH", speakingRate: 1, enabled: true, updatedAt: new Date() },
    ]);
    const server = await startAdminRoute(database);
    try {
      const kept = await patch(server.url, { voiceName: "th-TH-Chirp3-HD-Leda" });
      const keptBody = (await kept.json()) as { voiceName: string; enabled: boolean };
      assert.deepEqual([keptBody.voiceName, keptBody.enabled], ["th-TH-Chirp3-HD-Leda", true]);

      const off = await patch(server.url, { voiceName: "th-TH-Chirp3-HD-Leda", enabled: false });
      assert.equal(((await off.json()) as { enabled: boolean }).enabled, false);
      assert.equal(database.snapshot()[0]?.["enabled"], false);
    } finally {
      await server.close();
    }
  });

  it("changing only the voice keeps a switch that is off off", async () => {
    const database = statefulSettingsDatabase([
      { id: 1, voiceName: "th-TH-Chirp3-HD-Kore", languageCode: "th-TH", speakingRate: 1, enabled: false, updatedAt: new Date() },
    ]);
    const server = await startAdminRoute(database);
    try {
      const response = await patch(server.url, { voiceName: "th-TH-Chirp3-HD-Despina" });
      assert.equal(((await response.json()) as { enabled: boolean }).enabled, false);
    } finally {
      await server.close();
    }
  });

  it("rejects a non-boolean enabled with 400 and saves nothing", async () => {
    const database = statefulSettingsDatabase([]);
    const server = await startAdminRoute(database);
    try {
      const response = await patch(server.url, { voiceName: "th-TH-Chirp3-HD-Kore", enabled: "yes" });
      assert.equal(response.status, 400);
      assert.deepEqual(database.snapshot(), []);
    } finally {
      await server.close();
    }
  });
});
