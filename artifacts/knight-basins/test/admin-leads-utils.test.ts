import assert from "node:assert/strict";
import test from "node:test";
import {
  adminQuoteUrl,
  filterAdminLeads,
  leadMatchesDateRange,
  leadMatchesSearch,
} from "../src/admin/leads-utils.ts";

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
  assert.equal(
    adminQuoteUrl("Sep 26 / US / 296579", "https://example.com"),
    "https://example.com/quote/view?quote=Sep+26+%2F+US+%2F+296579",
  );
  assert.doesNotMatch(adminQuoteUrl("Sep 26 / US / 296579", "https://example.com"), /lead-one|somchai/i);
});