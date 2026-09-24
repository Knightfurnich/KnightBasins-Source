import assert from "node:assert/strict";
import test from "node:test";
import {
  adminQuoteUrl,
  filterAdminLeads,
  findAutoMatchLead,
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
  const signedToken = "eyJxdW90ZU51bWJlciI6IlNlcCAyNiAvIFVTTiAvIDI5NjU3OSJ9.signature";
  assert.equal(
    adminQuoteUrl(signedToken, "https://example.com"),
    `https://example.com/quote/view?token=${encodeURIComponent(signedToken)}`,
  );
  assert.doesNotMatch(adminQuoteUrl(signedToken, "https://example.com"), /lead-one|somchai/i);
});

const matchLeads = [
  {
    id: 1,
    leadKey: "lead-line-26-1074",
    quoteNumber: "Sep 26 / US / 296579",
    name: "นายสมชาย ใจดี",
    company: "บริษัท ไนท์ เฟอร์นิช จำกัด",
  },
  {
    id: 2,
    leadKey: "lead-two",
    quoteNumber: null,
    name: "คุณมานี รักสงบ",
    company: null,
  },
  {
    id: 3,
    leadKey: "lead-three",
    quoteNumber: "Oct 26 / OF / 100234",
    name: null,
    company: "หจก. หินสังเคราะห์ ไทย",
  },
] as never[];

test("findAutoMatchLead matches referenceValue against quoteNumber", () => {
  const matched = findAutoMatchLead({ referenceValue: "296579" }, matchLeads);
  assert.equal(matched?.id, 1);
});

test("findAutoMatchLead matches referenceValue against leadKey (job code style reference)", () => {
  const matched = findAutoMatchLead({ referenceValue: "26/1074" }, matchLeads);
  assert.equal(matched?.id, 1);
});

test("findAutoMatchLead matches a second lead by its own quoteNumber", () => {
  const matched = findAutoMatchLead({ referenceValue: "Oct 26 / OF / 100234" }, matchLeads);
  assert.equal(matched?.id, 3);
});

test("findAutoMatchLead matches senderName against lead.name, ignoring Thai name prefixes", () => {
  const matched = findAutoMatchLead({ senderName: "นายสมชาย ใจดี" }, matchLeads);
  assert.equal(matched?.id, 1);

  const matchedDifferentPrefix = findAutoMatchLead({ senderName: "สมชาย ใจดี" }, matchLeads);
  assert.equal(matchedDifferentPrefix?.id, 1);
});

test("findAutoMatchLead matches senderName against lead.company, ignoring Thai company prefixes", () => {
  const matched = findAutoMatchLead({ senderName: "บจก. ไนท์ เฟอร์นิช" }, matchLeads);
  assert.equal(matched?.id, 1);

  const matchedOtherCompany = findAutoMatchLead({ senderName: "หินสังเคราะห์ ไทย" }, matchLeads);
  assert.equal(matchedOtherCompany?.id, 3);
});

test("findAutoMatchLead prefers a referenceValue/quoteNumber match over a senderName match", () => {
  const matched = findAutoMatchLead({ referenceValue: "100234", senderName: "คุณมานี รักสงบ" }, matchLeads);
  assert.equal(matched?.id, 3);
});

test("findAutoMatchLead returns undefined when nothing matches or inputs are empty", () => {
  assert.equal(findAutoMatchLead({}, matchLeads), undefined);
  assert.equal(findAutoMatchLead({ referenceValue: "99/9999" }, matchLeads), undefined);
  assert.equal(findAutoMatchLead({ senderName: "ไม่มีใครชื่อนี้" }, matchLeads), undefined);
  assert.equal(findAutoMatchLead({ referenceValue: "26" }, matchLeads), undefined);
});
