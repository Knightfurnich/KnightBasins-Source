import assert from "node:assert/strict";
import test from "node:test";
import {
  adminQuoteUrl,
  exportLeadsToCsv,
  filterAdminLeads,
  leadMatchesDateRange,
  leadMatchesSearch,
} from "../src/admin/leads-utils.ts";
import { formatThaiDateTime } from "../src/data/date-time.ts";

const leads = [
  {
    id: 1,
    leadKey: "lead-one",
    status: "quote_requested",
    source: "catalog",
    productSkus: ["KF002"],
    quoteNumber: "Sep 26 / US / 296579",
    name: "คุณสมชาย",
    company: "Knight Studio",
    phone: "0812345678",
    email: "somchai@example.com",
    project: "บ้านสุขุมวิท",
    createdAt: "2026-09-14T08:00:00.000Z",
    updatedAt: "2026-09-14T09:00:00.000Z",
  },
  {
    id: 2,
    leadKey: "lead-two",
    status: "new_lead",
    source: "hand_sketch",
    productSkus: ["KF010"],
    quoteNumber: null,
    name: "คุณมานี",
    company: null,
    phone: "0898765432",
    email: null,
    project: "คอนโดรัชดา",
    createdAt: "2026-09-13T08:00:00.000Z",
    updatedAt: "2026-09-13T09:00:00.000Z",
  },
] as never[];

test("admin lead search covers quote, customer, project, phone, and SKU", () => {
  assert.equal(leadMatchesSearch(leads[0], "296579"), true);
  assert.equal(leadMatchesSearch(leads[0], "บ้านสุขุมวิท"), true);
  assert.equal(leadMatchesSearch(leads[0], "0812345678"), true);
  assert.equal(leadMatchesSearch(leads[0], "KF002"), true);
  assert.equal(leadMatchesSearch(leads[0], "ไม่พบ"), false);
});

test("admin lead date filters include both calendar boundaries", () => {
  assert.equal(leadMatchesDateRange(leads[0], { fromDate: "2026-09-14", toDate: "2026-09-14" }), true);
  assert.equal(leadMatchesDateRange(leads[1], { fromDate: "2026-09-14" }), false);
  assert.equal(leadMatchesDateRange(leads[0], { toDate: "2026-09-13" }), false);
});

test("admin lead date filters use Bangkok midnight boundaries", () => {
  const atBangkokMidnight = { ...leads[0], createdAt: "2026-09-14T17:00:00.000Z" };
  const justBeforeBangkokMidnight = { ...leads[0], createdAt: "2026-09-14T16:59:59.999Z" };
  assert.equal(leadMatchesDateRange(atBangkokMidnight, { fromDate: "2026-09-15", toDate: "2026-09-15" }), true);
  assert.equal(leadMatchesDateRange(justBeforeBangkokMidnight, { fromDate: "2026-09-15", toDate: "2026-09-15" }), false);
});

test("admin lead filtering keeps status and local filters independent", () => {
  assert.deepEqual(filterAdminLeads(leads, "quote_requested", "บ้าน", {}), [leads[0]]);
  assert.deepEqual(filterAdminLeads(leads, "all", "", { fromDate: "2026-09-13", toDate: "2026-09-13" }), [leads[1]]);
});

test("admin quote links encode the quote number without exposing lead data", () => {
  const signedToken = "eyJxdW90ZU51bWJlciI6IlNlcCAyNiAvIFVTTiAvIDI5NjU3OSJ9.signature";
  assert.equal(
    adminQuoteUrl(signedToken, "https://example.com"),
    `https://example.com/quote/view?token=${encodeURIComponent(signedToken)}`,
  );
  assert.doesNotMatch(adminQuoteUrl(signedToken, "https://example.com"), /lead-one|somchai/i);
});

test("exportLeadsToCsv starts with a UTF-8 BOM followed by the Thai column headers", () => {
  const csv = exportLeadsToCsv([]);
  assert.equal(csv.startsWith("﻿"), true);
  const [header] = csv.slice(1).split("\r\n");
  assert.equal(
    header,
    [
      "วันที่สร้าง", "เลขที่ใบเสนอราคา", "รหัสงาน", "ชื่อลูกค้า", "บริษัท", "เบอร์โทร", "อีเมล",
      "ชื่อโครงการ", "ที่อยู่/สถานที่ติดตั้ง", "สถานะ", "ช่องทาง", "รหัสสินค้า", "หมายเหตุ",
      "ลิงก์ Google Maps หน้างาน", "ละติจูด (Latitude)", "ลองจิจูด (Longitude)",
      "มีสลิปการเงินผูกอยู่", "จำนวนสลิป (ใบ)",
    ].join(","),
  );
});

test("exportLeadsToCsv escapes commas, quotes, and newlines per RFC 4180", () => {
  const weirdLead = {
    ...leads[0],
    company: 'Knight, "Premium" Studio',
    notes: "โทรกลับพรุ่งนี้\nอย่าลืมส่งตัวอย่าง",
  };
  const csv = exportLeadsToCsv([weirdLead as never]);
  assert.match(csv, /"Knight, ""Premium"" Studio"/);
  assert.match(csv, /"โทรกลับพรุ่งนี้\nอย่าลืมส่งตัวอย่าง"/);
});

test("exportLeadsToCsv maps every lead column, translating status and joining SKUs", () => {
  const lead = {
    id: 3,
    leadKey: "lead-three",
    status: "ready_for_production",
    source: "catalog",
    productSkus: ["KF002", "KF010"],
    quoteNumber: "Sep 26 / US / 300000",
    name: "คุณวิชัย",
    company: "Knight Studio",
    phone: "0899999999",
    email: "wichai@example.com",
    project: "คอนโดอโศก",
    site: "ซอยสุขุมวิท 21",
    notes: "ลูกค้าพิเศษ",
    createdAt: "2026-09-14T08:00:00.000Z",
    updatedAt: "2026-09-14T09:00:00.000Z",
  } as never;
  const csv = exportLeadsToCsv([lead]);
  const [, dataRow] = csv.slice(1).split("\r\n");
  assert.equal(
    dataRow,
    [
      formatThaiDateTime(new Date("2026-09-14T08:00:00.000Z")),
      "Sep 26 / US / 300000",
      "lead-three",
      "คุณวิชัย",
      "Knight Studio",
      "0899999999",
      "wichai@example.com",
      "คอนโดอโศก",
      "ซอยสุขุมวิท 21",
      "พร้อมผลิต",
      "catalog",
      "KF002; KF010",
      "ลูกค้าพิเศษ",
      "",
      "",
      "",
      "ไม่มี",
      "0",
    ].join(","),
  );
});
