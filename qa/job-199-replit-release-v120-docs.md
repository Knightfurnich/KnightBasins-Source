# ใบงาน 199-R (Replit) — Release v1.2.0: Update /updates Page, Footer Version, and System Docs

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit · เริ่มได้ทันที
**Branch:** `feat/replit-release-v120-docs`
**วัตถุประสงค์:** อัปเดตบันทึกประวัติรุ่นเป็นเวอร์ชัน **v1.2.0** บนหน้าเว็บ (`/updates`), ปรับป้ายเวอร์ชันที่ Footer ของเว็บ, และอัปเดตเอกสารระบบ (`replit.md`) ให้สะท้อนความสามารถล่าสุดของระบบ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. เพิ่มบล็อกประวัติรุ่น v1.2.0 ไว้บนสุดของ UPDATE_RELEASES ใน artifacts/knight-basins/src/pages/UpdatesPage.tsx:
     - version: "v1.2.0"
     - badge: "Stone Visual Experience & AI Matcher Suite — รุ่นล่าสุด"
     - date: "3 ตุลาคม 2569"
     - dateTime: "2026-10-03"
     - title: "ระบบภาพหิน 3 บทบาทเต็มรูปแบบ, Studio Slab Viewer และ AI Visual Matcher"
     - highlights 4 รายการ:
       * Full Slab & Studio Viewer: ปุ่มดูภาพเต็มแผ่นบนหน้าร้าน /stone และปุ่ม "ดูลายแผ่นจริง" ใน 2D Studio (/studio)
       * Formal Quotation Stone Thumbnails: ภาพตัวอย่างหินสังเคราะห์แสดงคู่กับรายการสินค้าในใบเสนอราคาทางการ (PDF/A4) ทั้งแบบ US และ OF
       * Automated Studio Sales Alert: แจ้งเตือนงานขายเข้า Telegram อัตโนมัติทันทีที่ยื่นแบบร่างจาก Studio พร้อมแนบลิงก์รูปหินให้ช่างเปิดดูหน้างานได้ทันที
       * AI Visual Matcher (Gemini): ระบบคลังจับคู่สีหินจากภาพห้องน้ำลูกค้าด้วย Vertex AI Gemini วิเคราะห์เฉพาะหินในแคตตาล็อก
  2. อัปเดตป้ายข้อความลิงก์ประวัติรุ่นที่ Footer ใน artifacts/knight-basins/src/App.tsx (บรรทัด ~278) จาก "บันทึกการอัปเดต (v1.0)" เป็น "บันทึกการอัปเดต (v1.2)"
  3. อัปเดตข้อมูลภาพรวมสถาปัตยกรรมและฟีเจอร์ใน replit.md ให้ตรงกับระบบปัจจุบัน (ห้ามมีชื่อทีมงาน, ข้อมูลภายใน, หรือ Secret ใดๆ เด็ดขาด)
  4. เขียนการทดสอบ Static Source ใน artifacts/knight-basins/test/release-v120.test.ts ตรวจสอบการมีอยู่ของ v1.2.0 ใน UpdatesPage และ Footer

SCOPE:
  - artifacts/knight-basins/src/pages/UpdatesPage.tsx
  - artifacts/knight-basins/src/App.tsx
  - replit.md
  - artifacts/knight-basins/test/release-v120.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - กฎเหล็กความเป็นส่วนตัว: หน้าสาธารณะและ readme ห้ามมีชื่อทีมงาน/ช่าง และห้ามมี Secret / Token ใดๆ เด็ดขาด
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามแตะต้องสูตรการคำนวณราคาใดๆ ทั้งสิ้น
  - ทำงานผ่าน branch: feat/replit-release-v120-docs แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/replit-release-v120-docs ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) node --test test/release-v120.test.ts ใน artifacts/knight-basins → ผ่านทุกข้อ
  4) npm test ใน artifacts/knight-basins (non-browser suite)
     baseline อ้างอิง: tests 661 / pass 660 / fail 0 / todo 1 (สำหรับ non-browser suite)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/knight-basins/src/pages/UpdatesPage.tsx
  - artifacts/knight-basins/src/App.tsx
  - replit.md
  - artifacts/knight-basins/test/release-v120.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และเทสต์ใหม่ผ่านครบถ้วน
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ระบุเป้าหมายเพิ่ม v1.2.0, ปรับ Footer, อัปเดต replit.md |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 4 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามมีชื่อทีมงาน/secret, ห้ามแตะ CSS, บังคับ GitHub Connection |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่ง tsc, node test, npm test baseline |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ผลลัพธ์ 4 ไฟล์ |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | ระบุ 30 turns |
| 7 | Replit SCOPE ใช้ path สัมพัทธ์ | ผ่าน | ไม่มี absolute path ของเครื่องเซิร์ฟเวอร์ |
| 8 | Replit บังคับ GitHub Connection | ผ่าน | มีบรรทัดข้อบังคับครบถ้วน |
| 9 | ห้ามแตะ src/index.css | ผ่าน | ระบุชัดเจน 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | feat/replit-release-v120-docs |
| 11 | มี baseline ตัวเลขเปรียบเทียบ | ผ่าน | 661 tests / 0 failures |
| 12 | เป็นมิตรกับระบบ CI/CD | ผ่าน | ไม่กระทบ production build |
