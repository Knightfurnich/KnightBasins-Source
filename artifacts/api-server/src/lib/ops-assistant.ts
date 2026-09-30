// Internal AI operations assistant (KRAKEN ERP manual item 15): a Gemini
// bridge that only ever reads a short, hand-picked summary of admin data and
// answers questions about it -- it never writes to the database, and the
// summary it builds is deliberately restricted to a small column allowlist
// per mode so nothing sensitive (tax IDs, secrets, access tokens) can ever
// reach the model. Mirrors lib/hermes-support.ts and lib/vertex-gemini.ts's
// { ok, reply } / { ok: false, message } shape.

import { asc, desc } from "drizzle-orm";
import { customerLeads, paymentSlips } from "@workspace/db/schema";
import { askGemini, vertexGeminiConfigured, type GeminiResult } from "./vertex-gemini.ts";

export type OpsAssistantMode = "dashboard" | "leads" | "calendar";

export const OPS_ASSISTANT_MODES: OpsAssistantMode[] = ["dashboard", "leads", "calendar"];

/** Hard cap on the context summary handed to the model, to keep token usage predictable. */
const MAX_CONTEXT_SUMMARY_LENGTH = 2000;

const SYSTEM_PROMPT =
  "คุณเป็นผู้ช่วยตอบคำถามข้อมูลภายในของบริษัท ไนท์ เฟอร์นิช ตอบเป็นภาษาไทย กระชับ " +
  "ใช้เฉพาะข้อมูลที่ให้มา หากไม่มีข้อมูลให้บอกว่าไม่พบข้อมูล ห้ามเดาตัวเลข ห้ามแนะนำการแก้ไขข้อมูลในระบบ";

const READY_FOR_PRODUCTION_STATUS = "ready_for_production";
const CLOSED_STATUS = "closed";
const PAID_SLIP_STATUSES = new Set(["verified", "team_reported_paid"]);
const RECENT_LEADS_LIMIT = 10;

type OpsDatabase = {
  select: (...args: any[]) => any;
};

/**
 * Dynamic import (not a static one) so that test files which never touch the
 * database don't pay @workspace/db's "DATABASE_URL must be set" module-load
 * check just for importing this file -- same rationale as
 * lib/google-tts.ts's refreshActiveVoiceRow().
 */
async function resolveOpsDatabase(): Promise<OpsDatabase> {
  const { db } = await import("@workspace/db");
  return db;
}

/** {start, end} ISO dates ("YYYY-MM-DD") spanning the calendar month of `now` in Asia/Bangkok. */
function bangkokMonthRange(now: Date): { start: string; end: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(lookup["year"]);
  const month = Number(lookup["month"]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad2 = (value: number) => String(value).padStart(2, "0");
  return {
    start: `${year}-${pad2(month)}-01`,
    end: `${year}-${pad2(month)}-${pad2(lastDay)}`,
  };
}

async function fetchDashboardSummary(database: OpsDatabase): Promise<string> {
  const leadRows: Array<{ status: string }> = await database
    .select({ status: customerLeads.status })
    .from(customerLeads)
    .orderBy(asc(customerLeads.id));

  const statusCounts = new Map<string, number>();
  for (const row of leadRows) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  }

  const slipRows: Array<{
    status: string;
    verifiedAmountThb: number | null;
    claimedAmountThb: number | null;
    createdAt: string;
  }> = await database
    .select({
      status: paymentSlips.status,
      verifiedAmountThb: paymentSlips.verifiedAmountThb,
      claimedAmountThb: paymentSlips.claimedAmountThb,
      createdAt: paymentSlips.createdAt,
    })
    .from(paymentSlips)
    .orderBy(asc(paymentSlips.id));

  let latestPayment: { amount: number; createdAt: string } | null = null;
  for (const slip of slipRows) {
    if (!PAID_SLIP_STATUSES.has(slip.status)) continue;
    const amount = slip.status === "verified" ? slip.verifiedAmountThb : slip.claimedAmountThb;
    if (amount == null) continue;
    if (!latestPayment || slip.createdAt > latestPayment.createdAt) {
      latestPayment = { amount, createdAt: slip.createdAt };
    }
  }

  return [
    `จำนวน Lead ทั้งหมด: ${leadRows.length} งาน`,
    `พร้อมผลิต: ${statusCounts.get(READY_FOR_PRODUCTION_STATUS) ?? 0} งาน`,
    `ปิดการขาย: ${statusCounts.get(CLOSED_STATUS) ?? 0} งาน`,
    latestPayment
      ? `ยอดเงินที่รับชำระแล้วล่าสุด: ${latestPayment.amount.toLocaleString()} บาท (${latestPayment.createdAt.slice(0, 10)})`
      : "ยอดเงินที่รับชำระแล้วล่าสุด: ไม่พบข้อมูล",
  ].join("\n");
}

async function fetchLeadsSummary(database: OpsDatabase): Promise<string> {
  const rows: Array<{
    leadKey: string;
    name: string | null;
    status: string;
    expectedInstallationDate: string | null;
  }> = await database
    .select({
      leadKey: customerLeads.leadKey,
      name: customerLeads.name,
      status: customerLeads.status,
      expectedInstallationDate: customerLeads.expectedInstallationDate,
    })
    .from(customerLeads)
    .orderBy(desc(customerLeads.id))
    .limit(RECENT_LEADS_LIMIT);

  if (rows.length === 0) return "ไม่พบข้อมูลงานล่าสุด";

  return rows
    .map((row, index) =>
      `${index + 1}. รหัสงาน: ${row.leadKey} · ลูกค้า: ${row.name ?? "ไม่ระบุ"} · สถานะ: ${row.status} · วันติดตั้ง: ${row.expectedInstallationDate ?? "ไม่ระบุ"}`)
    .join("\n");
}

async function fetchCalendarSummary(database: OpsDatabase, now: Date): Promise<string> {
  const { start, end } = bangkokMonthRange(now);
  const rows: Array<{ technicianTeamCode: string | null; expectedInstallationDate: string | null }> = await database
    .select({
      technicianTeamCode: customerLeads.technicianTeamCode,
      expectedInstallationDate: customerLeads.expectedInstallationDate,
    })
    .from(customerLeads)
    .orderBy(asc(customerLeads.id));

  const inMonth = rows.filter((row) =>
    row.expectedInstallationDate !== null && row.expectedInstallationDate >= start && row.expectedInstallationDate <= end);

  if (inMonth.length === 0) return `เดือนนี้ยังไม่มีงานติดตั้งที่กำหนดวันไว้ (${start.slice(0, 7)})`;

  const counts = new Map<string, number>();
  for (const row of inMonth) {
    const key = row.technicianTeamCode ?? "ไม่ระบุทีม";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const lines = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([team, count]) => `ทีม ${team}: ${count} งาน`);

  return [`งานติดตั้งเดือนนี้ (${start.slice(0, 7)}) แยกตามทีมช่าง:`, ...lines].join("\n");
}

/**
 * Read-only summary of live admin data for the given mode, capped at
 * MAX_CONTEXT_SUMMARY_LENGTH characters. Column selection is an explicit
 * allowlist per mode (never taxId/taxAddress/quoteAccessSecret/tokens/etc.),
 * which is what actually keeps sensitive data out -- the length cap is only
 * a secondary safeguard.
 */
export async function buildOpsContextSummary(mode: OpsAssistantMode, now: Date = new Date()): Promise<string> {
  const database = await resolveOpsDatabase();
  const summary = mode === "leads"
    ? await fetchLeadsSummary(database)
    : mode === "calendar"
      ? await fetchCalendarSummary(database, now)
      : await fetchDashboardSummary(database);
  return summary.slice(0, MAX_CONTEXT_SUMMARY_LENGTH);
}

/**
 * Asks the ops assistant a question, grounded only in the read-only context
 * summary for `mode`. Locks the system prompt rules from KRAKEN ERP manual
 * item 15: Thai answers only, no guessed numbers, never suggest editing data.
 */
export async function askOpsAssistant(question: string, mode: OpsAssistantMode = "dashboard"): Promise<GeminiResult> {
  if (!vertexGeminiConfigured()) {
    return { ok: false, message: "ผู้ช่วย AI ยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง" };
  }
  const dataSummary = await buildOpsContextSummary(mode);
  return askGemini({
    message: question,
    contextSummary: `${SYSTEM_PROMPT}\n\nข้อมูลอ้างอิง:\n${dataSummary}`,
  });
}
