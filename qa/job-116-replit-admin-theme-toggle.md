# ใบงาน 116 (Replit) — เฟส 1: ปุ่มสลับธีมสว่าง/มืดในหน้าหลังบ้าน (Admin Light / Dark Mode Toggle)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Admin UI & Theme System) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
คุณนพอนุมัติฟีเจอร์ **ประหยัดพลังงานด้วยการเลือกธีม** โดยย้ำชัดว่า *"เป็นการเลือกสลับไปมาได้ ไม่ได้บังคับว่าต้องเป็นแบบใดแบบหนึ่ง"*
เดวิดจึงแบ่งงานเป็น 2 เฟส และใบงานนี้คือ **เฟส 1 = หน้าหลังบ้าน `/admin` เท่านั้น** (ยังไม่แตะหน้าร้านสาธารณะและหน้า `/studio` / `/sketch`):

1. **ปุ่มสลับธีมบนแถบหัวหลังบ้าน (Admin Header):**
   * ใน `artifacts/knight-basins/src/admin/AdminApp.tsx` บริเวณ `admin-header` (ข้างป้ายสิทธิ์และปุ่มออกจากระบบ)
   * เพิ่มปุ่มไอคอน **`[ ☀️ / 🌙 ]`** (`data-testid="button-admin-theme-toggle"`) กดสลับ Light ⇄ Dark ได้ทันที
   * มี `aria-label` และ `title` อธิบาย เช่น "สลับโหมดสว่าง/มืด (ประหยัดพลังงาน)" และต้องกดง่ายบนมือถือ (สูง ≥ 40px)
2. **การจำค่าที่ผู้ใช้เลือก (Persist user choice):**
   * เก็บค่าที่เลือกไว้ใน `localStorage` คีย์ **`knight-admin-theme`** (ค่า `"light"` หรือ `"dark"`)
   * **ค่าเริ่มต้น = `"light"`** (โทนกระดาษเดิมของแบรนด์) เพื่อไม่ให้กระทบผู้ใช้เดิม
   * เปิดหน้าใหม่/รีเฟรชแล้ว ต้องได้ธีมเดิมที่ผู้ใช้เลือกไว้ทันที (ไม่กระพริบเป็นสีขาวก่อน)
3. **กลไกเปลี่ยนสีโดย "ไม่แตะไฟล์ `src/index.css`":**
   * ⚠️ ไฟล์ `src/index.css` ถูกแช่แข็งห้ามแก้ไขเด็ดขาด
   * ให้ใช้วิธี **CSS Variables Override แบบ Scoped**: สร้างคอมโพเนนต์/ฮุกที่ฉีดบล็อก `<style>` เฉพาะขอบเขตหลังบ้าน (แพตเทิร์นการฉีด `<style>` นี้มีอยู่แล้วในโปรเจกต์ เช่นใน `App.tsx` ฟังก์ชัน `Header`)
   * ตัวเลือกที่ปลอดภัยและแนะนำ: ใส่ attribute `data-admin-theme="dark"` ที่คอนเทนเนอร์ `.admin-app` แล้วกำหนดตัวแปรเฉพาะขอบเขตนั้น เช่น
     `.admin-app[data-admin-theme="dark"] { --paper: #0f172a; --ink: #e6edf3; --ink-soft: #a8b6c4; --line: #263449; ... }`
   * ต้องตรวจให้แน่ใจว่าองค์ประกอบหลักของหลังบ้าน (header, sidebar, การ์ด, ตาราง, ปุ่ม, input, badge) อ่านค่าจากตัวแปรชุดนี้และเปลี่ยนสีตามจริง ไม่มีจุดที่ตัวหนังสือจมพื้นหลัง (contrast อ่านออก)
4. **ขอบเขตที่ห้ามได้รับผลกระทบ:**
   * หน้าร้านสาธารณะทุกหน้า (`/`, `/stone`, `/portfolio`, `/site-prep`, `/quote`, `/sketch`, `/studio`, `/studio-guide`, `/readme`) **ต้องคงธีมสว่างเดิม 100%** ในเฟสนี้
   * สีหินสังเคราะห์และการพิมพ์ (Print) ต้องไม่ถูกแตะต้อง
5. **เขียน Automated Test ยืนยันใน `artifacts/knight-basins/test/admin-theme-toggle.test.ts` (ใหม่):**
   * ทดสอบว่ามีปุ่ม `button-admin-theme-toggle` พร้อม data-testid และ aria-label
   * ทดสอบคีย์ `localStorage` = `knight-admin-theme` และค่าเริ่มต้นเป็น `light`
   * ทดสอบการสลับค่า light ⇄ dark และการอ่านค่ากลับมาใช้ตอนเปิดหน้าใหม่
   * ทดสอบว่าบล็อกสไตล์ธีมถูก Scope ไว้ที่ `.admin-app` เท่านั้น (ไม่เป็น global ทั้งเว็บ)
   * ทดสอบว่า **ไม่มี** กฎธีมใดถูกเขียนลง `src/index.css` (ล็อกกฎการแช่แข็งไฟล์)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. สร้าง artifacts/knight-basins/src/admin/admin-theme.tsx (ใหม่):
     - ฮุก useAdminTheme() อ่าน/เขียน localStorage คีย์ knight-admin-theme (ค่าเริ่มต้น "light")
     - คอมโพเนนต์ <AdminThemeToggle /> ปุ่มสลับธีม data-testid="button-admin-theme-toggle"
     - ฉีดบล็อก <style> แบบ Scoped ภายใต้ .admin-app[data-admin-theme="dark"] (ห้ามแก้ index.css)
  2. ปรับปรุง artifacts/knight-basins/src/admin/AdminApp.tsx:
     - ติดตั้งปุ่มสลับธีมใน admin-header
     - ใส่ data-admin-theme ที่คอนเทนเนอร์ .admin-app ตามค่าที่ผู้ใช้เลือก
  3. สร้าง artifacts/knight-basins/test/admin-theme-toggle.test.ts (ใหม่):
     - ทดสอบปุ่ม, ค่าการจำใน localStorage, ค่าเริ่มต้น light, การสลับไป-กลับ
     - ทดสอบว่าธีมถูก Scope ที่ .admin-app และ index.css ไม่ถูกแก้

SCOPE:
  - artifacts/knight-basins/src/admin/admin-theme.tsx
  - artifacts/knight-basins/src/admin/AdminApp.tsx
  - artifacts/knight-basins/test/admin-theme-toggle.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง FormalQuotation.tsx, WorkshopProductionSheet.tsx, หรือหน้าพิมพ์รายงานใดๆ
  - ห้ามแตะต้องหน้าร้านสาธารณะและหน้า /studio /sketch /studio-guide ในเฟสนี้
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามเขียนกฎธีมแบบ global (ต้อง Scope เฉพาะ .admin-app เพื่อไม่ให้หน้าร้านเปลี่ยนสี)
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-admin-theme-toggle แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 485 / pass 463 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/admin-theme-toggle.test.ts ผ่าน 100%
  5) แนบภาพหน้าจอหน้า /admin 2 ภาพ: โหมดสว่าง และโหมดมืด (หลังกดปุ่มสลับธีม)

OUTPUT:
  - branch: feat/replit-admin-theme-toggle (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
  - ถ้าต้องแก้ไข src/index.css เพื่อให้ธีมทำงาน (ให้หยุดแล้วรายงานทันที — ต้องทำแบบ Scoped เท่านั้น)
  - ถ้าหน้าร้านสาธารณะเปลี่ยนสีตามธีมหลังบ้าน
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก + สัดส่วนคะแนน | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับ Replit | ✅ ผ่าน |
| 8 | มีข้อบังคับ GitHub Connection สำหรับ Replit | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง (ใช้ Scoped Style เท่านั้น) | ✅ ผ่าน |
| 11 | ต้องแนบภาพหน้าจอ 2 โหมดเป็นหลักฐาน | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขตและไม่กระทบหน้าร้านสาธารณะ | ✅ ผ่าน |
