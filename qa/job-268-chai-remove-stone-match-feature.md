# ใบงาน 268-C (ชัย) — ถอด feature “จับคู่สีหินจากภาพ” ออก (เก็บเครื่องยนต์ไว้เป็นโค้ดพัก)

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **ชัย** · **ผู้ตรวจรับ:** เดวิด
**Branch:** `fix/chai-remove-stone-match-feature`
**ที่มา (คำสั่งบอส 4 ต.ค. 69):** “งั้นเราตัด feature นี้ออกก่อน” + “เอาตามที่แนะนำ” ⇒ **ถอดทางเข้า (เมนู/หน้า/เส้นทาง API) ออก แต่เก็บ “เครื่องยนต์” ไว้เป็นโค้ดพัก** (แบบ A) — ไม่ลบงาน 248
**สถานะปัจจุบัน:** main `940429a` มีทั้งหน้าแอดมิน เมนู และ `POST /api/admin/stone-match` ทำงานอยู่บน production แล้ว ⇒ ต้องถอดออกและ deploy ใหม่

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. **ถอดทางเข้าใช้งานทั้งหมด** (3 ไฟล์ลบ + 4 ไฟล์แก้):
     - ลบ `artifacts/api-server/src/routes/stone-match.ts`
     - ลบ `artifacts/api-server/test/stone-match-api.test.ts`
     - ลบ `artifacts/knight-basins/src/admin/StoneMatchPage.tsx`
     - `artifacts/api-server/src/routes/index.ts` → ลบ import `stoneMatchRouter` (บรรทัด 12) + comment 2 บรรทัด + `router.use(stoneMatchRouter);` (บรรทัด 18-20) — **คงลำดับ router อื่นและ `router.use(adminRouter)` ไว้เหมือนเดิม**
     - `artifacts/knight-basins/src/admin/AdminApp.tsx` → ลบ import (บรรทัด 28) · รายการเมนู `{ href: "/admin/stone-match", … }` (บรรทัด 80) · `<Route path="/admin/stone-match" …>` (บรรทัด 180) · ฟังก์ชัน `StoneMatchRoute()` (บรรทัด 316-317)
     - `artifacts/knight-basins/src/App.tsx` → ลบ `<Route path="/admin/stone-match" component={AdminApp} />` (บรรทัด 1937)
     - `artifacts/knight-basins/test/admin-sidebar-groups.test.ts` → **กลับเป็น 15 เมนู** (พร้อมข้อความอ้างอิง “job-215 added /admin/logs”) · ลบเทสต์ใหม่ “files the stone-match page under the catalogue group …” (บรรทัด 32-38) · เอา `["/admin/stone-match", 'permission: "installed-stones"']` ออกจากรายการ (บรรทัด 57)
  2. **ห้ามลบ/ห้ามแก้ “เครื่องยนต์” (คำสั่งบอส: เก็บไว้เป็นโค้ดพัก)**
     - เก็บ `artifacts/api-server/src/lib/stone-matcher.ts` และ `artifacts/api-server/test/stone-match-prompt.test.ts` (15 เคส) **ไว้ทั้งไฟล์ เนื้อในต้องไม่เปลี่ยนแม้แต่บรรทัดเดียว**
  3. **ตรวจว่าไม่เหลือเศษอ้างอิง:** `grep -rn "stone-match\|StoneMatch\|stoneMatch" artifacts/api-server/src artifacts/knight-basins/src` → ต้องเหลือ **เฉพาะใน `lib/stone-matcher.ts`** เท่านั้น (และต้องไม่มี `/api/admin/stone-match` หลงเหลือที่ไหน รวมในเทสต์ของ knight-basins)
  4. **ไม่แตะ:** `src/index.css` (ต้อง 0 diff) · สิทธิ์ `installed-stones` (มีอยู่ก่อนแล้ว ใช้กับหน้าสีหินติดตั้ง) · `routes/admin-router.ts` · หน้าลูกค้า (`StudioPage.tsx` · `sketch*` · ส่วนลูกค้าของ `src/components/**`) · `src/data/**` · ใบงาน/KANBAN/docs (เก็บเป็นประวัติ ห้ามลบ)
  5. **ตั้งใจให้จำนวนเทสต์ลดลง** (เพราะลบเทสต์ของ feature) → รายงาน **ตัวเลขก่อน/หลัง** ให้ชัด ไม่ใช่รายงานแค่ว่า “ผ่าน”

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/stone-match.ts            (ลบไฟล์)
  - /opt/data/cache/kbsrc/artifacts/api-server/test/stone-match-api.test.ts         (ลบไฟล์)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/StoneMatchPage.tsx      (ลบไฟล์)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/index.ts
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/AdminApp.tsx
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/App.tsx
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/admin-sidebar-groups.test.ts

FORBIDDEN:
  - **ห้ามลบหรือแก้ `artifacts/api-server/src/lib/stone-matcher.ts`** และ **`artifacts/api-server/test/stone-match-prompt.test.ts`** (คำสั่งบอส: เก็บเป็นโค้ดพัก · เนื้อในต้อง 0 diff)
  - ห้ามแตะ `artifacts/knight-basins/src/index.css` (**0 diff**) · `artifacts/api-server/src/routes/admin-router.ts` · `artifacts/knight-basins/src/data/**` · หน้าลูกค้า (`StudioPage.tsx` · `sketch*` · ส่วนลูกค้าของ `src/components/**`)
  - ห้ามลบ/แก้ `qa/**` · `KANBAN.md` · `docs/**` (ประวัติการตัดสินใจต้องอยู่)
  - ห้ามลบหรือแก้ไฟล์อื่นนอก SCOPE (เช่น ห้ามลบ router อื่นใน `routes/index.ts`) · ห้ามแตะ env/คีย์/รุ่นโมเดล
  - ห้าม push ตรงเข้า `main` · ห้าม deploy เอง

EVIDENCE:
  1) `npx tsc --build` (ราก repo) แล้ว `npx tsc -p artifacts/api-server/tsconfig.json --noEmit` → 0 errors · `npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit` → 0 errors
  2) เทสต์ก่อน/หลัง (ระบุตัวเลขทั้งคู่):
     - api-server (คำสั่ง CI): `node --experimental-strip-types --test $(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort)` → **ก่อน ≈1184/1184/0 · หลังต้องลดลงเพราะลบ 7 เคส และต้องตก 0**
     - knight-basins (คำสั่ง CI ในโฟลเดอร์ `artifacts/knight-basins`) → **ก่อน 1113/1104/0/9 · หลังต้องลดลง 1 และตก 0**
     - `test/stone-match-prompt.test.ts` ต้องยัง **15/15** (เครื่องยนต์ยังอยู่ครบ)
  3) `grep -rn "stone-match\|StoneMatch\|stoneMatch" artifacts/api-server/src artifacts/knight-basins/src` → เหลือเฉพาะ `lib/stone-matcher.ts` (แนบผล)
  4) `git status --short` แสดงไฟล์ที่ลบ 3 ไฟล์ (D) และแก้ 4 ไฟล์ · `git diff origin/main...HEAD --name-only` มีเฉพาะไฟล์ใน SCOPE · `git diff origin/main...HEAD -- artifacts/knight-basins/src/index.css | wc -l` → **0**
  5) `git diff origin/main...HEAD -- artifacts/api-server/src/lib/stone-matcher.ts artifacts/api-server/test/stone-match-prompt.test.ts | wc -l` → **0** (เครื่องยนต์ไม่ถูกแตะ)
  6) **พิสูจน์ว่าถอดจริง:** ยืนยันว่าในโค้ดไม่เหลือเส้นทาง/เมนู `/admin/stone-match` และเมนูแอดมินกลับเป็น 15 รายการ (เทสต์ `admin-sidebar-groups` ผ่านด้วยจำนวน 15)
  7) **เดวิดจะยิงจริงหลัง deploy:** `POST /api/admin/stone-match` ต้องได้ **404** (ไม่ใช่ 200/403) · เมนู “จับคู่สีหินจากภาพ” ต้องหายจากหน้าแอดมิน · หน้าแอดมินอื่นปกติ

OUTPUT:
  - PR ที่ถอดเมนู+หน้า+เส้นทางออกครบ แต่เครื่องยนต์ยังอยู่ · แจ้งเดวิดเมื่อพร้อม (เดวิด merge + deploy + ยิงยืนยัน 404)

STOP:
  - เมื่อ tsc 0 ทั้งสองฝั่ง · เทสต์ชุด CI ตก 0 (พร้อมตัวเลขก่อน/หลัง) · หลักฐานไม่เหลืออ้างอิง · diff เครื่องยนต์ = 0 · เปิด PR และแจ้งเดวิด
  - หรือเมื่อทำงานครบ 12 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ถอด 3 ไฟล์ + แก้ 4 ไฟล์ · เก็บเครื่องยนต์ |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 7 ไฟล์ (ลบ 3 · แก้ 4) |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะเครื่องยนต์/index.css/หน้าลูกค้า/ประวัติ |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | tsc · เทสต์ก่อน/หลัง · grep · diff = 0 · เดวิดยิง 404 |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | PR ถอดครบ + ยืนยัน 404 |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 12 turns |
| 7 | SCOPE ใช้ absolute path | ผ่าน | /opt/data/cache/kbsrc/... |
| 8 | ระบุคำสั่งบอส | ผ่าน | “ตัด feature ออกก่อน” + “เอาตามที่แนะนำ” |
| 9 | แยกชัดว่าอะไรเก็บ/อะไรลบ | ผ่าน | เก็บ `stone-matcher.ts` + เทสต์ 15 เคส |
| 10 | มีข้อความส่งต่อให้บอส | ผ่าน | [เดวิด → ชัย] |
| 11 | ระบุผู้ตรวจรับ | ผ่าน | เดวิด |
| 12 | ระบุวันเวลาไทย | ผ่าน | 4 ต.ค. 69 |

## ข้อความส่งต่อให้บอส copy

```
[เดวิด → ชัย] ใบงาน 268 — qa/job-268-chai-remove-stone-match-feature.md · สาขา fix/chai-remove-stone-match-feature
บอสสั่ง: ตัด feature "จับคู่สีหินจากภาพ" ออกก่อน (แบบ A — ถอดทางเข้า แต่เก็บเครื่องยนต์ไว้)
ลบ 3 ไฟล์: artifacts/api-server/src/routes/stone-match.ts · artifacts/api-server/test/stone-match-api.test.ts · artifacts/knight-basins/src/admin/StoneMatchPage.tsx
แก้ 4 ไฟล์:
 - api-server/src/routes/index.ts: ลบ import stoneMatchRouter + comment + router.use(stoneMatchRouter) (บรรทัด 12, 18-20) คงลำดับ router อื่นเดิม
 - knight-basins/src/admin/AdminApp.tsx: ลบ import (28) · เมนู (80) · Route (180) · StoneMatchRoute (316-317)
 - knight-basins/src/App.tsx: ลบ <Route path="/admin/stone-match" .../> (1937)
 - knight-basins/test/admin-sidebar-groups.test.ts: กลับเป็น 15 เมนู + ลบเทสต์ stone-match (32-38) + เอา /admin/stone-match ออกจากรายการ (57)
ห้ามลบ/ห้ามแก้: api-server/src/lib/stone-matcher.ts และ test/stone-match-prompt.test.ts (ต้อง 0 diff — เก็บเป็นโค้ดพัก) · index.css (0 diff) · admin-router.ts · หน้าลูกค้า · src/data/** · qa/KANBAN/docs
ตรวจ: grep 'stone-match|StoneMatch|stoneMatch' ใน src ทั้งสองโปรเจกต์ → เหลือเฉพาะ lib/stone-matcher.ts
หลักฐาน: tsc 0 ทั้งสองฝั่ง (หลัง npx tsc --build ที่ราก repo) · เทสต์ชุด CI ก่อน/หลังเป็นตัวเลข (api ก่อน 1184/1184/0 → ลดลง 7 เคส · knight-basins ก่อน 1113/1104/0/9 → ลดลง 1) ต้องตก 0 · stone-match-prompt ยัง 15/15 · diff index.css = 0 · diff เครื่องยนต์ = 0
หลัง merge เดวิดจะ deploy + ยิงยืนยันว่า POST /api/admin/stone-match = 404 และเมนูหาย
```
