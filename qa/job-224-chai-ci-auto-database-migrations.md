# ใบงาน 224 (DevOps & CI/CD) — เชื่อมโยงระบบ Auto-Migration เข้าสู่ GitHub Actions Deploy Workflow

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI) · ภารกิจโครงสร้างพื้นฐาน DevOps
**Branch:** `feat/chai-ci-auto-database-migrations`
**ที่มา:** ปัจจุบันไฟล์ migration ใน `deploy/hostinger/migrations/*.sql` (เช่น 020 และ 021) ไม่ถูกนำไปรันบน VPS โดยอัตโนมัติ ทำให้เดวิดต้อง SSH เข้าไปรันมือทุกครั้ง ซึ่งเสี่ยงต่อการหลุดลืมเมื่อมีฐานข้อมูลใหม่ บอสสั่งให้ออกใบงานเชื่อมโยงขั้นตอนนี้เข้าสู่ GitHub Actions (`deploy.yml`) เพื่อให้รัน migration อัตโนมัติทุกครั้งที่มีการ deploy

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน .github/workflows/deploy.yml:
     - เพิ่มขั้นตอนการส่งไฟล์ Migration ขึ้น VPS ก่อนเริ่มขั้นตอน Restart Docker Containers:
       - ใช้อินสแตนซ์ appleboy/scp-action คัดลอกไฟล์ทั้งหมดจาก deploy/hostinger/migrations/*.sql ไปยัง /docker/knightbasins/deploy/hostinger/migrations/ บน VPS
     - ในขั้นตอน Restart Docker Containers (appleboy/ssh-action):
       - เพิ่มคำสั่งเรียกสคริปต์รัน migration แบบปลอดภัย:
         docker exec -i knightbasins-db sh -c 'for f in $(ls -1 /docker/knightbasins/deploy/hostinger/migrations/*.sql 2>/dev/null | sort); do psql -U knight_basins_app -d knight_basins -f "$f"; done'
         หรือเรียกสคริปต์ migrate.sh ที่มีอยู่เดิมบน VPS โดยตรงก่อน restart container
       - คำสั่ง migration ต้องเป็น idempotent (ใช้ CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS) เพื่อให้รันซ้ำได้ปลอดภัยเสมอ
  2. การทดสอบและเอกสาร:
     - ปรับปรุงคู่มือ deploy/hostinger/README.md ระบุว่า GitHub Actions deploy.yml ได้รวมขั้นตอน auto-migration เรียบร้อยแล้ว
     - ทดสอบ workflow syntax: ตรวจสอบความถูกต้องของ YAML schema

SCOPE:
  - .github/workflows/deploy.yml
  - deploy/hostinger/README.md

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามเขียนคำสั่ง migration แบบทำลายข้อมูล (DROP TABLE / TRUNCATE) เด็ดขาด
  - ห้ามเปลี่ยน secret keys หรือ host IP ใน deploy.yml
  - ห้ามแตะไฟล์ซอร์สโค้ดของแอปพลิเคชัน (artifacts/)

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-ci-auto-database-migrations ชัดเจน
  2) git diff main...HEAD -- .github/workflows/deploy.yml แสดงขั้นตอน copy migrations และ execute migrate ชัดเจน
  3) node -e "require('js-yaml')" หรือ npx yaml-lint .github/workflows/deploy.yml ตรวจสอบโครงสร้าง YAML → 0 errors (ระบุผลรันจริง)
  4) ตรวจจำนวนขั้นตอน (steps) ใน deploy.yml ก่อนและหลังแก้: baseline 6 steps → หลังแก้ต้องมี steps เพิ่มสำหรับ copy migrations และรัน migrate (ระบุตัวเลขจริง)
  5) รันคำสั่ง migrate.sh บน VPS ซ้ำ 2 ครั้ง (idempotent test) แล้วยืนยันว่าไม่มี error และจำนวนตารางไม่เปลี่ยน (ระบุผลรันจริง)
  6) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - .github/workflows/deploy.yml
  - deploy/hostinger/README.md

STOP:
  - เมื่อตรวจสอบไฟล์ YAML ถูกต้องและทดสอบการ push workflow สำเร็จ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | Auto-Migration ใน GitHub Actions deploy.yml |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 2 ไฟล์ชัดเจน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามลบข้อมูล, index.css 0 diff |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและผลตรวจจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (Claude CLI) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ทำระบบ Auto-Migration ตามภารกิจที่ 4 |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ใช้ Secrets เดิม ไม่เปิดเผย IP/Key |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 224 เรียบร้อย |
