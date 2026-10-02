# ใบงาน 185 (บอสทำเอง / Claude Code) — แกะ gid ของ Staron อัตโนมัติจาก htmlview ตอน runtime (แก้ถาวร ไม่ต้องพึ่ง env)

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ บอส (ทำเองผ่าน Claude Code CLI บน branch) · เริ่มได้ทันที

**ที่มาและปัญหา:**
ไฟล์สต็อกของ Staron เป็นไฟล์ Excel (`StockStaron.xlsx`) ที่มีถึง 69 แท็บย่อย และทุกครั้งที่โรงงานอัปโหลดไฟล์รอบใหม่ ค่า `gid` ของแท็บ `สต๊อคหินStaron` จะถูกสุ่มขึ้นมาใหม่เสมอ (เช่น วันนี้เปลี่ยนเป็น `1328053682`)
- ถ้าไม่ใส่ gid ใน URL export Google จะพยายามแปลงทั้ง 69 แท็บจน Timeout (10s)
- ถ้าใช้ gid ที่จำหรือตั้งไว้ใน env เมื่อโรงงานอัปโหลดไฟล์ใหม่ ค่า gid จะล้าสมัยแล้วพังอีก

**ทางแก้ถาวรที่ต้องทำในใบงานนี้:**
เพิ่มฟังก์ชันแกะ gid อัตโนมัติที่ runtime:
เมื่อต้องการดึง CSV ของ Staron ให้ระบบส่งคำขอ `GET https://docs.google.com/spreadsheets/d/{STARON_SPREADSHEET_ID}/htmlview` (มี timeout 10s) แล้วดึงค่า gid ของแท็บที่ตรงกับชื่อ `สต๊อคหินStaron` มาใช้ต่อท้าย URL export CSV (`&gid={gid}`)
- ถ้าแกะได้ gid สำเร็จ ให้เรียก CSV export ด้วย gid นั้นก่อน
- ถ้าแกะไม่ได้ หรือติดขัด ให้ fallback ตามลำดับเดิม (ดึงจาก env `STOCK_STARON_SHEET_GID` หรือ URL เปล่า)
- สามารถจำค่า gid ไว้ในหน่วยความจำชั่วคราว (in-memory cache) สั้นๆ ได้ เพื่อไม่ต้องยิง `/htmlview` ทุกครั้ง

**รายละเอียดโค้ดที่ต้องแก้ (2 ไฟล์):**
1. `artifacts/api-server/src/routes/admin-router.ts`
   - เพิ่มฟังก์ชัน `resolveSheetGidFromHtmlView(spreadsheetId: string, targetSheetName: string, accessToken?: string): Promise<string | null>`
     - เรียก `https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview` ด้วย `AbortSignal.timeout(STOCK_FETCH_TIMEOUT_MS)`
     - ใช้ Regular Expression แกะชื่อแท็บและ gid เช่น:
       `name:\s*"([^"]+)",\s*pageUrl:[^,]+,\s*gid:\s*"([0-9]+)"` หรือรูปแบบ data attributes ใน htmlview
     - คืนค่า string ของ gid ถ้าเจอแท็บที่ตรงกับ `targetSheetName` หรือ `null` ถ้าไม่พบ
   - ใน `fetchGoogleSheetRows`:
     - ก่อนสร้าง `exportUrls` ให้ตรวจสอบว่าถ้าเป็น `STARON_SPREADSHEET_ID` และไม่มี env `STOCK_STARON_SHEET_GID` (หรือพยายามหาอัตโนมัติก่อน) ให้เรียก `resolveSheetGidFromHtmlView`
     - นำ gid ที่แกะได้ไปใส่เป็นลำดับแรกใน `exportUrls` (เช่น `${exportBase}&gid=${autoGid}`)
2. `artifacts/api-server/test/admin-stock-api.test.ts`
   - เพิ่มเทสต์เคสจำลองว่าเมื่อ `/htmlview` คืน HTML ที่มี `สต๊อคหินStaron` คู่กับ `gid: "1328053682"` ตัวระบบจะเรียก CSV export ที่มี `&gid=1328053682` อัตโนมัติ
   - เพิ่มเทสต์เคสว่าถ้า `/htmlview` ล้มเหลวหรือ timeout ระบบจะยัง fallback ไปดึงแบบเดิมได้ ไม่ล่มทั้ง endpoint

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด

GOAL:
  1. สร้างฟังก์ชัน resolveSheetGidFromHtmlView ใน admin-router.ts เพื่อแกะ gid อัตโนมัติจาก /htmlview
  2. เชื่อมเข้า fetchGoogleSheetRows เพื่อให้ Staron ใช้ gid อัตโนมัติเป็นอันดับแรกก่อน export CSV
  3. เพิ่ม Unit Tests ใน admin-stock-api.test.ts ครอบคลุมทั้งกรณี htmlview สำเร็จ และ htmlview ล้มเหลว

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/admin-stock-api.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์ (ห้ามแตะ UI และห้ามแตะ src/index.css)
  - ห้ามลบ fallback CSV เดิมออก ต้องคงไว้เป็นตาข่ายรองรับชั้นสุดท้าย
  - ห้ามใส่ค่า gid 1328053682 เป็นตัวเลขฝังตายตัว (hardcoded) ในโค้ด admin-router.ts
  - ทำงานผ่าน branch: feat/boss-staron-auto-gid แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/boss-staron-auto-gid ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) npm test ใน artifacts/api-server
     baseline อ้างอิง: tests 741 / fail 9 pre-existing / ตัวที่ตกต้องเป็นชุดเดิมเท่านั้น (ห้ามมีตัวใหม่)
  4) node --test test/admin-stock-api.test.ts → ผ่านทุกข้อ (รวมเทสต์ใหม่เรื่อง auto-gid)

OUTPUT:
  - branch: feat/boss-staron-auto-gid (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ตกเกิน 9 ข้อ (baseline เดิม)
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
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
| 7 | SCOPE ใช้ path สมบูรณ์สำหรับ Claude Code CLI | ✅ ผ่าน |
| 8 | มีข้อกำหนด branch และ PR ชัดเจน | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง และไม่แตะ UI | ✅ ผ่าน |
| 11 | มอบอำนาจขอบเขต Backend แยกจาก UI ชัดเจน | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
