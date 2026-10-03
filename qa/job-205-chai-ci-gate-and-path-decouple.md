# ใบงาน 205 (ชัย) — CI Quality Gate & Host-Path Decoupling เฟส 2

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**ผู้รับผิดชอบ:** ชัย (Programmer) · เริ่มได้ทันที
**Branch:** `ci/chai-test-gate-and-host-path-decouple`
**วัตถุประสงค์:** ปิดช่องว่างคุณภาพ 2 ข้อที่ชัยค้นพบ: (1) CI ยังไม่รัน unit test เลย ทำให้เทสต์ตกไม่เคยกันการ merge (2) ยังมีโค้ดอีก 2 จุดที่อ่านไฟล์จาก path บนโฮสต์เป็นค่าเริ่มต้น ทำให้เทสต์ผูกกับเครื่อง

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. เพิ่มขั้นตอนรัน unit test เข้า CI ใน /opt/data/cache/kbsrc/.github/workflows/release-validation.yml
     - รันเทสต์ชุด non-browser ของ artifacts/api-server และ artifacts/knight-basins (ตัดไฟล์ *.browser.test.ts ออก เพราะต้องใช้เบราว์เซอร์)
     - ให้ใช้ pnpm ตามที่ repo ใช้อยู่ (อย่าใส่ npm install ที่จะทำให้ lockfile เพี้ยน) และตั้ง step ให้ fail งานเมื่อเทสต์ตก
     - ต้องไม่แตะ job เดิม "Block tracked runtime uploads" และไม่เปลี่ยนชื่อ workflow
  2. ปรับ 2 ไฟล์ที่ยังอ่าน path บนโฮสต์เป็นค่าเริ่มต้น ให้รับค่าจาก env override ได้เหมือนแนวทาง google-service-account:
     - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/ai-cost-tracker.ts (บรรทัด ~135: HERMES_AUDIT_LOG_PATH = "/opt/data/cron/usage_audit.jsonl" — ยัง hardcode ต้องเปิดให้ override ผ่าน env)
     - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/portfolio.ts (บรรทัด ~32: PORTFOLIO_FEATURED_KB_PATH — มี env แล้ว ให้ตรวจว่าครบทุกจุดที่อ่านไฟล์ KB และสม่ำเสมอ)
     - รักษาพฤติกรรมบน Production 100% (ถ้าไม่ตั้ง env ต้องใช้ path เดิม) และห้ามอ่านไฟล์จริงในเทสต์
  3. เพิ่ม/ปรับเทสต์ใน /opt/data/cache/kbsrc/artifacts/api-server/test/ ให้ยืนยันว่า paths ทั้งสองอ่านจาก env override ได้ และยังทำงานถูกเมื่อไม่มี env
  4. เขียนรายงานสรุปสั้นๆ ว่า CI เดิมไม่รันเทสต์จุดใด และหลังแก้จะกันอะไรได้บ้าง (แนบใน PR description ไม่ต้องสร้างไฟล์ใหม่ ถ้าไม่จำเป็น)

SCOPE:
  - /opt/data/cache/kbsrc/.github/workflows/release-validation.yml
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/ai-cost-tracker.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/src/routes/portfolio.ts

FORBIDDEN:
  - ห้ามแก้ Business Logic, สูตรราคา, router, หรือ response shape ใดๆ — งานนี้เพิ่ม env override เท่านั้น
  - ห้ามลบ/ปิดเทสต์ใดๆ เพื่อให้ CI ผ่าน (ถ้าเทสต์ตกเพราะปัญหาสภาพแวดล้อม ให้แยกเป็นข้อถัดไปหรือข้ามแบบมีเหตุผลพร้อมคอมเมนต์)
  - ห้าม commit secret หรือค่า path ที่ชี้ไปข้อมูลจริงของ production ลงในเทสต์
  - ห้ามแตะโค้ด frontend (artifacts/knight-basins/) และห้ามแตะ src/index.css
  - workflow ต้องใช้ token ที่มีสิทธิ์ workflow — ถ้า push แล้ว GitHub ปฏิเสธ ให้รายงานกลับทันที ห้ามพยายาม绕过
  - ทำงานผ่าน branch: ci/chai-test-gate-and-host-path-decouple แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง ci/chai-test-gate-and-host-path-decouple ชัดเจน
  2) แนบ diff ของ release-validation.yml และยืนยันว่ามี step รันเทสต์ของทั้งสอง package
  3) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  4) node --test test/ (เฉพาะไฟล์ที่แตะ) → ผ่านทุกข้อ พร้อมระบุชื่อไฟล์และจำนวนข้อ
  5) npm test ใน artifacts/api-server → เทียบตัวเลข pass/fail กับ baseline 775/775/0 ปัจจุบัน (ทั้งกรณีมีและไม่มีไฟล์ credentials บนโฮสต์ ถ้าทำได้)
  6) ยืนยันว่าพฤติกรรม Production เดิมไม่เปลี่ยน: เมื่อไม่ตั้ง env ตัวแปร path ยังชี้ค่าเดิม

OUTPUT:
  - .github/workflows/release-validation.yml
  - artifacts/api-server/src/lib/ai-cost-tracker.ts
  - artifacts/api-server/src/lib/portfolio.ts

STOP:
  - เมื่อ typecheck ผ่าน 0 errors เทสต์ผ่านครบ และ CI step ถูกเพิ่มครบทั้งสอง package
  - หรือเมื่อทำงานครบ 40 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ + สิ่งที่เหลือ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | CI gate + decouple 2 จุด |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 3 ไฟล์ ตรวจแล้วมีจริง |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามลบเทสต์ ห้ามแตะ frontend |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | มีคำสั่งและ baseline 775/775 |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ผลลัพธ์ |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 40 turns |
| 7 | SCOPE path มีอยู่จริง | ผ่าน | ตรวจครบ |
| 8 | ระบุความเสี่ยง workflow token | ผ่าน | มีข้อให้รายงานกลับ |
| 9 | ห้ามแตะ frontend/CSS | ผ่าน | ระบุชัดเจน |
| 10 | มี branch name ชัดเจน | ผ่าน | ci/chai-test-gate-and-host-path-decouple |
| 11 | มี baseline ตัวเลข | ผ่าน | 775/775/0 |
| 12 | เป็นมิตรกับระบบ CI/CD | ผ่าน | เป็นหัวใจของใบงานนี้ |

---

## 📌 ข้อมูลที่เดวิดตรวจพบแล้ว
* ไฟล์ CI ปัจจุบัน `.github/workflows/release-validation.yml` มีเพียง 2 step: `bash deploy/hostinger/check-upload-files.sh` และ `check-upload-files.test.sh` — **ไม่มี typecheck และไม่มี unit test** ดังนั้นการตรวจจะเพิ่มทั้ง typecheck และ test ได้ตามดุลพินิจ (ถ้าเพิ่ม typecheck ให้รัน `pnpm run typecheck` ตามสคริปต์ของ repo)
* ตำแหน่ง path บนโฮสต์ที่ต้อง decouple:
  * `artifacts/api-server/src/lib/ai-cost-tracker.ts` ~บรรทัด 135 → `/opt/data/cron/usage_audit.jsonl`
  * `artifacts/api-server/src/lib/portfolio.ts` ~บรรทัด 32 → `/opt/data/knight-design-kb/portfolio_featured.json` (ปัจจุบันมี env `PORTFOLIO_FEATURED_KB_PATH` อยู่แล้วบางส่วน ให้ตรวจและทำให้ครบถ้วนสม่ำเสมอ)
* แนวทางที่ใช้ได้ผลแล้วใน Job 201: ใช้ env switch/override และให้เทสต์ตั้งค่าเอง ไม่แก้ business logic
