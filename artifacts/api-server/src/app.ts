import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { UPLOAD_DIR } from "./lib/image-upload";

const app: Express = express();

app.disable("x-powered-by");
// Only affects req.secure/req.protocol (the admin cookie's `secure` flag,
// HSTS-related logic below) now -- lib/rate-limit.ts's clientKey() no longer
// reads Express's req.ip at all (SECURITY_AUDIT_REPORT.md Finding #1: a
// caller could rotate X-Forwarded-For to get a fresh req.ip, and therefore a
// fresh rate-limit bucket, on every request); it verifies the real nginx
// hop itself instead of trusting this setting.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const configuredCorsOrigins = [
  process.env["PUBLIC_APP_ORIGIN"],
  process.env["PUBLIC_ADMIN_ORIGIN"],
  ...(process.env["CORS_ORIGINS"]?.split(",") ?? []),
]
  .map((origin) => origin?.trim())
  .filter((origin): origin is string => Boolean(origin));
const developmentCorsOrigins = process.env["NODE_ENV"] === "production"
  ? []
  : [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      ...(process.env["REPLIT_DEV_DOMAIN"] ? [`https://${process.env["REPLIT_DEV_DOMAIN"]}`] : []),
    ];
const allowedCorsOrigins = new Set([...configuredCorsOrigins, ...developmentCorsOrigins]);

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedCorsOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
}));
app.use((_req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env["NODE_ENV"] === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use(cookieParser());
app.use("/kb/images/uploads", express.static(UPLOAD_DIR));
app.use("/api/uploads", express.static(UPLOAD_DIR));
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));

app.use("/api", router);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ error }, "Unhandled API error");
  const pgError = error as { code?: string };
  if (pgError?.code === "23505") {
    res.status(409).json({ message: "A record with this code already exists" });
    return;
  }
  res.status(500).json({ message: "Internal server error" });
});

export default app;
