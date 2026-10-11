# รายงานชัย · ใบงาน 447-C ข้อ C — ข้อความรวมเรื่องรูน้ำล้นระดับแคตตาล็อก (`basinOverflowNote`)

**ผู้ทำ:** ชัย (ผ่าน Claude Code) · **ทำเมื่อ:** 11 ต.ค. 69 ราว 08:00–08:20 น. (เวลาไทย) · **ฐาน:** `main` ที่ `b5fc4a9` · **สาขา:** `feat/chai-basin-overflow-note`
**ขอบเขต:** ข้อ A/B ของ 447-C (label รูปทรงล้วน · `bowlOverflowHole` = null) เสร็จแล้วใน #518 (เดวิดยืนยันบน production) — ใบนี้ทำเฉพาะ **ข้อ C** ตามที่เดวิดสั่ง · ตามคำสั่งเดวิด ไม่ต้องทำส่วนเว็บของ 447-C เพิ่ม
**แตะ:** `artifacts/api-server/src/lib/basin-bowl-shape.ts` (เพิ่มค่าคงที่ + ฟังก์ชัน 1 ตัว) · `artifacts/api-server/src/routes/catalog.ts` (1 บรรทัด) · `artifacts/api-server/test/basin-overflow-note.test.ts` (ใหม่) · `artifacts/api-server/test/catalog-commercial-constants.test.ts` (ปรับ regex ของบรรทัด route ให้ยอมรับส่วนที่เพิ่ม) · รายงาน
**ไม่แตะ:** `src/admin/**` · `src/components/**` · `App.tsx` · `knight-basins/src/data/**` · DB · ราคา/ขนาด/สี/ชื่อ/รหัส

## ชื่อฟิลด์ที่บอยต้องใช้ (448-B) — 1 บรรทัด
**`basinOverflowNote`** — ฟิลด์ระดับบนสุดของ `GET /api/catalog` (ข้างๆ `basins`, `installation` ฯลฯ ไม่ใช่ในแต่ละอ่าง) ค่าเป็นสตริงเดียว: `อ่างทุกรุ่นสั่งทำได้ทั้งแบบมีและไม่มีรูน้ำล้น (ปกติโรงงานทำให้แบบไม่มี) — ถ้าต้องการแบบมี แจ้งทีมขายได้` (ข้อความที่บอสอนุมัติ — ส่งจาก API ที่เดียว ห้ามเว็บพิมพ์เอง)

## สรุป 5 บรรทัด
1. **ทำอะไร:** เพิ่มฟิลด์ระดับแคตตาล็อก `basinOverflowNote` ใน `GET /api/catalog` (ข้อความที่บอสอนุมัติ ตรงตัวอักษร) — เพิ่มเฉพาะคีย์ใหม่ ไม่แก้คีย์เดิม
2. **เทสต์:** api-server 1306 / ผ่าน 1300 / ตก 6 (5 ข้อชุดเดิม Windows + `admin-discount-authorization.test.ts` ที่ตกเฉพาะตอนรันทั้งชุด แต่ผ่าน 24/24 เมื่อรันเดี่ยว — ไม่เกี่ยวกับงานนี้) · เทสต์ใหม่ 6 ข้อผ่านหมด · พิสูจน์สองทาง 5 แบบ · tsc ไม่มี error ใหม่ · web ไม่ได้แตะไฟล์ใด จึงไม่ได้รันซ้ำในใบนี้
3. **ตรวจไม่ได้:** ผล `/api/catalog` บน production หลัง deploy · การแสดงผลบนหน้าเว็บ (งาน 448-B ของบอย)
4. **ความเสี่ยง:** ข้อความเป็นภาษาไทยหนึ่งบรรทัดยาวพอควร ฝั่งเว็บต้องให้ตัดบรรทัดได้ที่ 390/360 (บอยทราบในใบ 448-B) · ถ้าบอสแก้ถ้อยคำ ต้องแก้ที่ค่าคงที่เดียวใน `basin-bowl-shape.ts` และเทสต์ (เทสต์ล็อกตัวอักษรไว้ ตั้งใจให้ตกเมื่อมีใครแก้โดยไม่ได้รับคำสั่ง)
5. **ข้อเสนอ:** บอยทำ 448-B ต่อ (อ่าน `basinOverflowNote` แสดงบรรทัดเดียวที่หน้ารายการอ่าง ไม่พิมพ์เอง) · ถ้าต่อไปต้องให้บอสแก้ข้อความเองผ่านแอดมิน ให้ออกใบเก็บข้อความใน DB

## 0–1. baseline และคำสั่งตรวจฟีด
- ผู้รัน: ชัย · Windows 11 · ฐาน `b5fc4a9` · คำสั่ง: `cd artifacts/api-server && node --experimental-strip-types --test test/*.test.ts` · baseline Linux ของเดวิด (`ad3b8cc4`): api 1,287 / 1,287 (คนละเครื่อง) · `tsc --noEmit`: api-server ไม่มี error ใหม่ (4 error เดิม `speakingRate`/`enabled`)
```bash
curl -s https://knightbasins.com/api/catalog | python3 -c "import json,sys;d=json.load(sys.stdin);print([(b['sku'],b['bowlShapeLabel'],b.get('bowlOverflowHole')) for b in d['basins'] if b.get('bowlShapeLabel')][:5]);print(d.get('basinOverflowNote'))"
```
- ก่อน (production ขณะนี้): บรรทัดสุดท้ายพิมพ์ `None` · หลัง deploy ต้องได้ข้อความข้างบน และรายการ 5 รุ่นแรกยังเป็นรูปทรงล้วน `bowlOverflowHole` = None — **ตรวจบน production ไม่ได้จนกว่าจะ deploy**
- ตรวจ `grep -rn "รูน้ำล้น" artifacts/api-server/src/lib/basin-bowl-shape.ts` → เหลือ **บรรทัดเดียว** คือข้อความรวมนี้เอง (เทสต์ล็อกไว้)

## 2. เทสต์และพิสูจน์สองทาง
เทสต์ใหม่ `artifacts/api-server/test/basin-overflow-note.test.ts` (6 ข้อ): ข้อความตรงตามที่บอสอนุมัติ ตัวอักษรต่อตัวอักษร และเป็นบรรทัดเดียว · ส่งด้วยชื่อฟิลด์ `basinOverflowNote` และไม่มีคีย์อื่นเพิ่ม · `GET /api/catalog` spread ต่อท้ายแถวและค่าคงที่การค้า (อ่านจากซอร์ส) · วลี "รูน้ำล้น" ในโค้ดรูปทรงมีบรรทัดเดียวคือข้อความรวม · ไม่มี label (ทุกรูปทรง ทุกรุ่นที่ seed) พูดถึงรูน้ำล้น และ `bowlOverflowHole` เป็น null · ข้อความรวมไม่ระบุรุ่น/รูปทรงใด

| ย้อน/ถอด | ผล | คืน |
|---|---|---|
| เปลี่ยนถ้อยคำของข้อความรวม | **ตก 2** | ผ่าน 6/6 |
| เปลี่ยนชื่อฟิลด์ | **ตก 1** | ผ่าน |
| route ไม่ส่งฟิลด์ | **ตก 1** | ผ่าน |
| label กลับไปมีวลี "ไม่มีรูน้ำล้น" | **ตก 2** | ผ่าน |
| พิมพ์วลีรูน้ำล้นซ้ำที่อื่นในไฟล์รูปทรง | **ตก 1** | ผ่าน |

เวลา: 11 ต.ค. 69 ราว 08:15 น. · ฐาน `b5fc4a9`
