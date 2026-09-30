import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { checkLeadFinancialLock } from "../src/lib/financial-safety.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type AdminRouteModule = {
  createAdminRouter: (database: unknown) => Parameters<typeof express["use"]>[1];
};

type Lead = { id: number; [key: string]: unknown };
type Slip = {
  id: number;
  leadId: number | null;
  status: string;
  claimedAmountThb?: number | null;
  verifiedAmountThb?: number | null;
};

const tableName = (table: object) => table[Symbol.for("drizzle:Name") as keyof object] as string;

// Drizzle where() conditions are SQL fragment trees. This fake only needs to resolve
// "eq(paymentSlips.leadId, N)" (optionally combined with and()/ne()), so flatten every
// nested SQL fragment into one token stream and look for the "lead_id" column followed
// by its numeric parameter. Array-valued params (e.g. inArray(...)) are deliberately
// excluded, matching the pattern used in admin-payment-slip-route.test.ts.
function flattenQueryChunks(node: unknown, out: unknown[] = []): unknown[] {
  const chunks = (node as { queryChunks?: unknown[] } | undefined)?.queryChunks;
  if (!Array.isArray(chunks)) return out;
  for (const chunk of chunks) {
    if ((chunk as { queryChunks?: unknown[] } | undefined)?.queryChunks) flattenQueryChunks(chunk, out);
    else out.push(chunk);
  }
  return out;
}

function isParamChunk(candidate: unknown): candidate is { value: unknown } {
  return Boolean(candidate) && typeof candidate === "object" && "value" in (candidate as object) && !Array.isArray((candidate as { value: unknown }).value);
}

function valueFromCondition(condition: unknown, columnName: string): unknown {
  const flat = flattenQueryChunks(condition);
  for (let index = 0; index < flat.length; index += 1) {
    if ((flat[index] as { name?: string } | undefined)?.name !== columnName) continue;
    for (let lookahead = index + 1; lookahead < flat.length; lookahead += 1) {
      const candidate = flat[lookahead];
      if ((candidate as { name?: string } | undefined)?.name) break;
      if (isParamChunk(candidate)) return candidate.value;
    }
  }
  return undefined;
}

function createFakeDatabase(options: { leads?: Lead[]; slips?: Slip[] }) {
  const state = {
    leads: [...(options.leads ?? [])],
    slips: [...(options.slips ?? [])],
  };

  const database = {
    select: (..._columns: unknown[]) => {
      let sourceName = "";
      const builder: Record<string, (...args: any[]) => any> = {
        from(table: object) {
          sourceName = tableName(table);
          return builder;
        },
        where(condition?: unknown) {
          if (sourceName !== "payment_slips") return builder;
          const leadId = valueFromCondition(condition, "lead_id");
          const rows = state.slips.filter((slip) =>
            slip.status !== "voided" && (leadId === undefined || slip.leadId === leadId),
          );
          return Promise.resolve(rows);
        },
        orderBy: async () => {
          if (sourceName === "customer_leads") return state.leads;
          return [];
        },
      };
      return builder;
    },
    delete: (table: object) => {
      const sourceName = tableName(table);
      return {
        where: (condition?: unknown) => ({
          returning: async () => {
            if (sourceName !== "customer_leads") return [];
            const id = valueFromCondition(condition, "id");
            const index = state.leads.findIndex((lead) => lead.id === id);
            if (index === -1) return [];
            const [deleted] = state.leads.splice(index, 1);
            return [deleted];
          },
        }),
      };
    },
  };

  return { database, state };
}

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

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

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
};

before(() => {
  process.env["ADMIN_PASSWORD"] = "financial-safety-test-password";
  process.env["DATABASE_URL"] = "postgres://financial-safety-test";
  process.env["SESSION_SECRET"] = "financial-safety-test-session-secret";
});

after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("checkLeadFinancialLock", () => {
  it("returns isLocked: false with zero counts when the lead has no payment slips", async () => {
    const { database } = createFakeDatabase({ slips: [] });
    const result = await checkLeadFinancialLock(database, 7);
    assert.deepEqual(result, { isLocked: false, slipCount: 0, totalAmountThb: 0 });
  });

  it("returns isLocked: true with the slip count and total amount when slips are attached", async () => {
    const { database } = createFakeDatabase({
      slips: [
        { id: 1, leadId: 7, status: "team_reported_paid", claimedAmountThb: 5000, verifiedAmountThb: null },
        { id: 2, leadId: 7, status: "verified", claimedAmountThb: 3000, verifiedAmountThb: 3200 },
      ],
    });
    const result = await checkLeadFinancialLock(database, 7);
    assert.equal(result.isLocked, true);
    assert.equal(result.slipCount, 2);
    assert.equal(result.totalAmountThb, 8200);
    assert.match(result.reason ?? "", /2 ใบ/);
    assert.match(result.reason ?? "", /8200 บาท/);
    assert.match(result.reason ?? "", /ไม่สามารถลบงานนี้ได้/);
  });

  it("ignores voided slips and slips belonging to a different lead", async () => {
    const { database } = createFakeDatabase({
      slips: [
        { id: 3, leadId: 7, status: "voided", claimedAmountThb: 9999 },
        { id: 4, leadId: 8, status: "team_reported_paid", claimedAmountThb: 1000 },
      ],
    });
    const result = await checkLeadFinancialLock(database, 7);
    assert.deepEqual(result, { isLocked: false, slipCount: 0, totalAmountThb: 0 });
  });
});

describe("DELETE /admin/leads/:id financial safety lock", () => {
  it("deletes a lead with no payment slips and returns 200", async () => {
    const { database, state } = createFakeDatabase({
      leads: [{ id: 10, status: "new_lead" }],
      slips: [],
    });
    const server = await startAdminRoute(database);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/10`, { method: "DELETE", headers: { cookie } });
      const body = await response.json() as { success: boolean; deletedId: number };
      assert.equal(response.status, 200);
      assert.deepEqual(body, { success: true, deletedId: 10 });
      assert.equal(state.leads.some((lead) => lead.id === 10), false);
    } finally {
      await server.close();
    }
  });

  it("rejects deletion with 409 Conflict and a Thai reason when a payment slip is attached", async () => {
    const { database, state } = createFakeDatabase({
      leads: [{ id: 11, status: "new_lead" }],
      slips: [{ id: 5, leadId: 11, status: "team_reported_paid", claimedAmountThb: 15000 }],
    });
    const server = await startAdminRoute(database);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/11`, { method: "DELETE", headers: { cookie } });
      const body = await response.json() as { message: string; slipCount: number; totalAmountThb: number };
      assert.equal(response.status, 409);
      assert.equal(body.slipCount, 1);
      assert.equal(body.totalAmountThb, 15000);
      assert.match(body.message, /ไม่สามารถลบงานนี้ได้เนื่องจากมีสลิปโอนเงินผูกอยู่จำนวน 1 ใบ/);
      assert.match(body.message, /15000 บาท/);
      assert.equal(state.leads.some((lead) => lead.id === 11), true);
    } finally {
      await server.close();
    }
  });

  it("returns 404 when the lead does not exist and no slips block it either", async () => {
    const { database } = createFakeDatabase({ leads: [], slips: [] });
    const server = await startAdminRoute(database);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/999`, { method: "DELETE", headers: { cookie } });
      assert.equal(response.status, 404);
    } finally {
      await server.close();
    }
  });
});

describe("GET /admin/leads hasMatchedSlip / paymentSlipCount", () => {
  it("reports hasMatchedSlip and paymentSlipCount per lead based on non-voided payment slips", async () => {
    const { database } = createFakeDatabase({
      leads: [
        { id: 20, status: "new_lead", updatedAt: new Date(), createdAt: new Date() },
        { id: 21, status: "new_lead", updatedAt: new Date(), createdAt: new Date() },
      ],
      slips: [
        { id: 30, leadId: 20, status: "team_reported_paid", claimedAmountThb: 1000 },
        { id: 31, leadId: 20, status: "verified", claimedAmountThb: 2000 },
        { id: 32, leadId: 21, status: "voided", claimedAmountThb: 9999 },
      ],
    });
    const server = await startAdminRoute(database);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads`, { headers: { cookie } });
      const leads = await response.json() as Array<{ id: number; hasMatchedSlip: boolean; paymentSlipCount: number }>;
      assert.equal(response.status, 200);
      const byId = new Map(leads.map((lead) => [lead.id, lead]));
      assert.equal(byId.get(20)?.hasMatchedSlip, true);
      assert.equal(byId.get(20)?.paymentSlipCount, 2);
      assert.equal(byId.get(21)?.hasMatchedSlip, false);
      assert.equal(byId.get(21)?.paymentSlipCount, 0);
    } finally {
      await server.close();
    }
  });
});
