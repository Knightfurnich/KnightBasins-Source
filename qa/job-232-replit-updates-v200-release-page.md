# ใบงาน 232 (Release Docs & Updates Page v2.0.0) — อัปเดตหน้า /updates และประวัติรุ่น v2.0.0 ให้ตรงกับระบบจริง

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead) · **อนุมัติโดย:** บอส (คุณนพ)
**สถานะ:** มอบหมายให้ Replit · งานเอกสารประวัติรุ่นและหน้าเว็บสาธารณะ
**Branch:** `feat/replit-updates-v200-release-page`
**ที่มา:** ปัจจุบันระบบได้ปล่อยเวอร์ชัน Release v2.0.0 (Tag v2.0.0) บน GitHub เรียบร้อยแล้ว แต่หน้าจอแสดงประวัติการอัปเดต (`/updates`) และป้ายที่ Footer ของเว็บยังคงแสดงเป็น "v1.2" ทำให้ลูกค้าและผู้เยี่ยมชมเห็นข้อมูลล้าสมัย จึงต้องปรับปรุงหน้า `/updates` ให้บันทึกประวัติการพัฒนาตั้งแต่ v1.3.0 ถึง v2.0.0 ให้ครบถ้วนสมบูรณ์

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/knight-basins/src/pages/UpdatesPage.tsx:
     - เพิ่มบล็อกประวัติรุ่น v2.0.0 ไว้บนสุดของ UPDATE_RELEASES:
       - version: "v2.0.0"
       - date: "3 ตุลาคม 2569"
       - title: "Release v2.0.0 — สถาปัตยกรรมความปลอดภัยขั้นสูง, 2D Studio Smart Positioning และ DevOps Auto-Migration"
       - highlights:
         - "Smart 7-Level Positioning: ปุ่มตำแหน่งอ่าง 7 ระดับรองรับแผ่นขาแนวตั้งของเคาน์เตอร์ทรง L และ U พร้อมรักษาระยะปลอดภัย 100 มม. ทุกด้าน"
         - "Asset WebP Optimization: แปลงไฟล์ภาพอ่าง 30 รุ่นเป็น WebP โปร่งใส ลดขนาดลง 88.4% โหลดเร็วขึ้น 10 เท่า"
         - "Financial Security & Price Guard: ปิดช่องโหว่อายุลิงก์ 45 วันในจุดส่งสลิปและดูสถานะงาน พร้อมระบบคำนวณราคาจริงบนเซิร์ฟเวอร์ก่อนออก Dynamic PromptPay QR"
         - "Freestanding Pillar Separation: แยกเสาวางของตั้งพื้น (KF029/030) ออกจากผังเจาะเคาน์เตอร์ 2D พร้อมป้ายชุดสำเร็จรูป"
         - "DevOps CI/CD: ระบบ Auto-Migration อัตโนมัติบน VPS ผ่าน GitHub Actions deploy workflow"
         - "Proactive Emergency Alert: ระบบเฝ้าระวังข้อผิดพลาดสลิปยิงแจ้งเตือนด่วนเข้า Telegram ทันที พร้อม Knight UX Digest ประจำสัปดาห์"
  2. ใน artifacts/knight-basins/src/App.tsx:
     - อัปเดตป้ายข้อความลิงก์ประวัติรุ่นที่ Footer (~บรรทัด 282):
       เดิม: บันทึกการอัปเดต (v1.2)
       ใหม่: บันทึกการอัปเดต (v2.0)
  3. ชุดทดสอบ:
     - artifacts/knight-basins/test/updates-page-v200.test.ts:
       - ทดสอบว่า UPDATE_RELEASES มีรายการ v2.0.0 อยู่บนสุด
       - ทดสอบว่า Footer ลิงก์ไปยัง /updates แสดงข้อความ "บันทึกการอัปเดต (v2.0)"

SCOPE:
  - artifacts/knight-basins/src/pages/UpdatesPage.tsx
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/updates-page-v200.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามลบประวัติรุ่นเดิม (v1.0.0 ถึง v1.2.0) ที่มีอยู่แล้ว ให้เพิ่ม v2.0.0 ไว้ด้านบนสุด

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/replit-updates-v200-release-page ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) node --test test/updates-page-v200.test.ts ใน knight-basins → ผ่านทุกข้อ (ระบุจำนวนข้อจริง)
  4) npm test ใน artifacts/knight-basins (non-browser suite baseline: 940 ผ่าน / 0 ตก / 7 ข้าม)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/knight-basins/src/pages/UpdatesPage.tsx
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/updates-page-v200.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และชุดทดสอบ updates-page-v200 ผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | อัปเดต /updates และ Footer เป็น v2.0.0 |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 3 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | index.css 0 diff, คงประวัติเดิมไว้ |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline 940 ข้อจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | Replit |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ทำหน้าอัปเดต v2.0.0 ให้ตรงกับระบบจริง |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ตรวจสอบข้อมูลครบถ้วน |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 232 เรียบร้อย |
