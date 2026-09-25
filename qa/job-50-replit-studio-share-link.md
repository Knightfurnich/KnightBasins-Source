# ใบงาน 50 (Replit) — ปุ่มคัดลอกลิงก์แชร์ผังเคาน์เตอร์ 2D Studio (1-Click Shareable Studio Link)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** หลังจากที่มีปุ่มบันทึกภาพ PNG แล้ว ทีมขายต้องการส่งต่อลิงก์ผังเคาน์เตอร์ที่ออกแบบใน Studio ไปให้ลูกค้าหรือช่างเปิดดูบนมือถือ/คอมพิวเตอร์ได้ทันที โดยเมื่อคลิกลิงก์จะเปิดหน้า Studio พร้อมอ่าง สีหิน และขนาดที่ตั้งไว้ตรงกันเป๊ะ

```
⛔ ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal
และห้ามเด้งกล่องถามเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  เพิ่มปุ่มคัดลอกลิงก์แชร์ผังเคาน์เตอร์ใน 2D Studio:
  1. เพิ่มปุ่ม `[ 🔗 คัดลอกลิงก์ผังนี้ ]` วางข้างปุ่ม `[ 📷 บันทึกผังเป็นรูปภาพ (PNG) ]` ในหน้า Studio (มองเห็นได้ทั้งโหมดง่ายและโหมดปกติ)
  2. เมื่อคลิกปุ่ม ให้สร้าง URL พร้อมพารามิเตอร์ปัจจุบัน (เช่น `basin`, `stone`, `width`, `shape`) แล้วคัดลอกลง Clipboard ด้วย `navigator.clipboard.writeText`
  3. แสดงข้อความสถานะ `✓ คัดลอกลิงก์แล้ว` ชั่วคราว 2 วินาที
  4. เมื่อเปิดหน้าเว็บด้วย URL ที่มีพารามิเตอร์เหล่านี้ ให้ดึงค่ามาตั้งต้นใน Studio ให้ตรงกัน

SCOPE (relative path — Replit):
  1. artifacts/knight-basins/src/components/StudioPage.tsx
  2. artifacts/knight-basins/src/index.css

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ App.tsx หรือ WorkshopProductionSheet.tsx
  - ห้ามแตะ @media print, .formal-*, .workbench-*
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/replit-studio-share-link แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) npm run typecheck -> 0 errors ใน @workspace/knight-basins
  3) npm test (ใน artifacts/knight-basins)
     baseline อ้างอิง: tests 226 / pass 221 / fail 2 / cancelled 3 (non-browser tests ผ่าน 100%)
  4) ภาพถ่ายหน้าจอ 2 รูป:
     - หน้า Studio แสดงปุ่ม `[ 🔗 คัดลอกลิงก์ผังนี้ ]` ข้างปุ่ม PNG
     - ภาพตอนคลิกแล้วแสดงสถานะ `[ ✓ คัดลอกลิงก์แล้ว ]`

OUTPUT:
  - branch: feat/replit-studio-share-link (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error TS
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. ใน StudioPage.tsx:
     - ปุ่มแชร์วางในกลุ่มเดียวกับปุ่ม PNG (`studio-export-toolbar` หรือส่วนหัวของผัง):
       ```tsx
       <button
         type="button"
         className="button button--outline studio-share-button"
         onClick={handleShareLink}
         data-testid="button-studio-share-link"
       >
         {copiedLink ? <><Check size={14} className="text-[#17816d]" /> คัดลอกลิงก์แล้ว</> : <><Link2 size={14} /> คัดลอกลิงก์ผังนี้</>}
       </button>
       ```
     - URL สร้างขึ้นจาก: `window.location.origin + window.location.pathname + ?basin=${sku}&stone=${activeStone}&width=${width}`
  2. ใน index.css:
     - จัดสไตล์ `.studio-share-button` ให้เข้าชุดกับปุ่ม PNG สะอาดตา
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ ปุ่มคัดลอกลิงก์แชร์ผัง 2D Studio |
| 2 | GOAL วัดได้ | ✅ ปุ่มแชร์ + copy URL + restore params + เทสต์ |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 2 ไฟล์ relative Replit เข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ Print CSS, ห้ามแตะ App.tsx |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ typecheck + npm test 226/221/2 |
| 6 | OUTPUT ชัด | ✅ branch feat/replit-studio-share-link |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน fail > 2 |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 226 / pass 221 / fail 2 |
| 9 | CONTRACT ระบุโค้ดปุ่มและพารามิเตอร์ชัด | ✅ query params และ JSX ชัดเจน |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (Replit = relative) | ✅ relative path ทั้งหมด |
