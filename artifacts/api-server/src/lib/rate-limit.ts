import type { RequestHandler } from "express";

type RateLimitOptions = {
  name: string;
  max: number;
  windowMs: number;
  key?: (req: Parameters<RequestHandler>[0]) => string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function clientKey(req: Parameters<RequestHandler>[0]) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${options.name}:${options.key?.(req) ?? clientKey(req)}`;
    const current = buckets.get(key);
    const bucket = current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + options.windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > options.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({ message: "Too many requests. Please try again later." });
      return;
    }

    next();
  };
}

export function createConcurrencyLimiter(name: string, max: number): RequestHandler {
  let active = 0;

  return (_req, res, next) => {
    if (active >= max) {
      res.status(429).json({ message: `${name} is busy. Please try again later.` });
      return;
    }

    active += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active = Math.max(0, active - 1);
    };
    res.once("finish", release);
    res.once("close", release);
    next();
  };
}