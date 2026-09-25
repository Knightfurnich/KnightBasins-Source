# ใบงาน 71 (Replit) — ยกเครื่องจัด Layout หน้า "ส่งแบบร่างด้วยมือ" (/sketch) เป็น 3-Step Guided Flow

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (UI & Components Specialist)

**ความต้องการ:** 
เจ้าของระบบ (คุณนพ) ต้องการให้ยกเครื่องหน้า "ส่งแบบร่างด้วยมือ" (`/sketch` หรือ `mode === "sketch"`) ใหม่ทั้งหมด เนื่องจาก Layout เดิมมีช่องว่างสีขาวขนาดใหญ่ทางขวา และกล่องอัปโหลดรูปภาพที่เป็นหัวใจหลักของหน้าถูกบีบไปอยู่มุมขวาบน:
1. **STEP 1: แนบภาพแบบร่าง / รูปถ่ายหน้างาน (Hero Section กว้างเต็มจอ 100%):**
   - ย้ายกล่องอัปโหลดภาพแบบร่าง (`.studio-sketch-panel`) ขึ้นมาเป็นแถวแรกกว้างเต็มจอ (Full-Width) ทันทีใต้ Hero / Bridge Banner
   - มี Dropzone ขนาดใหญ่ สวยงาม รองรับการลากไฟล์มาวาง (Drag & Drop) หรือคลิกเพื่อเลือกไฟล์
   - แสดงช่องพรีวิวภาพแบบร่างทั้ง 5 ช่องเรียงแนวนอนอย่างลงตัว มีปุ่มกากบาท `✕` ลบรูป และปุ่ม `[+] เพิ่มรูป`
   - *สำคัญ:* ต้องคง `data-testid` เดิมครบถ้วน (`input-studio-sketch`, `grid-studio-sketch-slots`, `slot-studio-sketch-${index}`, `img-studio-sketch-preview-${index}`, `button-remove-studio-sketch-${index}`, `button-add-studio-sketch-${index}`) เพื่อไม่ให้เทสต์เดิมพัง
2. **STEP 2: สเปกที่สนใจ (ทางเลือกเพิ่มเติม / Optional - 2 คอลัมน์สมดุล):**
   - จัดวางส่วนเลือกสีหิน (`01 / MATERIAL SHORTLIST`) และเลือกรุ่นอ่าง (`02 / BASIN SHORTLIST`) เป็น 2 คอลัมน์เคียงข้างกันในความสูงที่กระชับสมดุล
   - มีข้อความแนะนำชัดเจนว่า *"เลือกสเปกที่สนใจเบื้องต้น (ไม่บังคับ) เพื่อให้ทีมงานช่วยวางผังให้ตรงรุ่น หรือปล่อยว่างเพื่อให้ทีมงานช่วยแนะนำ"*
3. **STEP 3: ข้อมูลติดต่อ & สรุปส่งแบบร่าง (2 คอลัมน์ด้านล่าง):**
   - คอลัมน์ซ้าย: ข้อมูลผู้ติดต่อและสถานที่ติดตั้ง (`04 / PROJECT DETAILS`)
   - คอลัมน์ขวา: การ์ดประเมินราคาเบื้องต้น & ปุ่มส่งแบบร่าง (`LIVE ESTIMATE`) เด่นชัด พร้อมปุ่ม `[ 🚀 ส่งภาพแบบร่างให้ทีมขายประเมินราคา ]` (`button-submit-sketch`)
4. **ลบช่องว่างสีขาว (Dead Space):** ปรับ CSS Grid/Flexbox ให้ทุกแถวเชื่อมต่อกันอย่างต่อเนื่อง ไม่มีช่องว่างแหว่งบนทั้งเดสก์ท็อปและมือถือ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ใน artifacts/knight-basins/src/components/StudioPage.tsx:
     - เมื่อ mode === "sketch":
       * ปรับลำดับการแสดงผลของ layout ให้เป็น 3 สเต็ป:
         1) STEP 1: Hero Dropzone แนบภาพแบบร่าง (studio-sketch-panel) กว้างเต็มความกว้าง 100%
         2) STEP 2: กล่องเลือกสีหินและเลือกรุ่นอ่าง (shortlists) 2 คอลัมน์สมดุล
         3) STEP 3: ข้อมูลติดต่อ (studio-contact-panel) และการ์ดสรุปราคา/ปุ่มส่ง (estimatePanel)
       * รักษา data-testid เดิมของ sketch components ไว้ครบทุกตัว
  2. ใน artifacts/knight-basins/src/index.css:
     - เพิ่ม/ปรับปรุง CSS สำหรับ .studio-page--sketch หรือโครงสร้าง sketch layout ใหม่:
       * .studio-sketch-panel เต็มความกว้าง มี dropzone border สวยงาม
       * shortlists ในโหมด sketch เป็น 2 คอลัมน์ความสูงพอดี ไม่ยืดยาวเกินไป
       * รองรับ Mobile Responsive บนหน้าจอมือถือ (เรียงเป็น 1 คอลัมน์ต่อเนื่อง)
  3. ใน artifacts/knight-basins/test/sketch-page-redesign.test.ts (ใหม่):
     - เขียน Node-native unit tests ตรวจสอบว่าโหมด sketch แสดงผลครบทั้ง 3 ส่วน และคง data-testid หลักครบถ้วน

SCOPE:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/src/index.css
  - artifacts/knight-basins/test/sketch-page-redesign.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง WorkshopProductionSheet.tsx เด็ดขาด
  - ห้ามแตะต้อง @media print, .formal-*, .workbench-* ใน App.tsx
  - ห้ามแตะต้อง lib/db/schema หรือ backend API
  - ห้ามกระทบหน้า 2D Studio ปกติ (mode === "studio")
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-sketch-page-redesign แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 343 / pass 337 / fail 2 / cancelled 3 / skipped 1 (non-browser tests ผ่าน 100%)
  4) เทสต์ใหม่ใน sketch-page-redesign.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-sketch-page-redesign (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน baseline เดิม (fail > 2)
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
| 10 | กำหนดชื่อ branch และ PR ชัดเจน | ✅ ผ่าน |
| 11 | ทดสอบการคงอยู่ของ data-testid และเลย์เอาต์ใหม่ | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์ Print Layout หรือ Quotation Core | ✅ ผ่าน |
