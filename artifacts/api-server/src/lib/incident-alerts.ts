import { sql } from "drizzle-orm";

export const SLIP_UPLOAD_FAILURE_THRESHOLD = 3;
export const SLIP_UPLOAD_FAILURE_WINDOW_MS = 60 * 60 * 1000;
export const SLIP_UPLOAD_ALERT_COOLDOWN_MS = 30 * 60 * 1000;
export const SLIP_UPLOAD_ALERT_SCAN_INTERVAL_MS = 15 * 1000;
export const WEEKLY_DIGEST_SEND_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export type TelegramSendResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "send_failed" | "cooldown"; message: string };

export type IncidentAlertDatabase = {
  execute?: (query: unknown) => Promise<unknown>;
};

type TelegramFetch = typeof fetch;

export async function sendTelegramText(text: string, fetcher: TelegramFetch = fetch): Promise<TelegramSendResult> {
  const token = process.env["TELEGRAM_BOT_TOKEN"]?.trim();
  const chatId = process.env["TELEGRAM_SALES_CHAT_ID"]?.trim();
  if (!token || !chatId) {
    return { ok: false, reason: "not_configured", message: "Telegram ยังไม่ได้ตั้งค่า" };
  }

  try {
    const response = await fetcher(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const payload = await response.json().catch(() => null) as { ok?: unknown } | null;
    if (!response.ok || payload?.ok !== true) {
      return { ok: false, reason: "send_failed", message: `Telegram ส่งข้อความไม่สำเร็จ (${response.status})` };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "send_failed", message: "ติดต่อ Telegram ไม่สำเร็จ" };
  }
}

let lastWeeklyDigestSentAt = Number.NEGATIVE_INFINITY;
let weeklyDigestSendInFlight = false;

export async function sendWeeklyDigestText(
  text: string,
  now = new Date(),
): Promise<TelegramSendResult> {
  if (
    weeklyDigestSendInFlight ||
    now.getTime() - lastWeeklyDigestSentAt < WEEKLY_DIGEST_SEND_COOLDOWN_MS
  ) {
    return { ok: false, reason: "cooldown", message: "ส่ง Knight UX Digest ไปแล้วภายใน 7 วันล่าสุด" };
  }

  weeklyDigestSendInFlight = true;
  try {
    const result = await sendTelegramText(text);
    if (result.ok) lastWeeklyDigestSentAt = now.getTime();
    return result;
  } finally {
    weeklyDigestSendInFlight = false;
  }
}

function queryRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
  }
  if (!result || typeof result !== "object") return [];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows)
    ? rows.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    : [];
}

export type SlipUploadIncidentResult =
  | { status: "below_threshold"; recentFailures: number }
  | { status: "cooldown"; recentFailures: number }
  | { status: "sent"; recentFailures: number }
  | { status: "not_configured"; recentFailures: number }
  | { status: "send_failed"; recentFailures: number }
  | { status: "unavailable" | "query_failed"; recentFailures: 0 };

export function createIncidentAlertService(
  sendMessage: (text: string) => Promise<TelegramSendResult> = sendTelegramText,
) {
  let lastSuccessfulAlertAt = Number.NEGATIVE_INFINITY;
  let sendInFlight = false;

  return async function checkSlipUploadFailures(
    database: IncidentAlertDatabase,
    now = new Date(),
  ): Promise<SlipUploadIncidentResult> {
    if (typeof database.execute !== "function") return { status: "unavailable", recentFailures: 0 };

    const windowStart = new Date(now.getTime() - SLIP_UPLOAD_FAILURE_WINDOW_MS);
    let recentFailures: number;
    try {
      const result = await database.execute(sql`
        SELECT COUNT(*)::int AS "count"
        FROM system_audit_logs
        WHERE action = 'slip.upload'
          AND status = 'error'
          AND created_at >= ${windowStart}
          AND created_at < ${now}
      `);
      const rawCount = queryRows(result)[0]?.["count"];
      const parsedCount = Number(rawCount ?? 0);
      recentFailures = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 0;
    } catch {
      return { status: "query_failed", recentFailures: 0 };
    }

    if (recentFailures < SLIP_UPLOAD_FAILURE_THRESHOLD) {
      return { status: "below_threshold", recentFailures };
    }
    if (sendInFlight || now.getTime() - lastSuccessfulAlertAt < SLIP_UPLOAD_ALERT_COOLDOWN_MS) {
      return { status: "cooldown", recentFailures };
    }

    sendInFlight = true;
    try {
      const result = await sendMessage(
        `🚨 [แจ้งเตือนด่วน Knight Basins] พบปัญหาสลิปการเงินล้มเหลว ${recentFailures} ครั้งในรอบ 1 ชม. ล่าสุด! กรุณาตรวจสอบที่ /admin/logs`,
      );
      if (!result.ok) {
        return {
          status: result.reason === "not_configured" ? "not_configured" : "send_failed",
          recentFailures,
        };
      }
      lastSuccessfulAlertAt = now.getTime();
      return { status: "sent", recentFailures };
    } catch {
      return { status: "send_failed", recentFailures };
    } finally {
      sendInFlight = false;
    }
  };
}

const defaultIncidentAlertService = createIncidentAlertService();

export function checkSlipUploadFailureThreshold(
  database: IncidentAlertDatabase,
  now?: Date,
): Promise<SlipUploadIncidentResult> {
  return defaultIncidentAlertService(database, now);
}

const monitoredDatabases = new WeakSet<object>();

export function startSlipUploadAlertMonitor(
  database: IncidentAlertDatabase,
  intervalMs = SLIP_UPLOAD_ALERT_SCAN_INTERVAL_MS,
): () => void {
  const nodeEnvironment = process.env["NODE_ENV"];
  const isTestRun = Boolean(process.env["NODE_TEST_CONTEXT"]) || process.execArgv.includes("--test");
  if (
    nodeEnvironment === "development" ||
    nodeEnvironment === "test" ||
    isTestRun ||
    typeof database.execute !== "function" ||
    monitoredDatabases.has(database)
  ) {
    return () => {};
  }

  const timer = setInterval(() => {
    void checkSlipUploadFailureThreshold(database);
  }, Math.max(1_000, intervalMs));
  timer.unref?.();
  monitoredDatabases.add(database);
  return () => {
    clearInterval(timer);
    monitoredDatabases.delete(database);
  };
}