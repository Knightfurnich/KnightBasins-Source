# ใบงาน 154 (ชัย) — ปรับเงื่อนไข Graceful Skip ใน Browser E2E Tests (Standardize Browser Test Skip Conditions)

**วันที่:** 30 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend & QA Test Infrastructure) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
จากการตรวจวินิจฉัยเชิงลึก พบว่าไฟล์ Browser Tests 4 ไฟล์ใน `artifacts/knight-basins/test/`:
1. `admin-upload.browser.test.ts`
2. `dispatch-persistence.browser.test.ts`
3. `basin-visual.browser.test.ts`
4. `quote-print.browser.test.ts`
มีพฤติกรรม `throw Error(...)` ภายใน `before()` hook ทันทีที่ตรวจไม่พบ `ADMIN_PASSWORD` หรือเมื่อพยายาม spawn Chromium บนเครื่องทดสอบที่ไม่มีตัวโปรแกรม Chromium ส่งผลให้เทสต์ขึ้นสถานะสีแดง (Fail 21-22 รายการ) ทั้งๆ ที่ระบบจริงไม่ได้มีบั๊กใดๆ เลย
ในขณะที่ไฟล์เทสต์อื่นๆ ในโปรเจกต์ (เช่น `admin-stock-inventory.test.ts:261`, `admin-dashboard-ai-cost.test.ts:292`) ใช้มาตรฐานของ Node.js Test Runner:
`{ skip: (!adminPassword || !existsSync(chromiumPath)) && "ADMIN_PASSWORD and Chromium are required for browser test" }`
ซึ่งขึ้นสถานะ `skipped` อย่างสง่างามและถูกต้องตามหลักวิศวกรรม

งานนี้คือการปรับปรุงให้ทั้ง 4 ไฟล์ใช้มาตรฐานเดียวกัน:
1. นำเข้า `existsSync` จาก `node:fs`
2. ตรวจสอบเงื่อนไข `canRunBrowserTest = Boolean(adminPassword && existsSync(chromiumPath))`
   (สำหรับไฟล์ที่ไม่ต้องการรหัสผ่าน เช่น `basin-visual` และ `quote-print` ตรวจสอบเฉพาะ `existsSync(chromiumPath)`)
3. ส่งค่า `{ skip: !canRunBrowserTest && "Chromium or ADMIN_PASSWORD not configured" }` ใน `describe()` หรือ `it()`
4. ใน `before()` hook หากไม่เข้าเงื่อนไข ให้ return ออกทันทีโดยไม่ต้อง throw Error และไม่ต้องพยายามเชื่อมต่อฐานข้อมูลหรือเปิดเบราว์เซอร์

**ผลลัพธ์ที่ต้องการ:**
* เมื่อรัน `npm test` บนเครื่อง Sandbox ที่ไม่มี Chromium: ผลทดสอบจะขึ้น **Pass 100% (0 Failures, ~22 Skipped)**
* โค้ดเทสต์เดิมยังคงอยู่ครบ 100% สามารถนำไปรันบน CI หรือเครื่องที่มีเบราว์เซอร์จริงได้ตลอดเวลา

```
✅ มาตรฐานการออกใบงาน · 12/12 · 30 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-browser-test-skip แล้วเปิด PR เพื่อให้เดวิดตรวจรับและรวมโค้ดตามอำนาจที่ได้รับมอบหมาย

GOAL:
  1. ปรับปรุง artifacts/knight-basins/test/admin-upload.browser.test.ts
  2. ปรับปรุง artifacts/knight-basins/test/dispatch-persistence.browser.test.ts
  3. ปรับปรุง artifacts/knight-basins/test/basin-visual.browser.test.ts
  4. ปรับปรุง artifacts/knight-basins/test/quote-print.browser.test.ts
  - ใช้ pattern { skip: ... } ของ node:test เหมือน admin-stock-inventory.test.ts

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/admin-upload.browser.test.ts
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/dispatch-persistence.browser.test.ts
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/basin-visual.browser.test.ts
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/quote-print.browser.test.ts

FORBIDDEN:
  - ห้ามลบเนื้อหาเทสต์หรือ assertions เดิมภายในไฟล์ออกเด็ดขาด (เป็นการเพิ่ม skip condition เท่านั้น)
  - ห้ามแตะต้องโค้ดจริงใน artifacts/knight-basins/src/ หรือ backend
  - ห้ามแตะต้อง src/index.css เด็ดขาด
  - ห้าม push ตรงเข้า main ให้เปิด PR จาก branch feat/chai-browser-test-skip

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit -> 0 errors
  2) cd artifacts/knight-basins && npm test
     baseline ก่อนแก้: tests 604 / pass 583 / fail 21 browser / skipped 0
     ผลที่ต้องการหลังแก้: fail 0 (ผ่านทุกตัวที่ไม่ใช่ browser, browser ขึ้น skipped แทน fail)
  3) git log -1 --stat แสดงไฟล์ที่แก้ตรงตาม SCOPE 4 ไฟล์เท่านั้น

OUTPUT:
  - branch: feat/chai-browser-test-skip (เปิด PR เข้า main)
  - 4 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 3 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
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
| 6 | EVIDENCE มุ่งเป้า fail: 0 ชัดเจน | ✅ ผ่าน |
| 7 | SCOPE ระบุไฟล์ชัดเจนในเครื่องเรา | ✅ ผ่าน |
| 8 | มีข้อบังคับสาขาสำหรับชัย | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | อนุรักษ์เนื้อหาการทดสอบเดิม 100% | ✅ ผ่าน |
| 11 | ยึดมาตรฐาน Node.js Test Runner | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
