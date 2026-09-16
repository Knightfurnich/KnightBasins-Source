import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { LINE_PRODUCTION_CALLBACK_URL } from "../src/lib/line-config.ts";
import {
  importTypeScriptModule,
  serveTypeScriptRoute,
} from "./route-harness.ts";

type HealthCheckSchemaModule = {
  HealthCheckResponse: {
    safeParse: (value: unknown) => { success: boolean };
  };
};

const ORIGINAL_ENV = {
  NODE_ENV: process.env["NODE_ENV"],
  LINE_CHANNEL_ID: process.env["LINE_CHANNEL_ID"],
  LINE_CHANNEL_SECRET: process.env["LINE_CHANNEL_SECRET"],
  LINE_CALLBACK_URL: process.env["LINE_CALLBACK_URL"],
};

const healthRoute = fileURLToPath(
  new URL("../src/routes/health.ts", import.meta.url),
);
const healthSchema = fileURLToPath(
  new URL("../../../lib/api-zod/src/index.ts", import.meta.url),
);

function setLineEnvironment(values: {
  nodeEnv: string;
  channelId?: string;
  channelSecret?: string;
  callbackUrl?: string;
}) {
  process.env["NODE_ENV"] = values.nodeEnv;
  process.env["LINE_CHANNEL_ID"] = values.channelId;
  process.env["LINE_CHANNEL_SECRET"] = values.channelSecret;
  process.env["LINE_CALLBACK_URL"] = values.callbackUrl;
}

function restoreEnvironment() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

before(() => {
  delete process.env["NODE_ENV"];
  delete process.env["LINE_CHANNEL_ID"];
  delete process.env["LINE_CHANNEL_SECRET"];
  delete process.env["LINE_CALLBACK_URL"];
});

after(() => {
  restoreEnvironment();
});

describe("GET /api/healthz", () => {
  it("returns a degraded, schema-valid response without LINE credentials", async () => {
    const channelId = "line-channel-id-route-test";
    const channelSecret = "line-channel-secret-route-test";
    setLineEnvironment({
      nodeEnv: "production",
      channelId,
      channelSecret,
      callbackUrl: "https://wrong.example.com/api/auth/line/callback",
    });

    const schemaModule =
      await importTypeScriptModule<HealthCheckSchemaModule>(healthSchema);
    const server = await serveTypeScriptRoute(healthRoute);

    try {
      const response = await fetch(`${server.url}/api/healthz`);
      const body: unknown = await response.json();

      assert.equal(response.status, 503);
      assert.equal(
        schemaModule.HealthCheckResponse.safeParse(body).success,
        true,
      );
      assert.deepEqual(body, {
        status: "degraded",
        lineLogin: {
          ready: false,
          channelConfigured: true,
          secretConfigured: true,
          callbackUrlConfigured: true,
          callbackUrlValid: false,
          callbackEnvironment: "invalid",
          callbackReason: "unexpected_host",
        },
      });

      const serializedBody = JSON.stringify(body);
      assert.equal(serializedBody.includes(channelId), false);
      assert.equal(serializedBody.includes(channelSecret), false);
    } finally {
      await server.close();
    }
  });

  it("keeps the healthy response on the production callback configuration", async () => {
    setLineEnvironment({
      nodeEnv: "production",
      channelId: "line-channel-id-route-test",
      channelSecret: "line-channel-secret-route-test",
      callbackUrl: LINE_PRODUCTION_CALLBACK_URL,
    });

    const server = await serveTypeScriptRoute(healthRoute);

    try {
      const response = await fetch(`${server.url}/api/healthz`);
      const body = (await response.json()) as { status: string };

      assert.equal(response.status, 200);
      assert.equal(body.status, "ok");
    } finally {
      await server.close();
    }
  });
});
