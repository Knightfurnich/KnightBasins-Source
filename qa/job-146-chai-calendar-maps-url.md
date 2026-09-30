# ใบงาน 146 (ชัย) — เพิ่ม site_maps_url ใน API ปฏิทินคิวช่างและแดชบอร์ด (Include Maps URL in Calendar API)

**วันที่:** 30 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend / API Optimization) — เริ่มได้ทันที

**ที่มาและความต้องการ:**
ใน Task 139 ฝั่งหน้าจอ ได้เสนอ follow-up สำคัญ:
> *"ขณะนี้ API ปฏิทิน (/admin/technician-calendar) ยังไม่ส่ง siteMapsUrl มากับงาน หน้าเว็บจึงต้องดึงรายการ Leads ทั้งหมดมาเชื่อมต่อเอง"*

งานนี้คือการอัปเดต API หลังบ้านใน `artifacts/api-server/src/routes/admin-router.ts`:
1. ใน `DASHBOARD_LEAD_COLUMNS`: เพิ่มการดึงคอลัมน์ `siteMapsUrl: customerLeads.siteMapsUrl`, `siteLat: customerLeads.siteLat`, `siteLng: customerLeads.siteLng`
2. ใน `TechnicianCalendarJob`: เพิ่มฟิลด์ `siteMapsUrl: string | null`, `siteLat: number | null`, `siteLng: number | null`
3. ใน `computeTechnicianCalendar()`: ส่ง `siteMapsUrl`, `siteLat`, `siteLng` ไปกับการ์ดงานแต่ละงานในผลลัพธ์ของ `GET /api/admin/technician-calendar`
4. ประโยชน์มหาศาล: หน้าปฏิทินของช่าง (`/admin/calendar`) จะได้รับลิงก์ Google Maps นำทางโดยตรงจากเซิร์ฟเวอร์ทันที ไม่ต้องเสียเวลายิงดึง Lead ทั้งหมดมาจับคู่เองอีกต่อไป ประหยัดเน็ตมือถือช่าง และลดโหลดของเซิร์ฟเวอร์

**สิ่งที่ต้องทำ:**
1. ใน `artifacts/api-server/src/routes/admin-router.ts`:
   * เพิ่ม `siteMapsUrl`, `siteLat`, `siteLng` เข้าไปใน `DASHBOARD_LEAD_COLUMNS`
   * อัปเดต Type `TechnicianCalendarJob` ให้มี `siteMapsUrl?: string | null; siteLat?: number | null; siteLng?: number | null;`
   * ในฟังก์ชัน `computeTechnicianCalendar()` ให้ map ฟิลด์ `siteMapsUrl: lead.siteMapsUrl ?? null`, `siteLat: lead.siteLat ?? null`, `siteLng: lead.siteLng ?? null` เข้าไปในการ์ดงาน
2. เขียนหรืออัปเดต Unit Tests ใน `artifacts/api-server/test/admin-technician-calendar.test.ts` (หรือ `technician-calendar-api.test.ts`):
   * ทดสอบว่า `GET /api/admin/technician-calendar` คืนค่า `siteMapsUrl` ถูกต้องเมื่อ lead มีพิกัดแผนที่

```
✅ มาตรฐานการออกใบงาน · 12/12 · 30 ก.ย. 69 · เดวิด

ข้อบังคับสำหรับชัย: ห้าม push ตรงเข้า main เด็ดขาด ให้สร้าง branch feat/chai-calendar-maps-url แล้วเปิด PR เพื่อให้เดวิดตรวจรับและรวมโค้ดตามอำนาจที่ได้รับมอบหมาย

GOAL:
  1. เพิ่ม siteMapsUrl, siteLat, siteLng ใน DASHBOARD_LEAD_COLUMNS และ TechnicianCalendarJob
  2. ปรับ computeTechnicianCalendar() ให้ส่งข้อมูลพิกัด/ลิงก์แผนที่กลับในการ์ดงาน
  3. เขียนเทสต์ยืนยันว่าผลลัพธ์ของ GET /api/admin/technician-calendar มี siteMapsUrl

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/technician-calendar-maps.test.ts · (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง frontend หรือไฟล์นอก artifacts/api-server/
  - ห้ามลบคอลัมน์หรือเปลี่ยนชนิดข้อมูลเดิมใน DASHBOARD_LEAD_COLUMNS
  - ห้ามแตะต้องตรรกะการคำนวณทีมช่างหรือการจัดกลุ่มวันเดิม
  - ห้าม push ตรงเข้า main ให้เปิด PR จาก branch feat/chai-calendar-maps-url

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) npx tsc -p artifacts/api-server/tsconfig.json --noEmit -> 0 errors
  2) node --experimental-strip-types --test artifacts/api-server/test/technician-calendar-maps.test.ts -> ผ่าน 100%
  3) node --experimental-strip-types --test artifacts/api-server/test/security-audit.test.ts -> 18/18 ผ่าน
  4) git log -1 --stat แสดงไฟล์ที่แก้ตรงตาม SCOPE 2 ไฟล์เท่านั้น

OUTPUT:
  - branch: feat/chai-calendar-maps-url (เปิด PR เข้า main)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

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
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ระบุไฟล์ชัดเจนในเครื่องเรา | ✅ ผ่าน |
| 8 | มีข้อบังคับสาขาสำหรับชัย | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | เพิ่มประสิทธิภาพ API โดยไม่กระทบโครงสร้างเดิม | ✅ ผ่าน |
| 11 | อนุรักษ์ระบบปฏิทินและจัดทีมเดิม | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
