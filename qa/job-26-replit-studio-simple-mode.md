# ใบงานที่ 26 (Replit) — โหมดง่ายสำหรับหน้า Studio

**ความต้องการเจ้าของ:** หน้าทำแบบ "ยุ่งยาก/เบื่อ/อ่านไม่ออก" — ต้องการทำแบบง่าย ๆ ให้ได้ราคาท็อป+อ่างโดยไม่ต้องตั้งค่าละเอียด
**Branch:** `feat/replit-studio-simple-mode` (สร้างใหม่จาก main ล่าสุด)

ส่งเป็นสตริงเดียวให้ Replit

```
✅ มาตรฐานการออกใบงาน · 12/12 · 24 ก.ย. 69 · เดวิด
⛔ ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal
   และห้ามเด้งกล่องถามเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL      : เพิ่ม "โหมดง่าย" ในหน้า /studio — ผู้ใช้เห็นแค่ สี · รูปทรง+ขนาด · อ่าง · บัว
            แล้วได้ผัง + ราคาทันที โดยไม่ต้องตั้งค่าแผ่น/รอยต่อ/X-Y/ทิศทางต่อ/สถานะขอบเอง
            โหมดละเอียดเดิมต้องยังอยู่ครบ (สลับกลับได้)

SCOPE     : artifacts/knight-basins/src/components/StudioPage.tsx
            artifacts/knight-basins/src/index.css
            (path เป็น path สัมพัทธ์จาก root ของ repo · ห้ามแตะไฟล์อื่น)

FORBIDDEN : ห้ามแก้ artifacts/knight-basins/src/data/studio-model.ts (engine ราคา/เรขาคณิต)
            ห้ามแก้ lib/api-client-react/** · lib/api-zod/** · lib/api-spec/** (generated)
            ห้ามแก้ App.tsx (print layout ใบเสนอราคา) · WorkshopProductionSheet.tsx
            ห้ามลบความสามารถเดิมทิ้ง — ต้องสลับกลับโหมดละเอียดได้ครบ
            ห้ามใส่ข้อมูลตัวอย่าง/ข้อมูลจำลอง
            ห้าม push เข้า main ตรง ๆ

EVIDENCE  : 1) branch อิงจาก main ล่าสุด — แนบผล git log -1
            2) npx pnpm run typecheck จาก root -> 0 errors
            3) PORT=3000 npx pnpm run --filter @workspace/knight-basins build
               -> ผ่าน + verify-production-assets OK
            4) cd artifacts/knight-basins && npm test
               เกณฑ์ผ่าน: **ต้องไม่มี fail นอกไฟล์ *.browser.test.ts**
               (ไฟล์ *.browser.test.ts เป็นข้อจำกัดของ environment — ยอมรับ fail ได้)
               baseline อ้างอิง (วัดเองบน main ก่อนเริ่ม): tests 189 / pass 185 / fail 2
               และเฉพาะไฟล์ที่ไม่ใช่ browser: 50 / 50 / 0
            5) screenshot โหมดง่าย (ค่าเริ่มต้น) — ต้องเห็นแค่ สี/รูปทรง+ขนาด/อ่าง/บัว + ผัง + ราคา
               และต้องไม่เห็น ชื่อชิ้นงาน/X-Y/ทิศทางต่อ/สถานะขอบ/ปุ่มเพิ่มแผ่น
            6) screenshot โหมดละเอียด — ต้องเห็นคอนโทรลเดิมครบเหมือนก่อนแก้
            7) ทดสอบจริง: กด "ทรงฉาก L ขวา" -> ระบบสร้าง 2 แผ่นให้เอง (แนบภาพ)
               แล้วใส่ 2020 / 940 / ลึก 620 -> พื้นที่รวมต้องได้ 1.4508 m² (ยอมรับ 1.45)
            8) branch + commit hash ที่ส่งกลับ

OUTPUT    : ลิงก์ branch · commit hash · ไฟล์ที่แก้ + จำนวนบรรทัด · หลักฐาน 1-8

STOP      : หยุดแล้วรายงานถ้า (ก) typecheck ไม่ผ่านแก้ไม่ได้ใน 1 รอบ (ข) build ไม่ผ่าน
            (ค) มี fail นอกไฟล์ *.browser.test.ts
            ห้ามเดาต่อ ห้ามใส่ mock data ห้ามแก้ไฟล์นอก SCOPE

CONTRACT (ทำตามนี้ ไม่ต้องเดา):

1) เพิ่ม UI state โหมด: "simple" | "detailed" — ค่าเริ่มต้น "simple"
   * เป็น state ของ UI เท่านั้น ห้ามส่งขึ้น API และห้ามใส่ใน draft payload

2) โหมดง่าย = ซ่อนคอนโทรลเหล่านี้ (ยังต้องมีอยู่ในโหมดละเอียด):
   - ชื่อชิ้นงาน            input-piece-name-*
   - เพิ่ม/ลบแผ่น           button-add-studio-rectangle-* · button-delete-studio-rectangle-*
   - ตำแหน่ง X / Y          input-rectangle-x-* · input-rectangle-y-*
   - สลับ กว้าง/ยาว         button-swap-rectangle-dimensions-*
   - ทิศทางต่อแผ่น          button-studio-join-top/left/right/bottom-* · select-studio-attachment-parent-*
   - จัดตำแหน่ง             button-studio-align-start/center/end-*
   - สถานะขอบ 4 ด้าน        .studio-side-status-grid
   - offset อ่าง            input-placement-offset-x-* · input-placement-offset-y-*
   - preset                 button-studio-preset-*
   - เพิ่ม/ลบชิ้นงาน        ปุ่มเพิ่มชิ้นงาน · button-delete-studio-piece-*

3) โหมดง่าย ต้องยังใช้งานได้ครบ (ห้ามซ่อน):
   - เลือกสีหิน              button-studio-stone-*
   - เลือกรูปทรง            ปุ่ม ทรงตรง (I) / ทรงฉาก L ซ้าย / ทรงฉาก L ขวา / ทรงตัวยู (U)
   - ขนาดแผ่น               input-rectangle-width-* · input-rectangle-length-*
   - ความสูงบัว             input-studio-upstand-height
   - ราคาขอบเปิด/ม.         input-studio-open-edge-price
   - อ่าง                    button-studio-basin-* · วางอ่าง · หมุนอ่าง 90° · วางกึ่งกลางแผ่น
   - ผัง + ประมาณการราคา

4) ตั้งสถานะขอบอัตโนมัติ — เฉพาะเมื่อทั้ง 4 ด้านยังเป็น "normal" เท่านั้น
   (ห้ามทับค่าที่ผู้ใช้ตั้งเองแล้ว)
     - ด้านบน (ขอบหลัง)        -> upstand      (ติดบัว ▲)
     - ด้านล่าง/ซ้าย/ขวา        -> open-edge    (ขอบเปิด ⊗)
   และถ้า input-studio-upstand-height ว่าง ให้ตั้ง 120

5) ฟอนต์ในโหมดง่าย: ห้ามใช้ขนาดต่ำกว่า 13px สำหรับข้อความเนื้อหาและป้ายกำกับ
   (ปัจจุบันหน้านี้มีข้อความ 9px และ 10px อยู่ 265 จุด — ต้องไม่เพิ่มใหม่ในโหมดง่าย)
   ใช้ CSS token ที่มีอยู่แล้วใน index.css

6) ห้ามแก้ตรรกะราคา/เรขาคณิตใด ๆ — ตัวเลขที่ออกต้องเท่าเดิมทุกกรณี
```

---

## บันทึกการทบทวนก่อนออกใบงาน (มาตรฐานการออกใบงาน 12 ข้อ)

| # | ข้อ | ผล |
|---|---|---|
| 1 | ลำดับ | ✅ ใบงาน 24 (สลับ hook จริง) เป็นงาน Replit ค้างอยู่ก่อน — ใบนี้เป็นงานใหม่แยก ไม่ทับกัน (คนละไฟล์: ใบ 24 = TechnicianTeamsManager/Calendar · ใบ 26 = StudioPage) |
| 2 | SCOPE ครบ | ✅ ตรวจแล้ว: ไฟล์เทสต์ของ knight-basins ไม่มีไฟล์ที่อ้าง StudioPage โดยตรง → ไม่ต้องขยาย SCOPE |
| 3 | ขัดกันเอง | ✅ ไม่มี codegen ในใบนี้ · ไฟล์ generated อยู่ใน FORBIDDEN · ไม่มีการบังคับ base ที่ขัดกับ FORBIDDEN (branch สร้างใหม่จาก main ปัจจุบัน) |
| 4 | อ้างถึงอะไร | ✅ testid จริงดึงจากโค้ด (grep แล้ว) · ตัวเลข 1.4508 m² = ค่าที่ engine ออกจริง (ยืนยันบน production) |
| 5 | คำสั่งจริง | ✅ `npx pnpm` / `npm test` เดวิดรันเองได้ |
| 6 | สิทธิ์ | – ไม่ใช้ chai.sh |
| 7 | รูปที่เทียบ | ✅ รูปทรงใช้ชื่อปุ่มจริง: ทรงตรง (I) · ทรงฉาก L ซ้าย · ทรงฉาก L ขวา · ทรงตัวยู (U) |
| 8 | ข้อห้าม | ✅ ครบ + ห้ามแตะ engine + ห้ามลบความสามารถเดิม + ห้ามแก้ print layout |
| 9 | STOP | ✅ ตัวเลขชัด — เกณฑ์ fail นับ "นอกไฟล์ browser test" (แก้จากใบ 24 ที่ตั้งเพดานผิด) |
| 10 | ครึ่งเดียว | ✅ ใบนี้ปิดงาน: โหมดง่าย + สลับได้ + หลักฐานครบ |
| 11 | Replit | ✅ บรรทัดบังคับบนสุด · path สัมพัทธ์ · ต้องมี commit hash · ข้อความ paste ได้ |
| 12 | เพดานรอบ | – ไม่ใช้ chai.sh |
