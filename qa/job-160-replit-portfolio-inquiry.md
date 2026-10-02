# ใบงาน 160 (Replit) — ปุ่มสั่งผลิต/ขอราคาจากรูปผลงานจริงพร้อมกล่องขอข้อมูลติดต่อ (/portfolio Direct Inquiry Modal UI)

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม) และคุณนพ (บอส)
**สถานะ:** มอบหมายให้ Replit (Frontend / Portfolio Direct Inquiry UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
เพื่อเปลี่ยนหน้าคลังภาพผลงานติดตั้งจริง (`/portfolio`) ให้กลายเป็นช่องทางปิดการขายโดยตรง (Direct Sales Channel) ตามแนวทางของบอส:
เมื่อลูกค้าเข้ามาดูภาพผลงานสวยๆ ของ Knight Furnich แล้วถูกใจ ให้สามารถกดสั่งผลิตหรือสอบถามราคาจากรูปภาพนั้นได้ทันที โดยไม่ต้องแคปหน้าจอไปถาม
โดยระบบจะมีกล่องป๊อปอัปสั้น กระชับ ไม่สร้างความยุ่งยากให้ลูกค้า (Zero Friction):
1. **ปุ่มบนการ์ดผลงานในหน้า `/portfolio` (`src/pages/PortfolioPage.tsx`):**
   * ใต้รูปภาพหรือบนการ์ดผลงานแต่ละชิ้น และในมุมมองดูภาพขนาดใหญ่ (Lightbox Modal):
     - เพิ่มปุ่มเด่นชัด: `[ 💬 สั่งผลิตแบบนี้ / ขอราคา ]` (data-testid={`button-inquire-portfolio-${photo.id}`})
2. **หน้าต่างป๊อปอัปขอข้อมูล (`PortfolioInquiryModal.tsx` ใหม่):**
   * แสดงรูปขนาดย่อและชื่อของผลงานที่ลูกค้าเลือก (`data-testid="modal-portfolio-inquiry"`)
   * ช่องกรอกข้อมูลจำเป็น:
     - **เบอร์โทรศัพท์ (จำเป็น):** `data-testid="input-inquiry-phone"` (placeholder="เช่น 081-xxx-xxxx")
     - **ชื่อเล่น / ชื่อผู้ติดต่อ (ตัวเลือก):** `data-testid="input-inquiry-name"`
     - **บันทึกเพิ่มเติม / สถานที่ติดตั้ง (ตัวเลือก):** `data-testid="input-inquiry-notes"` (placeholder="เช่น คอนโดสุขุมวิท / ขนาดที่ต้องการ")
   * **ปุ่มกดส่งข้อมูล:**
     - ปุ่ม `[ 🚀 ส่งข้อมูลให้ทีมประเมินราคา ]` (`data-testid="button-submit-inquiry"`)
     - มีสถานะ Loading (Spinner) ขณะกำลังส่งข้อมูล
     - เมื่อส่งสำเร็จ: แสดงข้อความขอบคุณน่ารักๆ "ทีมงาน Knight Furnich ได้รับข้อมูลแล้ว จะติดต่อกลับอย่างรวดเร็วที่สุดครับ" พร้อมปุ่มปิด
   * **ทางเลือกเชื่อมต่อ LINE:**
     - มีปุ่มทางเลือก: `[ 🟢 ทักคุยผ่าน LINE พร้อมส่งรูปนี้ทันที ]` (`data-testid="button-inquire-line"`) ซึ่งเปิดลิงก์ไปยัง LINE OA `@789gcnhq`
3. **การส่งข้อมูลเข้า Backend API:**
   * เรียก `POST /api/public/portfolio/inquiry` (Payload: `{ photoId, photoTitle, photoUrl, phone, name, notes }`)
   * หาก API คืนสถานะ 200/201 ➔ แสดงสถานะสำเร็จใน Modal
4. **เขียน Static Source Tests ใน `test/portfolio-inquiry.test.ts` (ใหม่):**
   * ตรวจสอบปุ่ม `button-inquire-portfolio-` ใน `PortfolioPage.tsx`
   * ตรวจสอบฟิลด์ input ต่างๆ ใน `PortfolioInquiryModal.tsx` ด้วย `readFileSync` (Static Source Inspection)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด & คุณนพ

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. สร้างคอมโพเนนต์ artifacts/knight-basins/src/components/PortfolioInquiryModal.tsx:
     - modal-portfolio-inquiry, input-inquiry-phone, input-inquiry-name, input-inquiry-notes, button-submit-inquiry, button-inquiry-line
     - ส่ง POST /api/public/portfolio/inquiry
  2. เพิ่มปุ่มใน artifacts/knight-basins/src/pages/PortfolioPage.tsx:
     - button-inquire-portfolio-${photo.id} ทั้งบนการ์ดและใน Lightbox
  3. เขียนเทสต์ใน artifacts/knight-basins/test/portfolio-inquiry.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/components/PortfolioInquiryModal.tsx
  - artifacts/knight-basins/src/pages/PortfolioPage.tsx
  - artifacts/knight-basins/test/portfolio-inquiry.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง src/components/WorkshopProductionSheet.tsx เด็ดขาด (ไฟล์สงวนโดยบอส)
  - ห้ามแตะต้อง src/index.css, App.tsx, StudioPage.tsx
  - ห้ามแตะ backend หรือ artifacts/api-server/
  - เขียนเทสต์แบบ Static Source Inspection (readFileSync) เท่านั้น ห้าม dynamic import คอมโพเนนต์
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-portfolio-inquiry แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: non-browser tests ต้องผ่าน 100% (581+ ผ่าน)
  4) เทสต์ใน test/portfolio-inquiry.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-portfolio-inquiry (เปิด PR เข้า main)
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
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ใช้ path สัมพัทธ์สำหรับ Replit | ✅ ผ่าน |
| 8 | มีข้อบังคับ GitHub Connection สำหรับ Replit | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง | ✅ ผ่าน |
| 11 | อนุรักษ์โครงสร้างหน้าจอ Portfolio เดิม | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
