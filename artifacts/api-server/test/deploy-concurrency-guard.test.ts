import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

// job-225: two pushes to main in quick succession used to run two deploys side by side. Both copy into the
// same /docker/knightbasins directories, both run migrate.sh and both restart the containers, so an older
// run could finish last and put the older build back. The workflow must queue deploys, one at a time, and
// must never cancel one that is already running (that could stop it halfway through a copy or a migration).

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const workflowPath = path.resolve(testDirectory, "..", "..", "..", ".github", "workflows", "deploy.yml");

/** The workflow with Windows line endings normalised and comment-only lines removed, so comments cannot satisfy or break a check. */
function workflowText(): string {
  return readFileSync(workflowPath, "utf8")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
}

/** The lines of one top-level (column 0) block, e.g. "concurrency:", up to the next top-level key. */
function topLevelBlock(text: string, key: string): string[] | null {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line === `${key}:`);
  if (start < 0) return null;
  const block: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.length > 0 && !/^\s/.test(line)) break;
    block.push(line);
  }
  return block;
}

describe("job-225: deploy.yml queues deploys", () => {
  const text = workflowText();

  it("has a workflow-level concurrency block", () => {
    const block = topLevelBlock(text, "concurrency");
    assert.ok(block, "deploy.yml needs a top-level concurrency: block (column 0, not inside a job)");
    assert.equal(
      text.split("\n").filter((line) => /^\s*concurrency:/.test(line)).length,
      1,
      "exactly one concurrency block - a second one inside the job would override the workflow-level one",
    );
  });

  it("puts every deploy in the deploy-hostinger-vps group", () => {
    const block = topLevelBlock(text, "concurrency") ?? [];
    assert.ok(
      block.some((line) => /^\s+group:\s*deploy-hostinger-vps\s*$/.test(line)),
      "the concurrency group must be exactly deploy-hostinger-vps (a literal, so every run lands in the same queue)",
    );
  });

  it("never cancels a deploy that is already running", () => {
    const block = topLevelBlock(text, "concurrency") ?? [];
    assert.ok(
      block.some((line) => /^\s+cancel-in-progress:\s*false\s*$/.test(line)),
      "cancel-in-progress must be false",
    );
    assert.ok(!/cancel-in-progress:\s*true/i.test(text), "no cancel-in-progress: true anywhere in the workflow");
  });

  it("declares concurrency before the jobs, as a sibling of on: and jobs:", () => {
    const lines = text.split("\n");
    const topLevelKeys = lines.filter((line) => /^[A-Za-z_-]+:/.test(line)).map((line) => line.split(":")[0]);
    assert.deepEqual(topLevelKeys, ["name", "on", "concurrency", "jobs"]);
  });

  it("still deploys on push to main only", () => {
    const block = topLevelBlock(text, "on") ?? [];
    assert.ok(block.some((line) => /^\s+push:\s*$/.test(line)), "the deploy still triggers on push");
    assert.ok(block.some((line) => /branches:\s*\[\s*main\s*\]/.test(line)), "and only for main");
  });
});

describe("job-225: the existing safeguards in deploy.yml are untouched", () => {
  const text = workflowText();
  const stepNames = text
    .split("\n")
    .map((line) => /^\s+- name:\s*(.+?)\s*$/.exec(line)?.[1])
    .filter((name): name is string => Boolean(name));

  it("keeps all 12 steps, in the same order", () => {
    assert.deepEqual(stepNames, [
      "Checkout code",
      "Check that migrations are additive",
      "Install pnpm",
      "Setup Node.js",
      "Install Dependencies",
      "Build Web App",
      "Build API Server",
      "Copy Web Dist to VPS",
      "Copy API Dist to VPS",
      "Copy Migrations to VPS",
      "Apply Database Migrations",
      "Restart Docker Containers",
    ]);
  });

  it("still stops the deploy if a migration fails, and still runs migrations before the restart", () => {
    assert.ok(stepNames.indexOf("Apply Database Migrations") < stepNames.indexOf("Restart Docker Containers"));
    assert.ok(/script_stop:\s*true/.test(text), "the migration step must still stop on the first failing command");
    assert.ok(/set -euo pipefail/.test(text));
  });

  it("still refuses DROP and TRUNCATE in migration files", () => {
    assert.ok(/drop|truncate/i.test(text) && /migrations must be additive/.test(text));
  });
});
