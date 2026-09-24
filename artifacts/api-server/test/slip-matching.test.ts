import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findAutoMatchLead, type SlipMatchLead } from "../src/lib/slip-matching.ts";

const leads: SlipMatchLead[] = [
  {
    id: 1,
    leadKey: "lead-line-26-1074",
    quoteNumber: "Sep 26 / US / 296579",
    name: "นายสมชาย ใจดี",
    company: "บริษัท ดีเอส อินทีเรีย จำกัด",
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
];

describe("findAutoMatchLead", () => {
  it("matches referenceValue against a lead's quoteNumber and explains why", () => {
    const matched = findAutoMatchLead({ referenceValue: "296579" }, leads);
    assert.deepEqual(matched, {
      matchedLeadId: 1,
      matchedReason: "เลขใบเสนอราคาตรงกับ Sep 26 / US / 296579",
    });
  });

  it("matches referenceValue against a lead's leadKey (job code style reference)", () => {
    const matched = findAutoMatchLead({ referenceValue: "26/1074" }, leads);
    assert.deepEqual(matched, {
      matchedLeadId: 1,
      matchedReason: "รหัสงานตรงกับ 26/1074",
    });
  });

  it("matches a different lead by its own quoteNumber", () => {
    const matched = findAutoMatchLead({ referenceValue: "Oct 26 / OF / 100234" }, leads);
    assert.equal(matched?.matchedLeadId, 3);
    assert.equal(matched?.matchedReason, "เลขใบเสนอราคาตรงกับ Oct 26 / OF / 100234");
  });

  it("matches senderName against lead.name, ignoring Thai name prefixes", () => {
    const matched = findAutoMatchLead({ senderName: "สมชาย ใจดี" }, leads);
    assert.deepEqual(matched, {
      matchedLeadId: 1,
      matchedReason: "ชื่อผู้โอนตรงกับ นายสมชาย ใจดี",
    });
  });

  it("matches senderName against lead.company, ignoring Thai company prefixes", () => {
    const matched = findAutoMatchLead({ senderName: "ดีเอส อินทีเรีย" }, leads);
    assert.deepEqual(matched, {
      matchedLeadId: 1,
      matchedReason: "ชื่อผู้โอนตรงกับ บริษัท ดีเอส อินทีเรีย จำกัด",
    });
  });

  it("matches a company across differing Thai prefixes on both sides", () => {
    const matched = findAutoMatchLead({ senderName: "ห้างหุ้นส่วนจำกัด หินสังเคราะห์ ไทย" }, leads);
    assert.equal(matched?.matchedLeadId, 3);
  });

  it("prefers a referenceValue/quoteNumber match over a senderName match", () => {
    const matched = findAutoMatchLead({ referenceValue: "100234", senderName: "คุณมานี รักสงบ" }, leads);
    assert.equal(matched?.matchedLeadId, 3);
    assert.equal(matched?.matchedReason, "เลขใบเสนอราคาตรงกับ Oct 26 / OF / 100234");
  });

  it("returns null when nothing matches or inputs are empty", () => {
    assert.equal(findAutoMatchLead({}, leads), null);
    assert.equal(findAutoMatchLead({ referenceValue: "99/9999" }, leads), null);
    assert.equal(findAutoMatchLead({ senderName: "ไม่มีใครชื่อนี้" }, leads), null);
    assert.equal(findAutoMatchLead({ referenceValue: "26" }, leads), null);
    assert.equal(findAutoMatchLead({ referenceValue: "296579" }, []), null);
  });
});
