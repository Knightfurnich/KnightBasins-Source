import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import { customerLeads, sitePhotos } from "@workspace/db/schema";
import { importTypeScriptModule } from "./route-harness.ts";

type LeadRouteModule = typeof import("../src/routes/leads.ts");
type QuoteAccessModule = typeof import("../src/lib/quote-access.ts");

type FakeLeadRow = {
  id: number;
  quoteNumber: string;
  quoteAccessSecret: string;
  name: string | null;
  project: string | null;
  phone: string | null;
  status: string;
  updatedAt: Date;
  studioData: unknown;
};

type FakePhotoRow = {
  id: number;
  imageUrl: string;
  caption: string | null;
  stage: string;
  takenAt: Date | null;
};

const QUOTE_NUMBER = "Sep 30 / US / 555111";

/** Dispatches on strict reference equality of the drizzle table object passed to
 * `.from(...)` -- leads.ts and this test both import the real, unmocked
 * `@workspace/db/schema` module, so `customerLeads`/`sitePhotos` resolve to the
 * exact same object in both places. Where-conditions are never inspected: each
 * test seeds only the lead/photos relevant to that lead, same shortcut
 * payment-slip-route.test.ts's createFakeDatabase already relies on. */
function createFakeDatabase(lead: FakeLeadRow | null, photos: FakePhotoRow[] = []) {
  return {
    select: (_columns?: unknown) => ({
      from: (table: unknown) => {
        if (table === sitePhotos) {
          return {
            where: () => ({
              orderBy: async () => photos,
            }),
          };
        }
        return {
          where: () => ({
            limit: async () => (lead ? [lead] : []),
          }),
        };
      },
    }),
  };
}

async function startLeadsRoute(database: unknown) {
  const routeModule = await importTypeScriptModule<LeadRouteModule>("src/routes/leads.ts");
  const app = express();
  app.use(express.json());
  app.use("/api", routeModule.createLeadsRouter(database as never));
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
    throw new Error("Public job tracking route test server did not expose a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function tokenFor(quoteNumber: string, accessSecret: string) {
  const quoteAccess = await importTypeScriptModule<QuoteAccessModule>("src/lib/quote-access.ts");
  return quoteAccess.createPublicQuoteToken(quoteNumber, accessSecret);
}

const originalEnv = {
  DATABASE_URL: process.env["DATABASE_URL"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
};
let uploadDirectory: string;

before(async () => {
  process.env["DATABASE_URL"] = "postgres://public-job-tracking-test";
  process.env["SESSION_SECRET"] = "public-job-tracking-test-secret";
  uploadDirectory = await mkdtemp(path.join(os.tmpdir(), "public-job-tracking-uploads-"));
  process.env["UPLOAD_DIR"] = uploadDirectory;
});

after(async () => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  delete process.env["UPLOAD_DIR"];
  await rm(uploadDirectory, { force: true, recursive: true });
});

afterEach(async () => {
  // Each test gets a clean visibility file -- otherwise a hide left behind by
  // one test would leak into the next test's default-visible expectations.
  await rm(path.join(uploadDirectory, "site_photos_visibility.json"), { force: true });
});

function baseLead(overrides: Partial<FakeLeadRow> = {}): FakeLeadRow {
  return {
    id: 42,
    quoteNumber: QUOTE_NUMBER,
    quoteAccessSecret: "a".repeat(64),
    name: "คุณทดสอบ",
    project: "คอนโดทดสอบ",
    phone: "0812345678",
    status: "closed",
    updatedAt: new Date("2026-09-25T03:00:00.000Z"),
    studioData: {
      state: {
        shape: "L",
        dimensions: { depthMm: 600, runAMm: 1800, runBMm: 1200, runCMm: 0 },
        activeStone: "KZ802",
        basinSkus: ["BS-01"],
      },
      estimate: { totalTHB: 999999, subtotalTHB: 900000 },
    },
    ...overrides,
  };
}

const PHOTOS: FakePhotoRow[] = [
  { id: 1, imageUrl: "https://example.com/site-photos/1.jpg", caption: "ก่อนติดตั้ง", stage: "survey", takenAt: new Date("2026-09-20T03:00:00.000Z") },
  { id: 2, imageUrl: "https://example.com/site-photos/2.jpg", caption: "ระหว่างติดตั้ง", stage: "installation", takenAt: new Date("2026-09-22T03:00:00.000Z") },
  { id: 3, imageUrl: "https://example.com/site-photos/3.jpg", caption: "งานเสร็จสมบูรณ์", stage: "completed", takenAt: new Date("2026-09-24T03:00:00.000Z") },
  { id: 4, imageUrl: "https://example.com/site-photos/4.jpg", caption: "งานเสร็จอีกมุม", stage: "completed", takenAt: new Date("2026-09-24T04:00:00.000Z") },
];

describe("GET /api/public/track", () => {
  it("returns 404 for a missing/garbage token", async () => {
    const server = await startLeadsRoute(createFakeDatabase(baseLead(), PHOTOS));
    try {
      const response = await fetch(`${server.url}/api/public/track?token=not-a-real-token`);
      assert.equal(response.status, 404);
    } finally {
      await server.close();
    }
  });

  it("returns 404 for a forged token whose access secret does not match the lead", async () => {
    const lead = baseLead({ quoteAccessSecret: "b".repeat(64) });
    const server = await startLeadsRoute(createFakeDatabase(lead, PHOTOS));
    try {
      // Structurally valid (well-signed) token, but for the wrong secret --
      // simulates an attacker who guesses/forges a quoteNumber+secret pair.
      const forgedToken = await tokenFor(QUOTE_NUMBER, "c".repeat(64));
      const response = await fetch(`${server.url}/api/public/track?token=${encodeURIComponent(forgedToken)}`);
      assert.equal(response.status, 404);
    } finally {
      await server.close();
    }
  });

  it("returns 404 when no lead matches the token's quoteNumber", async () => {
    const server = await startLeadsRoute(createFakeDatabase(null, []));
    try {
      const token = await tokenFor(QUOTE_NUMBER, "a".repeat(64));
      const response = await fetch(`${server.url}/api/public/track?token=${encodeURIComponent(token)}`);
      assert.equal(response.status, 404);
    } finally {
      await server.close();
    }
  });

  it("returns 200 with timeline, studio summary, and completed site photos for a valid token", async () => {
    const lead = baseLead();
    const server = await startLeadsRoute(createFakeDatabase(lead, PHOTOS));
    try {
      const token = await tokenFor(lead.quoteNumber, lead.quoteAccessSecret);
      const response = await fetch(`${server.url}/api/public/track?token=${encodeURIComponent(token)}`);
      assert.equal(response.status, 200);
      const body = await response.json() as Record<string, unknown>;

      assert.equal(body.jobCode, QUOTE_NUMBER);
      assert.equal(body.customerName, "คุณทดสอบ");
      assert.equal(body.projectName, "คอนโดทดสอบ");

      const timeline = body.timeline as Array<{ stage: string; done: boolean; active: boolean }>;
      assert.equal(timeline.length, 5);
      assert.deepEqual(timeline.map((step) => step.stage), [
        "quote_accepted",
        "in_production",
        "ready_to_install",
        "installing",
        "completed",
      ]);
      // status "closed" + a completed-stage photo -> every step done, none active.
      assert.ok(timeline.every((step) => step.done === true));
      assert.ok(timeline.every((step) => step.active === false));

      const studio = body.studio as Record<string, unknown>;
      assert.equal(studio.shape, "L");
      assert.equal(studio.stoneColor, "KZ802");
      assert.deepEqual(studio.basinSkus, ["BS-01"]);
      assert.deepEqual(studio.dimensionsMm, { depth: 600, runA: 1800, runB: 1200, runC: 0 });

      const returnedPhotos = body.sitePhotos as Array<{ id: number; stage: string }>;
      assert.deepEqual(returnedPhotos.map((photo) => photo.id).sort(), [3, 4]);
      assert.ok(returnedPhotos.every((photo) => photo.stage === "completed"));
    } finally {
      await server.close();
    }
  });

  it("masks the customer's phone number", async () => {
    const lead = baseLead({ phone: "0891234567" });
    const server = await startLeadsRoute(createFakeDatabase(lead, PHOTOS));
    try {
      const token = await tokenFor(lead.quoteNumber, lead.quoteAccessSecret);
      const response = await fetch(`${server.url}/api/public/track?token=${encodeURIComponent(token)}`);
      const body = await response.json() as Record<string, unknown>;
      assert.equal(body.phone, "08***67");
      assert.notEqual(body.phone, "0891234567");
    } finally {
      await server.close();
    }
  });

  it("never leaks internal fields: notes, tax info, quoteAccessSecret, or studio cost/profit", async () => {
    const lead = baseLead({});
    (lead as unknown as Record<string, unknown>)["notes"] = "ลูกค้าเรื่องมาก ต่อรองราคาหนัก";
    const server = await startLeadsRoute(createFakeDatabase(lead, PHOTOS));
    try {
      const token = await tokenFor(lead.quoteNumber, lead.quoteAccessSecret);
      const response = await fetch(`${server.url}/api/public/track?token=${encodeURIComponent(token)}`);
      const raw = await response.text();
      assert.ok(!raw.includes("ต่อรองราคาหนัก"), "internal notes must never appear in the public response");
      assert.ok(!raw.includes(lead.quoteAccessSecret), "the access secret must never be echoed back");
      assert.ok(!raw.includes("999999"), "studioData.estimate cost/profit fields must never be echoed back");
      assert.ok(!raw.includes("900000"), "studioData.estimate cost/profit fields must never be echoed back");
    } finally {
      await server.close();
    }
  });

  it("excludes a site photo hidden by an admin (isVisible: false) from the response", async () => {
    const lead = baseLead();
    await writeFile(
      path.join(uploadDirectory, "site_photos_visibility.json"),
      JSON.stringify({ "3": false }),
      "utf8",
    );
    const server = await startLeadsRoute(createFakeDatabase(lead, PHOTOS));
    try {
      const token = await tokenFor(lead.quoteNumber, lead.quoteAccessSecret);
      const response = await fetch(`${server.url}/api/public/track?token=${encodeURIComponent(token)}`);
      assert.equal(response.status, 200);
      const body = await response.json() as { sitePhotos: Array<{ id: number }> };
      assert.deepEqual(body.sitePhotos.map((photo) => photo.id).sort(), [4]);
    } finally {
      await server.close();
    }
  });

  it("does not mark a hidden completed photo as reaching the 'completed' timeline step on its own", async () => {
    // Lead status not yet "closed", and the only completed-stage photo is hidden --
    // the visible photo set the timeline reads from should not show the job as
    // fully completed just because an admin-hidden photo exists in the DB.
    const lead = baseLead({ status: "ready_for_production" });
    await writeFile(
      path.join(uploadDirectory, "site_photos_visibility.json"),
      JSON.stringify({ "3": false, "4": false }),
      "utf8",
    );
    const onlyCompletedPhotos = PHOTOS.filter((photo) => photo.stage === "completed");
    const server = await startLeadsRoute(createFakeDatabase(lead, onlyCompletedPhotos));
    try {
      const token = await tokenFor(lead.quoteNumber, lead.quoteAccessSecret);
      const response = await fetch(`${server.url}/api/public/track?token=${encodeURIComponent(token)}`);
      const body = await response.json() as { timeline: Array<{ stage: string; done: boolean }>; sitePhotos: unknown[] };
      assert.deepEqual(body.sitePhotos, []);
      const completedStep = body.timeline.find((step) => step.stage === "completed")!;
      assert.equal(completedStep.done, false);
    } finally {
      await server.close();
    }
  });

  it("returns null studio summary for a lead with no recognizable Studio design", async () => {
    const lead = baseLead({ studioData: { total: 15000 } });
    const server = await startLeadsRoute(createFakeDatabase(lead, []));
    try {
      const token = await tokenFor(lead.quoteNumber, lead.quoteAccessSecret);
      const response = await fetch(`${server.url}/api/public/track?token=${encodeURIComponent(token)}`);
      const body = await response.json() as { studio: unknown };
      assert.equal(body.studio, null);
    } finally {
      await server.close();
    }
  });
});

describe("buildPublicTrackTimeline", () => {
  it("marks only quote_accepted as done for a deposit-paid, pre-production lead", async () => {
    const routeModule = await importTypeScriptModule<LeadRouteModule>("src/routes/leads.ts");
    const timeline = routeModule.buildPublicTrackTimeline(
      { status: "deposit_paid", updatedAt: new Date("2026-09-20T00:00:00.000Z") },
      [],
    );
    assert.deepEqual(timeline.map((step) => step.done), [true, false, false, false, false]);
    assert.deepEqual(timeline.map((step) => step.active), [false, true, false, false, false]);
  });

  it("infers 'installing' from an installation-stage photo even before status catches up", async () => {
    const routeModule = await importTypeScriptModule<LeadRouteModule>("src/routes/leads.ts");
    const timeline = routeModule.buildPublicTrackTimeline(
      { status: "ready_for_production", updatedAt: new Date("2026-09-20T00:00:00.000Z") },
      [{ id: 1, stage: "installation", takenAt: new Date("2026-09-22T00:00:00.000Z") }],
    );
    assert.deepEqual(timeline.map((step) => step.done), [true, true, true, true, false]);
    const installing = timeline.find((step) => step.stage === "installing")!;
    assert.equal(installing.date, "2026-09-22T00:00:00.000Z");
  });
});

describe("publicStudioSummary", () => {
  it("never surfaces estimate/cost fields even if present alongside a valid state", async () => {
    const routeModule = await importTypeScriptModule<LeadRouteModule>("src/routes/leads.ts");
    const summary = routeModule.publicStudioSummary({
      state: { shape: "I", dimensions: { depthMm: 600, runAMm: 1500, runBMm: 0, runCMm: 0 }, activeStone: "BW010", basinSkus: ["BS-02"] },
      estimate: { totalTHB: 123456 },
    }) as Record<string, unknown>;
    assert.ok(!("estimate" in summary));
    assert.ok(!("totalTHB" in summary));
    assert.equal(summary.stoneColor, "BW010");
  });

  it("returns null for studioData with no recognizable Studio fields", async () => {
    const routeModule = await importTypeScriptModule<LeadRouteModule>("src/routes/leads.ts");
    assert.equal(routeModule.publicStudioSummary(null), null);
    assert.equal(routeModule.publicStudioSummary({ total: 500 }), null);
  });
});
