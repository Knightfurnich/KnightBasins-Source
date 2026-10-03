// Operational audit trail (job-214): one append-only row per notable event -- a customer
// submitting or being rejected, a payment slip, an admin changing a price or deleting a
// lead -- so staff can answer "what happened to quote X?" from the admin UI instead of the
// server logs.
//
// Two rules shape everything here:
//   1. Writing a log row must never break the request it describes. logAuditEvent never
//      throws and never rejects; callers fire it without awaiting (`void logAuditEvent(...)`).
//   2. A log row must never hold a secret. Every details object goes through
//      sanitizeAuditDetails, which blanks sensitive keys and scrubs token/password/
//      connection-string patterns out of free text before anything is stored.
import { systemAuditLogs } from "@workspace/db/schema";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { Request } from "express";

export type AuditStatus = "success" | "warning" | "error";
export type AuditActorType = "customer" | "admin" | "system";

export const AUDIT_STATUSES: readonly AuditStatus[] = ["success", "warning", "error"];
export const AUDIT_ACTOR_TYPES: readonly AuditActorType[] = ["customer", "admin", "system"];

export type AuditEventInput = {
  actorType: AuditActorType;
  actorName?: string | null;
  action: string;
  targetId?: string | null;
  status?: AuditStatus;
  errorCode?: string | null;
  details?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/** The only part of the database logAuditEvent needs; the routers' own database handle satisfies it. */
export type AuditDatabase = { insert: (...args: any[]) => any };

const REDACTED = "[REDACTED]";
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_ITEMS = 25;
const MAX_OBJECT_KEYS = 40;
const MAX_DEPTH = 5;
const MAX_DETAILS_BYTES = 8_000;

/** password, token, session secret, API keys, cookies and the customer's tax identity never reach the table. */
const SENSITIVE_KEY = /pass(word|wd)?|token|secret|authorization|cookie|api[-_]?key|credential|private[-_]?key|^tax(id|name|branch|address)?$/i;

/** Blanks secrets that show up inside free text (error messages, URLs). */
export function scrubAuditText(value: string): string {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s@/]+@/gi, "postgres://[REDACTED]@")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/g, `Bearer ${REDACTED}`)
    .replace(/\b(token|secret|password|passwd|authorization|api[-_]?key)=([^&\s"']+)/gi, `$1=${REDACTED}`)
    .slice(0, MAX_STRING_LENGTH);
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "string") return scrubAuditText(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return "[nested data omitted]";
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS)) {
      result[key] = SENSITIVE_KEY.test(key) ? REDACTED : sanitizeValue(entry, depth + 1);
    }
    return result;
  }
  return String(value).slice(0, MAX_STRING_LENGTH);
}

/** Deep-copies `details` with secrets removed and size bounded; the result is always JSON-safe. */
export function sanitizeAuditDetails(details: unknown): unknown {
  const sanitized = sanitizeValue(details, 0);
  if (sanitized === null || sanitized === undefined) return null;
  const text = JSON.stringify(sanitized);
  if (text.length <= MAX_DETAILS_BYTES) return sanitized;
  return { truncated: true, preview: text.slice(0, 2_000) };
}

/** The raw error message (scrubbed) for the admin detail drawer; no stack trace is stored. */
export function auditErrorDetails(error: unknown): { errorName: string; errorMessage: string } {
  if (error instanceof Error) return { errorName: error.name, errorMessage: scrubAuditText(error.message) };
  return { errorName: "NonError", errorMessage: scrubAuditText(String(error)) };
}

function clip(value: string | null | undefined, length: number): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, length) : null;
}

/**
 * Writes one audit row. Never throws and never rejects: a failing or missing audit table
 * is logged to the console and otherwise ignored, so the customer's request still succeeds.
 */
export async function logAuditEvent(database: AuditDatabase, event: AuditEventInput): Promise<void> {
  if (typeof database?.insert !== "function") return;
  try {
    await database.insert(systemAuditLogs).values({
      actorType: event.actorType,
      actorName: clip(event.actorName, 120),
      action: clip(event.action, 80) ?? "unknown",
      targetId: clip(event.targetId, 120),
      status: event.status ?? "success",
      errorCode: clip(event.errorCode, 64),
      details: sanitizeAuditDetails(event.details),
      ipAddress: clip(event.ipAddress, 64),
      userAgent: clip(event.userAgent, 255),
    });
  } catch (error) {
    console.warn("Audit log write failed", { action: event.action, error: auditErrorDetails(error).errorMessage });
  }
}

/** IP address and user agent of a request, ready to spread into an audit event. */
export function auditRequestContext(req: Pick<Request, "ip" | "headers">): Pick<AuditEventInput, "ipAddress" | "userAgent"> {
  const agent = req.headers?.["user-agent"];
  return { ipAddress: req.ip ?? null, userAgent: Array.isArray(agent) ? agent[0] : (agent ?? null) };
}

/** Who is acting on an admin route: the signed-in team member, the API key, or the owner password login. */
export function auditAdminActor(req: Pick<Request, "adminMember" | "adminApiKey" | "adminAccess">): Pick<AuditEventInput, "actorType" | "actorName"> {
  const name = req.adminMember?.displayName
    ?? (req.adminApiKey ? `API key: ${req.adminApiKey.name}` : null)
    ?? (req.adminAccess?.role === "owner" ? "เจ้าของระบบ (รหัสผ่าน)" : "admin");
  return { actorType: "admin", actorName: name };
}

/** Fields whose value differs between `before` and `after` (shallow, plain values only), as { field: { from, to } }. */
export function auditFieldChanges(before: Record<string, unknown> | null | undefined, after: Record<string, unknown>): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, to] of Object.entries(after)) {
    if (key === "updatedAt" || to === undefined) continue;
    const from = before ? before[key] : undefined;
    if (typeof to === "object" && to !== null) continue;
    if (from !== to) changes[key] = { from: from ?? null, to };
  }
  return changes;
}

// ---------------------------------------------------------------------------------------
// Reading the trail back (GET /admin/audit-logs)
// ---------------------------------------------------------------------------------------

export type AuditLogFilters = {
  targetId?: string;
  actorType?: AuditActorType;
  status?: AuditStatus;
  /** Free-text search over target id (quote number), actor name and the customer phone. */
  q?: string;
  limit: number;
  offset: number;
};

export const AUDIT_LOG_DEFAULT_LIMIT = 50;
export const AUDIT_LOG_MAX_LIMIT = 200;

function firstQueryValue(value: unknown): string | undefined {
  const entry = Array.isArray(value) ? value[0] : value;
  return typeof entry === "string" ? entry.trim() : undefined;
}

/** Validates the query string. Unknown values are rejected, never silently widened. */
export function parseAuditLogQuery(query: Record<string, unknown>): { ok: true; value: AuditLogFilters } | { ok: false; message: string } {
  const actorType = firstQueryValue(query["actorType"]);
  const status = firstQueryValue(query["status"]);
  if (actorType && !AUDIT_ACTOR_TYPES.includes(actorType as AuditActorType)) return { ok: false, message: "Invalid actorType" };
  if (status && !AUDIT_STATUSES.includes(status as AuditStatus)) return { ok: false, message: "Invalid status" };

  const limitText = firstQueryValue(query["limit"]);
  const offsetText = firstQueryValue(query["offset"]);
  const limit = limitText === undefined || limitText === "" ? AUDIT_LOG_DEFAULT_LIMIT : Number(limitText);
  const offset = offsetText === undefined || offsetText === "" ? 0 : Number(offsetText);
  if (!Number.isInteger(limit) || limit < 1) return { ok: false, message: "Invalid limit" };
  if (!Number.isInteger(offset) || offset < 0) return { ok: false, message: "Invalid offset" };

  const targetId = firstQueryValue(query["targetId"]);
  const q = firstQueryValue(query["q"]);
  return {
    ok: true,
    value: {
      ...(targetId ? { targetId: targetId.slice(0, 120) } : {}),
      ...(actorType ? { actorType: actorType as AuditActorType } : {}),
      ...(status ? { status: status as AuditStatus } : {}),
      ...(q ? { q: q.slice(0, 120) } : {}),
      limit: Math.min(limit, AUDIT_LOG_MAX_LIMIT),
      offset,
    },
  };
}

function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/** The WHERE clause for the filters (undefined when there are none). */
export function buildAuditLogWhere(filters: Pick<AuditLogFilters, "targetId" | "actorType" | "status" | "q">): SQL | undefined {
  const conditions: SQL[] = [];
  if (filters.targetId) conditions.push(eq(systemAuditLogs.targetId, filters.targetId));
  if (filters.actorType) conditions.push(eq(systemAuditLogs.actorType, filters.actorType));
  if (filters.status) conditions.push(eq(systemAuditLogs.status, filters.status));
  if (filters.q) {
    const searches: SQL[] = [
      ilike(systemAuditLogs.targetId, likePattern(filters.q)),
      ilike(systemAuditLogs.actorName, likePattern(filters.q)),
      sql`${systemAuditLogs.details}->>'customerPhone' ILIKE ${likePattern(filters.q)}`,
    ];
    const digits = filters.q.replace(/\D/g, "");
    if (digits.length >= 4 && digits !== filters.q) {
      searches.push(sql`${systemAuditLogs.details}->>'customerPhone' ILIKE ${likePattern(digits)}`);
    }
    conditions.push(or(...searches)!);
  }
  return conditions.length ? and(...conditions) : undefined;
}

/** One page of the trail, newest first, plus the total number of rows matching the filters. */
export async function listAuditLogs(database: { select: (...args: any[]) => any }, filters: AuditLogFilters) {
  const where = buildAuditLogWhere(filters);
  const [items, totals] = await Promise.all([
    database
      .select()
      .from(systemAuditLogs)
      .where(where)
      .orderBy(desc(systemAuditLogs.createdAt), desc(systemAuditLogs.id))
      .limit(filters.limit)
      .offset(filters.offset),
    database.select({ total: sql<number>`count(*)::int` }).from(systemAuditLogs).where(where),
  ]);
  return { items, total: Number(totals?.[0]?.total ?? 0), limit: filters.limit, offset: filters.offset };
}
