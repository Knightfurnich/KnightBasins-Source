# ใบงาน 264-R (ภาคผนวก) — รวมป้ายสถานะใบส่งออก (CSV) เข้าด้วยกัน + ใช้แผนที่ป้ายชุดเดียว

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** รีพิต · **อ้างอิง:** ใบ 264 (ป้ายสถานะ + คำลงท้าย) · PR #342 · PR #343

## บริบท
รีพิตทำต่อจากข้อเสนอ “ป้าย `quote_sent` ในไฟล์ส่งออก” เป็น PR #343 (`admin-router.ts` + เทสต์) — ถูกต้องตามหลัก แต่
1. ยังไม่มีใบงาน/KANBAN กำกับ (กฎบอส: ทุกงานใหม่ต้องออกใน KANBAN ก่อน)
2. แตะ `admin-router.ts` ซึ่งใบ 263 ประกาศหวง (อนุญาตเป็นรายครั้งเท่านั้น)
3. ทำให้ **แผนที่ป้ายสถานะมี 2 ชุด** (`ops-assistant.ts` กับ export ใน `admin-router.ts`) → เสี่ยงไม่ตรงกันในอนาคต

## คำสั่ง (รวมเป็นงานเดียว ไม่เปิด PR ซ้ำ)
1. **ปิด PR #343** แล้วดึงการเปลี่ยนแปลงเข้าสาขาของ #342 (branch `fix/replit-ops-assistant-status-labels-and-endings`) → **หนึ่งใบ = หนึ่ง PR**
2. **ใช้แผนที่ป้ายชุดเดียว**: export CSV ต้องอ่านจากแหล่งเดียวกับผู้ช่วย AI (สร้างโมดูลกลาง np. `src/lib/lead-status-labels.ts` แล้วให้ทั้ง `ops-assistant.ts` และ `admin-router.ts` import) — ห้ามคัดลอกแผนที่ซ้ำ
3. เพิ่ม `in_production` (ตามข้อ 1 ของใบ 264) + คืนป้าย `contacted` · `qualified` · `lost`
4. **ล็อกเทสต์จากรายการจริงใน DB** (65 งาน ณ 4 ต.ค. 69): `team_reported_paid 36 · in_production 18 · ready_for_production 5 · closed 3 · quote_sent 2 · confirmed 1` → ทุกค่าต้องได้ป้ายไทย ไม่ใช่ “ไม่ทราบขั้นตอนงาน” และ CSV export ต้องไม่แสดงรหัสดิบ
5. คงการล้างคำลงท้าย `ครับ` ซ้ำ (ทำแล้วใน #342) + `dataAsOf` เดิม (ใบ 263) ห้ามพัง

## ขอบเขตไฟล์
`artifacts/api-server/src/lib/ops-assistant.ts` · `artifacts/api-server/src/lib/lead-status-labels.ts` (ใหม่) · `artifacts/api-server/src/routes/admin-router.ts` (เฉพาะบรรทัดป้ายของ export) · เทสต์ที่เกี่ยว (`ops-assistant.test.ts` · `admin-backup-api.test.ts`)

## SCOPE (ไฟล์ที่แตะได้)
- `artifacts/api-server/src/lib/ops-assistant.ts` (มีอยู่)
- `artifacts/api-server/src/routes/admin-router.ts` (มีอยู่)
- `artifacts/api-server/test/ops-assistant.test.ts` (มีอยู่)
- `artifacts/api-server/test/admin-backup-api.test.ts` (มีอยู่)
- `artifacts/api-server/src/lib/lead-status-labels.ts` (ไฟล์ใหม่ที่อนุญาตให้สร้าง)

## FORBIDDEN (ห้ามแตะ)
- ห้ามแตะ `artifacts/knight-basins/src/index.css` (0 diff) และโฟลเดอร์ UI ของใบ 265 (`AiCostCenterPage.tsx` · `token-format.ts`)
- ห้ามเปลี่ยนพฤติกรรมอื่นของ `admin-router.ts` นอกบรรทัดป้ายของ export และ `dataAsOf` (ใบ 263) · `ok`/`reply`/`message`/`mode` ต้องคงเดิม
- ห้าม push ตรงเข้า `main` หรือ deploy เอง · ต้องผ่าน PR ให้เดวิดตรวจและ merge
- ห้ามคัดลอกแผนที่ป้ายซ้ำเป็นชุดที่สอง (ต้อง import จากแหล่งเดียว)

## หลักฐานที่ต้องแนบ
tsc 0 errors · ชุดที่เกี่ยวผ่านทั้งหมด · ย้อนโค้ดแล้วเทสต์ป้ายตก · `git diff` ของ `index.css` = 0 · ไม่มีรหัสสถานะดิบหลุดใน CSV

## ข้อความส่งต่อให้บอส copy

```
[เดวิด → รีพิต] ใบ 264 (ภาคผนวก) — qa/job-264-addendum-export-status-labels-shared-map.md
1) ปิด PR #343 แล้วดึงการเปลี่ยนแปลงเข้าสาขาของ #342 (หนึ่งใบ = หนึ่ง PR)
2) สร้างโมดูลกลาง src/lib/lead-status-labels.ts ให้ทั้ง ops-assistant.ts และ admin-router.ts ใช้แผนที่ป้ายชุดเดียวกัน (ห้ามคัดลอกซ้ำ)
3) เพิ่ม in_production + คืน contacted/qualified/lost
4) ล็อกเทสต์จาก DB จริง: team_reported_paid 36 · in_production 18 · ready_for_production 5 · closed 3 · quote_sent 2 · confirmed 1 — ทุกค่าต้องได้ป้ายไทย · CSV export ห้ามแสดงรหัสดิบ
5) ห้ามให้ครับซ้ำ (คงของเดิม) · dataAsOf คงเดิม · index.css 0 diff · ไม่แตะ UI ของใบ 265
หลักฐาน: tsc 0 · เทสต์ที่เกี่ยวผ่าน · ย้อนโค้ดแล้วตก · diff index.css = 0
```
