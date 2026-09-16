import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type QuoteAccessPayload = {
  quoteNumber: string;
  accessSecret: string;
};

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

function sanitizeStudioData(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const source = value as Record<string, unknown>;
  const customer = source.customer;
  const sanitizedCustomer = customer && typeof customer === "object" && !Array.isArray(customer)
    ? {
        ...(customer as Record<string, unknown>),
        phone: maskPhone((customer as Record<string, unknown>).phone),
        taxId: maskTaxId((customer as Record<string, unknown>).taxId),
        address: maskAddress((customer as Record<string, unknown>).address),
        taxAddress: maskAddress((customer as Record<string, unknown>).taxAddress),
      }
    : customer;
  return {
    ...source,
    ...(customer ? { customer: sanitizedCustomer } : {}),
  };
}

export function publicQuoteResponse<T extends Record<string, unknown>>(lead: T) {
  const {
    quoteAccessSecret: _quoteAccessSecret,
    publicQuoteToken: _publicQuoteToken,
    ...safeLead
  } = lead;
  return {
    ...safeLead,
    phone: maskPhone(safeLead.phone),
    taxId: maskTaxId(safeLead.taxId),
    address: maskAddress(safeLead.address),
    taxAddress: maskAddress(safeLead.taxAddress),
    studioData: sanitizeStudioData(safeLead.studioData),
  };
}

export function quoteTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}