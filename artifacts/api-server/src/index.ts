import app from "./app";
import { execFileSync } from "node:child_process";
import { logger } from "./lib/logger";
import { seedCatalogIfEmpty } from "./routes/catalog";
import { cleanupExpiredStudioDrafts } from "./routes/studio-draft";

const STUDIO_DRAFT_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

function runStudioDraftCleanup() {
  void cleanupExpiredStudioDrafts().then(
    (result) => logger.info(result, "Expired Studio drafts cleanup completed"),
    (error: unknown) => logger.error({ error }, "Expired Studio drafts cleanup failed"),
  );
}

async function start() {
  if (process.env["NODE_ENV"] === "development" && process.env["REPL_ID"]) {
    execFileSync("bash", ["scripts/prepare-replit-dev-db.sh"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
  }

  await seedCatalogIfEmpty();

  const server = app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    runStudioDraftCleanup();
    const cleanupInterval = setInterval(runStudioDraftCleanup, STUDIO_DRAFT_CLEANUP_INTERVAL_MS);
    cleanupInterval.unref();
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 35_000;
  server.keepAliveTimeout = 5_000;
}

start().catch((error) => {
  logger.error({ error }, "Unable to initialize API database");
  process.exit(1);
});
