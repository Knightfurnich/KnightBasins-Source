# ใบงาน 138 (ชัย) — Google Maps Smart Resolver API & พิกัดหน้างานใน Lead (Site Location Resolver)

**วันที่:** 29 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / Logistics & Maps Engine) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ตามแผน V2.0 (กล่องที่ 3) ฝ่ายขายมักวางลิงก์ Google Maps ไว้ในบันทึก Lead หรือส่งในกลุ่ม LINE แต่ระบบยังไม่มีที่เก็บพิกัดที่ผ่านการตรวจสอบแล้ว ทำให้ทีมช่างต้องคอยพิมพ์ที่อยู่ลง Google Maps เอง และบางครั้งนำทางผิดพลาด
งานนี้คือการสร้าง "ตัวถอดรหัสพิกัด (Smart Resolver)" ที่รับลิงก์ Google Maps ทุกรูปแบบ แล้วแปลงเป็นพิกัด + ลิงก์นำทางมาตรฐาน เพื่อเก็บลงฐานข้อมูล

**รูปแบบลิงก์ที่ต้องรองรับ (ทุกแบบ):**
1. ลิงก์ย่อ: `https://maps.app.goo.gl/xxxxx` และ `https://goo.gl/maps/xxxxx` → ต้องตาม Redirect (follow redirect) แล้วอ่านพิกัดจากปลายทาง
2. ลิงก์ยาวที่มีพิกัดใน path: `https://www.google.com/maps/place/ชื่อสถานที่/@13.7563,100.5018,17z/...`
3. ลิงก์ที่มีพารามิเตอร์นำทางแบบละเอียด: `.../data=!3d13.7563!4d100.5018...`
4. ลิงก์ค้นหาแบบพิกัดตรง: `https://www.google.com/maps/search/?api=1&query=13.7563,100.5018`
5. พิกัดดิบที่พิมพ์เอง: `13.7563,100.5018` (มีหรือไม่มีช่องว่าง/องศา)

**สิ่งแรกที่ต้องทำ — ตรวจก่อนแก้ (ห้ามเดา schema):**
1. อ่าน `lib/db/src/schema/index.ts` หาตาราง `customer_leads` เพื่อดูว่ามีคอลัมน์เก็บพิกัดอยู่แล้วหรือไม่
2. อ่าน `deploy/hostinger/migrations/` ดูรูปแบบไฟล์ migration ล่าสุด และหมายเลขถัดไป
3. อ่าน `artifacts/api-server/src/routes/admin-router.ts` ที่ `router.get("/admin/leads")` เพื่อดูโครงสร้าง response

**สิ่งที่ต้องสร้าง:**

1. **`artifacts/api-server/src/lib/maps-location.ts` (ใหม่):**
   * ฟังก์ชัน `resolveMapsLink(input: string): Promise<ResolvedMapsLocation>` โดยที่ `ResolvedMapsLocation = { lat: number; lng: number; navUrl: string; resolvedFrom: "short-link" | "path" | "data-param" | "query" | "raw-coords"; sourceUrl: string }`
   * `navUrl` ต้องเป็นลิงก์นำทางมาตรฐานที่ใช้ได้จริงบนมือถือ: `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`
   * ถ้าถอดพิกัดไม่ได้เลย ให้ throw `Error("invalid-maps-link")` — **ห้ามคืนพิกัดเดา** (พิกัดผิด = ช่างขับรถผิดที่ ห้ามเดาเด็ดขาด)
   * Validate พิสัย: latitude ต้องอยู่ -90 ถึง 90, longitude -180 ถึง 180 (ค่าที่หลุดพิสัยให้ throw)
   * ลิงก์ย่อต้องตาม Redirect ด้วย `fetch` แบบ `redirect: "follow"` พร้อม timeout 8 วินาที กันค้าง
   * ฟังก์ชัน `buildNavigationUrl(lat: number, lng: number): string` แยกออกมาให้เทสต์ได้เดี่ยว ๆ

2. **คอลัมน์ใหม่ในตาราง `customer_leads`** (ถ้ายังไม่มี — ตรวจก่อนสร้าง):
   * `site_lat` (numeric/double precision, nullable)
   * `site_lng` (numeric/double precision, nullable)
   * `site_maps_url` (varchar 512, nullable) — เก็บ navUrl มาตรฐาน
   * สร้างไฟล์ migration ตามรูปแบบเดิมใน `deploy/hostinger/migrations/`
   * ⚠️ ห้ามลบ/แก้คอลัมน์เดิมเด็ดขาด เป็นการเพิ่มคอลัมน์ nullable เท่านั้น

3. **Endpoint ใหม่ใน `artifacts/api-server/src/routes/admin-router.ts`:**
   * `PATCH /api/admin/leads/:id/site-location` — guard ด้วย `requireAdminPermission("leads")`
   * Body: `{ mapsLink: string }`
   * สำเร็จ → `200` คืน `{ id, siteLat, siteLng, siteMapsUrl, resolvedFrom }`
   * ลิงก์ผิด/ถอดไม่ได้ → `400` พร้อมข้อความไทย: `"ลิงก์ Google Maps ไม่ถูกต้อง กรุณาวางลิงก์จากแอป Google Maps อีกครั้ง"`
   * ไม่พบ lead → `404`
   * ปรับ `GET /admin/leads` ให้ส่ง `siteLat`, `siteLng`, `siteMapsUrl` กลับไปด้วย (ถ้ามี) — ห้ามลบฟิลด์เดิมใน response

**ขอบเขตที่ห้ามแตะ (สำคัญมาก):**
* ห้ามแตะ `src/index.css`, `App.tsx`, `StudioPage.tsx`, `WorkshopProductionSheet.tsx` (เป็นงานฝั่งหน้าจอ Frontend ทั้งหมด)
* ห้ามแตะ `ai-cost-tracker.ts` และระบบต้นทุน AI
* ห้ามแก้ตรรกะราคา (`fabrication-geometry.ts`, `price-integrity.ts`)
* ห้ามแก้ endpoint เดิมอื่น ๆ นอกเหนือจากที่ระบุ

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-maps-location-resolver แล้วเปิด PR เพื่อให้เดวิดตรวจรับและรวมโค้ดตามอำนาจที่ได้รับมอบหมาย

```
✅ มาตรฐานการออกใบงาน · 12/12 · 29 ก.ย. 69 · เดวิด

GOAL:
  1. สร้าง artifacts/api-server/src/lib/maps-location.ts — resolveMapsLink() + buildNavigationUrl()
  2. เพิ่มคอลัมน์ site_lat, site_lng, site_maps_url ใน customer_leads (nullable) + migration
  3. เพิ่ม PATCH /api/admin/leads/:id/site-location และส่งพิกัดกลับใน GET /admin/leads
  4. เขียนเทสต์ใน artifacts/api-server/test/maps-location.test.ts (ใหม่)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/maps-location.ts · (ใหม่)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/lib/db/src/schema/index.ts
  - /opt/data/cache/kbsrc/deploy/hostinger/migrations/ · (ไฟล์ migration ใหม่ 1 ไฟล์)
  - /opt/data/cache/kbsrc/artifacts/api-server/test/maps-location.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง src/index.css, App.tsx, StudioPage.tsx, WorkshopProductionSheet.tsx (งานฝั่ง Replit)
  - ห้ามแตะต้อง ai-cost-tracker.ts หรือระบบต้นทุน AI
  - ห้ามแก้ตรรกะราคาใน fabrication-geometry.ts และ price-integrity.ts
  - ห้ามลบหรือเปลี่ยนชนิดคอลัมน์เดิมใน customer_leads
  - ห้ามคืนค่าพิกัดโดยการเดา (fallback to 0,0 หรือ เดาสถานที่จากชื่อ) เด็ดขาด

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) npx tsc -p artifacts/api-server/tsconfig.json --noEmit -> 0 errors
  2) npx tsx --test artifacts/api-server/test/maps-location.test.ts -> ผ่าน 100%
     ต้องครอบคลุม: ลิงก์ย่อ (mock redirect) · ลิงก์ยาว @lat,lng · !3d!4d · ?query=lat,lng · พิกัดดิบ · ลิงก์ผิดต้อง throw · พิกัดหลุดพิสัยต้อง throw
  3) npx tsx --test artifacts/api-server/test/security-audit.test.ts -> 18/18 (ต้องไม่พังจากคอลัมน์ใหม่)
  4) git log -1 --stat แสดงไฟล์ที่แก้ตรงตาม SCOPE เท่านั้น

OUTPUT:
  - branch: feat/chai-maps-location-resolver (ต้องมี commit อย่างน้อย 1 จังหวะ)
  - 5 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ non-browser ตกเกิน 0 ข้อ
  - ถ้าต้องแก้ไฟล์นอก SCOPE เกิน 0 ไฟล์ (ให้หยุดและรายงานก่อน ไม่ต้องแก้เอง)
  - ถ้าพบว่าตาราง customer_leads มีคอลัมน์พิกัดอยู่แล้ว — ให้หยุดรายงานทันที ห้ามสร้างซ้ำ
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
| 7 | SCOPE ระบุ path เต็มชัดเจน | ✅ ผ่าน |
| 8 | มีข้อบังคับ branch/PR สำหรับชัย | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ระบุไฟล์แช่แข็งห้ามแตะ | ✅ ผ่าน |
| 11 | กำหนดกฎห้ามเดาพิกัด (ความปลอดภัยหน้างาน) | ✅ ผ่าน |
| 12 | กำหนดให้ตรวจ schema ก่อนสร้างคอลัมน์ | ✅ ผ่าน |
