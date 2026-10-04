# ใบงาน 253-R (รีพิต) — หน้า /admin/ai-cost: ต้นทุนเฉลี่ยต่อคำขอให้แสดงเป็น "บาท"

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (รีพิต) · บอสสั่งเอง
**Branch:** `fix/replit-ai-cost-average-per-request-thb`
**ที่มา:** บอสเปิดหน้า /admin/ai-cost แล้วเห็นการ์ด "ต้นทุนเฉลี่ยต่อคำขอ" แสดงเป็น **สตางค์** (8,855.94 / 6,283.00 / 2,082.41 สตางค์) และสั่งให้คำนวณ/แสดงเป็น **บาท**

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. เปลี่ยนหน่วยของการ์ด "ต้นทุนเฉลี่ยต่อคำขอ" จาก "สตางค์" เป็น "บาท" (ทศนิยม 2 ตำแหน่ง)
     ตำแหน่งจริง: artifacts/knight-basins/src/admin/AiCostCenterPage.tsx บรรทัด ~461
       ปัจจุบัน: value={`${decimalFormatter.format(averageSatang)} สตางค์`}  โดย averageSatang = (data.totalCostThb * 100) / data.totalRequests
       ต้องเป็น: แสดงเป็นบาท เช่น "88.56 บาท" หรือ "฿88.56" (เลือกแบบใดแบบหนึ่งให้สอดคล้องกับทั้งหน้า)
  2. ตรวจให้แน่ใจว่าไม่มีที่อื่นในหน้าเดียวกันที่ยังใช้ "สตางค์" (รวมข้อความที่ส่งออก LINE/CSV) — ถ้ามีให้เปลี่ยนเป็นบาทให้สอดคล้องกัน
  3. ห้ามเปลี่ยนวิธีคำนวณ (totalCostThb ÷ totalRequests) — เปลี่ยนแค่หน่วยที่แสดง
  4. ค่า 0 ต้องแสดงสวย เช่น 0.00 บาท (ห้าม NaN/Infinity เมื่อ totalRequests = 0)

SCOPE:
  - artifacts/knight-basins/src/admin/AiCostCenterPage.tsx
  - artifacts/knight-basins/test/ai-cost-center-ui.test.ts

FORBIDDEN:
  - ห้ามแตะ src/index.css · src/components/** · src/data/** · artifacts/api-server/**
  - ห้ามเปลี่ยนสูตรคำนวณต้นทุนหรือแก้ตัวเลขจาก API
  - ห้ามแตะ Production · ห้าม push ตรง main · ใช้ GitHub Connection เท่านั้น

EVIDENCE:
  1) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  2) node --experimental-strip-types --test test/studio-*.test.ts test/sketch-*.test.ts ใน artifacts/knight-basins → ระบุ tests/pass/fail (baseline ปัจจุบัน 418/416/0/2)
  3) node --experimental-strip-types --test test/ai-cost-center-ui.test.ts → ผ่านทุกข้อ (อัปเดตเทสต์ที่ผูกข้อความ "สตางค์" ถ้ามี — ห้ามลบเทสต์)
  4) ตรวจด้วยคำสั่ง: grep -c 'สตางค์' artifacts/knight-basins/src/admin/AiCostCenterPage.tsx → ต้องได้ 0
  5) แนบภาพหน้า /admin/ai-cost (การ์ดต้นทุนเฉลี่ยต่อคำขอ) ก่อน/หลังแก้ — ต้องเห็นหน่วยเป็นบาท
  6) git diff main...HEAD -- artifacts/knight-basins/src/index.css | wc -l → 0

OUTPUT:
  - AiCostCenterPage.tsx ที่การ์ดต้นทุนเฉลี่ยต่อคำขอแสดงเป็นบาท
  - เทสต์ที่อัปเดต (ถ้ามี) — ยังคงตรวจว่าค่าเฉลี่ย = totalCostThb ÷ totalRequests
  - PR เข้า main พร้อมภาพก่อน/หลัง + ผลรันจริง + ผล grep

STOP:
  - เมื่อ tsc 0 errors · เทสต์ผ่านทั้งหมด · grep ได้ 0 · มีภาพก่อน/หลัง · เปิด PR แล้ว
  - หรือเมื่อทำงานครบ 20 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | เปลี่ยนหน่วยเป็นบาท + เก็บสูตรเดิม |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 1 ไฟล์หน้า + เทสต์ |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ index.css/API |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | tsc + ชุดเทสต์ + grep + ภาพก่อน/หลัง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ไฟล์ + PR + หลักฐาน |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 20 turns |
| 7 | SCOPE ใช้ path สัมพัทธ์ | ผ่าน | artifacts/... |
| 8 | บรรทัดบังคับ GitHub Connection | ผ่าน | ระบุใน FORBIDDEN |
| 9 | ห้ามแตะ src/index.css | ผ่าน | 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | fix/replit-ai-cost-average-per-request-thb |
| 11 | ระบุตัวเลข baseline | ผ่าน | 418/416/0/2 |
| 12 | ไม่มี code fence ซ้อน | ผ่าน | โค้ดปัจจุบันแสดงแบบ inline |

## ข้อความส่งต่อ (บอส copy ส่งให้รีพิต)

[เดวิด → รีพิต]

งานใหม่ (เล็ก): ใบงาน 253 — `qa/job-253-replit-ai-cost-average-per-request-thb.md` (บอสสั่งเอง)
การ์ด "ต้นทุนเฉลี่ยต่อคำขอ" ในหน้า /admin/ai-cost ตอนนี้แสดงเป็น **สตางค์** (เช่น 8,855.94 สตางค์) → ให้เปลี่ยนเป็น **บาท** ทศนิยม 2 ตำแหน่ง (เช่น 88.56 บาท)
- ตำแหน่ง: src/admin/AiCostCenterPage.tsx บรรทัด ~461 (`averageSatang` = totalCostThb × 100 ÷ totalRequests) — **ห้ามเปลี่ยนสูตร** เปลี่ยนแค่หน่วยที่แสดง
- ตรวจให้ทั้งหน้าไม่มีคำว่า "สตางค์" เหลือ (รวมข้อความส่งออก LINE/CSV) และค่า 0 ต้องแสดง 0.00 บาท ไม่เป็น NaN
หลักฐาน: tsc 0 · ชุด studio+sketch ผ่าน (baseline 418/416/0/2) · `grep -c 'สตางค์'` ต้องได้ 0 · แนบภาพก่อน/หลัง · index.css 0 diff
