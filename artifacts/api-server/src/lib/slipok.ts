// SlipOK (https://slipok.com) verifies a Thai bank transfer slip photo
// against real bank transaction data. We submit the slip image plus the
// amount we expect (the quote total) and SlipOK cross-checks both the
// transfer itself and the amount, returning a documented error code when
// something doesn't match -- see SLIPOK_ERROR_CODES below. We always
// report back exactly what SlipOK said, including a rejection, rather than
// collapsing every outcome into a bare "failed" (CONTRIBUTING.md rule 1).

export type SlipOkSuccess = {
  ok: true;
  transRef: string;
  transDate: string;
  transTime: string;
  senderName: string | null;
  amount: number;
  raw: unknown;
};

export type SlipOkFailure = {
  ok: false;
  errorCode: string | null;
  message: string;
  raw: unknown;
};

export type SlipOkResult = SlipOkSuccess | SlipOkFailure;

/** Documented SlipOK error codes worth surfacing to an admin verbatim. */
export const SLIPOK_ERROR_CODES: Record<string, string> = {
  "1005": "ไฟล์ที่อัปโหลดไม่ใช่ไฟล์ภาพที่รองรับ",
  "1006": "รูปภาพไม่ถูกต้องหรือเสียหาย",
  "1007": "รูปภาพไม่มี QR Code (มักเป็นสลิปโอนแบบ RTGS/SWIFT หรือใบแจ้งยอดของบัญชีนิติบุคคล)",
  "1010": "สลิปมาช้าเกินไป (delay slip)",
  "1012": "สลิปนี้ถูกใช้ยืนยันไปแล้ว (ซ้ำ)",
  "1013": "ยอดเงินในสลิปไม่ตรงกับยอดที่คาดไว้",
  "1014": "บัญชีผู้รับในสลิปไม่ตรงกับบัญชีที่ผูกไว้",
};

/**
 * These codes mean SlipOK could not read the image as a payment-verification
 * QR slip at all -- most commonly a corporate RTGS/SWIFT transfer receipt or
 * an older banking portal export, neither of which ever had a QR code to
 * check. This is fundamentally different from a genuine mismatch (wrong
 * amount, wrong account, duplicate, expired): no slip-verification provider
 * on the market can check a slip without a QR code against the bank's own
 * transaction record, so these cases should route to manual admin review
 * rather than being auto-rejected as if the payment itself were suspect.
 */
export const SLIPOK_UNVERIFIABLE_CODES: ReadonlySet<string> = new Set(["1005", "1006", "1007"]);

function slipOkCredentials() {
  const apiKey = process.env["SLIPOK_API_KEY"];
  const branchId = process.env["SLIPOK_BRANCH_ID"];
  if (!apiKey || !branchId) return null;
  return { apiKey, branchId };
}

export function slipOkConfigured() {
  return slipOkCredentials() !== null;
}

/**
 * Verify a slip image against an expected amount. Returns a typed failure
 * (never throws) for both configuration gaps and SlipOK-reported rejections,
 * so the caller can always persist and report a concrete outcome.
 */
export async function verifySlip(
  image: { buffer: Buffer; contentType: string; originalName: string },
  expectedAmountThb: number | null,
): Promise<SlipOkResult> {
  const credentials = slipOkCredentials();
  if (!credentials) {
    return { ok: false, errorCode: null, message: "ยังไม่ได้ตั้งค่า SlipOK (SLIPOK_API_KEY / SLIPOK_BRANCH_ID)", raw: null };
  }

  const form = new FormData();
  form.append("files", new Blob([Uint8Array.from(image.buffer)], { type: image.contentType }), image.originalName);
  form.append("log", "true");
  if (typeof expectedAmountThb === "number" && Number.isFinite(expectedAmountThb)) {
    form.append("amount", String(Math.round(expectedAmountThb)));
  }

  let payload: unknown;
  try {
    const response = await fetch(`https://api.slipok.com/api/line/apikey/${credentials.branchId}`, {
      method: "POST",
      headers: { "x-authorization": credentials.apiKey },
      body: form,
    });
    payload = await response.json().catch(() => null);
  } catch (error) {
    return {
      ok: false,
      errorCode: null,
      message: error instanceof Error ? `เรียก SlipOK ไม่สำเร็จ: ${error.message}` : "เรียก SlipOK ไม่สำเร็จ",
      raw: null,
    };
  }

  const body = payload as {
    success?: boolean;
    message?: string;
    code?: number | string;
    data?: {
      transRef?: string;
      transDate?: string;
      transTime?: string;
      amount?: number;
      sender?: { name?: string; displayName?: string };
    };
  } | null;

  if (!body?.success || !body.data) {
    const errorCode = body?.code !== undefined ? String(body.code) : null;
    const knownMessage = errorCode ? SLIPOK_ERROR_CODES[errorCode] : undefined;
    return {
      ok: false,
      errorCode,
      message: knownMessage ?? body?.message ?? "SlipOK ตรวจสอบสลิปไม่ผ่าน",
      raw: payload,
    };
  }

  return {
    ok: true,
    transRef: body.data.transRef ?? "",
    transDate: body.data.transDate ?? "",
    transTime: body.data.transTime ?? "",
    senderName: body.data.sender?.name ?? body.data.sender?.displayName ?? null,
    amount: typeof body.data.amount === "number" ? body.data.amount : 0,
    raw: payload,
  };
}
