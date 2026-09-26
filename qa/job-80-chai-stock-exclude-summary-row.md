# ใบงาน 80 (ชัย) — กรองแถวสรุปยอดรวมแผ่นออกจาก API สต็อกหิน Staron และ Zen Stone

**วันที่:** 26 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (API & Data Cleaning)

**ที่มาและความต้องการ:**
สืบเนื่องจากที่คุณนพตรวจสอบหน้า `/admin/stock` แล้วพบว่า บรรทัดสุดท้ายของตารางทั้ง Staron (แถวที่ 63) และ Zen Stone (แถวที่ 47) มีแถวชื่อ `"รวมแผ่นทั้งหมด"` โผล่ขึ้นมาเป็นรายการสีหินหลอก ซึ่งมาจากสูตร SUM ท้าย Google Sheets ของโรงงาน
ส่งผลให้ตัวเลข "สีทั้งหมด" บนการ์ด KPI นับเกินจริง 1 สี และทำให้ยอดในตารางผิดพลาด:

1. **ปรับปรุงฟังก์ชัน `buildStockSheet` ใน `artifacts/api-server/src/routes/admin-router.ts`:**
   - กรองตัดแถวสรุปผลท้ายชีตออก เช่น แถวที่ `name` ขึ้นต้นหรือประกอบด้วยคำว่า:
     * `"รวมแผ่นทั้งหมด"`
     * `"รวมทั้งหมด"`
     * `"ยอดรวม"`
     * `"Total"`
   - คำนวณ `totalSheets: number` (ผลรวมแผ่นจริงของทุกสีที่เหลือ) ส่งกลับไปใน `AdminStockSheet` ด้วย เพื่อให้หน้าบ้านสามารถนำตัวเลข "จำนวนแผ่นหินรวมทั้งโกดัง" ไปแสดงในการ์ด KPI ได้อย่างถูกต้องแม่นยำ
2. **รักษาความเข้ากันได้:**
   - ไม่แก้ Endpoint path (`/admin/stock` และ `/admin/stock/export` ยังคงทำงานได้เหมือนเดิม)
3. **เขียน/อัปเดต Unit Tests ใน `artifacts/api-server/test/`:**
   - ทดสอบว่าเมื่อฟีดข้อมูลที่มีแถว "รวมแผ่นทั้งหมด" ระบบจะคัดทิ้ง และนับจำนวนสีเฉพาะหินจริงเท่านั้น

```
✅ มาตรฐานการออกใบงาน · 12/12 · 26 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-stock-exclude-summary-row แล้วเปิด PR เพื่อรอเดวิดตรวจรับ

GOAL:
  1. ใน artifacts/api-server/src/routes/admin-router.ts:
     - ใน buildStockSheet(): เพิ่มเงื่อนไขกรอง name ที่เข้าข่ายแถวสรุปยอดรวม:
       /^(รวมแผ่นทั้งหมด|รวมทั้งหมด|ยอดรวม|total)/i.test(name) -> ให้ continue ข้ามไป
     - เพิ่มฟิลด์ totalSheets ใน AdminStockSheet (sum ของ item.qty ทั้งหมด)
  2. ใน artifacts/api-server/test/ (หรือ stock test ที่เกี่ยวข้อง):
     - ทดสอบว่าแถว "รวมแผ่นทั้งหมด" ถูกตัดทิ้ง ไม่ถูกนับเป็น item และไม่รวมเป็นสีหิน

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/admin-stock-api.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์ (งานหน้าบ้านจะออกให้ Replit ใน Task 81)
  - ห้ามแตะต้อง lib/db/ และ artifacts/api-server/src/routes/leads.ts
  - ห้าม push ตรงเข้า main ให้ทำงานผ่าน branch: feat/chai-stock-exclude-summary-row

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current -> feat/chai-stock-exclude-summary-row
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) node --experimental-strip-types --test <test-file> -> ผ่านครบ 100%
  4) npm test ใน artifacts/api-server -> รายงานผลเทียบ baseline เดิม (370 tests / 365 pass / 5 fail เดิม)

OUTPUT:
  - branch: feat/chai-stock-exclude-summary-row (เปิด PR เข้า main)
  - ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ใน artifacts/api-server มี fail เพิ่มจาก baseline เดิม (fail > 5)
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
| 7 | SCOPE ใช้ path เต็มสำหรับเครื่องเรา | ✅ ผ่าน |
| 8 | มีข้อบังคับเรื่อง branch และ PR | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนและยาวเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | กำหนดชื่อ branch และ PR ชัดเจน | ✅ ผ่าน |
| 11 | ทดสอบการกรองแถวยอดรวม และการคำนวณจำนวนสี | ✅ ผ่าน |
| 12 | ไม่แตะไฟล์หน้าบ้าน (แยกให้ Replit) และไม่แตะ DB | ✅ ผ่าน |
