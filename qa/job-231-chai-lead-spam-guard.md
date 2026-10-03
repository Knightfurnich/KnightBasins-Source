# ใบงาน 231 (Lead Spam Guard & Studio Data Enforcement) — สกัดกั้น Lead ขยะ บังคับ studioData สำหรับคำขอใบเสนอราคา

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead) · **อนุมัติโดย:** บอส (คุณนพ)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI) · ภารกิจความปลอดภัยข้อมูลและการออกใบเสนอราคา
**Branch:** `feat/chai-lead-spam-guard`
**ที่มา:** จากการทดสอบยิงจริงบน Production พบว่าเส้นทาง `POST /api/leads` หากผู้ส่งคำขอเลือก `status: "quote_requested"` แต่ไม่แนบ `studioData` ระบบยังคงสร้าง Lead สำเร็จและออกเลขที่ใบเสนอราคา (quoteNumber) ให้ทันที ซึ่งเปิดช่องให้บอทหรือผู้ไม่หวังดียิงสร้าง Lead ขยะจนรายการลูกค้าบวมได้ จึงต้องเพิ่ม Guard บังคับว่าคำขอใบเสนอราคาต้องมีข้อมูลผังหรือรายการสินค้าที่ถูกต้องเท่านั้น

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/api-server/src/routes/leads.ts:
     - ในเส้นทาง POST /api/leads:
       - ตรวจสอบเงื่อนไข: หากคำขอมี status === "quote_requested" หรือ orderMode อยู่ในกลุ่ม ["studio", "quick-purchase"]:
         - ต้องมี studioData ที่มีโครงสร้างถูกต้อง (ไม่ใช่ null/undefined/object เปล่า)
         - หากไม่มี studioData หรือ studioData ว่างเปล่า:
           - ให้ปฏิเสธ HTTP 400 Bad Request:
             {"error": "STUDIO_DATA_REQUIRED", "message": "คำขอใบเสนอราคาต้องแนบข้อมูลผังเคาน์เตอร์หรือรายการสินค้าที่เลือก"}
           - ห้ามสร้างแถวในฐานข้อมูล customerLeads และห้ามออก quoteNumber เด็ดขาด
  2. ชุดทดสอบ:
     - artifacts/api-server/test/lead-spam-guard.test.ts:
       - ทดสอบยิงคำขอ quote_requested โดยไม่มี studioData -> ถูกปฏิเสธ HTTP 400 STUDIO_DATA_REQUIRED ทันที
       - ทดสอบยิงคำขอ quote_requested พร้อม studioData ที่ถูกต้อง -> สร้าง Lead และออกใบเสนอราคาได้ตามปกติ
       - ทดสอบกรณีส่งแบบร่างภาพสเก็ตช์ (orderMode: "sketch") ที่ไม่มี studioData แต่มี sketchUrl -> ยังคงสร้างคำขอได้ตามปกติ (ไม่กระทบการส่งภาพร่าง)

SCOPE:
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/test/lead-spam-guard.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามกระทบโหมดภาพสเก็ตช์ (orderMode: "sketch") ที่ลูกค้าส่งภาพแบบร่างมือโดยยังไม่มี studioData
  - ห้ามกระทบลูกค้าทั่วไปที่ส่งผัง studio หรือ quick-purchase ตามปกติ

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-lead-spam-guard ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) node --test test/lead-spam-guard.test.ts ใน api-server → ผ่านทุกข้อ (ระบุจำนวนข้อจริง)
  4) npm test ใน artifacts/api-server (full suite baseline: 932 ผ่าน / 3 ตก Windows path / 0 ข้าม)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/test/lead-spam-guard.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และชุดทดสอบ lead-spam-guard ผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | สกัดกั้น Lead ขยะ บังคับ studioData |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 2 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | คงโหมด sketch ไว้, index.css 0 diff |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline 932 ข้อจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (Claude CLI) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ป้องกันสแปมสร้าง Lead ขยะ |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ตรวจสอบข้อมูลครบถ้วน |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 231 เรียบร้อย |
