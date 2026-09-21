import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getLineAuthDiagnostics, getLineHealthStatus } from "../lib/line-config";
import { pingDatabase, type DatabaseHealth } from "../lib/db-health";

export function createHealthRouter(
  checkDatabase: () => Promise<DatabaseHealth> = pingDatabase,
): IRouter {
  const router: IRouter = Router();

  router.get("/healthz", async (_req, res) => {
    const lineLogin = getLineAuthDiagnostics();
    const database = await checkDatabase();
    // A database that can't be reached is a worse outage than a LINE
    // misconfiguration, and matters regardless of NODE_ENV (unlike the
    // LINE check, which only degrades health in production).
    const status = database.connected ? getLineHealthStatus(lineLogin) : "degraded";
    const data = HealthCheckResponse.parse({ status, lineLogin, database });
    res.status(status === "ok" ? 200 : 503).json(data);
  });

  return router;
}

export default createHealthRouter();
