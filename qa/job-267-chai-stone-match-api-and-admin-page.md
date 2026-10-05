# ใบงาน 267-C (ชัย) — รับช่วงใบ 266: ต่อ “จับคู่สีหินจากภาพ” เข้าแอป (API แอดมิน + หน้าจอทดสอบ)

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **ชัย** · **ผู้ตรวจรับ:** เดวิด
**Branch ใหม่ของชัย:** `fix/chai-stone-match-api-and-admin-page` (แตกจาก main ล่าสุด)
**ที่มา (คำสั่งบอส 4 ต.ค. 69):** “เดวิดเปลี่ยนใบงานนี้ให้ชัยหน่อย เพราะบอยโทเคนเต็ม” ⇒ **โอนงานจากบอย (ใบ 266) มาให้ชัย**
**ของเดิมที่ใช้ได้ (ห้ามทำซ้ำ):** บอยเปิด PR #346 สาขา `fix/freebuff-stone-match-api-and-admin-page` (988+/19- · 6 ไฟล์) โค้ดผ่านการตรวจของเดวิดแล้ว (tsc 0 · เทสต์งาน 7/7 · stone-match-prompt 15/15 · index.css 0 · ไม่แตะไฟล์ต้องห้าม) — **เหลือแค่ทำให้ CI เขียว + เปิด PR ของชัย**

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. **รับช่วงโค้ดของบอย (ไม่ต้องเขียนใหม่):** ดึงสาขา `fix/freebuff-stone-match-api-and-admin-page` (PR #346) มาเป็นฐาน แล้วสร้างสาขาใหม่ของชัย `fix/chai-stone-match-api-and-admin-page` **จาก main ล่าสุด** — แล้วเปิด PR ใหม่ (ห้าม push ทับสาขาของบอย)
  2. **แก้ให้ CI เขียว (จุดเดียวที่ตก):** `artifacts/knight-basins/test/admin-sidebar-groups.test.ts`
     - เทสต์ “assigns every nav item to a declared group” ล็อกจำนวนรายการเมนูไว้ **15** แต่เมนูใหม่ `/admin/stone-match` ทำให้เป็น **16** → อัปเดตให้ตรง (และ **ยืนยันว่าเมนูใหม่ถูกจัดเข้า “กลุ่มที่ประกาศไว้”** ตามเจตนาของเทสต์)
     - ถ้ามีเทสต์อื่นที่ล็อกรายการเมนู/กลุ่ม/สิทธิ์ของแอดมิน ให้อัปเดตตาม (ห้ามลบเทสต์เพื่อให้ผ่าน)
  3. **คงคุณสมบัติครบตามใบ 266 (ห้ามลดทอนเพื่อให้ผ่าน):** `requireAdminPermission("installed-stones","view")` · rate limit `admin-stone-match` 10/นาที → 429 · เพดานภาพ 8 MB → 413 · รับเฉพาะ jpeg/png/webp + ตรวจลายเซ็นไฟล์จริง → 400 · matcher ปิด/no-candidates → **200** + ข้อความไทย (ห้าม 500) · mount **ก่อน** `adminRouter` · ไม่มี path/ชื่อไฟล์/คีย์/env รั่วในคำตอบ
  4. **รันชุดเดียวกับ CI ให้ครบและรายงานเป็นตัวเลข** (ไม่ใช่คำรับรอง): api-server (`node --experimental-strip-types --test $(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort)`) · knight-basins (คำสั่งเดียวกันในโฟลเดอร์ `artifacts/knight-basins`) · tsc ทั้งสองฝั่ง **หลัง build libs** (`npx tsc --build` ที่ราก repo ก่อน — ถ้าไม่ build จะเจอ error หลอกเรื่อง speakingRate ของ lib/api-zod)
  5. **ไม่แตะของเดิม/ไฟล์ต้องห้าม:** `lib/stone-matcher.ts` (เพิ่ง merge #295) · `routes/admin-router.ts` · `src/index.css` · หน้าลูกค้า (`StudioPage.tsx` · `sketch*` · `src/components/**` ส่วนลูกค้า) · `src/data/**`
  6. **live-fire ภาพจริง = เดวิดทำ** หลัง deploy (บอยยิงไม่ได้เพราะแซนด์บ็อกซ์ไม่มีคีย์ Vertex/DATABASE_URL — ชัยไม่ต้องทำข้อนี้)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/stone-match.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/index.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/stone-match-api.test.ts
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/StoneMatchPage.tsx
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/AdminApp.tsx
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/App.tsx
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/admin-sidebar-groups.test.ts   (แก้จำนวน/กลุ่มเมนู)

FORBIDDEN:
  - ห้าม push ทับหรือแก้สาขาของบอย `fix/freebuff-stone-match-api-and-admin-page` (เก็บไว้เป็นหลักฐาน)
  - **ห้ามแก้ `artifacts/api-server/src/lib/stone-matcher.ts`** (เพิ่ง merge #295 · `temperature: 0` + env-driven ต้องคงเดิม)
  - ห้ามแตะ `artifacts/knight-basins/src/index.css` (**ต้อง 0 diff**) · `artifacts/api-server/src/routes/admin-router.ts` · `artifacts/knight-basins/src/data/**` · หน้าลูกค้า (`StudioPage.tsx` · `sketch*` · ส่วนลูกค้าของ `src/components/**`) · `lib/vertex-*`
  - ห้ามลดทอนด่านความปลอดภัย (สิทธิ์/rate limit/เพดานขนาด/ตรวจลายเซ็น) เพื่อให้เทสต์ผ่าน · ห้ามลบหรือปิดเทสต์เดิม
  - ห้ามฝังชื่อโมเดล/คีย์/env ในโค้ดหรือ UI · ห้ามพิมพ์คีย์/`.env` ลงรายงานหรือ PR · ห้ามเพิ่มไลบรารี
  - ห้าม push ตรงเข้า `main` · ห้าม deploy เอง

EVIDENCE:
  1) `npx tsc --build` (ราก repo) → แล้ว `npx tsc -p artifacts/api-server/tsconfig.json --noEmit` → 0 errors · และ `npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit` → 0 errors
  2) เทสต์ api-server: `node --experimental-strip-types --test test/stone-match-api.test.ts` → ระบุ tests/pass/fail (ต้องครอบ (ก)-(จ) ตามใบ 266 + rate limit) · `test/stone-match-prompt.test.ts` = **15/15** (ฐานที่เดวิดวัด)
  3) เทสต์ knight-basins ชุดเดียวกับ CI: `node --experimental-strip-types --test $(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort)` → **ต้องตก 0** (ก่อนแก้ ใบนี้ตก 1 = `admin-sidebar-groups`)
  4) **พิสูจน์ว่าจับได้:** ย้อนจำนวนเมนูในเทสต์กลับเป็น 15 → ต้องตก (แนบข้อความ) · และย้อนการตรวจสิทธิ์ใน `stone-match.ts` → เคส 403 ต้องตก
  5) `git diff origin/main...HEAD --name-only` → เฉพาะไฟล์ใน SCOPE · `git diff origin/main...HEAD -- artifacts/knight-basins/src/index.css | wc -l` → **0**
  6) แนบหลักฐานว่าดึงงานของบอยมา: `git log --oneline -3` แสดงว่าสาขาใหม่มีงานของบอย (หรือ merge/rebase จากสาขานั้น) และ PR #346 ยังอยู่ (เดวิดจะปิดพร้อมอ้างอิง PR ของชัย)
  7) เดวิดจะยิงจริง 2 ภาพบน production หลัง deploy (ภาพสเล็บหินจาก KB) และตรวจว่าไม่มี path/คีย์หลุด

OUTPUT:
  - สาขาของชัย + PR ใหม่ที่ CI เขียวครบ และคงคุณสมบัติตามใบ 266 ครบ
  - แจ้งเดวิดเมื่อพร้อม (เดวิด merge เองเมื่อ CI เขียว + หลักฐานครบ) → แล้วเดวิด deploy + ยิงจริง 2 ภาพ

STOP:
  - เมื่อ tsc 0 ทั้งสองฝั่ง · เทสต์ชุด CI ผ่านตก 0 · พิสูจน์จับได้ · เปิด PR และแจ้งเดวิด
  - หรือเมื่อทำงานครบ 12 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | รับช่วงของบอย + แก้เทสต์เมนู 15→16 + คงด่านครบ |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 7 ไฟล์ (รวมเทสต์ที่ต้องแก้) |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะสาขาบอย/stone-matcher/index.css/หน้าลูกค้า/ลดด่าน |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | tsc · เทสต์ชุด CI · พิสูจน์จับได้ · diff |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | PR ใหม่ CI เขียว + เดวิด deploy/ยิงจริง |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 12 turns |
| 7 | SCOPE ใช้ absolute path | ผ่าน | /opt/data/cache/kbsrc/... |
| 8 | ระบุเหตุโอนงาน | ผ่าน | บอสสั่ง 4 ต.ค. 69 (บอยโทเคนเต็ม) |
| 9 | ห้ามทำซ้ำของเดิม | ผ่าน | ใช้โค้ดจาก PR #346 เป็นฐาน |
| 10 | มีข้อความส่งต่อให้บอส | ผ่าน | [เดวิด → ชัย] |
| 11 | ระบุผู้ตรวจรับ | ผ่าน | เดวิด |
| 12 | ระบุวันเวลาไทย | ผ่าน | 4 ต.ค. 69 |

## ข้อความส่งต่อให้บอส copy

```
[เดวิด → ชัย] ใบงาน 267 — qa/job-267-chai-stone-match-api-and-admin-page.md · สาขาใหม่ fix/chai-stone-match-api-and-admin-page
บอสสั่งโอนงานนี้จากบอย (ใบ 266) มาให้ชัย เพราะบอยโทเคนเต็ม — ห้ามทำซ้ำ: ดึงสาขา fix/freebuff-stone-match-api-and-admin-page (PR #346) มาใช้เป็นฐาน แล้วแตกสาขาใหม่ของตัวเองจาก main ล่าสุด (ห้าม push ทับสาขาบอย)
งานที่เหลือจริง ๆ มีจุดเดียว + เปิด PR ใหม่:
1) CI ตก 1 เคส: artifacts/knight-basins/test/admin-sidebar-groups.test.ts "assigns every nav item to a declared group" ล็อกจำนวนเมนู 15 แต่เมนูใหม่ /admin/stone-match ทำให้เป็น 16 → อัปเดตจำนวน + ยืนยันว่าเมนูใหม่ถูกจัดเข้ากลุ่มที่ประกาศไว้ (ห้ามลบเทสต์)
2) คงคุณสมบัติครบตามใบ 266 ห้ามลดทอน: requireAdminPermission("installed-stones","view") · rate limit 10/นาที · ภาพ ≤8MB→413 · jpeg/png/webp + ตรวจลายเซ็น · matcher ปิด → 200 ข้อความไทย · mount ก่อน adminRouter · ไม่มี path/คีย์รั่ว
3) ห้ามแตะ lib/stone-matcher.ts · routes/admin-router.ts · src/index.css (0 diff) · หน้าลูกค้า · src/data/**
4) รันให้ครบแบบ CI และรายงานตัวเลข:
   - npx tsc --build (ราก repo) ก่อน แล้ว tsc ทั้งสองฝั่ง → 0
   - api-server: node --experimental-strip-types --test $(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort)
   - knight-basins: คำสั่งเดียวกันในโฟลเดอร์ artifacts/knight-basins → ต้องตก 0
   - พิสูจน์จับได้: ย้อนจำนวนเมนูเป็น 15 → ตก · ย้อนการตรวจสิทธิ์ → เคส 403 ตก
ฐานอ้างอิง: stone-match-prompt 15/15 · บน main เทสต์ admin-sidebar-groups ผ่าน 6/6 · index.css 0 diff
live-fire 2 ภาพจริง เดวิดยิงเองหลัง deploy (ชัยไม่ต้องทำ)
```
