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

## 3. `deploy.yml` sync แค่ `web-dist`/`api-dist` เท่านั้น — ไม่เคยแตะโฟลเดอร์ `deploy/hostinger/` เอง

ถ้าแก้ไฟล์ในโฟลเดอร์นี้ (`migrate.sh`, `backup.sh`, README, ฯลฯ) ต้อง sync ขึ้น VPS ด้วยมือทุกครั้ง — วิธีทำมีเขียนไว้แล้วใน [`deploy/hostinger/README.md`](deploy/hostinger/README.md) หัวข้อ "deploy/hostinger itself is never auto-synced"

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
