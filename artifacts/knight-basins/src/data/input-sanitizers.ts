export function normalizeDimensionInput(value: string) {
  return value.replace(/\bD\s*(?=\d)/gi, "Ø");
}

export function cleanPhoneInput(value: string) {
  return value.replace(/[^0-9]/g, "").slice(0, 10);
}

export function sanitizePriceInput(value: string) {
  return value
    .replace(/[฿,\s]/g, "")
    .replace(/[^\d.-]/g, "");
}

export function sanitizeIntegerRange(value: unknown, min: number, max: number): number | null {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) return null;
  return value === 0 ? 0 : value;
}

function decodeHtmlEntitiesForText(value: string) {
  const namedEntitiesDecoded = value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;/gi, "'")
    .replace(/&colon;/gi, ":")
    .replace(/&tab;|&newline;/gi, " ");

  return namedEntitiesDecoded.replace(/&#(?:x([0-9a-f]{1,6})|([0-9]{1,7}));?/gi, (entity, hex: string | undefined, decimal: string | undefined) => {
    const codePoint = Number.parseInt(hex ?? decimal ?? "", hex ? 16 : 10);
    return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : entity;
  });
}

export function sanitizeTextInput(value: unknown): string {
  if (typeof value !== "string") return "";

  const decoded = decodeHtmlEntitiesForText(value);
  return decoded
    .replace(/<script\b[^>]*>[\s\S]*?(?:<\/script\s*>|$)/gi, "")
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .replace(/<\/?[a-z][^<>]*>/gi, "")
    .replace(/<![^>]*>/g, "")
    .replace(/j[\s\u0000-\u0020]*a[\s\u0000-\u0020]*v[\s\u0000-\u0020]*a[\s\u0000-\u0020]*s[\s\u0000-\u0020]*c[\s\u0000-\u0020]*r[\s\u0000-\u0020]*i[\s\u0000-\u0020]*p[\s\u0000-\u0020]*t[\s\u0000-\u0020]*:/gi, "")
    .replace(/v[\s\u0000-\u0020]*b[\s\u0000-\u0020]*s[\s\u0000-\u0020]*c[\s\u0000-\u0020]*r[\s\u0000-\u0020]*i[\s\u0000-\u0020]*p[\s\u0000-\u0020]*t[\s\u0000-\u0020]*:/gi, "")
    .replace(/\bon[a-z][a-z0-9_-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'`=<>]+)/gi, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}

export function isTallBasinSku(value: string) {
  const sku = value.trim().toUpperCase();
  return sku === "KF029" || sku === "KF030";
}