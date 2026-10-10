# ใบงาน 415-C (ชัย) — **แก้บั๊ก "ผูกลีดกับบัญชีลูกค้า" ให้ทำงานจริงในบันเดิล production** (บนสาขาของบอย · PR เดียว)

**วันที่:** 10 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **ชัย** (`artifacts/api-server/**` เป็นขอบเขตคุณ) · **ผู้ตรวจรับ:** **บอส** (เดวิดตรวจ+merge)
**ที่มา:** เดวิดตรวจ PR **#471** (งาน 414-B ของบอย) แล้วพบว่า **UI ถูกต้อง แต่ครึ่งฝั่ง API ตายใน production** — บอยเขียนไว้เองว่าไฟล์ `routes/portfolio.ts` ควรให้ชัย sign-off ⇒ ใบนี้คือส่วนนั้น
**กติกา:** แก้ **บนสาขาเดิม** `feat/line-desktop-dialog-optional-login-414-b` แล้ว push เข้าสาขานั้น (PR เดียวตามคำสั่งบอส) · **ห้ามแตะครึ่ง UI** (`src/components/PortfolioInquiryModal.tsx`) — ของบอยถูกต้องแล้ว

```
✅ มาตรฐานการออกใบงาน · 12/12 · 10 ต.ค. 69 · เดวิด

GOAL:
  A. **ทำให้ import ของ session ถูก inline เข้าบันเดิล production** — ตอนนี้ `src/routes/portfolio.ts` ใช้
     `const LINE_AUTH_MODULE_ID = "./" + "line-auth"; ... await import(LINE_AUTH_MODULE_ID);`
     ⇒ esbuild มองไม่ออก ปล่อยเป็น import ตอนรัน ⇒ `dist/` ไม่มีไฟล์ `line-auth.mjs` ⇒ **ERR_MODULE_NOT_FOUND**
     **แก้:** เปลี่ยนเป็น literal **ที่จุดเรียกใช้** `await import("./line-auth")` แล้วลบตัวแปร `LINE_AUTH_MODULE_ID` ทิ้ง
     · คง guard เดิม: ถ้าไม่มี cookie ในคำขอ = **ไม่ต้อง import เลย** (`return null` ก่อน)
     · คง `SESSION_COOKIE_NAME` (ห้าม import `SESSION_COOKIE` ระดับโมดูล เพราะจะลาก `@workspace/db` เข้าเทสต์ hermetic)
  B. **ทำให้เทสต์ hermetic กลับมาเขียว** — หลัง A, เทสต์ฐานของ repo จะพังเพราะ `@workspace/db` ถูก hoist:
     · แก้ที่ **harness ของเทสต์เท่านั้น** (`test/route-harness.ts`): ตั้งค่า `DATABASE_URL` ตัวแทนก่อน bundle
       เช่น `if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:5432/test";`
     · **ห้าม** แก้โค้ด production เพื่อเอาใจเทสต์
     · เทสต์ของบอย 1 ตัวที่ชื่อว่า "…and needs no DATABASE_URL" **ต้องเขียนใหม่** เพราะมันล็อกพฤติกรรม workaround ไว้
       ⇒ ให้เหลือข้อความยืนยันว่า **"คำขอที่ไม่มี cookie จะไม่แตะ session store"** (ไม่ต้องอ้างเรื่อง DATABASE_URL)
  C. **พิสูจน์ด้วยบันเดิลจริง** (ข้อนี้ห้ามข้าม):
     · `cd artifacts/api-server && node ./build.mjs` แล้วยืนยันว่า `dist/index.mjs` **ไม่มี** `import(LINE_AUTH_MODULE_ID)` อีก
       (คำสั่งตรวจ: `grep -c "LINE_AUTH_MODULE_ID" dist/index.mjs` ต้องได้ **0**)
     · แนบผล `grep` และขนาดไฟล์ `dist/index.mjs` ก่อน/หลัง
  D. **คืนบรรทัด KANBAN.md ที่ PR นี้ลบไป 7 บรรทัด** (แถว 414-B + ส่วน "ยืนยัน provider เดียวกัน") — อย่าลบข้อมูลบอร์ด
  E. **ห้ามเปลี่ยนพฤติกรรมที่เหลือ:** ตัวตนจาก cookie เท่านั้น · ไม่รับ userId/customerAccountId จาก body · fail-open ไม่ทำลีดหาย · Telegram card

SCOPE (แก้เฉพาะที่ระบุ · ทำงานบนสาขา `feat/line-desktop-dialog-optional-login-414-b`):
  - (รีโป) `artifacts/api-server/src/routes/portfolio.ts`                     (ข้อ A — เฉพาะ handler `/public/portfolio/inquiry` + helper)
  - (รีโป) `artifacts/api-server/test/route-harness.ts`                       (ข้อ B)
  - (รีโป) `artifacts/api-server/test/portfolio-inquiry-identity.test.ts`      (ข้อ B — เขียนเทสต์ 1 ตัวใหม่)
  - (รีโป) `KANBAN.md`                                                        (ข้อ D — คืนบรรทัด)
  - (รีโป) `artifacts/api-server/src/routes/line-auth.ts`                     (อ่านเท่านั้น — ห้ามแก้)
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/portfolio.ts        (สำเนาที่เดวิดตรวจ — ดูของจริงว่าต่างกันตรงไหน)
  - /opt/data/knight-design-kb/qa/report-chai-round8-portfolio-bundle-fix-20261010.md   (ใหม่) รายงานของคุณ

FORBIDDEN:
  - ห้ามแตะ `artifacts/knight-basins/**` (โดยเฉพาะ `src/components/PortfolioInquiryModal.tsx` — ครึ่ง UI ของบอยผ่านแล้ว)
  - ห้ามแก้ `src/routes/line-auth.ts` · ห้ามแก้โค้ด production เพื่อหลบเทสต์ · ห้ามเพิ่ม external/alias ที่ทำให้ production ใช้ import ตอนรันอีก
  - ห้ามรับตัวตนจาก body/client · ห้าม commit เข้า `main` ตรง ๆ · ห้าม merge PR เอง · ห้ามใช้/พิมพ์ค่าลับ
  - ข้อที่ตรวจไม่ได้ให้เขียน "ตรวจไม่ได้ + เหตุผล" — ห้ามเดาว่าผ่าน

EVIDENCE (ต้องแนบผลจริง — คำสั่ง/ผลรัน/ตัวเลข):
  1) `git log -1 --format=%H` ของสาขาหลัง push + `git diff --stat` เฉพาะไฟล์ที่แตะ
  2) เทสต์ portfolio ทั้งชุด: `cd artifacts/api-server && node --experimental-strip-types --test test/portfolio-*.test.ts` → **ต้องผ่าน 63/63** (baseline ปัจจุบัน: 63 tests · ผ่าน 63)
  3) เทสต์เต็มชุดของ api: `node --experimental-strip-types --test test/*.test.ts` → เทียบกับ main สะอาด (1240-ish/ผ่าน~1220) และยืนยัน **ไม่มีตัวใหม่ที่ตกเพราะการแก้**
  4) `npx tsc -p tsconfig.json --noEmit` → **0**
  5) หลักฐานบันเดิล: `node ./build.mjs` + `grep -c "LINE_AUTH_MODULE_ID" dist/index.mjs` = **0** + ขนาดไฟล์
  6) **พิสูจน์สองทาง:** ย้อนการแก้ (กลับไปใช้ specifier ประกอบ) → `grep` ต้องเจอ ≥1 และอธิบายว่าทำไม production ถึงพัง · คืนแล้ว = 0
  7) ตอบชัด: เทสต์ hermetic กลับมาได้อย่างไร (แนบ diff ของ `route-harness.ts`) และทำไมไม่ใช้วิธี `external`/`alias` กับ `@workspace/db`
  8) `git diff origin/main -- KANBAN.md` ต้อง **ไม่มีการลบบรรทัด** (คืนครบแล้ว)
  9) เวลาไทยที่ทำ + hash commit

OUTPUT:
  - push เข้าสาขา `feat/line-desktop-dialog-optional-login-414-b` (PR #471 เดิม — ไม่ต้องเปิด PR ใหม่)
  - `/opt/data/knight-design-kb/qa/report-chai-round8-portfolio-bundle-fix-20261010.md`
  - สรุป 5 บรรทัด: แก้อะไร · เทสต์ผ่าน/ไม่ผ่าน · หลักฐานบันเดิล · ตรวจไม่ได้อะไร · ความเสี่ยง

STOP:
  - ครบ A–E พร้อมหลักฐาน · หรือทำครบ **12 turns** ให้หยุดและรายงานสิ่งที่เสร็จ + ที่เหลือ
  - **ถ้าการแก้ทำให้เทสต์ตกเกิน 2 ไฟล์ หรือต้องแก้โค้ด production นอก `portfolio.ts` → หยุดและแจ้งเดวิดทันที**
```

## เช็คลิสต์ท้ายใบ (ติ๊กในรายงาน/PR)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ผ่าน |
|---|---|---|
| 1 | literal ที่จุดเรียก import | ไม่มีตัวแปร specifier เหลือ |
| 2 | guard ไม่มี cookie ไม่ import | โค้ด + เทสต์ยืนยัน |
| 3 | `SESSION_COOKIE_NAME` ยังเป็นค่าคงที่ในไฟล์ | ไม่ import ระดับโมดูลจาก line-auth |
| 4 | harness ตั้ง DATABASE_URL ตัวแทน | diff ของ `test/route-harness.ts` |
| 5 | เทสต์ portfolio | **63/63** |
| 6 | เทสต์ api เต็มชุด | ไม่มีตัวใหม่ตก |
| 7 | `tsc --noEmit` | 0 |
| 8 | บันเดิลไม่มี runtime import | `grep -c LINE_AUTH_MODULE_ID dist/index.mjs` = 0 |
| 9 | พิสูจน์สองทาง | ย้อนการแก้ → grep ≥1 · คืน → 0 |
| 10 | KANBAN ไม่หาย | `git diff origin/main -- KANBAN.md` ไม่มีลบ |
| 11 | ไม่แตะครึ่ง UI | `git diff` ไม่มีไฟล์ใน knight-basins |
| 12 | หลักฐานครบ | hash + เวลาไทย + ขนาดบันเดิล |

> [เดวิด → ชัย]
> ใบนี้เป็นงาน **แก้บั๊กในไฟล์ของคุณ** บนสาขาของบอย (PR #471) — อาจารย์บอสสั่งให้รวมเป็น **PR เดียว** จึงไม่แยกสาขา
> · ปัญหา: `api-server` รันเป็นบันเดิล และ `import("./" + "line-auth")` ที่ประกอบสตริงตอนรัน **ไม่ถูก bundle** ⇒ `dist/` ไม่มีไฟล์นั้น ⇒ รันจริงได้ `ERR_MODULE_NOT_FOUND` (ผมรันพิสูจน์แล้ว) ⇒ **ลีดไม่ถูกผูกบัญชี** เพราะ catch แล้วได้ `null`
> · วิธีแก้ที่ผมรันยืนยันแล้ว: literal ที่จุดเรียก + harness ตั้ง `DATABASE_URL` ตัวแทน ⇒ portfolio **62/63** (ตกเฉพาะเทสต์ที่ต้องเขียนใหม่ 1 ตัว)
> · ห้ามแก้ครึ่ง UI ของบอย (`PortfolioInquiryModal.tsx`) และห้ามแตะ `line-auth.ts`
> · รบกวน **คืน 7 บรรทัดใน KANBAN.md** ที่ PR นี้ลบไปด้วย
> · เสร็จแล้ว **อย่า merge** — ผมตรวจ (และจะวัด `dist` ซ้ำ) แล้ว merge ให้
> เกณฑ์ 12 ข้อ + รายละเอียดเต็ม: `qa/job-415-chai-portfolio-bundle-fix.md`
