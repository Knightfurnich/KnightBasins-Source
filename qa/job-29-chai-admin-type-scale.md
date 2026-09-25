# ใบงาน 29 (ชัย) — หน้าแอดมินทุกหน้าใช้สเกลตัวอักษรมาตรฐาน (14px / พื้น 12px)

**วันที่:** 24 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการเจ้าของ (คำต่อคำ):** "แก้ไขหน้าอื่นๆทั้งหมด" · "ครั้งนี้เดวิดดูให้ละเอียด ให้ครบทุกเมนู อย่างละเอียด"
**มาตรฐานที่ล็อกไว้:** `knight-design-kb/HANDOFF.md` §3.6 (ต้นแบบ = `/studio` โหมดง่าย)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 24 ก.ย. 69 · เดวิด

GOAL:
  ทำให้หน้าแอดมินทุกหน้าใช้ "สเกลตัวอักษรมาตรฐาน" (HANDOFF.md §3.6) ซึ่งเจ้าของล็อกโดยใช้
  หน้า /studio โหมดง่ายเป็นต้นแบบ:
    - ข้อความหลัก (เนื้อหา · label · ช่องกรอก · ปุ่ม · รหัส/ชื่อสินค้า) = 14px
    - คำอธิบายรอง/hint/หมายเหตุ = 12px
    - ห้ามมีข้อความที่คำนวณได้ต่ำกว่า 12px เลย
    - หัวข้อ: h1 = 30–44px (clamp) · h2 = 18–21px · h3 = 16px  (ใช้ token เดิม ไม่ต้องแก้)

  ต้นเหตุที่ตรวจพบในไฟล์แอดมิน (24 ก.ย. 69):
  หน้าแอดมินใช้ Tailwind arbitrary size ใน JSX ซึ่งไม่อยู่ใน index.css เลย การแก้ CSS จึงไม่ถึง:
    text-[10px] และต่ำกว่า ใน 9 ไฟล์ รวม 82 จุด
      src/admin/LeadsManager.tsx 31 · src/admin/TechnicianCalendarPage.tsx 30 ·
      src/admin/AdminDashboard.tsx 10 · src/admin/TeamManager.tsx 3 ·
      src/admin/BasinImageManagerField.tsx 3 · src/admin/AdminApp.tsx 2 ·
      src/admin/AdminVisibilityFilter.tsx 1 · src/admin/VideoUploadField.tsx 1 ·
      src/admin/ImageUploadField.tsx 1
  ตัวอย่างจริง: หน้าลูกค้า /sketch วัดได้ eyebrow 10px · ปุ่ม 10px · ชื่อหิน 9px
  ขณะที่ต้นแบบ /studio วัดได้ 14px ทั้งหมด

SCOPE (absolute path — ใช้ได้กับชัย):
  1. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/LeadsManager.tsx
  2. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/TechnicianCalendarPage.tsx
  3. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/AdminDashboard.tsx
  4. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/TeamManager.tsx
  5. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/BasinImageManagerField.tsx
  6. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/AdminApp.tsx
  7. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/AdminVisibilityFilter.tsx
  8. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/VideoUploadField.tsx
  9. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/ImageUploadField.tsx

  9 ไฟล์นี้มีอยู่จริงในเครื่อง — ยืนยันแล้วด้วย ls (ทุกไฟล์มีจริง ขนาด > 0)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/index.css  <- เป็นของ Replit ใบงาน 28 (ถ้าจำเป็นให้หยุดแล้วรายงาน)
  - ห้ามแตะไฟล์ลูกค้า: App.tsx · components/** (ยกเว้นไม่มี)
  - ห้ามแตะ CSS พิมพ์: @media print · .formal-* · .workbench* · .workshop* · .sig-box
  - ห้ามแตะ src/data/** · generated/** · lib/** · artifacts/api-server/**
  - ห้ามแตะตรรกะราคา การคำนวณ layout หรือสี — ใบนี้แก้ "ขนาดตัวอักษร" เท่านั้น
  - ห้าม push เข้า main ตรง ๆ — สร้าง branch แล้วเปิด PR เท่านั้น
  - ห้ามพิมพ์รหัสผ่าน/token ลงรายงาน (ถ้าต้องใช้ ให้อ่านจาก env ในเชลล์และรายงานแค่รหัส HTTP)

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current (ต้องไม่ใช่ main) + git log --oneline -1
  2) ตรวจว่า 9 ไฟล์ใน SCOPE มีจริงก่อนเริ่ม: ls -l <ทั้ง 9 path>  -> แนบผล
  3) cd artifacts/knight-basins && npm run typecheck   -> 0 errors
  4) cd artifacts/knight-basins && npm test
     เกณฑ์ผ่าน: ต้องไม่มี fail นอกไฟล์ *.browser.test.ts
     baseline อ้างอิง (วัดเองบน main ก่อนเริ่ม 24 ก.ย. 69): tests 189 / pass 185 / fail 2
     และเฉพาะไฟล์ที่ไม่ใช่ browser: 50 / 50 / 0
  5) ★ baseline ของหน้าแอดมิน — เดวิดวัดให้ไม่ได้ (ต้องล็อกอิน) จึงเป็นหน้าที่ชัย:
     เปิด dev server แล้วล็อกอินแอดมิน (รหัสจาก env — ห้ามพิมพ์ค่า) แล้วรันใน console ทีละหน้า:
       [...document.querySelectorAll('main *')].filter(e => !e.children.length && e.innerText.trim()
         && parseFloat(getComputedStyle(e).fontSize) < 12).length
     รายงานเป็น "ก่อนแก้ -> หลังแก้" ต่อหน้า:
       /admin · /admin/leads · /admin/calendar · /admin/team · /admin/basins ·
       /admin/sheet-stones · /admin/installed-stones
     ทุกหน้าต้องได้ 0 หลังแก้ (และต้องแนบตัวเลขก่อนแก้ด้วย — ถ้าตัวเลขก่อนแก้เป็น 0 อยู่แล้ว
     ให้รายงานตรง ๆ ว่า 0 และระบุว่าหน้านั้นไม่ต้องแก้)
  6) ยืนยันว่าไม่แตะของต้องห้าม: git diff --stat ต้องไม่แสดง index.css และไม่มีบรรทัดที่แตะ @media print / .formal- / .workbench / .workshop / .sig-box
  7) ภาพหน้าจอ 1–2 ภาพของหน้าแอดมินที่มีข้อความเล็กสุด (ก่อน/หลัง)

OUTPUT:
  - branch: feat/chai-admin-type-scale (เปิด PR เข้า main รอตรวจ)
  - 9 ไฟล์ที่แก้ตาม SCOPE
  - EVIDENCE ครบ 7 ข้อ (แนบตัวเลข before->after ต่อหน้า)

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้าวัดแล้วหน้าแอดมินใดยังมีจุดต่ำกว่า 12px แม้แต่ 1 จุด -> หยุด รายงานหน้าที่ยังเหลือ
  - ถ้าต้องแก้ index.css เพื่อให้ผ่าน -> หยุด รายงาน (ห้ามแตะ เป็นของใบงาน 28)
  - ถ้าเทสต์ที่ล้มไม่ใช่ไฟล์ *.browser.test.ts -> หยุด (เพดานผ่าน = 0 fail นอกไฟล์นั้น)
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE เพื่อให้ผ่าน -> หยุด รายงาน (ห้าม workaround)
  - ถ้าเข้าแอดมินไม่ได้ (ล็อกอินไม่ผ่าน) -> หยุด รายงานว่าเข้าไม่ได้ (ห้ามเดาตัวเลข)

CONTRACT (สเกลมาตรฐาน — ต้องได้ตามนี้ ไม่ใช่ตีความเอง):
  ข้อ 1 — แทน Tailwind arbitrary size ให้เป็นค่ามาตรฐาน:
    text-[8px] text-[9px] text-[10px] text-[10.5px] text-[11px] text-[11.5px]  ->  text-[12px]
    (คำอธิบายรอง/hint ใช้ 12px ได้)
  ข้อ 2 — ถ้าข้อความนั้นเป็น "ข้อความหลัก" (เนื้อหาในตาราง · label · ปุ่ม · ช่องกรอก · รหัส/ชื่อ)
    ให้ใช้ 14px: text-[14px] หรือ (ดีกว่า) เอา class ขนาดออกแล้วใช้ค่าจาก CSS กลาง
    เกณฑ์ตัดสินง่าย ๆ: ถ้าผู้ใช้ต้องอ่านเพื่อทำงาน -> 14px · ถ้าเป็นคำอธิบายประกอบ -> 12px
  ข้อ 3 — ห้ามเหลือ text-[Npx] ที่ N < 12 ใน 9 ไฟล์นี้แม้แต่จุดเดียว
    คำสั่งตรวจ: grep -rhoE 'text-\[[0-9.]+px\]' artifacts/knight-basins/src/admin | sort | uniq -c
    ผลที่ต้องการ: ไม่มีบรรทัดที่ค่า < 12px
  ข้อ 4 — ห้ามเพิ่ม !important และห้ามแก้ h1/h2/h3 (หัวข้อใช้ token เดิมอยู่แล้ว)
  ข้อ 5 — <small> ของเบราว์เซอร์คิด 80% ของ parent: ถ้าเจอ <small> ที่ยังเล็ก ให้รายงาน
    (การแก้ที่ CSS กลางเป็นของใบงาน 28 — ห้ามแก้เอง)
  ข้อ 6 — ข้อความไทยห้ามประกอบด้วย chr()/escape — เขียนเป็นไฟล์ UTF-8 เท่านั้น
  ข้อ 7 — งานนี้แก้ "ขนาดตัวอักษร" เท่านั้น ห้ามเปลี่ยน layout สี หรือตรรกะราคา
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว ไม่ชนกับใบอื่น | ✅ ชนกับใบ 28 เฉพาะ `index.css` — แยกไฟล์ชัด (ห้ามแตะ) |
| 2 | GOAL วัดได้ | ✅ ตัวเลข: 0 จุดต่ำกว่า 12px · หลัก 14px · รอง 12px |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 9 ไฟล์ · absolute (ชัยใช้ได้) · ยืนยันด้วย ls แล้ว |
| 4 | FORBIDDEN ชัด | ✅ 6 ข้อ รวม index.css และ CSS พิมพ์ |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข ไม่ใช่คำรับรอง | ✅ 7 ข้อ มีสคริปต์วัด + baseline 189/185/2 |
| 6 | OUTPUT ชัด (branch + ไฟล์ + หลักฐาน) | ✅ `feat/chai-admin-type-scale` + PR |
| 7 | STOP วัดได้ | ✅ 5 เงื่อนไข รวม "เข้าแอดมินไม่ได้ให้หยุด" |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ 189/185/2 + 50/50/0 · ส่วนหน้าแอดมินสั่งให้ชัยวัดก่อนแก้ (เดวิดเข้าไม่ได้) |
| 9 | CONTRACT ระบุบรรทัดจริง | ✅ 9 ไฟล์ + จำนวนจุดต่อไฟล์ + คำสั่ง grep ตรวจ |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มี EVIDENCE ที่ขัด FORBIDDEN |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ CONTRACT ข้อ 6 |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ ทุก path เป็น absolute และมีจริง |

## หมายเหตุสำหรับเดวิด (ไม่ส่งให้ชัย)
- baseline หน้าแอดมินไม่มีจากฝั่งเรา (ต้องล็อกอิน) → ใบงานสั่งให้ชัยวัดก่อนแก้และรายงาน ถ้าวัดไม่ได้ให้หยุด (ห้ามเดา)
- ชัยห้ามแตะ index.css → ถ้าพบว่าหน้าแอดมินต้องแก้ CSS กลาง ให้รายงานกลับมาที่เดวิด แล้วเดวิดรวมเข้าใบงาน 28
