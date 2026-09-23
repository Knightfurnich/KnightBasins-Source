import { createHmac, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

const COOKIE_NAME = "knight_admin_session";
const SESSION_AGE_MS = 12 * 60 * 60 * 1000;

export const ADMIN_PERMISSIONS = [
  "basins",
  "installed-stones",
  "sheet-stones",
  "leads",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];
export type AdminRole = "owner" | "staff" | "viewer";
export type AdminAction = "view" | "edit" | "delete";

export type AdminAccess = {
  role: AdminRole;
  permissions: AdminPermission[];
  canEdit: boolean;
  canDelete: boolean;
  canManageTeam: boolean;
};

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

function configuredRole(): AdminRole {
  const value = process.env["ADMIN_ROLE"]?.trim().toLowerCase();
  return value === "staff" || value === "viewer" ? value : "owner";
}

function configuredPermissions(role: AdminRole) {
  if (role === "owner") return [...ADMIN_PERMISSIONS];
  const configured = process.env["ADMIN_PERMISSIONS"]
    ?.split(",")
    .map((permission) => permission.trim())
    .filter((permission): permission is AdminPermission => ADMIN_PERMISSIONS.includes(permission as AdminPermission));
  return configured?.length ? [...new Set(configured)] : [...ADMIN_PERMISSIONS];
}

export function getAdminAccess(): AdminAccess {
  const role = configuredRole();
  return {
    role,
    permissions: configuredPermissions(role),
    canEdit: role !== "viewer",
    canDelete: role === "owner",
    canManageTeam: role === "owner",
  };
}

export function hasAdminPermission(
  access: AdminAccess,
  permission: AdminPermission,
  action: AdminAction = "view",
) {
  if (!access.permissions.includes(permission)) return false;
  if (action === "edit") return access.canEdit;
  if (action === "delete") return access.canDelete;
  return true;
}

export function requireAdminPermission(
  permission: AdminPermission,
  action: AdminAction = "view",
): RequestHandler {
  return (req, res, next) => {
    const access = getAdminAccess();
    if (!hasAdminPermission(access, permission, action)) {
      res.status(403).json({
        code: "ADMIN_PERMISSION_REQUIRED",
        message: "คุณไม่มีสิทธิ์เข้าถึงเมนูนี้ กรุณาติดต่อเจ้าของระบบเพื่อขอสิทธิ์เพิ่มเติม",
      });
      return;
    }
    next();
  };
}

export function requireAnyAdminPermission(
  permissions: AdminPermission[],
  action: AdminAction = "view",
): RequestHandler {
  return (req, res, next) => {
    const access = getAdminAccess();
    if (!permissions.some((permission) => hasAdminPermission(access, permission, action))) {
      res.status(403).json({
        code: "ADMIN_PERMISSION_REQUIRED",
        message: "คุณไม่มีสิทธิ์ดำเนินการนี้ กรุณาติดต่อเจ้าของระบบเพื่อขอสิทธิ์เพิ่มเติม",
      });
      return;
    }
    next();
  };
}

export function adminSessionResponse(authenticated: boolean) {
  return authenticated
    ? { authenticated: true, access: getAdminAccess() }
    : { authenticated: false };
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