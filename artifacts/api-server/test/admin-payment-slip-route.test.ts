import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { createAdminApiKeySecret, hashAdminApiKey } from "../src/lib/admin-api-keys.ts";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

type StoredSlip = Record<string, unknown> & {
  id: number;
  leadId: number | null;
  status: string;
  archiveAttachmentId: string;
};

const tableName = (table: object) => table[Symbol.for("drizzle:Name") as keyof object] as string;
const image = Buffer.from("89504e470d0a1a0a00000000", "hex");
const sourceHash = createHash("sha256").update(image).digest("hex");
const adminRoute = new URL("../src/routes/admin-router.ts", import.meta.url).pathname;
const originalEnv = {
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
  UPLOAD_DIR: process.env["UPLOAD_DIR"],
  NODE_ENV: process.env["NODE_ENV"],
};
let uploadDirectory = "";

function createFakeDatabase(options: {
  slips?: StoredSlip[];
  leads?: Array<Record<string, unknown>>;
  revoked?: boolean;
}) {
  const secrets = createAdminApiKeySecret();
  const state = {
    slips: [...(options.slips ?? [])],
    leads: options.leads ?? [{ id: 7 }],
    references: [] as Array<Record<string, unknown>>,
    apiKey: {
      id: 1,
      name: "test worker",
      keyPrefix: secrets.keyPrefix,
      tokenHash: secrets.tokenHash,
      scopes: ["leads:edit"],
      revokedAt: options.revoked ? new Date() : null,
      expiresAt: null,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
  const apiKeys = [state.apiKey];

  const database = {
    select: () => {
      let sourceName = "";
      const builder: Record<string, (...args: any[]) => any> = {
        from(table: object) {
          sourceName = tableName(table);
          return builder;
        },
        where() {
          return builder;
        },
        limit: async () => {
          if (sourceName === "admin_api_keys") return apiKeys;
          if (sourceName === "customer_leads") return state.leads.slice(0, 1);
          if (sourceName === "lead_external_references") return state.references.slice(0, 1);
          return state.slips.slice(0, 1);
        },
        orderBy: async () => {
          if (sourceName === "admin_api_keys") return [state.apiKey];
          if (sourceName === "payment_slips") return state.slips.filter((slip) => slip.leadId === null && slip.status !== "voided");
          return state.slips;
        },
      };
      return builder;
    },
    insert: (table: object) => {
      const sourceName = tableName(table);
      let values: Record<string, unknown> = {};
      const builder: Record<string, (...args: any[]) => any> = {
        values(next: Record<string, unknown>) {
          values = next;
          return builder;
        },
        onConflictDoNothing: async () => {
          if (sourceName === "lead_external_references" && !state.references.some((item) => item.normalizedValue === values.normalizedValue)) {
            state.references.push({ ...values, id: state.references.length + 1 });
          }
          return [];
        },
        returning: async () => {
          if (sourceName === "admin_api_keys") {
            const created = {
              ...values,
              id: apiKeys.length + 1,
              createdAt: new Date(),
              updatedAt: new Date(),
              revokedAt: null,
              lastUsedAt: null,
            };
            apiKeys.push(created as typeof state.apiKey);
            return [created];
          }
          if (sourceName !== "payment_slips") return [];
          const created = {
            ...values,
            id: state.slips.length ? Math.max(...state.slips.map((slip) => slip.id)) + 1 : 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as StoredSlip;
          state.slips.push(created);
          return [created];
        },
      };
      return builder;
    },
    update: (table: object) => {
      const sourceName = tableName(table);
      let changes: Record<string, unknown> = {};
      const builder: Record<string, (...args: any[]) => any> = {
        set(next: Record<string, unknown>) {
          changes = next;
          return builder;
        },
        where() {
          return builder;
        },
        returning: async () => {
          if (sourceName === "admin_api_keys") {
            const target = changes.revokedAt ? apiKeys.at(-1)! : apiKeys[0]!;
            Object.assign(target, changes);
            return [{ id: target.id }];
          }
          const slip = state.slips[0];
          if (!slip) return [];
          if (sourceName === "payment_slips" && changes.status === "voided" && slip.status !== "team_reported_paid") return [];
          if (sourceName === "payment_slips" && changes.leadId !== undefined && (slip.leadId !== null || slip.status === "voided")) return [];
          Object.assign(slip, changes);
          return [slip];
        },
      };
      return builder;
    },
    delete: () => ({ where: () => ({ returning: async () => [] }) }),
  };

  return { database, token: secrets.token, state, apiKeys };
}

async function startAdminRoute(database: unknown) {
  const routeModule = await importTypeScriptModule<AdminRouteModule>(adminRoute);
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", routeModule.createAdminRouter(database));
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
    throw new Error("Admin payment slip test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

function intakeForm(attachmentId: string, hash = sourceHash, referenceValue = "26/1234") {
  const form = new FormData();
  form.append("file", new Blob([image], { type: "image/png" }), "payment-slip.png");
  form.append("archiveAttachmentId", attachmentId);
  form.append("sourceHash", hash);
  form.append("referenceValue", referenceValue);
  form.append("claimedAmountThb", "12500");
  form.append("senderName", "David worker");
  return form;
}

async function request(url: string, token: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
}

before(async () => {
  process.env["DATABASE_URL"] = "postgres://admin-payment-slip-test";
  process.env["SESSION_SECRET"] = "admin-payment-slip-test-secret";
  process.env["NODE_ENV"] = "test";
  uploadDirectory = await mkdtemp(path.join(os.tmpdir(), "admin-payment-slip-route-"));
  process.env["UPLOAD_DIR"] = uploadDirectory;
});

after(async () => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(uploadDirectory, { force: true, recursive: true });
});

describe("admin payment slip intake and review routes", () => {
  it("accepts a valid worker intake as an unassigned team-reported slip", async () => {
    const fixture = createFakeDatabase({});
    const server = await startAdminRoute(fixture.database);
    try {
      const response = await request(`${server.url}/api/admin/slips/intake`, fixture.token, { method: "POST", body: intakeForm("attachment-valid") });
      const body = await response.json() as Record<string, unknown>;
      assert.equal(response.status, 201);
      assert.equal(body.status, "team_reported_paid");
      assert.equal(body.leadId, null);
      assert.equal(body.sourceType, "line_group_archive");
      assert.equal(fixture.state.slips.length, 1);
    } finally {
      await server.close();
    }
  });

  it("lets the owner create, list, and revoke a worker key without exposing it in list responses", async () => {
    const fixture = createFakeDatabase({});
    const server = await startAdminRoute(fixture.database);
    const sessionToken = createAdminToken();
    const sessionHeaders = { cookie: `knight_admin_session=${sessionToken}` };
    try {
      const createResponse = await fetch(`${server.url}/api/admin/api-keys`, {
        method: "POST",
        headers: { ...sessionHeaders, "content-type": "application/json" },
        body: JSON.stringify({ name: "David worker", expiresInDays: 30 }),
      });
      const created = await createResponse.json() as Record<string, unknown>;
      const listResponse = await fetch(`${server.url}/api/admin/api-keys`, { headers: sessionHeaders });
      const listed = await listResponse.json() as Array<Record<string, unknown>>;
      const revokeResponse = await fetch(`${server.url}/api/admin/api-keys/${created.id}`, { method: "DELETE", headers: sessionHeaders });

      assert.equal(createResponse.status, 201);
      assert.match(String(created.token), /^kbw_[A-Za-z0-9_-]{32,}$/);
      assert.equal(listResponse.status, 200);
      assert.equal("token" in (listed[0] ?? {}), false);
      assert.equal(revokeResponse.status, 204);
      assert.ok(fixture.apiKeys.find((key) => key.id === created.id)?.revokedAt);
    } finally {
      await server.close();
    }
  });

  it("rejects a revoked worker key before reading the uploaded file", async () => {
    const fixture = createFakeDatabase({ revoked: true });
    const server = await startAdminRoute(fixture.database);
    try {
      const response = await request(`${server.url}/api/admin/slips/intake`, fixture.token, { method: "POST", body: intakeForm("attachment-revoked") });
      assert.equal(response.status, 401);
      assert.equal(fixture.state.slips.length, 0);
    } finally {
      await server.close();
    }
  });

  it("rejects a source hash that does not match the uploaded image", async () => {
    const fixture = createFakeDatabase({});
    const server = await startAdminRoute(fixture.database);
    try {
      const response = await request(`${server.url}/api/admin/slips/intake`, fixture.token, { method: "POST", body: intakeForm("attachment-hash", "0".repeat(64)) });
      assert.equal(response.status, 400);
      assert.equal(fixture.state.slips.length, 0);
    } finally {
      await server.close();
    }
  });

  it("rejects an invalid job reference without saving a slip", async () => {
    const fixture = createFakeDatabase({});
    const server = await startAdminRoute(fixture.database);
    try {
      const response = await request(`${server.url}/api/admin/slips/intake`, fixture.token, { method: "POST", body: intakeForm("attachment-reference", sourceHash, "not-a-job") });
      assert.equal(response.status, 400);
      assert.equal(fixture.state.slips.length, 0);
    } finally {
      await server.close();
    }
  });

  it("returns 409 for a duplicate archive attachment and does not create another file", async () => {
    const fixture = createFakeDatabase({});
    const server = await startAdminRoute(fixture.database);
    try {
      const first = await request(`${server.url}/api/admin/slips/intake`, fixture.token, { method: "POST", body: intakeForm("attachment-duplicate") });
      const before = await readdir(uploadDirectory);
      const second = await request(`${server.url}/api/admin/slips/intake`, fixture.token, { method: "POST", body: intakeForm("attachment-duplicate") });
      const after = await readdir(uploadDirectory);
      assert.equal(first.status, 201);
      assert.equal(second.status, 409);
      assert.equal(fixture.state.slips.length, 1);
      assert.deepEqual(after, before);
    } finally {
      await server.close();
    }
  });

  it("assigns an unassigned slip to an existing lead and persists its job reference", async () => {
    const fixture = createFakeDatabase({
      slips: [{ id: 21, leadId: null, status: "team_reported_paid", archiveAttachmentId: "attachment-assign", referenceValue: "26/1234" }],
    });
    const server = await startAdminRoute(fixture.database);
    try {
      const response = await request(`${server.url}/api/admin/slips/21/assign`, fixture.token, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId: 7 }),
      });
      const body = await response.json() as Record<string, unknown>;
      assert.equal(response.status, 200);
      assert.equal(body.leadId, 7);
      assert.equal(fixture.state.references[0]?.normalizedValue, "26/1234");
    } finally {
      await server.close();
    }
  });

  it("returns 404 when assigning to a missing lead", async () => {
    const fixture = createFakeDatabase({
      leads: [],
      slips: [{ id: 22, leadId: null, status: "team_reported_paid", archiveAttachmentId: "attachment-missing-lead" }],
    });
    const server = await startAdminRoute(fixture.database);
    try {
      const response = await request(`${server.url}/api/admin/slips/22/assign`, fixture.token, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId: 999 }),
      });
      assert.equal(response.status, 404);
    } finally {
      await server.close();
    }
  });

  it("returns 409 when assigning an already assigned slip", async () => {
    const fixture = createFakeDatabase({
      slips: [{ id: 23, leadId: 7, status: "team_reported_paid", archiveAttachmentId: "attachment-assigned" }],
    });
    const server = await startAdminRoute(fixture.database);
    try {
      const response = await request(`${server.url}/api/admin/slips/23/assign`, fixture.token, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId: 7 }),
      });
      assert.equal(response.status, 409);
    } finally {
      await server.close();
    }
  });

  it("voids a team-reported slip and removes it from the unassigned queue", async () => {
    const fixture = createFakeDatabase({
      slips: [{ id: 24, leadId: null, status: "team_reported_paid", archiveAttachmentId: "attachment-void" }],
    });
    const server = await startAdminRoute(fixture.database);
    try {
      const voidResponse = await request(`${server.url}/api/admin/slips/24/void`, fixture.token, { method: "POST" });
      const listResponse = await request(`${server.url}/api/admin/slips/unassigned`, fixture.token);
      const body = await voidResponse.json() as Record<string, unknown>;
      const list = await listResponse.json() as unknown[];
      assert.equal(voidResponse.status, 200);
      assert.equal(body.status, "voided");
      assert.deepEqual(list, []);
    } finally {
      await server.close();
    }
  });

  it("does not allow a voided slip to be assigned or voided again", async () => {
    const fixture = createFakeDatabase({
      slips: [{ id: 25, leadId: null, status: "voided", archiveAttachmentId: "attachment-voided" }],
    });
    const server = await startAdminRoute(fixture.database);
    try {
      const assignResponse = await request(`${server.url}/api/admin/slips/25/assign`, fixture.token, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId: 7 }),
      });
      const voidResponse = await request(`${server.url}/api/admin/slips/25/void`, fixture.token, { method: "POST" });
      assert.equal(assignResponse.status, 409);
      assert.equal(voidResponse.status, 409);
    } finally {
      await server.close();
    }
  });
});