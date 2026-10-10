// Stands in for routes/catalog.ts in route tests that must not need a database (job 421-C). It serves a snapshot of the
// live catalogue (GET /api/catalog, trimmed to the fields the chat reads) from the file named by SUPPORT_CATALOG_FIXTURE
// (the bundle lives in a temporary directory, so the path cannot be derived from import.meta.url).
import { readFileSync } from "node:fs";

export async function getCatalogData() {
  const file = process.env["SUPPORT_CATALOG_FIXTURE"];
  if (!file) throw new Error("SUPPORT_CATALOG_FIXTURE is not set");
  return JSON.parse(readFileSync(file, "utf8"));
}
