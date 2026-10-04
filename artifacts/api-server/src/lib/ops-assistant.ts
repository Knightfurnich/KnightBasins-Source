// Internal AI operations assistant (KRAKEN ERP manual item 15): a Gemini
// bridge that only ever reads a short, hand-picked summary of admin data and
// answers questions about it -- it never writes to the database, and the
// summary it builds is deliberately restricted to a small column allowlist
// per mode so nothing sensitive (tax IDs, secrets, access tokens) can ever
// reach the model. Mirrors lib/hermes-support.ts and lib/vertex-gemini.ts's
// { ok, reply } / { ok: false, message } shape.

import { asc, desc } from "drizzle-orm";
import { customerLeads, paymentSlips, technicianTeams } from "@workspace/db/schema";
import { askGemini, vertexGeminiConfigured, type GeminiResult } from "./vertex-gemini.ts";

export type OpsAssistantMode = "dashboard" | "leads" | "calendar";

export const OPS_ASSISTANT_MODES: OpsAssistantMode[] = ["dashboard", "leads", "calendar"];

/** Hard cap on the context summary handed to the model, to keep token usage predictable. */
const MAX_CONTEXT_SUMMARY_LENGTH = 2000;

const SYSTEM_PROMPT =
  "คุณเป็นผู้ช่วยตอบคำถามข้อมูลภายในของบริษัท ไนท์ เฟอร์นิช " +
  "ตอบเป็นภาษาไทยทุกครั้ง และลงท้ายทุกคำตอบด้วยคำว่า “ครับ” " +
  "ตอบตรงคำถามก่อน กระชับไม่เกิน 1–2 ประโยค " +
  "ใช้เฉพาะข้อมูลอ้างอิงที่ให้มา ห้ามเดาตัวเลขหรือแต่งรายละเอียด " +
  "ห้ามใช้ศัพท์อังกฤษหรือชื่อช่องภายใน ให้ใช้คำไทยแทน " +
  "ห้ามเปิดเผยรหัสงานหรือรหัสภายใน ให้เรียกรายการตามลำดับว่า “งานที่ 1” หรือเรียกตามชื่อว่า “งานของช่าง <ชื่อ>” " +
  "วันที่ให้ใช้รูปแบบภาษาไทย เช่น “4 ต.ค. 2569” " +
  "หากข้อมูลไม่มีหรือไม่พอ ให้บอกว่าไม่พบข้อมูลและเสนอทางเลือกที่ตรวจสอบได้แทน " +
  "ห้ามแนะนำการแก้ไขข้อมูลในระบบ";

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

/**
 * A date read from the database as "YYYY-MM-DD" (the UTC calendar day of an instant, as an ISO string would give), or null.
 * Drivers hand timestamps back as Date objects but some tests and columns carry ISO strings, so every date the summaries read
 * goes through here instead of calling string methods on it. Never throws: null, undefined, an invalid Date or text that is
 * not a date all give null.
 */
export function formatOpsDate(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    const parsed = new Date(trimmed);
    return trimmed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }
  return null;
}

/** Milliseconds since the epoch for ordering rows by time; -Infinity when the value is not a usable date. */
function opsTimeOf(value: unknown): number {
  const time = value instanceof Date ? value.getTime() : typeof value === "string" || typeof value === "number" ? new Date(value).getTime() : Number.NaN;
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

function formatThaiOpsDate(value: unknown): string | null {
  const isoDate = formatOpsDate(value);
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T12:00:00+07:00`);
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatThaiOpsMonth(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00+07:00`);
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    month: "long",
    year: "numeric",
  }).format(date);
}

const LEAD_STATUS_LABELS: Record<string, string> = {
  new_lead: "งานใหม่",
  contacted: "ติดต่อแล้ว",
  qualified: "ผ่านการคัดกรอง",
  quoted: "ส่งใบเสนอราคาแล้ว",
  ready_for_production: "พร้อมผลิต",
  closed: "ปิดการขาย",
  lost: "ยุติการติดตาม",
};

function displayLeadStatus(status: string): string {
  return LEAD_STATUS_LABELS[status] ?? "ไม่ระบุสถานะ";
}

async function fetchTechnicianTeamNames(database: OpsDatabase): Promise<Map<string, string>> {
  const rows: Array<{ code: string; name: string }> = await database
    .select({
      code: technicianTeams.code,
      name: technicianTeams.name,
    })
    .from(technicianTeams)
    .orderBy(asc(technicianTeams.sortOrder));
  return new Map(rows.map((row) => [row.code, row.name]));
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
    createdAt: Date | string | null;
  }> = await database
    .select({
      status: paymentSlips.status,
      verifiedAmountThb: paymentSlips.verifiedAmountThb,
      claimedAmountThb: paymentSlips.claimedAmountThb,
      createdAt: paymentSlips.createdAt,
    })
    .from(paymentSlips)
    .orderBy(asc(paymentSlips.id));

  let latestPayment: { amount: number; createdAt: Date | string | null } | null = null;
  for (const slip of slipRows) {
    if (!PAID_SLIP_STATUSES.has(slip.status)) continue;
    const amount = slip.status === "verified" ? slip.verifiedAmountThb : slip.claimedAmountThb;
    if (amount == null) continue;
    if (!latestPayment || opsTimeOf(slip.createdAt) > opsTimeOf(latestPayment.createdAt)) {
      latestPayment = { amount, createdAt: slip.createdAt };
    }
  }

  return [
    `จำนวนงานทั้งหมด: ${leadRows.length} งาน`,
    `พร้อมผลิต: ${statusCounts.get(READY_FOR_PRODUCTION_STATUS) ?? 0} งาน`,
    `ปิดการขาย: ${statusCounts.get(CLOSED_STATUS) ?? 0} งาน`,
    latestPayment
      ? `ยอดเงินที่รับชำระแล้วล่าสุด: ${latestPayment.amount.toLocaleString()} บาท (${formatThaiOpsDate(latestPayment.createdAt) ?? "ไม่ระบุวันที่"})`
      : "ยอดเงินที่รับชำระแล้วล่าสุด: ไม่พบข้อมูล",
  ].join("\n");
}

async function fetchLeadsSummary(database: OpsDatabase, teamNames: Map<string, string>): Promise<string> {
  const rows: Array<{
    name: string | null;
    status: string;
    expectedInstallationDate: Date | string | null;
    technicianTeamCode: string | null;
  }> = await database
    .select({
      name: customerLeads.name,
      status: customerLeads.status,
      expectedInstallationDate: customerLeads.expectedInstallationDate,
      technicianTeamCode: customerLeads.technicianTeamCode,
    })
    .from(customerLeads)
    .orderBy(desc(customerLeads.id))
    .limit(RECENT_LEADS_LIMIT);

  if (rows.length === 0) return "ไม่พบข้อมูลงานล่าสุด";

  return rows
    .map((row, index) => {
      const technicianName = row.technicianTeamCode ? teamNames.get(row.technicianTeamCode) : undefined;
      return `งานที่ ${index + 1} · งานของช่าง ${technicianName ?? "ไม่ระบุชื่อ"} · ลูกค้า: ${row.name ?? "ไม่ระบุ"} · สถานะ: ${displayLeadStatus(row.status)} · วันติดตั้ง: ${formatThaiOpsDate(row.expectedInstallationDate) ?? "ไม่ระบุวันที่"}`;
    })
    .join("\n");
}

async function fetchCalendarSummary(database: OpsDatabase, now: Date, teamNames: Map<string, string>): Promise<string> {
  const { start, end } = bangkokMonthRange(now);
  const rows: Array<{ technicianTeamCode: string | null; expectedInstallationDate: Date | string | null }> = await database
    .select({
      technicianTeamCode: customerLeads.technicianTeamCode,
      expectedInstallationDate: customerLeads.expectedInstallationDate,
    })
    .from(customerLeads)
    .orderBy(asc(customerLeads.id));

  const inMonth = rows.filter((row) => {
    const installationDate = formatOpsDate(row.expectedInstallationDate);
    return installationDate !== null && installationDate >= start && installationDate <= end;
  });
  const monthLabel = formatThaiOpsMonth(start);

  if (inMonth.length === 0) return `เดือนนี้ยังไม่มีงานติดตั้งที่กำหนดวันไว้ (${monthLabel})`;

  const counts = new Map<string, number>();
  for (const row of inMonth) {
    const key = row.technicianTeamCode ? teamNames.get(row.technicianTeamCode) ?? "ไม่ระบุชื่อ" : "ไม่ระบุชื่อ";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const lines = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([technicianName, count]) => `งานของช่าง ${technicianName}: ${count} งาน`);

  return [`งานติดตั้งเดือนนี้ (${monthLabel}) แยกตามช่าง:`, ...lines].join("\n");
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
  const teamNames = mode === "dashboard" ? new Map<string, string>() : await fetchTechnicianTeamNames(database);
  const summary = mode === "leads"
    ? await fetchLeadsSummary(database, teamNames)
    : mode === "calendar"
      ? await fetchCalendarSummary(database, now, teamNames)
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
  // The summary is read-only context. If it cannot be built the assistant still answers (and says there is no data) instead of
  // throwing out of the route as a 500.
  let dataSummary: string;
  try {
    dataSummary = await buildOpsContextSummary(mode);
  } catch (error) {
    console.warn("Ops assistant context summary failed", { mode, error: error instanceof Error ? error.message : "unknown" });
    dataSummary = "ไม่พบข้อมูล (ดึงข้อมูลอ้างอิงจากระบบไม่สำเร็จ)";
  }
  return askGemini({
    message: question,
    contextSummary: `${SYSTEM_PROMPT}\n\nข้อมูลอ้างอิง:\n${dataSummary}`,
  });
}
