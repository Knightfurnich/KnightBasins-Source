export type NotificationStatus = "notified" | "saved_not_notified";

export type NotificationResult = {
  notificationStatus: NotificationStatus;
  message: string;
};

import { formatThaiDateOnly, formatThaiDateTime } from "./date-time";

type LeadNotificationData = {
  name: string | null;
  phone: string | null;
  lineContact?: string | null;
  project: string | null;
  site?: string | null;
  purchasingDepartment?: string | null;
  address?: string | null;
  productSkus: string[];
  quoteNumber?: string | null;
  orderMode?: string;
  studioData?: unknown;
  sketchUrl?: string | null;
  taxName?: string | null;
  taxId?: string | null;
  taxBranch?: string | null;
  taxAddress?: string | null;
  preferredContact?: string | null;
  customerRole?: string | null;
  propertyType?: string | null;
  condoFloor?: string | null;
  expectedInstallationDate?: string | Date | null;
};

type NotificationItem = {
  kind?: "basin" | "stone" | "service";
  notificationKind?: "basin" | "stone" | "service";
  code?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  unitPriceTHB?: number;
  totalTHB?: number;
};

type NotificationSnapshot = {
  items?: NotificationItem[];
  subtotal?: number;
  vatAmount?: number;
  total?: number;
  vat?: boolean;
};

function configuredChannel() {
  return process.env["NOTIFY_CHANNEL"]?.trim().toLowerCase() === "telegram" ? "telegram" : "line";
}

function missingNotification(message: string): NotificationResult {
  return { notificationStatus: "saved_not_notified", message };
}

function publicUrl(origin: string, path: string) {
  return new URL(path, origin.endsWith("/") ? origin : `${origin}/`).toString();
}

function formatQuantity(quantity: number) {
  return quantity.toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

function formatBaht(amount: number) {
  return Math.round(amount).toLocaleString("th-TH");
}

function labelValue(value: string | null | undefined) {
  return value?.trim() || "-";
}

function customerRoleLabel(value: string | null | undefined) {
  return {
    homeowner: "ลูกค้าบ้านพักอาศัย",
    "architect-interior": "สถาปนิก / อินทีเรีย",
    contractor: "ผู้รับเหมาก่อสร้าง",
  }[value ?? ""] ?? labelValue(value);
}

function propertyTypeLabel(value: string | null | undefined) {
  return {
    "house-townhome": "บ้านเดี่ยว / ทาวน์โฮม",
    condo: "คอนโด",
    commercial: "อาคารพาณิชย์",
  }[value ?? ""] ?? labelValue(value);
}

function preferredContactLabel(value: string | null | undefined) {
  return { line: "LINE", phone: "โทรศัพท์", email: "อีเมล" }[value ?? ""] ?? labelValue(value);
}

function itemLabel(item: NotificationItem) {
  return item.description?.split("·", 1)[0]?.trim() || "";
}

function notificationItems(studio: Record<string, unknown> | null) {
  const snapshot = studio?.notification as NotificationSnapshot | undefined;
  const items = snapshot?.items ?? (studio?.items as NotificationItem[] | undefined) ?? (studio?.quickQuote as { items?: NotificationItem[] } | undefined)?.items;
  return Array.isArray(items) ? items : [];
}

function itemKind(item: NotificationItem) {
  if (item.kind || item.notificationKind) return item.kind ?? item.notificationKind;
  if (item.code?.startsWith("KF")) return "basin";
  if (item.unit === "ตร.ม." || item.unit === "แผ่น") return "stone";
  return "service";
}

/** ส่วนท้ายของบรรทัดรายการ: " × ฿ราคาต่อหน่วย = ฿ยอดรวม" — เว้นว่างถ้าไม่มีราคา */
function itemPriceSuffix(item: NotificationItem, quantity: number) {
  const unitPrice = typeof item.unitPriceTHB === "number" && Number.isFinite(item.unitPriceTHB) ? item.unitPriceTHB : null;
  const total = typeof item.totalTHB === "number" && Number.isFinite(item.totalTHB)
    ? item.totalTHB
    : unitPrice !== null ? quantity * unitPrice : null;
  if (total === null || total <= 0) return "";
  if (unitPrice !== null && unitPrice > 0) return ` × ฿${formatBaht(unitPrice)} = ฿${formatBaht(total)}`;
  return ` = ฿${formatBaht(total)}`;
}

/**
 * บล็อก "วิธีคำนวณ" สำหรับข้อความแจ้งเตือน — อ่านจาก estimate ที่แนบมากับ studioData
 * ครอบทั้งเส้นทาง Studio (มีรายการ) และ sketch (ไม่มีรายการ แต่มี estimate)
 */
function estimateBreakdown(studio: unknown): string[] {
  if (!studio || typeof studio !== "object") return [];
  const s = studio as Record<string, unknown>;
  const est = s["estimate"];
  if (!est || typeof est !== "object") return [];
  const e = est as Record<string, unknown>;
  const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
  const q = (value: number) => value.toLocaleString("th-TH", { maximumFractionDigits: 3 });
  const stone = typeof s["activeStone"] === "string" ? s["activeStone"] : "";
  const lines: string[] = [];
  const area = num(e["counterAreaSqM"]);
  if (area > 0) {
    const rate = num(e["stoneUnitPriceTHB"]);
    lines.push(`• หิน${stone ? ` ${stone}` : ""} ${q(area)} ตร.ม. × ฿${formatBaht(rate)} = ฿${formatBaht(num(e["stoneTotalTHB"]))}`);
  }
  const upstandLength = num(e["upstandLengthM"]);
  if (upstandLength > 0) lines.push(`• บัว ${q(upstandLength)} ม. = ฿${formatBaht(num(e["upstandTotalTHB"]))}`);
  const openEdgeLength = num(e["openEdgeLengthM"]);
  if (openEdgeLength > 0) {
    const openEdgeRate = num(e["openEdgeUnitPriceTHB"]);
    lines.push(`• ปิดขอบเปิด ${q(openEdgeLength)} ม.${openEdgeRate > 0 ? ` × ฿${formatBaht(openEdgeRate)}` : " (ยังไม่ระบุราคา/ม.)"} = ฿${formatBaht(num(e["openEdgeTotalTHB"]))}`);
  }
  const basinTotal = num(e["basinSubtotalTHB"]);
  if (basinTotal > 0) lines.push(`• อ่างล้างหน้า = ฿${formatBaht(basinTotal)}`);
  const installation = num(e["installationChargeTHB"]);
  if (installation > 0) lines.push(`• ค่าติดตั้ง = ฿${formatBaht(installation)}`);
  const installationDiscount = num(e["installationDiscountTHB"]);
  if (installationDiscount > 0) lines.push(`• ติดตั้งฟรี (3 ชุดขึ้นไป) = −฿${formatBaht(installationDiscount)}`);
  const smallJob = num(e["smallJobFeeTHB"]);
  if (smallJob > 0) lines.push(`• ค่าดำเนินการงานพื้นที่เล็ก = ฿${formatBaht(smallJob)}`);
  const discount = num(e["discountTHB"]);
  if (discount > 0) lines.push(`• ส่วนลด = −฿${formatBaht(discount)}`);
  return lines.length ? ["วิธีคำนวณ:", ...lines] : [];
}

function formatNotificationItems(items: NotificationItem[], fallbackSkus: string[]) {
  const lines = items.flatMap((item) => {
    const code = item.code?.trim();
    const quantity = typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 1;
    const label = itemLabel(item);
    if (!code) return [];
    if (itemKind(item) === "basin") {
      return [`- ${code}${label ? ` ${label}` : ""} ×${formatQuantity(quantity)} ชุด${itemPriceSuffix(item, quantity)}`];
    }
    if (itemKind(item) === "stone") {
      const unit = item.unit?.trim() || "ตร.ม.";
      return [`- หิน ${code}${label ? ` ${label}` : ""} ${formatQuantity(quantity)} ${unit}${itemPriceSuffix(item, quantity)}`];
    }
    const unit = item.unit?.trim() || "";
    return [`- ${label || code}${unit ? ` ${formatQuantity(quantity)} ${unit}` : ""}${itemPriceSuffix(item, quantity)}`];
  });
  if (lines.length) return lines;
  return fallbackSkus.map((sku) => `- ${sku} ×1 ชุด`);
}

function quoteSummary(lead: LeadNotificationData, quoteUrl: string, title = "ใบเสนอราคาใหม่") {
  const studio = lead.studioData as {
    notification?: NotificationSnapshot;
    subtotal?: number;
    vatAmount?: number;
    total?: number;
    vat?: boolean;
    items?: NotificationItem[];
    quickQuote?: { subtotal?: number; vatAmount?: number; total?: number; vat?: boolean; items?: NotificationItem[] };
    estimate?: {
      subtotalTHB?: number;
      vatAmountTHB?: number;
      totalTHB?: number;
      stoneUnitPriceTHB?: number;
      counterAreaSqM?: number;
      stoneTotalTHB?: number;
      upstandLengthM?: number;
      upstandTotalTHB?: number;
      openEdgeLengthM?: number;
      openEdgeUnitPriceTHB?: number | null;
      openEdgeTotalTHB?: number;
      basinSubtotalTHB?: number;
      installationChargeTHB?: number;
      installationDiscountTHB?: number;
      smallJobFeeTHB?: number;
      discountTHB?: number;
    };
    activeStone?: string;
  } | null;
  const notification = studio?.notification;
  const subtotal = notification?.subtotal
    ?? studio?.subtotal
    ?? studio?.quickQuote?.subtotal
    ?? studio?.estimate?.subtotalTHB;
  const vatAmount = notification?.vatAmount
    ?? studio?.vatAmount
    ?? studio?.quickQuote?.vatAmount
    ?? studio?.estimate?.vatAmountTHB
    ?? 0;
  const total = notification?.total
    ?? studio?.total
    ?? studio?.quickQuote?.total
    ?? studio?.estimate?.totalTHB
    ?? subtotal;
  const vat = notification?.vat
    ?? studio?.vat
    ?? studio?.quickQuote?.vat
    ?? vatAmount > 0;
  const rawItems = notificationItems(studio);
  const items = formatNotificationItems(rawItems, lead.productSkus);
  const has9500StoneRate = notificationItems(studio).some((item) => itemKind(item) === "stone" && item.unitPriceTHB === 9500) ||
    studio?.estimate?.stoneUnitPriceTHB === 9500;
  return [
    `Knight Basins: ${title}`,
    `⏰ ${formatThaiDateTime()} น.`,
    `เลขที่: ${lead.quoteNumber || "-"}`,
    `ผู้ติดต่อ: ${lead.name || "-"} · โครงการ: ${lead.project || "-"}`,
    `โทร: ${lead.phone || "-"}`,
    `LINE ติดต่อ: ${lead.lineContact || "-"}`,
    `หน้างาน: ${labelValue(lead.site)}`,
    `ฝ่ายจัดซื้อ / บัญชี: ${labelValue(lead.purchasingDepartment)}`,
    `ประเภทลูกค้า: ${customerRoleLabel(lead.customerRole)} · ติดต่อสะดวกทาง: ${preferredContactLabel(lead.preferredContact)}`,
    `สถานที่ติดตั้ง: ${propertyTypeLabel(lead.propertyType)}${lead.condoFloor ? ` · ชั้น ${lead.condoFloor}` : ""} · ที่อยู่ ${labelValue(lead.address)}`,
    `วันที่คาดว่าจะติดตั้ง: ${formatThaiDateOnly(lead.expectedInstallationDate)}`,
    `ข้อมูลใบกำกับภาษี: ${labelValue(lead.taxName)} · Tax ID ${labelValue(lead.taxId)} · ${labelValue(lead.taxBranch)}`,
    `ที่อยู่ใบกำกับภาษี: ${labelValue(lead.taxAddress)}`,
    ...(items.length
      ? [rawItems.length > 0 ? "รายการ:" : "อ่างที่ลูกค้าสนใจ (ยังไม่ได้เลือกเข้าออเดอร์):", ...items]
      : []),
    ...(has9500StoneRate ? ["*(ยอดรวมสุทธินี้ยังไม่รวมราคาหินลายหินอ่อน — ทีมขายจะประเมินราคาเพิ่ม)*"] : []),
    ...estimateBreakdown(studio),
    ...(vat
      ? [
          `ยอดก่อน VAT: ${typeof subtotal === "number" ? `${formatBaht(subtotal)} บาท` : "-"}`,
          `VAT 7%: ${formatBaht(vatAmount)} บาท`,
          `ยอดรวมสุทธิ: ${typeof total === "number" ? `${formatBaht(total)} บาท` : "-"}`,
        ]
      : [`ยอดรวม (ยังไม่รวม VAT): ${typeof subtotal === "number" ? `${formatBaht(subtotal)} บาท` : "-"}`]),
    ...(quoteUrl ? [`ลิงก์: ${quoteUrl}`] : ["(แนบรูปมาแล้วในข้อความนี้)"]),
  ].join("\n");
}

type TelegramButton = {
  text: string;
  url: string;
};

function telegramReplyMarkup(button?: TelegramButton) {
  return button ? { inline_keyboard: [[button]] } : undefined;
}

async function sendTelegramText(text: string, button?: TelegramButton): Promise<NotificationResult> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const chatId = process.env["TELEGRAM_SALES_CHAT_ID"];
  if (!token || !chatId) {
    return missingNotification("บันทึกแล้ว แต่ยังไม่ได้ส่งแจ้งเตือน Telegram เพราะยังไม่ได้ตั้งค่า token หรือ chat ID");
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, ...(button ? { reply_markup: telegramReplyMarkup(button) } : {}) }),
    });
    const payload = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.description || `Telegram sendMessage returned ${response.status}`);
    }
    return { notificationStatus: "notified", message: "ส่งแจ้งเตือน Telegram แล้ว" };
  } catch (error) {
    console.warn("Telegram text notification failed", error instanceof Error ? error.message : "unknown");
    return missingNotification("บันทึกแล้ว แต่ส่งแจ้งเตือน Telegram ไม่สำเร็จ กรุณาลองใหม่");
  }
}

async function sendTelegramMediaGroup(photoUrls: string[], caption: string): Promise<NotificationResult> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const chatId = process.env["TELEGRAM_SALES_CHAT_ID"];
  if (!token || !chatId) {
    return missingNotification("บันทึกแล้ว แต่ยังไม่ได้ส่งแจ้งเตือน Telegram เพราะยังไม่ได้ตั้งค่า token หรือ chat ID");
  }
  try {
    const media = photoUrls.map((url, index) => ({
      type: "photo",
      media: url,
      ...(index === 0 ? { caption } : {}),
    }));
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, media }),
    });
    const payload = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.description || `Telegram sendMediaGroup returned ${response.status}`);
    }
    return { notificationStatus: "notified", message: "ส่งแบบร่างเข้า Telegram แล้ว" };
  } catch (error) {
    console.warn("Telegram media group notification failed", error instanceof Error ? error.message : "unknown");
    return missingNotification("บันทึกแล้ว แต่ส่งแบบร่างเข้า Telegram ไม่สำเร็จ กรุณาลองใหม่");
  }
}

async function sendTelegramPhoto(photoUrl: string, caption: string, button?: TelegramButton): Promise<NotificationResult> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const chatId = process.env["TELEGRAM_SALES_CHAT_ID"];
  if (!token || !chatId) {
    return missingNotification("บันทึกแล้ว แต่ยังไม่ได้ส่งแจ้งเตือน Telegram เพราะยังไม่ได้ตั้งค่า token หรือ chat ID");
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption, ...(button ? { reply_markup: telegramReplyMarkup(button) } : {}) }),
    });
    const payload = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.description || `Telegram sendPhoto returned ${response.status}`);
    }
    return { notificationStatus: "notified", message: "ส่งแบบร่างเข้า Telegram แล้ว" };
  } catch (error) {
    console.warn("Telegram photo notification failed", error instanceof Error ? error.message : "unknown");
    return missingNotification("บันทึกแล้ว แต่ส่งแบบร่างเข้า Telegram ไม่สำเร็จ กรุณาลองใหม่");
  }
}

async function sendLineText(text: string): Promise<NotificationResult> {
  const accessToken = process.env["LINE_MESSAGING_ACCESS_TOKEN"] ?? process.env["LINE_CHANNEL_ACCESS_TOKEN"];
  const destination = process.env["LINE_SALES_DESTINATION_ID"];
  if (!accessToken || !destination) {
    return missingNotification("บันทึกแล้ว แต่ยังไม่ได้ส่งแจ้งเตือน LINE เพราะยังไม่ได้ตั้งค่า channel หรือปลายทาง");
  }
  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: destination, messages: [{ type: "text", text }] }),
    });
    if (!response.ok) throw new Error(`LINE push returned ${response.status}`);
    return { notificationStatus: "notified", message: "ส่งแจ้งเตือน LINE แล้ว" };
  } catch (error) {
    console.warn("LINE text notification failed", error instanceof Error ? error.message : "unknown");
    return missingNotification("บันทึกแล้ว แต่ส่งแจ้งเตือน LINE ไม่สำเร็จ กรุณาลองใหม่");
  }
}

export async function notifyQuote(lead: LeadNotificationData, origin: string, quotePath: string) {
  const quoteUrl = publicUrl(origin, quotePath);
  const text = quoteSummary(lead, quoteUrl);
  const button = { text: "เปิดใบเสนอราคา", url: quoteUrl };
  return configuredChannel() === "telegram" ? sendTelegramText(text, button) : sendLineText(text);
}

function sketchPhotoPaths(lead: LeadNotificationData): string[] {
  const studio = lead.studioData as { sketchUrls?: unknown } | null | undefined;
  const urls = Array.isArray(studio?.sketchUrls)
    ? studio.sketchUrls.filter((url): url is string => typeof url === "string" && url.length > 0)
    : [];
  if (urls.length) return urls;
  return lead.sketchUrl ? [lead.sketchUrl] : [];
}

export async function notifySketch(
  lead: LeadNotificationData,
  origin: string,
  quotePath?: string,
) {
  const photoPaths = sketchPhotoPaths(lead);
  if (!photoPaths.length) return missingNotification("บันทึกแล้ว แต่ไม่มีไฟล์แบบร่างสำหรับส่งแจ้งเตือน");
  const photoUrls = photoPaths.map((path) => publicUrl(origin, path));
  const quoteUrl = quotePath
    ? publicUrl(origin, quotePath)
    : "";
  const caption = quoteSummary(lead, quoteUrl, "มีแบบร่างใหม่");
  if (configuredChannel() === "telegram") {
    const button = quoteUrl
      ? { text: "เปิดใบเสนอราคา", url: quoteUrl }
      : { text: "เปิดดูรูปเต็ม", url: photoUrls[0]! };
    if (photoUrls.length === 1) return sendTelegramPhoto(photoUrls[0]!, caption, button);
    const albumResult = await sendTelegramMediaGroup(photoUrls, caption);
    if (albumResult.notificationStatus === "notified") {
      await sendTelegramText(`เปิดดู: ${button.url}`, button);
    }
    return albumResult;
  }
  const fileLines = photoUrls.map((url) => `ไฟล์: ${url}`).join("\n");
  return sendLineText(quoteUrl ? caption : `${caption}\n${fileLines}`);
}

type PaymentSlipNotificationVerdict = {
  status: "verified" | "needs_review" | "rejected";
  claimedAmountThb: number | null;
  verifiedAmountThb: number | null;
  senderName: string | null;
  errorCode: string | null;
  message: string;
};

export async function notifyPaymentSlip(
  lead: LeadNotificationData,
  origin: string,
  slipImageUrl: string,
  verdict: PaymentSlipNotificationVerdict,
  quotePath?: string,
) {
  const photoUrl = publicUrl(origin, slipImageUrl);
  const quoteUrl = quotePath ? publicUrl(origin, quotePath) : "";
  const verdictLine = verdict.status === "verified"
    ? `✅ ตรวจสอบสลิปแล้ว: ยอด ${typeof verdict.verifiedAmountThb === "number" ? `${formatBaht(verdict.verifiedAmountThb)} บาท` : "-"} จาก ${verdict.senderName ?? "-"}`
    : verdict.status === "needs_review"
      ? `👀 ต้องตรวจสอบด้วยตา: สลิปไม่มี QR Code ให้ระบบเช็คอัตโนมัติได้ (มักเป็นสลิป RTGS/SWIFT หรือใบแจ้งยอดบัญชีนิติบุคคล) กรุณาเปิดรูปแล้วยืนยันยอดเงินเอง${verdict.errorCode ? ` (code ${verdict.errorCode})` : ""}`
      : `⚠️ สลิปยังไม่ผ่านการตรวจสอบอัตโนมัติ${verdict.errorCode ? ` (code ${verdict.errorCode})` : ""}: ${verdict.message}`;
  const caption = [
    `Knight Basins: มีการอัปโหลดสลิปโอนเงิน`,
    `⏰ ${formatThaiDateTime()} น.`,
    `เลขที่: ${lead.quoteNumber || "-"}`,
    `ผู้ติดต่อ: ${lead.name || "-"} · โทร: ${lead.phone || "-"}`,
    `ยอดที่คาดไว้: ${typeof verdict.claimedAmountThb === "number" ? `${formatBaht(verdict.claimedAmountThb)} บาท` : "-"}`,
    verdictLine,
    ...(quoteUrl ? [`ลิงก์ใบเสนอราคา: ${quoteUrl}`] : []),
  ].join("\n");
  if (configuredChannel() === "telegram") {
    const button = quoteUrl ? { text: "เปิดใบเสนอราคา", url: quoteUrl } : undefined;
    return sendTelegramPhoto(photoUrl, caption, button);
  }
  return sendLineText(`${caption}\nไฟล์: ${photoUrl}`);
}
