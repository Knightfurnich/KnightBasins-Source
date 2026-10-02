# ใบงาน 161 (Replit) — ปุ่มสอบถามรุ่นอ่างในหน้าแคตตาล็อก (Catalog Basin Inquiry Button)

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม) ร่วมกับคุณนพ (บอส)
**สถานะ:** มอบหมายให้ Replit — **ห้ามเริ่มก่อน PR ของ Task 160 จะ merge เข้า main** (ต้องใช้คอมโพเนนต์ InquiryModal ร่วมกัน)

**ที่มาและความต้องการ:**
ต่อจาก Task 160 (ปุ่มสอบถามจากหน้าผลงาน `/portfolio`) บอสต้องการขยายปุ่มเดียวกันนี้เข้า **หน้าแคตตาล็อกขายอ่าง (`/` quick-purchase mode)** ซึ่งเป็นหน้าที่มี "ความตั้งใจซื้อสูงสุด (High-Intent)" เพราะลูกค้าเห็นรุ่น (SKU) และราคาแคตตาล็อกอยู่แล้ว
เป้าหมายคือ ลูกค้าที่ไม่สะดวกกรอกฟอร์มใบเสนอราคายาว (QuotePage) จะมี "ช่องทางด่วน (Fast Lane)" ให้กดสอบถามรุ่นที่กำลังดูอยู่ได้ทันที โดยข้อมูลรุ่นอ่างถูกเติมอัตโนมัติ (Pre-filled) ช่วยให้ทีมขายรู้ทันทีว่าลูกค้าสนใจรุ่นไหน

**สิ่งที่ต้องทำ:**
1. **ปรับ `InquiryModal` ให้เป็นคอมโพเนนต์ใช้ร่วมกัน (Shared Component):**
   * ย้าย/ปรับคอมโพเนนต์จาก `PortfolioInquiryModal.tsx` (Task 160) ให้รับ prop `source: "portfolio" | "catalog"` และ prop ข้อมูลบริบทของสินค้า (sku / title / imageUrl / priceTHB)
   * เมื่อ `source === "catalog"` ให้แสดงราคาแคตตาล็อกของรุ่นนั้น และส่ง `sku` ไปกับ Payload ด้วย
   * **ห้ามทำสำเนา Modal 2 ชุด** (จะดูแลรักษายาก) — ให้ใช้คอมโพเนนต์เดียว
2. **เพิ่มปุ่มใน `src/App.tsx` (ProductCard):**
   * เพิ่มปุ่มลำดับที่ 4 แบบลิงก์รอง (secondary link) ต่อจากปุ่มเดิม 3 ปุ่ม:
     `[ 💬 สอบถามรุ่นนี้ ]` — `data-testid={`button-inquire-basin-${sku}`}`
   * ต้อง `event.stopPropagation()` เหมือนปุ่มอื่น (ห้ามให้การ์ด toggle เลือกสินค้าโดยไม่ตั้งใจ)
   * **ห้ามลบหรือแก้พฤติกรรมปุ่มเดิม 3 ปุ่ม:** `button-quote-basin-${sku}` · `link-basin-studio-${sku}` · `link-portfolio-basin-${sku}`
3. **เพิ่มปุ่มในหน้าใบเสนอราคา `QuotePage` (ทางด่วนสำหรับคนไม่อยากกรอกฟอร์ม):**
   * ข้อความ: `[ 💬 ให้ทีมโทรกลับ / ขอราคาเร็ว ]` — `data-testid="button-inquire-fast-lane"`
4. **Payload ที่ส่งไป `POST /api/public/portfolio/inquiry`:**
   * เพิ่มฟิลด์ `source` (`"catalog"`) และ `sku` เข้าไปใน Body
   * ฝั่งหลังบ้าน (เดวิด) จะจัดการส่งการ์ดแจ้งเตือนเข้า Telegram ของบอส พร้อมรุ่นอ่าง + ราคาแคตตาล็อก
5. **อัปเดตเทสต์:** เพิ่มเคสใน `test/portfolio-inquiry.test.ts` (หรือไฟล์เทสต์ใหม่ตามที่ใบงาน 160 กำหนด) ตรวจว่ามี `button-inquire-basin-` และ `button-inquire-fast-lane` อยู่ใน source จริง

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด & คุณนพ

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ปรับคอมโพเนนต์ตามใบงาน 160 ให้ใช้ร่วมกันได้ระหว่าง /portfolio และหน้าแคตตาล็อก (เพิ่ม prop source + sku + priceTHB)
  2. เพิ่มปุ่ม button-inquire-basin-${sku} ใน ProductCard (artifacts/knight-basins/src/App.tsx)
  3. เพิ่มปุ่ม button-inquire-fast-lane ใน QuotePage
  4. ส่ง source และ sku ไปกับ POST /api/public/portfolio/inquiry
  5. อัปเดต Unit Tests ให้ครอบคลุมปุ่มใหม่

SCOPE:
  - artifacts/knight-basins/src/components/PortfolioInquiryModal.tsx
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/portfolio-inquiry.test.ts

FORBIDDEN:
  - ห้ามเริ่มงานนี้ก่อน PR ของ Task 160 (feat/replit-portfolio-inquiry) merge เข้า main แล้ว
  - ห้ามแตะต้อง src/components/WorkshopProductionSheet.tsx เด็ดขาด (ไฟล์สงวนโดยบอส)
  - ห้ามแตะต้อง src/index.css, StudioPage.tsx
  - ห้ามลบหรือเปลี่ยนพฤติกรรมปุ่มเดิม 3 ปุ่มบนการ์ดสินค้า (button-quote-basin-, link-basin-studio-, link-portfolio-basin-)
  - ห้ามแตะ backend หรือ artifacts/api-server/ (เดวิดดูแลเอง)
  - เขียนเทสต์แบบ Static Source Inspection (readFileSync) เท่านั้น ห้าม dynamic import คอมโพเนนต์
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-catalog-inquiry แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: non-browser tests ต้องผ่าน 100% (581+ ผ่าน)
  4) ตรวจว่า diff ไม่มีไฟล์ src/index.css และปุ่มเดิม 3 ปุ่มยังอยู่ครบ

OUTPUT:
  - branch: feat/replit-catalog-inquiry (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า PR ของ Task 160 ยังไม่ merge เข้า main
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
| 11 | ล็อกให้ใช้คอมโพเนนต์เดียว ไม่ทำสำเนา Modal | ✅ ผ่าน |
| 12 | อนุรักษ์ปุ่มเดิมบนการ์ดสินค้า 3 ปุ่ม | ✅ ผ่าน |
