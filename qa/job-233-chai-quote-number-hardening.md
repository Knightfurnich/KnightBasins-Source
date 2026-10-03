# ใบงาน 233 (API Security & Quote Number Hardening) — ปิดช่องโหว่ client-supplied quoteNumber และปรับปรุงคอมเมนต์สร้างเลขที่ใบเสนอราคา

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead) · **อนุมัติโดย:** บอส (คุณนพ)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI) · ภารกิจความปลอดภัยระดับ API
**Branch:** `feat/chai-quote-number-hardening`
**ที่มา:** ชัยตรวจพบว่าใน `artifacts/api-server/src/routes/leads.ts` (~บรรทัด 559):
`const quoteNumber = parsed.data.quoteNumber ?? existing?.quoteNumber ?? ...`
ยังคงเปิดรับ `quoteNumber` ที่ส่งมาจาก Client โดยตรง ทำให้ผู้โจมตีหรือบอทสามารถกำหนดเลขที่ใบเสนอราคามาเองเพื่อข้ามการตรวจสอบของ `createUniqueQuoteNumber` ได้ นอกจากนี้ในคำอธิบายโค้ดและเทสต์เดิมมีข้อความที่ระบุเกินจริงเรื่องการรั่วไหลของข้อมูล จึงต้องปรับแก้ตรรกะและเอกสารให้ตรงตามความเป็นจริง

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/api-server/src/routes/leads.ts:
     - ปิดช่องโหว่ client-supplied quoteNumber ในเส้นทาง POST /api/leads:
       - ไม่อนุญาตให้คำขอสาธารณะ (Unauthenticated client) กำหนด quoteNumber มาเองเด็ดขาด
       - สำหรับคำขอสร้างหรือแก้ไข lead:
         - หากเป็น lead ที่มีอยู่เดิมในฐานข้อมูล (existing?.quoteNumber มีค่า): ให้คงเลขเดิมไว้
         - หากเป็นคำขอใหม่ หรือยังไม่มี quoteNumber และมี status === "quote_requested": ให้สร้างเลขใหม่ผ่าน createUniqueQuoteNumber(database) เสมอ
         - ละทิ้งค่า parsed.data.quoteNumber ที่ส่งมาจาก client ทิ้งอย่างสิ้นเชิง (ห้ามนำมาใช้เป็น fallback แรก)
     - แก้ไขคอมเมนต์ใน createQuoteNumber:
       - ระบุข้อเท็จจริงว่า หากเลขชนกัน ผลลัพธ์คือลูกค้ารายหลังจะได้รับ 404 (เนื่องจาก quoteAccessSecret ไม่ตรงกัน) ไม่ใช่การรั่วไหลของข้อมูล และการชนเกิดขึ้นได้เมื่อส่งเข้ามาในมิลลิวินาทีเดียวกัน
  2. ใน artifacts/api-server/test/quote-number-allocation.test.ts:
     - ปรับแก้คอมเมนต์หัวไฟล์ให้ตรงตามข้อเท็จจริง
     - เพิ่มเคสทดสอบ: ยิง POST /api/leads โดยแอบส่ง quoteNumber: "HACKED / 999999" มาใน payload -> เซิร์ฟเวอร์ต้องเพิกเฉยและสร้างเลขใหม่ที่ถูกต้องตามระบบ หรือปฏิเสธ
  3. หมายเหตุเรื่อง UNIQUE INDEX:
     - แยกงาน UNIQUE INDEX บน customer_leads.quote_number ออกไปเป็นอีกขั้นตอน เพื่อรอบอสตัดสินใจจัดการข้อมูลเก่าที่ซ้ำกัน 2 คู่บน Production ก่อน (ห้ามเพิ่ม migration index ในใบงานนี้เด็ดขาด)

SCOPE:
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/test/quote-number-allocation.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามสร้างไฟล์ migration เพิ่ม UNIQUE INDEX ในใบงานนี้เด็ดขาด (ป้องกัน deploy ล้ม)
  - ห้ามกระทบลูกค้าทั่วไปที่ขอราคาตามปกติ (ต้องได้เลขที่ใบเสนอราคาถูกต้อง)

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-quote-number-hardening ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) node --test test/quote-number-allocation.test.ts ใน api-server → ผ่านทุกข้อ (ระบุจำนวนข้อจริง)
  4) npm test ใน artifacts/api-server (full suite baseline: 956 ผ่าน / 0 ตก / 0 ข้าม)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/api-server/src/routes/leads.ts
  - artifacts/api-server/test/quote-number-allocation.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และชุดทดสอบผ่านครบถ้วน
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ปิดช่อง client-supplied quoteNumber |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 2 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามเพิ่ม migration index, index.css 0 diff |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline 956 ข้อจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (Claude CLI) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | แยกงาน 2 ขั้นตามที่ชัยเสนอ |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ตรวจสอบข้อมูลครบถ้วน |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 233 เรียบร้อย |
