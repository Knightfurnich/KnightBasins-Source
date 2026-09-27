# ใบงาน 120 (Replit) — เฟส 2: ปุ่มสลับธีมสว่าง/มืดบนหน้าร้านและหน้าลูกค้าสาธารณะ (Storefront Light / Dark Mode Toggle)

**วันที่:** 27 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** ร่างเตรียมไว้ (รอส่งหลัง Task 119 จบ)

**ที่มาและความต้องการ:**
ต่อยอดจาก **Task 116 (เฟส 1: ธีมมืดหลังบ้าน Admin)** ที่สำเร็จลุล่วงและบอสชอบมาก
ใบงานนี้คือ **เฟส 2: ขยายฟีเจอร์ Theme Switcher (☀️/🌙) สู่หน้าร้านและหน้าลูกค้าสาธารณะ** (เช่น หน้าแรก, แคตตาล็อก, `/portfolio`, `/site-prep`, `/sketch`, และ `/studio`) เพื่อประหยัดพลังงานหน้าจอมือถือ OLED และสบายตาในที่แสงน้อย โดยยึดหลัก **"ผู้ใช้สลับไปมาได้อย่างอิสระ ไม่บังคับโหมดใดโหมดหนึ่ง"**

**รายละเอียดงาน:**
1. **สร้างระบบ Storefront Theme Provider / Hook (`src/lib/theme.tsx` หรือ `src/components/theme-toggle.tsx`):**
   * เก็บค่าที่ผู้ใช้เลือกลงใน `localStorage` คีย์ **`knight-storefront-theme`** (ค่า `"light"` หรือ `"dark"`)
   * **ค่าเริ่มต้น = `"light"`** (คงเอกลักษณ์เดิมของแบรนด์ Knight Furnich)
   * รองรับการสลับไปมาระหว่าง Light ⇄ Dark ได้ทันที
2. **เพิ่มปุ่มสลับธีม `[ ☀️ / 🌙 ]` บน Header หลัก (`Header` ใน `artifacts/knight-basins/src/App.tsx`):**
   * วางในส่วน `header-actions` ข้างๆ ปุ่ม LINE Login / ตะกร้าใบเสนอราคา
   * มี attribute `data-testid="button-storefront-theme-toggle"`
   * มี `aria-label` และ `title` อธิบายชัดเจน รองรับการสัมผัสบนมือถือ (touch target ≥ 40px)
3. **การเปลี่ยนสีแบบ Scoped โดย "ไม่แตะไฟล์ `src/index.css`":**
   * ⚠️ ไฟล์ `src/index.css` ถูกแช่แข็งห้ามแก้ไขเด็ดขาด
   * ใช้กลไกใส่ attribute `data-theme="dark"` ที่ root container หรือ `<div className="app ...">`
   * ฉีด `<style>` แบบ Scoped เพื่อ override ตัวแปรสี เช่น
     `[data-theme="dark"] { --paper: #0f172a; --ink: #f1f5f9; --ink-soft: #94a3b8; --line: #334155; ... }`
4. **🛡️ กฎเหล็กคุ้มกันธุรกิจ 2 ข้อ (ห้ามฝ่าฝืนเด็ดขาด):**
   * **กระดานวาดผัง 2D Studio (`Canvas`) และถาดตัวอย่างสีหินจริง:** ต้องคงพื้นหลังสีสว่างเป็นกลางไว้เสมอ เพื่อป้องกันไม่ให้เฉดสีหินสังเคราะห์และแนวเส้นขอบเพี้ยนตา
   * **การพิมพ์ใบเสนอราคา (`@media print`):** ต้องพิมพ์เป็นพื้นขาวอักษรดำทางการเสมอ ห้ามติดสีมืดลงกระดาษ
5. **สร้าง Automated Unit Tests ใน `artifacts/knight-basins/test/storefront-theme-toggle.test.ts` (ใหม่):**
   * ทดสอบปุ่มสลับธีมบน Header
   * ทดสอบการบันทึกค่าใน `localStorage` (`knight-storefront-theme`)
   * ทดสอบการสลับ light ⇄ dark
   * ตรวจสอบว่า `src/index.css` ไม่ถูกแก้ไข

```
✅ มาตรฐานการออกใบงาน · 12/12 · 27 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. สร้าง artifacts/knight-basins/src/components/ThemeToggle.tsx (ใหม่) หรือโมดูลจัดการธีมหน้าร้าน
     - ฮุก useStorefrontTheme() จัดการ localStorage คีย์ knight-storefront-theme (ค่าเริ่มต้น "light")
     - คอมโพเนนต์ปุ่มสลับธีม data-testid="button-storefront-theme-toggle"
     - ฉีดสไตล์ Dark Mode แบบ Scoped ภายใต้ [data-theme="dark"] โดยไม่แตะ index.css
  2. ปรับปรุง artifacts/knight-basins/src/App.tsx:
     - ติดตั้งปุ่ม ThemeToggle ใน Header (header-actions)
     - ใส่ data-theme ที่คอนเทนเนอร์หลักของแอป
  3. สร้าง artifacts/knight-basins/test/storefront-theme-toggle.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/components/ThemeToggle.tsx · (ใหม่)
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/storefront-theme-toggle.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง FormalQuotation.tsx หรือ WorkshopProductionSheet.tsx
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามทำให้กระดานผัง 2D Studio หรือตัวอย่างสีหินเพี้ยน
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-storefront-theme-toggle แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 495 / pass 473 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/storefront-theme-toggle.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-storefront-theme-toggle (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
  - ถ้าต้องแก้ไข src/index.css เพื่อให้ฟีเจอร์ทำงาน
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
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง | ✅ ผ่าน |
| 11 | อนุรักษ์สีหินและกระดาน Canvas 2D Studio | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
