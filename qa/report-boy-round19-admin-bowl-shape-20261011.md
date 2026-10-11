# รายงาน 446-B (บอย = Qwen) — ช่องแก้ “รูปทรงอ่าง” ในหน้าแอดมิน (shape-only, ไม่มีสวิตช์รูน้ำล้น)

**ผู้ทำ:** บอย (Qwen) · **PR:** `feat(admin): editable bowl shape (shape-only)` (branch `feat/admin-bowl-shape-editor`, base `origin/main = 8469566`)
**OS/เครื่องรัน:** Linux `5.10.134-013.10.1.kangaroo.al8.x86_64` · node **v22.23.3** · ผู้รัน: บอย (sandbox เดียวกับ #511/#515) · เวลาไทย 11 ต.ค. 69 ~14:0x–14:3x น.
**ไฟล์ที่แตะ (4):** `src/admin/basinBowlShape.ts` (ใหม่ — pure) · `src/admin/BasinBowlShapeField.tsx` (ใหม่ — UI) · `src/admin/BasinsManager.tsx` (วางช่อง + invalidate สอง query) · `test/admin-bowl-shape-field.test.ts` (ใหม่ 10 เคส)
**ไม่แตะ:** `api-server/**` · `src/data/**` · `lib/**` · ราคา/สต็อก · `/price-guide` · KB/persona · ไม่มี `overflow-x:hidden` ที่ html/body

## baseline (ก่อนแตะไฟล์นี้ — รันบนเครื่องผม)
| คำสั่ง | tests | pass | fail | skipped |
|---|---|---|---|---|
| `node --experimental-strip-types --test test/*.test.ts` (กรองไฟล์ใหม่ออก) | **1,325** | **1,283** | **0** | 42 |
| ของเดวดที่ระบุในใบ (`db34d101`) | 1,325 | 1,283 | 0 | 42 | ⇒ ตรงกัน
หลังแตะ: `1,335 / pass 1,293 / fail 0 / skip 42` (+10 = ไฟล์ใหม่) · `npx tsc -p tsconfig.json --noEmit` = **0** · `pnpm build` = **0** + `verify-production-assets` OK

## A–E ตรงใบอย่างไร
- **A ช่องเลือกรูปทรง + “ไม่ระบุ”:** `select-basin-bowl-shape` — ตัวเลือกสร้างจาก **rows ที่ API ส่งมา** เท่านั้น (`deriveShapeOptions(rows)`: dedup ตาม code, sort, ไม่มี label → `null`) และ “**ไม่ระบุ (null)**” เป็น option แรก ค่าที่เลือกส่งเป็น `bowlShape: null`
- **B ค่าปัจจุบัน + ที่มา:** `readBowlShapeValue(row)` อ่าน `bowlShape`/`bowlShapeLabel`/`bowlShapeSource` (ไม่สร้าง default) + `sourceBadge()` → `database` = “(ค่าที่แก้ไขเอง)” · `builtin` = **“(ค่าตั้งต้นของระบบ)”** ตามที่ใบให้กำกับ · `none` = “(ยังไม่ระบุ)”
- **C พรีวิวบรรทัดลูกค้า:** `text-basin-bowl-shape-preview` ใช้ `labelForCode()` **เฉพาะข้อความที่ API ส่ง** ไม่มี label → โชว์ *code* ตรง ๆ (ไม่แปลเอง) และตรวจแล้วว่าไม่มีคำรูปทรงในไฟล์ผม (proof ข)
- **D กล่องยืนยันก่อนบันทึก:** ต้องกด `button-open-bowl-shape-confirm` → เปิดกล่อง (aria-label “ยืนยันการเปลี่ยนรูปทรงอ่าง” + `data-testid="dialog-confirm-bowl-shape"`) ที่มีบรรทัด `เปลี่ยนรูปทรงอ่างของ KF003: ค่าเดิม → ค่าใหม่` (`confirmShapeSummary`) + ปุ่ม `บันทึก`/`ยังไม่บันทึก`; **ไม่มี path อื่นที่บันทึก** (`saveBowlShape()` ถูกเรียกใน `commit()` หลังกดยืนยันเท่านั้น), ปิดการบันทึกถ้าค่าไม่เปลี่ยน/ยังไม่มี id/กำลังบันทึก; `PUT /api/admin/basins/:id/bowl-shape` (สิทธิ์ `basins/edit` ฝั่งเซิร์ฟเวอร์, ไม่แตะฟอร์มราคา) และ **ข้อความผิดพลาดจากเซิร์ฟเวอร์แสดงตรง ๆ** (`text-basin-bowl-shape-error`) — ผมไม่ map/ไม่เดา body ใหม่ถ้า API ตอบ 400
- **E คงของเดิม:** การ์ดลูกค้ายังgate `{bowlShapeText(product) && …}` (ตรวจแล้วว่าไม่ถอย) · **ไม่มีสวิตช์/ข้อความเรื่องรูน้ำล้น**ใน Panel/TESTS (`assert !/รูน้ำล้น/`, proof #5) · layout เป็น `flex-wrap` + `min-h-[44px]` + `[overflow-wrap:anywhere]` (เป้าแตะ 44px และคำยาวไม่ล้น) — ตัวเลข 390 ที่หน้าแอดมินจริง **เดวด/บอสวัดเองตามที่บอกไว้**

## พิสูจน์สองทาง (แก้ → ตก → คืน → ผ่าน)
```
ก) ให้ปุ่มเปิดกล่องบันทึกเลย (ข้ามการยืนยัน)   → not ok "the panel asks before writing and carries the confirm/preview ids"  (9 pass/1 fail)
ข) เติมคำที่แต่งเองในตัวเลือก (hardcode)      → not ok "derives the option list from the returned rows only"
                                             → not ok "shows the API label, else the code — never a translation..."
                                             → not ok "no shape wording is hard-coded in the admin panel…"  (7 pass/3 fail)
คืนโค้ดครบ                                     → 10/10 pass · เต็มชุด 1,335/1,293/fail 0
```
ตัวอย่าง assertion ที่ล็อกความเป็น “ไม่เดา” (fixture เป็น **rows ที่ API จะส่ง** ไม่ใช่ copy จริง: `LABEL-A/LABEL-B`):
```
deriveShapeOptions(API_ROWS)         → codes [oval, round, rounded-rectangle], labels [LABEL-B, null, LABEL-A]
deriveShapeOptions([{sku:'KF001'}])   → [] (+ UI ขึ้น 'text-basin-bowl-shape-nooptions' และไม่มี option ให้เลือก)
labelForCode(options,'round',null)    → 'round'          (ไม่มี label จาก API = โชว์ code, ไม่แปลเป็นไทย)
labelForCode(options,null,'anything')  → 'ไม่ระบุ'
bowlShapePatchBody(null)              → { bowlShape: null }               (ล้างกลับเป็น ไม่ระบุ ได้จริง)
saveBowlShape(fetch,3,'oval')         → PUT /api/admin/basins/3/bowl-shape, credentials same-origin, body {bowlShape:'oval'}
เซิร์ฟเวอร์ตอบ 400 {message:'Invalid basin bowl shape'} → {ok:false,message:'Invalid basin bowl shape'}  (ไม่แจ้งว่าสำเร็จ)
เครือข่ายล่ม                             → {ok:false,message:/ค่าเดิมไม่ถูกเปลี่ยน/}
```
(`saveBowlShape` รับ `fetchImpl` เป็นพารามิเตอร์ ⇒ ทดสอบได้โดยไม่ต้องยิง API จริง = ไม่แตะ production)

## ตรวจไม่ได้ / ยังค้าง
1. **บันทึกจริงบน environment ที่ migration 025 ยังไม่ผ่าน deploy** — main ตอนนี้ยังไม่มี `bowl_shape` (`ls deploy/hostinger/migrations | tail -1` = `024_support_voice_enabled.sql`; `grep -n bowl lib/db/src/schema/index.ts` มีแค่ `bowl_mm`) และ **PR #518 (445-C) ยัง OPEN** ⇒ ช่องนี้ตอนนี้อยู่ในสถานะ “ไม่มีตัวเลือก/ไม่บันทึก” ของจริง (UI ขึ้น `text-basin-bowl-shape-nooptions`, ไม่เสดค่าปลอม) — ปิดช่องได้เมื่อ #518 merge + migrate แล้วกดยืนยัน/ดูผลผ่าน `bowlShapeSource`
2. **วัด 390/360 บนหน้าแอดมินจริง** = ไม่ทำ (เดวดแจ้งว่า “บอสจะทดสอบเอง”) — ที่ผมล็อกได้คือ structural (`flex-wrap`, `min-h-[44px]`, ห้าม mask ด้วย overflow)
3. **การทดสอบแบบ E2E ที่มีการ auth เป็นแอดมิน** — ไม่มี session/บัญชีทดสอบ (ห้ามล็อกอินบัญชีจริง) — ต้องให้เดวดรันบน staging
4. **ข้อความไทยของ 6 รูปทรง** — มาจาก **DB/API ของชัย** เท่านั้น (ใบบอกชัด: label compute ในโค้ดฝั่ง server, ห้ามพิมพ์เอง) ถ้าหลัง merge แล้ว API ไม่ส่ง label สำหรับบาง code หน้าจอจะเห็น *code* (เช่น `rounded-square`) ซึ่งตั้งใจให้เดวดเห็นชัดว่ายังขาดคำ ไม่ใช่ผมเติมเอง
5. **สัญญา POST body ยังไม่ตรงกันระหว่าง PR ของชัยกับฉบับ revise 2** (ผมรายงานไปแล้วรอบก่อน): #518 ยังบังคับ `bowlOverflowHole` ในร่าง JSON ในขณะที่ใบ 446-B rev2 ระบุ “ไม่มีช่อง”+บันทึกเฉพาะ `bowl_shape` — ถ้า #518 ถูก merge ทั้งอย่างนั้น ผม **เดาร่าง body ใหม่ไม่ได้** (API ตอบ 400 = UI แสดงข้อความนั้น) และจะขอใบแก้เพื่อส่งค่าให้ถูก
   ⇒ ทางออกที่แนะนำ (ฝั่งชัย 1 บรรทัดทำให้ `bowlOverflowHole` เป็น optional และแปล “ไม่ส่งคีย์” = คงค่าเดิม) — หรือไม่ก็ให้ เดวดเคาะว่า body ต้องเป็น `{bowlShape, bowlOverflowHole}` แล้วผมถึงเพิ่ม field

## ความเสี่ยง
- UI อยู่ในโหมดปิดสนิทจนกว่า API จะมีข้อมูล (ดีต่อความจริง แต่บอสอาจคิดว่าเมนูไม่โผล่เพราะ bug) → มีบรรทัดอธิบายในหน้า + `data-testid` ให้เดวดตรวจว่า API คืนอะไร (ถ้าอยากได้ fallback ชั่วคราว ต้องได้ใบอนุมัติ “ให้ hardcode ข้อความ” จากบอสก่อน)
- `invalidateQueries(["/api/catalog"])` ทำให้การ์ดลูกค้า refresh — ถ้า cache ที่ nginx 30 วันบนรูปไม่เกี่ยวกับ catalog ไม่ส่งผลต่อ cache อื่น (catalog `no-store` ตามรายงาน 410-Q)
- ถ้ามีหน้าอื้นใช้ `useUpdateAdminBasin` (PUT ทั้งก้อน) หลังแก้ราคา/ภาพแล้ว save shape → ต้องระวัง order การ submit เดียว (ตอนน้ี form submit ไม่ส่งคีย์รูปทรง → ไม่ทับกัน เพราะ endpoint เดี่ยวตามใบ 445-C)

## ข้อเสนอ (ต้องเดวดเคาะ)
1. ให้ชัย (ก) merge/rebase #518 + (ข) ทำให้ body ของ `PUT .../bowl-shape` รับ `{bowlShape: string|null}` เดียวคีย์ (ตามใบ rev2) — จากนั้้นผมเพิ่ม 1 เคส E2E-like (mock fetch ที่ assert body จริง) และเปิดใช้หน้าจอนี้ได้เต็มรูป
2. เพิ่ม `bowlShapeOptions` (code + label) ใน `GET /api/admin/basins` (หรือ endpoint เล็ก) เพื่อให้ตัวเลือกครบ 6 โดเมนแม้ยังไม่มีรุ่นไหนใช้ค่า — ผมอ่านจาก API เท่านั้น (ตอนนี้ list = ค่าที่โผล่ในแถวจริง)
3. เติม “ประวัติค่า” ใน `data` ของ audit ให้แสดงในแอดมิน (ถ้าอยากได้ = ใบเล็ก 1 จอ)
4. หลัง migrate ผมขอเดวดให้ช่วยกด 3 เคสที่ 390 (KF006 builtin → database → ไม่ระบุ) เพื่อเก็บตัวเลข `clientWidth/scrollWidth` + ภาพ 3 ใบให้ปิดใบนี้แบบมีหลักฐานครบ
