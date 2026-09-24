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

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

type FakeLeadRecord = { id: number; status: string; notes: string | null; updatedAt?: unknown };

function createFakeLeadDatabase(record: FakeLeadRecord | null) {
  let current = record;
  return {
    update: () => {
      let changes: Record<string, unknown> = {};
      const builder = {
        set(values: Record<string, unknown>) {
          changes = values;
          return builder;
        },
        where: () => ({
          returning: async () => {
            if (!current) return [];
            current = { ...current, ...changes } as FakeLeadRecord;
            return [current];
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
  process.env["ADMIN_PASSWORD"] = "admin-lead-status-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-lead-status-test";
  process.env["SESSION_SECRET"] = "admin-lead-status-test-session-secret";
});

after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("PATCH /admin/leads/:id/status", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({ id: 1, status: "new_lead", notes: "เดิม" }));
    try {
      const response = await fetch(`${server.url}/api/admin/leads/1/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "selecting" }),
      });
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("updates only the status, leaving notes and everything else untouched", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({ id: 7, status: "new_lead", notes: "บันทึกเดิมต้องไม่หาย" }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/7/status`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ status: "selecting" }),
      });
      assert.equal(response.status, 200);
      const payload = await response.json() as FakeLeadRecord;
      assert.equal(payload.status, "selecting");
      assert.equal(payload.notes, "บันทึกเดิมต้องไม่หาย", "the lightweight endpoint must never touch notes");
    } finally {
      await server.close();
    }
  });

  it("accepts every real status value, including quote_sent and waiting_deposit which the admin dropdown doesn't offer directly", async () => {
    const cookie = `knight_admin_session=${createAdminToken()}`;
    for (const status of ["quote_sent", "waiting_deposit", "team_reported_paid", "deposit_paid", "ready_for_production", "closed"]) {
      const server = await startAdminRoute(createFakeLeadDatabase({ id: 1, status: "new_lead", notes: null }));
      try {
        const response = await fetch(`${server.url}/api/admin/leads/1/status`, {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ status }),
        });
        assert.equal(response.status, 200, `status "${status}" should be accepted`);
        const payload = await response.json() as FakeLeadRecord;
        assert.equal(payload.status, status);
      } finally {
        await server.close();
      }
    }
  });

  it("rejects a status value outside the real status domain", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({ id: 1, status: "new_lead", notes: null }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/1/status`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      assert.equal(response.status, 400, "\"completed\" is not a real lead status");
    } finally {
      await server.close();
    }
  });

  it("rejects a missing or non-string status", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({ id: 1, status: "new_lead", notes: null }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/1/status`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("rejects a non-numeric lead id", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase({ id: 1, status: "new_lead", notes: null }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/not-a-number/status`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ status: "selecting" }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("returns 404 when the lead does not exist", async () => {
    const server = await startAdminRoute(createFakeLeadDatabase(null));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/999/status`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ status: "selecting" }),
      });
      assert.equal(response.status, 404);
    } finally {
      await server.close();
    }
  });
});
