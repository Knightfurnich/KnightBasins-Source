export const THAI_TIME_ZONE = "Asia/Bangkok";

function datePart(date: Date, type: "year" | "month" | "day") {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: THAI_TIME_ZONE,
    [type]: "numeric",
  } as Intl.DateTimeFormatOptions).formatToParts(date).find((part) => part.type === type)?.value ?? "";
}

export function formatThaiDate(date = new Date()) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: THAI_TIME_ZONE,
  }).format(date);
}

export function formatThaiDateTime(date = new Date()) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: THAI_TIME_ZONE,
  }).format(date);
}

export function formatEnglishDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: THAI_TIME_ZONE,
  }).format(date);
}

export function thaiDateInputValue(date: Date) {
  return `${datePart(date, "year")}-${datePart(date, "month").padStart(2, "0")}-${datePart(date, "day").padStart(2, "0")}`;
}