// Reversible mutation proof against the REAL sitemap. Always restore its bytes.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const file = new URL("../../artifacts/knight-basins/public/sitemap.xml", import.meta.url);
const original = readFileSync(file, "utf8");
function run(name, contents, mustPass, error) {
  writeFileSync(file, contents);
  const result = spawnSync(process.execPath, [
    "--experimental-strip-types", "--test",
    "artifacts/knight-basins/test/customer-facing-consistency.test.ts",
    "artifacts/knight-basins/test/sitemap-lastmod.test.ts",
  ], { cwd: root, encoding: "utf8" });
  console.log(`\n=== ${name}: exit ${result.status} ===\n${result.stdout}${result.stderr}`);
  assert.equal(result.status === 0, mustPass, `${name}: unexpected verdict`);
  if (error) assert.match(result.stdout + result.stderr, error);
}
const firstDate = /(<loc>https:\/\/knightbasins\.com\/<\/loc>\s*<lastmod>)[^<]+/;
try {
  run("candidate passes", original, true);
  run("restore the stale home date: MUST FAIL",
    original.replace(firstDate, (_, prefix) => `${prefix}2026-10-10`), false, /stale lastmod/);
  const future = `${new Date().getUTCFullYear() + 1}-01-01`;
  run("future date: MUST FAIL", original.replace(firstDate, (_, prefix) => `${prefix}${future}`), false, /future lastmod/);
  run("impossible calendar date: MUST FAIL",
    original.replace(firstDate, (_, prefix) => `${prefix}2026-02-30`), false, /impossible calendar date/);
  run("missing URL: MUST FAIL", original.replace(/  <url>[\s\S]*?<\/url>\n/, ""), false);
  run("restore candidate: MUST PASS", original, true);
} finally {
  writeFileSync(file, original);
  assert.equal(readFileSync(file, "utf8"), original);
}
