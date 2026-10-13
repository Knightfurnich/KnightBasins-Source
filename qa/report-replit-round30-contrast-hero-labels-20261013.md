# 468-R — รายงานบางส่วน / Draft — ยังไม่พร้อม merge

## รอบติดตามล่าสุด — occlusion / Studio / A4 fixture

รายงานส่วนเดิมด้านล่างเป็นประวัติ ไม่ใช่ผลรับรอง source ล่าสุด.

- ตรวจ CI รอบ 03:06: [38340125259](https://github.com/Knightfurnich/KnightBasins-Source/actions/runs/38340125259).
  Unit tests / release contents ผ่าน; coverage 1440 ผ่าน แต่เหลือ dark `/` KF029/KF030
  และป้าย “ชิ้นงาน 1” ทั้งสองธีม.
- Scanner สุ่ม 9 จุดต่อ own-text rectangle แล้วใช้ `document.elementFromPoint`.
  ถ้าทุกจุดถูกทับ: บันทึก `occluded / มองไม่เห็น`, selector, text, theme, width,
  covering elements และทุก sampled point ลง JSON/log/summary; ไม่เพิ่ม selector allowlist.
  จุดที่เห็นจริงยังถูกวัด; hero ที่วัดไม่ได้ยัง fail. LINE allowlist เดิมไม่เปลี่ยน.
- KF029/KF030 ถูกทับจริงโดย `div.basin-visual > img.basin-image` ตาม artifact
  ของ [38357838329](https://github.com/Knightfurnich/KnightBasins-Source/actions/runs/38357838329).
- ป้าย Studio ใช้ `#173f6b` ทั้งสองธีม; สีแคนวาส/วัสดุไม่เปลี่ยน.
  CI รอบดังกล่าว dark 1440 = 8.89 และ dark 390 = 8.73 (เดิม 4.23/4.24).
- พิสูจน์แดงบน test-only branch ไม่มี PR เพิ่ม/ไม่มี deploy:
  [38357870452](https://github.com/Knightfurnich/KnightBasins-Source/actions/runs/38357870452).
  เปลี่ยนเพียงป้าย Studio เป็น `#8b9dae`: 1440 แดงเฉพาะ `/studio` ทั้งสองธีมที่ 2.31;
  unit tests/release contents ยังผ่าน. Source ของ #609 ไม่มีสีทดลองนี้.
- รอบ 38357838329: sweep 1440 ผ่าน 34 route/theme pairs, REAL = 0, overflow = 0.
  390 coverage ผ่าน แต่ยังแดง 8 pairs; ไม่อ้างว่าเป็น UI failures ทั้งหมด:
  beyond-viewport capture อาจเปลี่ยน layout width และทำให้ sample ไม่ตรงข้อความ.
- แก้ capture เป็น paired viewport screenshots ที่ตำแหน่งเลื่อนเดียวกัน โดยไม่ใช้
  beyond-viewport clip; บันทึก viewport/layout widths และ actual tile positions.
  Diagnostic เฉพาะหน้า 390: `/price-guide` และ `/portfolio` ไม่มีจุดตก;
  ยังเหลือ PROJECT DETAILS (`#577186`, 4.08) และ Studio joint note (`#704f00`, 1.64).
  ผล diagnostic ไม่ใช้แทน full CI acceptance; ยังไม่แก้สีจุดเพิ่มเติมนอกคำขอล่าสุด.
- Occlusion fixture ทั้ง dark/light × 1440/390: 4/4 ผ่าน. แถวที่ถูกทับมีหลักฐาน
  `div.photo`; visible bad control ยังตกที่ 2.79 และ visible good control ผ่าน 10.72.
- A4 existing case บน CI เดิมผ่าน catalog แต่ timeout ตอน formal quote เพราะ read-only
  API ไม่รับ POST. เพิ่ม fixture wrapper: local catalogue + in-memory leads/quotes
  + explicit six-row print document (KF001/KF002/KF019/BW010/MU010/EG501).
  ไม่ติดต่อ production API และไม่เปลี่ยน assert ของ original browser case.
  Local Linux fixture: 1 pass / 0 fail / 0 skip รวม mobile layout, print CSS,
  real PDF, `pdfinfo` และ `pdftotext` assertions.
  **นี่คือ print-rendering proof ไม่ใช่ quote-editing/server-pricing acceptance.**
- เทียบ print blocks กับ main `cf3fd0d088afddb00f1f74da001261a5efe6c2b2`:
  index.css 5 blocks และ ThemeToggle 1 block เหมือนกัน byte-for-byte;
  print block diff = **0 บรรทัด**. รอบติดตามไม่แก้ index.css/App.tsx.
- Source guard ล่าสุด: 75/75; scanner syntax ผ่าน. ไม่แก้/ไม่รอ 7 local web failures/TTS.
- **ยังคง Draft จนกว่าจะมี exact-head CI green + red proof ของ capture รุ่นล่าสุด,
  full sweep และ A4 CI ครบ.** ถ้า CI ยืนยันจุดเพิ่มเติมจริง ต้องยืนยัน SCOPE ก่อนแก้สี.

## ติดตามหลังฉบับแก้ 2 — รับคำตรวจจากเดวิด

- E ได้รับการรับรองจากผู้ตรวจแล้ว; ไม่เปลี่ยน E อีก และยังไม่แยก PR เพราะรอบนี้รับทำข้อ 3+5 ใน #609.
- D เป็น no-op ตาม production ที่เดวิดยืนยัน; App.tsx ไม่แก้.
- ยึด CI เป็นหลัก: [Release validation / original #609](https://github.com/Knightfurnich/KnightBasins-Source/actions/runs/38337180395)
  Unit tests และ Validate release contents **success**. ไม่แก้/ไม่รอ local web failures หรือ TTS.
  ตาราง local ด้านล่างเป็นบันทึกประวัติ ไม่ใช่ตัวบล็อกการตรวจรับอีกแล้ว.
- เพิ่ม candidate width-aware coverage: 1440 require visible `.art-note` KF029/KF030;
  390 require visible `.art-note` KF019/KF020/KF021/KF023/KF025/KF026/KF028/KF029/KF030.
  ทุก measured row ยังถูกตรวจ ratio แม้ไม่ได้อยู่ใน mandatory list; ไม่เพิ่ม contrast allowlist.
  Hero ทุก sampled row ที่วัดไม่ได้เป็น error; ไม่มี hero exemption.
  บันทึก nullable rows ทุกแถวเป็น `NOT MEASURABLE / วัดไม่ได้`, selector/ข้อความ/width/theme/เหตุผล
  ลง JSON และ stdout รวมถึงแถวที่ไม่ถูกวาดเพราะภาพ/overlay. รายการถูกส่งต่อใน sweep summary.
- ลองจัดลำดับ capture, คง content width และ capture ทีละ viewport เพื่อแยกปัญหาพิกเซล
  แต่ยังได้ค่าต่ำที่ขัดกับ backing chip และแถวที่วัดไม่ได้. **ไม่ใช้ผลทดลองเป็นคำรับรองว่า UI ตกจริง**.
  คืนวิธี capture เดิมแล้ว; เก็บเพียง width-aware/reporting change เป็น candidate.
  `coverage-dark-*.json/log` และ `width-fixed-*` เป็น experimental traces ไม่ใช่ validation ของ final source.
- A4: รัน existing browser case “keeps every basin and stone row readable on mobile and across print pages”
  กับ isolated build; **fail** ก่อนขั้น print, `Timed out waiting for catalog cards`.
  ดู `a4-proof.log`; ไม่มี PDF ที่ผ่าน และไม่อ้างว่า A4 ผ่านจาก computed CSS.
- ยังไม่มี green gate, intentional-red gate, complete sweep หรือ A4 pass ในรอบติดตามนี้.
  **ยังคง Draft.** รายการส่งงานข้อ 3+5 ยังไม่เสร็จ; ต้องแก้ความน่าเชื่อถือของ pixel capture
  และตรวจ A4 ใน runtime ที่ตรงกับ CI ก่อนเปลี่ยนเป็นพร้อม merge.

วันที่ 13 ตุลาคม 2026 · ผู้รัน: Replit Agent · Linux / Node 24.13.0 · เวลาไทยประมาณ 08:30–09:30

Baseline: `ea03f9517cf0484ce734f43bf62fbed83ed4ad78`.
ตรวจ main ใหม่แล้วเป็น `161eeb34eca9f843383531460cf746bddb2b627d`: เพิ่มเฉพาะเอกสารอนุมัติขยาย SCOPE ของเทสต์ API; ไม่มีการเปลี่ยน source ระหว่างสอง commit.
ใช้ GitHub Connection เท่านั้น; ไม่ clone, ไม่ push เข้า main, ไม่ merge, ไม่ deploy.

## สถานะ / เหตุที่หยุด

**ยังไม่รับรอง A–H ครบ และห้ามใช้ Draft นี้เป็นหลักฐานว่าด่าน CI เขียว.**

1. ตัววัด pixel ยังไม่สามารถวัดป้ายแนวตั้งบางจุดที่ 390 ได้ครบ:
   `KF022`, `KF024`, `KF027` `.art-note`.
   Scanner ออก non-zero พร้อม `required hero/product-label pixels were NOT checked`.
   ไม่เพิ่ม allowlist, ไม่ซ่อนข้อความ, ไม่ลดเกณฑ์ และไม่อ้างว่าแถวที่วัดไม่ได้ผ่าน.
2. ผล 1440 ของป้ายสินค้าถูกเก็บก่อนปรับ sampling ของป้ายเป็น glyph-interior;
   มีค่าต่ำจากพื้นที่นอก glyph/นอก chip ในกรอบ Range. จึงเป็น **provisional** ไม่ใช่คำรับรอง B.
3. ยังไม่ได้รัน sweep ทุก route จนครบ, ยังไม่มี CI run เขียว หรือ intentional-red CI proof.
4. workspace รีสตาร์ตระหว่างรันเต็มสอง suites กับ Chromium พร้อมกัน ทำให้สำเนา `/tmp`
   และหลักฐานรอบแรกหาย. กู้ source ลงพื้นที่ถาวร และรันซ้ำเท่าที่ระบุด้านล่าง.
   ผลจากก่อนรีสตาร์ตไม่ใช้แทนหลักฐานที่สูญหาย.

## A–H

| ข้อ | ทำอะไร / สถานะ |
|---|---|
| A | ต่อท้าย dark hero rule ใน ThemeToggle: white text + dark shadow เท่านั้น. ไม่แตะภาพ, background, ขนาด, ตำแหน่ง หรือโครง. 1440 hero ผ่านในสามหน้าที่วัด; 390 **ยังไม่ครบ**. |
| B | ปัก light `.product-index`/`.art-note` เป็น `#34495b`, สีเท่านั้น. dark chip 88% เดิมยังอยู่. pixel acceptance **ยังไม่ครบ**. |
| C | light `.quote-main .eyebrow` และ `.footer-meta` เป็น `#4b6276`. ไม่แตะ tokens. 390 PROJECT DETAILS และ footer ทุก route **ยังไม่ครบ**. |
| D | main มี API-derived bowl shape line อยู่แล้ว จึงไม่แก้ App ซ้ำ. KF003 = หลุมสี่เหลี่ยมมุมมน; KF006 = หลุมวงรี. เพิ่มเทสต์ API-label, cleared value และ overflow-hole metadata. ไม่แก้ DB/ชื่อ/ราคา. |
| E | PriceGuidePage import และ render `NIGHT_WORK_FEE` สำหรับ `/ คืน`; `/ ชุด` ยังใช้ INSTALLATION_PRICE. แก้เฉพาะบล็อก API test ที่อนุมัติ. **เทสต์ผ่าน**; กฎ API 5,000/คืน ทุกพื้นที่เดิมยังถูก assert โดยเทสต์เดิม. |
| F | เพิ่ม source guards A/B/C/E/CI และ draft CI matrix 1440/390 (10 นาทีต่อ case), Chrome absent = fail, LINE-only explicit allowlist; hero ไม่ exempt. **ยังไม่รับรอง runtime CI**. |
| G | source ไม่แตะราคา/VAT/discount/data/LINE/geometry; overflow 1440 สามหน้าทั้งสองโหมดเป็น 0. **ยังไม่ครบทุก route/390/A4/browser regression**. |
| H | มี source reversals, raw 1440 JSON/CSV/logs และภาพบางส่วน. **หลักฐานยังไม่ครบ**. |

## เทสต์จริง

ใช้ Node strip-types; รายการไฟล์ตรง CI คือ `*.test.ts` ยกเว้น `*.browser.test.ts`.
รอบกู้ใช้ `--test-concurrency=2` สำหรับ web และ `4` สำหรับ API เพื่อไม่ซ้อน Chromium กับ suite ใหญ่.

| ตรวจ | tests | pass | fail | cancelled | skipped |
|---|---:|---:|---:|---:|---:|
| web suite รอบกู้ | 1519 | 1510 | 7 | 2 | 0 |
| API suite รอบกู้ | 1329 | 1328 | 1 | 0 | 0 |
| web changed-feature tests ก่อนเพิ่ม CI source guard | 87 | 87 | 0 | 0 | 0 |
| final contrast-theme-guard | 75 | 75 | 0 | 0 | 0 |
| API catalog-commercial-constants | 19 | 19 | 0 | 0 | 0 |

web failures/cancellations เป็น browser checks ที่อยู่ในไฟล์ชื่อปกติ ได้แก่ AI-cost/admin widgets,
stock และ Studio: mocked page load / browser timeout. **ไม่อ้างว่าเป็น baseline failure**
เพราะ baseline รอบแรกเคยผ่าน แต่ snapshot/runtime รอบกู้ไม่เท่ากัน. ต้องสอบสวนก่อน merge.

API failure: `google-tts.test.ts`, “uses GOOGLE_TTS_VOICE_NAME and GOOGLE_TTS_LANGUAGE_CODE overrides when set”,
Kore กับ expected Zephyr. พบตั้งแต่ baseline ก่อนแก้ด้วย; ไม่แก้ไฟล์นอก SCOPE.

`pnpm run typecheck:libs`, `pnpm exec tsc --noEmit` ทั้งสอง artifacts และ production web build:
exit 0. Log อยู่ใน evidence directory.

คำสั่ง source guard:
`node --experimental-strip-types --test artifacts/knight-basins/test/contrast-theme-guard.test.ts`.

Reversible source proofs A/B/C/E/F: mutation -> exit 1; คืน source -> exit 0,
ทุกกรณีใน `reversible-guards.log`. Night fee interpolation ทดลองค่าทดสอบ 7,300 กับ installation
5,100/9,900 แล้วค่ากลางคืนยัง 7,300; เปลี่ยน night fixture เป็น 8,600 แล้วหน้าอ่าน 8,600.
ไม่แก้ค่าคงที่จริง.

Missing Chrome:
`CHROME_BIN=/does-not-exist node qa/tools/sweep-467c.mjs` -> exit **2**,
`Chrome unavailable ... — contrast was NOT checked`.

## Contrast / ภาพจริงที่มี

Raw all-row JSON: `qa/images/replit-round30/{before,after}-{dark,light}-1440.json`.
ตารางทุก hero/product label/footer/PROJECT DETAILS ที่จับคู่ได้:
`qa/images/replit-round30/ratios-1440.csv`.
แถวสินค้าใน CSV ติดป้าย provisional ชัดเจน; ไม่มีการเติม ratio ให้แถวที่ขาด.

| Hero route @1440 | dark minimum หลัง | light minimum หลัง |
|---|---:|---:|
| `/` | 13.53 | 4.55 |
| `/stone` | 12.70 | 4.69 |
| `/quote` | 8.97 | 4.69 |

Hero ใช้ computed foreground กับ backing pixels ตรง glyph interiors; retained resolved text-shadow
ตอนทำ text transparent เพื่อวัด backing ที่ลูกค้าเห็น. รูป/gradient เดิมไม่ถูกเปลี่ยน.
Before เป็นการถอดเฉพาะกฎ 468 ผ่าน compiled CSSOM (ไม่ inject uncompiled Tailwind);
source/runtime เดียวกัน; source reversals E ตรวจต่างหาก.

Overflow @1440 (innerWidth/clientWidth/scrollWidth):
dark `/`, `/stone`, `/quote` = `1440/1425/1425`;
light `/` = `1440/1440/1440`, `/stone` = `1440/1425/1425`, `/quote` = `1440/1440/1440`.
ทั้งหมด scrollWidth - clientWidth = **0**. ไม่ถือว่า 390 ผ่านจากตัวเลขนี้.

ภาพก่อน/หลัง 1440 มีทั้งสามหน้าและสองธีม รวม card crops KF003/KF006;
ภาพ 390 มีเพียงบางส่วนก่อน scanner หยุด. ภาพรุ่น 1440 ชุดแรกเป็น full-page,
ไม่ใช่ hero-only export; ต้องทำ hero-only 900px ครบอีกครั้งก่อนตรวจรับ.

## CI และ scope

CI `contrast-sweep` เป็น job ใหม่ที่เพิ่มต่อท้าย; bytes ของ validate-release/unit-tests
ก่อนบล็อกใหม่นั้นคงเดิม. deploy.yml ไม่แก้ และ deploy ทำเฉพาะ push main.
ยังไม่มีลิงก์ CI เขียว/intentional-red; ไม่แทน CI proof ด้วย local guard failure.

ไฟล์ source ที่ตั้งใจเปลี่ยน:
index.css, ThemeToggle.tsx, PriceGuidePage.tsx,
contrast-theme-guard.test.ts, basin-bowl-shape-card.test.ts,
catalog-commercial-constants.test.ts (เฉพาะ night-fee block ที่อนุมัติ),
sweep-467c.mjs, gradient-scan-465c.mjs และ contrast CI job เท่านั้น.
App.tsx/data/API src/public/scripts/deploy และ production DB ไม่แก้.

## งานค้างก่อนรับรอง

- จบ glyph sampling และ coverage ของป้ายแนวตั้ง โดยไม่เปลี่ยน geometry/ซ่อน label.
- เก็บ before/after ทั้ง 1440/390 ทุกจุด ด้วย scanner เวอร์ชันเดียว; hero-only images ให้ครบ.
- แก้สภาพแวดล้อม browser regression รอบกู้; rerun suites + A4 ใน isolated snapshot.
- รัน sweep 12 sitemap + non-sitemap ทั้งสองธีม/สอง widths; จุดนอก scope ให้รายงาน ไม่แก้เอง.
- รัน CI green และ intentional-red CI proof; เติม run URLs จริงในรายงานเดิม.

## สรุป 5 บรรทัด

แก้: dark hero colors/shadows, light labels/PROJECT DETAILS/footer, night-fee source; D เดิมถูกต้องและเพิ่มเทสต์.
เทสต์: guard 75/75, API fee 19/19, typecheck/build 0; full suites ยังมี failures ตามตาราง.
ตรวจไม่ได้: pixel 390 บางป้าย, sweep ทุก route, green/red CI, A4/browser regression ครบ.
ความเสี่ยง: Draft scanner/CI ยังไม่ผ่าน acceptance; **ห้าม merge ตามคำรับรองจากรายงานนี้**.
ข้อเสนอ: ผู้ตรวจรับพิจารณา E ที่แยกเป็นอิสระได้; ทำหลักฐาน/validator ที่ค้างให้ครบก่อนปิด A–H.
