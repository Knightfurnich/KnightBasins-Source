# ใบงานที่ 27 (Replit) — แก้ 2 บั๊กที่เจ้าของเจอจากการทดสอบ

**ที่มา:** เจ้าของทดสอบระบบ 24 ก.ย. 69 เจอ 2 จุด → **อนุมัติให้แก้แล้ว**
**Branch:** `feat/replit-quote-and-print-fixes` (สร้างใหม่จาก main ล่าสุด — main ปัจจุบัน `95342cc`)

ส่งเป็นสตริงเดียวให้ Replit

```
✅ มาตรฐานการออกใบงาน · 12/12 · 24 ก.ย. 69 · เดวิด
✅ เจ้าของอนุมัติแล้ว (24 ก.ย. 69) ให้แก้เฉพาะ 2 จุดในใบนี้

⛔ ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal
   และห้ามเด้งกล่องถามเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL      : แก้ 2 บั๊ก
            (1) ใบเสนอราคามีบรรทัด "WORKPIECES / N ชิ้นงาน" ยอด ฿0 โผล่เป็นรายการที่ 3 — ต้องตัดออก
            (2) ใบงานพิมพ์ (ผังประกอบ) ไม่บอกว่าอ่างหันแนวไหน — ต้องแสดงแนว + ขนาดหลุม

SCOPE     : artifacts/knight-basins/src/App.tsx
            artifacts/knight-basins/src/components/StudioPage.tsx
            (path สัมพัทธ์จาก root ของ repo · ห้ามแตะไฟล์อื่น)

FORBIDDEN : ห้ามแก้ตาราง/CSS/เลย์เอาต์การพิมพ์ของ FormalQuote (ใน App.tsx) — แก้เฉพาะ
            การสร้างข้อมูล formalItems และ filter ตาม CONTRACT
            ห้ามแก้ artifacts/knight-basins/src/components/WorkshopProductionSheet.tsx
            ห้ามแก้ artifacts/knight-basins/src/data/studio-model.ts (engine ราคา/เรขาคณิต)
            ห้ามแก้ artifacts/knight-basins/src/index.css
            ห้ามแก้ lib/** (generated) ทุกไฟล์
            ห้ามแก้ StudioPage.tsx บรรทัด 2372 (ข้อความแจ้งทีมขาย — ให้คง WORKPIECES ไว้ เป็นข้อมูลภายใน)
            ห้ามเปลี่ยนตัวเลขราคา/ยอดรวมใด ๆ — ตัดเฉพาะบรรทัดที่ยอดเป็น 0
            ห้าม push เข้า main ตรง ๆ

EVIDENCE  : 1) branch อิงจาก main ล่าสุด — แนบผล git log -1
            2) npx pnpm run typecheck จาก root -> 0 errors
            3) PORT=3000 npx pnpm run --filter @workspace/knight-basins build
               -> ผ่าน + verify-production-assets OK
            4) cd artifacts/knight-basins && npm test
               เกณฑ์ผ่าน: ต้องไม่มี fail นอกไฟล์ *.browser.test.ts
            5) screenshot ใบเสนอราคา (แบบที่มี 2 ชิ้นงาน + อ่าง 1 ชุด)
               -> ต้องไม่มีบรรทัด WORKPIECES และต้องไม่มีบรรทัดใดมียอด ฿0
               -> ยอดรวม/VAT ต้องเท่าเดิม
            6) screenshot กรณีโหลดใบเสนอราคาที่บันทึกไว้ก่อนหน้า (ข้อมูลเก่ามี WORKPIECES)
               -> ต้องไม่แสดงบรรทัดนั้น
            7) screenshot ผังพิมพ์ 2 ภาพ: อ่างแนวนอน กับ อ่างหลังกด "หมุนอ่าง 90°"
               -> ต้องมีข้อความบอกแนวและขนาดหลุมในผังทั้ง 2 ภาพ
            8) branch + commit hash ที่ส่งกลับ

OUTPUT    : ลิงก์ branch · commit hash · ไฟล์ที่แก้ + จำนวนบรรทัด · หลักฐาน 1-8

STOP      : หยุดแล้วรายงานถ้า (ก) typecheck ไม่ผ่านแก้ไม่ได้ใน 1 รอบ (ข) build ไม่ผ่าน
            (ค) มี fail นอกไฟล์ *.browser.test.ts (ง) ยอดรวมในใบเสนอราคาเปลี่ยนจากเดิม
            ห้ามเดาต่อ ห้ามแก้ไฟล์นอก SCOPE

CONTRACT (ทำตามนี้ ไม่ต้องเดา):

── งานที่ 1: ตัดบรรทัด WORKPIECES ออกจากใบเสนอราคา ──

1) App.tsx — บรรทัด 1111-1121 เป็นก้อนนี้ ให้ "ลบทั้งก้อน" ออก
     formalItems.push({
       code: "WORKPIECES",
       description: `${estimate.pieceCount ?? 1} ชิ้นงาน · ${estimate.rectangleCount ?? 0} แผ่น`,
       ... unitPrice: 0, total: 0 ...
     });
   * ลบทั้ง push ไม่ใช่ comment ทิ้ง

2) App.tsx — บรรทัด 1123-1140 (เส้นทางโหลดจาก saved.notification)
   ให้ใส่ .filter() ก่อน .map() เพื่อกันใบเสนอราคาเก่าที่ยังมี WORKPIECES อยู่ในข้อมูล:
     formalItems = saved.notification.items
       .filter((item) => item.code !== "WORKPIECES")
       .map((item) => ({ ... }));
   * ห้ามแตะการ map ฟิลด์อื่นแม้แต่บรรทัดเดียว

3) StudioPage.tsx บรรทัด 2372 — **ห้ามแก้** (เป็นข้อความแจ้งทีมขาย ไม่ใช่ใบเสนอราคา)

── งานที่ 2: ผังพิมพ์บอกแนวอ่าง ──

4) StudioPage.tsx — import `basinPlacementOrientation` เพิ่มจาก "@/data/studio-model"
   (ยังไม่มีในไฟล์นี้ · ค่าที่คืน: "horizontal" | "vertical")
   `placementCutSize` มี import อยู่แล้ว (บรรทัด 32) และใช้ใน StudioPlacementPreview บรรทัด 1772

5) StudioPage.tsx — `StudioPlacementPreview` (นิยามบรรทัด 1756) ให้เพิ่มข้อความในกล่อง
   ปัจจุบันแสดงแค่: <strong>{placement.sku}</strong>
   ให้เปลี่ยนเป็นรูปแบบนี้:
     <sku> · <กว้าง>×<สูง> มม. · <แนวนอน | แนวนอน→แนวตั้ง>
   กติกา:
     - ค่า กว้าง×สูง ใช้จาก `cutSize` ที่คำนวณไว้แล้ว (placementCutSize)
     - "horizontal" -> แสดง "แนวนอน" · "vertical" -> แสดง "แนวตั้ง"
     - ถ้า cutSize.widthMm หรือ heightMm เป็น null -> แสดง "<sku> · ขนาดหลุมไม่ระบุ" (เหมือนพฤติกรรมเดิม)
     - ตัวเลขขนาดหลุมให้ปัดเป็นจำนวนเต็มแล้วใส่ comma คั่นพัน (เช่น 1,200)
   * ห้ามแก้ตำแหน่ง/ขนาดของกล่องในผัง — เพิ่มเฉพาะข้อความ
   * ห้ามแตะ CSS ในไฟล์ index.css — ใช้ class เดิมของ .studio-placement ถ้าจำเป็น

6) ตัวเลขราคา/พื้นที่ต้องไม่เปลี่ยนแม้แต่บาทเดียว — งานนี้ตัดเฉพาะบรรทัดที่ยอด 0 และเพิ่มข้อความ
```

---

## บันทึกการทบทวนก่อนออกใบงาน (มาตรฐานการออกใบงาน 12 ข้อ)

| # | ข้อ | ผล |
|---|---|---|
| 1 | ลำดับ | ✅ ไม่พึ่งของที่ยังไม่ merge · main ล่าสุด `95342cc` · ไม่ชนกับใบ 24/26 (คนละไฟล์) |
| 2 | SCOPE ครบ | ✅ ตรวจแล้ว: ไม่มีไฟล์เทสต์ของ knight-basins ที่断言 WORKPIECES หรือ StudioPlacementPreview |
| 3 | ขัดกันเอง | ✅ ไม่มี codegen · ไม่จำกัดจำนวนไฟล์แบบขัดกับงาน |
| 4 | อ้างถึงอะไร | ✅ ตัวเลขบรรทัด (1111-1121 / 1123-1140 / 1756 / 1772 / 2372) ดึงจากไฟล์จริงแล้ว · ชื่อ symbol จริง |
| 5 | คำสั่งจริง | ✅ `npx pnpm` · `npm test` |
| 6 | สิทธิ์ | – ไม่ใช้ chai.sh |
| 7 | รูปที่เทียบ | ✅ `basinPlacementOrientation` คืน "horizontal"/"vertical" (ตรวจที่ studio-model.ts:738) |
| 8 | ข้อห้าม | ✅ ครบ + ล็อกไม่ให้แตะตาราง/CSS/print layout + index.css + generated |
| 9 | STOP | ✅ ตัวเลขชัด — เกณฑ์ fail นับ "นอกไฟล์ *.browser.test.ts" + กันยอดรวมเปลี่ยน |
| 10 | ครึ่งเดียว | ✅ ปิดทั้ง 2 บั๊กในใบเดียว — ไม่ตัดอะไรออกเพื่อเลี่ยง |
| 11 | Replit | ✅ บรรทัดบังคับบนสุด · path สัมพัทธ์ · ต้องมี commit hash · paste ได้ |
| 12 | เพดานรอบ | – ไม่ใช้ chai.sh |
