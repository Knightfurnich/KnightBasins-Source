# รายงานชัย รอบ 8 — งาน 415-C: แก้ "ผูกลีดกับบัญชีลูกค้า" ให้ทำงานจริงในบันเดิล production

**ผู้ทำ:** ชัย · **สั่งโดย:** เดวิด (ใบ `qa/job-415-chai-portfolio-bundle-fix.md`) · **ตรวจรับ:** บอส/เดวิด (ชัยไม่ merge)
**เวลาไทย:** 10 ต.ค. 69 · ลงมือ ~12:00–13:00 น. (UTC+7)
**สาขา/PR:** `feat/line-desktop-dialog-optional-login-414-b` (PR #471 เดิม — ไม่เปิด PR ใหม่)
**คอมมิตโค้ด:** `18aa86d8fd1d1bf911b44ad433c6741d74e7b938` · คอมมิตรายงาน/merge: ดูท้ายไฟล์ (`git log`)
**หมายเหตุที่เก็บรายงาน:** ใบสั่งให้เขียนไปที่ `/opt/data/knight-design-kb/qa/…` ซึ่งอยู่บน VPS ของเดวิด ชัยเข้าไม่ถึง (ไม่มีสิทธิ์เขียน) จึงวางไว้ที่ `qa/` ของรีโปบนสาขาเดียวกัน เดวิดคัดลอกต่อได้

---

## สรุป 5 บรรทัด
1. **แก้อะไร:** `portfolio.ts` เปลี่ยน `import(LINE_AUTH_MODULE_ID)` เป็น literal `await import("./line-auth")` ที่จุดเรียก (ลบตัวแปรทิ้ง) · harness ตั้ง `DATABASE_URL` ตัวแทน · เขียนเทสต์ที่ล็อก workaround ใหม่ + เพิ่มเทสต์บันเดิล 1 ตัว · คืน KANBAN ด้วยการ merge `main` เข้าสาขา
2. **เทสต์:** portfolio **64/64** (ใบกำหนด 63 — เกิน 1 เพราะผมเพิ่มเทสต์บันเดิล ดูข้อ 2) · api เต็มชุด 1226 ทดสอบ / ผ่าน 1217 / ตก 9 เทียบ main สะอาด 1209 / 1199 / 10 → **ชุดที่ตกเหมือนกัน ไม่มีตัวใหม่** · `tsc` ได้ 2 error ชุดเดียวกับ main สะอาด (ดูข้อ 4)
3. **บันเดิล:** `grep -c LINE_AUTH_MODULE_ID dist/index.mjs` **2 → 0** · ขนาด 2,668,946 → 2,670,739 ไบต์ (+1,793) · ย้อนการแก้ → กลับเป็น 2 และ `ERR_MODULE_NOT_FOUND` ซ้ำ
4. **ตรวจไม่ได้:** (ก) ทดสอบจริง cookie → ค้น DB → ได้ `customerAccountId` ใน production (ไม่มี DB/ความลับ) · (ข) `tsc` = 0 ในเครื่องนี้ (มี error เดิม 2 ตัวจากไลบรารีที่ลิงก์) · (ค) guard "ไม่มี cookie" ไม่มีเทสต์ใดจับได้ถ้าถูกลบ (ดูข้อ 5)
5. **ความเสี่ยง:** สูตร harness ตามใบ (ตั้งตอน import) **ทำให้ `support-route.test.ts` ตก 8 ตัว** — ผมปรับเป็นตั้งแบบ lazy · ใบระบุว่า PR "ลบ KANBAN 7 บรรทัด" แต่ตรวจแล้วเป็นผลของฐานสาขาเก่า (ดูข้อ 8)

---

## 1. การแก้ A — `src/routes/portfolio.ts`

ก่อน: `const LINE_AUTH_MODULE_ID = "./" + "line-auth";` … `await import(LINE_AUTH_MODULE_ID)`
หลัง: `await import("./line-auth")` ที่จุดเรียกเดียว (ลบตัวแปรทิ้ง) · เพิ่มคอมเมนต์อธิบายเหตุผลว่าทำไมต้องเป็น literal

คงเดิมทั้งหมด: guard `if (!req.headers?.cookie?.includes(\`${SESSION_COOKIE_NAME}=\`)) return null;` · `SESSION_COOKIE_NAME` ค่าคงที่ในไฟล์ (ไม่ import `SESSION_COOKIE` ระดับโมดูล) · ตัวตนจาก cookie เท่านั้น · ไม่อ่านอะไรจาก body · try/catch fail-open · การ์ด Telegram · ไม่แตะ `line-auth.ts` และไม่แตะไฟล์ใน `artifacts/knight-basins/**`

## 2. การแก้ B — เทสต์

**`test/route-harness.ts`** (diff เต็ม):

```diff
+// Placeholder only: `@workspace/db` is external to the test bundles ... (คอมเมนต์เต็มในไฟล์)
+function ensureDatabaseUrlPlaceholder(): void {
+  if (!process.env["DATABASE_URL"]) {
+    process.env["DATABASE_URL"] = "postgres://test:test@127.0.0.1:5432/test";
+  }
+}
 ...
 export async function importTypeScriptModule<T>(...) {
   const bundle = await bundleTypeScriptModule(entryPoint);
+  ensureDatabaseUrlPlaceholder();
 ...
 export async function serveTypeScriptRoute(...) {
   const bundle = await bundleTypeScriptModule(entryPoint);
+  ensureDatabaseUrlPlaceholder();
```

**ทำไมเทสต์ hermetic กลับมาได้:** `@workspace/db` ถูกตั้งเป็น `external` ในเทสต์อยู่แล้ว แต่พอ `portfolio.ts` มี `import("./line-auth")` แบบ literal esbuild จะ inline `line-auth` เข้าบันเดิลเทสต์ และ `import … from "@workspace/db"` ใน `line-auth` ถูกยกขึ้นเป็น import ระดับบนสุด ⇒ `lib/db/src/index.ts` รันตอนโหลดโมดูลและ throw ถ้าไม่มี `DATABASE_URL` ⇒ ตก 19 ตัวใน portfolio (ย้อนตัวตั้งค่าเพื่อพิสูจน์: 41 ผ่าน / **19 ตก**) `pg.Pool` เชื่อมต่อแบบ lazy จึงไม่มีการต่อเน็ตจริงด้วยค่าตัวแทน

**ทำไมไม่ใช้ `external` / `alias` กับ `@workspace/db`:** `external` ใช้อยู่แล้วและไม่ใช่สาเหตุ (ปัญหาคือโมดูลจริงโยน error ตอนโหลด) · `alias` ไปยัง stub จะทำให้เทสต์ไม่ได้ทดสอบ wiring จริงของ `line-auth`/`db` และเทสต์บันเดิลใหม่จะ bundle ของปลอม · และใบห้ามเพิ่ม external/alias ที่ทำให้ production กลับไปใช้ import ตอนรัน — วิธีตั้ง env ที่ harness กระทบเฉพาะเทสต์ ไม่แตะ production

**⚠️ สิ่งที่ผมเบี่ยงจากสูตรในใบ (ต้องรู้):** ใบให้ตั้ง `DATABASE_URL` ตอน import ไฟล์ harness ผมทดลองแล้วทำให้ **`test/support-route.test.ts` ตก 8 ตัว** เพราะไฟล์นั้นตัดสินที่ระดับโมดูลว่า "ถ้าไม่มี `DATABASE_URL` ให้ skip ตัวเอง" (ต้องใช้ Postgres จริง) — พอ harness ตั้งค่าตัวแทนก่อน ไฟล์นั้นเลยไม่ skip แล้วพยายามต่อ `127.0.0.1:5432` ⇒ `ECONNREFUSED` ผมจึงเปลี่ยนเป็นตั้ง **ทันทีก่อนโหลดบันเดิล** (lazy) ซึ่งไฟล์นั้นยังเห็น env ว่างตอนตัดสิน skip ผลหลังแก้: `support-route` กลับเป็น skip เหมือน main (1/1 pass) ส่วนเทสต์ที่ 8 ตัวนั้นตกเฉพาะรอบรันแรกของผม ไม่มีค้างอยู่
(เดวิดรันสูตรนี้กับ portfolio ชุดเดียว จึงไม่เห็นผลข้างเคียงนี้ — เป็นเหตุผลที่ต้องรันเต็มชุด)

**`test/portfolio-inquiry-identity.test.ts`:**
- เขียนใหม่ 1 ตัว: **"a request without the session cookie never touches the session store"** — แทนที่ตัวเดิมที่ assert ว่า `DATABASE_URL` ต้อง undefined · สไปย์ `pool.query` ของ `@workspace/db` แทน session store · มี **control**: cookie ที่เซ็นถูกต้อง (HMAC ด้วย `SESSION_SECRET` ที่ตั้งเฉพาะเทสต์) ต้องเรียก store 1 ครั้ง แล้วจึงยืนยันว่าคำขอไม่มี cookie เรียก **0 ครั้ง** และไม่มี `console.warn` · ไม่อ้างเรื่อง `DATABASE_URL` เลย · คืนค่า env/`pool.query`/`console.warn` ใน `finally`
- **เพิ่มเอง 1 ตัว (นอกคำสั่ง — ถอดได้ถ้าเดวิดไม่ต้องการ):** "the production bundle inlines the session lookup" — bundle `portfolio.ts` ด้วย esbuild แบบเดียวกับ production แล้วยืนยันว่า (ก) มี `findAuthenticatedAccount` ถูก inline (ข) ทุก `import()` ที่เหลือเป็น literal (ค) ไม่มีการอ้าง `./line-auth` ที่เหลือเป็นไฟล์ภายนอก ⇒ เป็นเทสต์ถาวรที่จับบั๊กต้นเหตุนี้ได้ถ้ากลับมาอีก เหตุผลที่เพิ่ม: เทสต์ของบอยทั้งหมดใช้ resolver ที่ฉีดเข้าไป จึงไม่มีตัวไหนจับบั๊กนี้ได้ (มันหลุดไปถึงรีวิวของเดวิดด้วยเหตุนี้) · ผลคือ portfolio = **64/64** แทน 63/63

## 3. หลักฐานบันเดิล (ข้อ C)

| | `grep -c LINE_AUTH_MODULE_ID dist/index.mjs` | ขนาด `dist/index.mjs` | รันจริง `import("./line-auth")` จากใน `dist/` |
|---|---|---|---|
| ก่อนแก้ (คำสั่ง `node ./build.mjs` บนสาขาเดิม) | **2** (`dist/index.mjs:60016` `var LINE_AUTH_MODULE_ID = "./line-auth"` และ `:60020` `await import(LINE_AUTH_MODULE_ID)`) | 2,668,946 B | `ERR_MODULE_NOT_FOUND` (`dist/` ไม่มีไฟล์ line-auth — `ls dist | grep -c line-auth` = 0) |
| หลังแก้ | **0** | 2,670,739 B (+1,793) | ไม่ต้องใช้ — โค้ดถูก inline: `await Promise.resolve().then(() => (init_line_auth(), line_auth_exports))` ใน `lineAccountIdFromSessionCookie` |

## 4. `tsc` (ข้อ 4)
`node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` ในเครื่องนี้ = **2 error** (`admin-router.ts(3353)` `speakingRate` ×2) — **ชุดเดียวกับ main สะอาด** (รันบน worktree `origin/main` `5ccd153` ได้เหมือนกันเป๊ะ) สาเหตุคือ `node_modules` ที่ลิงก์เข้า checkout หลักชี้ไปยังไลบรารี workspace รุ่นเก่า ไม่เกี่ยวกับการแก้นี้ · ไฟล์ที่แตะ 0 error · **0 ตามเกณฑ์ของใบ "ตรวจไม่ได้" ในเครื่องนี้ — ต้องใช้ CI ลินุกซ์เป็นผู้ตัดสิน**

## 5. พิสูจน์สองทาง / mutation (ข้อ 6)

| การย้อน | ผล |
|---|---|
| **M1** กลับไปใช้ specifier ประกอบ (`"./" + "line-auth"` + `import(LINE_AUTH_MODULE_ID)`) | `grep` = **2**, ขนาด 2,668,946 B (เท่ากับก่อนแก้), `ERR_MODULE_NOT_FOUND` · เทสต์ที่ตก **2 ตัว**: เทสต์บันเดิลใหม่ และเทสต์ "ไม่มี cookie…" (น่าจะตกที่ส่วน control เพราะโหลด line-auth ไม่ได้ — อนุมานจากชื่อเทสต์ที่ตก ไม่ได้ดูข้อความ assert) — เทสต์เดิมของบอยทั้งหมดยังเขียว ⇒ ยืนยันว่าเทสต์เดิมจับบั๊กนี้ไม่ได้ |
| คืนการแก้ | `grep` = **0** · portfolio 64/64 |
| **M2** เอา `DATABASE_URL` ตัวแทนออกจาก harness (เก็บ A ไว้) | portfolio 41 ผ่าน / **19 ตก** (ตรงกับที่เดวิดคาด) · คืนแล้ว 64/64 |
| **M3** ลบ guard `cookie?.includes(...) return null` | **เทสต์ไม่ตกเลย (64/64)** — **ตรวจไม่ได้ในเทสต์:** เพราะ `findAuthenticatedAccount(undefined)` คืน `null` ก่อนแตะ DB อยู่แล้ว (`verifyCookie` ตรวจ cookie ว่างก่อน) ดังนั้น guard เป็นเพียงทางลัดไม่ให้โหลดโมดูล ไม่มีผลที่สังเกตได้จากภายนอก ข้อเช็คลิสต์ #2 "guard ไม่ import" จึงยืนยันได้แค่ด้วยการอ่านโค้ด (guard อยู่บรรทัดแรกของฟังก์ชัน ก่อน `await import`) ไม่ใช่ด้วยเทสต์ · การจับผลจริง (ไม่แตะ store) มีเทสต์ครอบ |

## 6. ผลเทสต์
- portfolio: `node --experimental-strip-types --test test/portfolio-*.test.ts` → **64 / ผ่าน 64 / ตก 0** (baseline ก่อนแก้ 63/63)
- เต็มชุด api (Windows; Linux CI เป็นผู้ตัดสิน):

| | tests | pass | fail |
|---|---|---|---|
| `origin/main` `5ccd153` (สะอาด) | 1209 | 1199 | 10 |
| สาขานี้หลังแก้ | 1226 | 1217 | 9 |

  ชุดที่ตกเหมือนกัน: `PATCH /admin/support-voice: speakingRate` (กลุ่มเดียวกัน 6 ตัว — error เดิมจาก lib รุ่นเก่า) + `slip incident alert and weekly digest` (3 ตัว — ปัญหา esbuild path บน Windows) · main มีไฟล์ `admin-backup-api.test.ts` ตกระดับไฟล์เพิ่ม (ที่เคยเห็นว่า flaky ตอนโหลดหนัก) ซึ่งไม่ตกในรอบของสาขา · **ไม่มีเทสต์ใหม่ที่ตกเพราะการแก้** (diff ชื่อที่ตกว่างเปล่าฝั่งสาขา)
- รอบแรกของผม (ก่อนปรับ harness เป็น lazy) ได้ 14 ตก — ส่วนเกิน 8 ตัวคือ `support-route` ตามข้อ 2 ซึ่งแก้แล้ว

## 7. ข้อ E — พฤติกรรมที่เหลือไม่เปลี่ยน
ตัวตนจาก cookie เท่านั้น (เทสต์ "ignores any identity the client tries to send" ยังเขียว) · ไม่รับ id จาก body · fail-open (เทสต์ "fails open" ยังเขียว) · การ์ด Telegram ไม่แตะ · `git diff` ของผมไม่มีไฟล์ใน `artifacts/knight-basins/**` และไม่แตะ `line-auth.ts`

## 8. ข้อ D — KANBAN (ข้อค้นพบ ไม่ตรงกับที่ใบเขียน)
ใบระบุว่า PR นี้ "ลบ KANBAN.md 7 บรรทัด" ผมตรวจแล้ว **PR ไม่ได้ลบอะไร**: รายการไฟล์ของ PR #471 (`gh pr view 471 --json files`) ไม่มี `KANBAN.md` และ `git diff origin/main...HEAD -- KANBAN.md` = 0 บรรทัด · ที่เดวิดเห็นว่า "หาย" คือผลของสาขาที่ฐานเก่า (ตามหลัง `main` 6 คอมมิต): `git diff origin/main -- KANBAN.md` (สองจุด) แสดง 17 บรรทัดที่มีแต่ใน `main` (ส่วน "ยืนยัน provider เดียวกัน", แถว 415-D, 415-C, ส่วนรีวิว #471) ⇒ ถ้า merge จริง git จะรวมให้ ไม่ลบ
ผมแก้ด้วย `git merge origin/main` เข้าสาขา (คอมมิต merge ปกติ ไม่ rebase ไม่ force-push) ⇒ ตอนนี้ `git diff origin/main -- KANBAN.md` = **0 บรรทัด** (ไม่มีการลบ) · ไม่ได้แก้เนื้อหา KANBAN ด้วยมือ

## 9. เช็คลิสต์ 12 ข้อ

| # | สิ่งที่ยืนยัน | ผล |
|---|---|---|
| 1 | literal ที่จุดเรียก ไม่มีตัวแปร specifier | ✅ `grep LINE_AUTH_MODULE_ID` ใน src = 0 |
| 2 | guard ไม่มี cookie ไม่ import + เทสต์ยืนยัน | 🟡 guard อยู่ก่อน import (อ่านโค้ด) · เทสต์ยืนยัน "ไม่แตะ store" ✅ · เทสต์ที่จับการลบ guard **ไม่มี** (ข้อ 5 M3) |
| 3 | `SESSION_COOKIE_NAME` ค่าคงที่ในไฟล์ ไม่ import ระดับโมดูล | ✅ |
| 4 | harness ตั้ง `DATABASE_URL` ตัวแทน | ✅ diff ข้อ 2 (ปรับเป็น lazy เพราะ `support-route`) |
| 5 | portfolio ผ่าน | ✅ 64/64 (ใบ: 63/63 — เพิ่ม 1 เทสต์) |
| 6 | api เต็มชุดไม่มีตัวใหม่ตก | ✅ ข้อ 6 |
| 7 | `tsc` 0 | ❌ ตรวจไม่ได้ในเครื่องนี้ — 2 error เดิมเหมือน main สะอาด (ข้อ 4) |
| 8 | `grep -c LINE_AUTH_MODULE_ID dist/index.mjs` = 0 | ✅ 0 (ก่อนแก้ 2) |
| 9 | พิสูจน์สองทาง | ✅ ย้อน → 2 + ERR_MODULE_NOT_FOUND · คืน → 0 |
| 10 | KANBAN ไม่หาย | ✅ `git diff origin/main -- KANBAN.md` = 0 (ข้อ 8) |
| 11 | ไม่แตะครึ่ง UI | ✅ ไม่มีไฟล์ใน `artifacts/knight-basins/**` ในคอมมิตของผม |
| 12 | หลักฐานครบ | ✅ hash `18aa86d8fd1d1bf911b44ad433c6741d74e7b938` · 12:45 น. ไทย · ขนาด 2,668,946 → 2,670,739 B |

## 10. ที่ตรวจไม่ได้ + เหตุผล
- **ทดสอบจริงแบบ cookie จริง → ค้น DB → `customerAccountId` ลงแถว lead ใน production:** ชัยไม่มี DB/ความลับ session และห้าม POST production · ยืนยันได้แค่ (ก) โค้ดถูก inline เข้า `dist/` แล้ว (ข) เทสต์ control ว่า cookie เซ็นถูกเรียก session store จริงผ่าน `findAuthenticatedAccount` ของจริง (ใช้ stub แทน DB) · **เดวิดวัด `dist` ซ้ำ และควรลองส่ง inquiry จริงหลัง deploy 1 ครั้งด้วยบัญชีทดสอบ**
- `tsc` = 0 ตามเกณฑ์ (ข้อ 4) · เต็มชุดบน Linux CI (ผลบน Windows เท่านั้น)

## 11. ความเสี่ยง
- `DATABASE_URL` ตัวแทนตั้งแบบ process-wide หลังโหลดบันเดิลแรกของไฟล์เทสต์นั้น (แต่ node test รันไฟล์ละ process) และตั้งเฉพาะเมื่อไม่มีค่าอยู่ ⇒ CI ที่มี DB จริงไม่ถูกทับ
- เทสต์บันเดิลใหม่จับ `import(<ตัวแปร>)` ด้วย regex บน output ของ esbuild — ถ้า esbuild เปลี่ยนรูปแบบ output อาจต้องปรับ regex (ความเสี่ยงต่ำ; ผ่านการ mutation M1)
- คอมมิต merge `main` เข้าสาขา PR เพิ่ม 1 คอมมิต (ประวัติ PR ยาวขึ้น) แต่ไม่ force-push
