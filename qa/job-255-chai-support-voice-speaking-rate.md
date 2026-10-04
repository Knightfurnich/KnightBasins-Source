# ใบงาน 255-C (ชัย) — ปรับความเร็วเสียงน้องไนท์ได้ (ตั้งค่า 1.25) + คุมได้จากหน้าแอดมิน

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ **ชัย (Claude Code CLI)** · 1 ใบงาน = 1 สาขา = 1 PR
**ที่มา:** บอสทดสอบหน้า /admin/voice-settings แล้วใช้งานได้ แต่ขอให้เสียงพูด **เร็วขึ้นเป็น 1.25 เท่า** — และพบว่าปัจจุบัน **ไม่มีที่ให้ปรับความเร็วเลย**
**ข้อเท็จจริงที่เดวิดตรวจแล้ว (4 ต.ค. 69):**
  - ชั้น TTS รองรับความเร็วอยู่แล้ว: `lib/google-tts.ts` อ่าน `speakingRate` จากแถวตั้งค่า และส่งเป็น `audioConfig.speakingRate` (บรรทัด ~66/146-147)
  - แต่ `PATCH /admin/support-voice` (routes/admin-router.ts ~3349) รับแค่ `voiceName` + `enabled` → **ไม่มีทางตั้งค่าความเร็วได้** ทั้งจาก API และจากหน้าจอ
  - หน้าจอ `AdminVoiceSettings.tsx` ไม่มีตัวควบคุมความเร็ว (grep แล้วไม่พบ)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. ให้ PATCH /admin/support-voice รับค่าความเร็วได้ด้วย
     - เพิ่มฟิลด์ `speakingRate` ใน Zod body schema (ไฟล์ที่ประกาศ UpdateAdminSupportVoiceBody) และ sync กับ OpenAPI client ตามกฎโปรเจกต์
     - ค่าที่รับได้: 0.8 – 1.5 (ทศนิยมทีละ 0.05) · ค่านอกช่วง/ค่าเสีย → ตอบ 400 พร้อมข้อความชัดเจน (ห้าม clamp เงียบ ๆ)
     - ถ้าไม่ส่งมา → คงค่าเดิม (พฤติกรรมเดิมของ voiceName/enabled ต้องไม่เปลี่ยน)
     - บันทึกลงคอลัมน์ speakingRate ของแถวตั้งค่า (คอลัมน์มีอยู่แล้ว — ห้ามเพิ่มคอลัมน์ใหม่)
  2. หน้าจอ /admin/voice-settings ให้มีตัวควบคุมความเร็ว
     - แสดงค่าปัจจุบัน (เช่น "ความเร็ว 1.25 เท่า") และให้เลือกได้อย่างน้อย 3 ค่า: 1.00 · 1.25 · 1.50
     - มีปุ่มบันทึกความเร็ว (ใช้ PATCH เดิม) และข้อความยืนยันผลภาษาไทย
     - ปุ่ม "ฟังตัวอย่าง" ต้องใช้ความเร็วที่ตั้งไว้จริง (ถ้าจำเป็น ให้ /admin/support-voice/preview รับค่า speakingRate มาลองฟังก่อนบันทึกได้ — ถ้าทำ ให้ validate ช่วงเดียวกัน)
  3. ค่าเริ่มต้นที่ต้องตั้งให้เป็นจริงหลังเปิดใช้: speakingRate = 1.25 (บอสสั่ง) — ต้องพิสูจน์ด้วยการเรียก GET แล้วเห็น 1.25 จริง
  4. ห้ามแตะค่าความเร็วของเสียงอื่น/ระบบอื่น และห้ามเปลี่ยนค่า `enabled` (ค่าเริ่มต้นยังต้องเป็นปิด)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/google-tts.ts (เฉพาะถ้าจำเป็นต่อการส่งค่า เช่น preview)
  - /opt/data/cache/kbsrc/artifacts/api-server/test/ (เทสต์ที่ครอบ PATCH support-voice)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/AdminVoiceSettings.tsx
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/ (เทสต์ UI ของหน้าเสียง)

FORBIDDEN:
  - ห้ามแตะ src/index.css · src/pages/UpdatesPage.tsx · src/admin/AiCostCenterPage.tsx (เป็นของใบงาน 250-C)
  - ห้ามแตะ artifacts/api-server/src/lib/ai-cost-tracker.ts · test/ai-cost-center.test.ts (เป็นของใบงาน 254)
  - ห้ามเพิ่มคอลัมน์ DB ใหม่ · ห้ามแก้ค่า `enabled` เริ่มต้น · ห้ามเขียนข้อมูลลง DB แบบ raw SQL
  - ห้ามแตะ Production ด้วยคำสั่งเอง (การยิงทดสอบจริงให้เดวิดทำ) · ห้าม push ตรง main

EVIDENCE:
  1) npx tsc -p artifacts/api-server/tsconfig.json --noEmit และ -p artifacts/knight-basins/tsconfig.json → 0 errors ทั้งคู่
  2) node --experimental-strip-types --test test/*.test.ts ใน artifacts/api-server → ระบุ tests/pass/fail · ตัวเลขอ้างอิงตั้งต้น 1108 / 1105 pass / 3 fail (ชุด incident-alerts เดิมของ Windows)
  3) node --experimental-strip-types --test test/studio-*.test.ts test/sketch-*.test.ts ใน artifacts/knight-basins → ตัวเลขอ้างอิงตั้งต้น 418 / 416 pass / 0 fail / 2 skip
  4) เทสต์ใหม่ต้องครอบ: รับ 1.25 ได้ · 0.5 และ 2.0 และ "เร็ว" → 400 · ไม่ส่ง speakingRate → ค่าเดิมไม่เปลี่ยน · voiceName/enabled ยังทำงานเหมือนเดิม
  5) พิสูจน์ว่าเทสต์จับบั๊กได้: ย้อน admin-router.ts เป็นของ main แล้วรันเทสต์ที่เกี่ยวข้อง → ต้องตก (แนบชื่อข้อ)
  6) หลักฐานหน้าจอ: แนบภาพหน้า /admin/voice-settings ที่เห็นตัวควบคุมความเร็ว + ค่าปัจจุบัน
  7) git diff main...HEAD -- artifacts/knight-basins/src/index.css | wc -l → 0

OUTPUT:
  - API ที่รับ speakingRate ได้ (validate 0.8–1.5) + UI ที่ปรับความเร็วได้
  - เทสต์ใหม่ตามข้อ 4
  - PR เข้า main พร้อมผลรันจริง · ภาพหน้าจอ · และคำสั่งที่เดวิดจะใช้ยิงจริงเพื่อตั้งค่าเป็น 1.25 (เช่น curl PATCH พร้อม body)

STOP:
  - เมื่อ tsc 0 errors ทั้งสองโปรเจกต์ · เทสต์ผ่าน (ยกเว้น 3 ข้อ incident-alerts เดิม) · พิสูจน์จับบั๊กได้ · มีภาพหน้าจอ · เปิด PR แล้ว
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ (commit งานที่เสร็จก่อนหยุดเสมอ)
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | API + UI + ตั้งค่า 1.25 |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 5 ไฟล์ (API/UI/เทสต์) |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | กันทับกับใบงาน 250-C และ 254 |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | tsc 2 โปรเจกต์ + เทสต์ + พิสูจน์จับบั๊ก + ภาพ |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ไฟล์ + PR + คำสั่งยิงจริง |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 30 turns |
| 7 | SCOPE ใช้ absolute path | ผ่าน | /opt/data/cache/kbsrc/... |
| 8 | ไม่มี code fence ซ้อนในบล็อกใบงาน | ผ่าน | ไม่มี |
| 9 | ห้ามแตะ src/index.css | ผ่าน | 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | fix/chai-support-voice-speaking-rate |
| 11 | อ้างตัวเลข baseline | ผ่าน | 1108/1105/3 · 418/416/0/2 |
| 12 | ไม่ทับไฟล์กับใบงานอื่น | ผ่าน | 250-C = UI หน้า /updates + ai-cost · 254 = ai-cost-tracker |

## ข้อความส่งต่อ (บอส copy ส่งให้ชัย)

[เดวิด → ชัย]

งานใหม่: ใบงาน **255** — `qa/job-255-chai-support-voice-speaking-rate.md` · สาขา `fix/chai-support-voice-speaking-rate`
บอสทดสอบแล้วเสียงน้องไนท์ใช้งานได้ แต่ขอให้พูดเร็วขึ้นเป็น **1.25 เท่า** — และพบว่าตอนนี้ **ไม่มีที่ให้ปรับความเร็วเลย**
ข้อเท็จจริง: ชั้น TTS รองรับ `speakingRate` อยู่แล้ว (lib/google-tts.ts ส่ง audioConfig.speakingRate) แต่ `PATCH /admin/support-voice` รับแค่ voiceName/enabled และหน้าจอไม่มีตัวควบคุม
งานคุณ:
1. ให้ PATCH รับ `speakingRate` (0.8–1.5 ทีละ 0.05 · ค่าเสีย → 400 · ไม่ส่งมา = คงค่าเดิม) + sync Zod/OpenAPI
2. เพิ่มตัวควบคุมความเร็วในหน้า /admin/voice-settings (1.00 · 1.25 · 1.50 + แสดงค่าปัจจุบัน + ปุ่มบันทึก) และ "ฟังตัวอย่าง" ต้องใช้ความเร็วนั้น
3. เตรียมคำสั่ง PATCH ที่เดวิดจะใช้ตั้งค่าเป็น 1.25 จริง (ผมเป็นคนยิงบน production)
หลักฐาน: tsc 0 ทั้ง 2 โปรเจกต์ · api-server 1108/1105/3 · knight-basins 418/416/0/2 · เทสต์ใหม่ (1.25 ผ่าน · 0.5/2.0/"เร็ว" → 400 · ไม่ส่ง = คงเดิม) · ย้อนโค้ดแล้วต้องตก · ภาพหน้าจอ · index.css 0 diff
ห้ามแตะไฟล์ของใบงาน 250-C (UpdatesPage/AiCostCenter) และ 254 (ai-cost-tracker)
