import assert from "node:assert/strict";
import { createServer } from "node:http";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import { createAdminToken } from "../src/middlewares/admin-auth.ts";
import { importTypeScriptModule } from "./route-harness.ts";

const adminRoute = fileURLToPath(new URL("../src/routes/admin-router.ts", import.meta.url));

process.env["DATABASE_URL"] = process.env["DATABASE_URL"] || "postgres://dummy:dummy@127.0.0.1:5432/dummy";
process.env["SESSION_SECRET"] = process.env["SESSION_SECRET"] || "test-session-secret-for-admin-site-photos-delete";

async function startTestServer(app: express.Express) {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Bad address");
  const url = `http://127.0.0.1:${address.port}`;
  return {
    url,
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}

describe("DELETE /api/admin/site-photos/:id", async () => {
  const routeModule = await importTypeScriptModule<{
    createAdminRouter: (database: unknown) => express.RequestHandler;
  }>(adminRoute);

  const authCookie = `knight_admin_session=${createAdminToken()}`;

  it("rejects unauthorized callers with 401 when no session is present", async () => {
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use("/api", routeModule.createAdminRouter({} as any));

    const server = await startTestServer(app);
    try {
      const res = await fetch(`${server.url}/api/admin/site-photos/42`, { method: "DELETE" });
      assert.equal(res.status, 401);
    } finally {
      await server.close();
    }
  });

  it("rejects invalid non-integer photo IDs with 400", async () => {
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use("/api", routeModule.createAdminRouter({} as any));

    const server = await startTestServer(app);
    try {
      const res = await fetch(`${server.url}/api/admin/site-photos/not-an-id`, {
        method: "DELETE",
        headers: { cookie: authCookie }
      });
      assert.equal(res.status, 400);
      const body = (await res.json()) as { message: string };
      assert.match(body.message, /invalid/i);
    } finally {
      await server.close();
    }
  });

  it("returns 404 when the photo does not exist in the database", async () => {
    const mockDb = {
      delete: () => ({
        where: () => ({
          returning: async () => []
        })
      })
    };

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use("/api", routeModule.createAdminRouter(mockDb as any));

    const server = await startTestServer(app);
    try {
      const res = await fetch(`${server.url}/api/admin/site-photos/9999`, {
        method: "DELETE",
        headers: { cookie: authCookie }
      });
      assert.equal(res.status, 404);
      const body = (await res.json()) as { message: string };
      assert.match(body.message, /not found/i);
    } finally {
      await server.close();
    }
  });

  it("deletes the photo record from database and returns 200 with deletedId", async () => {
    const mockDb = {
      delete: () => ({
        where: () => ({
          returning: async () => [
            {
              id: 123,
              imageUrl: "/api/uploads/sample-photo.jpg",
              stage: "survey"
            }
          ]
        })
      })
    };

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use("/api", routeModule.createAdminRouter(mockDb as any));

    const server = await startTestServer(app);
    try {
      const res = await fetch(`${server.url}/api/admin/site-photos/123`, {
        method: "DELETE",
        headers: { cookie: authCookie }
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as { success: boolean; deletedId: number };
      assert.equal(body.success, true);
      assert.equal(body.deletedId, 123);
    } finally {
      await server.close();
    }
  });
});
