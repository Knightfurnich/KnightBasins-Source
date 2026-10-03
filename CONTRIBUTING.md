# กฎการทำงานกับ repo นี้

อ่านก่อนแตะ deploy/migration/backup ทุกครั้ง — เขียนขึ้นจากปัญหาจริงที่เจอในเซสชันแก้ไข production เมื่อ 2026-09-21 ไม่ใช่คำแนะนำทั่วไป

## 1. ห้ามรายงานผลที่ยังไม่ได้ตรวจสอบจริงเด็ดขาด

เคยเจอ `restore-check.sh` เวอร์ชันหนึ่งที่ print `"=== RESTORE CHECK PASSED 100% ==="` แบบไม่มีเงื่อนไข ไม่ว่าจะ restore สำเร็จจริงหรือไม่ (มี `|| true` และ `2>/dev/null` ปิด error ไว้ทุกจุด)

ก่อนบอกว่า "สำเร็จแล้ว / deploy แล้ว / ทดสอบผ่านแล้ว" ต้องมีหลักฐานจริงประกอบเสมอ:
- SSH เข้าไปเช็คไฟล์/timestamp ตรงบนเซิร์ฟเวอร์ ไม่ใช่แค่ดู CI ขึ้น ✓ เขียว
- `curl` ตรงจากภายนอก ไม่ใช้ browser cache (browser cache หลอกได้ — เจอเองมาแล้ว)
- grep หาข้อความ/hash จริงในไฟล์ที่ deploy แล้ว

ตัวอย่างจริง: CI ของ repo นี้ขึ้น ✓ เขียวมาตลอดหลายวัน แต่ไฟล์ไปตกอยู่ผิด path เพราะ `strip_prefix` ไม่ใช่ parameter ที่ใช้ได้จริงกับ `appleboy/scp-action@v0.1.7` — เว็บจริงรันโค้ดเก่าค้างอยู่โดยไม่มีใครรู้ (แก้แล้วที่ commit `9585c50`)

## 2. ห้าม push script ที่กระทบ deploy/backup ตรงเข้า `main` โดยไม่ผ่านตาคนรีวิว

โดยเฉพาะ `deploy/hostinger/migrate.sh`, `backup.sh`, `restore-check.sh`, `.github/workflows/deploy.yml` — เคยมีการเขียนทับ `restore-check.sh` ด้วยเวอร์ชันปลอม (ข้อ 1) มาแล้วครั้งหนึ่งจากการ push แบบไม่มีคนรีวิว

## 3. `deploy.yml` sync แค่ `web-dist`/`api-dist` + migrations เท่านั้น — ไม่เคยแตะไฟล์อื่นในโฟลเดอร์ `deploy/hostinger/` เอง

ตั้งแต่ Job 224 (`deploy.yml`, 3 ต.ค. 69) workflow จะคัดลอก `deploy/hostinger/migrations/*.sql` ขึ้น VPS แล้วรัน `migrate.sh` ให้อัตโนมัติก่อน restart container — **แต่ยังไม่ sync ไฟล์อื่นในโฟลเดอร์นี้**

ถ้าแก้ไฟล์อื่นในโฟลเดอร์นี้ (`migrate.sh`, `backup.sh`, `restore-check.sh`, README, ฯลฯ) ต้อง sync ขึ้น VPS ด้วยมือทุกครั้ง — วิธีทำมีเขียนไว้แล้วใน [`deploy/hostinger/README.md`](deploy/hostinger/README.md) หัวข้อ "deploy/hostinger itself is never auto-synced"

⚠️ **ข้อควรระวังที่เจอจริง (3 ต.ค. 69):** `migrate.sh` ที่ workflow เรียกใช้คือไฟล์ที่อยู่บน VPS แล้ว ไม่ได้คัดลอกจาก repo ทุกครั้ง — ถ้าแก้ `migrate.sh` ใน repo ต้องอัปโหลดขึ้น VPS เองด้วย ไม่งั้น workflow จะรันเวอร์ชันเก่าบนเซิร์ฟเวอร์

## 3.1 แก้ `.env` แล้ว `docker restart` ไม่พอ — ต้อง recreate container

Docker อ่าน `env_file` **ตอนสร้าง container เท่านั้น** (`docker restart` หรือ `docker compose restart` ไม่อ่านใหม่) ตัวแปรที่เพิ่มเข้า `.env` หลัง container ถูกสร้างจะไม่เข้าไปอยู่ในโปรเซสเลย

- เจอจริง 3 ต.ค. 69: `KNIGHT_FURNICH_BANK_NAME` / `KNIGHT_FURNICH_BANK_ACCOUNT_NUMBER` อยู่ใน `.env` บน VPS แต่ใน container ไม่มี ทำให้ API ตอบ `bankName: null`
- **วิธีที่ถูก:** `cd /docker/knightbasins && docker compose up -d --force-recreate api` (หรือชื่อ service ที่ต้องการ)
- สคริปต์ deploy ของทีม (`bin/deploy_api.py`) ใช้ `--force-recreate` แล้ว เพื่อไม่ให้เกิดปัญหาซ้ำ
- เช็คผลได้ด้วย `docker exec <container> env | grep <VAR_NAME>` (ไม่ต้อง echo ค่าออกมา)

## 4. Migration file ใหม่ต้อง `git commit` ทันทีที่เขียนเสร็จ อย่ารอ

เคยเจอ migration 002-004 ค้าง uncommitted อยู่หลายวันในเครื่องคนหนึ่ง — ถ้าเครื่องนั้นมีปัญหา ประวัติการแก้ตาราง production จะหายไปเลย และคนอื่นจะไม่รู้ด้วยว่า schema ถูกแก้แล้ว รายละเอียดขั้นตอน migration ดูที่ [`deploy/hostinger/README.md`](deploy/hostinger/README.md) หัวข้อ "Applying schema migrations"

## 5. แก้ไฟล์ `.sh` บน Windows ต้องระวัง CRLF

`core.autocrlf=true` แปลง LF→CRLF อัตโนมัติตอน checkout ทำให้ `bash script.sh` พังด้วย error แปลกๆ บน Linux เช่น `set: pipefail: invalid option name` — ก่อน upload ให้ดึงจาก git blob ตรง ไม่ใช้ไฟล์ใน working tree ตรงๆ:

```bash
git show HEAD:deploy/hostinger/migrate.sh > /tmp/migrate.sh
# upload /tmp/migrate.sh ไปแทน deploy/hostinger/migrate.sh ตรงๆ
```

## 6. ห้ามใส่ credential/password ในไฟล์ที่ commit เข้า repo นี้เด็ดขาด

- ใช้ `.claude/settings.local.json` (gitignore ไว้แล้ว) สำหรับ permission/setting เฉพาะเครื่อง
- `.claude/settings.json` (ไม่มี `.local`) commit ได้ ใช้สำหรับตั้งค่าที่ตั้งใจแชร์ทั้งทีมเท่านั้น ห้ามใส่ secret
- credential ของ production (VPS password, DB URL, API key) เก็บไว้นอก repo นี้เท่านั้น

## 7. รันเทสต์เทียบ CI ต้องตัด `*.browser.test.ts` ออก

CI (`.github/workflows/release-validation.yml`) รันเฉพาะ `*.test.ts` ที่ไม่ใช่ browser test:

```bash
# ใน artifacts/api-server หรือ artifacts/knight-basins
files=$(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort)
node --experimental-strip-types --test $files
```

`npm test` เปล่า ๆ จะรัน browser suites ด้วย ซึ่งจะตกเพราะไม่มี Chromium/dev server — **ตัวเลขที่ได้จะไม่ตรงกับ CI** ให้ใช้คำสั่งข้างบนเสมอเวลาจะเทียบ baseline

## 8. เปลี่ยนเลขรุ่นล่าสุดใน `/updates` ต้องอัปเดต `llms.txt` + `llms-full.txt` ด้วยทุกครั้ง

`test/llms-txt-content-integrity.test.ts` บังคับว่าไฟล์สำหรับ AI crawler (`public/llms.txt`, `public/llms-full.txt`) ต้องระบุเลขรุ่นล่าสุดให้ตรงกับ `UpdatesPage.tsx` ไม่งั้น CI จะแดงด้วยข้อความ `llms.txt does not mention vX.Y.Z`

แก้ที่ต้องทำพร้อมกัน 3 จุด:
1. `src/pages/UpdatesPage.tsx` — เพิ่มบล็อกรุ่นใหม่บนสุดของ `UPDATE_RELEASES`
2. `public/llms.txt` — ข้อความ "ล่าสุด vX.Y.Z" + บรรทัดสรุปในหัวข้อ "รุ่นล่าสุดของระบบ"
3. `public/llms-full.txt` — บรรทัดรุ่นใหม่บนสุดของหัวข้อ "ประวัติการอัปเดตและฟีเจอร์ใหม่"
