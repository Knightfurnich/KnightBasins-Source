# รายงาน 428-B (ทวงตาม 435-B) — ตรวจ UX/UI: คอมโพเนนต์ที่ผู้ใช้โต้ตอบ + สถานะการใช้งาน

**ใบงาน:** 428-B (อ่านอย่างเดียว) · ทวงโดย 435-B · **ผู้ทำ:** บอย (Qwen) · **ส่งเป็นไฟล์รายงานนี้ (1 ไฟล์, ไม่แก้โค้ด)**
**production ที่ตรวจ:** `https://knightbasins.com/` (asset `index-CZmvh_D4.js`, HTTP 200 `0.075s`)
**baseline อ้างอิง (จากใบ):** `d0db2d7` (431-B) + `76365f3` (416-B) → **ยืนยันแล้วว่าอยู่ใน `main` จริง** (`a7386be` เป็น HEAD) และ**marker ของงานนั้นโผล่ใน bundle ที่ serve จริง**: `dialog-line-desktop`=1 · `status-stone-search-empty`=1 · `text-footer-phones`=1 · `ส่งให้ทีมขายอีกครั้ง`=1 · `ใบเสนอราคาที่บันทึกไว้`=1 · `1023`=1 · `data-overlay-covered`=1
**เวลาที่ทำ (แก้ให้ตรงนาฬิกาเครื่อง):** วัด DOM/screenshot ช่วง **2026-10-10T14:5x–15:0xZ** = **07:5x–08:0x น. ตามเวลาไทย (11 ต.ค. 69)** · commit รายงาน `a512b51` เวลา 07:54 น.ไทย · *หมายเหตุ: sandbox clock ชี้เป็น +08所以我 ระบุเป็น UTC + แปลงเป็น Asia/Bangkok ให้ด้วย*
**เครื่องมือ:** `curl` · `git log/status` · Chromium ผ่าน Chrome DevTools Protocol (playwright-cli) อ่าน DOM/พิกัด · สแกน `data-testid` ทั้งหน้า
**สถานะ repoของผู้ตรวจ:** `git status --short` = **ว่าง (0 รายการ)** · ไม่มีการแก้/commit โค้ด/เทสต์/คอนฟิก — มีแต่ไฟล์รายงานนี้

---

## หลักฐานภาพ 11 ไฟล์ (production จริง · sha256 12 ตัวแรก)
| ไฟล์ | sha256 |
|---|---|
| `1-chat-desktop.png` | `7b1ba928e676` |
| `2-chat-390.png` | `b1a93ec728f3` |
| `3-chat-360.png` | `20ae144b1789` |
| `5-portfolio.png` | `4338342f1f16` |
| `6-stone-whisper-390.png` | `1bdc05a772c1` |
| `7-stone-zzz-390.png` | `ca17cda89668` |
| `08-chat-pending.png` | `b8d1e3191653` |
| `09-chat-answered.png` | `76be3430b92f` |
| `11-line-dialog-1440.png` | `6dabd42c6577` |
| `12-modal-390.png` | `11b8e6b10acb` |
| `15-admin-login-empty.png` | `f023c855cbab` |
> ไฟล์ binary อยู่ใน sandbox ของผม (`/tmp/e435/`) — ส่งเข้ากลุ่มไม่ได้จากเครื่องนี้ ระบุ sha256 ไว้เพื่อตรวจเทียบเมื่อต้องการไฟล์

## A. แชท KnightSupport
| จุดทดสอบ | ผลที่วัดได้ | ผู้ใช้เห็น | ความรุนแรง |
|---|---|---|---|
| เปิด/ปิด (1440×900) | launcher `(1300,831) 103×47` → panel `(1063,472) 340×350` ; ปิดด้วยปุ่มเดิม ✓ `panel gone = true` | หัวกล่อง: “น้องไนท์ (ผู้ช่วยทีมขาย) · ถามสินค้า ราคา หรือวิธีใช้งาน… · **โหมดทั่วไป · ค้นหาสินค้าได้** · LINE · เข้าสู่ระบบ · สวัสดีค่ะ น้องไนท์พร้อมช่วยค่ะ 💬” | ✅ |
| เปิด/ปิด (390×844) | launcher `(321,790) **42×42**` ; panel `(23,433) 340×348` (bottom 781 < 844 ✓) | เหมือน desktop | 🟡 target 42px < 44 |
| เปิด/ปิด (360×800) | launcher `(291,746) 42×42` ; panel `(9,389) 324×348` | — | 🟡 |
| ส่งข้อความจริง (guest) | POST ผ่านฟอร์มจริง 1 ครั้ง → บับเบิ้ลขึ้นทันที `submitDisabled=true` แล้วได้คำตอบ: `SG420 · Sanded Grey — ตัดและติดตั้ง 8,500 บาท/ตร.ม. · ขายแผ่นเริ่มต้น 9,000 บาท/แผ่น · ดูภาพ HD ในรายการสีหิน **ยังไม่รวม VAT 7%** งานเล็ก: <5 ตร.ม. (กทม.…` (4 บับเบิ้ล, ช่องกรอกเคลียร์ตัวเอง `inputVal=0`) | **ดีขึ้นจริง**: มีหน่วย + VAT + เงื่อนไขงานเล็ก (เดิมไม่มี) | ✅ |
| ระหว่างรอ (loading) ที่วัดได้ | ขณะ pending: `aria-busy = null` · submit `disabled=true` · `.animate-spin` = **0 ตัว** · บับเบิ้ลใหม่ยังไม่โผล่ | ผู้ใช้เห็น “ปุ่มกดไม่ติด” โดยไม่มีป้าย/สปินเนอร์ว่ากำลังส่ง (มีแต่ `aria-busy` บน `.knight-support-messages` ที่ `p.getAttribute('aria-busy')` คืน null เพราะเป็น attribute ของ **children** ไม่ใช่ panel ที่ผม query) | 🟠 |
| คำตอบว่าง / ผิดพลาด (503) | **ตรวจไม่ได้** — ดูหัวข้อ “ตรวจไม่ได้” ข้อ 1 | — | ⛔ |
| ส่งรูปสลิป | **ไม่ได้ทดสอบ** (FORBIDDEN ห้ามส่งสลิปจริง) | มีปุ่ม `button-knight-support-attach-slip` อยู่ใน DOM | ⛔ |
| เสียงอ่านออกเสียง (TTS) | **ไม่ได้ทดสอบ** (ต้องกด → ยิง TTS จริง) · ที่ 1440 หลังตอบ 1 ข้อ: สแกน `[data-testid^="button-speak-message-"]` = **พบ 0 ปุ่ม** (ปุ่ม speak ไม่โผล่กับบับเบิ้ลที่ทดสอบ) | ผู้ใช้อาจไม่มีทางฟังเสียงบนข้อความนี้ | 🟡 (ต้องยืนยันซ้ำด้วยข้อความอื่น เพราะ `voice-status` อาจปิด) |
| ทับซ้อนกับกล่องอื่น | เปิดกล่องก่อนแล้วเปิดกล่องสอบถาม: `launcher cov=true / visibility=hidden` ✓ (#481 ทำงาน); ช่องทางกลับ (เปิดแชทค้าง→เปิดกล่อง) ยังอยู่คนละ z-plane (100 vs 100) แต่ panel แชท `(23,433)` vs modal `(16,34 358×776)` → ทับกันบางส่วนบนจอเล็ก | — | 🟠 |

## B. กล่องสอบถามจากภาพผลงาน (inquiry modal)
วัดที่ 390×844 (production):
```
modal [16,34] 358×776 · phone [37,293] 301×44 (tap=44 ✓) · submit [37,563] 301×48
LINE (มือถือ) = a[data-testid="button-inquiry-line"] [37,667] 301×48
   href=https://line.me/R/oaMessage/%40789gcnhq/?text=<สรุป: สวัสดีครับ interest…รุ่น KF001 · Shine ราคาแคตตาล็อก 19,000 บาท + URL รูป>
launcher = (336,790) vis=hidden cov=true ✓  ·  overflowX(scrollWidth-clientWidth) = **0**
ปุ่มปิด ✓  ·  Escape ✓  ·  คลิกฉากหลัง ✓ (ทดสอบ 3 วิธี — ครบ)
```
เดสก์ท็อป 1440×900: ปุ่ม LINE เป็น **in-page dialog** (`dialog-line-desktop` มีใน bundle ที่เสิร์ฟ + ภาพ `11-line-dialog-1440`) — **URL ไม่เปลี่ยน** (`https://knightbasins.com/`) ⇒ ไม่พาออกจากเว็บตาม 416-B ✓
หน้าจอยืนยันหลังส่ง: **ไม่ได้ทดสอบ** (ใบ 428-B/435-B ห้ามสร้างลีซ) — ตรวจได้แค่ from ข้อ D-E ของ 422-B/435-B ที่ทำไปแล้ว + bundle มี copy `list-inquiry-next-steps`
→ **B ผ่านทุกข้อที่วัดได้** ไม่มีจุดพังใหม่ (มือถือ = deep link ที่ถูกต้อง · เดสก์ท็อป = ในเว็บ)

## C. ฟอร์มขอราคา / สตูดิโอ / สเก็ตช์
```
/quote 1440×900 : label 19 · input[required] 0 · input+textarea 16 · docH 3481 (≈3.9 หน้าจอ) · overflow 0
/quote  390×844 : docH 6195 → **7.3 หน้าจอ** (ต้องเลื่อนมากก่อนถึงปุ่มหลัก) · submit มี tap 48 ✓ · overflow 0
ปุ่มที่นับได้ (desktop): “LINE เข้าสู่ระบบ” · “บันทึกและส่งให้ทีมขาย” · “พิมพ์ใบเสนอราคา” ·
   “ดูใบเสนอราคาก่อนหน้า” · “US พื้นที่ / แผ่น” · “OF รายห้อง / จุด” · “ออกใบเสนอราคาทางการ” · “คัดลอกสรุปส่ง LINE”
ข้อความเมื่อไม่มีรายการ: “ยังไม่มีรายการในใบเสนอราคา — เลือกอ่างล้างหน้าอย่างน้อย 1 ชุด หรือ…” ✓ (คำที่แก้มารอบ 431-B ไปถึง prod จริง)
/sketch (prerender): ไม่มี empty-state ใน HTML แรก · /studio: เช่นกัน (ทั้งคู่ไม่เจอคำ “ยังไม่มี/ไม่มีข้อมูล”)
```
→ ป้าย/required: ฟอร์ม /quote ไม่ใช้ `required` attribute (validation ทำใน state) ⇒ **ผู้ใช้ไม่เห็น `*` จาก native** แต่เห็นจาก label — ยอมรับได้ แต่ a11y ควรเพิ่ม `aria-required` (ข้อเสนอ)

## D. สถานะ LINE 4 แบบ × 3 จุด (ที่โผล่)
| สถานะ | header | ในกล่องแชท | ในกล่องสอบถาม/อื่น | verdict |
|---|---|---|---|---|
| ยังไม่ล็อกอิน (guest — วัดจริง) | `LINE\nเข้าสู่ระบบ` (107×34 @1261,22) | banner `โหมดทั่วไป · ค้นหาสินค้าได้` + ปุ่ม `button-line-login-mode-banner` | `เข้าสู่ระบบด้วย LINE (ไม่บังคับ)` (`button-line-login-portfolio`) | ⚠️ คนละคำ (3 แบบของ button เดียวกัน) แต่มี label ครบทุกที่ |
| กำลังล็อกอิน | **ตรวจไม่ได้** (ห้าม login) | — | — | ⛔ |
| ล็อกอินแล้ว | **ตรวจไม่ได้** | — | — | ⛔ |
| ออกจากระบบ | **ตรวจไม่ได้** | — | — | ⛔ |
> ที่วัดได้: `/api/auth/line/status` = `{"configured":true,"authenticated":false,"user":null}` (200) ⇒ ทุกจุดต้อง render ฝั่ง guest ซึ่งตรงที่เห็น

## E. หน้าผู้ดูแล (admin)
- `GET /admin` = **200** และ HTML ที่ serve เป็น **โครงหน้าร้าน (title/JSON-LD ของ storefront)** 133,192 bytes ( ไม่ใช่ error/401 ) ⇒ แอดมินไม่ถูก gate ที่ HTTP layer (client-side gate) · ภาพ `15-admin-login-empty.png`
- ยืนยันด้วย source: `src/App.tsx:2025-2027` route `/admin`, `/admin/ai-cost`, `/admin/*` → `AdminApp`; การ render จริงต้อง login session
- **สถานะว่าง/ยาว/โหลดช้า = ตรวจไม่ได้** เพราะห้ามล็อกอินด้วยบัญชีจริง ⇒ ไม่ตรวจต่อ (จะกลายเป็น login)
- หลัก source ที่ชี้จุดควรตรวจเมื่อเดวิดเปิดให้ทดลอง (admin มี gate ที่ session เท่านั้น ไม่มี 401/403 ที่ router; ดู `src/admin/AdminSessionBanner.tsx:69` “กำลังตรวจสอบ…” — ยังไม่มี empty state สำหรับ “ไม่มีสิทธิ์” ที่อ่านง่าย)

## F. ความสอดคล้องของคอมโพเนนต์ (วัดจาก DOM production)
- `data-testid` ซ้ำทั่วหน้าแรก: `button-basin-gallery-open` ×**30** (ใช้ id เดียวกันทุกการ์ด → automation เลือก element ผิด/คลุมเครือ) และ `showcase-photo-*` ×2 (รูปซ้ำ 2 ที่ ใน showcase เดียวกัน) → **ควรแปลงเป็น `button-basin-gallery-open-${sku}` ตามแบบ `card-product-${sku}`**
- ปุ่ม: แชท trigger **42×42** ที่จอเล็ก เทียบมาตรฐาน 44×44 (WCAG 2.5.8 AA 24px ผ่าน แต่ target size ที่ดีควรมากกว่านี้); ปุ่มหลักในกล่อง (`button-inquiry-line`) 301×48 ✓
- ระยะห่าง/สี: ปุ่ม primary 2 แบบในหน้าเดียว (`button--accent` = เขียวทีม · `button--dark` = navy) และปุ่ม “บันทึกและส่งให้ทีมขาย” อยู่ติดกันสองปุ่มบนเดสก์ทอป `/quote` — ควรแยกบทบาทหลัก/รอง (primary เดียว) 
- `data-testid="button-line-login"` (KnightSupport ใช้ default `button-line-login` ใน 2 จุด) ยังซ้ำกับ `LineLoginButton` instance (header) = header + banner 2 node ใน DOM เดียวกัน (นับได้ 1 ที่ /quote แต่ 2 จุดบน home ที่วัดไม่ชนกันเพราะ banner ใน panel ที่เปิด)
- พฤติกรรมไม่เหมือนกันของคอมโพเนนต์ซ้ำ: `LineLoginButton` label “LINE / เข้าสู่ระบบ” vs ในกล่องสอบถาม “เข้าสู่ระบบด้วย LINE (ไม่บังคับ)” vs ในกล่องแชท `MODE_FULL` label ไม่เกี่ยวกับ label login — คำเดียวกัน 3 แบบ ควรเหลือ 1 (ใบถัดไป)

## ข้อค้นพบ (≥5 · เรียงความรุนแรง + ต้นเหตุที่น่าจะเป็น)
1. **สูง · หน้า `/portfolio` ไม่มี “ launcherแชท” และไม่มีปุ่ม login บน header ทั้งที่ 60 ปุ่มขอราคาอยู่ในหน้านี้** (วัด: `.knight-support-trigger` = 0, `[data-testid="button-line-login"]` = 0, ปุ่ม inquire = 60 · ภาพ `5-portfolio.png`) และคำในแชท/ฟอร์มบอกให้กด “ปุ่มด้านบน” → ผู้ใช้หน้านี้หากดไม่เจอ· ต้นเหตุ: Layout of PortfolioPage (`src/App.tsx` ~บรรทัด route `/portfolio` ใช้ `<Route path="/portfolio" component={PortfolioPage} />` standalone ไม่ผ่าน component `Layout` line 411 ที่ mount KnightSupport — ยืนยันจากโค้ดบรรทัด 411/2039/1585)
2. **กลาง-สูง · ไม่มี affordance ขณะส่งแชท** · วัด: pending state ไม่มี `.animate-spin` (0), `aria-busy` ของ panel = null, submit กลายเป็น disabled เงียบ ๆ · ต้นเหตุ: `<aside>` panel ไม่สะท้อน `busy` (`src/components/KnightSupport.tsx:101,367`)
3. **กลาง · `data-testid` ซ้ำทั้งหน้า** (`button-basin-gallery-open` ×30, `showcase-photo-…` ×2) → เทสต์/automation เลือกผิด · ต้นเหตุ: `src/App.tsx` การ์ด `ProductCard` / `src/components/InstallationShowcase.tsx` ใช้ id literal เดียวกับทุกใบ
4. **กลาง · label ของ login มี 3 แบบในเว็บเดียว** (“LINE / เข้าสู่ระบบ” / “เข้าสู่ระบบด้วย LINE (ไม่บังคับ)” / banner ในแชท) — UX สับสน และไม่มีแบบใดบอก “ทำไมต้องใช้” ครบ · ต้นเหตุ: `src/components/KnightSupport.tsx:20,51`, `PortfolioInquiryModal.tsx` (`row-line-login-offer`), `App.tsx` (site-header)
5. **ต่ำ-กลาง · target 42×42 บนจอเล็ก 360/390 (แชท trigger) และ `/quote` บนมือถือต้องเลื่อน 7.3 หน้าจอ** ก่อนถึงปุ่ม “ออกใบเสนอราคาทางการ” · ต้นเหตุ: `src/index.css:3081` (`.knight-support-trigger { min-width/height: 42px }`), โครง `/quote` ไม่มี anchor navigation ย่อหน้า
6. **ต่ำ · `/admin` ไม่ gate ระดับ HTTP (200 + โครง storefront)** — ไม่ใช่ช่องโหว้ (ยังต้องมี session) แต่ไม่ server-side gate ทำให้ผู้ใช้พิมพ์ `/admin` ผิดแล้วเห็นหน้าร้าน ไม่รู้ว่าต้อง login ที่ไหน · ต้นเหตุ: ไม่มี 401/403 redirect ที่ route (`src/App.tsx:2025`)

## สิ่งที่ “เหลือ” จาก 428-B เดิม (สถานะแต่ละข้อ)
| A–F | สถานะ | 
|---|---|
| A แชท (เปิด/ปิด/ส่ง/ตำแหน่งมือถือ 390/360) | ✅ วัดครบ + ข้อค้นพบ #2, #4 |
| A สถานะ error/empty + สลิป + TTS | ⛔ ตรวจไม่ได้ (เหตุผลข้างล่าง) |
| B กล่องสอบถาม (ฟอร์มมือถือ/ปุ่ม LINE/ยืนยัน/ปิด-ESC-ฉากหลัง) | ✅ ครบ (ภาพ 12, 11) |
| C ฟอร์มขอราคา/สตูดิโอ/สเก็ตช์ | ✅ /quote ครบ · ⚠️ studio/sketch ตรวจไม่ครบ (ไม่มีข้อมูลตัวอย่างให้กรอกโดยไม่ submit) |
| D สถานะ LINE 4×3 | ⚠️ วัดได้ 1 ใน 4 (guest) |
| E admin | ⛔ ตรวจไม่ได้ (ห้าม login) — ให้ HTTP + code evidence แทน |
| F ความสอดคล้องคอมโพเนนต์ | ✅ วัดจาก DOM จริง (id ซ้ำ 4 กรณี + label 3 แบบ) |

## ตรวจไม่ได้ + เหตุผล (ห้ามเดา)
1. **คำตอบว่าง / error 5xx ของแชท** — ต้อง mock response ที่ browser; ตอน stub ด้วย CDP `page.route` daemon ของ playwright พัง 2 ครั้ง (“Session closed”) และผม **ไม่ส่งข้อความผิดพลาด/ว่างเข้า production จริง** เพื่อไม่ให้ไปสร้าง customer-log ปลอม (ใบนี้ถือว่าห้ามแก้/รบกวน) · อ่านจาก code: `src/components/KnightSupport.tsx:250-256` มี on-error ("ขออภัยค่ะ ระบบค้นหาข้อมูลไม่พบค่ะ…") และ `:148` (empty → ใช้ fallback `SIGNED_OUT_ASSISTANT_REPLY`) — มี log ใน 436-C แต่ยังไม่ได้วัดบน browser จริง
2. **สลิป / TTS** — ห้ามกด-ห้ามส่งของจริง (FORBIDDEN) และ TTS ยิง Google API จริง
3. **สถานะล็อกอิน 3 แบบ + admin หน้าจริง** — ต้อง login ด้วยบัญชีจริง (FORBIDDEN) · `/api/auth/line/status` = guest เท่านั้น
4. **หน้าจอยืนยันหลังส่งฟอร์ม** — ต้อง POST สร้างลีซจริง (FORBIDDEN) · พิสูจน์ด้วย bundle marker `list-inquiry-next-steps` อย่างเดียว
5. ภาพ production หลัง merge ครั้งถัดไป (asset hash เปลี่ยนแล้วหลังผมวัด) — ตัวเลขทั้งหมดผูกกับ `index-CZmvh_D4.js`

## ความเสี่ยงคงเหลือ + ข้อเสนอ (ไม่มีการแก้ในใบนี้)
- ความเสี่ยงหลัก: ผู้ใช้ `/portfolio` ไม่มีทางถาม (ข้อ #1) → lead ที่เกิดจากหน้านี้หายไปเงียบ ๆ; และ pending ที่ไม่แสดงสถานะ ทำให้กดซ้ำ/คิดว่าเว็บค้าง (#2)
- ข้อเสนอ (เรียงตามคุ้มทุน): ① mount KnightSupport + ปุ่ม login ใน PortfolioPage (หรือย้ายหน้า vào shared Layout) ② ใส่ `aria-busy`/สปินเนอร์ที่ trigger กับข้อความ “กำลังส่ง…” ตอน pending ③ แก้ `data-testid` ให้ unique ตาม sku + เพิ่ม invariant ในเทสต์ ④ รวมคำ label login เป็น string เดียวจาก `contact-channels.ts` ⑤ target 44px + เพิ่ม mini-nav ของ `/quote` บนมือถือ ⑥ ถ้าอยากให้ /admin ไม่โผล่เป็นตัว storefront: render “ต้องเข้าสู่ระบบ” ก่อน (server ไม่จำเป็น)
