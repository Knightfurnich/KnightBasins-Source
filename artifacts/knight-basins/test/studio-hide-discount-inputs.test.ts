import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDirectory = fileURLToPath(new URL(".", import.meta.url));
const appRoot = join(testDirectory, "..");
const studioPagePath = join(appRoot, "src/components/StudioPage.tsx");
const studioPageUrl = pathToFileURL(studioPagePath).href;
const tsxLoaderPath = join(appRoot, "../../scripts/node_modules/tsx/dist/loader.mjs");

const HARNESS_SCRIPT = `
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mod = await import(${JSON.stringify(studioPageUrl)});
const state = {
  upstandHeightMm: 120,
  openEdgePricePerMTHB: 95,
  discountTHB: 500,
};
const renderInputs = (isLeadLinkedMode) => renderToStaticMarkup(
  createElement(mod.StudioPricingInputs, {
    state,
    setState: () => {},
    isLeadLinkedMode,
  }),
);
const publicState = mod.restrictStudioDiscountForMode({ ...state }, false);
const leadLinkedState = mod.restrictStudioDiscountForMode({ ...state }, true);
process.stdout.write(JSON.stringify({
  publicMarkup: renderInputs(false),
  leadLinkedMarkup: renderInputs(true),
  publicDiscount: publicState.discountTHB,
  publicUpstand: publicState.upstandHeightMm,
  leadLinkedDiscount: leadLinkedState.discountTHB,
}));
`;

type HarnessResult = {
  publicMarkup: string;
  leadLinkedMarkup: string;
  publicDiscount: number;
  publicUpstand: number;
  leadLinkedDiscount: number;
};

let harness: HarnessResult;
let tempDirectory: string | undefined;

before(() => {
  if (!existsSync(tsxLoaderPath)) {
    throw new Error(`Expected the workspace tsx loader at ${tsxLoaderPath}`);
  }

  const overrideTsconfig = {
    extends: join(appRoot, "tsconfig.json").replace(/\\/g, "/"),
    compilerOptions: { jsx: "react-jsx" },
  };
  tempDirectory = mkdtempSync(join(appRoot, "node_modules", ".studio-hide-discount-test-"));
  const tsconfigPath = join(tempDirectory, "tsconfig.override.json");
  const harnessPath = join(tempDirectory, "harness.mjs");
  writeFileSync(tsconfigPath, JSON.stringify(overrideTsconfig), "utf8");
  writeFileSync(harnessPath, HARNESS_SCRIPT, "utf8");

  const stdout = execFileSync(
    process.execPath,
    ["--import", pathToFileURL(tsxLoaderPath).href, harnessPath],
    {
      cwd: appRoot,
      env: { ...process.env, TSX_TSCONFIG_PATH: tsconfigPath },
      encoding: "utf8",
    },
  );
  harness = JSON.parse(stdout) as HarnessResult;
});

after(() => {
  if (tempDirectory) rmSync(tempDirectory, { recursive: true, force: true });
});

describe("Studio pricing inputs by access mode", () => {
  it("hides discount and open-edge price from public Studio while keeping upstand height", () => {
    assert.match(harness.publicMarkup, /data-testid="input-studio-upstand-height"/);
    assert.doesNotMatch(harness.publicMarkup, /data-testid="input-studio-open-edge-price"/);
    assert.doesNotMatch(harness.publicMarkup, /data-testid="input-studio-discount"/);
  });

  it("shows all three pricing inputs in lead-linked admin mode", () => {
    assert.match(harness.leadLinkedMarkup, /data-testid="input-studio-upstand-height"/);
    assert.match(harness.leadLinkedMarkup, /data-testid="input-studio-open-edge-price"/);
    assert.match(harness.leadLinkedMarkup, /data-testid="input-studio-discount"/);
  });

  it("resets a public draft discount to zero without changing admin discounts", () => {
    assert.equal(harness.publicDiscount, 0);
    assert.equal(harness.publicUpstand, 120);
    assert.equal(harness.leadLinkedDiscount, 500);
  });
});