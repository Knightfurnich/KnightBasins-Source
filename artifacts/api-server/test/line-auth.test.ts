import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  LINE_CALLBACK_PATH,
  LINE_CANONICAL_CALLBACK_URL,
  LINE_CANONICAL_HOST,
  LINE_LOCAL_CALLBACK_URL,
  LINE_PRODUCTION_CALLBACK_URL,
  LINE_PRODUCTION_HOST,
  getLineAuthDiagnostics,
  getLineHealthStatus,
  validateLineCallbackUrl,
} from "../src/lib/line-config.ts";

const ORIGINAL_ENV = {
  NODE_ENV: process.env["NODE_ENV"],
  LINE_CHANNEL_ID: process.env["LINE_CHANNEL_ID"],
  LINE_CHANNEL_SECRET: process.env["LINE_CHANNEL_SECRET"],
  LINE_CALLBACK_URL: process.env["LINE_CALLBACK_URL"],
};

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

describe("LINE callback URL validation", () => {
  it("accepts only the exact production callback URL", () => {
    setLineEnvironment({
      nodeEnv: "production",
      callbackUrl: LINE_PRODUCTION_CALLBACK_URL,
    });

    assert.deepEqual(validateLineCallbackUrl(), {
      valid: true,
      environment: "production",
      reason: "configured",
    });
    assert.equal(
      LINE_PRODUCTION_CALLBACK_URL,
      `https://${LINE_PRODUCTION_HOST}${LINE_CALLBACK_PATH}`,
    );
  });

  it("accepts the canonical knightbasins.com callback the LINE console now points at", () => {
    setLineEnvironment({
      nodeEnv: "production",
      callbackUrl: LINE_CANONICAL_CALLBACK_URL,
    });

    // The owner moved "Use LINE Login in your web app" to the canonical domain on
    // 8 Oct 2026; this host must be as acceptable as the legacy one, or the app
    // would refuse to build the authorize request it is now registered for.
    assert.deepEqual(validateLineCallbackUrl(), {
      valid: true,
      environment: "production",
      reason: "configured",
    });
    assert.equal(
      LINE_CANONICAL_CALLBACK_URL,
      `https://${LINE_CANONICAL_HOST}${LINE_CALLBACK_PATH}`,
    );
  });

  it("rejects malformed callback URLs", () => {
    setLineEnvironment({ nodeEnv: "production", callbackUrl: "not a URL" });

    assert.deepEqual(validateLineCallbackUrl(), {
      valid: false,
      environment: "invalid",
      reason: "malformed",
    });
  });

  it("rejects a callback URL on a different host", () => {
    setLineEnvironment({
      nodeEnv: "production",
      callbackUrl: "https://evil.example.com/api/auth/line/callback",
    });

    assert.deepEqual(validateLineCallbackUrl(), {
      valid: false,
      environment: "invalid",
      reason: "unexpected_host",
    });
  });

  it("allows the explicit localhost callback outside production", () => {
    setLineEnvironment({
      nodeEnv: "development",
      callbackUrl: LINE_LOCAL_CALLBACK_URL,
    });

    assert.deepEqual(validateLineCallbackUrl(), {
      valid: true,
      environment: "development",
      reason: "configured",
    });
  });

  it("does not allow the localhost callback in production", () => {
    setLineEnvironment({
      nodeEnv: "production",
      callbackUrl: LINE_LOCAL_CALLBACK_URL,
    });

    assert.deepEqual(validateLineCallbackUrl(), {
      valid: false,
      environment: "invalid",
      reason: "not_https",
    });
  });
});

describe("LINE diagnostics and health", () => {
  it("reports a degraded production health state when LINE is not ready", () => {
    const channelId = "line-channel-id-test-only";
    const channelSecret = "line-channel-secret-test-only";
    setLineEnvironment({
      nodeEnv: "production",
      channelId,
      channelSecret,
      callbackUrl: "https://wrong.example.com/api/auth/line/callback",
    });

    const diagnostics = getLineAuthDiagnostics();
    assert.equal(getLineHealthStatus(diagnostics), "degraded");
    assert.equal(diagnostics.ready, false);
    assert.equal(diagnostics.channelConfigured, true);
    assert.equal(diagnostics.secretConfigured, true);
    assert.equal(diagnostics.callbackUrlValid, false);
    assert.equal(diagnostics.callbackEnvironment, "invalid");
    assert.equal(diagnostics.callbackReason, "unexpected_host");

    const serialized = JSON.stringify(diagnostics);
    assert.equal(serialized.includes(channelId), false);
    assert.equal(serialized.includes(channelSecret), false);
  });

  it("exposes only booleans and callback diagnostics, never LINE credentials", () => {
    const channelId = "line-channel-id-never-return";
    const channelSecret = "line-channel-secret-never-return";
    setLineEnvironment({
      nodeEnv: "production",
      channelId,
      channelSecret,
      callbackUrl: LINE_PRODUCTION_CALLBACK_URL,
    });

    const diagnostics = getLineAuthDiagnostics();
    const serialized = JSON.stringify(diagnostics);

    assert.deepEqual(diagnostics, {
      ready: true,
      channelConfigured: true,
      secretConfigured: true,
      callbackUrlConfigured: true,
      callbackUrlValid: true,
      callbackEnvironment: "production",
      callbackReason: "configured",
    });
    assert.equal(serialized.includes(channelId), false);
    assert.equal(serialized.includes(channelSecret), false);
  });

});