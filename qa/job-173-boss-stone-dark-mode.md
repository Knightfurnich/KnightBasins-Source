# ใบงาน 173 (บอส / Claude Code) — แก้ไข Contrast สีตัวอักษรและพื้นหลังในโหมดมืด (Dark Mode) ของหน้า /stone ทั้งหน้า

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ บอส / ชัย (Claude Code CLI / Frontend Maintenance) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
เมื่อผู้ใช้สลับเป็นโหมดมืด (Dark Mode) บนหน้า `/stone` (แคตตาล็อกหินสังเคราะห์):
1. ส่วน Hero หัวเว็บ (`หินสังเคราะห์ตามพื้นที่ของคุณ`) ตัวหนังสือกลายเป็นสีขาวอ่อน ลอยอยู่บนพื้นหลังสีขาวอมฟ้าของ `body` ทำให้อ่านไม่ออก
2. กล่องปุ่มเลือกรูปแบบ (`แผ่นเต็ม` / `ตัดและติดตั้ง`) พื้นหลังเป็นสีขาว ตัวหนังสือสีขาว ทำให้อ่านไม่ออก
3. การ์ดชาร์ตสีหินสังเคราะห์ทั้ง 74 สี (`.stone-colors button`) มีพื้นหลังเป็นสีขาวขุ่น `rgba(255,255,255,.72)` แต่ตัวหนังสือชื่อสี รหัสสี และราคา ถูกสลับเป็นสีขาวสว่าง ทำให้กลืนไปกับพื้นหลังสีขาวของการ์ดทั้งหมด มองไม่เห็นชื่อและราคา
4. แถบตัวกรองราคา (`.stone-price-filters`) และกล่องสรุปการกำหนดค่า (`.config-summary`) ยังไม่ได้ปรับสีในโหมดมืด

**รายละเอียดสิ่งที่ต้องทำ:**
1. แก้ไขใน `artifacts/knight-basins/src/components/ThemeToggle.tsx` ภายในบล็อก `STOREFRONT_THEME_STYLES` (ใต้ส่วน `[data-theme="dark"]`):
   - กำหนดให้ `.storefront-theme-root` เมื่ออยู่ใน `[data-theme="dark"]` มี `background-color: var(--paper)` เพื่อให้พื้นหลังทั้งหน้าเป็นสีมืด `#0f172a`
   - กำหนดสีตัวอักษรของ `:is(.stone-hero, .stone-page, .config-layout)` ให้เป็น `var(--ink)` และหัวข้อ `.stone-hero h1` ให้เป็น `#ffffff`
   - ปรับแต่งปุ่มเลือกรูปแบบ `.mode-switch button`: พื้นหลัง `var(--card-paper)` ขอบ `var(--line)` สีตัวอักษร `var(--ink-soft)` (เมื่อ active ให้ขอบเป็น `var(--brand-blue)` และตัวอักษร `var(--ink)`)
   - ปรับแต่งการ์ดสีหิน `.stone-colors button`: พื้นหลัง `var(--card-paper)` ขอบ `var(--line)` สีตัวอักษร `var(--ink)` (เมื่อ hover/active ให้ขอบเป็น `var(--brand-blue)`)
   - ปรับแต่งแถบตัวกรองราคา `.stone-price-filters`: พื้นหลัง `var(--card-paper)` ขอบ `var(--line)` ตัวอักษร `var(--ink-soft)` (เมื่อ active ให้พื้นหลังเป็น `var(--brand-blue)` ตัวอักษร `#ffffff`)
   - ปรับแต่งกล่องสรุป `.config-summary`: พื้นหลัง `var(--card-paper)` ขอบ `var(--line)` ตัวอักษร `var(--ink)`
2. เพิ่ม Unit Test ใน `artifacts/knight-basins/test/stone-page-dark-mode.test.ts` (ไฟล์ใหม่):
   - ตรวจสอบว่าใน `STOREFRONT_THEME_STYLES` มีการประกาศสไตล์โหมดมืดสำหรับ `.stone-colors button`, `.mode-switch button`, `.config-summary`, และ `.stone-price-filters`
   - ตรวจสอบว่า `.storefront-theme-root` มี `background-color: var(--paper)` ในโหมดมืด

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด

GOAL:
  1. แก้ไข Contrast ในโหมดมืดของหน้า /stone ทั้งหน้า (Hero, Mode switch, Stone color cards 74 สี, Price filters, Config summary)
  2. แก้ไขใน artifacts/knight-basins/src/components/ThemeToggle.tsx ในบล็อก STOREFRONT_THEME_STYLES เท่านั้น
  3. สร้างไฟล์ทดสอบ artifacts/knight-basins/test/stone-page-dark-mode.test.ts (ใหม่)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/components/ThemeToggle.tsx
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/stone-page-dark-mode.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามแตะต้อง Formal Quotation print layout
  - ห้ามเปลี่ยนสี swatch หรือแผ่นชิปตัวอย่างหินจริง (.stone-card-image-wrap) ต้องคงสีแท้ไว้
  - เขียนเทสต์แบบ Static Source Inspection (readFileSync)
  - ทำงานผ่าน worktree หรือ branch: feat/chai-stone-dark-mode แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง branch ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) npm test ใน artifacts/knight-basins
     baseline อ้างอิง: tests 660 / pass 620 / fail 0 / cancelled 0 / skipped 40
  4) เทสต์ใหม่ใน test/stone-page-dark-mode.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/chai-stone-dark-mode (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
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
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ใช้ path สมบูรณ์สำหรับ Claude Code CLI | ✅ ผ่าน |
| 8 | มีข้อกำหนด branch และ PR ชัดเจน | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง | ✅ ผ่าน |
| 11 | อนุรักษ์ Print Layout และสีตัวอย่างหินแท้ | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
