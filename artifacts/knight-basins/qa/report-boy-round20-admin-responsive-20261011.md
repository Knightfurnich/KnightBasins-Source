# รายงาน 450-B · แอดมินใช้บนมือถือได้จริง (แก้ที่ต้นเหตุ ไม่ใช่กลบ)

ผู้ทำ: บอย (Qwen) · วันที่: 2026-10-11 (Asia/Bangkok) · Branch: `feat/admin-responsive-450b`
Baseline ก่อนแก้: commit `59950f7` (main) · Environment: Linux sandbox, node v22.23.3, pnpm, playwright-cli 1.x, chromium headless

## 1. สิ่งที่ไม่ดีแต่เดิม (วัดก่อนแก้)

สแกน source ทั้ง 32 ไฟล์ใน `src/admin/` (เทียบ git `HEAD` vs working tree)

| ตัวชี้วัด (before → after) | main@`59950f7` | หลังแก้ |
|---|---|---|
| `overflow-x-hidden` (ตัวกลบอาการ) | **1** (`AdminApp.tsx:172`) | **0** |
| `grid-cols-[2-9]` แบบไม่มี breakpoint (ต้นเหตุ "ฟอร์มเบียด") | **12** | **0** |
| `<table min-w-[600-999px]>` | 5 | 5 (คงไว้ เพราะอยู่ในกรอบเลื่อนของตัวเอง) |
| กรอบ `overflow-x-auto` ใน src/admin | 11 | 12 (+ ปฏิทิน) |

จุดที่บอสชี้ตรงกับที่วัดได้: `BasinsManager.tsx` มี `grid grid-cols-2 gap-4` **4 จุด** (before:บรรทัด 421, 463, 480, 498) = 2 คอลัมน์ตั้งแต่ 390px → input แคบ ~165px, label/thai text ล้น, แตะผิดช่อง
ไฟล์อื่นที่เบียดแบบเดียวกัน: `InstalledStonesManager.tsx:414,466` · `SheetStonesManager.tsx:364,407` · `StockInventoryPage.tsx:212` (4 คอลัมน์) · `TechnicianTeamsManager.tsx:339` (3 คอลัมน์) · `TechnicianCalendarPage.tsx:1028,1041` (7 คอลัมน์)

**ที่ตรวจไม่ได้:** ตัวเลข `scrollWidth − clientWidth ที่ 390/360` ต่อหน้าจริง และ screenshot ฟอร์ม BasinsManager ก่อน/หลัง — ต้องมี session เข้าหน้า `/admin/*` ซึ่ง **FORBIDDEN** (ห้าม login บัญชีแอดมินจริง) และ playwright daemon ใน sandbox ค้างซ้ำ 3 ครั้ง (`ERR_CONNECTION_REFUSED` / timeout 400s) จึงไม่กล้ารายงานตัวเลขที่ไม่มีของจริง ถ้าบอสส่ง screenshot หน้า `/admin/basins` ตอนเปิดฟอร์มบนเครื่องมาให้ หรือเปิด test account ที่มีสิทธิ์ read-only ผมวัดปิดรอบได้ทันที

## 2. สิ่งที่แก้ (ต้นเหตุ ไม่ใช่กลบอาการ)

1. **ถอดตัวกลบ** — `src/admin/AdminApp.tsx:172` `<main className="admin-main flex-1 p-4 md:p-10 overflow-x-hidden">` → ตัด `overflow-x-hidden` ออก อาการล้นถึงโผล่มาให้แก้ที่จริง และล็อกไว้ในเทสต์ห้ามใส่กลับ
2. **ล็อก min-width ที่ทำให้ grid บวม** — `src/index.css` (ท้ายไฟล์, bloc `job 450-B`):
   `.admin-app .admin-main :where(.grid, .flex, .table, table, [data-slot="dialog-content"]) { min-width: 0 }` + `.admin-main { min-width: 0 }` (grid/flex child ค่า default คือ `auto` = ดันหน้าให้กว้างกว่าจอ)
3. **ฟอร์มพับเหลือ 1 คอลัมน์บนมือถือ** — 8 จุด (`BasinsManager` 4, `InstalledStonesManager` 2, `SheetStonesManager` 2) ใช้
   `admin-form-grid grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4` → **ที่ ≥640px (รวมเดสก์ท็อป 1024/1440) เป็น 2 คอลัมน์เหมือนเดิมเป๊ะ** ระยะห่างแนวตั้ง 12px ระหว่างฟิลด์ ตามโจทย์ "ช่องคู่สั้นๆ พับได้"
4. **label กับช่องไม่เบียด** — `.admin-form-grid label { display:flex; flex-direction:column; gap:6px; min-width:0; overflow-wrap:anywhere }` (label อยู่บน, ช่อง text ยาวไม่ล้น) · กลุ่มฟิลด์คง `space-y-6` = 24px ระหว่างกลุ่มตามที่ระบุ
5. **ตาราง = เลื่อนในกรอบของตัวเอง** — ทุก `min-w-[600..980px]` (Basins/Installed/Sheet/Leads/Stock `:615`/Teams `:365`/Logs) ครอบด้วย `overflow-x-auto` อยู่แล้ว ตรวจด้วยเทสต์ว่าถ้ามี `min-w-[6-9]xx px` ต้องมีกรอบเลื่อน / ปฏิทิน (`TechnicianCalendarPage:792`) ใส่คลาส `admin-calendar-shell` → CSS ใหม่ให้ `overflow-x:auto` + กริดสัปดาห์ `admin-week-grid` คง 7 วัน (พับ 7 วันเป็น 1 คอลัมน์ไม่รู้เรื่อง) แต่ `.admin-week-grid{min-width:460px}` ให้ cell หดได้ + เลื่อนเฉพาะในพื้นที่มันเอง ไม่ใช่ดันทั้งหน้า
6. **เป้าแตะ ≥44px** — ใน `@media (max-width: 768px)` เท่านั้น: `:where(button, a[class*=button], input:not([type=checkbox/radio]), select, textarea, [role=button]) { min-height:44px }` + checkbox/radio เป็น 20×20 (เป็น square ที่แตะได้จริง) และ `@media` nี้ออกแบบไม่ให้เดสก์ท็อปโดน
7. **Dialog กว้างเกือบเต็มจอ + scroll ในตัว** — `max-width: calc(100vw - 16px)`, `max-height: calc(100dvh - 24px)` (≤768px) · `grid-cols-4/3` อื่นพับเป็น 2/1 ที่ `<820px` แล้วยืดกลับที่ ≥820px
8. **ข้อความยาวไม่ล้น** — `.admin-app .admin-main :where(td, th) { overflow-wrap: anywhere }` และ label/p ในฟอร์มเหมือนกัน

ไม่แตะ logic/API/สิทธิ์ — diff 8 ไฟล์ +55/−14 (tsx 8 จุด + grid รอง 2 จุด + CSS 41 บรรทัด)

## 3. เทสต์ที่เพิ่ม

`test/admin-responsive-contract.test.ts` (6 กรณี, สไตล์เดียวกับเทสต์ contract เดิมของ repo = อ่าน source แล้ว assert ไม่ต้องใช้ browser):
ห้ามมี mask · ฟอร์ม 8 จุดต้องพับ (ตรวจ count 4/2/2) และไม่มี naked grid เหลือ · group 24px + label เหนือช่อง · ปฏิทิน/ตารางต้องมีกรอบเลื่อนของตัวเอง · 44px + dialogกว้าง ต้องอยู่ใน media query ≤768px เท่านั้น (เดสก์ท็อปไม่เปลี่ยน) · stock/teams grid พับแบบคงเดสก์ท็อป

| การรัน | ผล |
|---|---|
| suite ทั้งโปรเจกต์ | **1,331 tests · pass 1,289 · fail 0 · skip 42** (baseline job 1,325/1,283/0/42 → +6 = เทสต์ใหม่) |
| เทสต์ contract 450-B | pass 6 / fail 0 |
| **two-way proof (negative)** | ใส่ `overflow-x-hidden` กลับ + ถอด `sm:grid-cols-2` 1 จุด → **fail 2**: `'AdminApp.tsx still masks horizontal overflow'` + เทสต์ฟอร์มแดง |
| **two-way proof (positive)** | restore → เขียว 6/6 |
| `npx tsc -p tsconfig.json --noEmit` | exit 0 |
| `PORT=... NODE_ENV=production pnpm run build` | exit 0 + `[production-assets] OK` |
| เดสก์ท็อปไม่เปลี่ยน | ตรวจสอบด้วยเหตุผล breakpoint: ทุก rule ใหม่ถูก gate ด้วย `sm:` (≥640px) หรือ `@media (max-width:768px)` → ที่ ≥1024px ค่าที่ computed เท่าเดิม (2 คอลัมน์, spacing เดิม) — **แต่ยังไม่ได้ screenshot 1440 ยืนยัน (ดูข้อ 1 "ตรวจไม่ได้")** |

## 4. ความเสี่ยง/สิ่งที่ควรตรวจก่อนเปิดใช้จริง

- `min-height:44px` ใน ≤768px ทำให้ icon button เล็กๆ ในตาราง (ปากกา/ถังขยะ) โตขึ้น — ตรงโจทย์ touch target แต่หน้า table จะสูงนิดหน่อย ถ้าบอสไม่ชอบ บอกได้ ผมจะกันเฉพาะ `.icon-button--sm`
- `@media (max-width:768px)` ใช้กลุ่ม 769–1023px (tablet) ด้วย = ยังเป็น 2 คอลัมน์ + ไม่มี 44px min-height; tablet เป็นกลุ่มที่บอสไม่ได้ระบุ ถ้าเอา 44px ด้วย ขอเคาะ 1023px
- ปฏิทินเดือน `min-width:460px` จะ scroll แนวนอนในพื้นที่ปฏิทินที่ 390/360 (โครงสร้าง 7 วันพับไม่ได้จริง) — ทางเลือกคือ list มุมมองมือถือแบบ stack ถ้าบอสสั่ง
- แนะนำรอรอบถัดไป measuring: 390/360 ทุก 15 route ด้วยบัญชี test (read-only) เพื่อปิดช่อง "ตรวจไม่ได้" ข้างบน
