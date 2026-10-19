# รายงาน 473-Q · Qwen (บอย) — ตั้งต้นการเชื่อมต่อใหม่ + ตรวจอิสระชิ้นแรก

> ### ✅ ตรวจรับโดยเดวิด (19 ต.ค. 69 · 22:0x น. ไทย)
> **รับงานแล้ว + commit แทนตามทาง 2** (Qwen ยังไม่มี token) · ตรวจอิสระของ Qwen ผ่านทุกข้อ:
> - **C1 วัดซ้ำ 1.16** — เดวิดวัดได้ 1.16 เท่ากัน (ต่าง 0.00) ✓ · ต้นเหตุ `index.css:1015 background: white` + สืบทอด `--ink` โหมดมืด ✓ (ปิดแล้วด้วยใบ 472-C · merge `e6ef820`)
> - **C2 ยืนยันว่าด่านมองไม่เห็น — ถูกต้องและแม่นยำ:** ตัวกวาด `qa/tools/gradient-scan-465c.mjs:115` มี `if (own.length < 3) return;` ⇒ ข้อความ 1–2 ตัวอักษร (ตัวเลขจำนวน `1`/`2` และไอคอน) ถูกกรองทิ้งทั้งหมด (เดวิดตรวจบรรทัดนี้เองแล้ว = ตรง) → ปิดช่องนี้ในใบ 471-R ฉบับแก้ 1/2 (ตัวกวาดรุ่นใหม่นับ short text แล้ว)
> - **C3 ไม่พบจุดที่สองในขอบเขตตัวเอง** — เดวิดสุ่มตรวจข้ออ้างหลัก: `admin/admin-theme.tsx` รีแมป `.bg-white/.bg-gray-50/100/.bg-slate-50/100` → `var(--card-paper)` ใต้ `[data-admin-theme="dark"]` ✓ จริง · และซื่อตรงที่ระบุว่าไม่ได้เรนเดอร์หน้าแอดมินจริง (ต้อง login + production ห้ามแตะ)
> - **คำถามเรื่องตัวเลขเทสต์ — เดวิดรันเทียบให้แล้วที่ Linux (main ปัจจุบัน รหัสเทียบเท่า `5cb0506` + commit เอกสาร):** web **1,533 / ผ่าน 1,524 / ตก 0 / ข้าม 9** · api **1,329 / 1,329 / ตก 0** ⇒ **9 (web) + 5 (api) ที่ตกบน Windows = artifact ของสภาพแวดล้อม/ไม่ได้ build ไม่ใช่ drift จริง** — ไม่ต้องดำเนินการ
> - **ไฟล์หลักฐานได้รับแล้ว (19 ต.ค. 69 · บอสส่งให้):** `qa/images/qwen-round35/c1-quote-row-dark-1440.png` · `c1-line-quantity-dark-1440.png` · `c2-gradient-scan-dark-quote.json` · `c2-gradient-scan-stdout.txt`
>   · **เดวิดตรวจไฟล์เอง (ไม่ใช่แค่เชื่อคำรายงาน):** ภาพแถว `KF001 / VS311 "Shine"` โหมดมืด — กล่องจำนวนเป็นพืดขาว ตัวเลข `2` และไอคอน −/+ **จางจนเกือบมองไม่เห็น** ✓ ตรงกับ 1.16 · JSON = 1 รายการ (`/quote#cart` · dark · **checked=128**) **ไม่มีแถว `.line-quantity` เลย** ✓ · stdout = `checked=128 failing=1` และคำว่า `line-quantity` = **0 ครั้ง** ✓ · **ไม่มีไฟล์ใดมีความลับ** (สแกน ghp_/github_pat_/sk-/PRIVATE KEY = 0)
>   · สคริปต์วัดของ Qwen (`c1-probe.mjs`) อยู่นอก SCOPE ⇒ **ไม่รวมในรีโป** (เก็บบันทึกไว้นอก repo เพื่อทำซ้ำผล)


**ผู้รายงาน:** Qwen (บอย) — ผู้ช่วยพัฒนา Frontend/UI + ผู้ตรวจงานอิสระ
**ใบงาน:** `qa/job-473-qwen-onboarding-connection.md` · **วันที่รายงาน:** 19 ต.ค. 2569 21:30 น. (เวลาไทย, GMT+7)
**ผู้รัน / เครื่อง:** Qwen (เอเจนต์บนเครื่อง Windows ของบอส) · **OS:** Windows 11 (10.0.26100) · Git-Bash/MSYS · Node v24.15.0 · pnpm 12.4.2 · Chrome headless (ติดตั้งที่ `C:/Program Files/Google/Chrome/…`)
**commit ที่ทำงาน:** `5cb0506` (branch `main`, = merge PR #623 `docs/473-qwen-onboarding`)
**โหมดการส่งงาน:** **ทาง 2 (ยังไม่มี token `qwen-knightbasins`)** ⇒ ทำงานบนเครื่องตัวเอง + ส่งไฟล์รายงานนี้ให้เดวิด **commit และเปิด PR ให้** (ห้ามดองงาน)

---

## สรุป 5 บรรทัด

1. **สิ่งที่ทำ:** อ่านชุดเริ่มงานครบ (README → ONBOARDING-qwen → TEAM + ใบ 473) · พิสูจน์การเชื่อมต่อ (`git ls-remote` คืน ref ครบ) · ตรวจอิสระ C1–C3 แบบ read-only · รันเทสต์/ไทป์เทียบ baseline
2. **ผ่าน/ไม่ผ่าน:** C1 วัดซ้ำได้ **1.16 ตรงกับเดวิด (ต่าง 0.00)** · C2 ยืนยันด่าน CI **มองไม่เห็น** ช่องจำนวน (checked=128, ไม่มีแถว `.line-quantity` เลย) · C3 **ไม่พบจุดแบบ index.css:1015 อีก** ในขอบเขตตัวเอง · `tsc` = 0 ทั้ง 2 โปรเจกต์
3. **ตรวจไม่ได้อะไร (พร้อมเหตุผล):** ยัง **เปิด PR เองไม่ได้** (ไม่มี token ⇒ ใช้ทาง 2) · **ไบนต์/เข้าหน้าแอดมินจริงไม่ได้** (auth + production ห้ามแตะ) ⇒ C3 ฝั่ง admin ยืนยันด้วย source-analysis + ค่าตัวแปรธีม ไม่ได้เรนเดอร์จริง · **รันเทสต์ไม่ได้เลขเดียวกับ baseline** เพราะรันคนละ commit/OS และไม่ได้ `pnpm build` (รายละเอียดข้อ เทสต์)
4. **ความเสี่ยง:** ที่ commit `5cb0506` มี **เทสต์ตก 9 (web) + 5 (api)** ซึ่ง baseline ของเดวิด (`2072da7`) ไม่ตก — ยังสรุปไม่ได้ว่าเป็น drift จริงหรือ artifact ของ Windows/CRLF/ไม่ได้ build ⇒ ต้องให้เดวิดรันเทียบที่ Linux/baseline commit
5. **ข้อเสนอ:** (ก) ออกใบแก้ `.line-quantity` (ต้นเหตุ index.css:1015) ให้ชัยตามใบ 472-C · (ข) ปิดช่องตัวกวาดให้วัด **ข้อความ/ไอคอน 1 ตัวอักษร** ได้ (ใบ 471-R ฉบับแก้) · (ค) มอบ token `qwen-knightbasins` ให้บอยผ่านช่องทางส่วนตัวเพื่อเปิด PR เองรอบถัดไป

---

## A · การเชื่อมต่อ (ทาง 2 — ยังไม่มี token)

**A1 ผล `git ls-remote` (รีโปสาธารณะ · ไม่ต้องใช้ token) — คืน ref ครบ ไม่ error:**

```
$ GIT_TERMINAL_PROMPT=0 git ls-remote https://github.com/Knightfurnich/KnightBasins-Source.git
5cb050677077ccd02cba0ada311599d2400c8f8d	HEAD
7320400eb3911db83d5c191ed13c88ec16259d6a	refs/heads/audit/chai-api-security-owasp
... (refs/heads/* คืนครบ) ...
```

**A2 สถานะ:** clone/อ่าน/รันเทสต์ทำได้ปกติ (ยืนยันแล้ว) · **push/เปิด PR ยังไม่ได้** เพราะยังไม่มี token ของตัวเอง ⇒ **ต้องให้เดวิดเปิด PR ให้** (ส่งไฟล์ `qa/report-qwen-round35-onboarding-20261019.md` + ภาพใน `qa/images/qwen-round35/`)
**A3 อ่านชุดเริ่มงานครบแล้ว:** `docs/team/README.md` → `ONBOARDING-qwen.md` → `TEAM.md` + ใบ 473-Q (สรุปในข้อ B)

> **ไม่มีการพิมพ์/แนบ token ในรายงานนี้หรือ commit ใด ๆ** · token ต้องขอจากบอส/เดวิดผ่านช่องทางส่วนตัวเท่านั้น

---

## B · พิสูจน์ว่าอ่านกฎครบ (10 บรรทัด)

**5 กฎที่จะยึดในงานนี้**
1. หนึ่งใบงาน = หนึ่งสาขา = หนึ่ง PR · ห้าม push ตรง `main` · ห้าม merge เอง (เดวิด merge เมื่อ CI เขียว + หลักฐานครบ)
2. ห้ามแก้ไฟล์เดียวกันพร้อมคนอื่น — เช็กทะเบียนท้าย `KANBAN.md` ก่อนเริ่ม · แตะไฟล์คนอื่นต้องแจ้งเดวิด
3. ห้ามแตะ production/DB/คอนเทนเนอร์ · ห้ามคำสั่ง DELETE/UPDATE/migration · ห้ามพิมพ์คีย์/token/`.env`
4. ห้ามเดาตัวเลขธุรกิจ (ราคา/สี/ขนาด) — ยึด `GET /api/catalog` / หน้าแอดมิน · รหัสสีคือตัวตน (`KZ802 ≠ KZ802N`)
5. หลักฐานคือหัวใจ: ทุกข้อสรุปต้องมีคำสั่ง + ผลรันจริง + ตัวเลข · ห้ามคำรับรองลอย ๆ · รายงานเวลาไทย (GMT+7)

**5 คำสั่งที่ใช้จริง:** `git ls-remote …` · `node qa/tools/gradient-scan-465c.mjs <base> dark "/quote#cart" --all` · `npx tsc --build` แล้ว `npx tsc -p artifacts/knight-basins|api-server/tsconfig.json --noEmit` · `node --experimental-strip-types --test …` · `curl` ยิงเว็บจริง

**ขอบเขตไฟล์ของตัวเอง:** owns = `artifacts/knight-basins/src/components/**` + `src/admin/**` · forbidden = `src/data/**`, `api-server/**`, `src/index.css` (แช่แข็ง), `src/App.tsx` (hero)
**ไฟล์ที่ถูกถืออยู่ตอนนี้ (ห้ามแตะ · อ่านได้):** `src/components/ThemeToggle.tsx` = **ชัย** ถือตามใบ **472-C** · `qa/tools/**` + `.github/workflows/release-validation.yml` = **รีพิต** ถือตามใบ **471-R**

---

## C · งานจริงชิ้นแรก — ตรวจอิสระ (read-only · ไม่แก้โค้ด)

### C1 · วัดซ้ำช่องจำนวน (− 1 +) ในแถวสินค้าใบเสนอราคา **โหมดมืด**

**วิธีวัด:** สคริปต์ CDP เอง (`c1-probe.mjs` — อยู่ **นอก** รีโปในโฟลเดอร์ชั่วคราว ไม่แก้ไฟล์ทีม) เปิด Chrome headless รุ่นตามเครื่องด้านบน → set `localStorage["knight-storefront-theme"]="dark"` → เปิด `https://knightbasins.com/quote` → seed `knight-cart` แบบเดียวกับ `gradient-scan` (KF001×2, KF009×1) → อ่าน `getComputedStyle` จริงของ `.line-quantity` และลูก → คำนวณ WCAG ratio + capture ภาพ

**ค่าที่เบราว์เซอร์คืนจริง (dark @1440):**

| รายการ | ค่าที่เบราว์เซอร์คืน | อัตราส่วน WCAG |
|---|---|---|
| พื้นหลังกล่อง `.line-quantity` | `rgb(255,255,255)` (ขาวทึบ) | — |
| สีตัวเลข `<span>` (qty) | `rgb(232,239,248)` = `#e8eff8` | **1.16** |
| ไอคอน `−` (svg Minus) | `rgb(232,239,248)` = `#e8eff8` | **1.16** |
| ไอคอน `+` (svg Plus) | `rgb(232,239,248)` = `#e8eff8` | **1.16** |

- **ค่าที่ได้ = 1.16 · เทียบเดวิด 1.16 → ต่าง 0.00 (ในเกณฑ์ ±0.15) ✅**
- **ต้นเหตุ (ยืนยันจากซอร์ส):** `index.css:1015` `.line-quantity { … background: white }` ฝังตาย + ตัวเลข/ไอคอน **ไม่ได้ตั้งสี** จึงสืบทอด `var(--ink)` ซึ่งโหมดมืด = `#e8eff8` (ประกาศที่ `ThemeToggle.tsx:83` — ไฟล์ของชัย) ⇒ ขาวบนขาว
- **ภาพหลักฐาน:** `qa/images/qwen-round35/c1-quote-row-dark-1440.png` (แถว KF001 ทั้งแถว — เห็นชัดว่า `− 2 +` จางเกือบมองไม่ออกบนกล่องขาว) และ `c1-line-quantity-dark-1440.png` (ครอปเฉพาะกล่อง)

### C2 · ด่าน CI มองไม่เห็นจุดนี้จริงหรือไม่

**คำสั่ง (ตาม EVIDENCE ข้อ 3):**
```
node qa/tools/gradient-scan-465c.mjs https://knightbasins.com dark "/quote#cart" --all
```
**ผลรันจริง (Chrome headless @1440):**
```
=== /quote#cart  theme=dark  checked=128  failing(p10 ratio < threshold)=1
```
- **จำนวนแถวที่วัดได้ (checked) = 128** · เดวิดได้ 130 → ต่าง −2 (คนละ commit/รอบโหลดแคตตาล็อก · อยู่ในช่วงที่ยอมรับได้ของงานตรวจ)
- **มีแถว `.line-quantity` ในผลหรือไม่ = ไม่มีเลย** (ตรวจแล้วทั้ง stdout และ `--json`: `grep line-quantity → NONE`) ✅ ตรงกับเดวิด
- **ทำไมด่าน "ผ่านทั้งที่จุดนี้ตก":** ตัวกวาดเก็บเฉพาะ element ที่มี **ข้อความของตัวเอง ≥ 3 ตัวอักษร** (`gradient-scan-465c.mjs:115` → `if (own.length < 3) return;`) แต่กล่องจำนวนมีแค่ `−` (1), `2`/`1` (1), `+` (1) ⇒ **ถูกกรองทิ้งทั้งหมด** จึงไม่เข้าชุดที่วัด → ไม่มีทางแดง · ตรงกับข้อจำกัดที่ทีมบันทึกไว้ ("ข้อความ 1–2 ตัวอักษร ด่านมองไม่เห็น")
- ผังผลเต็ม: `qa/images/qwen-round35/c2-gradient-scan-dark-quote.json`

### C3 · มีจุด "พื้น/สีฝังตาย" แบบเดียวกันอีกไหม ในขอบเขตตัวเอง

**เงื่อนไขค้น:** พื้น opaque ฝังตาย (`background: white` · `#fff`/`#ffffff` · `rgb(255,255,255)` · ค่าพื้นทึบอื่น) ที่ไม่ผูก `var(--…)` ใน `src/components/**` + `src/admin/**` · เกณฑ์ "เป็นบั๊ก" = **พื้นสว่างทึบ + ตัวหนังสือ/ไอคอนสืบทอดสีจากธีม (ไม่ได้ตั้งสีตาย)** ⇒ สลับเป็นสว่างในโหมดมืด

**ตารางผลตรวจ (อัตราส่วน = คำนวณจากสีจริงที่เบราว์เซอร์คืน/ที่ประกาศในธีม):**

| selector | ไฟล์:บรรทัด | ค่าที่ตั้ง | โหมดที่กระทบ | อัตราส่วนจริง | ต้องแก้? + เหตุผล |
|---|---|---|---|---|---|
| `.line-quantity` (ต้นแบบ) | `src/index.css:1015` | `background: white` | มืด | **1.16** (วัดจริง C1) | **ต้องแก้** (แต่ไฟล์แช่แข็ง ⇒ ใบ 472-C/ชัย) — ตัวนี้คือจุดที่ C1/C2 ยืนยัน |
| `.line-quantity span` / `button>svg` | `src/index.css:904` (ไม่ตั้งสี) | สืบทอด `--ink` `#e8eff8` | มืด | **1.16** | รากเดียวกับแถวบน (ไม่ใช่จุดใหม่) |
| modal panel `bg-white text-slate-900` | `components/PortfolioInquiryModal.tsx:279` | ขาว + ตั้งสีตาย `text-slate-900` | ทั้งสอง | **17.85** | ไม่ต้องแก้ — ตั้งสีตัวหนังสือตาย (dark-on-light) อ่านออกทุกโหมด |
| LINE button `bg-white text-[#07331b]` | `…PortfolioInquiryModal.tsx:557,596` | ขาว + ตั้งสีตาย | ทั้งสอง | **14.02** | ไม่ต้องแก้ — สีตั้งตาย |
| avatar/QR `bg-white` (บน `<img>`) | `…PortfolioInquiryModal.tsx:483,541` | ขาวบน img | — | n/a | ไม่ต้องแก้ — เป็นพื้นภาพ ไม่มีข้อความ |
| close button `bg-white/20 text-white` | `components/InstallationShowcase.tsx:252` | ขาวโปร่งแสง 20% + `text-white` | ทั้งสอง | n/a (overlay บนรูป) | ไม่ต้องแก้ — overlay โปร่งแสง ไม่ใช่พื้นทึบ |
| paper modal (inline `<style>`) `.kfc-*` | `components/StudioCheckoutModal.tsx:169–217` | `background:#fffdf8/#fff0e9…` **ทุกกฎตั้ง `color` ควบคู่** | ทั้งสอง | **9.28 / 6.01** | ไม่ต้องแก้ — โฟลเดอร์ "กระดาษ" ที่ตั้งทั้งพื้น+สีตาย (self-consistent) ไม่ใช่เคาะสืบทอดธีม |
| canvas `fillStyle="#fff"` | `components/StudioPage.tsx:282` | พื้น canvas JPEG export | — | n/a | ไม่ต้องแก้ — ไม่ใช่ DOM text |
| `--studio-stone-ink: dark?#ffffff:#17324a` | `components/StudioFootprint.tsx:48–49` | ผูกเงื่อนไขธีม (`dark`) | — | n/a | ไม่ต้องแก้ — ผูกธีมถูกต้องแล้ว |
| `.bg-white` (การ์ด/ฟอร์ม/ตาราง) หลายจุด | `admin/BackupVaultPage.tsx`, `LeadsManager.tsx`, `FactoryCutListModal.tsx:414`, `PortfolioGalleryPage.tsx`, `TechnicianCalendarPage.tsx:1185`, `AdminVoiceSettings.tsx:155` … | `bg-white` (class) | มืด (admin) | **14.47** | ไม่ต้องแก้ — `admin-theme.tsx:96–107` รีแมป `.bg-white/.bg-gray-50/100/.bg-slate-50/100` → `var(--card-paper)=#142235` ใน `[data-admin-theme="dark"]` คู่กับ `--ink=#eef4fa` |
| `color:#ffffff !important` | `admin/admin-theme.tsx:141,155` | ข้อความขาว บนพื้นเข้ม | มืด (admin) | สูง | ไม่ต้องแก้ — อยู่ใต้ selector `[data-admin-theme="dark"]` (ตั้งใจ) |
| `#ffffff` (ค่าข้อมูล) | `admin/BasinsManager.tsx:356`, `InstalledStonesManager.tsx:355`, `SheetStonesManager.tsx:305` | `imageTone`/`tone` default | — | n/a | ไม่ต้องแก้ — เป็นข้อมูลสี swatch ไม่ใช่ CSS background |
| print `.notice{background:#fff7e9}` | `admin/FactoryCutListModal.tsx:295` | กระดาษพิมพ์ (ตั้งทั้ง bg+color) | @media print | **~6+** | ไม่ต้องแก้ — เลย์เอาต์พิมพ์ (กระดาษคงที่) · เขต @media print ห้ามแตะตามมารยาททีม |
| `background-color:#0b1324 …` | `src/components/ThemeToggle.tsx:122,159,262,315,334` | — | — | ไม่ได้ตรวจแก้ | **ไฟล์ถูกถือโดยชัย (472-C)** — อยู่นอกสิทธิ์แก้ · ระบุไว้ว่าพบแต่ไม่แตะ |

**สรุป C3:** ในขอบเขตของตัวเอง (`components/**` + `admin/**`) **ไม่พบจุดที่สองที่ล้มแบบ index.css:1015** — ทุกพื้นสว่างทึบใน `components/**` ตั้งสีตัวหนังสือตายหรือเป็นภาพ/canvas/overlay ส่วน `admin/**` มีตาข่ายรีแมปธีม (`admin-theme.tsx:96–107`) รองรับ และ **ไม่มี** ชุด `bg-white` + สีตัวหนังสือตายที่อาจกลายเป็น "เข้มบนเข้ม" หลังรีแมป (ตรวจ grep แล้ว = 0 รายการ)

> **ข้อจำกัด (ซื่อตรงตามกฎ 7):** C3 ฝั่ง **admin** ยืนยันด้วย source-analysis + ค่าตัวแปรธีม (`--card-paper #142235` / `--ink #eef4fa` → 14.47) **ไม่ได้เรนเดอร์หน้าแอดมินจริง** เพราะต้อง login + เป็น production (ห้ามแตะ) · อัตราส่วนที่แจ้งในตารางคำนวณจากคู่สีจริง (สคริปต์ WCAG) ไม่ใช่กะด้วยตา

---

## เทสต์ / ไทป์ — เทียบ baseline (รันจริงที่ `5cb0506` · Windows · Node 24)

| รายการ | เดวิด (baseline `2072da7` · Linux) | **บอยรันจริง (`5cb0506` · Windows)** | tsc |
|---|---|---|---|
| `tsc --noEmit` knight-basins | 0 | **0** (หลัง `npx tsc --build`) ✅ | 0 |
| `tsc --noEmit` api-server | 0 | **0** ✅ | 0 |
| web tests | 1,529 / ผ่าน 1,520 / ตก 0 / ข้าม 9 | **1,523 / ผ่าน 1,505 / ตก 9 / ข้าม 9** | — |
| api tests | 1,329 / 1,329 / 0 | **1,329 / ผ่าน 1,324 / ตก 5** | — |

**หมายเหตุ (ห้ามคัดลอกตัวเลขคนอื่น — รายงานตามจริง):**
- **tsc:** ตอนรัน `npx tsc -p … --noEmit` ตรง ๆ จะเจอ `TS6305` (lib `api-client-react`/`db`/`api-zod` ยังไม่ build) ⇒ ต้อง `npx tsc --build` ก่อน (ตามสคริปต์ `typecheck:libs`) แล้วได้ **0 ทั้งสอง** ตรง baseline
- **ทำไมเลขไม่เท่า baseline:** (1) **คนละ commit** — ผมอยู่บน `5cb0506` (หลัง baseline `2072da7` 6 commit รวม merge #623) (2) **คนละ OS** — Windows/MSYS (CRLF/paths) (3) **ไม่ได้ `pnpm build`** — ไม่มี `dist/`
- **เทสต์ที่ตก (web 9):** `updates-page-v200.test.ts` (หลายเคส — ตรวจข้อความ release notes ใน `src/pages/UpdatesPage.tsx`; ข้อความมีอยู่แต่การจัดในบล็อกเวอร์ชันไม่ตรง regex), `crawler-facing-facts.test.ts` (llms.txt/named entries), `production build prerenders …` (ต้องมีการ build → ไม่มี `dist/`), `admin-portfolio-webp-optimizer.test.ts` (`getPortfolioImageDimensions` มีอยู่ที่ `PortfolioGalleryPage.tsx:57` แต่เทสต์อ่านผ่าน tsx loader แล้วไม่เจอ)
- **เทสต์ที่ตก (api 5):** `incident-alerts-and-digest.test.ts`, `support-guest-answers.test.ts`, `support-chat-error-audit.test.ts`, `customer-tracking-link.test.ts` — มี `ENOENT` (อ่านไฟล์/fixture) + เคส "read from the source"
- **การตีความ:** ทั้งหมด **ไม่ได้เกิดจากผม** (ไม่แก้โค้ดเลย — `git status` มีแค่ไฟล์รายงาน+ภาพ) — รูปแบบที่เห็นคือ **source-parsing / build-artifact / path** ซึ่งอ่อนไหวต่อ Windows/CRLF/ไม่ได้ build และ commit ที่ต่างจาก baseline ⇒ **ต้องให้เดวิดรันเทียบที่ Linux บน `2072da7`/`5cb0506`** เพื่อแยก "noise จากสภาพแวดล้อม" ออกจาก "drift จริง" — ผมไม่สรุปเกินหลักฐาน

---

## D · หลักฐาน (คำสั่ง → ผล) — สรุปอ้างอิงได้

1. `git ls-remote https://github.com/Knightfurnich/KnightBasins-Source.git` → คืน ref (HEAD `5cb0506…`) ไม่ error
2. C1: `node c1-probe.mjs https://knightbasins.com dark …` → `{boxBg:"rgb(255,255,255)", numberColor:"rgb(232,239,248)", ratioNumber:1.16, ratioIcons:[1.16,1.16], count:2}` + ภาพ 2 ไฟล์
3. C2: `node qa/tools/gradient-scan-465c.mjs https://knightbasins.com dark "/quote#cart" --all` → `checked=128 failing=1` · `grep line-quantity` = ไม่มี · JSON แนบแล้ว
4. C3: `grep` + คำนวณ WCAG จากคู่สีจริง (ตารางบน)
5. `npx tsc --build && npx tsc -p … --noEmit` → 0/0 · `node --experimental-strip-types --test …` → web 1523/1505/9/9 · api 1329/1324/5

## E · ไม่ทำของเดิมพัง (read-only)

- **ไม่แก้โค้ด/เทสต์/ไฟล์คนอื่นเลย** · ไม่แตะ `index.css`/`App.tsx`/`src/data/**`/`api-server/**`/`qa/tools/**`/`.github/**`/`deploy/**`/`public/**`/`ThemeToggle.tsx`
- ไม่แตะ production/DB/คอนเทนเนอร์ · ไม่มีคำสั่ง DELETE/UPDATE/migration · ไม่ deploy
- **`git status --short`:** `?? qa/images/qwen-round35/` + `?? qa/report-qwen-round35-onboarding-20261019.md` เท่านั้น (ไม่มีไฟล์ค้าง/ไฟล์ความลับ) — สคริปต์วัด C1 อยู่ **นอก** รีโป (โฟลเดอร์ชั่วคราว) ไม่ได้ commit
- ไม่พิมพ์ token/คีย์/`.env` ในรายงาน/commit

---

## เช็คลิสต์ท้ายใบ (ติ๊กตามจริง)

| # | หัวข้อ | สถานะ |
|---|---|---|
| 1 | ไม่ออกนอก SCOPE | ✅ (สร้างเฉพาะรายงาน+ภาพ) |
| 2 | ตรง GOAL ครบ A–E | ✅ (A ทาง2, B, C1–C3, D, E) |
| 3 | baseline ระบุ commit+OS+ผู้รัน | ✅ (5cb0506 · Windows · Qwen) |
| 4 | หลักฐานเป็นคำสั่ง/ผลรันจริง | ✅ |
| 5 | เทสต์ผ่านเป็นตัวเลข | ⚠️ tsc 0/0 · web 1505/1523 · api 1324/1329 (ตกจาก env/commit — ชี้แจงแล้ว) |
| 6 | พิสูจน์สองทาง | ✅ ใช้ "วัดซ้ำได้ค่าเดิม ±0.15" (C1 = 1.16 ต่าง 0.00) |
| 7 | ไม่แตะไฟล์ข้ามเจ้าของ | ✅ (ไม่แตะ ThemeToggle/qa tools) |
| 8 | ไม่แตะ production/DB | ✅ |
| 9 | ไม่เดาตัวเลข/สี | ✅ (ทุกค่าอ้างการวัด/คำนวณจริง) |
| 10 | รายงานอยู่ใน `qa/` ผ่าน PR | ⏳ ทาง 2 — รอเดวิดเปิด PR ให้ |
| 11 | สรุป 5 บรรทัด | ✅ |
| 12 | หลักฐานครบ (เวลาไทย + hash) | ✅ (21:30 +07 · 5cb0506) |

**ถึงเดวิด:** รบกวน (ก) commit ไฟล์นี้ + `qa/images/qwen-round35/*` และเปิด PR `docs(qa): qwen onboarding + independent check 473-Q` ให้ทีครับ (ผมยังไม่มี token) · (ข) ช่วยรัน web/api test เทียบที่ Linux บน `5cb0506` เพื่อยืนยันว่า 9+5 ที่ตกเป็น env-artifact หรือ drift จริง · (ค) ถ้าจะต่อรอบหน้า ช่วยส่ง token `qwen-knightbasins` ให้ทางช่องทางส่วนตัวครับ
