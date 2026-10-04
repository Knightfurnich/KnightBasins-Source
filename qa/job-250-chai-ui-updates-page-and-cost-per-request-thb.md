# ใบงาน 250-C (ชัย) — UI 2 จุดที่เหลือ: หน้า /updates + ต้นทุนเฉลี่ยต่อคำขอเป็นบาท

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ **ชัย (Claude Code CLI)** · 1 ใบงาน = 1 สาขา = 1 PR
**ที่มา:** บอสสั่งรวมใบงาน UI และย้ายจากรีพิตมาให้ชัย (รีพิตทำงานไม่ทัน)
**⚠️ 2 จุดแรกเสร็จแล้วโดยรีพิต:** ปุ่มเปิดเสียงมองเห็นชัด + ข้อความต้อนรับสั้นลง = merge แล้วใน PR #302 (commit `47f957e`) — **ห้ามทำซ้ำ**
**Branch:** `fix/chai-ui-updates-page-and-cost-per-request-thb`

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. หน้า /updates — ไฟล์ /opt/data/cache/kbsrc/artifacts/knight-basins/src/pages/UpdatesPage.tsx
     (ก) ตัดคำนำ "Release vX.Y.Z — " ออกจากหัวเรื่องทุกใบ (มี 4 รุ่น: v2.2.1 · v2.2.0 · v2.1.0 · v2.0.0)
         ให้หัวเรื่องเริ่มด้วยข้อความไทยแบบรุ่นก่อนหน้า (เลขรุ่นแสดงอยู่ที่ badge ด้านขวาอยู่แล้ว)
     (ข) ทำหัวเรื่อง/ป้าย/รายการให้เป็นไทยกระชับสั้นเหมือนรุ่นก่อน — เลิกใช้สตริงอังกฤษยาวเป็น badge
         (เช่น "Security, Smart Studio & DevOps") · ตัวเรนเดอร์เป็นชุดเดียวกันทั้งหน้า (ไม่ต้องแก้ CSS)
         ถ้าตรวจแล้วพบว่าขนาดฟอนต์/คลาสต่างกันจริง ให้แก้ให้ตรงกัน
     (ค) รวบรุ่นเล็กเข้าด้วยกัน: รวม v2.2.0 เข้ากับ v2.2.1 เป็นรุ่นเดียว (label v2.2.1 · คงคำว่า "รุ่นล่าสุด" ใน badge)
         เก็บข้อเท็จจริงสำคัญของทั้งสองไว้ครบ (Support Chat & System Stability + เลขใบเสนอราคา QT-YYYYMM-TYPE-NNNN แบบ atomic)
         รุ่นอื่นคงรายการเดิม
     ต้องอัปเดตเทสต์ที่ผูกข้อความเดิม (ห้ามลบเทสต์ และต้องคงการกันข้อเท็จจริงเดิม: ห้ามมีคำว่า "10 เท่า" · ต้องมี "88.4% (13.71 MB → 1.60 MB)"):
       /opt/data/cache/kbsrc/artifacts/knight-basins/test/updates-page.test.ts
       /opt/data/cache/kbsrc/artifacts/knight-basins/test/updates-page-v200.test.ts
       /opt/data/cache/kbsrc/artifacts/knight-basins/test/llms-txt-content-integrity.test.ts
       /opt/data/cache/kbsrc/artifacts/knight-basins/test/release-v120.test.ts
  2. การ์ด "ต้นทุนเฉลี่ยต่อคำขอ" ในหน้า /admin/ai-cost ให้แสดงเป็น "บาท"
     ไฟล์ /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/AiCostCenterPage.tsx (บรรทัด ~461)
     ปัจจุบัน: `${decimalFormatter.format(averageSatang)} สตางค์` โดย averageSatang = (totalCostThb * 100) / totalRequests
     ต้องเป็น: บาท ทศนิยม 2 ตำแหน่ง (เช่น 88.56 บาท หรือ ฿88.56 — เลือกแบบเดียวให้สอดคล้องทั้งหน้า)
     ห้ามเปลี่ยนสูตรคำนวณ · ค่า 0 ต้องแสดง 0.00 บาท (ห้าม NaN/Infinity) · ตรวจทั้งหน้าไม่ให้เหลือคำว่า "สตางค์" (รวมข้อความส่งออก LINE/CSV)
     ถ้ามีเทสต์ผูกข้อความ "สตางค์" ให้อัปเดต: /opt/data/cache/kbsrc/artifacts/knight-basins/test/ai-cost-center-ui.test.ts

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/pages/UpdatesPage.tsx
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/AiCostCenterPage.tsx
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/updates-page.test.ts
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/updates-page-v200.test.ts
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/llms-txt-content-integrity.test.ts
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/release-v120.test.ts
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/ai-cost-center-ui.test.ts

FORBIDDEN:
  - ห้ามแตะ src/index.css (ไฟล์แช่แข็ง)
  - ห้ามแตะ src/components/** (รวม KnightSupport.tsx — รีพิตแก้เสร็จแล้ว), src/admin/AdminVoiceSettings.tsx และ src/data/** และ artifacts/api-server/**
  - ห้ามทำซ้ำ 2 จุดที่รีพิตส่งไปแล้ว (ปุ่มเสียง/ข้อความต้อนรับ) — งานซ้ำจะชนกัน
  - ห้ามลบเทสต์หรือทำให้ assert ที่ตรวจข้อเท็จจริงอ่อนลง · ห้ามเปลี่ยนสูตรต้นทุน · ห้ามเพิ่มเลขรุ่นใหม่หรืออ้างผลลัพธ์ที่ยังไม่วัด
  - ห้ามแตะ Production · ห้าม push ตรง main

EVIDENCE:
  1) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  2) node --experimental-strip-types --test test/studio-*.test.ts test/sketch-*.test.ts ใน artifacts/knight-basins → ระบุ tests/pass/fail (baseline ปัจจุบัน 418/416/0/2)
  3) รันเทสต์ที่แก้โดยตรง 5 ไฟล์ → ผ่านทุกข้อ
  4) ตรวจด้วยคำสั่ง 2 ข้อ ต้องได้ 0 ทั้งคู่:
       grep -c 'title: "Release v' artifacts/knight-basins/src/pages/UpdatesPage.tsx
       grep -c 'สตางค์' artifacts/knight-basins/src/admin/AiCostCenterPage.tsx
  5) แนบภาพหน้าจอ "ก่อน/หลัง" 2 คู่: หน้า /updates (หัวเรื่องไทย ไม่มีคำนำ + การ์ดลดลง 1 ใบ) และการ์ดต้นทุนเฉลี่ยต่อคำขอ (หน่วยเป็นบาท)
  6) git diff main...HEAD -- artifacts/knight-basins/src/index.css | wc -l → 0

OUTPUT:
  - ไฟล์ UI 2 ไฟล์ + เทสต์ที่อัปเดต
  - PR เดียวเข้า main พร้อมภาพก่อน/หลัง 2 คู่ · ผลรันจริง · ผล grep 2 ข้อ
  - สรุปสั้นท้าย PR: จำนวนการ์ดในหน้า /updates ก่อน/หลัง

STOP:
  - เมื่อ tsc 0 errors · เทสต์ผ่านทั้งหมด · grep ได้ 0 ทั้ง 2 ข้อ · มีภาพก่อน/หลังครบ · เปิด PR แล้ว
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ (commit งานที่เสร็จก่อนหยุดเสมอ)
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | 2 จุดที่เหลือ (ตัด 2 จุดที่รีพิตทำแล้ว) |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | UI 2 ไฟล์ + เทสต์ 5 ไฟล์ |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามทำซ้ำงานรีพิต · ห้าม index.css |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | tsc + ชุดเทสต์ + grep 2 ข้อ + ภาพ 2 คู่ |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ไฟล์ + PR + สรุปท้าย PR |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 30 turns |
| 7 | SCOPE ใช้ absolute path | ผ่าน | /opt/data/cache/kbsrc/... |
| 8 | ไม่มี code fence ซ้อนในบล็อกใบงาน | ผ่าน | ไม่มี |
| 9 | ห้ามแตะ src/index.css | ผ่าน | 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | fix/chai-ui-updates-page-and-cost-per-request-thb |
| 11 | อ้างตัวเลข baseline | ผ่าน | 418/416/0/2 |
| 12 | ไม่ทับไฟล์กับใบงาน 254 | ผ่าน | 254 เป็น api-server · 250 เป็น UI |

## ข้อความส่งต่อ (บอส copy ส่งให้ชัย)

[เดวิด → ชัย]

บอสย้ายงาน UI จากรีพิตมาให้คุณ (รีพิตทำไม่ทัน) แต่ **2 จุดแรกรีพิตส่งมาแล้วและผม merge แล้ว** (PR #302 · commit `47f957e`: ปุ่มเปิดเสียงมองเห็นชัด + ข้อความต้อนรับสั้นลง) → **ห้ามทำซ้ำ**
งานของคุณ: ใบงาน **250-C** — `qa/job-250-chai-ui-updates-page-and-cost-per-request-thb.md` · สาขา `fix/chai-ui-updates-page-and-cost-per-request-thb`
1. **หน้า /updates** (src/pages/UpdatesPage.tsx) — ตัดคำนำ "Release vX.Y.Z —" ออกจากหัวเรื่อง 4 รุ่น · ทำหัวเรื่อง/ป้ายเป็นไทยกระชับเหมือนรุ่นก่อน (เลิกใช้ badge อังกฤษยาว) · รวม v2.2.0 เข้ากับ v2.2.1 เป็นรุ่นเดียว (คงคำว่า "รุ่นล่าสุด") · อัปเดตเทสต์ 4 ไฟล์ โดยคงการกันข้อเท็จจริง (ห้าม "10 เท่า" · ต้องมี 88.4% (13.71 MB → 1.60 MB))
2. **การ์ดต้นทุนเฉลี่ยต่อคำขอ → บาท** (src/admin/AiCostCenterPage.tsx บรรทัด ~461) — ห้ามเปลี่ยนสูตร · ค่า 0 ต้องเป็น 0.00 บาท · ไม่ให้เหลือคำว่า "สตางค์"
หลักฐาน: tsc 0 · ชุด studio+sketch ผ่าน (baseline 418/416/0/2) · grep 2 ข้อได้ 0 · แนบภาพก่อน/หลัง 2 คู่ · index.css 0 diff
(ใบงาน 252/253 ยกเลิกรวมเข้าใบนี้แล้ว · ใบงาน 254 ของคุณยังเดินคู่กันได้ ไม่ทับไฟล์)
