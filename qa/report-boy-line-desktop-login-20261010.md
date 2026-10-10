# รายงาน 414-B (บอย/Qwen) — ปุ่ม LINE บนเดสก์ท็อป + "เข้าสู่ระบบด้วย LINE" (ไม่บังคับ) + ผูกตัวตนกับลีด

**วันที่:** 10 ต.ค. 69 (เริ่มทำ 11:4x – 12:2x น.ไทย) · **เจ้าของงาน:** บอย (Qwen) · **ผู้ตรวจรับ:** บอส · เดวิดตรวจโค้ด + ชัยตรวจส่วน api ตามธรรมเนียม
**สาขา/PR:** `feat/line-desktop-dialog-optional-login-414-b` → PR เดียว (docs+code) · baseline `origin/main = 92162e8`
**ขอบเขตที่แตะ (ครบตาม SCOPE เท่านั้น):** `artifacts/knight-basins/src/components/PortfolioInquiryModal.tsx` · `artifacts/api-server/src/routes/portfolio.ts` · เทสต์ใหม่ 2 ไฟล์ · **ไม่แตะ** `line-auth.ts` (อ่านอย่างเดียว) · ไม่แตะไฟล์ api-server อื่น · ไม่แตะ `src/data/**` · ไม่มี migration/DB · ไม่มี restart

---

## A. ปุ่ม LINE บนเดสก์ท็อป — ไม่พาออกจากเว็บอีก

**เหตุผลเชิงหลักฐานของ "ต้องแยกอุปกรณ์"** (วัดเองคืนนี้/วันนี้ด้วย `curl`):
```
$ curl -s -o /dev/null -w '%{http_code} redir=%{redirect_url}\n' "https://line.me/R/oaMessage/%40789gcnhq/?text=test"
  302 redir=https://line.me/
$ curl -sL -w 'final=%{url_effective} code=%{http_code} redirects=%{num_redirects}\n' "https://line.me/R/oaMessage/%40789gcnhq/?test=1"
  final=https://www.line.me/ja/  code=200  **redirects=2**
```
⇒ ยืนยันตามเดวิด: `oaMessage` บนเดสก์ท็อปเด้ง 2 ต่อไปหน้าการตลาด LINE (ภาษาตาม locale) = "ตายบน" จริง

**สิ่งที่ทำ (ใน `PortfolioInquiryModal.tsx`):**
| องค์ประกอบ | เกณฑ์ใบงาน | implementation (test id) | ยืนยันจากภายนอก |
|---|---|---|---|
| มือถือคงเดิม | deep link + สรุปข้อความ | `<a href={lineHref} data-testid="button-inquiry-line">` เมื่อ `!desktopMode` — `lineHref = buildLineDeepLink(lineMessage)` (`…/oaMessage/%40789gcnhq/?text=` + encoded) | เทสต์เทียบ string เป๊ะ + เทสต์เดิมของ 414 (`portfolio-inquiry.test.ts` line 70-71) ยังผ่าน |
| เดสก์ท็อปอยู่ในเว็บ | ห้าม navigate ออกจากเว็บ | `<button data-testid="button-inquiry-line" data-testid-line-channel="desktop-panel" onClick={() => setLinePanelOpen(true)}>` → panel `role="dialog" data-testid="dialog-line-desktop"` | เทสต์ assert ว่า branch เดสก์ท็อปเป็น `onClick` ไม่ใช่ `href` |
| QR ของ OA | `qr-official…/sid/L/789gcnhq.png` | `<img src={LINE_OA_QR_URL} width={360} height={360} alt="QR code…" data-testid="img-line-desktop-qr">` | `curl` → **200, 1,694 bytes** |
| ปุ่มเพิ่มเพื่อน (คอม) | `line.me/R/ti/p/@789gcnhq` | `<a href={LINE_OA_ADD_FRIEND_URL} target="_blank" rel="noopener noreferrer" data-testid="button-line-add-friend">เปิดหน้าเพิ่มเพื่อน</a>` | `curl` → **200** |
| คัดลอกข้อความสรุป | ข้อความเดียวกับที่ส่งใน LINE | `navigator.clipboard.writeText(lineMessage)` + โชว์ `{lineMessage}` ใน `<pre data-testid="text-line-summary-preview">` (ใช้ `lineMessage` ตัวเดียวกัน → เป้าหมาย "ห้าม drift" สำเร็จโดย structure) | เทสต์ assert |
| ประโยคบอกทาง | ข้อความกำหนด | `data-testid="text-line-desktop-hint"` = “บนคอมพิวเตอร์ ให้สแกน QR ด้วยมือถือ LINE หรือคัดลอกข้อความไปส่งในแชท” | เทสต์ assert |

**Breakpoint + เหตุผล (EVIDENCE ข้อ 8):** `(min-width: 1024px) and (pointer: fine)` ผ่าน `window.matchMedia` (มี listener → หมุนจอ/ย่อหน้าต่างแล้วสลับได้) — **เดสก์ท็อปเท่านั้นที่มีปัญหา** เพราะ deep link พังเมื่อไม่มี LINE app handle โดเมน; แท็บเล็ตแนวนอน (≥1024px แต่ `pointer: coarse`) ยังใช้ deep link ได้ผลดี จึงไม่ถูกยึดออกจากทางเดิม · fallback เมื่อไม่มี `matchMedia`/ค่าวัดเพ (`NaN`, `0`) = ใช้ deep link เสมอ ⇒ ไม่มีทางที่ผู้เยี่ยมชมจะติดอยู่ใน UI ที่ไม่มีทางออก · `Escape` ออกจาก panel ก่อน แล้วค่อยปิด modal

## B. "เข้าสู่ระบบด้วย LINE" — ใช้ระบบเดิม ไม่สร้างใหม่ ไม่บังคับ
* อ่านสถานะด้วย `GET /api/auth/line/status` (`credentials: "same-origin"`) → ใช้ field จริงที่ server ส่ง: `configured`, `authenticated`, `user.displayName`, `user.pictureUrl`
* ล็อกอินแล้ว → แถบ `data-testid="row-line-identity"` แสดง **รูปโปรไฟล์ + ชื่อที่แสดง** และปุ่ม LINE เปลี่ยนเป็น **"🟢 ส่งเข้าแชท LINE ของคุณ"** (`lineButtonLabel(true, …)`) + ปุ่มเสริมใน panel เดสก์ท็อป `data-testid="button-line-send-to-my-chat"`
* ยังไม่ล็อกอิน → ปุ่ม `data-testid="button-line-login"` ชี้ไป `/api/auth/line/login?returnTo=<encodeURIComponent(pathname+search)>` (ฟังก์ชัน `lineLoginHref` ทดสอบเคส `?query` และค่าว่าง→`/`)
* **ไม่บังคับล็อกอิน:** `shouldOfferLineLogin()` เป็นตัว *เพิ่ม* ทางเลือกเท่านั้น ไม่มี early-return/ไม่มี if ครอบฟอร์มหรือทางออกอื่น (เทสต์ assert ว่า `data-testid` ของ QR/คัดลอก/เบอร์โทร/ส่งฟอร์ม อยู่ได้โดยไม่พึ่ง login และ assert ว่าไม่มี pattern `if (!lineLoggedIn) return null` ในไฟล์) · ผลจริงของ `/status`: `{"configured":true,"authenticated":false,"user":null}` ✓ shape ตรงกับ type ที่ใช้
* เส้นทางล็อกอินทำงานจริง (GET อย่างเดียว): `/api/auth/line/login?returnTo=%2Fstone` → **302 → `https://access.line.me/oauth2/v2.1/authorize?…redirect_uri=https%3A%2F%2Fknightbasins.com%2Fapi%2Fauth%2Fline%2Fcallback&scope=profile+openid`** ✓ (ไม่มีการพิมพ์ secret — `client_id` เป็นค่าสาธารณะของ OA)

## C. ผูกตัวตนกับลีด (server-side เท่านั้น)
```ts
// portfolio.ts — handler เดียวกับที่ SCOPE ระบุ
const customerAccountId = await resolveLineAccountId(req);   // → insert ลง customerLeads
```
* ใช้ **`findAuthenticatedAccount()` + `SESSION_COOKIE` จาก `routes/line-auth.ts` ตามที่ใบงานสั่ง** (ไม่คัดลอกตรรกะ verify/hash มาทำซ้ำ) → `lineAccountIdFromSessionCookie()` เรียก `findAuthenticatedAccount(req.cookies?.[SESSION_COOKIE])` แล้วเก็บเฉพาะ `account?.id ?? null`
* รูปแบบเดียวกับ `leads.ts:532,602` (แผนที่ใช้อยู่แล้วในระบบ) ⇒ ไม่สร้าง convention ใหม่
* **ไม่รับตัวตนจาก client:** body ถูก parseเป็น ฟิลด์เดิมเท่านั้น (`photoId/photoTitle/photoUrl/source/sku/phone/name/notes`) — ไม่มีการอ่าน `body.customerAccountId` / `userId` / `displayName` ใด ๆ; เทสต์ยิง body ปลอม `{customerAccountId:999, userId:"U-somebody-elses-account", displayName:"คนที่ไม่ใช่ผม"}` → แถวที่บันทึกมี `customerAccountId = null` และ **ไม่มีค่า 999 / userId / ชื่อนั้นหลุดเข้าไปในแถว** (ตรวจด้วย `JSON.stringify(saved)`)
* **fail-open:** การ lookup ตัวตนถูกห่อไว้ — resolver พัง/โยน exception → `customerAccountId = null` และ lead ยังบันทึก 201 (เทสต์ยืนยัน) เพราะไม่ได้ตัวตนไม่ควรทำให้ทีมเสียลีด
* เพิ่มบรรทัดในการ์ด Telegram เฉพาะเมื่อผูกบัญชี: `🧾 ผูกกับบัญชีลูกค้า #<id> (LINE session — ลูกค้าเก่า)` (ไม่เปลี่ยนโครงสร้างการ์ดที่มีอยู่ — ของ `divider` 2 เส้น ฯลฯ เทสต์เดิมยังผ่าน)
* ⚠️ **บันทึกสิ่งที่ต้องรู้ (เดวิด/ชัย):** `./line-auth` ถูกอ้างแบบ *dynamic import ตอนรัน* ด้วย specifier ที่ประกอบตอนรัน(`"./" + "line-auth"`) พร้อม guard `if (!cookie.includes("knight_line_session=")) return null;` — **เหตุผล:** `test/route-harness.ts` ใช้ esbuild `bundle: true` ซึ่งถ้า specifier เป็น literal จะ inline `line-auth` (ที่ import `@workspace/db` → ต้องมี `DATABASE_URL`) ขึ้นเป็น top-level ของ bundle ทำให้เทสต์ portfolio ที่ hermetic อยู่แล้ว **พังทั้งชุด 5 ตัว** (ผมเจอจริงและวัดแล้ว) เวอร์ชันนี้ทำให้ไฟล์เทสต์เดิมยังเขียวโดยไม่แตะไฟล์ harness/app/อื่นเลย · **ผลข้างเคียง:** ในสภาพแวดล้อม bundling แบบทดสอบ การผูก session จริงต้องรันผ่าน `database`-injection (ทำได้) ส่วน path "cookie จริง → session store จริง" พิสูจน์ได้เฉพาะบน staging/prod (ดูข้อ E)

## D–E. หลักฐานการรันจริง

**1) ไฟล์ที่แตะ**
```
 artifacts/knight-basins/src/components/PortfolioInquiryModal.tsx | +232 lines (helpers + device branch + panel + identity row)
 artifacts/api-server/src/routes/portfolio.ts                     | +45 lines  (resolver + customerAccountId + label Telegram)
 artifacts/knight-basins/test/portfolio-inquiry-line-contact.test.ts | ใหม่ 9 tests
 artifacts/api-server/test/portfolio-inquiry-identity.test.ts        | ใหม่ 5 tests
```
**2) เทสต์ที่แตะ (web):** `node --experimental-strip-types --test test/portfolio-inquiry.test.ts test/portfolio-inquiry-search.test.ts test/portfolio-inquiry-line-contact.test.ts` → **tests 27 · pass 27 · fail 0**
**3) เต็มชุด (web):** `node --experimental-strip-types --test test/*.test.ts` →
```
# tests 1258   # suites 197   # pass 1216   # fail 0   # skipped 42
baseline ของใบงาน = 1249 / 1207 / 0 / 42  → +9 tests (ไฟล์ใหม่ที่เพิ่มมา) · ตก 0 · ไม่มีการถอยหลัง
(node v22.23.3, Linux)
```
**3b) ฝั่ง api:** `test/portfolio-inquiry-api.test.ts + test/portfolio-inquiry-identity.test.ts` → **tests 10 · pass 10 · fail 0** (เดิม 5 ยังคงผ่านหมด)
เต็มชุด api-server (`test/*.test.ts`) รัน 2  comparasion: **ตอนมีการแก้: tests 1225 pass 1213 (fail 12)** · **clean main: tests 1220 pass 1203 (fail 17)** — ทั้งสองรันมีชุด admin ที่ fail ล่วงหน้าอยู่แล้วใน sandbox นี้ (backup/prune/stock/calendar/ai-cost ฯลฯ ชื่อไม่ตรงกันระหว่างสองรอบ = flaky ตาม environment/filesystem) และ **ไม่มี `not ok` ใดเกี่ยวข้องกับ portfolio/inquiry เลย** ⇒ ไม่ได้ทำ registry เดิมพัง แต่ *ตัวเลขเต็มฝั่ง api ไม่น่าใช้ตัดสิน* ในเครื่องนี้ (เดวิดรันบน VPS ได้ผลคนละชุด)
**4) typecheck:** web `npx tsc -p tsconfig.json --noEmit` → **0** · api เช่นกัน → **0**
**5) พิสูจน์สองทาง (บังคับ):**
```
(ก) ลบ branch 'desktopMode && linePanelOpen' (กล่องเดสก์ท็อป) ออกจากไฟล์จริง
    → not ok 3 - points the desktop dialog at the QR and the correct desktop add-friend page
      not ok 4 - renders the desktop branch without navigating away, and never removes the phone form
      not ok 4 - reads identity from the session endpoint and keeps every non-login exit visible
      # pass 6 · # fail 3      [คืนของแล้ว → 9/9 เขียว]
(ข) comment บรรทัด 'customerAccountId,' ใน insert
    → not ok 1 - writes customerAccountId when the visitor has a verified LINE session
        expected: 412 · operator: 'strictEqual'
      (อีก 4 เคส fail ตาม: unbound / body-spoof / fail-open / hermetic-default)
      # pass 0 · # fail 5      [คืนของแล้ว → 5/5 เขียว]
```
(บันทึกmethod: ผมใช้ backup (`/tmp/b414/modal.GOOD.tsx`, `portfolio.GOOD.ts`) ตอน“ถอดของออกเพื่อพิสูจน์”แล้วคืน · บทเรียนประจำตัว: ครั้งแรกใช้ `git checkout --` เพื่อ "คืนของ" ทำให้นิยามงานแก้ทั้ง 2 ไฟล์หายไปด้วย (ยังไม่ได้ commit) — re-apply ครบแล้วและเทสต์กลับมาเขียวทั้ง 27/27 + 10/10 + เต็มชุด 1216/0)
**6) QR / add-friend:** `200 1694B` และ `200` · **7) login:** `302 → access.line.me/oauth2/v2.1/authorize…` · `status: configured=true, authenticated=false`

## ของที่ "ตรวจไม่ได้" + วิธีให้เดวิด/ชัยตรวจต่อ
| ข้อ | เหตุผล | วิธีปิด |
|---|---|---|
| พฤติกรรมในแอป LINE จริงบนมือถือ (deep link เปิดแชทพร้อมข้อความ) | ต้องมีเครื่อง + บัญชี LINE | เดวิด/บอส กดจากมือถือ 1 ครั้ง: ปุ่มเดิมต้องเด้งเข้าแอปพร้อมข้อความสรุป (โค้ด path นี้ไม่ถูกแก้ — เทสต์ string ยืนยันว่า `lineHref` เท่าสูตรเดิม) |
| binding จริงบน prod (`Set-Cookie: knight_line_session` → lead มี `customerAccountId`) | ผมไม่มีสิทธิ์ DB/prod และ **ห้าม login** | เดวิด: login ผ่านเว็บด้วยบัญชีทดสอบ → เปิด `/stone` → กรอกฟอร์ม → `select phone,customer_account_id from customer_leads order by id desc limit 1;` ต้องได้ id บัญชี |
| path "cookie จริง → session store" ใน unit env | esbuild bundle ของ harness hoist dependency ของ line-auth (อธิบายใน C) + ต้องมี DB | เทสต์ integration บน staging/CI ที่มี DATABASE_URL: ยิง `/api/public/portfolio/inquiry` พร้อม cookie ที่ออกโดย flow login จริง |
| clipboard บน browser จริง | sandbox ไม่มี UI | manual บน Chrome_DESKTOP: ปุ่มต้องแสดง "คัดลอกแล้ว ✓" (ถ้าถูกบล็อกจะไม่ error — จะขึ้นข้อความบอกให้เลือกเอง ซึ่ง test id `button-line-copy-summary` ยังอยู่) |
| `qr-official…png` เป็น QR ที่สแกนแล้วถูก OA | ผมยืนยันได้แค่ 200 + 1,694 B + type image | สแกนด้วยมือถือจริง 1 ครั้ง |

## ความเสี่ยง + ข้อเสนอ
1. 🟠 **ความเสี่ยงการ merge:** ฉันแก้ `routes/portfolio.ts` (ขอบเขตชัย) เฉพาะ handler + factory signature แบบ backward-compatible (`options` เป็นพารามิเตอร์ที่ 2 ที่มี default; caller เดิมไม่พัง) — แนะนำให้ชัย sign-off ส่วนนี้ตามธรรมเนียม
2. 🟠 **Panel เดสก์ท็อปยังไม่ได้ตรวจด้วยตา**: เทสต์เป็น source/AST-level (ตามแบบของ repo นี้) ไม่ได้ทดสอบ React render จริง (repo ไม่มี RTL ในเว็บ suite) → แนะนำให้เดวิด/บอสเปิด `/stone` บนคอมกด 1 รอบ + (ถ้าจะจริงจัง) เพิ่ม smoke test ด้วย Playwright ในงานแยก (ผมไม่กล้าใส่ dependency ใหม่ใน PR นี้)
3. 🟡 `returnTo` ไม่ validate whitelist — ยังเป็นพฤติกรรมของ `/api/auth/line/login` เดิม (app.ts/line-auth) ผมไม่ได้แก้ ถ้าจะกัน open-redirect ควรทำในงานของเส้น auth (ไม่ใช่ไฟล์นี้)
4. 🟡 identity enrichment ทำงานเฉพาะผู้ที่ใช้ LINE Login แล้ว ⇒ ผู้ดูแล lead ควรเห็น label `🧾 ผูกกับบัญชีลูกค้า #id` ให้ชัด (ใส่ไว้แล้วในการ์ด Telegram)
5. 🟡 แนะนำเก็บ URL/สูตร `oaMessage`/`ti/p` ไว้ใน `src/data/**` (ที่เดวิด lock) ให้งานหน้า — ตอนนี้ hardcode ตามรูปแบบเดิมของไฟล์นี้

**ลงชื่อ:** บอย (Qwen) · baseline `origin/main = 92162e8` · commit ของ PR ดูได้จาก EVIDENCE #1 ใน PR · read-only ต่อระบบจริง (ไม่มีการแตะ prod/config/DB · GET/HEAD เท่านั้น) · ไม่มีคีย์/secret ปรากฏในรายงานนี้
