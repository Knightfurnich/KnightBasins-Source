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

type CatalogRecord = Record<string, unknown> & {
  id: number;
  active: boolean;
  sortOrder: number;
};

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env["ADMIN_PASSWORD"],
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
};

const adminRoute = fileURLToPath(
  new URL("../src/routes/admin-router.ts", import.meta.url),
);

function createFakeDatabase(initial: CatalogRecord) {
  let record = initial;

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
            record = { ...record, ...changes };
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
  process.env["ADMIN_PASSWORD"] = "admin-route-test-password";
  process.env["DATABASE_URL"] = "postgres://admin-route-test";
  process.env["SESSION_SECRET"] = "admin-route-test-session-secret";
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

describe("admin archive routes", () => {
  for (const fixture of [
    {
      label: "basins",
      path: "/admin/basins/41",
      record: {
        id: 41,
        sku: "KF041",
        colorCode: "WHITE",
        colorName: "White",
        priceTHB: 1000,
        category: "counter basin",
        dimensions: "500 × 500",
        basinDimensions: null,
        bowlMm: null,
        imageTone: "#fff",
        active: true,
        sortOrder: 1,
      },
      body: {
        sku: "KF041",
        colorCode: "WHITE",
        colorName: "White",
        priceTHB: 1000,
        category: "counter basin",
        dimensions: "500 × 500",
        basinDimensions: null,
        bowlMm: null,
        imageTone: "#fff",
        sortOrder: 1,
      },
    },
    {
      label: "installed stones",
      path: "/admin/installed-stones/42",
      record: {
        id: 42,
        code: "IS042",
        name: "Stone",
        pricePerSqmTHB: 2000,
        categoryId: null,
        tone: "#ddd",
        aliases: [],
        active: true,
        sortOrder: 1,
      },
      body: {
        code: "IS042",
        name: "Stone",
        pricePerSqmTHB: 2000,
        categoryId: null,
        tone: "#ddd",
        aliases: [],
        sortOrder: 1,
      },
    },
    {
      label: "sheet stones",
      path: "/admin/sheet-stones/43",
      record: {
        id: 43,
        code: "SS043",
        name: "Sheet stone",
        basePriceTHB: 3000,
        price10PlusTHB: 2800,
        price50PlusTHB: 2500,
        tone: "#ccc",
        aliases: [],
        active: true,
        sortOrder: 1,
      },
      body: {
        code: "SS043",
        name: "Sheet stone",
        basePriceTHB: 3000,
        price10PlusTHB: 2800,
        price50PlusTHB: 2500,
        tone: "#ccc",
        aliases: [],
        sortOrder: 1,
      },
    },
  ] as const) {
    it(`${fixture.label} archive and restore keep the same record`, async () => {
      const server = await startAdminRoute(createFakeDatabase(fixture.record));
      const cookie = `knight_admin_session=${createAdminToken()}`;

      try {
        const archiveResponse = await fetch(`${server.url}/api${fixture.path}`, {
          method: "PUT",
          headers: {
            cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({ ...fixture.body, active: false }),
        });
        const archived = (await archiveResponse.json()) as CatalogRecord;

        assert.equal(archiveResponse.status, 200);
        assert.equal(archived.id, fixture.record.id);
        assert.equal(archived.active, false);

        const restoreResponse = await fetch(`${server.url}/api${fixture.path}`, {
          method: "PUT",
          headers: {
            cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({ ...fixture.body, active: true }),
        });
        const restored = (await restoreResponse.json()) as CatalogRecord;

        assert.equal(restoreResponse.status, 200);
        assert.equal(restored.id, fixture.record.id);
        assert.equal(restored.active, true);
        assert.equal(restored.code ?? restored.sku, fixture.record.code ?? fixture.record.sku);
      } finally {
        await server.close();
      }
    });
  }

  it("rejects permanent deletion instead of removing an item", async () => {
    const server = await startAdminRoute(
      createFakeDatabase({
        id: 44,
        code: "DELETE-BLOCKED",
        active: true,
        sortOrder: 1,
      }),
    );
    const cookie = `knight_admin_session=${createAdminToken()}`;

    try {
      const response = await fetch(`${server.url}/api/admin/installed-stones/44`, {
        method: "DELETE",
        headers: { cookie },
      });

      assert.equal(response.status, 405);
      assert.match((await response.json()).message, /active=false/);
    } finally {
      await server.close();
    }
  });
});