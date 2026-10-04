# ใบงาน 237-B (ปิด/เปิดฟีเจอร์เสียงน้องไนท์ — UI) — สวิตช์ในหน้า /admin/voice-settings และซ่อนปุ่ม 🔊

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead) · **อนุมัติโดย:** บอส (คุณนพ — "แก้ไขเลย บอสอนุมัติ")
**สถานะ:** มอบหมายให้ Replit · **พัฒนาผ่าน GitHub Connection เท่านั้น**
**Branch:** `feat/replit-support-voice-toggle-ui`

**ที่มา:** บอสสั่งให้มีสวิตช์เปิด-ปิดฟีเจอร์เสียง (Google Cloud TTS) ในหน้าหลังบ้าน และ **ค่าเริ่มต้น = ปิด** ใบนี้ทำเฉพาะฝั่ง UI ส่วน API/DB เป็นงานของชัย (Job 237-A) ซึ่งมีสัญญาให้ใช้คือ `GET/PATCH /admin/support-voice` มีฟิลด์ `enabled` และมีเส้นทางสาธารณะ `GET /support/voice-status` คืน `{ enabled }`

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. artifacts/knight-basins/src/admin/AdminVoiceSettings.tsx
     - อ่านค่า enabled จาก useGetAdminSupportVoice() · ค่าเริ่มต้นที่แสดงต้องเป็น false (ปิด)
     - เพิ่มสวิตช์ "เปิดใช้งานเสียงน้องไนท์" ไว้ "เหนือ" รายการเลือกเสียง
       บันทึกผ่าน useUpdateAdminSupportVoice() ด้วย { voiceName: <เสียงปัจจุบัน>, enabled: !enabled }
       (PATCH บังคับให้ส่ง voiceName มาด้วยเสมอ — สวิตช์ต้อง disable จนกว่า current จะโหลดเสร็จ)
     - แสดงข้อความอธิบายสั้น ๆ ว่าเมื่อปิด ลูกค้าจะไม่เห็นปุ่ม "ฟังเสียง" ในหน้าเว็บ และเพราะใช้โควตา Google Cloud TTS ที่มีค่าใช้จ่ายจึงตั้งค่าเริ่มต้นเป็นปิด
     - ต้องมี data-testid เหล่านี้: panel-voice-enabled · toggle-voice-enabled · status-voice-enabled-state
     - ใช้ role="switch" + aria-checked={enabled} และใช้ Tailwind utility เท่านั้น
  2. artifacts/knight-basins/src/components/KnightSupport.tsx
     - ดึงสถานะจาก GET /api/support/voice-status ตอน mount (useEffect ครั้งเดียว)
     - เก็บใน state ที่ตั้งค่าเริ่มต้นเป็น false และตั้งเป็น true เฉพาะเมื่อ payload.enabled === true เท่านั้น
     - ถ้าเรียกไม่สำเร็จ หรือ response ไม่ใช่ ok ให้คงเป็น false (ปิดไว้ก่อน — ปลอดภัยกว่า)
     - ซ่อนปุ่ม 🔊 "ฟังเสียง" ทั้งหมดเมื่อ state เป็น false (อย่าแสดงปุ่มที่กดแล้วล้มเหลว)
  3. เทสต์ใหม่ artifacts/knight-basins/test/support-voice-toggle-ui.test.ts
     - เขียนแบบ Static Source Inspection (readFileSync + assert.match) เท่านั้น ห้าม dynamic import คอมโพเนนต์
     - ตรวจว่ามี fetch("/api/support/voice-status"), ค่าเริ่มต้น useState(false),
       เช็ก payload.enabled === true, มีเงื่อนไข voiceEnabled ก่อน render ปุ่มฟังเสียง,
       และมี data-testid ของสวิตช์พร้อม role="switch"

SCOPE:
  - artifacts/knight-basins/src/admin/AdminVoiceSettings.tsx
  - artifacts/knight-basins/src/components/KnightSupport.tsx
  - artifacts/knight-basins/test/support-voice-toggle-ui.test.ts (ใหม่)

FORBIDDEN:
  - ห้ามแตะต้อง artifacts/knight-basins/src/index.css เด็ดขาด (ต้องได้ 0 diff)
  - ห้ามแตะ artifacts/api-server/** · lib/db/** · lib/api-spec/** · lib/api-zod/** · lib/api-client-react/** (เป็นงานของชัยในใบ 237-A)
  - ห้ามแตะ StudioPage.tsx หรือ WorkshopProductionSheet.tsx
  - ห้ามใช้ CSS class ใหม่ที่ต้องแก้ index.css — ใช้ Tailwind utility ที่มีอยู่แล้วเท่านั้น
  - ห้ามแสดงปุ่ม "ฟังเสียง" ในกรณีที่ยังไม่ยืนยันว่าฟีเจอร์เปิด
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) branch แสดง feat/replit-support-voice-toggle-ui ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) node --experimental-strip-types --test test/support-voice-toggle-ui.test.ts → ผ่านทุกข้อ ระบุจำนวนข้อจริง
  4) ชุดทดสอบ non-browser ของ knight-basins → ระบุ ผ่าน/ตก/ข้าม และระบุที่มาของ baseline
     (ตัด *.browser.test.ts ออกตามกฎที่ตกลงกันไว้)
  5) diff artifacts/knight-basins/src/index.css ต้องว่าง (0 diff)

OUTPUT:
  - artifacts/knight-basins/src/admin/AdminVoiceSettings.tsx
  - artifacts/knight-basins/src/components/KnightSupport.tsx
  - artifacts/knight-basins/test/support-voice-toggle-ui.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และชุดทดสอบผ่านครบถ้วน
  - หรือเมื่อทำงานครบ 40 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | สวิตช์หลังบ้าน + ซ่อนปุ่มฟังเสียง |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ไฟล์ UI 2 ไฟล์ + เทสต์ใหม่ |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | index.css 0 diff, ไม่แตะฝั่ง API |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งจริง + กฎ Static Source Inspection |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | จำกัด 40 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | บันทึกผลในตารางท้ายใบงาน |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | Replit (งาน UI) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ค่าเริ่มต้นปิด ตามที่บอสสั่ง |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ไม่มีค่า secret ในใบงาน |
| 12 | อัปเดต KANBAN | ผ่าน | Task 237-B บันทึกใน KANBAN แล้ว |
