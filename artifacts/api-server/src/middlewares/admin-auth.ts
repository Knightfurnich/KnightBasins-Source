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

export type AdminMemberIdentity = {
  id: number;
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
  role: AdminRole;
  permissions: AdminPermission[];
  active: boolean;
};

export type AdminSessionState = {
  authenticated: boolean;
  access?: AdminAccess;
  member?: Pick<AdminMemberIdentity, "id" | "lineUserId" | "displayName" | "pictureUrl">;
};

declare global {
  namespace Express {
    interface Request {
      adminAccess?: AdminAccess;
      adminMember?: AdminMemberIdentity;
    }
  }
}

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

function tokenPayload(token: string | undefined) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;
  const [expiresAtText, kind, memberIdText] = payload.split(":");
  const expiresAt = Number(expiresAtText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return null;
  if (kind && (kind !== "member" || !memberIdText || !/^[1-9]\d*$/.test(memberIdText))) return null;
  return {
    expiresAt,
    memberId: kind === "member" ? Number(memberIdText) : null,
  };
}

export function createAdminToken(memberId?: number) {
  const expiresAt = Date.now() + SESSION_AGE_MS;
  const payload = memberId ? `${expiresAt}:member:${memberId}` : String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

export function isAdminTokenValid(token: string | undefined) {
  return Boolean(tokenPayload(token));
}

export function adminMemberIdFromToken(token: string | undefined) {
  return tokenPayload(token)?.memberId ?? null;
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

function normalizedMemberPermissions(permissions: string[], role: AdminRole) {
  if (role === "owner") return [...ADMIN_PERMISSIONS];
  return [...new Set(permissions.filter((permission): permission is AdminPermission =>
    ADMIN_PERMISSIONS.includes(permission as AdminPermission),
  ))];
}

export function accessForAdminMember(member: Pick<AdminMemberIdentity, "role"> & { permissions: string[] }): AdminAccess {
  const role = member.role === "owner" || member.role === "viewer" ? member.role : "staff";
  return {
    role,
    permissions: normalizedMemberPermissions(member.permissions, role),
    canEdit: role !== "viewer",
    canDelete: role === "owner",
    canManageTeam: role === "owner",
  };
}

async function findActiveAdminMember(memberId: number): Promise<AdminMemberIdentity | null> {
  const [{ db, adminMembers }, { eq }] = await Promise.all([
    import("@workspace/db"),
    import("drizzle-orm"),
  ]);
  const [member] = await db
    .select()
    .from(adminMembers)
    .where(eq(adminMembers.id, memberId))
    .limit(1);
  if (!member?.active) return null;
  const role = member.role === "owner" || member.role === "viewer" ? member.role : "staff";
  return {
    id: member.id,
    lineUserId: member.lineUserId,
    displayName: member.displayName,
    pictureUrl: member.pictureUrl,
    role,
    permissions: normalizedMemberPermissions(member.permissions, role),
    active: member.active,
  };
}

export async function resolveAdminSession(token: string | undefined): Promise<AdminSessionState> {
  if (!isAdminTokenValid(token)) return { authenticated: false };
  const memberId = adminMemberIdFromToken(token);
  if (!memberId) {
    return { authenticated: true, access: getAdminAccess() };
  }
  const member = await findActiveAdminMember(memberId);
  if (!member) return { authenticated: false };
  return {
    authenticated: true,
    access: accessForAdminMember(member),
    member: {
      id: member.id,
      lineUserId: member.lineUserId,
      displayName: member.displayName,
      pictureUrl: member.pictureUrl,
    },
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

function permissionDenied(res: Parameters<RequestHandler>[1], message = "คุณไม่มีสิทธิ์เข้าถึงเมนูนี้ กรุณาติดต่อเจ้าของระบบเพื่อขอสิทธิ์เพิ่มเติม") {
  res.status(403).json({
    code: "ADMIN_PERMISSION_REQUIRED",
    message,
  });
}

export function requireAdminPermission(
  permission: AdminPermission,
  action: AdminAction = "view",
): RequestHandler {
  return (req, res, next) => {
    const access = req.adminAccess ?? getAdminAccess();
    if (!hasAdminPermission(access, permission, action)) {
      permissionDenied(res);
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
    const access = req.adminAccess ?? getAdminAccess();
    if (!permissions.some((permission) => hasAdminPermission(access, permission, action))) {
      permissionDenied(res, "คุณไม่มีสิทธิ์ดำเนินการนี้ กรุณาติดต่อเจ้าของระบบเพื่อขอสิทธิ์เพิ่มเติม");
      return;
    }
    next();
  };
}

export const requireAdminOwner: RequestHandler = (req, res, next) => {
  if (!req.adminAccess?.canManageTeam) {
    permissionDenied(res, "เฉพาะเจ้าของระบบเท่านั้นที่จัดการสมาชิกทีมได้");
    return;
  }
  next();
};

export function adminSessionResponse(session: AdminSessionState): AdminSessionState {
  return session;
}

export const requireAdmin: RequestHandler = (req, res, next) => {
  void resolveAdminSession(req.cookies?.[COOKIE_NAME])
    .then((session) => {
      if (!session.authenticated || !session.access) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }
      req.adminAccess = session.access;
      if (session.member) {
        req.adminMember = {
          ...session.member,
          role: session.access.role,
          permissions: session.access.permissions,
          active: true,
        };
      }
      next();
    })
    .catch(next);
};

export { COOKIE_NAME };