# ใบงานที่ 25A (ชัย) — ตัวจับคู่ทีมทนการสะกดผิด + ค่า confidence

**สถานะ: ส่งให้ชัย 24 ก.ย. 69** — Task 23 merge เข้า main แล้ว · `admin-router.ts` ไม่มีใครแก้หลัง Task 23 → ไม่ชน

```
✅ มาตรฐานการออกใบงาน · 12/12 · 24 ก.ย. 69 · เดวิด
```

ส่งเป็นสตริงเดียวเข้า `sh bin/chai.sh "<ใบงาน>" /opt/data/cache/kbsrc 40`

```
GOAL      : ทำให้ตัวจับคู่ทีมทนการสะกดผิด/ตัดคำท้าย (เช่น "ทีมเจม" = "ทีมเจมส์",
            "ทีมออฟฟิส" = "ทีมโรงงาน") โดยใช้ normalize + prefix + fuzzy ตามอัลกอริทึม
            ที่ทดสอบแล้วใน /opt/data/bin/knight_team_match_prototype.py
            และให้ API ส่งค่า confidence ของการจับคู่มาด้วย เพื่อให้แอดมินยืนยันรายการที่ไม่ชัวร์ได้

SCOPE     : /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
            /opt/data/cache/kbsrc/artifacts/api-server/test/admin-dashboard-stats.test.ts
            /opt/data/cache/kbsrc/artifacts/api-server/test/admin-technician-calendar.test.ts
            /opt/data/cache/kbsrc/artifacts/api-server/test/admin-team-matching.test.ts  (ใหม่)
            /opt/data/cache/kbsrc/lib/api-spec/openapi.yaml
            อ่านได้ (ห้ามแก้): /opt/data/bin/knight_team_match_prototype.py
                               /opt/data/knight-design-kb/qa/design-team-name-matching.md

FORBIDDEN : ห้ามแตะ artifacts/knight-basins/** (ของ Replit)
            ห้ามแตะ layout/ตาราง/CSS ใบเสนอราคา
            ห้ามแตะ migration / DB บน production
            ห้าม push เข้า main — เปิด PR เท่านั้น
            ห้ามเพิ่ม dependency ใหม่ (ทำ normalize/prefix/edit-distance ด้วยมือ)

EVIDENCE  : 1) npx pnpm run typecheck จาก root -> 0 errors
            2) cd artifacts/api-server && npm test -> ระบุ tests/pass/fail
               (baseline ก่อนเริ่ม — วัดเอง 24 ก.ย. 69: 221 tests / ผ่าน 217 / ตก 4 ตัวเดิมจาก sandbox)
               เกณฑ์ผ่าน: ต้องไม่มี fail ใหม่เกิน 4 ตัวเดิมนั้น
            3) node --experimental-strip-types --test test/admin-team-matching.test.ts
               -> ต้องผ่านครบ 26 เคสในตาราง TEST CASES ด้านล่าง
            4) npx pnpm run --filter @workspace/api-spec codegen -> commit ไฟล์ generated ด้วย
            5) git diff --stat -> ไฟล์ที่แก้มือ 5 ไฟล์ตาม SCOPE + ไฟล์ generated จากข้อ 4
               (ไฟล์ generated นับเพิ่มได้ แต่ห้ามแก้มือ)

OUTPUT    : ลิงก์ PR + branch · ผล typecheck + ผลเทสต์ (ตัวเลขจริง) ·
            ผลรันเทสต์ 26 เคส (ผ่าน/ตก) · ระบุฟังก์ชันที่เพิ่มและบรรทัดที่แก้

STOP      : หยุดแล้วรายงานทันทีถ้า (ก) เทสต์เดิมตกเกิน 4 ตัว
            (ข) เคสจริงจากคลัง (12 เคสแรกในตาราง) ตกแม้แต่เคสเดียว
            (ค) typecheck ไม่ผ่านแก้ไม่ได้ใน 1 รอบ
            ห้ามเดาต่อ ห้ามแก้เกณฑ์ให้ผ่าน

BRANCH    : feat/chai-team-name-fuzzy-match

CONTRACT (ทำตามนี้ ไม่ต้องเดา — อัลกอริทึมนี้ทดสอบแล้ว 26/26):

1) เพิ่มฟังก์ชันบริสุทธิ์ (pure) ใน admin-router.ts — ห้ามแตะ DB

   normalize(text): NFC -> ลบ zero-width (U+200B-U+200D, U+FEFF)
                    -> เลขไทย ๐-๙ เป็น 0-9 -> ยุบตัวอักษร -> ลบช่องว่างทั้งหมด
   ตารางยุบตัวอักษร: ศ/ษ->ส · ฏ->ต · ฑ/ฒ/ธ->ท · ณ->น · ญ->ย · ภ->พ · ฬ->ล

   loose(text): normalize แล้วตัดวรรณยุกต์/การันต์ออก
                (ั ็ ่ ้ ๊ ๋ ์ ํ ิ ี ึ ื ุ ู)

   editDistance(a, b): Levenshtein ปกติ

   matchTeamToken(token, teams) -> { code, confidence } | null
     ชั้น 1 exact  : token เทียบเท่า shortName / name / alias (เทียบทั้งรูป normalize และ loose)
     ชั้น 2 prefix : token เป็นคำนำหน้าของชื่อ และ len(normalize(token)) >= 3
                    -> confidence "prefix"
     ชั้น 3 fuzzy  : ชื่อยาว >= 4 ตัว และ editDistance <= 1 -> confidence "fuzzy"
     ไม่เข้าเงื่อนไข -> null

   ⚠️ 3 กับดักที่ทดสอบแล้วเจอจริง (ห้ามพลาด):
   ก) alias เก็บ "ไม่มีคำนำหน้า ทีม/ช่าง" -> ตอนเทียบต้องประกอบเองทั้ง 3 รูป:
      คำเดี่ยว · "ทีม"+คำ · "ช่าง"+คำ
   ข) ตัดเครื่องหมายวรรคตอน (. , ! ? ) ก่อน แล้วค่อยตัดคำลงท้าย
      (ครับ ครับผม ค่ะ คะ นะ จ้า ด้วย) — ของจริงในคลังมี "ทีมเจมส์ครับ."
   ค) guard ความยาวของ prefix วัดจากรูป normalize (นับวรรณยุกต์) ไม่ใช่รูป loose
      ไม่งั้น "ชัย" -> loose "ชย" (2 ตัว) ตก guard ทั้งที่ควรเป็น prefix ของ "ชัยยา"

2) เปลี่ยน matchedTechnicianTeamCode(text, teams) ให้ใช้ matchTeamToken
   โดยหา token ที่ตามหลัง "ทีม" หรือ "ช่าง" ก่อน แล้วค่อย fallback เป็นการสแกนทั้งข้อความ
   (คง default teams = SEED_TECHNICIAN_TEAMS เพื่อเทสต์เดิมไม่พัง)

3) เพิ่ม confidence ในผลลัพธ์
   - resolvedTechnicianTeamCode คืน { code, confidence } ด้วย
     โดย lead.technicianTeamCode (คอลัมน์) = confidence "manual"
   - technicianCapacity[].jobs[] เพิ่มฟิลด์ confidence
   - GET /admin/technician-calendar แต่ละ job เพิ่มฟิลด์ confidence
   - อัปเดต openapi.yaml + รัน codegen

TEST CASES (ต้องมีครบใน admin-team-matching.test.ts — 26 เคส)

  เคสจริงจากคลัง LINE (12) — ต้องได้ exact:
    ทีมเจมส์ -> CM · ทีมเจมส์ครับ. -> CM · ทีมโรงงาน -> KF · ทีมออฟฟิต -> KF
    ทีมพร้อม -> PM · ทีมเนตร -> PP · ทีมทู -> ST · ทีมยี่ -> TP
    ช่างเปา -> PA · ช่างชัยยา -> CL

  สะกดผิด/ตัดคำท้าย (10) — ห้ามตก:
    ทีมเจม -> CM (prefix) · ทีมเจมส -> CM (exact loose) · ทีมเนต -> PP (prefix)
    ทีมเจมส์ครับ -> CM · ทีมออฟฟิส -> KF (exact loose) · ทีมชัย -> CL (prefix)
    ทีมโรง -> KF (prefix) · ทีมกอล -> TJ (prefix) · ทีมยี่ -> TP · ทีมทู -> ST

  ต้องไม่จับ (4):
    "บ่ายไปรับแผ่นสีน้ำเงินโรงงานพี่อ้วนให้พี่หมู" -> null
    "รัน 26/1016 ช่างอ๊อก ซื้กาวขาว 1 หลอด" -> null
    "0832229035 ช่างพงษ์" -> null
    "แบบช่าง 26/1057" -> null
```

## บันทึกการทบทวนก่อนออกใบงาน (เช็คลิสต์ 12 ข้อ)

| # | ข้อ | ผล |
|---|---|---|
| 1 | ลำดับ | ✅ Task 23 merge แล้ว (`8cc10a7` → main) · `admin-router.ts` ไม่มีใครแก้หลัง 23 → ยิงได้ |
| 2 | SCOPE ครบ | ✅ grep ยืนยันแล้วว่า matcher ถูกคุมด้วย `admin-dashboard-stats.test.ts` + `admin-technician-calendar.test.ts` → ใส่ทั้งคู่ |
| 3 | ขัดกันเอง | ✅ EVIDENCE ข้อ 5 เขียน "แก้มือ 5 + generated จาก codegen" ไม่จำกัดจำนวนรวม |
| 4 | อ้างถึงอะไร | ✅ 26 เคสอยู่ในใบงานเอง · อ้าง prototype ก็ใส่ path เต็มใน SCOPE |
| 5 | คำสั่งจริง | ✅ ใช้ `npx pnpm` (ไม่มี pnpm ตรง ๆ) · `npm test` มีจริง |
| 6 | สิทธิ์ | ✅ git/pnpm/npm/node/curl อยู่ใน `allow` ของ settings.json แล้ว |
| 7 | รูปที่เทียบ | ✅ ระบุชัดว่า alias ต้องไม่มีคำนำหน้า และให้ประกอบ 3 รูปตอนเทียบ |
| 8 | ข้อห้าม | ✅ production/docker/.env/git push/ไฟล์ Replit/ไม่เพิ่ม dependency |
| 9 | STOP | ✅ เป็นตัวเลข: ตกเกิน 4 ตัว · เคสจริงตกแม้ 1 เคส |
| 10 | ครึ่งเดียว | ✅ ไม่ตัด — ส่วน queue/ignore_phrases แยกเป็น 25B **อย่างตั้งใจ** เพราะเป็นตาราง+endpoint คนละชุด ไม่ใช่เพื่อเลี่ยงปัญหา |
| 11 | Replit | – ไม่เกี่ยวข้อง (ชัย) |
| 12 | เพดานรอบ | ✅ ประเมิน ~30 → ตั้ง 40 |

## ยังไม่ทำในใบนี้ (ตั้งใจแยก)

- **25B** — ตาราง `technician_team_ignore_phrases` + endpoint รายการ "รอระบุทีม" + เพิ่ม/ลบ alias
- **26** — หน้าจอ "รอระบุทีม" ของ Replit (กดระบุทีม / ข้าม 1 คลิก)
