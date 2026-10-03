import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import fsPromises from "node:fs/promises";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import express from "express";
import os from "node:os";
import path from "node:path";
import { importTypeScriptModule } from "./route-harness.ts";
import { quickPurchaseData, withPricingCatalog } from "./price-guard-fixtures.ts";

type LeadRouteModule = typeof import("../src/routes/leads.ts");

type StoredLead = Record<string, unknown> & {
  leadKey: string;
  quoteNumber: string | null;
};

function createFakeDatabase() {
  const records: StoredLead[] = [];
  let quoteCounter = 0;

  const database = {
    execute: async () => ({ rows: [{ last_value: ++quoteCounter }] }),
    select: () => {
      const builder = {
        from: () => builder,
        where: () => builder,
        limit: async () => records.map((record) => ({ quoteNumber: record.quoteNumber })),
      };
      return builder;
    },
    insert: () => {
      let values: StoredLead;
      const builder = {
        values(next: StoredLead) {
          values = next;
          return builder;
        },
        onConflictDoUpdate() {
          return builder;
        },
        returning: async () => {
          const existingIndex = records.findIndex((record) => record.leadKey === values.leadKey);
          const saved = { ...values, id: existingIndex + 1 };
          if (existingIndex >= 0) records[existingIndex] = saved;
          else records.push(saved);
          return [saved];
        },
      };
      return builder;
    },
    records,
  };

  return database;
}

async function startLeadsRoute(database: unknown) {
  const routeModule = await importTypeScriptModule<LeadRouteModule>("src/routes/leads.ts");
  const app = express();
  const errors: unknown[] = [];
  app.use(express.json());
  app.use("/api", routeModule.createLeadsRouter(withPricingCatalog(database as never) as never));
  app.use((
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    errors.push(error);
    res.status(500).json({ message: "Internal server error" });
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Lead route test server did not expose a TCP address");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    errors,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

const originalDatabaseUrl = process.env["DATABASE_URL"];
const originalSessionSecret = process.env["SESSION_SECRET"];

before(() => {
  process.env["DATABASE_URL"] = "postgres://lead-persistence-test";
  process.env["SESSION_SECRET"] = "lead-persistence-test-secret-32-chars-long";
});

after(() => {
  if (originalDatabaseUrl === undefined) delete process.env["DATABASE_URL"];
  else process.env["DATABASE_URL"] = originalDatabaseUrl;

  if (originalSessionSecret === undefined) delete process.env["SESSION_SECRET"];
  else process.env["SESSION_SECRET"] = originalSessionSecret;
});

describe("lead persistence", () => {
  it("returns and persists the complete tax and site details payload", async () => {
    const database = createFakeDatabase();
    const server = await startLeadsRoute(database);

    const payload = {
      leadKey: "lead-tax-site-regression",
      status: "quote_requested",
      source: "quote_builder",
      name: "คุณทดสอบ",
      company: "บริษัททดสอบ จำกัด",
      phone: "0812345678",
      lineContact: "@knight-customer",
      email: "customer@example.com",
      project: "คอนโดทดสอบ",
      address: "99 ถนนสุขุมวิท กรุงเทพฯ",
      site: "ห้องน้ำชั้น 18",
      purchasingDepartment: "ฝ่ายบัญชี",
      notes: "โทรก่อนเข้าหน้างาน",
      taxName: "บริษัททดสอบ จำกัด",
      taxId: "0105559012345",
      taxBranch: "สำนักงานใหญ่",
      taxAddress: "99 ถนนสุขุมวิท แขวงคลองตัน กรุงเทพฯ 10110",
      preferredContact: "line",
      customerRole: "homeowner",
      propertyType: "condo",
      condoFloor: "18",
      expectedInstallationDate: "2026-10-15",
      productSkus: ["KF001"],
      orderMode: "quick-purchase",
      studioData: quickPurchaseData(60990),
    };

    try {
      const response = await fetch(`${server.url}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const returned = await response.json() as Record<string, unknown>;

      assert.equal(response.status, 200);
      assert.deepEqual(
        Object.fromEntries([
          "taxName",
          "taxId",
          "taxBranch",
          "taxAddress",
          "preferredContact",
          "lineContact",
          "site",
          "purchasingDepartment",
          "customerRole",
          "propertyType",
          "condoFloor",
          "expectedInstallationDate",
        ].map((key) => [key, returned[key]])),
        {
          taxName: payload.taxName,
          taxId: payload.taxId,
          taxBranch: payload.taxBranch,
          taxAddress: payload.taxAddress,
          preferredContact: payload.preferredContact,
          lineContact: payload.lineContact,
          site: payload.site,
          purchasingDepartment: payload.purchasingDepartment,
          customerRole: payload.customerRole,
          propertyType: payload.propertyType,
          condoFloor: payload.condoFloor,
          expectedInstallationDate: payload.expectedInstallationDate,
        },
      );
      assert.deepEqual(
        Object.fromEntries([
          "taxName",
          "taxId",
          "taxBranch",
          "taxAddress",
          "preferredContact",
          "lineContact",
          "site",
          "purchasingDepartment",
          "customerRole",
          "propertyType",
          "condoFloor",
          "expectedInstallationDate",
        ].map((key) => [key, database.records[0]?.[key]])),
        Object.fromEntries([
          "taxName",
          "taxId",
          "taxBranch",
          "taxAddress",
          "preferredContact",
          "lineContact",
          "site",
          "purchasingDepartment",
          "customerRole",
          "propertyType",
          "condoFloor",
          "expectedInstallationDate",
        ].map((key) => [key, payload[key as keyof typeof payload]])),
      );
    } finally {
      await server.close();
    }
  });

  it("removes a sketch upload when the lead database write fails", async () => {
    const uploadDirectory = await mkdtemp(path.join(os.tmpdir(), "lead-sketch-persistence-"));
    const originalUploadDirectory = process.env["UPLOAD_DIR"];
    process.env["UPLOAD_DIR"] = uploadDirectory;
    const database = {
      insert: () => {
        const builder = {
          values: () => builder,
          onConflictDoUpdate: () => builder,
          returning: async () => {
            throw new Error("database unavailable");
          },
        };
        return builder;
      },
    };
    const server = await startLeadsRoute(database);

    const formData = new FormData();
    formData.append(
      "metadata",
      JSON.stringify({
        leadKey: "lead-sketch-database-failure",
        status: "quote_requested",
        source: "sketch_upload",
        name: "คุณทดสอบ",
        phone: "0812345678",
        project: "โครงการทดสอบ",
        productSkus: [],
        orderMode: "sketch",
      }),
    );
    formData.append("file", new Blob([Buffer.from("89504e470d0a1a0a", "hex")], { type: "image/png" }), "sketch.png");

    try {
      const response = await fetch(`${server.url}/api/leads/sketch`, {
        method: "POST",
        body: formData,
      });

      assert.equal(response.status, 500);
      assert.deepEqual(await readdir(uploadDirectory), []);
    } finally {
      await server.close();
      await rm(uploadDirectory, { force: true, recursive: true });
      if (originalUploadDirectory === undefined) delete process.env["UPLOAD_DIR"];
      else process.env["UPLOAD_DIR"] = originalUploadDirectory;
    }
  });

  it("returns a server error and cleans up when sketch storage write fails", async () => {
    const uploadDirectory = await mkdtemp(path.join(os.tmpdir(), "lead-sketch-write-"));
    const originalUploadDirectory = process.env["UPLOAD_DIR"];
    process.env["UPLOAD_DIR"] = uploadDirectory;
    const filesBefore = await readdir(uploadDirectory);
    const writeError = new Error("simulated sketch storage write failure");
    const originalOpen = fsPromises.open;
    let filesAtWriteFailure: string[] | undefined;
    const openMock = mock.method(
      fsPromises,
      "open",
      async (...args: Parameters<typeof fsPromises.open>) => {
        const handle = await originalOpen(...args);
        filesAtWriteFailure = await readdir(uploadDirectory);

        return new Proxy(handle, {
          get(target, property, receiver) {
            if (property === "writeFile") {
              return async () => {
                throw writeError;
              };
            }
            return Reflect.get(target, property, receiver);
          },
        });
      },
    );
    syncBuiltinESMExports();
    const server = await startLeadsRoute({});

    const formData = new FormData();
    formData.append(
      "metadata",
      JSON.stringify({
        leadKey: "lead-sketch-write-failure",
        status: "quote_requested",
        source: "sketch_upload",
        name: "คุณทดสอบ",
        phone: "0812345678",
        project: "โครงการทดสอบ",
        productSkus: [],
        orderMode: "sketch",
      }),
    );
    formData.append(
      "file",
      new Blob([Buffer.from("89504e470d0a1a0a", "hex")], { type: "image/png" }),
      "sketch.png",
    );

    try {
      const response = await fetch(`${server.url}/api/leads/sketch`, {
        method: "POST",
        body: formData,
      });

      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), {
        message: "Internal server error",
      });
      assert.strictEqual(server.errors.at(-1), writeError);
      assert.equal(filesAtWriteFailure?.length, filesBefore.length + 1);
      assert.deepEqual(await readdir(uploadDirectory), filesBefore);
    } finally {
      await server.close();
      openMock.mock.restore();
      syncBuiltinESMExports();
      await rm(uploadDirectory, { force: true, recursive: true });
      if (originalUploadDirectory === undefined) delete process.env["UPLOAD_DIR"];
      else process.env["UPLOAD_DIR"] = originalUploadDirectory;
    }
  });
});