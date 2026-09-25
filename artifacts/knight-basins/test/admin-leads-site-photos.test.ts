import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * WHY THIS FILE SPAWNS A SUBPROCESS
 *
 * Same constraint as admin-site-photos-ui.test.ts (see the long comment
 * there): node's native `--experimental-strip-types` test runner cannot
 * import .tsx files at all. LeadSitePhotos (exported from LeadsManager.tsx
 * specifically for this test) is rendered here via `tsx`, the same
 * already-installed devDependency of this monorepo's own `scripts`
 * workspace, with @tanstack/react-query's cache pre-seeded per leadId --
 * this exercises the real, shipped matching (GET /admin/site-photos
 * scoped by leadId) and stage-badge rendering, not a hand-copied
 * duplicate.
 */

const testDir = dirname(fileURLToPath(import.meta.url));
const knightBasinsRoot = join(testDir, "..");
const componentUrl = pathToFileURL(join(knightBasinsRoot, "src/admin/LeadsManager.tsx")).href;
const tsxLoaderPath = join(knightBasinsRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");

type SitePhotoFixture = {
  id: number;
  leadId: number | null;
  jobCode: string | null;
  imageUrl: string;
  description: string | null;
  stage: "survey" | "installation" | "service" | "completed";
  senderName: string | null;
  capturedAt: string | null;
  createdAt: string;
};

const LEAD_42_PHOTOS: SitePhotoFixture[] = [
  { id: 1, leadId: 42, jobCode: "JB02/2569", imageUrl: "https://example.com/1.jpg", description: "รูปวัดหน้างาน", stage: "survey", senderName: "ช่างเอ", capturedAt: "2026-09-20T03:00:00.000Z", createdAt: "2026-09-20T03:05:00.000Z" },
  { id: 2, leadId: 42, jobCode: "JB02/2569", imageUrl: "https://example.com/2.jpg", description: null, stage: "installation", senderName: "ช่างบี", capturedAt: "2026-09-22T03:00:00.000Z", createdAt: "2026-09-22T03:05:00.000Z" },
  { id: 3, leadId: 42, jobCode: "JB02/2569", imageUrl: "https://example.com/3.jpg", description: null, stage: "completed", senderName: "ช่างบี", capturedAt: "2026-09-24T03:00:00.000Z", createdAt: "2026-09-24T03:05:00.000Z" },
];

// Belongs to a different lead -- must never show up under lead 42's gallery.
const LEAD_99_PHOTOS: SitePhotoFixture[] = [
  { id: 4, leadId: 99, jobCode: "JB05/2569", imageUrl: "https://example.com/4.jpg", description: null, stage: "service", senderName: "ช่างซี", capturedAt: "2026-09-23T03:00:00.000Z", createdAt: "2026-09-23T03:05:00.000Z" },
];

const HARNESS_SCRIPT = `
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getListAdminSitePhotosQueryKey } from "@workspace/api-client-react";

const mod = await import(${JSON.stringify(componentUrl)});
const { LeadSitePhotos } = mod;

function renderForLead(leadId, data) {
  const queryClient = new QueryClient();
  if (data !== undefined) {
    queryClient.setQueryData(getListAdminSitePhotosQueryKey({ leadId }), data);
  }
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient }, createElement(LeadSitePhotos, { leadId })));
}

const result = {
  emptyHtml: renderForLead(42, []),
  loadingHtml: renderForLead(42, undefined),
  lead42Html: renderForLead(42, ${JSON.stringify(LEAD_42_PHOTOS)}),
  lead99Html: renderForLead(99, ${JSON.stringify(LEAD_99_PHOTOS)}),
};

process.stdout.write(JSON.stringify(result));
`;

type HarnessResult = {
  emptyHtml: string;
  loadingHtml: string;
  lead42Html: string;
  lead99Html: string;
};

let harness: HarnessResult;
let tmpDir: string | undefined;

before(() => {
  if (!existsSync(tsxLoaderPath)) {
    throw new Error(
      `Expected tsx's loader at ${tsxLoaderPath} (a devDependency of the scripts workspace, pinned in pnpm-workspace.yaml's catalog) -- ` +
      `run "pnpm install" at the repo root. See the comment at the top of this file for why this test needs it.`,
    );
  }
  const overrideTsconfig = {
    extends: join(knightBasinsRoot, "tsconfig.json").replace(/\\/g, "/"),
    compilerOptions: { jsx: "react-jsx" },
  };

  tmpDir = mkdtempSync(join(knightBasinsRoot, "node_modules", ".leads-site-photos-test-"));
  const tsconfigPath = join(tmpDir, "tsconfig.override.json");
  const harnessPath = join(tmpDir, "harness.mjs");
  writeFileSync(tsconfigPath, JSON.stringify(overrideTsconfig), "utf8");
  writeFileSync(harnessPath, HARNESS_SCRIPT, "utf8");

  const stdout = execFileSync(
    process.execPath,
    ["--import", pathToFileURL(tsxLoaderPath).href, harnessPath],
    {
      cwd: knightBasinsRoot,
      env: { ...process.env, TSX_TSCONFIG_PATH: tsconfigPath },
      encoding: "utf8",
    },
  );
  harness = JSON.parse(stdout) as HarnessResult;
});

after(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("LeadSitePhotos matching (GET /admin/site-photos scoped by leadId)", () => {
  it('shows "ยังไม่มีภาพหน้างาน" when the lead has no site photos', () => {
    assert.ok(harness.emptyHtml.includes("ยังไม่มีภาพหน้างาน"));
    assert.ok(!harness.emptyHtml.includes('data-testid="gallery-lead-site-photos-42"'));
  });

  it("shows only the requesting lead's own photos, not another lead's", () => {
    for (const photo of LEAD_42_PHOTOS) {
      assert.ok(harness.lead42Html.includes(`data-testid="button-lead-site-photo-${photo.id}"`), `missing photo ${photo.id} for lead 42`);
    }
    for (const photo of LEAD_99_PHOTOS) {
      assert.ok(!harness.lead42Html.includes(`data-testid="button-lead-site-photo-${photo.id}"`), `lead 99's photo ${photo.id} leaked into lead 42's gallery`);
    }
  });

  it("scopes a different lead's render to only that lead's photos", () => {
    for (const photo of LEAD_99_PHOTOS) {
      assert.ok(harness.lead99Html.includes(`data-testid="button-lead-site-photo-${photo.id}"`), `missing photo ${photo.id} for lead 99`);
    }
    for (const photo of LEAD_42_PHOTOS) {
      assert.ok(!harness.lead99Html.includes(`data-testid="button-lead-site-photo-${photo.id}"`), `lead 42's photo ${photo.id} leaked into lead 99's gallery`);
    }
  });

  it("shows the photo count in the header", () => {
    assert.ok(harness.lead42Html.includes(`ภาพถ่ายหน้างานจริง (${LEAD_42_PHOTOS.length} ภาพ)`));
  });

  it("does not render the gallery before the query has loaded", () => {
    assert.ok(!harness.loadingHtml.includes('data-testid="gallery-lead-site-photos-42"'));
  });
});

describe("LeadSitePhotos stage badges", () => {
  it("renders the correct badge label for each of the 4 stages", () => {
    const expectedLabels: Record<string, string> = {
      survey: "📐 วัดหน้างาน",
      installation: "🛠️ ติดตั้ง",
      service: "🔧 เก็บงาน",
      completed: "✅ เสร็จสมบูรณ์",
    };
    for (const photo of LEAD_42_PHOTOS) {
      const expected = expectedLabels[photo.stage]!;
      assert.ok(
        harness.lead42Html.includes(`data-testid="badge-lead-site-photo-stage-${photo.id}">${expected}<`),
        `photo ${photo.id} (stage ${photo.stage}) is missing its "${expected}" badge`,
      );
    }
  });

  it("renders the completed-stage badge for lead 99's service-stage photo correctly", () => {
    assert.ok(harness.lead99Html.includes('data-testid="badge-lead-site-photo-stage-4">🔧 เก็บงาน<'));
  });
});
