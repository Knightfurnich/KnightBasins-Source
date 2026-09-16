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

export function isTallBasinSku(value: string) {
  const sku = value.trim().toUpperCase();
  return sku === "KF029" || sku === "KF030";
}