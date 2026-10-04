# ใบงาน 266-B (บอย / Freebuff) — ต่อ “จับคู่สีหินจากภาพ” เข้าแอป: เส้นทาง API แอดมิน + หน้าจอทดสอบ

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **บอย (Freebuff)** · **ผู้ตรวจรับ:** เดวิด
**Branch:** `fix/freebuff-stone-match-api-and-admin-page`
**ที่มา (คำสั่งบอส 4 ต.ค. 69):** “ต้องการ ให้บอยทำ” — หลังเดวิด merge #295 (`8c9edcf`) แล้วพบว่า `suggestStonesForPhoto()` ใน `lib/stone-matcher.ts` **ไม่มีใครเรียกใช้เลย** (grep ทั้ง repo = 0 จุด) ⇒ ตัวจับคู่สีหินพร้อมใช้แต่ **ไม่มีทางเข้า** จากแอป

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. **สร้างเส้นทาง API สำหรับแอดมิน: `POST /api/admin/stone-match`**
     - ไฟล์ใหม่: `artifacts/api-server/src/routes/stone-match.ts` + ลงทะเบียนใน `artifacts/api-server/src/routes/index.ts` (1 บรรทัด)
     - รับภาพ 1 ภาพ (multipart `file` หรือ JSON `{ imageBase64, mimeType }`) → เรียก `suggestStonesForPhoto()` จาก `lib/stone-matcher.ts` (**ห้ามแก้ไฟล์นั้น**) → คืน
       `{ ok: true, matches: [{ code, name, reason, confidence }], model, dataAsOf }`
     - **ป้องกันด้วยสิทธิ์แอดมิน:** ใช้ `requireAdminPermission("installed-stones", "view")` จาก `middlewares/admin-auth.ts` (แบบเดียวกับ `admin/assistant/ask` ที่ใช้ `requireAdminPermission("leads")`)
     - **จำกัดค่าใช้จ่าย/กัน abuse:** rate limit ด้วย `createRateLimiter({ name: "admin-stone-match", max: 10, windowMs: 60 * 1000 })` (แบบเดียวกับบรรทัด 1826 ใน `admin-router.ts`) + จำกัดขนาดภาพ **≤ 8 MB** + รับเฉพาะ `image/jpeg` · `image/png` · `image/webp`
     - **ไม่ให้ระบบล้ม:** ถ้ายังไม่มีข้อมูลรับรอง/model (matcher ปิดอยู่) → ตอบ **HTTP 200** พร้อมข้อความไทยอ่านเข้าใจ (เช่น “ระบบจับคู่สีหินยังไม่พร้อมใช้งาน กรุณาแจ้งผู้ดูแลระบบ”) **ห้าม 500** · ถ้าภาพไม่ใช่ภาพ → **400** · ใหญ่เกิน → **413** (หรือ 400 พร้อมข้อความไทย — ระบุใน PR)
     - **ห้ามคืนข้อมูลอ่อนไหว:** ห้ามคืน path ไฟล์ · ชื่อไฟล์ต้นทาง · ค่า env · คีย์ · ชื่อโมเดลแบบเต็มที่มีค่า config ลับ
  2. **หน้าจอแอดมินใหม่ `/admin/stone-match`** (ไฟล์ใหม่ `artifacts/knight-basins/src/admin/StoneMatchPage.tsx`)
     - อัปโหลด/ลากภาพได้ 1 ภาพ → แสดงรายการสีที่ใกล้เคียง (รหัส + ชื่อ + เหตุผล + ความมั่นใจ) · สถานะกำลังโหลด · ข้อผิดพลาดเป็นภาษาไทย
     - ลงทะเบียนเส้นทาง: `artifacts/knight-basins/src/admin/AdminApp.tsx` (1 บรรทัด) และ `artifacts/knight-basins/src/App.tsx` (1 บรรทัด — **ข้อยกเว้นเฉพาะใบนี้**)
     - ใช้คอมโพเนนต์/Tailwind แบบเดียวกับหน้าแอดมินเดิม · **ห้ามแตะ `src/index.css`**
     - ซ่อน/ปิดการใช้งานเมื่อไม่มีสิทธิ์ (ใช้กลไกสิทธิ์เดิมของแอดมิน)
  3. **ห้ามเดาสี (ตามกฎบอส “รหัสสี = ตัวตนของสี”)**
     - ผลลัพธ์ว่าง → แสดง “ไม่พบสีที่ใกล้เคียงจากภาพนี้” ไม่ใช่เดาสี
     - สีที่เสนอแต่ยังไม่มีภาพอ้างอิงหิน → ระบุ “ยังไม่มีภาพอ้างอิงหินสำหรับสีนี้” (ห้ามทำให้เข้าใจผิดว่าเทียบแล้ว)
  4. **ทดสอบด้วยภาพจริง ≥ 2 ภาพ** (หินสีเดียวชัด ๆ 1 ภาพ + ภาพที่ควรได้ผลว่าง/ไม่แน่ใจ 1 ภาพ) และบันทึกผล (ภาพ + คำตอบ) เป็นหลักฐานใน PR
  5. **ไม่แตะของเดิม:** `lib/stone-matcher.ts` · `lib/vertex-*` · หน้าลูกค้า (`StudioPage.tsx` · `sketch*` · `src/components/**` ส่วนลูกค้า) · `src/data/**` · `hidden` ของแคตตาล็อก

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/stone-match.ts            (ไฟล์ใหม่)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/index.ts                  (ลงทะเบียน 1 บรรทัด)
  - /opt/data/cache/kbsrc/artifacts/api-server/test/stone-match-api.test.ts         (ไฟล์เทสต์ใหม่)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/StoneMatchPage.tsx      (ไฟล์ใหม่)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/AdminApp.tsx            (ลงทะเบียน 1 บรรทัด)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/App.tsx                       (ลงทะเบียน 1 บรรทัด · ข้อยกเว้นเฉพาะใบนี้)

FORBIDDEN:
  - **ห้ามแก้ `artifacts/api-server/src/lib/stone-matcher.ts`** (เพิ่ง merge #295 แล้ว · `temperature: 0` + env-driven ต้องคงเดิมทุกบรรทัด)
  - ห้ามแตะ `artifacts/knight-basins/src/index.css` (ต้อง **0 diff**)
  - ห้ามแตะหน้าลูกค้า: `src/components/**` ที่ผู้ใช้เห็น · `StudioPage.tsx` · `sketch*` · `src/data/**` · `routes/leads.ts` · `routes/support.ts`
  - ห้ามแตะ `routes/admin-router.ts` (ไฟล์นี้มีข้อยกเว้นจากใบ 263/264 เท่านั้น)
  - ห้ามฝังชื่อโมเดล/คีย์/ค่า env ในโค้ดหรือใน UI · ห้ามพิมพ์คีย์/`.env` ลงรายงานหรือ PR
  - ห้ามเพิ่มไลบรารีใหม่ (ใช้ของเดิมในโปรเจกต์) · ห้าม push ตรงเข้า `main` · ห้าม deploy เอง
  - ห้ามเปิด endpoint ให้คนนอกใช้โดยไม่มีการตรวจสิทธิ์ (ค่าใช้จ่าย AI จริง)

EVIDENCE:
  1) `npx tsc -p artifacts/api-server/tsconfig.json --noEmit` → 0 errors · และ `pnpm run typecheck` ฝั่ง `artifacts/knight-basins` → 0 errors
  2) รันเทสต์ที่เกี่ยว (ในโฟลเดอร์ `artifacts/api-server`): `node --experimental-strip-types --test test/stone-match-api.test.ts` → ระบุ tests/pass/fail
     · ฐานอ้างอิงที่เดวิดวัดเองบน main (4 ต.ค. 69): ชุดเต็ม `npm test` = **1164/1164/0** · `test/stone-match-prompt.test.ts` = **15/15** — ให้ยึดผล CI ของ PR เป็นเกณฑ์ (จำนวนรวมจะเพิ่มตามเทสต์ใหม่)
     · ฝั่ง UI ฐานที่วัดได้: `node --experimental-strip-types --test $(ls test/*.test.ts | grep -E 'studio|sketch')` = **515/513/0/2**
  3) เทสต์ใหม่ต้องมีเคส: (ก) ไม่มีสิทธิ์/ไม่มีคุกกี้แอดมิน → **401/403** ไม่เรียก AI (ข) ไฟล์ไม่ใช่ภาพ → **400** (ค) ภาพเกิน 8 MB → **413/400** (ง) matcher ปิด (ไม่มี model/credentials) → **200** + ข้อความไทย (ไม่ใช่ 500) (จ) เคสสำเร็จ → โครงสร้าง `matches` ถูกต้อง (mock การเรียก AI · ห้ามยิง Vertex จริงในเทสต์)
  4) **พิสูจน์ว่าจับได้:** ย้อน/ลบการตรวจสิทธิ์หรือการจำกัดขนาด แล้วเทสต์ที่เกี่ยวต้องตก (แนบข้อความ)
  5) ตรวจว่าไม่แตะไฟล์ต้องห้าม: `git diff origin/main...HEAD --name-only` (ต้องมีเฉพาะไฟล์ใน SCOPE) และ `git diff origin/main...HEAD -- artifacts/knight-basins/src/index.css | wc -l` → **0**
  6) **ยิงจริงกับภาพจริง ≥ 2 ภาพ** ในเครื่อง/แซนด์บ็อกซ์ → แนบภาพ + ผลลัพธ์ (รหัสสีที่ได้) เป็นหลักฐานใน PR
  7) เดวิดจะยิงจริงบน production หลัง deploy (ภาพจริง 2 ภาพ) และตรวจว่าคำตอบตรงกับที่อธิบาย ไม่มี path/คีย์หลุด

OUTPUT:
  - `POST /api/admin/stone-match` ใช้ได้จริง (มีการตรวจสิทธิ์ + rate limit) + หน้าแอดมิน `/admin/stone-match` ที่อัปโหลดภาพแล้วเห็นผล
  - PR เดียว พร้อมหลักฐานผลรัน + ภาพทดสอบ · แจ้งเดวิดเมื่อพร้อม (เดวิด merge เองเมื่อ CI เขียว + หลักฐานครบ)

STOP:
  - เมื่อ tsc 0 · เทสต์ผ่านตามฐาน · พิสูจน์จับบั๊กได้ · ยิงภาพจริงได้ผล · เปิด PR และแจ้งเดวิด
  - หรือเมื่อทำงานครบ 12 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | API + UI + กฎห้ามเดาสี + ภาพทดสอบ |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 6 ไฟล์ (มีไฟล์ใหม่ 3 ไฟล์) |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ stone-matcher/index.css/หน้าลูกค้า/admin-router |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | tsc · เทสต์ 5 เคส · พิสูจน์จับได้ · ยิงภาพจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | endpoint + หน้าแอดมิน + PR เดียว |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 12 turns |
| 7 | SCOPE ใช้ absolute path | ผ่าน | /opt/data/cache/kbsrc/... |
| 8 | ระบุสิทธิ์ที่ใช้ | ผ่าน | `requireAdminPermission("installed-stones")` |
| 9 | มี rate limit + เพดานขนาดภาพ | ผ่าน | 10 ครั้ง/นาที · ≤ 8 MB |
| 10 | มีข้อความส่งต่อให้บอส | ผ่าน | [เดวิด → บอย] |
| 11 | ระบุผู้ตรวจรับ | ผ่าน | เดวิด |
| 12 | ระบุวันเวลาไทย | ผ่าน | 4 ต.ค. 69 |

## ข้อความส่งต่อให้บอส copy

```
[เดวิด → บอย] ใบงาน 266 — qa/job-266-freebuff-stone-match-api-and-admin-page.md · สาขา fix/freebuff-stone-match-api-and-admin-page
บอสสั่งให้บอยทำ: ต่อ "จับคู่สีหินจากภาพ" เข้าแอป (บอสพบว่ายังไม่มีทางเข้าใช้เลย)
1) API ใหม่ POST /api/admin/stone-match ในไฟล์ใหม่ routes/stone-match.ts + ลงทะเบียน routes/index.ts 1 บรรทัด · เรียก suggestStonesForPhoto() (ห้ามแก้ lib/stone-matcher.ts)
   ป้องกันด้วย requireAdminPermission("installed-stones","view") · rate limit 10/นาที · ภาพ ≤ 8 MB · รับ jpeg/png/webp · ไม่มี model/credentials → 200 + ข้อความไทย (ห้าม 500) · ไม่มีสิทธิ์ → 401/403 · ไม่ใช่ภาพ → 400
2) หน้าใหม่ /admin/stone-match (StoneMatchPage.tsx) อัปโหลด/ลากภาพ → แสดงรหัสสี+ชื่อ+เหตุผล+ความมั่นใจ · ลงทะเบียน AdminApp.tsx 1 บรรทัด + App.tsx 1 บรรทัด (ข้อยกเว้นเฉพาะใบนี้)
3) ห้ามเดาสี: ผลว่างให้บอก "ไม่พบสีที่ใกล้เคียงจากภาพนี้" · สีที่ไม่มีภาพอ้างอิงหินให้ระบุตรง ๆ
4) ห้ามแตะ src/index.css (0 diff) · หน้าลูกค้า · src/data/** · routes/admin-router.ts · ห้ามฝังชื่อโมเดล/คีย์
หลักฐาน: tsc 0 ทั้งสองฝั่ง · เทสต์ 5 เคส (สิทธิ์/ไฟล์ผิด/ใหญ่เกิน/ปิดระบบ/สำเร็จ) · พิสูจน์จับได้ · ยิงจริง ≥2 ภาพ (แนบภาพ+ผล) · git diff index.css = 0
ฐานอ้างอิง: api-server npm test 1164/1164/0 (ก่อนงานนี้) · stone-match-prompt 15/15 · studio+sketch 515/513/0/2
```
