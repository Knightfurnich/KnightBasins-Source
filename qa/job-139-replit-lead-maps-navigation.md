# ใบงาน 139 (Replit) — ปุ่มนำทาง Google Maps หนึ่งคลิกในหน้า Lead และปฏิทินช่าง (One-Click Site Navigation UI)

**วันที่:** 29 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (Frontend / Logistics UI) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ตามแผน V2.0 (กล่องที่ 3) ทีมช่างต้องคอยพิมพ์ที่อยู่ลง Google Maps เอง ทำให้บางครั้งนำทางผิดที่ งานนี้คือการทำให้ช่างกดปุ่มเดียวจากมือถือแล้วเปิด Google Maps นำทางไปหน้างานได้ทันที และให้แอดมินวางลิงก์ Google Maps ไว้ที่ Lead ได้เลย

**API ที่เตรียมไว้ให้แล้ว (อ้างอิงจากใบงาน 138 — ชัยกำลังทำขนานกัน):**
* `PATCH /api/admin/leads/:id/site-location`
  * Body: `{ "mapsLink": "https://maps.app.goo.gl/xxxxx" }`
  * สำเร็จ → `200` คืน `{ id, siteLat, siteLng, siteMapsUrl, resolvedFrom }`
  * ลิงก์ผิด → `400` (ข้อความไทย)
* `GET /api/admin/leads` จะส่ง `siteLat`, `siteLng`, `siteMapsUrl` กลับมาด้วย (เป็น `null` ถ้ายังไม่มี)

> ⚠️ **หมายเหตุสำคัญสำหรับการเริ่มงาน:** API ข้างบนจะออนไลน์บน `main` หลังใบงาน 138 ถูก merge
> ถ้าเริ่มงานแล้วยังไม่พบ field `siteMapsUrl` ใน `GET /api/admin/leads` → **ให้หยุดแล้วรายงานทันที** (ตามเงื่อนไข STOP)
> เพื่อไม่ให้รอเก้อ ให้เริ่มจากส่วนที่พึ่งพาได้ก่อน: ปุ่ม "คัดลอกลิงก์นำทางจากที่อยู่" และ UI ทั้งหมด (ดูข้อ 2 และ 3)

**งานฝั่งหน้าจอ:**

1. **ใน `artifacts/knight-basins/src/admin/LeadsManager.tsx`:**
   * เพิ่มช่องกรอก **"ลิงก์ Google Maps หน้างาน"** ในส่วนขยายรายละเอียด Lead (ที่มีอยู่แล้ว)
     * `data-testid="input-lead-maps-link"`
     * ปุ่มบันทึก `data-testid="button-save-lead-maps-link"`
   * เมื่อบันทึกสำเร็จ แสดงป้ายพิกัด `data-testid="lead-maps-coords"` เช่น `13.7563, 100.5018`
   * เมื่อมี `siteMapsUrl` แล้ว แสดงปุ่มสีเขียว **`[ 🧭 นำทาง Google Maps ]`**
     * `data-testid="button-navigate-lead"`
     * เป็น `<a href={siteMapsUrl} target="_blank" rel="noreferrer">` เปิดในแท็บใหม่ (ต้องกดจากมือถือแล้วเด้งแอป Google Maps ได้)
   * กรณี API ยังไม่มีพิกัด แต่ Lead มีที่อยู่ใน `address` ให้แสดงปุ่มสำรอง **`[ 🗺️ ค้นหาที่อยู่ใน Maps ]`** ที่สร้างลิงก์จากข้อความที่อยู่ (`data-testid="button-search-lead-address"`)
   * แจ้งผลสำเร็จ/ล้มเหลวด้วยข้อความจาก API แบบอ่านรู้เรื่อง (ห้ามโชว์ error ดิบ)

2. **ใน `artifacts/knight-basins/src/admin/TechnicianCalendarPage.tsx`:**
   * งานในปฏิทินมีฟิลด์ `address` อยู่แล้ว และมีปุ่มลิงก์ Maps แบบค้นหาด้วยที่อยู่ (ฟังก์ชัน `googleMapsUrl`) — **ให้คงของเดิมไว้**
   * เพิ่มปุ่มที่ใช้พิกัดจริงถ้ามี: ถ้าข้อมูลงานมี `siteMapsUrl` ให้ใช้ลิงก์นั้นแทน (`data-testid="button-navigate-job"`)
   * ปุ่มต้องมีขนาดแตะได้บนมือถือ (ความสูงอย่างน้อย 40px) และมีข้อความไทยกำกับชัดเจน

3. **สร้าง `artifacts/knight-basins/test/lead-maps-navigation.test.ts` (ใหม่):**
   * ใช้รูปแบบ **Static Source Inspection** (`readFileSync` + `assert.match`) เท่านั้น
   * ❌ ห้าม `dynamic import` คอมโพเนนต์โดยตรง เพราะ `node:test` loader ไม่มี `import.meta.env.BASE_URL` ของ Vite (จะทำให้เทสต์พังทั้งไฟล์ — ดูตัวอย่างวิธีที่ถูกใน `test/storefront-theme-toggle.test.ts` และ `test/updates-page.test.ts`)
   * ตรวจว่ามี `data-testid` ครบทุกตัวตามที่ระบุข้างบน
   * ตรวจว่าปุ่มนำทางเป็นลิงก์ที่เปิดแท็บใหม่จริง (`target="_blank"`)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 29 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL:
  1. ปรับปรุง artifacts/knight-basins/src/admin/LeadsManager.tsx:
     - ช่องกรอกลิงก์ Google Maps หน้างาน + บันทึกผ่าน PATCH /api/admin/leads/:id/site-location
     - ป้ายพิกัด + ปุ่ม [ นำทาง Google Maps ] เมื่อมีพิกัด + ปุ่มสำรองค้นหาจากที่อยู่
  2. ปรับปรุง artifacts/knight-basins/src/admin/TechnicianCalendarPage.tsx:
     - เพิ่มปุ่มนำทางด้วยพิกัดจริงเมื่อมี siteMapsUrl (คงปุ่มเดิมไว้)
  3. สร้าง artifacts/knight-basins/test/lead-maps-navigation.test.ts (ใหม่)

SCOPE:
  - artifacts/knight-basins/src/admin/LeadsManager.tsx
  - artifacts/knight-basins/src/admin/TechnicianCalendarPage.tsx
  - artifacts/knight-basins/test/lead-maps-navigation.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css เด็ดขาด (ไฟล์แช่แข็ง)
  - ห้ามแตะต้อง backend หรือ artifacts/api-server/ ทุกไฟล์
  - ห้ามแตะต้อง StudioPage.tsx, App.tsx และ WorkshopProductionSheet.tsx
  - ห้ามลบหรือแก้ปุ่มลิงก์ Maps เดิมในปฏิทิน (googleMapsUrl) ให้คงไว้ทั้งคู่
  - ห้ามใช้ dynamic import คอมโพเนนต์ในไฟล์เทสต์ (จะพังเพราะไม่มี import.meta.env)
  - ห้ามรันคำสั่ง git ใน Terminal — ให้ใช้ GitHub Connection สร้าง branch: feat/replit-lead-maps-navigation แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) GitHub branch และ commit จาก GitHub Connection
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 570 / pass 548 / fail 22 browser / cancelled 0 / skipped 0
  4) เทสต์ใหม่ใน test/lead-maps-navigation.test.ts ผ่าน 100%

OUTPUT:
  - branch: feat/replit-lead-maps-navigation (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
  - ถ้าต้องแก้ไข src/index.css เพื่อให้ฟีเจอร์ทำงาน
  - ถ้าต้องแตะต้องไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
  - ถ้าไม่พบ field siteMapsUrl ใน GET /api/admin/leads (ใบงาน 138 ยังไม่ merge) ให้หยุดรายงานทันที
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
| 11 | ระบุวิธีเขียนเทสต์ที่ถูกต้อง (Static Source Inspection) | ✅ ผ่าน |
| 12 | กำหนด STOP เมื่อ API ต้นทางยังไม่พร้อม | ✅ ผ่าน |
