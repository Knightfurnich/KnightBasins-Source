import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getLineAuthDiagnostics, getLineHealthStatus } from "../lib/line-config";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const lineLogin = getLineAuthDiagnostics();
  const status = getLineHealthStatus(lineLogin);
  const data = HealthCheckResponse.parse({ status, lineLogin });
  res.status(status === "ok" ? 200 : 503).json(data);
});

export default router;
