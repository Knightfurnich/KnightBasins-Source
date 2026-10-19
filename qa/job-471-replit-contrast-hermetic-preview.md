# ใบงาน 471-R (Replit / รีพิต) — **ด่านคอนทราสต์ยังแดงปลอมได้ เพราะ CI ต่อ API production สดผ่าน proxy (ไม่มีการลองซ้ำ/ไม่มีสัญญาณพร้อมครบทุกปลายทาง)**

**วันที่:** 19 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **รีพิต (Replit)** · **ผู้ตรวจรับ:** เดวิด + บอส
**ที่มา:** หลัง merge #619 เข้า `main` (`984165e`) รอบ `Release validation` ยังตก — **`Contrast sweep (390px, round 1)` และ `(1440px, round 1)` = failure แต่ `round 2` ทั้งสองความกว้าง = success** และ job `Compare both contrast rounds` ถูกข้าม ⇒ ยังไม่มี determinism จริง แม้ head เดียวกันของ PR (`d853967`) จะผ่าน 7/7
**ที่แก้:** รีโป `Knightfurnich/KnightBasins-Source` → `qa/tools/**` + `.github/workflows/release-validation.yml` (+ `qa/fixtures/**` ถ้าเลือกทาง A) → **เปิด PR**

> **หลักฐานราก (เดวิดดึง artifact ของ job ที่ตกเอง — run `39258254257` · artifact `contrast-390-round1`)**
> - ตัวกวาด **fail-closed ทำงานถูกต้อง**: ข้อความจริงใน log = `ยังไม่ได้ตรวจ (หน้าโหลดไม่จบ: /portfolio) — {"ok":false,"pending":0,"responses":{"/api/portfolio":0},"gallery":0,…}` → `exit code 2`
> - แปลว่า **fetch ไปที่ `/api/portfolio` ของ preview ล้มทั้งคำขอ (สถานะ 0)** ไม่ใช่ปัญหาสี
> - ตรวจ `qa/tools/mock-api-466c.mjs`: preview **ไม่ได้เสิร์ฟข้อมูลของตัวเอง** — มัน **pass-through ไป `fetch("https://knightbasins.com" + req.url)`** ทุกคำขอ ⇒ ด่านนี้ **ผูกกับเครือข่ายออกไป production ทุกครั้ง**
> - `contrast-api.log` ใน artifact = **0 ไบต์** (ไม่มี log ต่อคำขอ เลยไม่มีหลักฐานว่าเกิดอะไรกับ `/api/portfolio`)
> - ตรวจ production ณ ตอนนี้: `/api/catalog` 200 · `/api/portfolio` 200 (21 KB / 41 ms) ⇒ แปลว่าเป็น **สะดุดชั่วคราวฝั่ง runner/เครือข่าย** ซึ่งด่านไม่มีการลองซ้ำ

> **baseline ที่เดวิดวัดเอง (19 ต.ค. 69 · main `984165e` · Linux · Chrome headless)**
> web **1,529 tests / 1,520 pass / 0 fail / ข้าม 9** · api **1,329 / 1,329 / 0** · `tsc --noEmit` = 0 ทั้ง 2 artifacts
> production (สแกนเอง 390 โหมดมืด): `/stone` **333 แถว** · ป้ายราคา 64 สี = **10.11** · ตกจริง **0** · `/portfolio` 72 แถว ตกจริง **0** · เหลือเฉพาะปุ่ม LINE (allowlist ที่บอสอนุมัติ 2.26)

```
✅ มาตรฐานการออกใบงาน · 12/12 · 19 ต.ค. 69 · เดวิด

GOAL:
  **A · ตัดการพึ่งเครือข่ายออกไป production ออกจากด่าน (เลือกทางใดทางหนึ่ง แล้วระบุเหตุผล)**
    **ทาง A (แนะนำ) — hermetic:** ให้ preview เสิร์ฟข้อมูลจาก **fixture ที่ commit ไว้** (`qa/fixtures/api/catalog.json` · `qa/fixtures/api/portfolio.json`) แทนการ pass-through
      · ต้องระบุ **ที่มา + hash + วันที่เก็บ + คำสั่งที่ใช้เก็บ** ในรายงาน และระบุวิธีรีเฟรช (เมื่อแคตตาล็อกเปลี่ยนจริง ทำเป็น PR ต่างหาก)
      · **ความสดของข้อมูลไม่ใช่หน้าที่ของด่านนี้** — ความสดถูกคุมด้วย `Validate release contents` อยู่แล้ว (ระบุในรายงานว่าเข้าใจข้อนี้)
      · ทุกคำขอต้อง **log บรรทัดเดียว: method · path · สถานะ · เวลา ms** ลง `contrast-api.log` (ปัจจุบัน 0 ไบต์ = ไม่มีหลักฐาน)
    **ทาง B (ถ้าเลี่ยงไม่ได้) — ลดความเปราะ:** คง pass-through แต่ (1) `AbortSignal.timeout(5000)` (2) ลองซ้ำแบบมีขอบเขต 3 ครั้ง (3) log ทุกคำขอพร้อมสถานะ (4) **workflow ต้องรอจนครบทุกปลายทางที่ด่านใช้** (`/` · `/api/catalog` · `/api/portfolio` = 200) ก่อนเริ่มกวาด
  **B · ทำให้ workflow รอ "พร้อมครบทุกปลายทาง" ไม่ใช่แค่ 2 ปลายทาง**
    · ขั้น `Serve built app and public read-only catalogue` ต้องเช็ค **ทุก endpoint ที่ด่านใช้** (ตอนนี้เช็คแค่ `/` + `/api/catalog` ⇒ `/api/portfolio` ล้มได้โดยไม่ถูกจับก่อนเริ่ม)
    · ถ้าไม่พร้อมภายในเวลาที่กำหนด ⇒ `exit 2` พร้อมข้อความ `ยังไม่ได้ตรวจ (หน้าโหลดไม่จบ: <ปลายทาง>)` และพิมพ์ log ของ API (fail-closed ตามเดิม — ห้ามเปลี่ยนเป็นผ่าน)
  **C · พิสูจน์ determinism จริง (ต้องเป็นตัวเลข)**
    · รัน sweep บน commit เดียวกัน **3 รอบติดต่อกัน** (ทั้ง 1440 และ 390) ⇒ จำนวนแถว / coverage / exclusions / verdict ต้องเหมือนกันทั้ง 3 รอบ
    · แนบ **ผลรอบ 1 ของ main ที่ตก** เทียบกับผลหลังแก้ (ก่อน-หลัง) เพื่อให้เห็นว่าปิดอาการแล้ว
    · ยืนยันว่า job `Compare both contrast rounds` **ทำงานจริง** (ไม่ถูกข้าม) ในรอบที่ผ่าน
  **D · ด่านต้องยังจับของจริงได้**
    · คง LINE allowlist (2.26) และเกณฑ์ 4.5 ตามเดิม · คงหลักฐานแดงจากสาขาจงใจทำสีตก (ของเดิมใช้ได้: `dark /stone` ตกจริง 1 แถว = 2.63 → exit 1)
  **E · ไม่ทำของเดิมพัง**
    · ห้ามแตะสี/โทเคน/`App.tsx`/`index.css` · `artifacts/api-server/**` · `data/**` · `deploy/**` · `public/**` · ข้อความ/ราคา/ขนาด
    · งานเทสต์อื่น (unit/A4 print) ต้องยังผ่านและไม่ถูกทำให้ช้าลงอย่างมีนัยสำคัญ

SCOPE (แก้เฉพาะที่ระบุ · path สัมพัทธ์จาก root รีโป):
  - (รีโป) qa/tools/mock-api-466c.mjs                            ← A (fixture / retry+timeout+log)
  - (รีโป) qa/tools/sweep-467c.mjs                               ← A/C (สรุปผล + เทียบ 3 รอบ)
  - (รีโป) qa/fixtures/api/catalog.json · qa/fixtures/api/portfolio.json (ใหม่) ← A (สำเนาข้อมูลสาธารณะ ไม่มีความลับ/ข้อมูลลูกค้า)
  - (รีโป) .github/workflows/release-validation.yml              ← A/B/C (งานคอนทราสต์เท่านั้น)
  - (รีโป) artifacts/knight-basins/test/**                        ← เทสต์กันลืมของ A (ถ้าจำเป็น)
  - (รีโป) qa/report-replit-round33-contrast-hermetic-20261019.md (ใหม่) + qa/images/replit-round33/
  - (รีโป) qa/job-471-replit-contrast-hermetic-preview.md         ← อ่าน — ใบนี้

FORBIDDEN:
  - ห้ามแตะ: `artifacts/knight-basins/src/**` (รวม `App.tsx` · `index.css` · โทเคนสี) · `artifacts/api-server/**` · `data/**` · `deploy/**` · `public/**` · `robots.txt` · `llms*.txt`
  - ห้ามเก็บข้อมูลลูกค้า/ความลับลง fixture · ห้ามใส่ข้อมูลจริงของลูกค้าใน artifact
  - ห้ามเปลี่ยนเกณฑ์ 4.5 · ห้ามเพิ่ม allowlist · ห้ามปิด/ลบด่านเพื่อให้เขียว · ห้ามทำให้ "วัดไม่ได้" กลายเป็น "ผ่าน"
  - ห้ามแตะ production DB · **ใช้ GitHub Connection เท่านั้น** · **ห้าม commit เข้า `main` ตรง · ห้าม merge PR เอง · ห้าม deploy เอง**

EVIDENCE (ต้องแนบผลจริง — คำสั่ง/ผลรัน/ตัวเลข/ลิงก์):
  1) **ทางที่เลือก (A/B) + เหตุผล** และ diff ของ preview/mock ที่เปลี่ยน
  2) **หลักฐานราก:** ยืนยันว่า `/api/portfolio` ล้มจริงในรอบที่ตก (อ้าง artifact `contrast-390-round1` ของ run `39258254257`) และ **หลังแก้** ให้แนบ `contrast-api.log` ที่มีบรรทัด log ทุกคำขอพร้อมสถานะ
  3) **Determinism:** ตารางเทียบ **3 รอบ** บน commit เดียวกัน (checked · coverage · exclusions · verdict ต่อความกว้าง) + ลิงก์ job `Compare both contrast rounds` ที่ **ผ่าน (ไม่ถูกข้าม)**
  4) **ก่อน-หลัง:** ผลรอบ 1 ของ main `984165e` (ตก) เทียบกับผลรอบใหม่ (ผ่าน)
  5) **ด่านยังจับจริง:** หลักฐานแดง 1 ครั้ง (จงใจทำสีตก → exit 1) และหลักฐาน "บล็อก endpoint → exit 2 ยังไม่ได้ตรวจ"
  6) **คำสั่ง/ผล:** `pnpm run test` (tests/pass/fail) · `npx tsc -p tsconfig.json --noEmit` ทั้ง 2 artifacts · `node qa/tools/sweep-467c.mjs` 3 รอบ · `git diff --stat` เฉพาะ SCOPE
     · **baseline ของเดวิด (main `984165e` · Linux):** web **1,529 / 1,520 / 0 / ข้าม 9** · api **1,329 / 1,329 / 0** · `tsc --noEmit` = 0 ทั้ง 2 artifacts — รายงานตัวเลขที่รันได้จริงเทียบ baseline นี้
     · commit + OS + ผู้รัน + **เวลาไทย**

OUTPUT:
  - PR ต่อ `main` ชื่อแนะนำ `fix(qa): hermetic contrast preview + deterministic multi-round sweep (471-R)`
  - `qa/report-replit-round33-contrast-hermetic-20261019.md`
  - สรุป 5 บรรทัด: แก้อะไร · เทสต์ · ตรวจไม่ได้ · ความเสี่ยง · ข้อเสนอ

STOP:
  - ครบ A–E พร้อมหลักฐาน **หรือทำครบ 10 turns** ให้หยุดและรายงานสิ่งที่เสร็จ + ที่เหลือ
  - **ถ้าต้องแตะไฟล์นอก SCOPE (รวม `src/**` · `api-server/**` · `public/**`) ⇒ หยุดและแจ้งเดวิดทันที ห้ามแก้เอง**
```

## เช็คลิสต์ท้ายใบ (ติ๊กในรายงาน/PR)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ผ่าน |
|---|---|---|
| 1 | ผู้ตรวจรับเข้าใจขอบเขต | ใบไม่ออกนอก SCOPE |
| 2 | ผลลัพธ์ตรง GOAL ครบทุกข้อ | ยืนยันทีละข้อ A–E |
| 3 | baseline ระบุ commit+OS+ผู้รัน | มีบรรทัด baseline |
| 4 | หลักฐานเป็นคำสั่ง/ผลรันจริง | ไม่ใช่คำรับรอง |
| 5 | เทสต์ผ่านเป็นตัวเลข | tests/pass/fail |
| 6 | พิสูจน์สองทาง | ตก → ผ่าน · บล็อก → exit 2 |
| 7 | ไม่แตะไฟล์ข้ามเจ้าของ | git diff --stat เฉพาะ SCOPE |
| 8 | ไม่แตะ production DB | ยืนยันในรายงาน |
| 9 | ไม่เดาตัวเลข | ทุกค่าอ้างการวัด/artifact จริง |
| 10 | รายงานอยู่ใน `qa/` ผ่าน PR | ลิงก์ PR |
| 11 | สรุป 5 บรรทัด | สิ่งที่ทำ/ผ่าน/ไม่ได้/ความเสี่ยง/ข้อเสนอ |
| 12 | หลักฐานครบ | เวลาไทย + hash |

## ภาคผนวก ก · หลักฐานราก (เดวิด · 19 ต.ค. 69)

| หลักฐาน | ค่า |
|---|---|
| run ที่ตกบน main | `39258254257` (`984165e`) — round 1 ทั้ง 2 ความกว้าง = failure · round 2 ทั้ง 2 = success · compare = skipped |
| log ตัวกวาด | `ยังไม่ได้ตรวจ (หน้าโหลดไม่จบ: /portfolio) — {"ok":false,"responses":{"/api/portfolio":0},…}` → exit 2 |
| artifact | `contrast-390-round1` → `tmp/contrast-api.log` = **0 ไบต์** |
| ต้นเหตุ | `qa/tools/mock-api-466c.mjs` = pass-through `fetch("https://knightbasins.com"+req.url)` ทุกคำขอ |
| production ตอนตรวจ | `/api/catalog` 200 · `/api/portfolio` 200 (21 KB / 41 ms) ⇒ สะดุดชั่วคราวฝั่ง runner |
| หลังแก้ต้องเห็น | `contrast-api.log` มีบรรทัดต่อคำขอ (method · path · status · ms) และรอบ 1–3 ให้ verdict ตรงกัน |

> ### ✏️ ฉบับแก้ 1 (19 ต.ค. 69) — เพิ่ม "ปิดช่องที่ด่านมองไม่เห็น" (บอสเจอของจริง: ช่องจำนวนในใบเสนอราคา อ่านไม่ออก แต่ด่านผ่าน)
> **ที่มา:** บอสส่งภาพจากเว็บจริง — **ช่องจำนวน (− 1 +) ในแถวสินค้าใบเสนอราคา โหมดมืด อ่านไม่ออก** (ตัวเลข `#e8eff8` บนพื้นขาวฝังตาย = **1.16**) แต่ **ด่าน CI ผ่าน** เพราะตัวกวาด **มองไม่เห็นจุดนี้เลย**
> **หลักฐานเดวิด (สแกนเอง 1440 โหมดมืด `https://knightbasins.com/quote#cart`):** `checked 130` แถว · ตก 1 = ปุ่ม LINE (allowlist) · **ไม่มีแถวของ `.line-quantity` ทั้งในแถวที่วัดได้และในรายการ "วัดไม่ได้"** ทั้งที่แถวสินค้า (`row-quote-KF001`/`KF009`) เรนเดอร์จริง
> **เพิ่มใน SCOPE/GOAL ของใบนี้ (ทำต่อจาก A–E เดิม):**
> **F · ปิดช่องคอนโทรลและข้อความสั้น** — ตัวกวาดต้องวัด (1) ข้อความในคอนโทรล: `<input>` (ค่าในช่อง) · `<button>` ที่มีแต่ไอคอน (ใช้ `currentColor`) · checkbox ที่วาดเอง · stepper ทั้งกล่อง (เช่น `.line-quantity` พื้น+ตัวเลข+ไอคอน) (2) **ข้อความยาว 1–2 ตัวอักษร** (ตัวเลขจำนวน) ที่ตอนนี้ถูกข้าม — ต้องรายงานว่าตัวกรองไหนทำให้ข้าม
> **G · ยืนยันสถานะตะกร้าก่อนวัด** — ก่อนวัด `/quote#cart` ต้องยืนยันว่า **แถวสินค้าและกล่องจำนวนเรนเดอร์จริง** (มี `.line-quantity` และจำนวนแถวตรงกับที่ฉีด) ถ้าไม่ครบ ⇒ `exit 2` "ยังไม่ได้ตรวจ" ห้ามวัดหน้าว่างแล้วผ่าน
> **H · พิสูจน์แดงของช่องใหม่** — ย้อนสีช่องจำนวนกลับเป็นค่าที่ตก (ตามใบ 472-C ของชัย) ⇒ **ด่านต้องแดง** (แนบข้อความ log) · แล้วคืน ⇒ เขียว
> **ห้ามแตะเพิ่ม:** `artifacts/knight-basins/src/**` (สีช่องจำนวนแก้ในใบ **472-C ของชัย** — ใบนี้แก้แค่ตัวกวาด/workflow/เทสต์ของด่าน)

> [เดวิด → รีพิต] ใบใหม่ **471-R** — เรื่องเดียว: **ด่านคอนทราสต์ยังแดงปลอมได้** เพราะ preview ของ CI ไปดึง API จาก production สดทุกคำขอ (ไม่มี retry/ไม่มี readiness ครบปลายทาง)
> · **หลักฐาน:** main `984165e` → round 1 (ทั้ง 1440/390) ตก แต่ round 2 ผ่าน · ตัวกวาดรายงาน `ยังไม่ได้ตรวจ (หน้าโหลดไม่จบ: /portfolio)` + `responses:{"/api/portfolio":0}` + exit 2 ⇒ **fail-closed ทำงานถูก แต่ต้นเหตุคือเครือข่าย ไม่ใช่สี** · `mock-api-466c.mjs` เป็น pass-through ไป `knightbasins.com` · `contrast-api.log` ใน artifact = 0 ไบต์
> · **ต้องทำ:** (A) เลือกทาง A (fixture hermetic ที่ commit ไว้ + log ทุกคำขอ) หรือทาง B (timeout 5s + ลองซ้ำ 3 + log + รอพร้อมครบทุกปลายทาง) — แนะนำทาง A · (B) ให้ workflow รอพร้อม `/` + `/api/catalog` + `/api/portfolio` ก่อนเริ่มกวาด · (C) พิสูจน์ determinism 3 รอบบน commit เดียวกัน + ให้ job `Compare both contrast rounds` ผ่านจริง · (D) คง allowlist LINE/เกณฑ์ 4.5 และคงหลักฐานแดงไว้ · (E) ห้ามแตะ `src/**` · `api-server/**` · `data/**` · `deploy/**` · `public/**`
> · **ความสดของข้อมูลไม่ใช่หน้าที่ด่านนี้** — `Validate release contents` คุมอยู่แล้ว (ระบุในรายงานว่าเข้าใจ)
> · **ส่ง:** PR + ทางที่เลือก+เหตุผล + `contrast-api.log` ที่มี log ทุกคำขอ + ตาราง 3 รอบ + ลิงก์ compare ที่ผ่าน + หลักฐานแดง/บล็อก endpoint + เทสต์/tsc เป็นตัวเลข + commit/OS/ผู้รัน/เวลาไทย
> เกณฑ์ 12 ข้อ + หลักฐานราก: `qa/job-471-replit-contrast-hermetic-preview.md`
