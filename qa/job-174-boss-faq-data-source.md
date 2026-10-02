# ใบงาน 174 (บอส / Claude Code) — รวมศูนย์ข้อมูล FAQ 10 ข้อ (faq-data.ts) และสร้างตัวแปลง JSON-LD Schema อัตโนมัติ

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ บอส / ชัย (Claude Code CLI / Backend & Data Model) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
เพื่อแก้ปัญหา FAQ ไม่ตรงกัน (Content Drift) ระหว่าง Schema และหน้าเว็บ และสร้าง Single Source of Truth
งานนี้ครอบคลุมการสร้างไฟล์ข้อมูลกลาง `faq-data.ts` บรรจุคำถาม-คำตอบทั้ง 10 ข้อที่สมบูรณ์ และเพิ่มฟังก์ชันสร้าง FAQPage JSON-LD ใน `structured-data.ts` พร้อมเทสต์ป้องกันความสมบูรณ์ของข้อมูล

**รายละเอียดสิ่งที่ต้องทำ:**
1. สร้างไฟล์ใหม่ `artifacts/knight-basins/src/data/faq-data.ts`:
   - กำหนด Interface: `export interface FAQItem { question: string; answer: string; }`
   - สร้างและ export `KNIGHT_FAQ_ITEMS: FAQItem[]` บรรจุคำถาม-คำตอบภาษาไทยครบทั้ง 10 ข้อ (ข้อ 1-6 ดั้งเดิม + ข้อ 7-10 long-tail ที่เพิ่งเพิ่มใน PR #122)
2. ใน `artifacts/knight-basins/src/data/structured-data.ts`:
   - เพิ่มฟังก์ชัน `export function buildFaqPageJsonLd(items: FAQItem[] = KNIGHT_FAQ_ITEMS)` สำหรับแปลงรายการ FAQ เป็น Schema.org `@type: "FAQPage"`
3. ปรับปรุง `artifacts/knight-basins/test/jsonld-schema-integrity.test.ts`:
   - เพิ่มการทดสอบว่า `KNIGHT_FAQ_ITEMS` มีครบ 10 ข้อ และฟังก์ชัน `buildFaqPageJsonLd()` สร้าง Schema ถูกต้องตรงตามมาตรฐาน

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด

GOAL:
  1. สร้าง artifacts/knight-basins/src/data/faq-data.ts เป็น Single Source of Truth บรรจุ FAQ 10 ข้อ
  2. เพิ่ม buildFaqPageJsonLd() ใน artifacts/knight-basins/src/data/structured-data.ts
  3. ปรับปรุง artifacts/knight-basins/test/jsonld-schema-integrity.test.ts

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/faq-data.ts · (ใหม่)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/structured-data.ts
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/jsonld-schema-integrity.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามแก้ไข QuickFAQ.tsx (ปล่อยให้ Replit ทำใน Job 175)
  - เขียนเทสต์แบบ Static Source Inspection และ Data Unit Test เท่านั้น
  - ทำงานผ่าน worktree หรือ branch: feat/chai-faq-data-source แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง branch ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) npm test ใน artifacts/knight-basins
     baseline อ้างอิง: tests 664 / pass 624 / fail 0 / cancelled 0 / skipped 40
  4) เทสต์ใน test/jsonld-schema-integrity.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/chai-faq-data-source (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
  - ถ้าต้องแตะต้อง QuickFAQ.tsx หรือ UI components
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ใช้ path สมบูรณ์สำหรับ Claude Code CLI | ✅ ผ่าน |
| 8 | มีข้อกำหนด branch และ PR ชัดเจน | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง | ✅ ผ่าน |
| 11 | อนุรักษ์ Print Layout และแยกขอบเขตชัดเจน | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
