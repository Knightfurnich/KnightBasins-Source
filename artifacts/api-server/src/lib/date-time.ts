export const THAI_TIME_ZONE = "Asia/Bangkok";

export function formatThaiDateTime(date = new Date()) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: THAI_TIME_ZONE,
  }).format(date);
}

export function formatThaiDateOnly(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(`${value.slice(0, 10)}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: THAI_TIME_ZONE,
  }).format(date);
}

export function formatQuoteMonth(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: THAI_TIME_ZONE,
  }).format(date);
}