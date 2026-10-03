# ใบงาน 206-B (บอส) — FAQ & Portfolio Count Consistency + คัดเลือกภาพเพิ่มเพื่อ Google Images

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**ผู้รับผิดชอบ:** บอส (Aunnop Sengmanee) — งานนี้ต้องใช้ดุลพินิจเจ้าของ (ตรวจข้อมูลธุรกิจ + คัดเลือกภาพ)
**Branch:** `feat/boss-faq-and-photo-curation`
**วัตถุประสงค์:** เก็บตก 2 เรื่องที่ต้องใช้ดุลพินิจเจ้าของ: (1) ตัวเลขภาพผลงาน "กว่า 180 ภาพ" ใน FAQ ยังไม่ตรงกับจำนวนจริง 183 (2) คลังภาพคัดสรรไว้ 647 รายการ แต่เผยแพร่จริงเพียง 183 ทำให้ Google Images เห็นภาพไม่ครบ

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ตรวจและปรับตัวเลขภาพผลงานให้ตรงกันทั้งระบบ (ค่าเดียวกันทั้งหมด):
     - /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/faq-data.ts (ข้อความ "กว่า 180 ภาพ")
     - /opt/data/cache/kbsrc/artifacts/knight-basins/index.html (ถ้ามีข้อความ FAQ/ตัวเลขภาพฝังอยู่)
     - /opt/data/cache/kbsrc/artifacts/knight-basins/public/llms-full.txt (section ที่พูดถึงคลังภาพ)
     - ถ้อยคำที่แนะนำ: "กว่า 180 ภาพผลงานจริง" (ปลอดภัยเมื่อจำนวนเพิ่มขึ้น) หรือระบุ 183 ถ้าต้องการตรงเป๊ะ — ต้องเลือกแล้วใช้เหมือนกันทุกไฟล์
  2. ตัดสินใจเรื่องการเผยแพร่ภาพเพิ่มเพื่อ Google Images (งานคัดเลือกของเจ้าของ):
     - ตรวจรายการที่เผยแพร่จริงตอนนี้ (183 ภาพ จาก GET /api/portfolio) เทียบกับคลังที่คัดสรรไว้ 647 รายการ (uploads/portfolio/catalog.json)
     - คัดเลือกชุดที่จะเผยแพร่เพิ่ม (แนะนำ 150–300 ภาพ เพื่อให้คุณภาพและความเร็วหน้าจอยังดี) ระบุหมวดและ id
     - ถ้าตัดสินใจปรับ allowlist ให้บันทึกว่าใช้วิธีไหน (แก้ uploads/portfolio/public.json บน VPS หรือผ่านหน้า /admin/portfolio) และรายงานก่อน/หลังจำนวน
     - ⚠️ ห้ามลบภาพหรือไฟล์ต้นฉบับใดๆ — งานนี้คือ "เพิ่มการเผยแพร่" เท่านั้น
  3. ห้ามเดาตัวเลข: ทุกตัวเลขที่ใส่ในไฟล์สาธารณะต้องตรงกับที่ตรวจได้จาก API/ดิสก์จริง ณ วันที่แก้
  4. เพิ่ม/ปรับ static test ใน /opt/data/cache/kbsrc/artifacts/knight-basins/test/llms-txt-content-integrity.test.ts ให้ตรวจตัวเลขภาพชุดเดียวกันในทุกไฟล์ (กันการหลุดอีก)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/data/faq-data.ts
  - /opt/data/cache/kbsrc/artifacts/knight-basins/index.html
  - /opt/data/cache/kbsrc/artifacts/knight-basins/public/llms-full.txt
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/llms-txt-content-integrity.test.ts

FORBIDDEN:
  - ห้ามลบ/ย้าย/เขียนทับไฟล์ภาพต้นฉบับใน uploads/portfolio/ ทุกกรณี
  - ห้ามแก้ข้อมูลลูกค้า ใบเสนอราคา ลีด หรือข้อมูลการเงิน
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามใส่ราคาหรือข้อมูลธุรกิจที่ไม่มีใน KB
  - ห้ามใส่ชื่อทีมงาน/ช่างลงในไฟล์สาธารณะ
  - ทำงานผ่าน branch: feat/boss-faq-and-photo-curation แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/boss-faq-and-photo-curation ชัดเจน
  2) คำสั่งและผลจริงที่ใช้ตรวจจำนวนภาพ (เช่น curl https://knightbasins.srv1964473.hstgr.cloud/api/portfolio → total) ก่อนและหลังการเผยแพร่เพิ่ม (ถ้ามี)
  3) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  4) node --test test/llms-txt-content-integrity.test.ts → ผ่านทุกข้อ
  5) npm test ใน artifacts/knight-basins (non-browser suite) → เทียบตัวเลข pass/fail กับ baseline ปัจจุบัน และยืนยัน src/index.css 0 diff

OUTPUT:
  - artifacts/knight-basins/src/data/faq-data.ts
  - artifacts/knight-basins/index.html
  - artifacts/knight-basins/public/llms-full.txt
  - artifacts/knight-basins/test/llms-txt-content-integrity.test.ts

STOP:
  - เมื่อไฟล์สาธารณะทั้ง 3 ใช้ตัวเลขเดียวกัน ตรวจด้วยเทสต์ผ่าน และรายงานจำนวนภาพก่อน/หลัง
  - หรือเมื่อทำงานครบ 90 นาที ให้หยุดและรายงานสิ่งที่ทำเสร็จ + สิ่งที่เหลือ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ตัวเลข FAQ + คัดเลือกภาพเพิ่ม |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 4 ไฟล์ ตรวจแล้วมีจริง |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามลบภาพ ห้ามแก้ข้อมูลลูกค้า |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | มีคำสั่ง curl/tsc/node test |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ผลลัพธ์ |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 90 นาที |
| 7 | SCOPE path มีอยู่จริง | ผ่าน | ตรวจครบ |
| 8 | ระบุว่าต้องใช้ดุลพินิจเจ้าของ | ผ่าน | เรื่องคัดเลือกภาพ |
| 9 | ห้ามแตะ src/index.css | ผ่าน | 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | feat/boss-faq-and-photo-curation |
| 11 | มีเกณฑ์ตัวเลข | ผ่าน | ตัวเลขภาพตรงกันทุกไฟล์ |
| 12 | เป็นมิตรกับ CI/CD | ผ่าน | ไม่กระทบ build |

---

## 📌 ตัวเลขจริงที่เดวิดตรวจจาก Production (3 ต.ค. 69)
| รายการ | จำนวน |
|---|---|
| ภาพที่เผยแพร่จริงบน /portfolio (API total) | **183 ภาพ** |
| หมวดหมู่ | **11 หมวด** |
| แคตตาล็อกที่คัดสรรบนดิสก์ (catalog.json) | **647 รายการ** |
| ไฟล์ภาพแยกตามโฟลเดอร์หมวด | **667 ไฟล์** |
| allowlist ปัจจุบัน (public.json) | approved **183** / totalCatalog 671 (ณ วันคัด 25 ก.ย. 69) |

⚠️ **ข้อควรระวัง:** การเผยแพร่ภาพเพิ่มจะทำให้ JSON-LD ImageObject มีภาพมากขึ้น (ตามที่หน้าเว็บโหลดจริง) ซึ่งดีต่อ Google Images แต่ต้องแลกกับเวลาโหลดหน้าผลงาน — แนะนำทยอยเพิ่มเป็นชุด ไม่เพิ่มทั้งหมด 647 พร้อมกัน
