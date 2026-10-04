import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, afterEach, before, describe, it, mock } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import { fileURLToPath } from "node:url";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { parseSupportVoiceSpeakingRate, resolveVoiceConfig, synthesizeSpeech } from "../src/lib/google-tts.ts";
import { importTypeScriptModule } from "./route-harness.ts";

// job-255: the speed น้องไนท์ speaks at can be set from the admin API (PATCH /admin/support-voice, 0.8-1.5 in steps of
// 0.05) and heard in the preview. The TTS layer already sent speakingRate to Google; nothing could set it. No Postgres and no
// Google credentials of any real kind are needed: the database is a fake and the Google calls are mocked.

type Row = Record<string, unknown>;
type AdminRouteModule = { createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1] };
type ZodModule = typeof import("../../../lib/api-zod/src/index.ts");

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  ADMIN_PERMISSIONS: process.env["ADMIN_PERMISSIONS"],
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env["GOOGLE_SERVICE_ACCOUNT_JSON"],
};
const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));
const realFetch = globalThis.fetch;
let UpdateBodySchema: ZodModule["UpdateAdminSupportVoiceBody"];

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "pkcs1", format: "pem" },
});
const FAKE_CREDENTIALS_JSON = JSON.stringify({ client_email: "knight-basins-tts@test.iam.gserviceaccount.com", private_key: privateKey });

before(async () => {
  process.env["ADMIN_PASSWORD"] = "support-voice-rate-test-password";
  process.env["DATABASE_URL"] = "postgres://support-voice-rate-test";
  process.env["SESSION_SECRET"] = "support-voice-rate-test-session-secret";
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
  ({ UpdateAdminSupportVoiceBody: UpdateBodySchema } = await importTypeScriptModule<ZodModule>("../../lib/api-zod/src/index.ts"));
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

/** A one-row, stateful stand-in for support_voice_settings that keeps `speakingRate` and `enabled`. */
function statefulSettingsDatabase(initial: Row[]) {
  const rows = initial.map((row) => ({ ...row }));
  let nextId = rows.reduce((max, row) => Math.max(max, Number(row["id"])), 0) + 1;
  const latest = () => [...rows].sort((a, b) => Number(b["id"]) - Number(a["id"]))[0];
  return {
    snapshot: () => rows.map((row) => ({ ...row })),
    select: () => ({ from: () => ({ orderBy: () => ({ limit: async () => (latest() ? [latest()] : []) }) }) }),
    insert: () => ({
      values: (data: Row) => ({
        returning: async () => {
          // the column default (1.0) applies when the insert does not name a rate, as in the real table
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
        where: () => ({
          returning: async () => {
            const target = latest();
            if (!target) return [];
            Object.assign(target, changes);
            return [target];
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

const cookie = () => `knight_admin_session=${createAdminToken()}`;
const KORE = "th-TH-Chirp3-HD-Kore";
const ZEPHYR = "th-TH-Chirp3-HD-Zephyr";
const savedRow = (overrides: Row = {}): Row => ({ id: 1, voiceName: KORE, languageCode: "th-TH", speakingRate: 1, enabled: false, updatedAt: new Date("2026-10-04T00:00:00Z"), ...overrides });

const patch = (url: string, body: unknown) =>
  fetch(`${url}/api/admin/support-voice`, { method: "PATCH", headers: { cookie: cookie(), "content-type": "application/json" }, body: JSON.stringify(body) });
const getCurrent = async (url: string) =>
  ((await (await fetch(`${url}/api/admin/support-voice`, { headers: { cookie: cookie() } })).json()) as { current: { speakingRate: number; voiceName: string; enabled: boolean } }).current;

describe("PATCH /admin/support-voice: speakingRate", () => {
  it("accepts 1.25, saves it, and GET then reports 1.25", async () => {
    const database = statefulSettingsDatabase([savedRow()]);
    const server = await startAdminRoute(database);
    try {
      const response = await patch(server.url, { voiceName: KORE, speakingRate: 1.25 });
      assert.equal(response.status, 200);
      assert.equal(((await response.json()) as { speakingRate: number }).speakingRate, 1.25);
      assert.equal(database.snapshot()[0]?.["speakingRate"], 1.25);
      assert.equal((await getCurrent(server.url)).speakingRate, 1.25);
    } finally {
      await server.close();
    }
  });

  it("the first save (no row yet) can set the rate too; without a rate the new row gets the column default 1.0", async () => {
    const withRate = statefulSettingsDatabase([]);
    const first = await startAdminRoute(withRate);
    try {
      assert.equal((await patch(first.url, { voiceName: KORE, speakingRate: 1.25 })).status, 200);
      assert.equal(withRate.snapshot()[0]?.["speakingRate"], 1.25);
    } finally {
      await first.close();
    }
    const withoutRate = statefulSettingsDatabase([]);
    const second = await startAdminRoute(withoutRate);
    try {
      assert.equal((await patch(second.url, { voiceName: KORE })).status, 200);
      assert.equal(withoutRate.snapshot()[0]?.["speakingRate"], 1);
    } finally {
      await second.close();
    }
  });

  it("accepts the ends of the range and values on the 0.05 grid in between (0.8, 1.05, 1.15, 1.5)", async () => {
    for (const rate of [0.8, 1.05, 1.15, 1.5, 1, 1.45]) {
      const database = statefulSettingsDatabase([savedRow()]);
      const server = await startAdminRoute(database);
      try {
        const response = await patch(server.url, { voiceName: KORE, speakingRate: rate });
        assert.equal(response.status, 200, String(rate));
        assert.equal(database.snapshot()[0]?.["speakingRate"], rate, String(rate));
      } finally {
        await server.close();
      }
    }
  });

  it("refuses 0.5, 2.0 and \"เร็ว\" with 400 and a message that names speakingRate; nothing is saved", async () => {
    for (const bad of [0.5, 2.0, "เร็ว"]) {
      const database = statefulSettingsDatabase([savedRow({ speakingRate: 1.25 })]);
      const server = await startAdminRoute(database);
      try {
        const response = await patch(server.url, { voiceName: ZEPHYR, speakingRate: bad });
        assert.equal(response.status, 400, String(bad));
        assert.match(JSON.stringify(await response.json()), /speakingRate must be a number from 0\.8 to 1\.5 in steps of 0\.05/, String(bad));
        assert.equal(database.snapshot()[0]?.["speakingRate"], 1.25, `${bad}: the saved rate is untouched`);
        assert.equal(database.snapshot()[0]?.["voiceName"], KORE, `${bad}: the voice is untouched too`);
      } finally {
        await server.close();
      }
    }
  });

  it("refuses every other bad value instead of rounding or clamping it: 0.79, 1.51, 1.27, 0, -1, null, true, a list, an object, a numeric string", async () => {
    for (const bad of [0.79, 1.51, 1.27, 1.2500001, 0, -1, null, true, [1.25], { rate: 1.25 }, "1.25", "NaN", ""]) {
      const database = statefulSettingsDatabase([savedRow()]);
      const server = await startAdminRoute(database);
      try {
        const response = await patch(server.url, { voiceName: KORE, speakingRate: bad });
        assert.equal(response.status, 400, JSON.stringify(bad));
        assert.equal(database.snapshot()[0]?.["speakingRate"], 1, `${JSON.stringify(bad)}: nothing saved`);
      } finally {
        await server.close();
      }
    }
  });

  it("not sending speakingRate keeps the saved one (changing only the voice, or only enabled)", async () => {
    const database = statefulSettingsDatabase([savedRow({ speakingRate: 1.25, enabled: true })]);
    const server = await startAdminRoute(database);
    try {
      const voiceOnly = await patch(server.url, { voiceName: ZEPHYR });
      assert.equal(voiceOnly.status, 200);
      assert.deepEqual([database.snapshot()[0]?.["voiceName"], database.snapshot()[0]?.["speakingRate"], database.snapshot()[0]?.["enabled"]], [ZEPHYR, 1.25, true]);

      const enabledOnly = await patch(server.url, { voiceName: ZEPHYR, enabled: false });
      assert.equal(enabledOnly.status, 200);
      assert.deepEqual([database.snapshot()[0]?.["speakingRate"], database.snapshot()[0]?.["enabled"]], [1.25, false]);
    } finally {
      await server.close();
    }
  });

  it("saving the speed does not touch enabled, and a rate and enabled can be sent together", async () => {
    const database = statefulSettingsDatabase([savedRow({ enabled: false })]);
    const server = await startAdminRoute(database);
    try {
      assert.equal((await patch(server.url, { voiceName: KORE, speakingRate: 1.5 })).status, 200);
      assert.deepEqual([database.snapshot()[0]?.["speakingRate"], database.snapshot()[0]?.["enabled"]], [1.5, false], "the switch stays off");
      assert.equal((await patch(server.url, { voiceName: KORE, speakingRate: 1.25, enabled: true })).status, 200);
      assert.deepEqual([database.snapshot()[0]?.["speakingRate"], database.snapshot()[0]?.["enabled"]], [1.25, true]);
    } finally {
      await server.close();
    }
  });

  it("voiceName rules are unchanged: a missing or unknown voice is still 400, with its own message", async () => {
    const database = statefulSettingsDatabase([savedRow()]);
    const server = await startAdminRoute(database);
    try {
      const missing = await patch(server.url, { speakingRate: 1.25 });
      assert.equal(missing.status, 400);
      assert.match(JSON.stringify(await missing.json()), /voiceName is required/);
      const unknown = await patch(server.url, { voiceName: "en-US-Chirp3-HD-Orus", speakingRate: 1.25 });
      assert.equal(unknown.status, 400);
      assert.match(JSON.stringify(await unknown.json()), /voiceName must be one of the curated options/);
      assert.equal(database.snapshot()[0]?.["speakingRate"], 1);
    } finally {
      await server.close();
    }
  });

  it("still needs an admin session", async () => {
    const server = await startAdminRoute(statefulSettingsDatabase([]));
    try {
      const response = await fetch(`${server.url}/api/admin/support-voice`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voiceName: KORE, speakingRate: 1.25 }),
      });
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });
});

describe("POST /admin/support-voice/preview: speakingRate", () => {
  function mockGoogle() {
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    const bodies: Array<{ audioConfig: Record<string, unknown>; voice: { name: string } }> = [];
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
      if (url.includes("texttospeech.googleapis.com")) {
        bodies.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ audioContent: Buffer.from([1, 2, 3]).toString("base64") }), { status: 200 });
      }
      return realFetch(input as never, init);
    });
    return bodies;
  }
  const preview = (url: string, body: unknown) =>
    fetch(`${url}/api/admin/support-voice/preview`, { method: "POST", headers: { cookie: cookie(), "content-type": "application/json" }, body: JSON.stringify(body) });

  it("speaks the preview at the speed it is given (1.25 reaches Google as audioConfig.speakingRate)", async () => {
    const bodies = mockGoogle();
    const server = await startAdminRoute(statefulSettingsDatabase([]));
    try {
      const response = await preview(server.url, { voiceName: ZEPHYR, speakingRate: 1.25 });
      assert.equal(response.status, 200);
      assert.equal(bodies[0]?.audioConfig["speakingRate"], 1.25);
      assert.equal(bodies[0]?.voice.name, ZEPHYR);
    } finally {
      delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
      await server.close();
    }
  });

  it("without a speed the preview is at normal speed, as before (no speakingRate is sent)", async () => {
    const bodies = mockGoogle();
    const server = await startAdminRoute(statefulSettingsDatabase([savedRow({ speakingRate: 1.25 })]));
    try {
      assert.equal((await preview(server.url, { voiceName: ZEPHYR })).status, 200);
      assert.equal("speakingRate" in (bodies[0]?.audioConfig ?? {}), false);
    } finally {
      delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
      await server.close();
    }
  });

  it("validates the preview speed exactly like saving: 0.5, 2.0, \"เร็ว\", 1.27 and null are 400 and nothing goes to Google", async () => {
    const bodies = mockGoogle();
    const server = await startAdminRoute(statefulSettingsDatabase([]));
    try {
      for (const bad of [0.5, 2.0, "เร็ว", 1.27, null]) {
        const response = await preview(server.url, { voiceName: ZEPHYR, speakingRate: bad });
        assert.equal(response.status, 400, JSON.stringify(bad));
        assert.match(JSON.stringify(await response.json()), /speakingRate must be a number from 0\.8 to 1\.5/);
      }
      assert.equal(bodies.length, 0, "no text-to-speech call was made for a refused speed");
    } finally {
      delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
      await server.close();
    }
  });
});

describe("the speed in the TTS layer", () => {
  it("parseSupportVoiceSpeakingRate accepts exactly the 15 values 0.80, 0.85 ... 1.50 and returns them rounded", () => {
    const grid = Array.from({ length: 15 }, (_, index) => Math.round((0.8 + index * 0.05) * 100) / 100);
    assert.deepEqual(grid.at(0), 0.8);
    assert.deepEqual(grid.at(-1), 1.5);
    for (const raw of Array.from({ length: 15 }, (_, index) => 0.8 + index * 0.05)) {
      const parsed = parseSupportVoiceSpeakingRate(raw);
      assert.ok(parsed !== null && grid.includes(parsed), `${raw} should be accepted`);
    }
    assert.equal(parseSupportVoiceSpeakingRate(1.25), 1.25);
    assert.equal(parseSupportVoiceSpeakingRate(0.8 + 9 * 0.05), 1.25, "a float that is 1.25 up to rounding error is stored as 1.25");
  });

  it("parseSupportVoiceSpeakingRate refuses everything off the grid or out of range, and non-numbers", () => {
    for (const bad of [0.75, 0.79, 0.81, 1.01, 1.27, 1.51, 1.55, 2, 0.5, 0, -1, Infinity, NaN, null, undefined, true, "1.25", "เร็ว", [], {}]) {
      assert.equal(parseSupportVoiceSpeakingRate(bad), null, String(bad));
    }
  });

  it("customers hear the saved speed: resolveVoiceConfig carries the row's 1.25 (and falls back to 1 when there is no row)", () => {
    assert.equal(resolveVoiceConfig({ voiceName: KORE, languageCode: "th-TH", speakingRate: 1.25 }).speakingRate, 1.25);
    assert.equal(resolveVoiceConfig(null).speakingRate, 1);
  });

  it("synthesizeSpeech sends speakingRate to Google only for a rate other than 1, and a preview override is honoured", async () => {
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = FAKE_CREDENTIALS_JSON;
    const sent: Array<Record<string, unknown>> = [];
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
      if (url.includes("texttospeech.googleapis.com")) {
        sent.push((JSON.parse(String(init?.body)) as { audioConfig: Record<string, unknown> }).audioConfig);
        return new Response(JSON.stringify({ audioContent: "AQID" }), { status: 200 });
      }
      throw new Error(`unexpected ${url}`);
    });
    try {
      assert.equal((await synthesizeSpeech("สวัสดีค่ะ", ZEPHYR, 1.25)).ok, true);
      assert.equal((await synthesizeSpeech("สวัสดีค่ะ", ZEPHYR)).ok, true);
      assert.equal((await synthesizeSpeech("สวัสดีค่ะ", ZEPHYR, 1)).ok, true);
      assert.deepEqual(sent, [{ audioEncoding: "MP3", speakingRate: 1.25 }, { audioEncoding: "MP3" }, { audioEncoding: "MP3" }]);
    } finally {
      delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
    }
  });
});

describe("the generated contract", () => {
  it("the PATCH body accepts speakingRate as an optional number in 0.8-1.5 and rejects the rest", () => {
    const base = { voiceName: KORE };
    assert.ok(UpdateBodySchema.safeParse(base).success, "optional");
    assert.ok(UpdateBodySchema.safeParse({ ...base, speakingRate: 1.25 }).success);
    assert.ok(UpdateBodySchema.safeParse({ ...base, speakingRate: 0.8 }).success);
    assert.ok(UpdateBodySchema.safeParse({ ...base, speakingRate: 1.5 }).success);
    for (const bad of [0.5, 2, "เร็ว", "1.25", null]) assert.ok(!UpdateBodySchema.safeParse({ ...base, speakingRate: bad }).success, String(bad));
  });

  it("openapi.yaml documents speakingRate on SupportVoiceUpdateInput with its range", async () => {
    const yaml = (await readFile(new URL("../../../lib/api-spec/openapi.yaml", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
    const block = yaml.match(/SupportVoiceUpdateInput:[\s\S]*?\n    SitePhoto:/)?.[0] ?? "";
    assert.match(block, /speakingRate:\s+type: number\s+minimum: 0\.8\s+maximum: 1\.5/);
  });
});
