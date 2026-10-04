# ใบงาน 252-R (รีพิต) — หน้า /updates: ตัดคำนำ "Release vX —" · ทำรูปแบบให้เหมือนรุ่นก่อน · รวบรุ่นเล็กเข้าด้วยกัน

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (รีพิต) · เริ่มได้ทันที (บอสสั่งเอง)
**Branch:** `fix/replit-updates-page-titles-and-merge-small-releases`
**ที่มา:** บอสเปิด https://knightbasins.srv1964473.hstgr.cloud/updates แล้วสั่ง 3 ข้อ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. ตัดคำนำ "Release vX.Y.Z — " ออกจาก title ของ "ทุกรุ่นที่ยังมีคำนำ" ให้หัวเรื่องเริ่มด้วยข้อความไทยเลย
     (เหมือนรุ่นก่อนหน้า เช่น v1.2.0 "ระบบภาพหิน 3 บทบาทเต็มรูปแบบ, Studio Slab Viewer และ AI Visual Matcher")
     ปัจจุบันมีคำนำอยู่ 4 รุ่น: v2.2.1 · v2.2.0 · v2.1.0 · v2.0.0
     เลขรุ่นยังแสดงอยู่แล้วที่ badge ด้านขวา (span ที่แสดง release.version) — จึงไม่ต้องมีคำนำซ้ำในหัวเรื่อง
  2. ทำรูปข้อความของรุ่นใหม่ให้ "เหมือนรุ่นก่อนหน้า": หัวเรื่อง/ป้าย/รายการ ใช้ภาษาไทยกระชับ สั้น
     - ห้ามหัวเรื่องยาวเป็นประโยค และห้ามใช้สตริงอังกฤษยาวเป็นชื่อป้าย (badge)
       ตัวอย่างที่ต้องแก้: badge "Security, Smart Studio & DevOps" และหัวเรื่องที่ยาวเกิน 1 บรรทัด
     - ตัวเรนเดอร์เป็นชุดเดียวกันทั้งหน้า (ไม่ต้องแก้ CSS/ฟอนต์) — ความต่างที่บอสเห็นมาจาก "เนื้อหา" ที่ยาวและเป็นอังกฤษ
       ถ้าตรวจแล้วพบว่ามี class/ขนาดฟอนต์ต่างกันจริง ให้แก้ให้เป็นชุดเดียวกับรุ่นก่อนหน้า
  3. รวบรุ่นเล็ก ๆ เข้าด้วยกัน เพื่อไม่ให้หน้ายาวเกินไป: รวม v2.2.0 เข้ากับ v2.2.1 เป็น "รุ่นเดียว" (label v2.2.1)
     - เก็บข้อเท็จจริงสำคัญของทั้งสองไว้ครบ: Support Chat & System Stability + Sequential Quote Number Format (QT-YYYYMM-TYPE-NNNN · atomic)
     - ป้ายของรุ่นล่าสุดต้องคงคำว่า "รุ่นล่าสุด" (มีเทสต์ล็อกอยู่) เช่น badge: "ความเสถียรระบบ & เลขใบเสนอราคา — รุ่นล่าสุด"
     - รุ่นอื่น (v2.1.0 · v2.0.0 · v1.2.0 · v1.1.0 · v1.0.0 · v0.9.0 · v0.1.0) คงจำนวนรายการเดิมไว้ แก้แค่คำนำหัวเรื่อง
  4. อัปเดตเทสต์ที่ผูกกับข้อความเดิมให้ตรงกับโครงใหม่ (ห้ามลบเทสต์ทิ้ง):
     - artifacts/knight-basins/test/updates-page.test.ts
     - artifacts/knight-basins/test/updates-page-v200.test.ts
     - artifacts/knight-basins/test/llms-txt-content-integrity.test.ts
     - artifacts/knight-basins/test/release-v120.test.ts (ถ้าอ้างข้อความที่เปลี่ยน)
     ต้องคงการป้องกันเดิมไว้: ห้ามมีข้อความ "10 เท่า" · ต้องมีข้อเท็จจริง "88.4% (13.71 MB → 1.60 MB)" · ห้ามอ้างว่าป้องกันการสุ่ม

SCOPE:
  - artifacts/knight-basins/src/pages/UpdatesPage.tsx
  - artifacts/knight-basins/test/updates-page.test.ts
  - artifacts/knight-basins/test/updates-page-v200.test.ts
  - artifacts/knight-basins/test/llms-txt-content-integrity.test.ts
  - artifacts/knight-basins/test/release-v120.test.ts

FORBIDDEN:
  - ห้ามแตะ src/index.css
  - ห้ามแตะ src/components/** · src/admin/** · src/data/** · artifacts/api-server/**
  - ห้ามลบเทสต์หรือทำให้เทสต์อ่อนลง (ห้ามลบ assert ที่ตรวจข้อเท็จจริง)
  - ห้ามเพิ่มเลขรุ่นใหม่หรือปฏิเสธข้อเท็จจริงเดิม · ห้ามแต่งข้อความอ้างผลลัพธ์ที่ยังไม่วัด
  - ห้ามแตะ Production · ห้าม push ตรง main · ใช้ GitHub Connection เท่านั้น

EVIDENCE:
  1) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  2) node --experimental-strip-types --test test/studio-*.test.ts test/sketch-*.test.ts ใน artifacts/knight-basins → ระบุ tests/pass/fail (baseline ปัจจุบัน 418/416/0/2)
  3) รันเทสต์ที่แก้โดยตรง: node --experimental-strip-types --test test/updates-page.test.ts test/updates-page-v200.test.ts test/llms-txt-content-integrity.test.ts test/release-v120.test.ts → ผ่านทุกข้อ
  4) ตรวจด้วยคำสั่งว่าคำนำหายจริง: grep -c 'title: "Release v' artifacts/knight-basins/src/pages/UpdatesPage.tsx → ต้องได้ 0
  5) แนบภาพหน้า /updates ก่อนแก้ 1 ภาพ และหลังแก้ 1 ภาพ (ต้องเห็นว่าหัวเรื่องเริ่มด้วยข้อความไทย และจำนวนการ์ดลดลง 1 ใบ)
  6) git diff main...HEAD -- artifacts/knight-basins/src/index.css | wc -l → 0

OUTPUT:
  - UpdatesPage.tsx ที่หัวเรื่องไม่มีคำนำ "Release vX —" และรวม v2.2.0 เข้ากับ v2.2.1 แล้ว
  - เทสต์ 4 ไฟล์ที่อัปเดตตามโครงใหม่ (ยังป้องกันข้อเท็จจริงเดิมครบ)
  - PR เข้า main พร้อมภาพก่อน/หลัง + ผลรันจริง + ตัวเลขจากข้อ 4

STOP:
  - เมื่อ tsc 0 errors · เทสต์ผ่านทั้งหมด · grep ได้ 0 · มีภาพก่อน/หลัง · เปิด PR แล้ว
  - หรือเมื่อทำงานครบ 25 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | 3 ข้อตามที่บอสสั่ง |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 1 ไฟล์หน้า + 4 ไฟล์เทสต์ |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามลบเทสต์ · ห้ามแตะ index.css |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | tsc + ชุดเทสต์ + grep + ภาพก่อน/หลัง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ไฟล์ + PR + หลักฐาน |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 25 turns |
| 7 | SCOPE ใช้ path สัมพัทธ์ | ผ่าน | artifacts/... |
| 8 | บรรทัดบังคับ GitHub Connection | ผ่าน | ระบุใน FORBIDDEN |
| 9 | ห้ามแตะ src/index.css | ผ่าน | 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | fix/replit-updates-page-titles-and-merge-small-releases |
| 11 | ระบุตัวเลข baseline | ผ่าน | 418/416/0/2 |
| 12 | ไม่มี code fence ซ้อน | ผ่าน | ตัวอย่างข้อความแสดงแบบ inline |

## ข้อความส่งต่อ (บอส copy ส่งให้รีพิต)

[เดวิด → รีพิต]

งานใหม่: ใบงาน 252 — `qa/job-252-replit-updates-page-titles-and-merge.md` (บอสสั่งเองจากการเปิดหน้า /updates)
1. **ตัดคำนำ "Release vX.Y.Z —" ออกจากหัวเรื่องทุกใบ** (มี 4 รุ่น: v2.2.1 · v2.2.0 · v2.1.0 · v2.0.0) ให้เริ่มด้วยข้อความไทยแบบรุ่นก่อนหน้า — เลขรุ่นโชว์อยู่ที่ badge ขวาอยู่แล้ว
2. **ทำรูปข้อความให้เหมือนรุ่นก่อน:** หัวเรื่อง/ป้าย/รายการ ไทยกระชับสั้น · เลิกใช้สตริงอังกฤษยาวเป็น badge (เช่น "Security, Smart Studio & DevOps") · ตัวเรนเดอร์เป็นชุดเดียวกันอยู่แล้ว ไม่ต้องแก้ CSS แต่ถ้าเจอขนาดฟอนต์ต่างจริงให้แก้ให้ตรงกัน
3. **รวบรุ่นเล็ก:** รวม v2.2.0 เข้ากับ v2.2.1 เป็นรุ่นเดียว (label v2.2.1 · คงคำว่า "รุ่นล่าสุด") เก็บข้อเท็จจริงทั้งสองครบ · รุ่นอื่นคงรายการเดิม
4. **อัปเดตเทสต์ 4 ไฟล์** ที่ผูกข้อความเดิม (updates-page · updates-page-v200 · llms-txt-content-integrity · release-v120) **ห้ามลบเทสต์** และต้องคงการกันข้อเท็จจริงเดิม (ห้าม "10 เท่า" · ต้องมี "88.4% (13.71 MB → 1.60 MB)")
หลักฐาน: tsc 0 · ชุด studio+sketch ผ่าน (baseline 418/416/0/2) · `grep -c 'title: "Release v'` ต้องได้ 0 · **แนบภาพก่อน/หลัง** · index.css 0 diff
