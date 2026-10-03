# ใบงาน 212 (ชัย + บอส) — Studio C: Transparent Top-View Basin Assets & Styling

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม) · **ร่างเนื้อหาโดย:** ชัย (ตามที่เดวิดอนุมัติ)
**ผู้รับผิดชอบ:** ชัย (ภาพ + โค้ด) · บอส (อนุมัติและอัปโหลดผ่านหลังบ้าน) · **ทำขนานกับ 209–211 ได้**
**Branch:** `feat/chai-studio-transparent-basin-assets`
**ที่มา:** รูปอ่างบนผังมีกรอบภาพสี่เหลี่ยม ตรวจแล้วภาพ top view ทั้ง 30 รุ่นเป็น JPEG 1024×1024 ไม่มี alpha พื้นเทา ~RGB(223,222,218) และ CSS ใส่ `object-fit: cover` + เงา + ขอบมน
**การอนุมัติจากเดวิด:** แก้ `src/index.css` เป็นข้อยกเว้นเฉพาะจุด (Scoped Exemption) ในคลาส `.studio-basin-*` และ `.studio-placement*` เท่านั้น (เหมือนกรณี @media print ใน Job 204) · เริ่มนำร่อง 3 รุ่น (KF001, KF002, KF003) ให้บอสอนุมัติก่อน แล้วเดวิดหรือบอสอัปที่เหลือผ่านหลังบ้าน

```
GOAL:
  1. ทำภาพ top view ตัดพื้นหลัง (PNG โปร่งใส) 30 รุ่น จาก JPEG เดิม ด้วยสคริปต์ช่วยตัด (rembg หรือ OpenCV GrabCut) บนเครื่องนักพัฒนาเท่านั้น (ไม่เพิ่ม dependency เข้า repo)
     - ผลลัพธ์: PNG ต่อ SKU ขนาดไม่เกิน ~400 KB + manifest.json (sku → ไฟล์) + Contact Sheet ของ 30 รุ่นบนพื้นหลังสีหินอ่อนและเข้ม ส่งให้บอสตรวจ
     - อ่างขาวบนพื้นเทาอ่อนตัดอัตโนมัติผิดง่าย: ไล่ดูทีละภาพ รายงานรายการที่ต้องแก้มือ
     - เริ่มรอบนำร่อง 3 รุ่น (KF001, KF002, KF003) ส่งให้บอสดูบนจอจริงก่อน แล้วค่อยทำที่เหลือ
  2. การอัปโหลดและเปลี่ยน topViewImageUrl บน Production เป็นการเขียนข้อมูลจริง: ชัยเตรียมไฟล์ให้ บอสหรือเดวิดอัปผ่านหลังบ้านช่อง Top View (pipeline รองรับ PNG/WebP และเก็บ alpha ตามต้นฉบับอยู่แล้ว; ชื่อไฟล์ต้องตรง catalog-<id>-<hex16>.<ext>) · เก็บ JPG เดิมไว้ (rollback) และบันทึกรายการ URL เดิมในรายงาน
  3. แก้ BasinTopView (StudioPage.tsx ~บรรทัด 3194): เมื่อภาพเป็น PNG/WebP (ตัดพื้นหลังแล้ว) ใช้ object-fit: contain ไม่มีกรอบ/ขอบมน/เงาสี่เหลี่ยม ใช้ filter: drop-shadow ตามรูปอ่างแทน; ภาพ JPG เดิมยังแสดงแบบเดิมเป็น fallback จนกว่าจะเปลี่ยนครบ; ภาพโหลดไม่ได้ → SVG/CSS rim & bowl เดิม
  4. เทสต์: static ตรวจแยกคลาสภาพตัดพื้นหลังกับภาพเดิม + ตรวจ manifest/ไฟล์ PNG (ทุกไฟล์มี alpha และมุมภาพโปร่งใส)

SCOPE:
  - artifacts/knight-basins/src/components/StudioPage.tsx (BasinTopView เท่านั้น)
  - artifacts/knight-basins/src/index.css (ข้อยกเว้น: เฉพาะคลาส .studio-basin-* และ .studio-placement*)
  - artifacts/knight-basins/test/ (ไฟล์ใหม่)
  - โฟลเดอร์ทำงานภายนอก repo สำหรับสคริปต์/ไฟล์ภาพ (ส่งมอบเป็นไฟล์ให้บอส ไม่ commit ภาพขนาดใหญ่)

FORBIDDEN:
  - ห้ามแตะ index.css นอกคลาส .studio-basin-* / .studio-placement* หรือกระทบเลย์เอาต์ส่วนอื่น
  - ห้ามเขียนข้อมูล Production (อัปโหลด/เปลี่ยนแคตตาล็อก) โดยไม่ผ่านการอนุมัติของบอส; ห้ามลบ JPG เดิม
  - ห้ามใช้ mix-blend-mode: multiply เป็นทางแก้หลัก (หินสีเข้มทำให้อ่างมืด)
  - ห้ามลบ/ปิดเทสต์เพื่อให้ผ่าน
  - ทำงานผ่าน branch: feat/chai-studio-transparent-basin-assets แล้วเปิด PR เข้า main

EVIDENCE (แนบผลรันจริงทุกข้อ):
  1) git status + branch
  2) จำนวน PNG 30/30 (หรือ 3/3 ตอนนำร่อง) + ตรวจ alpha ทุกไฟล์ + ขนาดไฟล์ต่อรุ่น + manifest.json
  3) Contact Sheet บนพื้นสีอ่อน/เข้ม + รายการภาพที่ต้องแก้มือ
  4) git diff index.css (เฉพาะคลาสที่อนุญาต) · tsc knight-basins → 0 errors
  5) เทสต์ผ่าน (ระบุไฟล์+จำนวน) · npm test non-browser เทียบ baseline (และ CI บน GitHub)
  6) ภาพหน้าจอสดบน Production หลังบอสอนุมัติและอัปโหลด: อ่างบนหินสีอ่อนและเข้ม ไม่มีกรอบสี่เหลี่ยม

OUTPUT:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/src/index.css (เฉพาะคลาสที่อนุญาต)
  - artifacts/knight-basins/test/ (ไฟล์เทสต์)
  - ชุดภาพ PNG + manifest.json + Contact Sheet (ส่งให้บอสนอก repo)

STOP:
  - เมื่อส่งไฟล์ครบและโค้ดผ่านเทสต์ (ถ้าติดการอนุมัติของบอส ให้หยุดและรายงานสิ่งที่ค้าง)
  - หรือเมื่อทำงานครบ 40 turns ให้หยุดและรายงาน
```
