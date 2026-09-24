import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";

process.env["DATABASE_URL"] ??= "postgres://admin-lead-studio-update-test";

import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

type FakeLeadRecord = {
  id: number;
  status: string;
  notes: string | null;
  studioData: Record<string, unknown> | null;
  updatedAt?: unknown;
};

function createFakeLeadDatabase(initialRecord: FakeLeadRecord) {
  let record = initialRecord;
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
            record = { ...record, ...changes } as FakeLeadRecord;
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
    close: () => new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    }),
  };
}

describe("PATCH /api/admin/leads/:id with studioData (Task 30)", () => {
  const adminSecret = "test-session-secret-for-studio-data-task-30";
  let previousSecret: string | undefined;

  before(() => {
    previousSecret = process.env["SESSION_SECRET"];
    process.env["SESSION_SECRET"] = adminSecret;
  });

  after(() => {
    if (previousSecret === undefined) {
      delete process.env["SESSION_SECRET"];
    } else {
      process.env["SESSION_SECRET"] = previousSecret;
    }
  });

  it("merges studioData while preserving existing sketchUrls", async () => {
    const fakeDb = createFakeLeadDatabase({
      id: 99,
      status: "new_lead",
      notes: "ลูกค้าแนบแบบร่าง",
      studioData: {
        sketchUrls: ["https://example.com/sketch1.jpg", "https://example.com/sketch2.jpg"],
        source: "hand_sketch",
      },
    });

    const server = await startAdminRoute(fakeDb);
    try {
      const cookie = `knight_admin_session=${createAdminToken()}`;
      const studioPayload = {
        shape: "L-right",
        dimensions: { widthMm: 2040, lengthMm: 3170, depthMm: 620 },
        activeStone: "SG420",
        totalTHB: 31031,
      };

      const res = await fetch(`${server.url}/api/admin/leads/99`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({
          status: "selecting",
          notes: "ทีมขายวาดแบบใน Studio เรียบร้อย",
          studioData: studioPayload,
        }),
      });

      assert.equal(res.status, 200);
      const updated = (await res.json()) as FakeLeadRecord;
      assert.equal(updated.id, 99);
      assert.equal(updated.status, "selecting");
      assert.equal(updated.notes, "ทีมขายวาดแบบใน Studio เรียบร้อย");

      // ตรวจสอบว่า studioData ใหม่ถูก merge เข้าไป
      assert.equal((updated.studioData as any).shape, "L-right");
      assert.equal((updated.studioData as any).totalTHB, 31031);

      // ตรวจสอบว่า sketchUrls เดิมยังอยู่ครบ ไม่ถูกลบทับ
      assert.deepEqual((updated.studioData as any).sketchUrls, [
        "https://example.com/sketch1.jpg",
        "https://example.com/sketch2.jpg",
      ]);
      assert.equal((updated.studioData as any).source, "hand_sketch");
    } finally {
      await server.close();
    }
  });
});
