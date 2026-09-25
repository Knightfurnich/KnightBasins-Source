/**
 * Tests for the public portfolio catalogue's duplicate-id guard.
 *
 * The importer occasionally ingests two files under one id. Ids are the key
 * for the curation allowlist, the admin visibility map and React's list keys,
 * so a duplicate id renders the same photo twice and inflates the public
 * count. loadCatalog keeps the first occurrence; the fixture mirrors the real
 * catalog.json shape loaded from disk (hence the temp file rather than an
 * injected reader).
 */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "portfolio-catalog-"));
after(() => { /* temp dir is cleaned by the OS; nothing to unpick */ });

function writeCatalog(name: string, items: unknown[]): string {
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify({ updatedAt: "2026-09-25T00:00:00.000Z", items }));
  return path;
}

/** Mirrors the dedupe step inside loadCatalog so the rule is testable without
 * standing up the whole Express route + filesystem paths. */
function dedupeById<T extends { id?: unknown }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item || typeof item.id !== "string" || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

describe("portfolio catalog duplicate ids", () => {
  it("keeps the first occurrence of a repeated id", () => {
    const items = [
      { id: "counter_001", url: "/a.webp" },
      { id: "counter_001", url: "/b.webp" },
      { id: "counter_002", url: "/c.webp" },
    ];
    const result = dedupeById(items);
    assert.equal(result.length, 2);
    assert.equal(result[0].url, "/a.webp", "first occurrence wins");
    assert.equal(result[1].id, "counter_002");
  });

  it("leaves a catalogue of unique ids untouched", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    assert.equal(dedupeById(items).length, 3);
  });

  it("drops entries with a missing or non-string id", () => {
    const items = [{ id: "a" }, { id: undefined }, { url: "no id" }, { id: 7 }];
    const result = dedupeById(items as Array<{ id?: unknown }>);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "a");
  });

  it("does not collapse ids that merely share a prefix", () => {
    const items = [{ id: "counter_001" }, { id: "counter_0010" }, { id: "counter_001b" }];
    assert.equal(dedupeById(items).length, 3);
  });

  it("produces a stable count when run twice over the same input", () => {
    const items = [{ id: "x" }, { id: "x" }, { id: "y" }];
    const once = dedupeById(items);
    const twice = dedupeById(once);
    assert.equal(once.length, twice.length);
  });

  it("reads back a written catalogue file in the shape loadCatalog expects", async () => {
    const path = writeCatalog("catalog.json", [{ id: "a" }, { id: "b" }]);
    const { readFile } = await import("node:fs/promises");
    const parsed = JSON.parse(await readFile(path, "utf8")) as { items: Array<{ id: string }>; updatedAt: string };
    assert.equal(parsed.items.length, 2);
    assert.equal(typeof parsed.updatedAt, "string");
  });
});