import type { CustomerLead } from "@workspace/api-client-react";
import { formatThaiDateTime } from "../data/date-time.ts";

export type LeadDateFilters = {
  fromDate?: string;
  toDate?: string;
};

export const leadStatusLabels: Record<string, string> = {
  new_lead: "New Lead",
  selecting: "เลือกสินค้า",
  quote_requested: "ขอใบเสนอราคา",
  quote_sent: "ส่งใบเสนอราคาแล้ว",
  waiting_deposit: "รอมัดจำ",
  team_reported_paid: "ชำระแล้ว (LINE)",
  deposit_paid: "มัดจำแล้ว",
  ready_for_production: "พร้อมผลิต",
  closed: "ปิดการขาย",
};

function normalized(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

export function leadSearchText(lead: CustomerLead) {
  return [
    lead.quoteNumber,
    lead.leadKey,
    lead.name,
    lead.company,
    lead.phone,
    lead.email,
    lead.project,
    lead.source,
    ...lead.productSkus,
  ].map(normalized).join(" ");
}

export function leadMatchesSearch(lead: CustomerLead, query: string) {
  const value = normalized(query);
  return !value || leadSearchText(lead).includes(value);
}

function dayStart(value: string) {
  return new Date(`${value}T00:00:00+07:00`);
}

function dayEnd(value: string) {
  return new Date(`${value}T23:59:59.999+07:00`);
}

export function leadMatchesDateRange(lead: CustomerLead, filters: LeadDateFilters) {
  if (!filters.fromDate && !filters.toDate) return true;
  const createdAt = new Date(lead.createdAt);
  if (Number.isNaN(createdAt.getTime())) return false;
  if (filters.fromDate) {
    const from = dayStart(filters.fromDate);
    if (Number.isNaN(from.getTime()) || createdAt < from) return false;
  }
  if (filters.toDate) {
    const to = dayEnd(filters.toDate);
    if (Number.isNaN(to.getTime()) || createdAt > to) return false;
  }
  return true;
}

export function filterAdminLeads(
  leads: CustomerLead[],
  status: CustomerLead["status"] | "all" | (string & {}),
  query: string,
  filters: LeadDateFilters,
) {
  return leads.filter((lead) =>
    (status === "all" || lead.status === status) &&
    leadMatchesSearch(lead, query) &&
    leadMatchesDateRange(lead, filters),
  );
}

export function adminQuoteUrl(publicQuoteToken: string, origin = window.location.origin) {
  const url = new URL("/quote/view", origin);
  url.searchParams.set("token", publicQuoteToken);
  return url.toString();
}

const LEAD_CSV_COLUMNS = [
  "วันที่สร้าง",
  "เลขที่ใบเสนอราคา",
  "รหัสงาน",
  "ชื่อลูกค้า",
  "บริษัท",
  "เบอร์โทร",
  "อีเมล",
  "ชื่อโครงการ",
  "ที่อยู่/สถานที่ติดตั้ง",
  "สถานะ",
  "ช่องทาง",
  "รหัสสินค้า",
  "หมายเหตุ",
];

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function leadCreatedAtForCsv(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : formatThaiDateTime(date);
}

function leadToCsvRow(lead: CustomerLead): string[] {
  return [
    leadCreatedAtForCsv(lead.createdAt),
    lead.quoteNumber ?? "",
    lead.leadKey,
    lead.name ?? "",
    lead.company ?? "",
    lead.phone ?? "",
    lead.email ?? "",
    lead.project ?? "",
    lead.site ?? "",
    leadStatusLabels[lead.status] ?? lead.status,
    lead.source,
    lead.productSkus.join("; "),
    lead.notes ?? "",
  ];
}

/** RFC 4180 CSV with a leading UTF-8 BOM so Excel opens Thai text correctly. */
export function exportLeadsToCsv(leads: CustomerLead[]): string {
  const rows = [LEAD_CSV_COLUMNS, ...leads.map(leadToCsvRow)];
  const csvBody = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  return `﻿${csvBody}`;
}

export function downloadLeadsCsv(leads: CustomerLead[], filename = `knight-basins-leads-${Date.now()}.csv`): void {
  const csv = exportLeadsToCsv(leads);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}