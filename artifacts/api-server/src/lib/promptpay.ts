// Thai PromptPay EMVCo QR payload generator.
//
// This builds the raw text payload that a QR-code renderer turns into an
// actual scannable image -- it does not render SVG/PNG itself. The
// `knight-basins` frontend already depends on the `qrcode` npm package for
// client-side rendering; adding an image-rendering dependency to api-server
// itself would mean touching package.json, outside this module's own scope.

function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

const PROMPTPAY_AID = "A000000677010111";

/**
 * CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, no reflect, no final XOR) --
 * the exact checksum the EMVCo QR spec requires for the trailing tag 63.
 */
function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * PromptPay's merchant-account sub-tag depends on the identifier type: tag
 * 02 for a 13-digit national/tax ID, tag 01 for a mobile number (formatted
 * as country code "0066" + the 9-digit local number, dropping the leading
 * 0). Anything else is rejected rather than silently building a payload the
 * receiving bank app can't resolve to an account.
 */
function merchantAccountField(target: string): { tag: string; value: string } {
  const digits = target.replace(/\D/g, "");
  if (digits.length === 13) {
    return { tag: "02", value: digits };
  }
  if (digits.length === 10 && digits.startsWith("0")) {
    return { tag: "01", value: `0066${digits.slice(1)}` };
  }
  if (digits.length === 9) {
    return { tag: "01", value: `0066${digits}` };
  }
  throw new Error(`Unrecognized PromptPay target: expected a 13-digit tax ID or a 9/10-digit mobile number, got "${target}"`);
}

export type PromptPayQrOptions = {
  /** 13-digit Thai national ID / tax ID, or a mobile phone number (any common formatting -- non-digit characters are stripped). */
  target: string;
  /** Baht amount; formatted to exactly 2 decimal places per the EMVCo spec. */
  amountThb: number;
};

/**
 * Builds a dynamic (amount-embedded) PromptPay EMVCo QR payload string.
 */
export function generatePromptPayPayload({ target, amountThb }: PromptPayQrOptions): string {
  if (!Number.isFinite(amountThb) || amountThb <= 0) {
    throw new Error("amountThb must be a positive, finite number");
  }
  const account = merchantAccountField(target);
  const merchantInfo = tlv("00", PROMPTPAY_AID) + tlv(account.tag, account.value);

  const body = [
    tlv("00", "01"), // Payload Format Indicator
    tlv("01", "12"), // Point of Initiation Method: 12 = dynamic QR (amount included)
    tlv("29", merchantInfo), // Merchant Account Information - PromptPay
    tlv("53", "764"), // Transaction Currency: 764 = THB (ISO 4217 numeric)
    tlv("54", amountThb.toFixed(2)), // Transaction Amount
    tlv("58", "TH"), // Country Code
  ].join("");

  const crc = crc16(`${body}6304`);
  return `${body}6304${crc}`;
}

export type PromptPayPaymentType = "deposit_50" | "deposit_30" | "full";

/**
 * Deposit percentage per payment type, rounded to the nearest baht. "full"
 * is always exactly the quote total -- never a percentage applied to
 * itself -- so no rounding drift can appear there.
 */
export function amountForPaymentType(totalThb: number, paymentType: PromptPayPaymentType): number {
  if (paymentType === "full") return totalThb;
  const ratio = paymentType === "deposit_50" ? 0.5 : 0.3;
  return Math.round(totalThb * ratio);
}
