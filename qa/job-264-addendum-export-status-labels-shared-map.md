# ใบงาน 264-R (ภาคผนวก) — รวมป้ายสถานะใบส่งออก CSV + ใช้แผนที่ป้ายชุดเดียว

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **รีพิต** · **ผู้ตรวจรับ:** เดวิด
**Branch:** ใช้สาขาเดิม `fix/replit-ops-assistant-status-labels-and-endings` (ของ PR #342) — **ไม่เปิด PR ใหม่**
**ที่มา:** รีพิตทำต่อจากข้อเสนอ “ป้าย `quote_sent` ในไฟล์ส่งออก” เป็น PR #343 โดยยังไม่มีใบงานกำกับ จึงรวมเข้าใบนี้เพื่อไม่ให้มีสอง PR ซ้อนกัน

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. **ปิด PR #343** แล้วดึงการเปลี่ยนแปลง (ป้าย `quote_sent` + เทสต์) เข้าสาขาของ #342 → **หนึ่งใบ = หนึ่ง PR**
  2. **ใช้แผนที่ป้ายสถานะชุดเดียว (single source of truth)** — สร้างโมดูลกลาง `artifacts/api-server/src/lib/lead-status-labels.ts`
     แล้วให้ทั้ง `ops-assistant.ts` และตัว export CSV ใน `admin-router.ts` import จากที่เดียวกัน (ห้ามคัดลอกแผนที่ซ้ำ)
  3. **เพิ่มป้ายที่ยังขาด + คืนป้ายเดิม**
     - `in_production` (18 งานใน DB จริง ยังไม่มีป้าย → คำตอบขึ้น “ไม่ทราบขั้นตอนงาน”)
     - คืน `contacted` · `qualified` · `lost` ตามข้อความไทยเดิม (กันข้อมูลเก่า)
  4. **ล็อกเทสต์จากรายการจริงใน DB (4 ต.ค. 69 · 65 งาน):**
     `team_reported_paid 36 · in_production 18 · ready_for_production 5 · closed 3 · quote_sent 2 · confirmed 1`
     → ทุกค่าต้องได้ป้ายไทย **ไม่ใช่ “ไม่ทราบขั้นตอนงาน”** และ CSV export ต้องไม่แสดงรหัสดิบ
  5. **คงของเดิม ห้ามพัง:** การล้าง “ครับ” ซ้ำ (`collapseRepeatedKhrap`) · `dataAsOf` (ใบ 263) · โทนภาษา/ห้ามรหัสภายใน
  6. **ไม่แตะ UI ของใบ 265** (`AiCostCenterPage.tsx` · `token-format.ts`) และ `src/index.css` ต้อง 0 diff

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/ops-assistant.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/lead-status-labels.ts   (ไฟล์ใหม่ที่อนุญาตให้สร้าง)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts      (เฉพาะบรรทัดป้ายของ export)
  - /opt/data/cache/kbsrc/artifacts/api-server/test/ops-assistant.test.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/admin-backup-api.test.ts

FORBIDDEN:
  - ห้ามแตะ `artifacts/knight-basins/**` ทุกไฟล์ (รวม `src/index.css` · `AiCostCenterPage.tsx` · `token-format.ts` ของใบ 265)
  - **`routes/admin-router.ts` — อนุญาตเป็นกรณีเฉพาะ (เดวิดอนุมัติ 4 ต.ค. 69):** แก้ได้เฉพาะ (ก) บรรทัดป้ายสถานะของ export CSV และ (ข) ฟิลด์ `dataAsOf` ที่อนุญาตไปแล้วในใบ 263
    · คง `ok` · `reply` · `message` · `mode` และพฤติกรรมอื่นของไฟล์ให้เหมือนเดิม · ห้ามเปลี่ยนรูปแบบ CSV คอลัมน์/ลำดับคอลัมน์
  - ห้ามคัดลอกแผนที่ป้ายเป็นชุดที่สอง (ต้อง import จากโมดูลกลางเท่านั้น)
  - ห้ามเพิ่มไลบรารีใหม่ · ห้ามเปลี่ยน env/รุ่นโมเดล · ห้าม push ตรงเข้า `main` · ห้าม deploy เอง

EVIDENCE:
  1) `npx tsc -p artifacts/api-server/tsconfig.json --noEmit` → 0 errors
  2) รันเทสต์ที่เกี่ยวโดยตรงในโฟลเดอร์ `artifacts/api-server`:
     `node --experimental-strip-types --test test/ops-assistant.test.ts test/admin-backup-api.test.ts` → ระบุ tests/pass/fail
     · ฐาน main ปัจจุบัน (เดวิดวัดเอง 4 ต.ค. 69): ชุดเต็ม `npm test` = **1164/1164/0** · `ops-assistant.test.ts` = **31/31**
  3) เทสต์ใหม่: (ก) ทุกค่าสถานะจาก DB จริงได้ป้ายไทย (ไม่มี “ไม่ทราบขั้นตอนงาน”) (ข) export CSV ของ `quote_sent` แสดงป้ายไทย ไม่ใช่รหัสดิบ (ค) แผนที่ป้ายถูกใช้ร่วมจริง (ไม่มีสำเนาที่สอง) (ง) การล้าง “ครับ” ซ้ำและ `dataAsOf` ยังทำงาน
  4) **พิสูจน์ว่าจับได้:** ย้อนไฟล์เป็นของ main แล้วเทสต์ใหม่ต้องตก (แนบข้อความ)
  5) `git diff origin/main...HEAD --name-only` → มีเฉพาะไฟล์ใน SCOPE · `git diff origin/main...HEAD -- artifacts/knight-basins/src/index.css | wc -l` → 0
  6) เดวิดจะยิงจริง 3 คำถามบน production หลัง deploy + เปิดหน้า export CSV ตรวจว่าไม่มีรหัสสถานะดิบ

OUTPUT:
  - #343 ปิด · สาขา #342 มีป้ายครบ + แผนที่ป้ายชุดเดียว + เทสต์ล็อกจาก DB จริง
  - PR เดียวพร้อมผลรันจริง (แจ้งเดวิดเมื่อพร้อม)

STOP:
  - เมื่อ tsc 0 · เทสต์ผ่านตามฐาน · พิสูจน์จับบั๊กได้ · ปิด #343 แล้ว · แจ้งเดวิดว่า “พร้อมตรวจ/ยิง”
  - หรือเมื่อทำงานครบ 12 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | รวม #343 · แผนที่ป้ายชุดเดียว · ป้ายครบ · ล็อกเทสต์จาก DB |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 5 ไฟล์ (มีไฟล์ใหม่โมดูลกลาง) |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ UI/index.css · จำกัดขอบเขต admin-router.ts |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | tsc · เทสต์ · พิสูจน์จับได้ · diff · ยิงจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | #343 ปิด · PR เดียว |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 12 turns |
| 7 | SCOPE ใช้ absolute path | ผ่าน | /opt/data/cache/kbsrc/... |
| 8 | SCOPE ระบุไฟล์ใหม่ชัด | ผ่าน | lead-status-labels.ts |
| 9 | มีหมายเหตุการรวมงาน | ผ่าน | หนึ่งใบ = หนึ่ง PR |
| 10 | มีข้อความส่งต่อให้บอส | ผ่าน | [เดวิด → รีพิต] |
| 11 | ระบุผู้ตรวจรับ | ผ่าน | เดวิด |
| 12 | ระบุวันเวลาไทย | ผ่าน | 4 ต.ค. 69 |

## ข้อความส่งต่อให้บอส copy

```
[เดวิด → รีพิต] ใบ 264 (ภาคผนวก) — qa/job-264-addendum-export-status-labels-shared-map.md
1) ปิด PR #343 แล้วดึงการเปลี่ยนแปลงเข้าสาขาของ #342 (หนึ่งใบ = หนึ่ง PR)
2) สร้างโมดูลกลาง artifacts/api-server/src/lib/lead-status-labels.ts ให้ทั้ง ops-assistant.ts และ export ใน admin-router.ts ใช้แผนที่ป้ายชุดเดียวกัน (ห้ามคัดลอกซ้ำ)
3) เพิ่ม in_production + คืน contacted/qualified/lost
4) ล็อกเทสต์จาก DB จริง 65 งาน: team_reported_paid 36 · in_production 18 · ready_for_production 5 · closed 3 · quote_sent 2 · confirmed 1 — ทุกค่าต้องได้ป้ายไทย · CSV export ห้ามแสดงรหัสดิบ
5) คงการล้าง "ครับ" ซ้ำ (ทำแล้ว) · dataAsOf คงเดิม · index.css 0 diff · ห้ามแตะ UI ของใบ 265
หลักฐาน: tsc 0 · เทสต์ที่เกี่ยวผ่าน (ฐาน ops-assistant 31/31 · ชุดเต็ม 1164/1164/0) · ย้อนโค้ดแล้วตก · diff index.css = 0
```
