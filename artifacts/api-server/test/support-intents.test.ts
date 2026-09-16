import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSupportIntentReply } from "../src/lib/support-intents.ts";

describe("KnightSupport conversational replies", () => {
  it("introduces KnightSupport instead of repeating the search instructions", () => {
    assert.match(getSupportIntentReply("คุณคืออะไร") ?? "", /KnightSupport/);
  });

  it("handles location questions without inventing an address", () => {
    const reply = getSupportIntentReply("ร้านอยู่ไหน");
    assert.match(reply ?? "", /ยังไม่มีข้อมูลที่อยู่/);
  });

  it("keeps casual questions friendly and on topic", () => {
    assert.match(getSupportIntentReply("ไปเที่ยวกันมั้ย") ?? "", /ผู้ช่วยข้อมูลสินค้า/);
  });
});