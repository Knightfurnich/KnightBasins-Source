import { createHmac, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

const COOKIE_NAME = "knight_admin_session";
const SESSION_AGE_MS = 12 * 60 * 60 * 1000;

function secret() {
  const value = process.env["SESSION_SECRET"];
  if (!value) throw new Error("SESSION_SECRET is required");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createAdminToken() {
  const expiresAt = Date.now() + SESSION_AGE_MS;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

export function isAdminTokenValid(token: string | undefined) {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || Number(payload) <= Date.now()) return false;
  return safeEqual(signature, sign(payload));
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env["NODE_ENV"] === "production",
    maxAge: SESSION_AGE_MS,
    path: "/",
  };
}

export function adminPasswordMatches(password: string) {
  const expected = process.env["ADMIN_PASSWORD"];
  return expected ? safeEqual(password, expected) : false;
}

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!process.env["ADMIN_PASSWORD"]) {
    res.status(503).json({ message: "Admin access is not configured" });
    return;
  }
  if (!isAdminTokenValid(req.cookies?.[COOKIE_NAME])) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  next();
};

export { COOKIE_NAME };