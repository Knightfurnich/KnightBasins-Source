import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(testDir, "..");
const adminCss = readFileSync(join(appRoot, "src/index.css"), "utf8");
const dashboardSource = readFileSync(join(appRoot, "src/admin/AdminDashboard.tsx"), "utf8");

describe("admin type scale", () => {
  it("defines the six named levels as root tokens", () => {
    const rootBlock = adminCss.match(/(^|\n):root[^{]*\{([^}]*)\}/m)?.[2] ?? "";
    const expectedTokens = [
      ["page-heading", "2rem"],
      ["section-heading", "1.375rem"],
      ["card-heading", "1.0625rem"],
      ["kpi-number", "clamp(1.5rem, 1.25rem + 0.6vw, 1.75rem)"],
      ["body", "0.875rem"],
      ["caption", "0.75rem"],
    ] as const;

    for (const [name, value] of expectedTokens) {
      assert.ok(
        rootBlock.includes(`--admin-type-${name}: ${value};`),
        `Missing root type token for ${name}`,
      );
    }
  });

  it("uses the two admin font roles and tabular numbers for data text", () => {
    assert.match(adminCss, /--admin-font-ui:\s*"Manrope",\s*"Noto Sans Thai"/);
    assert.match(adminCss, /--admin-font-data:\s*"DM Mono",\s*"Noto Sans Thai"/);
    assert.match(adminCss, /\.tabular-nums[^}]*font-variant-numeric:\s*tabular-nums/s);
    assert.match(adminCss, /\.admin-stat-value[^}]*var\(--admin-type-kpi-number\)/s);
    assert.match(adminCss, /\.ai-cost-metric__value[^}]*var\(--admin-type-kpi-number\)/s);
    assert.match(adminCss, /\.dashboard-ai-cost-card__index[^}]*var\(--admin-type-kpi-number\)/s);
    assert.match(adminCss, /\.ai-cost-panel-index[^}]*var\(--admin-type-kpi-number\)/s);
    assert.match(adminCss, /\.admin-app \.admin-manager > div:first-child h1[^}]*var\(--admin-type-page-heading\)/s);
  });

  it("maps legacy admin text utilities and the 9px label to the 12px caption token", () => {
    assert.match(adminCss, /\[class\*="text-\[9px\]"\][\s\S]*?font-size:\s*var\(--admin-type-caption\)/);
    assert.match(adminCss, /\[class\*="text-\[10px\]"\]/);
    assert.match(adminCss, /\[class\*="text-\[11px\]"\]/);
    assert.match(adminCss, /--admin-type-caption:\s*0\.75rem/);
  });

  it("uses one dashboard eyebrow class and keeps the attention label correctly spelled", () => {
    const eyebrowCount = dashboardSource.match(/className="admin-eyebrow"/g)?.length ?? 0;
    assert.ok(eyebrowCount >= 10, `Expected shared dashboard eyebrow class, found ${eyebrowCount}`);
    assert.doesNotMatch(
      dashboardSource,
      /className="(?:eyebrow(?:\s|")|dashboard-ai-cost-card__eyebrow|[^"]*\buppercase\b[^"]*)"/,
    );
    assert.match(dashboardSource, />Needs attention</);
    assert.doesNotMatch(dashboardSource, /NEEDS AT TENTION/i);
  });
});