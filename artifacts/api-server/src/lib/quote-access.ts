import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type QuoteAccessPayload = {
  quoteNumber: string;
  accessSecret: string;
};

export const PUBLIC_QUOTE_TOKEN_TTL_MS = 45 * 24 * 60 * 60 * 1000;
export const PUBLIC_QUOTE_TOKEN_EXPIRED_ERROR = "quote_expired";
export const PUBLIC_QUOTE_TOKEN_EXPIRED_MESSAGE =
  "ลิงก์ใบเสนอราคานี้หมดอายุแล้ว (เกิน 45 วัน) กรุณาติดต่อทีมขายเพื่อประเมินราคาใหม่";

export function isPublicQuoteTokenExpired(createdAt: Date | string | null | undefined, now = Date.now()) {
  if (createdAt == null) return false;
  const createdAtMs = createdAt instanceof Date ? createdAt.getTime() : Date.parse(createdAt);
  return Number.isFinite(createdAtMs) && now - createdAtMs > PUBLIC_QUOTE_TOKEN_TTL_MS;
}

function sessionSecret() {
  const value = process.env["SESSION_SECRET"];
  if (!value) throw new Error("SESSION_SECRET is required");
  return value;
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decode<T>(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createQuoteAccessSecret() {
  return randomBytes(32).toString("hex");
}

export function createPublicQuoteToken(quoteNumber: string, accessSecret: string) {
  const payload = encode({ quoteNumber, accessSecret } satisfies QuoteAccessPayload);
  return `${payload}.${sign(payload)}`;
}

export function verifyPublicQuoteToken(value: unknown): QuoteAccessPayload | null {
  if (typeof value !== "string") return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;

  try {
    const decoded = decode<Partial<QuoteAccessPayload>>(payload);
    if (
      typeof decoded.quoteNumber !== "string" ||
      !decoded.quoteNumber ||
      typeof decoded.accessSecret !== "string" ||
      !/^[a-f0-9]{64}$/i.test(decoded.accessSecret)
    ) {
      return null;
    }
    return {
      quoteNumber: decoded.quoteNumber,
      accessSecret: decoded.accessSecret,
    };
  } catch {
    return null;
  }
}

export function quoteAccessSecretMatches(left: unknown, right: string) {
  if (typeof left !== "string") return false;
  return safeEqual(left, right);
}

export function publicQuoteTokenForLead(lead: {
  quoteNumber?: string | null;
  quoteAccessSecret?: string | null;
}) {
  return lead.quoteNumber && lead.quoteAccessSecret
    ? createPublicQuoteToken(lead.quoteNumber, lead.quoteAccessSecret)
    : null;
}

function maskMiddle(value: string, visibleStart: number, visibleEnd: number) {
  if (value.length <= visibleStart + visibleEnd) return "*".repeat(value.length);
  return `${value.slice(0, visibleStart)}${"*".repeat(Math.max(2, value.length - visibleStart - visibleEnd))}${value.slice(-visibleEnd)}`;
}

export function maskPhone(value: unknown) {
  if (typeof value !== "string" || !value) return value ?? null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `${digits.slice(0, 2)}***${digits.slice(-2)}` : "***";
}

export function maskTaxId(value: unknown) {
  if (typeof value !== "string" || !value) return value ?? null;
  return maskMiddle(value, 1, 2);
}

export function maskAddress(value: unknown) {
  if (typeof value !== "string" || !value) return value ?? null;
  const compact = value.trim();
  return compact.length > 12 ? `${compact.slice(0, 8)}…${compact.slice(-4)}` : "ซ่อนข้อมูลที่อยู่";
}

export function publicQuoteResponse<T extends Record<string, unknown>>(lead: T) {
  const {
    quoteAccessSecret: _quoteAccessSecret,
    publicQuoteToken: _publicQuoteToken,
    ...safeLead
  } = lead;
  // The signed quote token is the access control for this document. The
  // customer-approved quote must remain printable with the same full details
  // that staff entered, including nested quick-purchase customer data.
  return safeLead;
}

export function quoteTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}