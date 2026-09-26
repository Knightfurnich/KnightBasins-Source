import { createHash } from "node:crypto";
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

/** Above this many tracked keys, an expired-entry sweep runs before the next check. */
const SWEEP_THRESHOLD = 1000;

// SECURITY_AUDIT_REPORT.md Finding #1: the old `clientKey` used Express's own
// `req.ip`, which under app.ts's `trust proxy: 1` is derived straight from
// whatever the caller puts in X-Forwarded-For -- a client rotating that
// header on every request got a fresh rate-limit bucket each time, bypassing
// every IP-keyed limiter (admin login, sketch/places abuse guards) entirely.
// The fix below never trusts a header by default; it only reads
// X-Forwarded-For when the request's actual TCP peer is nginx's own
// container (per deploy/hostinger/docker-compose.yml + nginx.conf, nginx is
// the only thing that ever connects directly to this process on the shared
// docker network, and no port is published for anything else to reach it
// directly) -- a header can lie, but the TCP peer address cannot.

/** RFC1918 ranges Docker's bridge networks live in. Deliberately excludes
 * loopback (127.0.0.1/::1): nginx and this api process are always separate
 * containers on that bridge network and never see each other as loopback,
 * so a loopback peer means something connected directly, skipping nginx. */
const PRIVATE_IPV4_RANGES = [/^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./];

function normalizeIp(address: string): string {
  return address.replace(/^::ffff:/, "");
}

/** True only when `address` is the trusted nginx hop this deployment controls -- never a public IP, and never loopback (see note above). */
function isTrustedProxyPeer(address: string | undefined): boolean {
  if (!address) return false;
  const ip = normalizeIp(address);
  return PRIVATE_IPV4_RANGES.some((pattern) => pattern.test(ip));
}

const IPV4_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_PATTERN = /^[0-9a-fA-F:]+$/;

function looksLikeIp(value: string): boolean {
  return IPV4_PATTERN.test(value) || (value.includes(":") && IPV6_PATTERN.test(value));
}

/**
 * Real client IP without blindly trusting req.ip. X-Forwarded-For is only
 * consulted when the socket's actual peer is the trusted nginx container --
 * nginx.conf's `$proxy_add_x_forwarded_for` always appends nginx's own
 * observed peer as the LAST entry, so the entry immediately before it is
 * what nginx itself received (the real client, if the upstream proxy chain
 * is behaving). Anything else (a direct connection, or too few entries to
 * have a "before nginx" entry at all) falls back to the raw socket address,
 * which no request header can override.
 */
function resolvedClientIp(req: Parameters<RequestHandler>[0]): string {
  const socketAddress = req.socket.remoteAddress;
  if (isTrustedProxyPeer(socketAddress)) {
    const header = req.headers?.["x-forwarded-for"];
    const raw = Array.isArray(header) ? header[0] : header;
    const entries = (raw ?? "").split(",").map((entry) => entry.trim()).filter(looksLikeIp);
    if (entries.length >= 2) return entries[entries.length - 2]!;
  }
  return socketAddress || "unknown";
}

/**
 * Bucket key: the resolved IP above, plus a short hash of User-Agent as a
 * secondary fingerprint (per job-86's GOAL) -- cheap defense-in-depth
 * against a naive script that only rotates one header, on top of the IP
 * resolution above which is what actually closes the bypass.
 */
export function clientKey(req: Parameters<RequestHandler>[0]) {
  const ip = resolvedClientIp(req);
  const userAgent = (req.headers?.["user-agent"] as string | undefined) ?? "";
  const fingerprint = createHash("sha256").update(userAgent).digest("hex").slice(0, 12);
  return `${ip}#${fingerprint}`;
}

/** Removes every bucket whose window has already ended, so keys that stop being reused don't sit in memory forever. */
function sweepExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** Test-only: drops every tracked bucket so each test starts from a clean rate-limit state. */
export function clearRateLimitStore(): void {
  buckets.clear();
}

/** Test-only: current number of tracked keys, used to assert that sweeping actually shrinks the store. */
export function rateLimitStoreSize(): number {
  return buckets.size;
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    if (buckets.size > SWEEP_THRESHOLD) sweepExpiredBuckets(now);
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