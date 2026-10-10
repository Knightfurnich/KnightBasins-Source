# รายงาน 416-B (บอย = Qwen) — กลับด้าน heuristic ปุ่ม LINE: กล่องในเว็บเป็นค่าเริ่มต้น

**ผู้ทำ:** บอย (Qwen) · **วันที่:** 10 ต.ค. 69 · เวลาไทยที่ทำ **21:2x–21:3x น.** (รันเทสต์最后一次 21:3x)
**分支/PR:** `fix/line-onsite-panel-default` → PR `fix(line): default to the on-site LINE panel and treat coarse/narrow as mobile` · base `main = f1a5409`
**ไฟล์ที่แตะ (2):** `artifacts/knight-basins/src/components/PortfolioInquiryModal.tsx` · `artifacts/knight-basins/test/portfolio-inquiry-line-contact.test.ts` — **ไม่แตะ** `api-server/**`, `src/data/**`, ฟอร์มโทรกลับ, ปุ่ม login, `/api/auth/line/status`, ข้อความสรุปที่ส่งเข้า LINE, testid เดิม

## A. สิ่งที่เปลี่ยน (ชื่อ query/ค่าคงที่ใหม่)
| เดิม (414-B) | ใหม่ (416-B) |
|---|---|
| `DESKTOP_LINE_MEDIA_QUERY = "(min-width: 1024px) and (pointer: fine)"` | `MOBILE_LINE_MEDIA_QUERY = `(max-width: ${MOBILE_LINE_MAX_WIDTH_PX}px), (pointer: coarse)``` (= `(max-width: 1023px), (pointer: coarse)`) |
| `DESKTOP_LINE_BREAKPOINT_PX = 1024` | `MOBILE_LINE_MAX_WIDTH_PX = 1023` (+คง别名 `DESKTOP_LINE_BREAKPOINT_PX = 1024` แบบ @deprecated เพื่อ人不พัง) |
| `useState(false)` = เริ่มต้น **deep link** | `useState(true)` ชื่ อ `onSitePanel` = เริ่มต้น **กล่องในเว็บ** |
| `setDesktopMode(media.matches)` | `setOnSitePanle(!media.matches)` — ถามเครื่องว่า “เป็นมือถือไหม?” ถ้าตอบใช่จึงใช้ deep link |
| ไม่มี `matchMedia` → ตกไป deep link | **early `return`** ไม่แก้อะไร ⇒ คงค่าเริ่มต้น = กล่องในเว็บ |

`lineContactModeForViewport(width, pointer?)` เปลี่ยน pointer เป็น **3 สถานะ** `"fine" | "coarse" | null/undefined` (เดิม boolean บังคับให้ “ไม่รู้” กลายเป็น “fine” หรือ “coarse” เสมอ) และลำดับการตัดสินใจ:
`coarse → deeplink` · `width ≤ 1023 (รู้ค่า) → deeplink` · **ที่เหล
ือรวม “ตรวจไม่ได้” → dialog**

เหตุผลความปลอดภัย (ตามที่ใบให้ระบุ): กล่องในเว็บมีทางออกครบ 3 เสมอ (QR + “เปิดหน้าเพิ่มเพื่อน” + คัดลอกข้อความ) ส่วน deep link `oaMessage` ถ้าเครื่องเราคาดผิดจะพาไปหน้าโฆษณา LINE (วัดแล้ว redirects=2 → `https://www.line.me/ja/`) ⇒ ผิดข้าง “อยู่กับเว็บ” ดีกว่า

## B. มือถือต้องเหมือนเดิม 100%
`buildLineDeepLink()` ไม่แก้ · ยัง `href="https://line.me/R/oaMessage/%40789gcnhq/?text=…"` + `data-testid="button-inquiry-line"` + `<a target="_blank" rel="noopener noreferrer">` · ข้อความสรุป (`lineMessage`) และตรรกะ VAT/รุ่น/ราคา คงเดิม (เทสต์ “keeps the mobile deep link exactly as it was” ยัง assert string เทียบ `encodeURIComponent` เป๊ะ)

## C. ตาราง 5 เคส — ผลจริงที่ รันจากฟังก์ชันในไฟล์จริง (ไม่ได้เดา)
```
$ node /tmp/case416.mjs      # ดึง lineContactModeForViewport ออกจากไฟล์จริง (AST + transpile) แล้วเรียก
MOBILE_LINE_MEDIA_QUERY = ((max-width: ${MOBILE_LINE_MAX_WIDTH_PX}px), (pointer: coarse))
component default: true | early return when no matchMedia: true
  (1) โทรศัพท์จริง           f(390, "coarse")  => deeplink     ✓ ควรเป็น deeplink
  (2) เดสก์ท็อป              f(1440,"fine")    => dialog       ✓
  (3) pointer ตรวจไม่ได้      f(1440, undefined)=> dialog       ✓ ← เคสที่ใบนี้มาแก้
  (4) จอแคบ + fine           f(390, "fine")    => deeplink     ✓ จอแคบถือเป็นมือถือ
  (5) NaN/ไม่มี matchMedia    f(NaN, undefined) => dialog       ✓
  (5b) width=0 + unknown     f(0,   undefined) => dialog       ✓ (ของแถม: “อ่านอะไรไม่ได้” = อยู่กับเว็บ)
```

## EVIDENCE ตัวเลข
```
$ node --experimental-strip-types --test test/portfolio-inquiry-line-contact.test.ts test/portfolio-inquiry.test.ts test/portfolio-inquiry-search.test.ts
  # tests 31 · # pass 31 · # fail 0        (ใน 31 มีเทสต์ 416-B ใหม่ 5 เคส = (1)-(5) + 1 assert ชุด default)
$ node --experimental-strip-types --test test/*.test.ts        # เต็มชุด
  # tests 1288 · # pass 1246 · # fail 0 · # skipped 42   (baseline ของใบ: pass ~1216/ตก 0 → ผ่านหมด ไม่มีการถอย)
$ npx tsc -p tsconfig.json --noEmit
  exit 0
```

## พิสูจน์สองทาง
```
 flips: useState(true)→(false) และให้ helper คืน "deeplink" แทน "dialog" เมื่อตรวจไม่ได้ (= พฤติกรรมเดิมก่อน 416-B)
   → not ok 2 - (2) 1440px + fine pointer -> on-site panel          expected: 'dialog' actual: 'deeplink'
   → not ok 3 - (3) 1440px but pointer unknown …                   expected: 'dialog' actual: 'deeplink'
   → not ok 5 - (5) nothing measurable at all -> on-site panel …     (default + early-return asserts ตกด้วย)
   # pass 10 · # fail 3
 คืนของ →  # tests 13 · pass 13 · fail 0   (และเต็มชุดยัง 0 fail)
```
เทสต์ที่ล็อก source เพิ่ม (กันการถอยหลังโดยไม่พึ่งพฤติกรรม): `useState(true)`, `typeof window.matchMedia !== "function") return;`, `window.matchMedia(MOBILE_LINE_MEDIA_QUERY)`, `setOnSitePanel(!media.matches)`, `doesNotMatch` query เก่า `(min-width: 1024px) and (pointer: fine)`

## ตรวจไม่ได้ (+ เหตุผล)
1. **พฤติกรรมจริงบน iOS Safari / Android Chrome ของมือถือแต่ละรุ่น** — sandbox นี้ไม่มี browser/device farm; ผมทดสอบด้วยฟังก์ชัน+source assertions เท่านั้น · หลัง merge เดวิดวัดบน production ได้ (ที่ 390 ควรเห็น anchor `oaMessage`; ที่ 1440 ควรเห็นปุ่มเปิด panel)
2. **“เครื่องที่รายงาน pointer ไม่ได้” มีรุ่นใดจริงบ้าง** — ไม่สามารถระบุ device list จากโค้ด; ยืนยันได้แค่ว่าเส้นทางนั้นตอนนี้ไปกล่องในเว็บ (default + เคส (3))
3. **หน้า production ที่ deploy แล้วยังเป็น code เดิม** — ผมไม่ push/merge เข้า main ตัวเลข DOM ที่วัดได้ในวันนี้จึงมาจาก local build เท่านั้น

## ความเสี่ยง / ข้อเสนอ
- 🟠 **tablet แนวตั้งจอ >1024px แต่ pointer coarse** → ยังเป็น deep link (ถูก: ใช้นิ้วสัมผัส) แต่เครื่องประเภท “จอใหญ่ + รายงาน pointer ไม่ได้” จะได้ QR; ถ้ามุมมองทีมขายอยากให้ “หน้าจอเล็กก็ deep link เสมอ” ตามความกว้างอย่างเดียว ต้องสั่งมาก่อน (ตอนนี้ใช้ ORตามใบ)
- 🟠 ปุ่มถูก **hidden ด้วย visibility ไม่ใช่ลบ** ตอนกล่องเปิด (จาก #493) — ไม่เกี่ยวกับใบนี้ แต่ต้องวัดซ้ำหลัง deploy
- 🟡 **onboarding**: ผู้ใช้เดสก์ท็อปที่เคยมือถือ↔คอมไปมาอาจเห็นปุ่มต่างพฤติกรรมตอนหมุนจอ (มี listener `change` อยู่แล้ว — พฤติกรรมตั้งใจ)
- 🟢 ข้อเสนอ: เมื่อ deploy แล้ว ให้เก็บเคส probe 3 จอ (390/768/1440) ใน Playwright smoke เพื่อ lock พฤติกรรมจริง (ผมยังใส่ไม่ได้ เพราะใบ 433-B เป็นคนละงาน)

— จบรายงาน 416-B · commit ดูได้จาก `git log -1 --format=%H` ของสาขา (แนบใน PR)
