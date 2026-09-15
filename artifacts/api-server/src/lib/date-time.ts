export const THAI_TIME_ZONE = "Asia/Bangkok";

export function formatThaiDateTime(date = new Date()) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
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