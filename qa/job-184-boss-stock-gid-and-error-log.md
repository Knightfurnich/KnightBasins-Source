# ใบงาน 184 (บอส / Claude Code) — แก้บั๊กหน้า "สต็อกหิน" ล่มทั้งหน้า เพราะ gid ที่ฝังตายตัว + error ถูกกลืนหาย

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** ด่วน — มอบหมายให้ บอส / ชัย (Claude Code CLI / Backend API) · เริ่มได้ทันที

**ที่มาและความต้องการ:**
หน้า Admin > สต็อกหิน ใช้งานไม่ได้มาแล้ว (GET /api/admin/stock ตอบ HTTP 500 ทุกครั้ง)
ต้นตอที่ตรวจสอบยืนยันจาก production จริง มี 2 ชั้นซ้อนกัน:

ชั้นที่ 1: Google Sheets API ตอบ 403 SERVICE_DISABLED เพราะยังไม่เปิด API บนโปรเจกต์ GCP (บอสเปิดเองใน Console — ไม่อยู่ในขอบเขตโค้ดของใบงานนี้)
ชั้นที่ 2 (บั๊กในโค้ด ที่ต้องแก้ในใบงานนี้): เมื่อชั้นที่ 1 ล้ม โค้ดจะ fallback ไปดึง CSV จาก docs.google.com/export และชีต Staron มีการฝัง `&gid=1852331911` ตายตัวไว้ ทำให้ fallback ตอบ 400/หมดเวลา แล้ว throw ออกไป

ผลที่ตามมา: Promise.all ตกทั้งคู่ ทำให้ Zen Stone ที่ปกติก็แสดงไม่ได้ไปด้วย และหน้าเว็บขึ้นข้อความกว้างๆ ว่า "โหลดสต็อกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" ทั้งที่กดซ้ำกี่ครั้งก็ไม่หาย

**รายละเอียดสิ่งที่ต้องทำ (3 จุด):**
1. ถอด gid ที่ฝังตายตัวออกใน `artifacts/api-server/src/routes/admin-router.ts` ฟังก์ชัน `fetchGoogleSheetRows`
   - ปัจจุบันมีบรรทัด `const gidParam = spreadsheetId === STARON_SPREADSHEET_ID ? "&gid=1852331911" : "";`
   - ให้เปลี่ยนเป็นดึงค่า gid จาก environment variable (เช่น `STOCK_STARON_SHEET_GID`) ถ้ามีค่า จึงต่อท้าย URL และถ้าไม่มีค่าให้เรียก URL เปล่า (ไม่ใส่ gid) ตามเดิม
   - หมายเหตุการใช้งานจริง: ตัว API อ่าน env จาก `/docker/knightbasins/.env` ผ่าน `env_file` ใน `docker-compose.yml` (บรรทัดบริการ `api`) — การเพิ่มค่าใหม่ต้อง recreate คอนเทนเนอร์ API 1 ครั้ง เดวิดจะขออนุญาตบอสแยกอีกครั้งก่อนทำ (ไม่ใช่หน้าที่ของใบงานนี้)
2. ทำให้แต่ละแหล่งทนความล้มเหลวได้เอง ในฟังก์ชัน `resolveStockData`
   - เปลี่ยน `Promise.all` เป็น `Promise.allSettled` เพื่อให้ Zen Stone แสดงผลได้แม้ Staron ล่ม และให้แต่ละฝั่งคืนค่าเป็นชีตว่างพร้อมเหตุผลของตัวเองได้ ไม่ให้ทั้ง endpoint ล่ม
   - ถ้าทั้ง 2 แหล่งล้มพร้อมกัน ให้ตอบ HTTP 503 พร้อมข้อความที่ระบุสาเหตุจริง ว่าเป็นปัญหาการเชื่อมต่อต้นทาง (ไม่ใช่ 500 ทั่วไป)
2b. ใส่ timeout ให้การดึงข้อมูลทั้ง Sheets API และ CSV export (แนะนำ 10 วินาที ผ่าน AbortSignal)
   - หลักฐานจริง: ระหว่างสืบสาเหตุ พบว่าการ export CSV ของ Staron ค้างจนหมดเวลา (timeout) ไม่ตอบกลับ — ถ้าไม่มี timeout คำขอจะค้างนานโดยไม่จำเป็น
3. ทำให้ log เห็นข้อความ error จริง ใน `artifacts/api-server/src/app.ts` บรรทัด 107
   - ปัจจุบัน `logger.error({ error }, "Unhandled API error")` ทำให้ Error object serialize ได้ `{}` และข้อความจริงหายทั้งหมด
   - ให้บันทึกข้อความและ stack จริงด้วย เช่น `logger.error({ err: error, message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, "Unhandled API error")`

**ห้ามทำ:** ห้ามแก้หน้า UI (StockInventoryPage.tsx) ในใบงานนี้ — งานฝั่งหน้าจอจะออกแยกหากจำเป็น

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด

GOAL:
  1. ถอด gid ที่ฝังตายตัวใน artifacts/api-server/src/routes/admin-router.ts (fetchGoogleSheetRows) แล้วอ่านจาก env STOCK_STARON_SHEET_GID แทน
  2. ใช้ Promise.allSettled ใน resolveStockData + คืน 503 พร้อมสาเหตุจริงเมื่อทั้ง 2 แหล่งล้ม
  3. แก้ logger ใน artifacts/api-server/src/app.ts บรรทัด 107 ให้ข้อความ/stack ของ Error ออกมาจริง
  4. เพิ่มเทสต์ใน artifacts/api-server/test/admin-stock-api.test.ts ครอบคลุมพฤติกรรมใหม่

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/src/app.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/admin-stock-api.test.ts

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/ ทุกไฟล์ (โดยเฉพาะ src/index.css และ StockInventoryPage.tsx)
  - ห้ามลบ fallback CSV export ออก ต้องคงไว้เป็นทางสำรอง
  - ห้ามใส่ค่า gid ตายตัวกลับเข้าไปเป็นตัวเลขในโค้ดอีก
  - ห้าม commit ไฟล์ความลับ Google credentials
  - ห้ามแก้ค่าในฐานข้อมูล production
  - ทำงานผ่าน branch: fix/chai-stock-gid-and-error-log แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง branch ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) npm test ใน artifacts/api-server
     baseline อ้างอิง: tests 733 / fail 9 pre-existing / ตัวที่ตกต้องเป็นชุดเดิมเท่านั้น (ห้ามมีตัวใหม่)
  4) เทสต์ใหม่ใน test/admin-stock-api.test.ts ผ่าน และต้องมีเคสพิสูจน์ว่า: เมื่อ Staron ล้ม Zen Stone ต้องยังคืนค่าได้, เมื่อทั้งคู่ล้มต้องได้ 503 ไม่ใช่ 500, และ URL ที่สร้างต้องไม่มี gid เมื่อ env ไม่ถูกตั้ง

OUTPUT:
  - branch: fix/chai-stock-gid-and-error-log (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ตกเกิน 9 ข้อ (baseline เดิม)
  - ถ้าต้องแก้ไฟล์ UI artifacts/knight-basins/ เพื่อให้งานสำเร็จ
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
| 7 | SCOPE ใช้ path สมบูรณ์สำหรับ Claude Code CLI | ✅ ผ่าน |
| 8 | มีข้อกำหนด branch และ PR ชัดเจน | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎไฟล์ index.css แช่แข็ง และไม่แตะ UI | ✅ ผ่าน |
| 11 | มอบอำนาจขอบเขต Backend แยกจาก UI ชัดเจน | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
