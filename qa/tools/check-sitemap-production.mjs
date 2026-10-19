// Read-only post-deploy acceptance. No deployments, database or API mutations.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const local = readFileSync(new URL("../../artifacts/knight-basins/public/sitemap.xml", import.meta.url), "utf8");
const curl = spawnSync("curl", ["--fail", "--silent", "--show-error", "--max-time", "30",
  "https://knightbasins.com/sitemap.xml"], { encoding: "utf8" });
assert.equal(curl.status, 0, curl.stderr);
const parse = xml => [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, entry]) =>
  Object.fromEntries(["loc", "lastmod", "changefreq", "priority"].map(tag => {
    const values = [...entry.matchAll(new RegExp(`<${tag}>([^<]+)</${tag}>`, "g"))];
    assert.equal(values.length, 1, `Expected one ${tag}`);
    return [tag, values[0][1]];
  })));
const before = parse(local), live = parse(curl.stdout);
assert.equal(before.length, 12); assert.equal(live.length, 12);
console.log(`Read-only check at ${new Date().toISOString()}`);
console.log("path | repo lastmod | live lastmod | HTTP");
let different = 0;
for (let i = 0; i < before.length; i++) {
  const expected = before[i], actual = live[i];
  const status = spawnSync("curl", ["--silent", "--show-error", "--max-time", "30",
    "--output", "/dev/null", "--write-out", "%{http_code}", expected.loc], { encoding: "utf8" });
  assert.equal(status.status, 0, status.stderr);
  assert.equal(status.stdout, "200", `${expected.loc}: expected HTTP 200`);
  const matches = JSON.stringify(expected) === JSON.stringify(actual);
  if (!matches) different++;
  console.log(`${new URL(expected.loc).pathname} | ${expected.lastmod} | ${actual.lastmod} | ${status.stdout}${matches ? "" : " MISMATCH"}`);
}
assert.equal(different, 0, `${different} rows differ: production does not match this repository snapshot; do not claim post-deploy acceptance`);
console.log("PASS: all 12 rows and all 12 HTTP status checks match.");
