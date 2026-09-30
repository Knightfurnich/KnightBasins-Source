import assert from "node:assert/strict";
import test from "node:test";
import { exportLeadsToCsv } from "../src/admin/leads-utils.ts";

const enrichedColumns = [
  "ลิงก์ Google Maps หน้างาน",
  "ละติจูด (Latitude)",
  "ลองจิจูด (Longitude)",
  "มีสลิปการเงินผูกอยู่",
  "จำนวนสลิป (ใบ)",
];

function parseCsvRecords(csv: string): string[][] {
  const source = csv.startsWith("\uFEFF") ? csv.slice(1) : csv;
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inQuotes) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      inQuotes = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\r" && source[index + 1] === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
      index += 1;
    } else {
      field += character;
    }
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

const baseLead = {
  id: 151,
  leadKey: "lead-151",
  status: "new_lead",
  source: "catalog",
  productSkus: ["KF002"],
  quoteNumber: null,
  name: "คุณทดสอบ",
  company: null,
  phone: "0812345678",
  email: null,
  project: "บ้านทดสอบ",
  site: "สุขุมวิท",
  notes: null,
  createdAt: "2026-09-30T03:00:00.000Z",
  updatedAt: "2026-09-30T03:00:00.000Z",
};

test("CSV keeps the UTF-8 BOM and appends all five enriched lead headers", () => {
  const csv = exportLeadsToCsv([]);
  const [headers] = parseCsvRecords(csv);

  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.deepEqual(headers.slice(-enrichedColumns.length), enrichedColumns);
  assert.deepEqual(headers.slice(0, 13), [
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
  ]);
});

test("CSV exports Maps coordinates and the matched financial-slip status", () => {
  const mapsUrl = "https://maps.google.com/?q=13.7563,100.5018";
  const csv = exportLeadsToCsv([{
    ...baseLead,
    siteMapsUrl: mapsUrl,
    siteLat: 13.7563,
    siteLng: 100.5018,
    hasMatchedSlip: true,
    paymentSlipCount: 2,
  } as never]);
  const [headers, row] = parseCsvRecords(csv);
  const value = (column: string) => row[headers.indexOf(column)];

  assert.equal(value("ลิงก์ Google Maps หน้างาน"), mapsUrl);
  assert.equal(value("ละติจูด (Latitude)"), "13.7563");
  assert.equal(value("ลองจิจูด (Longitude)"), "100.5018");
  assert.equal(value("มีสลิปการเงินผูกอยู่"), "มี");
  assert.equal(value("จำนวนสลิป (ใบ)"), "2");
  assert.match(csv, /"https:\/\/maps\.google\.com\/\?q=13\.7563,100\.5018"/);
  assert.match(csv, /\r\n/);
});

test("CSV defaults missing locations and slip count safely", () => {
  const csv = exportLeadsToCsv([{
    ...baseLead,
    siteMapsUrl: null,
    siteLat: null,
    siteLng: undefined,
    hasMatchedSlip: false,
    paymentSlipCount: null,
  } as never]);
  const [headers, row] = parseCsvRecords(csv);
  const value = (column: string) => row[headers.indexOf(column)];

  assert.equal(value("ลิงก์ Google Maps หน้างาน"), "");
  assert.equal(value("ละติจูด (Latitude)"), "");
  assert.equal(value("ลองจิจูด (Longitude)"), "");
  assert.equal(value("มีสลิปการเงินผูกอยู่"), "ไม่มี");
  assert.equal(value("จำนวนสลิป (ใบ)"), "0");
});