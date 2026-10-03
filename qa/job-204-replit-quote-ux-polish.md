# ใบงาน 204-R (Replit) — Studio Quote UX Polish: ปุ่มส่งแจ้งเตือนซ้ำ และป้ายยอดสุทธิ A4 (P3)

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit · เริ่มได้ทันที
**Branch:** `feat/replit-quote-ux-polish`
**วัตถุประสงค์:** แก้ 2 จุดจาก backlog: (1) ป้องกันลูกค้ากด "ส่งเข้า Telegram" ซ้ำในหน้าใบเสนอราคา หลังระบบส่งแจ้งเตือนอัตโนมัติไปแล้วจาก Studio (Job 196) (2) แก้บั๊ก P3 ที่ป้าย "จำนวนเงินสุทธิ" ใน PDF A4 รูปแบบ US ถูกตัดขึ้น 2 บรรทัด

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ในหน้า /quote/view (artifacts/knight-basins/src/App.tsx) เมื่อเปิดใบเสนอราคาที่ "ส่งแจ้งเตือนแล้ว" ให้แสดงสถานะปุ่มส่งแจ้งเตือนเป็น ส่งแล้ว และไม่ให้ยิงซ้ำ:
     - ถ้ามี query param notification แสดงข้อความสำเร็จอยู่แล้ว (เส้นทางจาก Studio/Quick Quote) ให้ปุ่มอยู่ในสถานะ disabled/ซ่อน พร้อมข้อความ "ส่งข้อมูลถึงทีมขายแล้ว" (ไม่เปลี่ยนข้อความสำเร็จเดิม)
     - ถ้าเปิดใบเสนอราคาเดิมโดยไม่มีพารามิเตอร์ ต้องยังกดส่งได้ตามปกติ (พฤติกรรมเดิม ห้ามตัดความสามารถ)
     - ห้ามเปลี่ยนสัญญา API หรือ endpoint /api/quotes/notify
  2. แก้ Print Layout A4 รูปแบบ US: ทำให้ป้าย "จำนวนเงินสุทธิ" อยู่ในบรรทัดเดียวกัน (ไม่ถูกตัดขึ้นบรรทัดใหม่) โดยแก้ที่ artifacts/knight-basins/src/index.css เฉพาะในบล็อก @media print ของ .formal-grand-total > span (เพิ่ม white-space: nowrap และปรับความกว้างขั้นต่ำของคอลัมน์ label เท่าที่จำเป็น) — ต้องไม่กระทบหน้าจอปกติ (screen) และไม่ทำให้ตัวเลขยอดเงินล้นหน้า
  3. ปลดล็อกเทสต์ P3 ใน artifacts/knight-basins/test/job-194-bug-hunt.test.ts (ลบตัวเลือก { todo: ... } ของเคส "A4 US grand-total label remains readable without wrapping") ให้เป็นเทสต์ที่ต้องผ่านจริง
  4. เพิ่ม static test ใน artifacts/knight-basins/test/quote-notify-guard.test.ts ตรวจว่าโค้ดมีเงื่อนไขกันการกดส่งซ้ำตามข้อ 1 และคงทางกดส่งไว้เมื่อไม่มีสถานะส่งแล้ว

SCOPE:
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/src/index.css (เฉพาะใน @media print ของ .formal-grand-total)
  - artifacts/knight-basins/test/job-194-bug-hunt.test.ts
  - artifacts/knight-basins/test/quote-notify-guard.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - กฎเหล็กของโปรเจกต์: src/index.css ถูกแช่แข็งทุกใบงาน — ใบนี้ได้รับอนุมัติให้แก้ได้เฉพาะในบล็อก @media print ของ .formal-grand-total เท่านั้น นอกนั้นต้อง 0 diff
  - ห้ามแตะต้องสูตรราคา ค่าบริการ ยอดรวม ภาษี และข้อความธุรกิจในใบเสนอราคา (ห้ามเปลี่ยนข้อความ "จำนวนเงินสุทธิ")
  - ห้ามเปลี่ยน Print Layout ของแบบ OF, ห้ามเปลี่ยนตารางสินค้า, ห้ามแตะلوgo/หัวกระดาษ/ท้ายเอกสาร
  - ห้ามแตะ artifacts/api-server/ และห้ามแก้ endpoint ใดๆ
  - ทำงานผ่าน branch: feat/replit-quote-ux-polish แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/replit-quote-ux-polish ชัดเจน
  2) git diff main...HEAD -- artifacts/knight-basins/src/index.css แสดงเฉพาะบรรทัดในบล็อก @media print ของ .formal-grand-total (แนบ diff จริงมาในรายงาน)
  3) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  4) node --test test/job-194-bug-hunt.test.ts test/quote-notify-guard.test.ts → ผ่านทุกข้อ (P3 ต้องไม่เป็น todo แล้ว)
  5) npm test ใน artifacts/knight-basins (non-browser suite) → เทียบตัวเลข pass/fail กับ baseline ปัจจุบัน
  6) เปิดหน้า /quote/view ใน preview และทดสอบพิมพ์ A4 รูปแบบ US: ป้ายจำนวนเงินสุทธิต้องอยู่บรรทัดเดียว และตัวเลขยอดเงินไม่ล้นหน้า

OUTPUT:
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/src/index.css
  - artifacts/knight-basins/test/job-194-bug-hunt.test.ts
  - artifacts/knight-basins/test/quote-notify-guard.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors เทสต์ผ่านครบ และแนบ diff ของ index.css มาแล้ว
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | กันกดส่งซ้ำ + แก้ P3 A4 |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 4 ไฟล์ ระบุขอบเขต CSS ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ล็อกการแก้ CSS เฉพาะบล็อก print |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | มีคำสั่งจริง + ต้องแนบ diff |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ผลลัพธ์ |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 30 turns |
| 7 | Replit SCOPE ใช้ path สัมพัทธ์ | ผ่าน | ไม่มี absolute path |
| 8 | Replit บังคับ GitHub Connection | ผ่าน | มีบรรทัดบังคับครบ |
| 9 | กำหนดข้อยกเว้น index.css ชัดเจน | ผ่าน | อนุญาตเฉพาะ @media print ของ .formal-grand-total |
| 10 | มี branch name ชัดเจน | ผ่าน | feat/replit-quote-ux-polish |
| 11 | มีเกณฑ์ตัวเลข | ผ่าน | 0 errors / P3 ปิด todo |
| 12 | เป็นมิตรกับ CI/CD | ผ่าน | ไม่กระทบ build |

---

## 📌 ข้อมูลอ้างอิงที่เดวิดตรวจแล้ว
* ปุ่มส่งแจ้งเตือนในหน้าใบเสนอราคาเดิม อ้างจาก Job 196: เมื่อลูกค้ายื่นจาก Studio ระบบยิงแจ้งเตือนอัตโนมัติแล้ว จึงเหลือเพียงกันการกดซ้ำ
* เทสต์ P3 ปัจจุบันอยู่ใน `test/job-194-bug-hunt.test.ts` บรรทัด 30–41 โดยคาดหวัง regex: `.formal-grand-total\s*>\s*span\s*\{[^}]*white-space:\s*nowrap` ภายในบล็อก `@media print`
* ข้อความ Labels ที่ห้ามแก้: "จำนวนเงินสุทธิ" (บรรทัด ~995 ของ App.tsx)
