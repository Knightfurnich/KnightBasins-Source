# ใบงาน 250-R (รีพิต) — UI 4 จุดในใบงานเดียว: ปุ่มเสียง · ข้อความต้อนรับ · หน้า /updates · ต้นทุนเฉลี่ยเป็นบาท

**วันที่:** 4 ต.ค. 69 (รวมใบงาน 252 + 253 เข้า 250 ตามคำสั่งบอส) · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit (รีพิต) · **1 ใบงาน = 1 สาขา = 1 PR** (บอสขอรวมเพื่อให้ทำงานทัน)
**Branch:** `fix/replit-ui-bundle-voice-greeting-updates-cost`

**วิธีทำ (สำคัญ):** ทำ **ทีละไฟล์ให้จบก่อน** แล้ว commit ทันที — อย่าข้ามไปข้ามมา ถ้ารู้สึกว่าใกล้ชนเพดานรอบ ให้หยุดและรายงานสิ่งที่เสร็จ/เหลือ (บทเรียนจากงานก่อน: งานหลายไฟล์รวบเดียวเคยล้มเพราะเพดานรอบ)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. ปุ่มเปิด/ปิดเสียงน้องไนท์ให้ "มองเห็นได้ชัดทั้งสองสถานะ" — ไฟล์ artifacts/knight-basins/src/admin/AdminVoiceSettings.tsx
     อาการจริง: ปุ่ม (role="switch") มีและกดได้ แต่ตอน "ปิด" วาดเป็นสีขาวบนการ์ดสีขาว
     (ราง bg-[var(--card-paper)] + ลูกบิด bg-[var(--paper)]) เหลือแค่เส้นขอบบาง ๆ → บอสหาปุ่มไม่เจอ
     แก้: ให้สถานะปิดมีสีตัดกันชัด (ราง/ขอบชัด + ลูกบิดขาวมีเงา) และมีข้อความกำกับที่อ่านออกชัด
     ⚠️ ห้ามเปลี่ยนค่าเริ่มต้นของระบบ (ต้องคง "ปิด" โดยค่าเริ่มต้น เพราะ TTS มีค่าใช้จ่าย)
  2. ข้อความต้อนรับของน้องไนท์ (web chat) ให้สั้นกระชับ — ไฟล์ artifacts/knight-basins/src/components/KnightSupport.tsx
     ข้อความเดิม (ยาว 3 บรรทัด): สวัสดีค่ะ น้องไนท์ยินดีให้บริการค่ะ 💬 / โหมดทั่วไป (ยังไม่เข้าสู่ระบบ): ค้นหาราคาอ่างล้างหน้า รหัสสีหิน ขนาด และวิดีโอ 3D 360° เช่น "KF001" "BW010" / เข้าสู่ระบบด้วย LINE เพื่อปรึกษาการออกแบบ การชำระเงิน การติดตามใบเสนอราคา และคุยกับน้องไนท์โหมดเต็มแบบเดียวกับใน LINE
     ข้อความใหม่ (ให้ใช้ตามนี้ · ถ้าบอสสั่งแก้คำในคอมเมนต์ PR ให้แก้ตาม):
       สวัสดีค่ะ น้องไนท์พร้อมช่วยค่ะ 💬
       • ดูราคา/สี/ขนาด/วิดีโอ 3D: พิมพ์รหัส เช่น KF001, BW010
       • ปรึกษาออกแบบ/ชำระเงิน/ติดตามใบเสนอราคา: เข้าสู่ระบบด้วย LINE
     ต้องอัปเดตเทสต์ที่ล็อกข้อความเดิม: artifacts/knight-basins/test/support-guest-scope-ui.test.ts (ห้ามลบเทสต์)
  3. หน้า /updates — ไฟล์ artifacts/knight-basins/src/pages/UpdatesPage.tsx
     (ก) ตัดคำนำ "Release vX.Y.Z — " ออกจากหัวเรื่องทุกใบ (มี 4 รุ่น: v2.2.1 · v2.2.0 · v2.1.0 · v2.0.0) ให้เริ่มด้วยข้อความไทยแบบรุ่นก่อนหน้า (เลขรุ่นโชว์ที่ badge ขวาอยู่แล้ว)
     (ข) ทำหัวเรื่อง/ป้าย/รายการให้เป็นไทยกระชับสั้นเหมือนรุ่นก่อน — เลิกใช้สตริงอังกฤษยาวเป็น badge (เช่น "Security, Smart Studio & DevOps")
         ตัวเรนเดอร์เป็นชุดเดียวกันทั้งหน้า (ไม่ต้องแก้ CSS) — ความต่างที่บอสเห็นมาจากเนื้อหาที่ยาว ถ้าเจอขนาดฟอนต์ต่างจริงให้แก้ให้ตรงกัน
     (ค) รวบรุ่นเล็กเข้าด้วยกัน: รวม v2.2.0 เข้ากับ v2.2.1 เป็นรุ่นเดียว (label v2.2.1 · คงคำว่า "รุ่นล่าสุด" ใน badge)
         เก็บข้อเท็จจริงสำคัญของทั้งสองไว้ครบ (Support Chat & System Stability + เลขใบเสนอราคา QT-YYYYMM-TYPE-NNNN แบบ atomic) รุ่นอื่นคงรายการเดิม
     ต้องอัปเดตเทสต์ที่ผูกข้อความเดิม (ห้ามลบเทสต์ · คงการกันข้อเท็จจริงเดิม: ห้ามมีคำว่า "10 เท่า" · ต้องมี "88.4% (13.71 MB → 1.60 MB)"):
       artifacts/knight-basins/test/updates-page.test.ts · test/updates-page-v200.test.ts · test/llms-txt-content-integrity.test.ts · test/release-v120.test.ts
  4. การ์ด "ต้นทุนเฉลี่ยต่อคำขอ" ในหน้า /admin/ai-cost ให้แสดงเป็น "บาท" — ไฟล์ artifacts/knight-basins/src/admin/AiCostCenterPage.tsx (บรรทัด ~461)
     ปัจจุบัน: `${decimalFormatter.format(averageSatang)} สตางค์` (เช่น 8,855.94 สตางค์) โดย averageSatang = (totalCostThb * 100) / totalRequests
     ต้องเป็น: บาท ทศนิยม 2 ตำแหน่ง (เช่น 88.56 บาท หรือ ฿88.56 — เลือกแบบเดียวให้สอดคล้องทั้งหน้า)
     ห้ามเปลี่ยนสูตรคำนวณ · ค่า 0 ต้องแสดง 0.00 บาท (ห้าม NaN/Infinity) · ตรวจทั้งหน้าไม่ให้เหลือคำว่า "สตางค์" (รวมข้อความส่งออก LINE/CSV)
     ถ้ามีเทสต์ผูกข้อความ "สตางค์" ให้อัปเดต: artifacts/knight-basins/test/ai-cost-center-ui.test.ts

SCOPE:
  - artifacts/knight-basins/src/admin/AdminVoiceSettings.tsx
  - artifacts/knight-basins/src/components/KnightSupport.tsx
  - artifacts/knight-basins/src/pages/UpdatesPage.tsx
  - artifacts/knight-basins/src/admin/AiCostCenterPage.tsx
  - artifacts/knight-basins/test/support-guest-scope-ui.test.ts
  - artifacts/knight-basins/test/updates-page.test.ts
  - artifacts/knight-basins/test/updates-page-v200.test.ts
  - artifacts/knight-basins/test/llms-txt-content-integrity.test.ts
  - artifacts/knight-basins/test/release-v120.test.ts
  - artifacts/knight-basins/test/ai-cost-center-ui.test.ts

FORBIDDEN:
  - ห้ามแตะ src/index.css (ไฟล์แช่แข็ง)
  - ห้ามแตะ src/data/** และ artifacts/api-server/** (ขอบเขตของชัย — รวมใบงาน 254 ที่กำลังเดินอยู่)
  - ห้ามลบเทสต์หรือทำให้ assert ที่ตรวจข้อเท็จจริงอ่อนลง
  - ห้ามเปลี่ยนค่าเริ่มต้น enabled ของระบบเสียง · ห้ามเปลี่ยนสูตรต้นทุน · ห้ามเพิ่มเลขรุ่นใหม่หรืออ้างผลลัพธ์ที่ยังไม่วัด
  - ห้ามแตะ Production · ห้าม push ตรง main · ใช้ GitHub Connection เท่านั้น

EVIDENCE:
  1) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  2) node --experimental-strip-types --test test/studio-*.test.ts test/sketch-*.test.ts ใน artifacts/knight-basins → ระบุ tests/pass/fail (baseline ปัจจุบัน 418/416/0/2)
  3) รันเทสต์ที่แก้โดยตรงทั้ง 6 ไฟล์ → ผ่านทุกข้อ
  4) ตรวจด้วยคำสั่ง 2 ข้อ ต้องได้ 0 ทั้งคู่:
       grep -c 'title: "Release v' artifacts/knight-basins/src/pages/UpdatesPage.tsx
       grep -c 'สตางค์' artifacts/knight-basins/src/admin/AiCostCenterPage.tsx
  5) แนบภาพหน้าจอ "ก่อน/หลัง" ให้ครบ 4 จุด: ปุ่มเสียง (ตอนปิด ต้องเห็นชัด) · ข้อความต้อนรับ · หน้า /updates (การ์ดหายไป 1 ใบ + หัวเรื่องไทย) · การ์ดต้นทุนเฉลี่ย (หน่วยเป็นบาท)
  6) git diff main...HEAD -- artifacts/knight-basins/src/index.css | wc -l → 0

OUTPUT:
  - ไฟล์ UI 4 ไฟล์ + เทสต์ที่อัปเดต 6 ไฟล์
  - PR เดียวเข้า main พร้อมภาพก่อน/หลัง 4 คู่ · ผลรันจริง · ผล grep 2 ข้อ
  - สรุปสั้นท้าย PR: ข้อความต้อนรับใหม่ยาวกี่ตัวอักษร (เทียบของเดิม) และจำนวนการ์ดในหน้า /updates ก่อน/หลัง

STOP:
  - เมื่อ tsc 0 errors · เทสต์ผ่านทั้งหมด · grep ได้ 0 ทั้ง 2 ข้อ · มีภาพก่อน/หลังครบ 4 คู่ · เปิด PR แล้ว
  - หรือเมื่อทำงานครบ 45 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ (commit งานที่เสร็จก่อนหยุดเสมอ)
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | 4 จุด รวมจากใบงาน 250+252+253 |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 10 ไฟล์ (UI 4 + เทสต์ 6) |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้าม index.css · ห้ามแตะฝั่งชัย |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | tsc + ชุดเทสต์ + grep 2 ข้อ + ภาพ 4 คู่ |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ไฟล์ + PR + สรุปท้าย PR |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 45 turns |
| 7 | SCOPE ใช้ path สัมพัทธ์ | ผ่าน | artifacts/... |
| 8 | บรรทัดบังคับ GitHub Connection | ผ่าน | ระบุใน FORBIDDEN |
| 9 | ห้ามแตะ src/index.css | ผ่าน | 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | fix/replit-ui-bundle-voice-greeting-updates-cost |
| 11 | ระบุตัวเลข baseline | ผ่าน | 418/416/0/2 |
| 12 | ไม่มี code fence ซ้อน | ผ่าน | ข้อความตัวอย่างแสดงแบบ indented |

## ข้อความส่งต่อ (บอส copy ส่งให้รีพิต)

[เดวิด → รีพิต]

บอสขอ **รวมงาน UI เป็นใบงานเดียว** เพื่อให้ทำทัน: ใบงาน **250 (รวม 252 + 253 เข้าแล้ว)** — `qa/job-250-replit-ui-bundle-voice-greeting-updates-page-and-cost-thb.md`
สาขาเดียว `fix/replit-ui-bundle-voice-greeting-updates-cost` · **1 ใบ = 1 สาขา = 1 PR**
ทำ **ทีละไฟล์ให้จบแล้ว commit** (อย่าข้ามไปข้ามมา) — ถ้าใกล้ชนเพดานรอบ ให้หยุดแล้วรายงาน
1. **ปุ่มเปิดเสียงมองไม่เห็น** (src/admin/AdminVoiceSettings.tsx) — สถานะปิดเป็นขาวบนขาว → ให้เห็นชัด + ข้อความกำกับ · **ห้ามเปลี่ยนค่าเริ่มต้น (คงปิด)**
2. **ข้อความต้อนรับสั้นลง** (src/components/KnightSupport.tsx) — ใช้ข้อความใหม่ 3 บรรทัดในใบงาน + อัปเดตเทสต์ที่ล็อกข้อความเดิม
3. **หน้า /updates** (src/pages/UpdatesPage.tsx) — ตัดคำนำ "Release vX —" · ทำหัวเรื่อง/ป้ายเป็นไทยกระชับเหมือนรุ่นก่อน · รวม v2.2.0 เข้ากับ v2.2.1 เป็นรุ่นเดียว (คงคำว่า "รุ่นล่าสุด") + อัปเดตเทสต์ 4 ไฟล์
4. **ต้นทุนเฉลี่ยต่อคำขอ → บาท** (src/admin/AiCostCenterPage.tsx บรรทัด ~461) — ห้ามเปลี่ยนสูตร · ค่า 0 ต้องเป็น 0.00 บาท · ไม่ให้เหลือคำว่า "สตางค์"
หลักฐาน: tsc 0 · ชุด studio+sketch ผ่าน (baseline 418/416/0/2) · grep 2 ข้อได้ 0 · **แนบภาพก่อน/หลัง 4 คู่** · index.css 0 diff
(ใบงาน 252 และ 253 ถูกยกเลิกรวมเข้าใบนี้แล้ว — อย่าทำซ้ำ)
