import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { UPLOAD_DIR } from "./lib/image-upload";
import { validatePayloadDepthAndSize } from "./lib/payload-guard";

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
// 256kb comfortably covers every legitimate JSON body this API accepts
// (studioData/lead payloads are a few KB to a few tens of KB even for a
// complex multi-piece L/U counter) while still being far below a size that
// could meaningfully stress the event loop or memory -- file uploads use
// their own separate multipart size caps in lib/image-upload.ts, not this
// JSON body parser at all.
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));
// Payload & JSON Payload Size Guard, part 2 (see lib/payload-guard.ts): the
// byte-size limit above doesn't catch a "nested object bomb" -- a deeply
// nested or key-heavy structure can stay well under 256kb in raw bytes while
// still being expensive for downstream code to walk. This runs once, right
// after the body is parsed, before any route handler sees it.
app.use((req, res, next) => {
  if (req.body && typeof req.body === "object") {
    const check = validatePayloadDepthAndSize(req.body);
    if (!check.safe) {
      res.status(400).json({ message: check.reason ?? "Request payload rejected: unsafe structure" });
      return;
    }
  }
  next();
});

app.use("/api", router);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({
    err: error,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }, "Unhandled API error");
  const typedError = error as { code?: string; type?: string; status?: number; statusCode?: number };
  // body-parser's own error for a request over express.json()'s `limit`
  // above -- without this, it would otherwise fall through to the generic
  // 500 below and hide the real, expected reason (payload too large) from
  // the client.
  if (typedError?.type === "entity.too.large" || typedError?.status === 413 || typedError?.statusCode === 413) {
    res.status(413).json({ message: "Request payload is too large" });
    return;
  }
  if (typedError?.code === "23505") {
    res.status(409).json({ message: "A record with this code already exists" });
    return;
  }
  res.status(500).json({ message: "Internal server error" });
});

export default app;
