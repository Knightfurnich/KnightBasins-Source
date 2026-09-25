# ใบงาน 51 (ชัย) — เชื่อมต่อภาพถ่ายหน้างานจริง (Site Photos) แสดงในการ์ด Lead (/admin/leads)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** หลังจากที่เรามีระบบจัดเก็บภาพถ่ายหน้างานจริง (Site Photos) และแสดงผลในหน้า `/admin/site-photos` แล้ว ทีมงานต้องการให้ภาพหน้างานเหล่านั้นไปปรากฏในหน้ารายละเอียดลูกค้า (`/admin/leads`) ด้วย เพื่อให้แอดมินและฝ่ายขายสามารถเปิดดูรูปหน้างานจริงที่ช่างส่งมาประกอบกับข้อมูล Lead รายนั้น ๆ ได้ในที่เดียว

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  แสดงภาพถ่ายหน้างานจริงในหน้ารายละเอียด Lead แต่ละรายการ:
  1. ใน `LeadsManager.tsx`:
     - นำเข้า `useListAdminSitePhotos` จาก `@workspace/api-client-react`
     - จับคู่ภาพหน้างานเข้ากับ Lead ด้วย `photo.leadId === lead.id` หรือจับคู่รหัสงานที่ตรงกัน
     - ในแถวแสดงรายละเอียดเมื่อคลิกขยาย Lead แต่ละรายการ (Expanded Lead View):
       - แสดงหัวข้อ `📸 ภาพถ่ายหน้างานจริง` พร้อมจำนวนภาพ
       - แสดงรูปภาพขนาดเล็ก (Thumbnails) เรียงต่อกัน พร้อมป้ายสถานะขั้นตอน (`📐 วัดงาน`, `🛠️ ติดตั้ง`, `🔧 เก็บงาน`, `✅ เสร็จสมบูรณ์`)
       - คลิกที่รูปภาพเพื่อเปิด Modal ดูภาพขนาดใหญ่ได้
       - กรณีไม่มีภาพหน้างาน ให้แสดงข้อความ `ยังไม่มีภาพหน้างาน`
  2. เขียน Unit tests ใน `admin-leads-site-photos.test.ts` ยืนยันการจับคู่ภาพถ่ายกับ Lead ถูกต้อง

SCOPE (absolute path — ชัย):
  1. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/LeadsManager.tsx
  2. /opt/data/cache/kbsrc/artifacts/knight-basins/test/admin-leads-site-photos.test.ts (ใหม่)

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx
  - ห้ามแตะ index.css, @media print หรือ .formal-*
  - ห้ามแตะ lib/db/ หรือ deploy/
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-leads-site-photos แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  3) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 226 / pass 221 / fail 2 / cancelled 3 (non-browser tests ผ่าน 100%)
  4) เทสต์ใหม่ใน admin-leads-site-photos.test.ts ยืนยัน:
     - การจับคู่ภาพหน้างานกับ Lead id หรือ jobCode ถูกต้อง
     - แสดงป้ายขั้นตอน (Stage Badges) ตรงตามข้อมูล

OUTPUT:
  - branch: feat/chai-leads-site-photos (เปิด PR เข้า main รอตรวจ)
  - 2 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 4 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้าเทสต์ตกเกิน baseline เดิม (fail > 2)
  - ถ้า typecheck มี error TS
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. ใน LeadsManager.tsx:
     - นำเข้า:
       `import { useListAdminSitePhotos } from "@workspace/api-client-react";`
     - จับคู่ภาพ:
       ```ts
       const leadPhotos = useMemo(() => {
         return (allPhotos ?? []).filter((p) => {
           if (p.leadId && p.leadId === lead.id) return true;
           if (p.jobCode && lead.quoteNumber && p.jobCode.includes(lead.quoteNumber)) return true;
           return false;
         });
       }, [allPhotos, lead]);
       ```
     - ป้ายสถานะขั้นตอน:
       - `survey`: "📐 วัดหน้างาน"
       - `installation`: "🛠️ ติดตั้ง"
       - `service`: "🔧 เก็บงาน"
       - `completed`: "✅ เสร็จสมบูรณ์"
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ เชื่อมต่อภาพหน้างานจริงแสดงในการ์ด Lead |
| 2 | GOAL วัดได้ | ✅ ดึงภาพ + filter ตาม lead + แสดง gallery + เทสต์ |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 2 ไฟล์ absolute ชัยเข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแตะ StudioPage, ห้ามแตะ Print CSS |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ typecheck + npm test 226/221/2 |
| 6 | OUTPUT ชัด | ✅ branch feat/chai-leads-site-photos |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน fail > 2 |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 226 / pass 221 / fail 2 |
| 9 | CONTRACT ระบุโค้ดฟิลเตอร์และป้ายชัด | ✅ โค้ด filter และ 4 ป้ายขั้นตอนชัดเจน |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ absolute path ทั้งหมด |
