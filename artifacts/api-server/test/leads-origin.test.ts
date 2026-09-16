import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { importTypeScriptModule } from "./route-harness.ts";

type OriginModule = typeof import("../src/lib/public-origin.ts");

const originalEnv = {
  appOrigin: process.env["PUBLIC_APP_ORIGIN"],
  uploadOrigin: process.env["PUBLIC_UPLOAD_ORIGIN"],
  nodeEnv: process.env["NODE_ENV"],
};

afterEach(() => {
  for (const [key, value] of Object.entries({
    PUBLIC_APP_ORIGIN: originalEnv.appOrigin,
    PUBLIC_UPLOAD_ORIGIN: originalEnv.uploadOrigin,
    NODE_ENV: originalEnv.nodeEnv,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function module() {
  return importTypeScriptModule<OriginModule>("src/lib/public-origin.ts");
}

function request(protocol = "http", headers: Record<string, string> = {}) {
  return {
    protocol,
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  };
}

describe("public quote origin", () => {
  it("prefers PUBLIC_APP_ORIGIN and strips any path", async () => {
    process.env["NODE_ENV"] = "production";
    process.env["PUBLIC_APP_ORIGIN"] = "http://knightbasins.srv1964473.hstgr.cloud/quote/view";
    process.env["PUBLIC_UPLOAD_ORIGIN"] = "https://upload.example.test/api/uploads";

    assert.equal(
      (await module()).requestOrigin(request("http", { host: "internal:8080", "x-forwarded-proto": "http" })),
      "https://knightbasins.srv1964473.hstgr.cloud",
    );
  });

  it("uses the existing PUBLIC_UPLOAD_ORIGIN as the public app origin", async () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["PUBLIC_APP_ORIGIN"];
    process.env["PUBLIC_UPLOAD_ORIGIN"] = "https://knightbasins.srv1964473.hstgr.cloud/api/uploads";

    assert.equal(
      (await module()).requestOrigin(request("http", { host: "internal:8080", "x-forwarded-proto": "http" })),
      "https://knightbasins.srv1964473.hstgr.cloud",
    );
  });

  it("rejects production requests without a configured public origin", async () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["PUBLIC_APP_ORIGIN"];
    delete process.env["PUBLIC_UPLOAD_ORIGIN"];

    const originModule = await module();
    assert.throws(
      () => originModule.requestOrigin(request("http", { host: "public.example.test", "x-forwarded-proto": "http" })),
      /PUBLIC_APP_ORIGIN or PUBLIC_UPLOAD_ORIGIN/,
    );
  });

  it("keeps forwarded protocol behavior for development fallback", async () => {
    process.env["NODE_ENV"] = "development";
    delete process.env["PUBLIC_APP_ORIGIN"];
    delete process.env["PUBLIC_UPLOAD_ORIGIN"];

    assert.equal(
      (await module()).requestOrigin(request("http", { host: "localhost:8080", "x-forwarded-proto": "https, http" })),
      "https://localhost:8080",
    );
  });
});