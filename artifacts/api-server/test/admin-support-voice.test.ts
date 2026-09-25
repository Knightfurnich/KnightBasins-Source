import assert from "node:assert/strict";
import { after, afterEach, before, describe, it, mock } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { resolveVoiceConfig, SUPPORT_VOICE_OPTIONS } from "../src/lib/google-tts.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type SupportVoiceSettingPayload = {
  voiceName: string;
  languageCode: string;
  speakingRate: number;
  updatedAt: string;
};

type SupportVoiceSettingsResponsePayload = {
  current: SupportVoiceSettingPayload;
  options: Array<{ voiceName: string; label: string }>;
};

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  ADMIN_PERMISSIONS: process.env["ADMIN_PERMISSIONS"],
  GOOGLE_TTS_VOICE_NAME: process.env["GOOGLE_TTS_VOICE_NAME"],
  GOOGLE_TTS_LANGUAGE_CODE: process.env["GOOGLE_TTS_LANGUAGE_CODE"],
};

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

type FakeVoiceRow = {
  id: number;
  voiceName: string;
  languageCode: string;
  speakingRate: number;
  updatedAt: Date;
};

/** Stateful in-memory fake for the single-row support_voice_settings table. */
function createFakeSupportVoiceDatabase(initialRows: FakeVoiceRow[]) {
  let rows = [...initialRows];
  let nextId = rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;

  return {
    select: () => ({
      from: () => ({
        orderBy: () => ({
          limit: async () => [...rows].sort((a, b) => b.id - a.id),
        }),
      }),
    }),
    insert: () => ({
      values: (data: Partial<FakeVoiceRow>) => ({
        returning: async () => {
          const now = new Date();
          const created: FakeVoiceRow = {
            id: nextId++,
            voiceName: data.voiceName ?? "",
            languageCode: data.languageCode ?? "th-TH",
            speakingRate: data.speakingRate ?? 1,
            updatedAt: now,
          };
          rows.push(created);
          return [created];
        },
      }),
    }),
    update: () => {
      let changes: Record<string, unknown> = {};
      const builder = {
        set(values: Record<string, unknown>) {
          changes = values;
          return builder;
        },
        where: (condition: unknown) => ({
          returning: async () => {
            const id = (condition as { queryChunks?: Array<{ value?: unknown }> } | undefined)?.queryChunks
              ?.find((chunk) => chunk?.constructor?.name === "Param")?.value;
            const index = rows.findIndex((row) => row.id === id);
            if (index === -1) return [];
            rows[index] = { ...rows[index], ...changes } as FakeVoiceRow;
            return [rows[index]];
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

before(() => {
  process.env["ADMIN_PASSWORD"] = "admin-support-voice-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-support-voice-test";
  process.env["SESSION_SECRET"] = "admin-support-voice-test-session-secret";
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
  delete process.env["GOOGLE_TTS_VOICE_NAME"];
  delete process.env["GOOGLE_TTS_LANGUAGE_CODE"];
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

// Mocking globalThis.fetch also intercepts this test file's own calls to the
// local admin server (same process, same global) -- same pattern
// support-speech-route.test.ts uses -- so anything that isn't the Google TTS
// URL must fall through to the real fetch.
const realFetch = globalThis.fetch;

describe("GET /admin/support-voice", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeSupportVoiceDatabase([]));
    try {
      const response = await fetch(`${server.url}/api/admin/support-voice`);
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("falls back to the default Kore voice when the table is empty", async () => {
    const server = await startAdminRoute(createFakeSupportVoiceDatabase([]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/support-voice`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as SupportVoiceSettingsResponsePayload;
      assert.equal(payload.current.voiceName, "th-TH-Chirp3-HD-Kore");
      assert.equal(payload.current.languageCode, "th-TH");
    } finally {
      await server.close();
    }
  });

  it("returns exactly the 5 curated female voice options", async () => {
    const server = await startAdminRoute(createFakeSupportVoiceDatabase([]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/support-voice`, { headers: { cookie } });
      const payload = await response.json() as SupportVoiceSettingsResponsePayload;
      assert.equal(payload.options.length, 5);
      assert.deepEqual(payload.options.map((option) => option.voiceName), SUPPORT_VOICE_OPTIONS.map((option) => option.voiceName));
      assert.ok(payload.options.every((option) => option.label.length > 0));
    } finally {
      await server.close();
    }
  });

  it("returns the saved row as current when one exists", async () => {
    const now = new Date("2026-09-25T00:00:00.000Z");
    const server = await startAdminRoute(createFakeSupportVoiceDatabase([
      { id: 1, voiceName: "th-TH-Chirp3-HD-Zephyr", languageCode: "th-TH", speakingRate: 1, updatedAt: now },
    ]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/support-voice`, { headers: { cookie } });
      const payload = await response.json() as SupportVoiceSettingsResponsePayload;
      assert.equal(payload.current.voiceName, "th-TH-Chirp3-HD-Zephyr");
    } finally {
      await server.close();
    }
  });
});

describe("PATCH /admin/support-voice", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeSupportVoiceDatabase([]));
    try {
      const response = await fetch(`${server.url}/api/admin/support-voice`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voiceName: "th-TH-Chirp3-HD-Autonoe" }),
      });
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("rejects a missing voiceName", async () => {
    const server = await startAdminRoute(createFakeSupportVoiceDatabase([]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/support-voice`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("rejects a voiceName that is not one of the 5 curated options", async () => {
    const server = await startAdminRoute(createFakeSupportVoiceDatabase([]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/support-voice`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ voiceName: "en-US-Chirp3-HD-Orus" }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("saves the new voice when the table already has a row", async () => {
    const now = new Date("2026-09-25T00:00:00.000Z");
    const server = await startAdminRoute(createFakeSupportVoiceDatabase([
      { id: 1, voiceName: "th-TH-Chirp3-HD-Kore", languageCode: "th-TH", speakingRate: 1, updatedAt: now },
    ]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/support-voice`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ voiceName: "th-TH-Chirp3-HD-Leda" }),
      });
      assert.equal(response.status, 200);
      const updated = await response.json() as SupportVoiceSettingPayload;
      assert.equal(updated.voiceName, "th-TH-Chirp3-HD-Leda");

      const getResponse = await fetch(`${server.url}/api/admin/support-voice`, { headers: { cookie } });
      const getPayload = await getResponse.json() as SupportVoiceSettingsResponsePayload;
      assert.equal(getPayload.current.voiceName, "th-TH-Chirp3-HD-Leda", "the change persists for the next GET");
    } finally {
      await server.close();
    }
  });

  it("creates the first row when the table starts empty", async () => {
    const server = await startAdminRoute(createFakeSupportVoiceDatabase([]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/support-voice`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ voiceName: "th-TH-Chirp3-HD-Despina" }),
      });
      assert.equal(response.status, 200);
      const created = await response.json() as SupportVoiceSettingPayload;
      assert.equal(created.voiceName, "th-TH-Chirp3-HD-Despina");
    } finally {
      await server.close();
    }
  });

  it("rejects with 403 for a session lacking leads:edit", async () => {
    const server = await startAdminRoute(createFakeSupportVoiceDatabase([]));
    process.env["ADMIN_ROLE"] = "viewer";
    process.env["ADMIN_PERMISSIONS"] = "leads";
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const getResponse = await fetch(`${server.url}/api/admin/support-voice`, { headers: { cookie } });
      assert.equal(getResponse.status, 403);

      const patchResponse = await fetch(`${server.url}/api/admin/support-voice`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ voiceName: "th-TH-Chirp3-HD-Autonoe" }),
      });
      assert.equal(patchResponse.status, 403);
    } finally {
      delete process.env["ADMIN_ROLE"];
      delete process.env["ADMIN_PERMISSIONS"];
      await server.close();
    }
  });
});

describe("POST /admin/support-voice/preview", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeSupportVoiceDatabase([]));
    try {
      const response = await fetch(`${server.url}/api/admin/support-voice/preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voiceName: "th-TH-Chirp3-HD-Kore" }),
      });
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("rejects a voiceName that is not one of the 5 curated options", async () => {
    const server = await startAdminRoute(createFakeSupportVoiceDatabase([]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/support-voice/preview`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ voiceName: "en-US-Chirp3-HD-Orus" }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("returns audio/mpeg bytes synthesized with the requested candidate voice", async () => {
    process.env["GOOGLE_TTS_API_KEY"] = "test-key";
    let capturedBody: Record<string, unknown> = {};
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("texttospeech.googleapis.com")) {
        capturedBody = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ audioContent: Buffer.from([1, 2, 3]).toString("base64") }), { status: 200 });
      }
      return realFetch(input as never, init);
    });

    const server = await startAdminRoute(createFakeSupportVoiceDatabase([]));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/support-voice/preview`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ voiceName: "th-TH-Chirp3-HD-Zephyr" }),
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "audio/mpeg");
      assert.equal((capturedBody["voice"] as { name: string }).name, "th-TH-Chirp3-HD-Zephyr", "previews the candidate voice, not the currently-saved one");
    } finally {
      delete process.env["GOOGLE_TTS_API_KEY"];
      await server.close();
    }
  });
});

/**
 * synthesizeSpeech() only reaches the real database through a thin,
 * impossible-to-fake-without-Postgres wrapper (see google-tts.ts), so the
 * strongest honest proof that "synthesizeSpeech uses the voice most
 * recently saved from the DB" is to exercise resolveVoiceConfig() directly
 * with exactly the row shapes the DB read hands it (a saved row, and null
 * for an empty/unreachable table) -- this is the same pure function
 * synthesizeSpeech calls with whatever it read.
 */
describe("resolveVoiceConfig (the DB-driven voice-selection logic synthesizeSpeech uses)", () => {
  it("uses the most recently saved DB row's voice, not the hardcoded default", () => {
    const config = resolveVoiceConfig({ voiceName: "th-TH-Chirp3-HD-Zephyr", languageCode: "th-TH", speakingRate: 1 });
    assert.equal(config.voiceName, "th-TH-Chirp3-HD-Zephyr");
  });

  it("falls back to th-TH-Chirp3-HD-Kore when there is no saved row (empty or unreachable table)", () => {
    delete process.env["GOOGLE_TTS_VOICE_NAME"];
    const config = resolveVoiceConfig(null);
    assert.equal(config.voiceName, "th-TH-Chirp3-HD-Kore");
  });

  it("still honors the GOOGLE_TTS_VOICE_NAME ops override when there is no saved row", () => {
    process.env["GOOGLE_TTS_VOICE_NAME"] = "th-TH-Chirp3-HD-Autonoe";
    try {
      const config = resolveVoiceConfig(null);
      assert.equal(config.voiceName, "th-TH-Chirp3-HD-Autonoe");
    } finally {
      delete process.env["GOOGLE_TTS_VOICE_NAME"];
    }
  });
});
