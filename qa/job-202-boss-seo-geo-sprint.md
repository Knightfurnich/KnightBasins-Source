# ใบงาน 202-B (บอส) — SEO & GEO Sprint: อัปเดต llms.txt, เพิ่ม BreadcrumbList, และเสริม ImageObject สำหรับ Google Images

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**ผู้รับผิดชอบ:** บอส (Aunnop Sengmanee) — ลงมือแก้เองได้เลย
**Branch:** `feat/boss-seo-geo-sprint`
**วัตถุประสงค์:** ยกระดับ SEO & GEO 3 ด้านตามที่บอสเลือก: (1) อัปเดตไฟล์ llms.txt / llms-full.txt ให้ AI อ้างอิงร้านเรา (2) เพิ่ม BreadcrumbList Schema (3) เสริม ImageObject ให้คลังภาพหน้างานจริงเข้าสู่ Google Images

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. อัปเดต /opt/data/cache/kbsrc/artifacts/knight-basins/public/llms.txt และ /opt/data/cache/kbsrc/artifacts/knight-basins/public/llms-full.txt
     - เพิ่มหัวข้อ "งานสั่งผลิตท็อปเคาน์เตอร์ครัวหินสังเคราะห์ (Kitchen Tops / Worktops)" ระบุว่าไร้รอยต่อ ปลอดภัยสัมผัสอาหาร (Food Grade) ไม่บวมน้ำ คราบแกง/กาแฟไม่ซึม ขัดเคลือบผิวใหม่ได้
     - ระบุว่ามีระบบ 2D Studio Configurator ที่คำนวณราคาและออกใบเสนอราคา PDF ได้ทันที (ลิงก์ /studio และ /quote)
     - ระบุบันทึกรุ่น v1.2.0 และลิงก์ /updates
     - เพิ่มหมวดคำถามที่ผู้ใช้ถาม AI บ่อย (Natural-language query intent) เช่น "ท็อปครัวหินสังเคราะห์ราคาเท่าไหร่", "ร้านสั่งตัดท็อปครัวหินสังเคราะห์", "เคาน์เตอร์ครัวหินสังเคราะห์ vs แกรนิต", "ร้านทำท็อปครัวกรุงเทพ/ปริมณฑล"
     - แก้ตัวเลขคลังภาพจาก "180+ ภาพ" เป็นจำนวนจริงที่ตรวจสอบได้ (ดูหัวข้อ "ตัวเลขที่ต้องใช้" ด้านล่าง)
  2. เพิ่ม BreadcrumbList Schema ใน /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/structured-data.ts
     - สร้างฟังก์ชัน buildBreadcrumbListJsonLd(items) หรือเทียบเท่า แล้วเรียกใช้กับหน้า /stone, /portfolio, /studio, /quote (หน้าแรกเป็นระดับบนสุด)
     - ต้องเป็น JSON-LD ที่ถูกต้องตาม schema.org (BreadcrumbList + ListItem + position + name + item)
  3. เสริม ImageObject ในฟังก์ชัน buildPortfolioStructuredData (ไฟล์เดียวกัน)
     - เพิ่มฟิลด์ keywords (จากชื่อหมวดหมู่ + คำอธิบาย), description, และ license/acquireLicensePage แบบไม่มีค่าใช้จ่าย
     - ห้ามใส่ภาพที่หน้าเว็บไม่ได้แสดงจริง (ต้องมาจากรายการ photos ที่โหลดอยู่จริงเท่านั้น)
  4. อัปเดต/เพิ่มเทสต์Static ตรวจสอบ JSON-LD ใหม่และเนื้อหา llms.txt (ดู /opt/data/cache/kbsrc/artifacts/knight-basins/test/jsonld-schema-integrity.test.ts และ /opt/data/cache/kbsrc/artifacts/knight-basins/test/llms-txt-content-integrity.test.ts ที่มีอยู่แล้ว)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/public/llms.txt
  - /opt/data/cache/kbsrc/artifacts/knight-basins/public/llms-full.txt
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/structured-data.ts
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/jsonld-schema-integrity.test.ts
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/llms-txt-content-integrity.test.ts

FORBIDDEN:
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามใส่ราคาที่ไม่ตรงกับ KB (ราคาต้องอ้างจาก llms.txt/llms-full.txt เดิม: เรต 7,500 / 8,500 / 9,500 บาท/ตร.ม. และราคาแผ่นตาม KB)
  - ห้ามใส่ข้อมูลเท็จ เช่น จำนวนภาพที่ไม่มีจริง หรือฟีเจอร์ที่ระบบยังไม่มี
  - ห้ามแตะ /admin หรือข้อมูลลูกค้า และห้ามใส่ชื่อทีมงาน/ช่างลงในไฟล์สาธารณะ
  - ทำงานผ่าน branch: feat/boss-seo-geo-sprint แล้วเปิด PR เข้า main (เดวิดพร้อม merge ให้)

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/boss-seo-geo-sprint ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) node --test test/jsonld-schema-integrity.test.ts test/llms-txt-content-integrity.test.ts → ผ่านทุกข้อ
  4) npm test ใน artifacts/knight-basins (non-browser suite) → เทียบตัวเลข pass/fail กับ baseline ปัจจุบัน
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/knight-basins/public/llms.txt
  - artifacts/knight-basins/public/llms-full.txt
  - artifacts/knight-basins/src/data/structured-data.ts
  - artifacts/knight-basins/test/jsonld-schema-integrity.test.ts
  - artifacts/knight-basins/test/llms-txt-content-integrity.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และเทสต์ทั้งสองไฟล์ผ่านครบ
  - หรือเมื่อทำงานครบ 90 นาที ให้หยุดและรายงานสิ่งที่ทำเสร็จ + สิ่งที่เหลือ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | 3 งาน: llms.txt, Breadcrumb, ImageObject |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 5 ไฟล์ที่ตรวจแล้วมีอยู่จริง |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ CSS, ห้ามใส่ข้อมูลเท็จ, ห้ามใส่ราคาผิด |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | มีคำสั่ง tsc / node test / npm test |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ผลลัพธ์ 5 ไฟล์ |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | ผ่าน 0 errors และ 90 นาที |
| 7 | SCOPE path มีอยู่จริง | ผ่าน | ตรวจกับดิสก์แล้ว |
| 8 | อ้างอิงไฟล์เทสต์เดิม | ผ่าน | ใช้เทสต์ที่มีอยู่ ไม่สร้างใหม่ซ้ำซ้อน |
| 9 | ห้ามแตะ src/index.css | ผ่าน | ระบุชัดเจน 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | feat/boss-seo-geo-sprint |
| 11 | มีเกณฑ์ตัวเลข | ผ่าน | 0 errors / 0 diff |
| 12 | เป็นมิตรกับ CI/CD | ผ่าน | ไม่กระทบ production build |

---

## 📊 ตัวเลขที่ต้องใช้ (ตรวจจาก Production จริงเมื่อ 3 ต.ค. 69 — ห้ามเดา)

ตรวจจาก API และดิสก์ของ Production VPS โดยตรง:

| รายการ | ตัวเลขจริง | ที่มา |
|---|---|---|
| ภาพผลงานที่ **เผยแพร่บนหน้า /portfolio** | **183 ภาพ** | `GET /api/portfolio` → `total: 183` |
| จำนวนหมวดหมู่ | **11 หมวด** | `GET /api/portfolio` → `categories: 11` |
| แคตตาล็อกภาพทั้งหมดที่คัดสรรไว้บนดิสก์ | **647 รายการ** (`catalog.json`) | `/docker/knightbasins/uploads/portfolio/catalog.json` |
| ไฟล์ภาพจริงแยกตามโฟลเดอร์หมวด | **667 ไฟล์** | นับจาก 17 โฟลเดอร์ย่อยใน `uploads/portfolio/` |
| ไฟล์ใน `public.json` (allowlist) | approved **183** / totalCatalog 671 (ณ วันคัด) | `uploads/portfolio/public.json` |
| หน้าผลงานโหลดทีละ | **60 ภาพ** (`PAGE_SIZE = 60`) | `src/pages/PortfolioPage.tsx:32` |

👉 **สรุปที่ถูกต้อง:** ข้อความ "180+ ภาพ" ใน llms.txt **ยังไม่ผิด แต่ต่ำกว่าความจริง** — ตัวเลขที่เผยแพร่จริงคือ **183 ภาพ** และในคลังมีการคัดสรรไว้ถึง **647 รายการ** ที่ยังไม่ได้เผยแพร่
👉 **สิ่งที่ต้องใส่ใน llms.txt:** ใช้ **183 ภาพ** (จำนวนที่หน้าเว็บแสดงจริง) และแก้เป็นตัวเลขที่อัปเดตได้ ไม่ควรเขียนเผื่อเป็น 600+ เพราะหน้าเว็บยังไม่แสดง

## ⚠️ ข้อควรระวังสำคัญเรื่อง ImageObject (ข้อ 3)

ในโค้ดปัจจุบันมี ImageObject อยู่แล้วใน `buildPortfolioStructuredData` (บรรทัด 60–75) แต่ใส่จาก **`photos` ที่โหลดอยู่จริงเท่านั้น** — หน้าเว็บโหลดทีละ 60 ภาพ
ดังนั้น:
1. **ห้ามใส่ภาพ 647 ภาพลง JSON-LD** ถ้าหน้าเว็บไม่ได้แสดง — ผิดหลัก Structured Data (Google ลงโทษได้)
2. งานที่ทำได้จริงและปลอดภัยคือ **เสริมคุณภาพ** ของ ImageObject ที่มีอยู่: `keywords`, `description`, `license`, `acquireLicensePage`
3. ถ้าต้องการให้ Google Images เห็นภาพมากขึ้น ต้อง **เพิ่มจำนวนภาพที่เผยแพร่บนหน้าเว็บ** (งานแยก: เพิ่ม approved count ใน `public.json` ซึ่งต้องให้บอสคัดเลือกเอง)

## 📌 หมายเหตุการรัน
* เครื่องบอสใช้ path `D:\ClaudeCodeWorkSpace\KnightBasins-Source\artifacts\knight-basins` แทน `/opt/data/cache/kbsrc/artifacts/knight-basins`
* บน VPS ไม่มีซอร์ส/เทสต์ — งานนี้ทำบนเครื่องนักพัฒนาเท่านั้น
