import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { technicianTeams } from "@workspace/db/schema";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

type TechnicianTeamPayload = {
  id: number;
  code: string;
  name: string;
  shortName: string;
  aliases: string[];
  sortOrder: number;
  active: boolean;
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
};

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

type FakeTeamRow = {
  id: number;
  code: string;
  name: string;
  shortName: string;
  aliases: string[];
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** The 10 real teams, as migration 012 seeds them, so these tests exercise the same starting state production will have. */
function seedRows(): FakeTeamRow[] {
  const now = new Date("2026-09-24T00:00:00.000Z");
  const seed: Array<[string, string, string, string[], number]> = [
    ["TP", "ช่างยี่", "ยี่", ["แอนนี่"], 10],
    ["PP", "ช่างเนตร", "เนตร", [], 20],
    ["ST", "ช่างทู", "ทู", [], 30],
    ["CM", "ช่างเจมส์", "เจมส์", [], 40],
    ["KF", "ทีมโรงงาน", "โรงงาน", ["ออฟฟิศ", "ออฟฟิต"], 50],
    ["PA", "ช่างเปา", "เปา", [], 60],
    ["PM", "ช่างพร้อม", "พร้อม", [], 70],
    ["TJ", "ช่างกอล์ฟ", "กอล์ฟ", [], 80],
    ["AM", "ช่างเจ๋ง", "เจ๋ง", [], 90],
    ["CL", "ช่างชัยยา", "ชัยยา", [], 100],
  ];
  return seed.map(([code, name, shortName, aliases, sortOrder], index) => ({
    id: index + 1,
    code,
    name,
    shortName,
    aliases,
    sortOrder,
    active: true,
    createdAt: now,
    updatedAt: now,
  }));
}

/** Pulls { column, value } out of a drizzle eq(column, value) SQL condition -- good enough for the single-column equality checks admin-router.ts actually issues against this table. */
function extractEqCondition(condition: unknown): { column: string; value: unknown } | null {
  const chunks = (condition as { queryChunks?: unknown[] } | undefined)?.queryChunks;
  if (!Array.isArray(chunks)) return null;
  const column = chunks.find((chunk): chunk is { name: string } => Boolean(chunk) && typeof (chunk as { name?: unknown }).name === "string");
  const param = chunks.find((chunk): chunk is { value: unknown } => Boolean(chunk) && chunk?.constructor?.name === "Param");
  if (!column || !param) return null;
  return { column: column.name, value: param.value };
}

function sortedRows(rows: FakeTeamRow[]): FakeTeamRow[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

/** Stateful in-memory fake for the technician_teams table -- unlike the other admin-router fakes, GET/POST/PATCH here must actually round-trip through insert/update across calls within one test. */
function createFakeTechnicianTeamsDatabase(initialRows: FakeTeamRow[]) {
  let rows = [...initialRows];
  let nextId = rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;

  function whereResult(condition?: unknown) {
    const filtered = condition === undefined
      ? rows
      : rows.filter((row) => {
          const parsed = extractEqCondition(condition);
          if (!parsed) return true;
          return (row as unknown as Record<string, unknown>)[parsed.column] === parsed.value;
        });
    // Array + orderBy() so both `await ...where(cond)` (direct await, no orderBy) and `...where(cond).orderBy(...)` call sites work.
    return Object.assign([...filtered], {
      orderBy: async () => sortedRows(filtered),
    });
  }

  return {
    select: () => ({
      from: () => ({
        where: (condition?: unknown) => whereResult(condition),
      }),
    }),
    insert: () => ({
      values: (data: Partial<FakeTeamRow>) => ({
        returning: async () => {
          const now = new Date();
          const created: FakeTeamRow = {
            id: nextId++,
            code: data.code ?? "",
            name: data.name ?? "",
            shortName: data.shortName ?? "",
            aliases: data.aliases ?? [],
            sortOrder: data.sortOrder ?? 0,
            active: true,
            createdAt: now,
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
            const parsed = extractEqCondition(condition);
            if (!parsed) return [];
            const index = rows.findIndex((row) => (row as unknown as Record<string, unknown>)[parsed.column] === parsed.value);
            if (index === -1) return [];
            rows[index] = { ...rows[index], ...changes } as FakeTeamRow;
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
  process.env["ADMIN_PASSWORD"] = "admin-technician-teams-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-technician-teams-test";
  process.env["SESSION_SECRET"] = "admin-technician-teams-test-session-secret";
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
});

after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("GET /admin/technician-teams", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeTechnicianTeamsDatabase(seedRows()));
    try {
      const response = await fetch(`${server.url}/api/admin/technician-teams`);
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("returns the 10 seeded teams, sorted by sortOrder", async () => {
    const server = await startAdminRoute(createFakeTechnicianTeamsDatabase(seedRows()));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/technician-teams`, { headers: { cookie } });
      assert.equal(response.status, 200);
      const payload = await response.json() as TechnicianTeamPayload[];
      assert.equal(payload.length, 10);
      assert.deepEqual(payload.map((team) => team.code), ["TP", "PP", "ST", "CM", "KF", "PA", "PM", "TJ", "AM", "CL"]);
      assert.ok(payload.every((team) => team.active === true));
      assert.deepEqual(payload.find((team) => team.code === "KF")?.aliases, ["ออฟฟิศ", "ออฟฟิต"]);
    } finally {
      await server.close();
    }
  });
});

describe("POST /admin/technician-teams", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeTechnicianTeamsDatabase(seedRows()));
    try {
      const response = await fetch(`${server.url}/api/admin/technician-teams`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "NK", name: "ช่างใหม่", shortName: "ใหม่", aliases: [], sortOrder: 110 }),
      });
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("rejects a duplicate code", async () => {
    const server = await startAdminRoute(createFakeTechnicianTeamsDatabase(seedRows()));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/technician-teams`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ code: "TP", name: "ช่างซ้ำ", shortName: "ซ้ำ", aliases: [], sortOrder: 15 }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("rejects a lowercase code", async () => {
    const server = await startAdminRoute(createFakeTechnicianTeamsDatabase(seedRows()));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/technician-teams`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ code: "tp", name: "ช่างใหม่", shortName: "ใหม่", aliases: [], sortOrder: 110 }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("creates a new team with a full body", async () => {
    const server = await startAdminRoute(createFakeTechnicianTeamsDatabase(seedRows()));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/technician-teams`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ code: "NK", name: "ช่างใหม่", shortName: "ใหม่", aliases: ["ทีมใหม่"], sortOrder: 110 }),
      });
      assert.equal(response.status, 201);
      const created = await response.json() as TechnicianTeamPayload;
      assert.equal(created.code, "NK");
      assert.equal(created.name, "ช่างใหม่");
      assert.equal(created.active, true);

      const listResponse = await fetch(`${server.url}/api/admin/technician-teams`, { headers: { cookie } });
      const list = await listResponse.json() as TechnicianTeamPayload[];
      assert.equal(list.length, 11, "the new team joins the 10 seeded teams");
    } finally {
      await server.close();
    }
  });
});

describe("PATCH /admin/technician-teams/:id", () => {
  it("requires an authenticated admin session", async () => {
    const server = await startAdminRoute(createFakeTechnicianTeamsDatabase(seedRows()));
    try {
      const response = await fetch(`${server.url}/api/admin/technician-teams/1`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "ช่างใหม่2" }),
      });
      assert.equal(response.status, 401);
    } finally {
      await server.close();
    }
  });

  it("rejects an empty body", async () => {
    const server = await startAdminRoute(createFakeTechnicianTeamsDatabase(seedRows()));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/technician-teams/1`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("returns 404 for an id that does not exist", async () => {
    const server = await startAdminRoute(createFakeTechnicianTeamsDatabase(seedRows()));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/technician-teams/999`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: "ไม่มีจริง" }),
      });
      assert.equal(response.status, 404);
    } finally {
      await server.close();
    }
  });

  it("renames a team", async () => {
    const database = createFakeTechnicianTeamsDatabase(seedRows());
    const server = await startAdminRoute(database);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/technician-teams/1`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: "ช่างใหม่2" }),
      });
      assert.equal(response.status, 200);
      const updated = await response.json() as TechnicianTeamPayload;
      assert.equal(updated.name, "ช่างใหม่2");
      assert.equal(updated.code, "TP", "code cannot be changed via PATCH");
    } finally {
      await server.close();
    }
  });

  it("disables a team with { active: false }, hiding it from the default list but not from ?includeInactive=1", async () => {
    const database = createFakeTechnicianTeamsDatabase(seedRows());
    const server = await startAdminRoute(database);
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const patchResponse = await fetch(`${server.url}/api/admin/technician-teams/1`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ active: false }),
      });
      assert.equal(patchResponse.status, 200);
      const patched = await patchResponse.json() as TechnicianTeamPayload;
      assert.equal(patched.active, false);

      const defaultList = await (await fetch(`${server.url}/api/admin/technician-teams`, { headers: { cookie } })).json() as TechnicianTeamPayload[];
      assert.equal(defaultList.length, 9, "the disabled team drops out of the default (active-only) list");
      assert.ok(!defaultList.some((team) => team.code === "TP"));

      const fullList = await (await fetch(`${server.url}/api/admin/technician-teams?includeInactive=1`, { headers: { cookie } })).json() as TechnicianTeamPayload[];
      assert.equal(fullList.length, 10, "?includeInactive=1 brings the disabled team back");
      assert.ok(fullList.some((team) => team.code === "TP" && team.active === false));
    } finally {
      await server.close();
    }
  });
});

describe("PATCH /admin/leads/:id/technician validates against the technician_teams table", () => {
  function createFakeLeadDatabase(teamsDatabase: ReturnType<typeof createFakeTechnicianTeamsDatabase>, leadRecord: { id: number; technicianTeamCode: string | null }) {
    let current: typeof leadRecord | null = leadRecord;
    return {
      select: teamsDatabase.select,
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
              current = { ...current, ...changes } as typeof leadRecord;
              return [current];
            },
          }),
        };
        return builder;
      },
    };
  }

  it("rejects a technicianTeamCode that has no row in technician_teams", async () => {
    const teamsDatabase = createFakeTechnicianTeamsDatabase(seedRows());
    const server = await startAdminRoute(createFakeLeadDatabase(teamsDatabase, { id: 1, technicianTeamCode: null }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/1/technician`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ technicianTeamCode: "ZZ" }),
      });
      assert.equal(response.status, 400);
    } finally {
      await server.close();
    }
  });

  it("accepts a technicianTeamCode that is active: false (old jobs must stay editable)", async () => {
    const teamsDatabase = createFakeTechnicianTeamsDatabase(seedRows());
    await teamsDatabase.update().set({ active: false }).where(eq(technicianTeams.code, "TP")).returning();
    const server = await startAdminRoute(createFakeLeadDatabase(teamsDatabase, { id: 1, technicianTeamCode: null }));
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const response = await fetch(`${server.url}/api/admin/leads/1/technician`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ technicianTeamCode: "TP" }),
      });
      assert.equal(response.status, 200, "an inactive team's code must still be assignable to a lead");
      const payload = await response.json() as { technicianTeamCode: string | null };
      assert.equal(payload.technicianTeamCode, "TP");
    } finally {
      await server.close();
    }
  });
});

describe("permissions", () => {
  it("rejects every technician-teams endpoint with 403 for a session lacking leads:edit", async () => {
    const server = await startAdminRoute(createFakeTechnicianTeamsDatabase(seedRows()));
    process.env["ADMIN_ROLE"] = "viewer";
    process.env["ADMIN_PERMISSIONS"] = "leads";
    const cookie = `knight_admin_session=${createAdminToken()}`;
    try {
      const getResponse = await fetch(`${server.url}/api/admin/technician-teams`, { headers: { cookie } });
      assert.equal(getResponse.status, 403);

      const postResponse = await fetch(`${server.url}/api/admin/technician-teams`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ code: "NK", name: "ช่างใหม่", shortName: "ใหม่", aliases: [], sortOrder: 110 }),
      });
      assert.equal(postResponse.status, 403);

      const patchResponse = await fetch(`${server.url}/api/admin/technician-teams/1`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: "ช่างใหม่2" }),
      });
      assert.equal(patchResponse.status, 403);
    } finally {
      delete process.env["ADMIN_ROLE"];
      delete process.env["ADMIN_PERMISSIONS"];
      await server.close();
    }
  });
});
