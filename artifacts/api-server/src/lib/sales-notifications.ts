export type NotificationStatus = "notified" | "saved_not_notified";

export type NotificationResult = {
  notificationStatus: NotificationStatus;
  message: string;
};

type LeadNotificationData = {
  name: string | null;
  phone: string | null;
  project: string | null;
  productSkus: string[];
  quoteNumber?: string | null;
  orderMode?: string;
  studioData?: unknown;
  sketchUrl?: string | null;
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

function quoteSummary(lead: LeadNotificationData, quoteUrl: string) {
  const studio = lead.studioData as {
    total?: number;
    items?: Array<{ code?: string; description?: string; quantity?: number; unit?: string }>;
    quickQuote?: { total?: number; items?: Array<{ code?: string; description?: string; quantity?: number; unit?: string }> };
    estimate?: { totalTHB?: number };
    state?: { basinSkus?: string[]; activeStone?: string };
  } | null;
  const total = studio?.total ?? studio?.quickQuote?.total ?? studio?.estimate?.totalTHB;
  const snapshotItems = studio?.items ?? studio?.quickQuote?.items;
  const items = snapshotItems?.length
    ? snapshotItems.map((item) => `${item.code || "-"} x${item.quantity ?? 1} ${item.unit || ""} ${item.description || ""}`.trim()).join("\n")
    : [
        ...(studio?.state?.basinSkus || []).map((sku) => `${sku} x1`),
        studio?.state?.activeStone ? `หิน ${studio.state.activeStone}` : "",
      ].filter(Boolean).join("\n");
  return [
    "Knight Basins: ใบเสนอราคาใหม่",
    `เลขที่: ${lead.quoteNumber || "-"}`,
    `ผู้ติดต่อ: ${lead.name || "-"}`,
    `โทร: ${lead.phone || "-"}`,
    `โครงการ: ${lead.project || "-"}`,
    "รายการ:",
    items || lead.productSkus.join(", ") || "-",
    `ยอดรวม: ${typeof total === "number" ? `${total.toLocaleString("th-TH")} บาท` : "-"}`,
    `ลิงก์: ${quoteUrl}`,
  ].join("\n");
}

async function sendTelegramText(text: string): Promise<NotificationResult> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const chatId = process.env["TELEGRAM_SALES_CHAT_ID"];
  if (!token || !chatId) {
    return missingNotification("บันทึกแล้ว แต่ยังไม่ได้ส่งแจ้งเตือน Telegram เพราะยังไม่ได้ตั้งค่า token หรือ chat ID");
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
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

async function sendTelegramPhoto(photoUrl: string, caption: string): Promise<NotificationResult> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const chatId = process.env["TELEGRAM_SALES_CHAT_ID"];
  if (!token || !chatId) {
    return missingNotification("บันทึกแล้ว แต่ยังไม่ได้ส่งแจ้งเตือน Telegram เพราะยังไม่ได้ตั้งค่า token หรือ chat ID");
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption }),
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
  return configuredChannel() === "telegram" ? sendTelegramText(text) : sendLineText(text);
}

export async function notifySketch(
  lead: LeadNotificationData,
  origin: string,
  quotePath?: string,
) {
  const photoPath = lead.sketchUrl;
  if (!photoPath) return missingNotification("บันทึกแล้ว แต่ไม่มีไฟล์แบบร่างสำหรับส่งแจ้งเตือน");
  const photoUrl = publicUrl(origin, photoPath);
  const quoteUrl = quotePath ? publicUrl(origin, quotePath) : "";
  const caption = [
    "Knight Basins: มีแบบร่างใหม่",
    `ผู้ติดต่อ: ${lead.name || "-"}`,
    `โทร: ${lead.phone || "-"}`,
    `โครงการ: ${lead.project || "-"}`,
    `อ่าง: ${lead.productSkus.join(", ") || "-"}`,
    quoteUrl ? `ลิงก์ใบเสนอราคา: ${quoteUrl}` : "",
  ].filter(Boolean).join("\n");
  if (configuredChannel() === "telegram") return sendTelegramPhoto(photoUrl, caption);
  return sendLineText(`${caption}\nไฟล์: ${photoUrl}`);
}
