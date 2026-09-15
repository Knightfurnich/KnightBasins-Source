import * as QRCode from "qrcode";
import { THAI_TIME_ZONE } from "./date-time.ts";

export type QuoteFormat = "US" | "OF";

export function formatQuoteMonth(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: THAI_TIME_ZONE }).format(date);
}

const thaiNumberWords = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const thaiNumberPositions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function thaiNumberSection(value: number): string {
  if (value === 0) return "";
  const digits = String(Math.floor(value));
  return digits.split("").map((digit, index) => {
    const number = Number(digit);
    const position = digits.length - index - 1;
    if (number === 0) return "";
    if (position === 1 && number === 1) return "สิบ";
    if (position === 1 && number === 2) return "ยี่สิบ";
    if (position === 0 && number === 1 && digits.length > 1) return "เอ็ด";
    return `${thaiNumberWords[number]}${thaiNumberPositions[position] ?? ""}`;
  }).join("");
}

export function thaiNumberText(value: number) {
  const rounded = Math.max(0, Math.round(value));
  if (rounded === 0) return "ศูนย์บาทถ้วน";
  const millions = Math.floor(rounded / 1_000_000);
  const remainder = rounded % 1_000_000;
  const baht = `${millions ? `${thaiNumberSection(millions)}ล้าน` : ""}${remainder ? thaiNumberSection(remainder) : ""}`;
  return `${baht}บาทถ้วน`;
}

export function quoteQrImageUrl(value: string) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const quietZone = 4;
  const size = qr.modules.size + quietZone * 2;
  const modules = Array.from({ length: qr.modules.size }, (_, row) =>
    Array.from({ length: qr.modules.size }, (_, column) =>
      qr.modules.get(row, column) ? `M${column + quietZone} ${row + quietZone}h1v1H${column + quietZone}z` : "",
    ).join(""),
  ).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${modules}" fill="#000"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function calculateFormalQuoteTotals({
  basinSubtotal,
  requestedInstallationCharge,
  basinSets,
  stoneTotal,
  vat,
  vatRate = 0.07,
}: {
  basinSubtotal: number;
  requestedInstallationCharge: number;
  basinSets: number;
  stoneTotal: number;
  vat: boolean;
  vatRate?: number;
}) {
  const installationDiscount = basinSets >= 3 ? requestedInstallationCharge : 0;
  const installationCharge = requestedInstallationCharge - installationDiscount;
  const grossSubtotal = basinSubtotal + requestedInstallationCharge + stoneTotal;
  const subtotal = grossSubtotal - installationDiscount;
  const vatAmount = vat ? Math.round(subtotal * vatRate) : 0;
  return { installationDiscount, installationCharge, grossSubtotal, subtotal, vatAmount, total: subtotal + vatAmount };
}