# รายงาน 443-B (บอย = Qwen) — ด่านกันอัปโหลดภาพผิดรุ่นในแอดมิน

**ผู้ทำ:** บอย (Qwen) · **PR:** `feat(admin): upload safety — thumbnail, confirm step, standard HD image`
**branch:** `feat/admin-upload-safety` · base `origin/main = 26c4e61` · **เวลาไทย:** 11 ต.ค. 69 ~10:1x–10:5x น. (commit ดูได้จาก PR)
**OS/เครื่องรัน:** Linux 5.10.134-013.10.05.kangaroo.al8.x86_64 · node v22.23.3 · ผู้รัน: บอย (Qwen, sandbox เดียวกับ PR #511)
**ไฟล์ที่แตะ (4):** `src/admin/uploadSafety.ts` (ใหม่) · `src/admin/BasinImageManagerField.tsx` · `src/admin/BasinsManager.tsx` · `test/admin-upload-safety.test.ts` (ใหม่)
**ไม่แตะ:** `api-server/**` · `src/data/**` (ชัย) · ราคา/สี/จำนวนสี · `/price-guide` · KB/persona · `src/index.css` (ไม่จำเป็น — ใช้ utility เดิม) และ **ไม่มี `overflow-x:hidden`** ที่ไหนใน diff · **ไม่แตะ production DB/ไม่เขียน production** (ดูหัวข้อ “การวัดบน UI แอดมิน”)

## baseline (เดวิดรันไว้ + ผมรันทวนบนเครื่องผม)
| | tests | pass | fail | skipped |
|---|---|---|---|---|
| เดวิด @`6b10827` | 1,314 | 1,272 | 0 | 42 |
| ผมก่อนแตะไฟล์ @`26c4e61` | **1,314** | **1,272** | **0** | 42 |
| ผมหลังแก้ (รวมไฟล์ใหม่ 11 เคส) | **1,325** | **1,283** | **0** | 42 |
`npx tsc -p tsconfig.json --noEmit` = **0** · `pnpm build` → `build=0` + `verify-production-assets` OK

## A. ภาพย่อข้างรหัสรุ่น
- `BasinImageManagerField` รับ prop ใหม่ `sku` และ `BasinsManager.tsx:517` ส่ง `sku={form.watch("sku")}` ลงไป
- ตอนเลือกไฟล์ (`stageFile`): สร้าง `URL.createObjectURL` + อ่านขนาดจริงผ่าน `loadImageSize` แล้ว **โชว์เฉพาะกล่องรอตรวจ** — ยังไม่อัปโหลด

## B. กล่องยืนยันก่อนบันทึก (ห้ามเขียนทับก่อนกดยืนยัน)
`role="dialog"` + `data-testid="dialog-confirm-basin-image"` ข้างในมี:
- `<img data-testid="img-basin-pending-thumbnail">` (ภาพย่อ 112×80)
- `text-basin-pending-summary` = `KF003 · kitchen.jpg · 4000×2667 px` (`pendingImageSummary`)
- `text-basin-image-size-warning` (ถ้าภาพเล็ก/วัดไม่ได้)
- ประโยค “ตรวจให้ตรงกับรหัส **KF003** … ระบบยังไม่เขียนทับจนกว่าคุณจะกดยืนยัน”
- ปุ่ม `button-confirm-basin-image` (ถึงจะเรียก `uploadImageFile`) · `button-cancel-basin-image` (เรียก `cancelPending` → `dropPending` revoke blob)
- `uploadImageFile(` ปรากฏในไฟล์ **1 จุดเดียว** (ใน `commitPending`) — เทสต์บังคับไว้

## C. ปุ่ม “ใช้ภาพ HD มาตรฐาน”
`button-basin-standard-hd` → `standardHdImageUrl(sku)` สร้างเฉพาะ `/kb/images/basin-hd/<SKU>.jpg` (SKU ต้องเข้ารูป ห้ามมี path แปลกปลอม: `""|null|"../../etc/passwd"|"a"` → `null`) → `probeStandardHdImage` (HEAD แล้วค่อย GETช่วง 16 bytes) → **ยอมรับเฉพาะ 2xx ที่มี `content-type: image/*`** ⇒ soft-404 ที่ตอบเป็น `index.html` ของ SPA ไม่นับเป็นภาพ → ถ้าไม่พบ: แสดง `text-basin-standard-hd-missing` “ไม่พบภาพ HD มาตรฐานของรุ่นนี้ …” และ **ไม่มี fallback เป็นภาพรุ่นอื่น** (ข้อความในโค้ด: “เราไม่ใส่ภาพของรุ่นอื่นแทน”)
ผล probe บน production จริง: `KF003 200 image/jpeg 35,885B` · `KF006 200 35,024B` · `KF021 200 45,672B` · `NOPE999 404 text/html 2,341B`

## D. เตือนแต่ไม่บล็อก (< 600 px)
`STANDARD_MIN_PX = 600` · `isBelowStandard` ใช้ด้านสั้นสุด · `2667×599 → true`, `2667×600 → false`, `null → false` (**ขนาดที่วัดไม่ได้ ไม่ใช่ “ภาพเล็ก”**) · ข้อความเป็น `sizeWarningText` — ภาพ 900×800 ไม่เตือน / 800×500 เตือน (ตรวจกับไฟล์จริงที่สร้างด้วย PIL: `(900,800) min=800 warn=False`, `(800,500) min=500 warn=True`) **ไม่มีเงื่อนไขบล็อกการบันทึก**

## E. คงของเดิม (#511) — ไม่ถอยหลัง
`ProductCard` ของลูกค้ายัง render เฉพาะข้อมูล: เทสต์ 1 เคส assert ว่า gate `{bowlShapeText(product) && (` + `BOWL_SHAPE_KEYS = ["bowlShapeLabel"]` ยังอยู่ และไม่มีคำว่า “หลุมสี่เหลี่ยม/หลุมวงรี” hardcode ใน `App.tsx`/คอมโพเนนต์แอดมิน

## พิสูจน์สองทาง (แก้ → ตก → คืน → ผ่าน)
```
1) ให้ picker อัปโหลดทันที (ถอดขั้นตอนยืนยัน)
   → not ok "a picked file is staged, previewed and only then committed"     (10 pass / 1 fail)
2) ลบกล่องยืนยัน role="dialog" ทั้งบล็อก
   → not ok "a picked file is staged…" + not ok "the confirm box shows the thumbnail next to the SKU…"  (9 pass / 2 fail)
3) บังคับให้ภาพเล็กกลายเป็นบล็อก (isBelowStandard คืน true ทุกกรณี)
   → not ok "flags the shortest side under the catalogue minimum"
   → not ok "the warning names the measurement it has, and says so when it has none"   (9 pass / 2 fail)
คืนโค้ดครบ → test/admin-upload-safety.test.ts 11/11 · เต็มชุด 1,325 / pass 1,283 / fail 0 · tsc 0
```

## ตรวจไม่ได้ / ยังค้าง (ไม่เดา ไม่ได้แกล้งบอกผ่าน)
1. **ภาพหน้าจอ 3 สถานะ + การวัด clientWidth/scrollWidth ที่ 390 บนหน้าแอดมิน = ไม่ได้ทำ** — หน้า `/admin` ต้องมี session จริง และผม **ห้ามแตะ api-server/ไม่ล็อกอินของจริง** ผมจึงลอง harness ปลอม (static server `3351` + route intercept ที่เสด session ปลอม, ทุก writes คืน `501 blocked`, `/api/admin/basins` เป็น GET เท่านั้นที่ proxy ไป prod แบบ read-only): ผ่านเข้าเกราะแอดมินได้ (`QA harness · เจ้าของระบบ`) แต่ **ตารางแถวว่าง** (`rows: []`) ทำให้เปิดตัวแก้ไขของ KF003/KF006 ไม่ได้ → ไม่มีภาพ/ตัวเลขตามใบ ถ้าจะวัดจริงขอเดวิดรันบนเครื่องที่มี session (script ที่ใช้วางไว้ในหัวข้อถัดไป)
2. ภาพจริงของ `basin-hd/*.jpg` ว่า “ตรงรุ่น”หรือไม่ — ผมเช็คได้แค่ว่าไฟล์มีอยู่ + เป็น image ผม**ไม่ยืนยันทดแทนการดูภาพ** (หน้าที่ผู้บันทึก) ตรงกับเจตนารมณ์ของด่านนี้ (ระบบแค่กันให้ “ยังมองไม่เห็น”)
3. **การอัปโหลดจริงผ่านด่าน (confirm แล้วไฟล์ไปโผล่ใน DB)** — ไม่มี: ทุก call ที่เขียนข้อมูลใน harness ถูกบล็อกด้วย 501
4. Safari/iOS · หน้าแอดมินอื่นท่ีใช้ `ImageUploadField` (ไม่ได้นำ component เดียวกันนี้ไปใช้ — ถ้ามองว่าต้องได้ด่านเดียวกันทุก uploader บอกได้ ผมขยายให้ใบเดียว)

### สิ่งที่พร้อมให้เดวิดใช้วัดต่อ
- บนเครื่องที่มี session แอดมิน: เปิด **อ่างล้างหน้า → KF003 → (+ เพิ่มภาพใหม่)** เลือกไฟล์ `800×500` → ต้องเห็นกล่องยืนยัน + คำเตือน “ด้านที่สั้นที่สุด 500 px ต่ำกว่า 600 px” (กดยืนยันได้) → กดนlockด “ใช้ภาพ HD มาตรฐานของรุ่นนี้ (KF003)” → ภาพย่อเปลี่ยนเป็น `…/kb/images/basin-hd/KF003.jpg` 4000×2667
- selector ที่ล็อกไว่แล้ว: `input-basin-image-file` · `dialog-confirm-basin-image` · `img-basin-pending-thumbnail` · `text-basin-pending-summary` · `text-basin-image-size-warning` · `button-confirm-basin-image` · `button-cancel-basin-image` · `button-basin-standard-hd` · `text-basin-standard-hd-missing`

## ความเสี่ยง
- blob URL ของไฟล์ถกู revoke ทุกครั้งที่เลิก/สลับไฟล์ + ตอน commit — ถ้ามอง preview ซ้ำหลัง cancel ต้องเลือกไฟล์ใหม่ (ตั้งใจ)
- ยังเขียนจริงเฉพาะเมื่อผู้ใช้กดยืนยัน ⇒ ถ้าผู้ใช้กด “บันทึก” ของฟอร์มก่อนยืนยัน ภาพจะย้งไม่ถูกบันทึก (เป็น behavior ที่ถูกต้องแต่อาจต้องบอกในคู่มือ)
- `BasinsManager.tsx` ต้องมี `sku` ใน form ตอนนั้นเสมอ; ถ้าเป็นหน้าสร้างรุ่นใหม่(`sku=""`) ปุ่ม HD จะขึ้นข้อความ “ไม่พบภาพ HD…” และ helper คืน `null` เพื่อไม่ให้เดา path
- probe ใช้ 2 requests (HEAD + ranged GET) ต่อการกด — โดนกันไว่ด้วย `std::idle` (ไม่มี polling)

## ข้อเสนอ
1. ใหไ้ ช้ด่านเดียวกันกับทุก uploader: `StoneImageManagerField` / `VideoUploadField` (ใบเล็ก ~1 ช.ม.) — ตอนนี้ใบ 443-B กำหนดแค่แอดมินอากง
2. ผัง UI ของแอดมินควรมี smoke test (Playwright + admin session) เพื่อวัด overflow/ปุ่มทับกันที่ 390 แบบอัตโนมัติ — ผมใส่ไม่ได้ในใบนี้เพราะต้องสร้าง harness/dependency ใหม่ (FORBIDDEN: ห้ามแก้อยูท่ีนอก SCOPE)
3. เดวิด: ถ้ายินยอมให้ run ด้วย session ทดสอบ (บัญชี admin แยก + DB ทดสอบ) ผมจะปิดข้อค้าง “ภาพหน้าจอ + ตัวเลข 390” ให้ครบในรอบเดียว
4. ถ้าบอสอยากให้เห็น “วัน/เวลาของไฟล์ที่เลือก” ด้วย (`file.lastModified`) บอกได้ — ผมเติมในบรรทัดสรุป `KF003 · kitchen.jpg · 4000×2667 px`
