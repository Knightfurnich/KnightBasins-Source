# ใบงาน 228 (Studio UI Polish) — ซ่อนช่องกรอกส่วนลดและราคาขอบเปิดสำหรับลูกค้าทั่วไปในหน้า Studio

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead) · **อนุมัติโดย:** บอส (คุณนพ)
**สถานะ:** มอบหมายให้ Replit · งานปรับปรุงหน้าบ้าน (UI Polish)
**Branch:** `feat/replit-studio-hide-client-discount-inputs`
**ที่มา:** บอสได้มีคำตัดสินเด็ดขาดว่า "ลูกค้าทั่วไปไม่มีสิทธิ์กำหนดส่วนลด (discountTHB) หรือราคาขอบเปิด (openEdgePricePerMTHB) เอง" ดังนั้นในหน้าจอ 2D Studio จึงไม่ควรมีช่องกรอกสองช่องนี้แสดงให้ลูกค้าสาธารณะเห็น (ควรแสดงเฉพาะกรณีที่เป็นโหมดเจ้าหน้าที่/แอดมินแก้ไขแบบให้ลูกค้า `isLeadLinkedMode` เท่านั้น) เพื่อให้หน้าตาสะอาดตาและสอดคล้องกับตรรกะความปลอดภัยทางการเงินฝั่งเซิร์ฟเวอร์

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/knight-basins/src/components/StudioPage.tsx:
     - ในส่วน studio-pricing-inputs (~บรรทัด 5100-5109):
       - ช่องกรอก "ความสูงบัว (มม.)" (upstandHeightMm) ยังคงแสดงให้ลูกค้าทั่วไปปรับได้ตามปกติ
       - ช่องกรอก "ราคาขอบเปิด / ม." (openEdgePricePerMTHB) และ "ส่วนลด (บาท)" (discountTHB):
         - ซ่อนไม่ให้แสดงสำหรับลูกค้าสาธารณะทั่วไป
         - จะแสดงให้กรอกได้เฉพาะเมื่ออยู่ในโหมดแอดมิน/ช่างแก้ไขแบบ (isLeadLinkedMode === true) เท่านั้น
       - เมื่อลูกค้าทั่วไปใช้งาน ให้รีเซ็ตค่า discountTHB เป็น 0 หรือ null ใน state เสมอ
  2. ชุดทดสอบ:
     - artifacts/knight-basins/test/studio-hide-discount-inputs.test.ts:
       - ทดสอบว่าเมื่อเปิดหน้า Studio ในโหมดสาธารณะทั่วไป (isLeadLinkedMode = false) จะต้องไม่มีช่อง input data-testid="input-studio-discount" และ "input-studio-open-edge-price" แสดงใน DOM
       - ทดสอบว่าช่อง "ความสูงบัว (มม.)" (input-studio-upstand-height) ยังคงแสดงตามปกติ
       - ทดสอบว่าเมื่อเปิดในโหมดแอดมินแก้ไขแบบ (isLeadLinkedMode = true) ช่องทั้งหมดยังคงแสดงให้เจ้าหน้าที่กรอกได้

SCOPE:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/test/studio-hide-discount-inputs.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff) (ใช้ Tailwind / JSX inline conditional rendering)
  - ห้ามซ่อนช่อง "ความสูงบัว (มม.)" (ลูกค้าต้องเลือกความสูงบัวได้)
  - ห้ามทำให้ฟังก์ชันการคำนวณราคาของ Studio พัง

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/replit-studio-hide-client-discount-inputs ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) node --test test/studio-hide-discount-inputs.test.ts ใน knight-basins → ผ่านทุกข้อ (ระบุจำนวน)
  4) npm test ใน artifacts/knight-basins (non-browser suite baseline: 936 ผ่าน / 0 ตก / 7 ข้าม)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/test/studio-hide-discount-inputs.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และชุดทดสอบที่ระบุผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ซ่อนช่องส่วนลดและราคาขอบเปิดสำหรับลูกค้าทั่วไป |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 2 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | index.css 0 diff, คงช่องความสูงบัวไว้ |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline 936 ข้อจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | Replit |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ทำตามคำตัดสินบอสเรื่องส่วนลดลูกค้า |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ให้เฉพาะแอดมินเห็นช่องส่วนลด |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 228 เรียบร้อย |
