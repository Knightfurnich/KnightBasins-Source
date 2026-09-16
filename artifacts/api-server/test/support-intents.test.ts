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

  it("explains why a formal quote may not be generated", () => {
    const reply = getSupportIntentReply("กดออกใบเสนอราคาไม่ได้ ต้องทำอย่างไร");
    assert.match(reply ?? "", /ชื่อผู้ติดต่อ โทรศัพท์ อีเมล และชื่อโครงการ/);
    assert.match(reply ?? "", /พาไปยังช่องแรก/);
  });

  it("explains the main Knight Basins customer flow", () => {
    const reply = getSupportIntentReply("วิธีใช้งานเว็บไซต์ทำอย่างไร");
    assert.match(reply ?? "", /เลือกอ่างหรือหิน/);
    assert.match(reply ?? "", /ออกใบเสนอราคาทางการ/);
  });
});