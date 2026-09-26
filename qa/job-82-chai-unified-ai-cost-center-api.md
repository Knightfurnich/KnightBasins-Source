# ใบงาน 82 (ชัย) — Backend API สรุปต้นทุนและการใช้งาน AI รวมทั้งบริษัท (Unified AI Cost Center)

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend API & Cost Aggregator)

**ที่มาและความต้องการ:**
สืบเนื่องจากที่คุณนพอนุมัติให้จัดทำระบบ "แดชบอร์ดสรุปต้นทุนและการใช้งาน AI รวมทั้งบริษัท" (Unified AI Cost Center) เพื่อรวมการใช้จ่ายของ 3 เสาหลัก:
1. **น้องไนท์ (Knight Sales Bot):** LINE OA / In-app Chat Customer Assistant
2. **AI Blueprint Reader (Vision API):** บริการอ่านและวิเคราะห์ภาพสเก็ตช์หน้างาน (/api/sketch/analyze)
3. **เฮอร์มีส (Hermes Agent & Automation):** งานบริหารระบบ, สรุปสลิป, ตรวจสอบงานประจำวัน (ดึงจาก audit log)

ใบงานนี้ ชัยจะสร้างโมดูลคำนวณและ Endpoint หลังบ้าน เพื่อส่งข้อมูลเชิงสถิติและต้นทุนเงินบาท (THB) ให้หน้าบ้านแสดงผล:

1. **สร้างโมดูล `artifacts/api-server/src/lib/ai-cost-tracker.ts` (ใหม่):**
   - ฟังก์ชันบันทึกการใช้งาน (In-memory / JSONL logger):
     `recordAiUsage(event: { service: "sales_bot" | "sketch_vision" | "hermes_ops"; model: string; promptTokens?: number; completionTokens?: number; totalTokens?: number; durationMs?: number; success: boolean; imageCount?: number; })`
   - ฝังการบันทึกการใช้งานใน:
     * `artifacts/api-server/src/routes/leads.ts` ตรง `/sketch/analyze` (แท็ก `sketch_vision`)
   - ฟังก์ชันสรุปข้อมูลตามช่วงเวลา (วัน/สัปดาห์/เดือน/ทั้งหมด):
     `getUnifiedAiCostSummary(period: "today" | "7d" | "30d" | "all"): UnifiedAiCostResponse`
   - ตารางคำนวณราคาต้นทุน (อัตราแลกเปลี่ยน 1 USD = 35.00 THB):
     * `gemini-3.8-flash` / `gemini-2.5-flash`: Input $0.075 / M tokens (0.002625 บ./1k tokens) · Output $0.30 / M tokens (0.0105 บ./1k tokens) · ภาพละ ~$0.0005 (0.0175 บาท)
     * `deepseek-v4.1-flash`: Input $0.14 / M tokens · Output $0.28 / M tokens
     * `hermes-agent` / default: คำนวณตามโมเดลพื้นฐาน
2. **สร้าง Admin Endpoint ใน `artifacts/api-server/src/routes/admin-router.ts`:**
   - `GET /admin/ai-cost-center` (ต้องผ่านสิทธิ์ `requireAdminPermission("leads")`):
     * รับ query: `?period=today|7d|30d|all`
     * คืนค่า JSON โครงสร้างดังนี้ (ตัวอย่าง ไม่ต้องมี fence ซ้อน):
       period: "30d"
       updatedAt: ISO string
       totalCostThb: 221.20
       totalRequests: 5750
       totalTokens: 6400000
       services: array ของ { id, name, requests, tokens, costThb, status }
         - id "sales_bot" · name "น้องไนท์ (LINE Bot ผู้ช่วยขาย)"
         - id "sketch_vision" · name "AI Blueprint Reader (อ่านแบบร่าง)"
         - id "hermes_ops" · name "เฮอร์มีส (งานบริหารระบบ & งานช่าง)"
       modelBreakdown: array ของ { model, requests, costThb }
3. **เขียน Unit Tests ใน `artifacts/api-server/test/ai-cost-center.test.ts` (ใหม่):**
   - ทดสอบการคำนวณต้นทุนเป็นเงินบาทของแต่ละโมเดล
   - ทดสอบการบันทึก event และการ aggregate ข้อมูลแยกตาม service
   - ทดสอบ Endpoint `GET /admin/ai-cost-center` ได้ HTTP 200 และโครงสร้าง JSON ครบถ้วน

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-ai-cost-center-api แล้วเปิด PR เพื่อรอเดวิดตรวจรับ

GOAL:
  1. สร้าง artifacts/api-server/src/lib/ai-cost-tracker.ts (ใหม่):
     - ฟังก์ชัน recordAiUsage(event)
     - ฟังก์ชัน calculateModelCostThb(model, promptTokens, completionTokens, imageCount)
     - ฟังก์ชัน getUnifiedAiCostSummary(period)
     - อ่านไฟล์ /opt/data/cron/usage_audit.jsonl (ถ้ามี) มารวมในส่วน hermes_ops
  2. ใน artifacts/api-server/src/routes/leads.ts:
     - เรียก recordAiUsage() เมื่อวิเคราะห์ภาพ /sketch/analyze สำเร็จ
  3. ใน artifacts/api-server/src/routes/admin-router.ts:
     - เพิ่ม route GET /admin/ai-cost-center
  4. สร้าง artifacts/api-server/test/ai-cost-center.test.ts (ใหม่):
     - ทดสอบการคำนวณราคาและโครงสร้าง JSON

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/ai-cost-tracker.ts (ใหม่)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/leads.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/ai-cost-center.test.ts (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์ (งานหน้าบ้านแยกให้ Replit ใน Task 83)
  - ห้ามแตะต้อง lib/db/ และตารางฐานข้อมูลเดิม
  - ห้าม log ข้อมูลลับหรือ key ใดๆ
  - ห้าม push ตรงเข้า main ให้ทำงานผ่าน branch: feat/chai-ai-cost-center-api

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-ai-cost-center-api
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) node --experimental-strip-types --test artifacts/api-server/test/ai-cost-center.test.ts -> ผ่านครบ 100%
  4) npm test ใน artifacts/api-server -> รายงานผลเทียบ baseline เดิม (372 tests / 367 pass / 5 fail เดิม)

OUTPUT:
  - branch: feat/chai-ai-cost-center-api (เปิด PR เข้า main)
  - 4 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ใน artifacts/api-server มี fail เพิ่มจาก baseline เดิม (fail > 5)
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก + สัดส่วนคะแนน | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ใช้ path เต็มสำหรับเครื่องเรา | ✅ ผ่าน |
| 8 | มีข้อบังคับเรื่อง branch และ PR | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | กำหนดชื่อ branch และ PR ชัดเจน | ✅ ผ่าน |
| 11 | ทดสอบการคำนวณต้นทุนเงินบาท และ Endpoint สรุปยอด | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์หน้าบ้าน (แยกให้ Replit) และไม่แตะ DB | ✅ ผ่าน |
