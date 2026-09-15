export type NotificationStatus = "notified" | "saved_not_notified";

export type NotificationResult = {
  notificationStatus: NotificationStatus;
  message: string;
};

import { formatThaiDateOnly, formatThaiDateTime } from "./date-time";

type LeadNotificationData = {
  name: string | null;
  phone: string | null;
  project: string | null;
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

function formatNotificationItems(items: NotificationItem[], fallbackSkus: string[]) {
  const lines = items.flatMap((item) => {
    const code = item.code?.trim();
    const quantity = typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 1;
    const label = itemLabel(item);
    if (!code) return [];
    if (itemKind(item) === "basin") {
      return [`- ${code}${label ? ` ${label}` : ""} ×${formatQuantity(quantity)} ชุด`];
    }
    if (itemKind(item) === "stone") {
      const unit = item.unit?.trim() || "ตร.ม.";
      return [`- หิน ${code}${label ? ` ${label}` : ""} ${formatQuantity(quantity)} ${unit}`];
    }
    const unit = item.unit?.trim() || "";
    return [`- ${label || code}${unit ? ` ${formatQuantity(quantity)} ${unit}` : ""}`];
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
    estimate?: { subtotalTHB?: number; vatAmountTHB?: number; totalTHB?: number; stoneUnitPriceTHB?: number };
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
  const items = formatNotificationItems(notificationItems(studio), lead.productSkus);
  const has9500StoneRate = notificationItems(studio).some((item) => itemKind(item) === "stone" && item.unitPriceTHB === 9500) ||
    studio?.estimate?.stoneUnitPriceTHB === 9500;
  return [
    `Knight Basins: ${title}`,
    `⏰ ${formatThaiDateTime()} น.`,
    `เลขที่: ${lead.quoteNumber || "-"}`,
    `ผู้ติดต่อ: ${lead.name || "-"} · โครงการ: ${lead.project || "-"}`,
    `โทร: ${lead.phone || "-"}`,
    `ประเภทลูกค้า: ${customerRoleLabel(lead.customerRole)} · ติดต่อสะดวกทาง: ${preferredContactLabel(lead.preferredContact)}`,
    `สถานที่ติดตั้ง: ${propertyTypeLabel(lead.propertyType)}${lead.condoFloor ? ` · ชั้น ${lead.condoFloor}` : ""} · ที่อยู่ ${labelValue(lead.address)}`,
    `วันที่คาดว่าจะติดตั้ง: ${formatThaiDateOnly(lead.expectedInstallationDate)}`,
    `ข้อมูลใบกำกับภาษี: ${labelValue(lead.taxName)} · Tax ID ${labelValue(lead.taxId)} · ${labelValue(lead.taxBranch)}`,
    `ที่อยู่ใบกำกับภาษี: ${labelValue(lead.taxAddress)}`,
    "รายการ:",
    ...items,
    ...(has9500StoneRate ? ["*(ยอดรวมสุทธินี้ยังไม่รวมราคาหินลายหินอ่อน — ทีมขายจะประเมินราคาเพิ่ม)*"] : []),
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

export async function notifySketch(
  lead: LeadNotificationData,
  origin: string,
  quotePath?: string,
) {
  const photoPath = lead.sketchUrl;
  if (!photoPath) return missingNotification("บันทึกแล้ว แต่ไม่มีไฟล์แบบร่างสำหรับส่งแจ้งเตือน");
  const photoUrl = publicUrl(origin, photoPath);
  const quoteUrl = quotePath
    ? publicUrl(origin, quotePath)
    : lead.quoteNumber
      ? publicUrl(origin, `/quote/view?quote=${encodeURIComponent(lead.quoteNumber)}`)
      : "";
  const caption = quoteSummary(lead, quoteUrl, "มีแบบร่างใหม่");
  if (configuredChannel() === "telegram") {
    const button = quoteUrl
      ? { text: "เปิดใบเสนอราคา", url: quoteUrl }
      : { text: "เปิดดูรูปเต็ม", url: photoUrl };
    return sendTelegramPhoto(photoUrl, caption, button);
  }
  return sendLineText(quoteUrl ? caption : `${caption}\nไฟล์: ${photoUrl}`);
}
