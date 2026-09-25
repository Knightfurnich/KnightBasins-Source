# ใบงานที่ 23 (ชัย) — ทีมช่างจัดการได้จากแอดมิน · Backend

ส่งเป็นสตริงเดียวเข้า `sh bin/chai.sh "<ใบงาน>"` — ข้อความในบล็อกข้างล่างนี้คือใบงานเต็ม

```
GOAL      : ย้ายรายชื่อทีมช่างจากค่าคงที่ในโค้ดไปเป็นตาราง technician_teams บน DB
            และเปิด API ให้แอดมินเพิ่ม/แก้/ปิดใช้งานทีมเอง โดยตัวจับคู่ทีมจากข้อความ
            (matchedTechnicianTeamCode) + ปฏิทิน + dashboard + การตรวจรหัสทีม
            ต้องอ่านจาก DB ทั้งหมด และพฤติกรรมเหมือนเดิม 100% กับ 10 ทีมปัจจุบัน

SCOPE     : /opt/data/cache/kbsrc/deploy/hostinger/migrations/012_technician_teams.sql  (ใหม่)
            /opt/data/cache/kbsrc/lib/db/src/schema/index.ts
            /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
            /opt/data/cache/kbsrc/lib/api-spec/openapi.yaml
            /opt/data/cache/kbsrc/artifacts/api-server/test/admin-technician-teams.test.ts  (ใหม่)
            /opt/data/cache/kbsrc/artifacts/api-server/test/admin-dashboard-stats.test.ts
            /opt/data/cache/kbsrc/artifacts/api-server/test/admin-technician-calendar.test.ts  (ไฟล์ที่ 7 — ขยาย SCOPE แล้ว)
            อ่านได้ (ห้ามแก้): /opt/data/knight-design-kb/qa/job-23-chai-technician-teams-spec.md

FORBIDDEN : ห้ามแตะ artifacts/knight-basins/** (ของ Replit)
            ห้ามแตะ layout/ตาราง/CSS ใบเสนอราคา
            ห้ามรัน migration บน production เอง (เดวิดรันหลัง review)
            ห้าม DELETE แถวทีม — ใช้ active=false เท่านั้น
            ห้ามแก้ชื่อ/alias ของ 10 ทีมใน seed ให้ต่างจากสเปกแม้ตัวเดียว
            ห้าม push เข้า main — เปิด PR เท่านั้น

EVIDENCE  : 1) npx pnpm run typecheck จาก root -> 0 errors   (ในเชลล์นี้ไม่มี pnpm ตรง ๆ ต้องใช้ npx pnpm)
            2) cd artifacts/api-server && npm test -> ระบุ tests/pass/fail
               (4 fail เดิมจาก sandbox ยอมรับได้: leads-persistence, support-profile, support-route x2)
            3) curl จริง 11 ข้อตาม ACCEPTANCE ด้านล่าง -> แนบ HTTP code + response ของทุกข้อ
            4) git diff --stat -> ไฟล์ที่แก้มือต้องมีแค่ 7 ไฟล์ตาม SCOPE
               บวกไฟล์ generated จาก codegen (lib/api-zod, lib/api-client-react) ที่เกิดจากข้อ 6
               — ไฟล์ generated นับเพิ่มได้ แต่ห้ามแก้มือ

OUTPUT    : ลิงก์ PR + branch · ตาราง endpoint/สิทธิ์/HTTP code ที่ทดสอบได้ ·
            ผล typecheck + ผลเทสต์ (ตัวเลขจริง) · ระบุบรรทัดที่แก้ใน admin-router.ts

STOP      : หยุดแล้วรายงานทันทีถ้า (ก) typecheck ไม่ผ่านแก้ไม่ได้ใน 1 รอบ
            (ข) เทสต์เดิมพังเกิน 4 ตัว (ค) ใกล้ชนเพดานรอบ
            ห้ามเดาต่อ ห้ามแก้อะไรเพื่อให้ผ่าน

BRANCH    : feat/chai-technician-teams-table

CONTRACT (ทำตามนี้ ไม่ต้องเดา):

1) Migration deploy/hostinger/migrations/012_technician_teams.sql
   CREATE TABLE IF NOT EXISTS public.technician_teams (
     id         serial PRIMARY KEY,
     code       varchar(8)  NOT NULL UNIQUE,
     name       varchar(80) NOT NULL,
     short_name varchar(40) NOT NULL,
     aliases    jsonb       NOT NULL DEFAULT '[]'::jsonb,
     sort_order integer     NOT NULL DEFAULT 0,
     active     boolean     NOT NULL DEFAULT true,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   );
   CREATE INDEX IF NOT EXISTS technician_teams_active_sort_idx
     ON public.technician_teams (active, sort_order, code);
   INSERT ... ON CONFLICT (code) DO NOTHING;  -- seed 10 ทีมตามตารางข้อ 2

2) Seed 10 ทีม (code, name, short_name, aliases, sort_order) — ต้องตรงเป๊ะ
   TP ช่างยี่   ยี่    ["แอนนี่"]                     10
   PP ช่างเนตร  เนตร  []                             20
   ST ช่างทู    ทู     []                             30
   CM ช่างเจมส์ เจมส์  []                             40
   KF ทีมโรงงาน โรงงาน ["ออฟฟิศ","ออฟฟิต"]          50
   PA ช่างเปา   เปา    []                             60
   PM ช่างพร้อม พร้อม  []                             70
   TJ ช่างกอล์ฟ กอล์ฟ  []                             80
   AM ช่างเจ๋ง  เจ๋ง   []                             90
   CL ช่างชัยยา ชัยยา  []                            100
   KF ต้องมี 2 alias (ในแชตเขียน ต/ศ ปนกัน)
   ⚠️ alias ต้องเก็บ "ไม่มีคำว่า ทีม/ช่าง นำหน้า" — เก็บเป็น "ออฟฟิศ" ไม่ใช่ "ทีมออฟฟิศ"
      เหตุผล: ตัวจับคู่จะประกอบคำนำหน้าเอง ทำให้รองรับทั้ง "ทีมออฟฟิศ" "ช่างออฟฟิศ" "ออฟฟิศ"
      และเข้ากับตัวจับคู่แบบตัดคำของใบงาน 25 ที่จะตามมาทีหลัง (ถ้าเก็บมีคำนำหน้า จะต้อง migrate ข้อมูลทิ้ง)
   ห้ามใส่ alias คำลอย ๆ เช่น "โรงงาน" เดี่ยว ๆ — เคยไปแมตช์
   "ไปรับแผ่นสีน้ำเงินโรงงานพี่อ้วน" ซึ่งเป็นธุระ ไม่ใช่งานติดตั้ง

3) Drizzle model ท้าย lib/db/src/schema/index.ts
   technicianTeams = pgTable("technician_teams", { id, code, name, shortName,
   aliases jsonb.$type<string[]>().notNull().default([]), sortOrder, active,
   ...auditColumns }, (table) => [ index("technician_teams_active_sort_idx")
   .on(table.active, table.sortOrder, table.code) ])

4) admin-router.ts
   - เปลี่ยนชื่อค่าคงที่เดิมเป็น SEED_TECHNICIAN_TEAMS (export) และคงค่าไว้เป็น default
   - computeTechnicianCapacity(leads, now, teams = SEED_TECHNICIAN_TEAMS)
   - matchedTechnicianTeamCode(text, teams = SEED_TECHNICIAN_TEAMS)
     -> ใส่ default ทั้งคู่ เพื่อเทสต์เดิมที่เรียก 2 อาร์กิวเมนต์ไม่พัง
   - เพิ่ม loadTechnicianTeams(includeInactive=false) อ่านจาก DB เรียง sort_order, code
     ถ้าตารางว่างให้คืน SEED_TECHNICIAN_TEAMS (กันระบบพัง)
   - ตัวจับคู่ (matchedTechnicianTeamCode) ต้องเช็ค 3 รูปต่อ 1 ชื่อ/alias:
     รูปเดี่ยว, "ทีม"+คำ, "ช่าง"+คำ   — เพราะ alias เก็บแบบไม่มีคำนำหน้า
     ตัวอย่าง: alias "ออฟฟิศ" ต้องจับได้ทั้ง "ทีมออฟฟิศ" "ทีมออฟฟิต" "ช่างออฟฟิศ"
   - จุดที่ต้องเปลี่ยนมาใช้ loadTechnicianTeams():
       dashboard technicianCapacity · GET /admin/technician-calendar ·
       PATCH /admin/leads/:id/technician ตอนตรวจรหัสทีม
   - PATCH /admin/leads/:id/technician ยอมรับรหัสที่มีในตารางแม้ active=false

5) Endpoint ใหม่ 3 ตัว สิทธิ์ requireAdminPermission("leads","edit") ทั้งหมด
   GET   /admin/technician-teams  ?includeInactive=1
         200 -> [{ id, code, name, shortName, aliases, sortOrder, active }]
   POST  /admin/technician-teams
         body { code, name, shortName, aliases[], sortOrder }
         201 -> ทีมที่สร้าง
   PATCH /admin/technician-teams/:id
         body { name?, shortName?, aliases?, sortOrder?, active? }  (แก้ code ไม่ได้)
         200 -> ทีมที่แก้
   ไม่มี DELETE โดยเจตนา — "ลดทีม" ใช้ PATCH { active: false }

6) openapi.yaml
   - ลบ enum [TP,PP,ST,CM,KF,PA,PM,TJ,AM,CL,null] ของ technicianTeamCode
     เปลี่ยนเป็น type [string,"null"] + pattern "^[A-Z]{2,8}$"
   - เพิ่ม 3 paths + schema TechnicianTeam / TechnicianTeamCreateInput /
     TechnicianTeamUpdateInput
   - รัน npx pnpm run --filter @workspace/api-spec codegen แล้ว commit ไฟล์ generated ด้วย
     (ไฟล์ generated นับเพิ่มจาก 6 ไฟล์ใน SCOPE ได้ — ข้อนี้ชนะข้อจำกัดจำนวนไฟล์)

หมายเหตุจากเดวิด (รอบก่อนทำไปแล้ว 2 ไฟล์ — ตรวจว่าถูกต้องแล้วไปต่อได้เลย):
  - deploy/hostinger/migrations/012_technician_teams.sql  เขียนแล้ว (ยังไม่รัน — เดวิดรันเอง)
  - lib/db/src/schema/index.ts  เพิ่ม technicianTeams แล้ว
  - รอบก่อนหยุดเพราะ admin-technician-calendar.test.ts ไม่อยู่ใน SCOPE — เดวิดขยาย SCOPE แล้ว (ไฟล์ที่ 7)

การแก้ fake db ใน admin-technician-calendar.test.ts (ทำแบบตรงไปตรงมา ห้ามกลบด้วย try/catch):
  - createFakeCalendarDatabase(): .from() ต้องแยกตามชื่อตาราง — ถ้าเป็น technician_teams ให้คืนแถวทีม
    (id, code, name, short_name, aliases, sort_order, active) ไม่ใช่ lead rows
  - createFakeLeadDatabase(): เพิ่มเมธอด .select ที่คืน team rows สำหรับ technician_teams
  - เป้าหมาย: เทสต์ทั้ง 16 ตัวในไฟล์นั้นต้องผ่านเหมือนเดิม ไม่ใช่ถูกปิด

ACCEPTANCE (curl จริงทุกข้อ แนบ HTTP code + response):
   1  GET  /admin/technician-teams                          -> 200, 10 ทีม เรียงตาม sortOrder
   2  POST code "TP" (ซ้ำ)                                  -> 400
   3  POST code "tp" (พิมพ์เล็ก)                            -> 400
   4  POST code "NK" ชื่อครบ                                -> 201
   5  PATCH /:id เปลี่ยนชื่อ NK -> "ช่างใหม่2"              -> 200, ชื่อใหม่
   6  PATCH /:id ด้วย {}                                    -> 400
   7  PATCH /:id ของ id ที่ไม่มี                            -> 404
   8  PATCH { active:false } แล้ว GET ปกติ                  -> ตัวนั้นหายจากลิสต์
   9  GET ?includeInactive=1                                -> เห็นตัวที่ปิดใช้งานกลับมา
  10  PATCH /admin/leads/:id/technician ด้วยรหัสที่ไม่มีในตาราง -> 400
  11  ยิงทั้งหมดโดยไม่มีสิทธิ์                              -> 403
```
