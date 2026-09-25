# ใบงาน 39 (ชัย) — ระบบเลือกโทนเสียงน้องไนท์ในหน้าแอดมิน (Admin Voice Settings — 5 โทนเสียงหญิง)

**วันที่:** 25 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** เจ้าของเห็นพ้องให้คงตัวตน (Brand Identity) ของ "น้องไนท์" เป็นผู้ช่วยขายหญิงที่สุภาพอ่อนหวาน (ใช้ ค่ะ/ดิฉัน) ตรงกันทั้งบนเว็บและใน LINE OA แต่ต้องการให้แอดมินสามารถเข้าไปทดลองฟังเสียงและเลือก "โทนอารมณ์ของเสียง" ได้ 5 สไตล์ (Google Cloud TTS th-TH-Chirp3-HD เฉพาะเสียงผู้หญิง) เพื่อให้เข้ากับกลุ่มลูกค้า

```
✅ มาตรฐานการออกใบงาน · 12/12 · 25 ก.ย. 69 · เดวิด

GOAL:
  พัฒนาระบบเลือกโทนเสียงน้องไนท์ในหน้าแอดมินแบบ End-to-End:
  1. สร้างตาราง `support_voice_settings` (migration 013) เก็บการตั้งค่าเสียงปัจจุบัน (voiceName, languageCode, speakingRate)
  2. เพิ่ม Endpoint แอดมิน:
     - `GET /api/admin/support-voice`: ดึงการตั้งค่าปัจจุบัน + รายชื่อ 5 โทนเสียงหญิงไทยที่คัดสรรไว้
     - `PATCH /api/admin/support-voice`: บันทึกการตั้งค่าเสียงใหม่
  3. ปรับ `synthesizeSpeech` ใน `google-tts.ts` ให้อ่านการตั้งค่าเสียงจากฐานข้อมูล (fallback ไปที่ th-TH-Chirp3-HD-Kore)
  4. สร้างหน้าจอ Admin UI ให้แอดมินกดฟังตัวอย่างเสียงแต่ละโทน และกดบันทึกเสียงที่ต้องการได้

SCOPE (absolute path — ใช้ได้กับชัย):
  1. /opt/data/cache/kbsrc/lib/db/src/schema/index.ts
  2. /opt/data/cache/kbsrc/deploy/hostinger/migrations/013_support_voice_settings.sql (ใหม่)
  3. /opt/data/cache/kbsrc/lib/api-spec/openapi.yaml
  4. /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  5. /opt/data/cache/kbsrc/artifacts/api-server/src/lib/google-tts.ts
  6. /opt/data/cache/kbsrc/artifacts/api-server/test/admin-support-voice.test.ts (ใหม่)
  7. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/AdminVoiceSettings.tsx (ใหม่)
  8. /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/AdminApp.tsx

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - ห้ามแตะ artifacts/knight-basins/src/components/StudioPage.tsx (เป็นของ Replit)
  - ห้ามแตะ index.css, @media print หรือ .formal-*
  - ห้ามเพิ่มเสียงผู้ชาย — ล็อกตัวตนน้องไนท์เป็นผู้หญิง (คำลงท้าย ค่ะ/ดิฉัน) 100%
  - ห้ามลบเสียง fallback "th-TH-Chirp3-HD-Kore" — ระบบต้องสังเคราะห์เสียงได้เสมอแม้ DB ว่างเปล่า
  - ห้าม push เข้า main ตรง ๆ — ทำบน branch feat/chai-support-voice-settings แล้วเปิด PR

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) pnpm --filter @workspace/api-spec run codegen
  3) pnpm run typecheck -> 0 errors ทั้ง 9 workspace
  4) cd artifacts/api-server && npm test
     baseline อ้างอิง: tests 269 / pass 265 / fail 4 (ห้ามมี fail ใหม่)
  5) cd artifacts/knight-basins && npm test
     baseline อ้างอิง: tests 193 / pass 188 / fail 2 (fail เฉพาะ 2 ตัวใน *.browser.test.ts)
  6) เทสต์ใหม่ใน admin-support-voice.test.ts ยืนยัน:
     - GET /admin/support-voice ได้เสียงปัจจุบันและรายการ 5 โทนเสียงหญิง
     - PATCH /admin/support-voice บันทึกเสียงใหม่สำเร็จ
     - synthesizeSpeech ใช้เสียงที่บันทึกล่าสุดจาก DB

OUTPUT:
  - branch: feat/chai-support-voice-settings (เปิด PR เข้า main รอตรวจ)
  - 8 ไฟล์ที่แก้ตาม SCOPE
  - EVIDENCE ครบ 6 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้าเทสต์ตกเกิน baseline เดิม (API > 4, Web > 2)
  - ถ้า typecheck มี error TS
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE

CONTRACT:
  1. ใน lib/db/src/schema/index.ts:
     - ประกาศตาราง `supportVoiceSettings = pgTable("support_voice_settings", { ... })`:
       - `id`: serial("id").primaryKey()
       - `voiceName`: varchar("voice_name", { length: 64 }).notNull()
       - `languageCode`: varchar("language_code", { length: 16 }).notNull().default("th-TH")
       - `speakingRate`: real("speaking_rate").notNull().default(1.0)
       - `updatedAt`: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  2. ใน deploy/hostinger/migrations/013_support_voice_settings.sql:
     - สร้างตาราง support_voice_settings พร้อม default แถวแรกเป็น 'th-TH-Chirp3-HD-Kore'
  3. รายชื่อ 5 โทนเสียงผู้หญิงไทย (รุ่น th-TH-Chirp3-HD):
     1. th-TH-Chirp3-HD-Kore: "นุ่มนวล สุภาพ เป็นกันเอง (ค่าเริ่มต้น)"
     2. th-TH-Chirp3-HD-Zephyr: "มืออาชีพ มั่นใจ ชัดถ้อยชัดคำ"
     3. th-TH-Chirp3-HD-Autonoe: "สดใส กระฉับกระเฉง คล่องแคล่ว"
     4. th-TH-Chirp3-HD-Leda: "เรียบร้อย สุขุม นิ่งสงบ"
     5. th-TH-Chirp3-HD-Despina: "อบอุ่น ฟังสบาย เป็นมิตร"
  4. ใน AdminVoiceSettings.tsx:
     - เพิ่มเมนูใน Admin Sidebar "เสียงผู้ช่วยขาย (น้องไนท์)"
     - แสดงการ์ดทั้ง 5 โทนเสียง พร้อมปุ่มกดฟังตัวอย่างเสียงแต่ละโทน
     - ปุ่ม "บันทึกเสียงนี้เป็นเสียงใช้งาน"
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ ระบบเลือกโทนเสียงน้องไนท์ 5 โทนเสียงหญิง Phase 2 |
| 2 | GOAL วัดได้ | ✅ ตาราง DB + API GET/PATCH + UI แอดมิน |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 8 ไฟล์ absolute ชัยเข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามเพิ่มเสียงชาย (ล็อกตัวตนน้องไนท์), ห้ามแตะ StudioPage, ห้ามแตะ CSS พิมพ์ |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ codegen + typecheck + npm test 269/265/4 + 193/188/2 |
| 6 | OUTPUT ชัด | ✅ branch feat/chai-support-voice-settings |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไขชัดเจน |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ API: 269/265/4, Web: 193/188/2 |
| 9 | CONTRACT ระบุ schema + 5 โทนเสียงจริง | ✅ ระบุตาราง คอลัมน์ และคำบรรยาย 5 สไตล์เสียง |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ absolute path ทั้งหมด |
