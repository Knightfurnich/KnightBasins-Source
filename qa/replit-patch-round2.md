# วิธีใช้ patch ที่แนบมา — KnightDesign รอบ 2

ไฟล์: `replit-patch-round2.diff` (unified diff · 3 ไฟล์ · 75 บรรทัด)
ฐาน: commit `ad1f47c` (ตรวจแล้วว่า apply เข้า repo ได้จริง: `git apply --check` ผ่านทั้ง 3 ไฟล์)

## วิธีใช้
```sh
git apply replit-patch-round2.diff      # หรือ
patch -p1 < replit-patch-round2.diff
```

## patch ทำอะไร

**1. `artifacts/knightdesign-web/src/lib/sink-geometry.ts`**
`normalized.startsWith("Ø") || normalized.startsWith("ø")` → `/^[ØøDd⌀]/.test(normalized)`
เหตุผล: ฝั่งข้อมูลเคยส่ง `"D350x150"` (D ASCII) แล้วหลุดไป branch สี่เหลี่ยม → วาด 0.35 × 0.15 ม.
แทนวงกลม Ø0.35 ม. (วัดจริงบน production ด้วย DOM: 32×14 px สเกล 92 px/ม.)
ตอนนี้ฝั่งผมแก้ข้อมูลเป็น `Ø350x150` แล้ว แต่ควรกันที่ parser ด้วย ไม่งั้นข้อมูลเพี้ยนอีก = พังเงียบ

**2. `artifacts/knightdesign-web/src/lib/sink-geometry.regression.ts`**
เพิ่มเคส `"D350x150"`, `"d350x150"`, `"⌀350x150"` → ต้องได้ `{ shape: "circle", 0.35, 0.35 }`

**3. `artifacts/knightdesign-web/src/pages/design.tsx`** (ตัวกรองค้นหาสี)
`normalizeCode(colour.code) === codeQuery` → `.includes(codeQuery)` + เรียง "รหัสที่ตรงเป๊ะ" ขึ้นก่อน
เหตุผล: ป้ายในช่องเขียนว่า "ค้นหาสีจากรหัสหรือชื่อ" แต่ค้นรหัสแบบตรงตัว
วัดจริงบน production: พิมพ์ `SG` → 0 รายการ · `420` → 0 รายการ · `SG420` → 1
หลังแก้ (จำลองกับข้อมูลจริง 145 รหัส): `SG` → เจอ `SG 420` · `420` → เจอ `SG 420` · `sg 420` → เจอ (4 ตัวแรกของผลลัพธ์)

## หลักฐานจากฝั่งผม (รันจริง ไม่ใช่คำรับรอง)
```
git apply --check replit-patch-round2.diff   -> APPLY=OK (ทั้ง 3 ไฟล์)
node --experimental-strip-types ...sink-geometry.regression.ts (ไฟล์ที่ patch)
    -> "Sink bowl geometry regression checks passed."
จำลองการกรองด้วยข้อมูลจริงจาก /api/pricing/catalogue (145 รหัส):
    'SG'      -> ['SG 420']
    '420'     -> ['SG 420']
    'KZ802'   -> ['KZ802', 'KZ802N']   (ตรงเป๊ะอยู่บนสุด · KZ802 ≠ KZ802N ไม่ถูกยุบรวม)
    'Sanded'  -> ['SO 423','SH 428','SG 420','SI 414','SS 440']   (ค้นชื่อยังเหมือนเดิม)
```

## เกณฑ์ตรวจรับหลัง apply
```
1. พิมพ์ "SG" และ "420" ในช่องค้นหาสี -> ต้องเจอ SG 420 (เดิม 0 รายการ)
2. พิมพ์ "KZ802" -> KZ802 ต้องขึ้นก่อน KZ802N และต้องเป็น 2 การ์ดแยกกัน (ไม่ยุบรวม)
3. KF023 -> ช่องเจาะวงกลม กว้าง = สูง (0.35 ม.) · border-radius 9999px
4. KF003 -> ยังเป็นสี่เหลี่ยม 0.35 x 0.50 ม. · KF029 -> ยังขึ้น "ขนาดหลุมอ่างไม่ระบุในแคตตาล็อก"
5. ราคา 0.60 x 1.80 SG420 กทม. ต้องยังเป็น 14,180 / VAT 992.6 / รวม 15,172.6
```

⛔ ข้อห้าม: อย่าแตะ auth/ล็อกอิน · อย่าแก้ persona ผู้ช่วยในเว็บ (ตอนนี้เสียงหญิง ใช้ ค่ะ/คะ ชื่อแสดง "น้องไนท์")
รายงาน: ข้อ | สถานะ | ไฟล์ที่แก้ | หลักฐานจริง (คำสั่ง + ผล) — เรื่องที่ 1-2 ต้องมีค่าที่วัดจาก DOM จริง
