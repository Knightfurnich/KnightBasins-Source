import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
};

const adminRoute = fileURLToPath(
  new URL("../src/routes/admin-router.ts", import.meta.url),
);

function createFakeLeadDatabase(initial: { id: number; status: string; notes: string | null; studioData: Record<string, unknown> | null }) {
  let record = { ...initial };

  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ studioData: record.studioData }],
        }),
      }),
    }),
    update: () => {
      let changes: Record<string, unknown> = {};
      const builder = {
        set(values: Record<string, unknown>) {
          changes = values;
          return builder;
        },
        where: () => ({
          returning: async () => {
            record = { ...record, ...changes } as typeof record;
            return [record];
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
  const server = await new Promise<ReturnType<typeof app.listen>>(
    (resolve, reject) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
      listener.once("error", reject);
    },
  );
  const address = server.address();

  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Admin route test server did not expose a TCP address");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

before(() => {
  process.env["ADMIN_PASSWORD"] = "admin-leads-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-leads-test";
  process.env["SESSION_SECRET"] = "admin-leads-test-session-secret";
});

after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("admin lead dimensions", () => {
  it("merges staff dimensions into studioData without losing existing keys", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({
      id: 7,
      status: "new_lead",
      notes: null,
      studioData: { sketchUrls: ["/api/uploads/sketch-a.png", "/api/uploads/sketch-b.png"] },
    }));
    const cookie = `knight_admin_session=${createAdminToken()}`;

    try {
      const response = await fetch(`${server.url}/api/admin/leads/7`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          status: "selecting",
          notes: "วัดขนาดจากภาพแล้ว",
          staffDimensions: { widthMm: 600, lengthMm: 1800, depthMm: 200 },
        }),
      });
      assert.equal(response.status, 200);
      const payload = await response.json() as {
        status: string;
        notes: string | null;
        studioData: { sketchUrls?: string[]; staffDimensions?: { widthMm?: number; lengthMm?: number; depthMm?: number } };
      };
      assert.equal(payload.status, "selecting");
      assert.equal(payload.notes, "วัดขนาดจากภาพแล้ว");
      assert.deepEqual(payload.studioData.sketchUrls, ["/api/uploads/sketch-a.png", "/api/uploads/sketch-b.png"]);
      assert.deepEqual(payload.studioData.staffDimensions, { widthMm: 600, lengthMm: 1800, depthMm: 200 });
    } finally {
      await server.close();
    }
  });

  it("leaves studioData untouched when staffDimensions is omitted", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({
      id: 8,
      status: "new_lead",
      notes: null,
      studioData: { sketchUrls: ["/api/uploads/sketch-c.png"], staffDimensions: { widthMm: 500 } },
    }));
    const cookie = `knight_admin_session=${createAdminToken()}`;

    try {
      const response = await fetch(`${server.url}/api/admin/leads/8`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ status: "closed", notes: "ปิดการขาย" }),
      });
      assert.equal(response.status, 200);
      const payload = await response.json() as { studioData: { staffDimensions?: { widthMm?: number } } };
      assert.deepEqual(payload.studioData.staffDimensions, { widthMm: 500 });
    } finally {
      await server.close();
    }
  });
});
