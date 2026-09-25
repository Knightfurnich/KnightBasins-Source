# ใบงานที่ 23 — ทีมช่างจัดการได้จากแอดมิน (Backend)

**ผู้รับ:** ชัย (programmer) · **ผู้ออกใบงาน:** เดวิด · **วันที่:** 24 ก.ย. 2569
**Branch ที่ต้องสร้าง:** `feat/chai-technician-teams-table`

---

## GOAL

ย้ายรายชื่อทีมช่างติดตั้งจาก "ค่าคงที่ในโค้ด" มาเป็น "ข้อมูลในฐานข้อมูล" และเปิด API
ให้แอดมินเพิ่ม / แก้ชื่อ / ปิดใช้งานทีมได้เอง โดยที่

1. ตัวจับคู่ทีมจากข้อความ (`matchedTechnicianTeamCode`) อ่านรายชื่อจาก DB
2. ปฏิทินคิวช่าง + dashboard อ่านรายชื่อจาก DB
3. `PATCH /admin/leads/:id/technician` ตรวจรหัสทีมกับ DB ไม่ใช่ค่าคงที่
4. **พฤติกรรมต้องเหมือนเดิม 100%** กับรายชื่อ 10 ทีมปัจจุบัน (seed ตรงกับ `knight-design-kb/TEAM.md` §4)

---

## SCOPE (แตะได้เฉพาะไฟล์เหล่านี้)

| # | ไฟล์ | การแก้ |
|---|---|---|
| 1 | `deploy/hostinger/migrations/012_technician_teams.sql` | ใหม่ — สร้างตาราง + seed 10 ทีม |
| 2 | `lib/db/src/schema/index.ts` | เพิ่ม `technicianTeams` (drizzle) |
| 3 | `artifacts/api-server/src/routes/admin-router.ts` | 3 endpoint ใหม่ + อ่านรายชื่อจาก DB |
| 4 | `lib/api-spec/openapi.yaml` | paths/schemas ใหม่ + ลบ enum ที่ฝังรหัสทีม |
| 5 | `artifacts/api-server/test/admin-technician-teams.test.ts` | ใหม่ |
| 6 | `artifacts/api-server/test/admin-dashboard-stats.test.ts` | แก้เฉพาะที่ signature เปลี่ยน |

---

## FORBIDDEN

- ห้ามแตะ `artifacts/knight-basins/**` (เป็นงานของ Replit — ใบงานที่ 24)
- ห้ามแตะ layout / ตาราง / CSS ของใบเสนอราคา (`App.tsx` ส่วน formal-*, `index.css` ส่วน print)
- **ห้ามรัน migration บน production เอง** — เดวิดรันหลัง review ผ่าน
- **ห้าม `DELETE` แถวทีมออกจาก DB** — ใช้ `active = false` เท่านั้น (งานเก่าต้องยังอ้างรหัสเดิมได้)
- ห้ามแก้ชื่อ/รหัส/alias ของ 10 ทีมในไฟล์ seed ให้ต่างจากตารางด้านล่างแม้แต่ตัวเดียว
- ห้าม push เข้า `main` ตรง ๆ — เปิด PR เท่านั้น

---

## EVIDENCE (แนบผลรันจริงทุกข้อ ห้ามเขียนคำรับรองลอย ๆ)

1. `pnpm run typecheck` จาก root → ต้อง 0 errors
2. `cd artifacts/api-server && npm test` → ระบุ `tests / pass / fail`
   (4 fail ที่มีอยู่เดิมจาก sandbox — leads-persistence, support-profile, support-route ×2 — ยอมรับได้)
3. curl จริงทุกข้อในตาราง Acceptance ด้านล่าง → แนบ HTTP code + response
4. `git diff --stat` → ต้องมีแค่ 6 ไฟล์ใน SCOPE

---

## OUTPUT

- ลิงก์ PR + branch
- ตารางสรุป: endpoint / สิทธิ์ / request / response / HTTP code ที่ทดสอบได้
- ผล typecheck + ผลเทสต์ (ตัวเลขจริง)
- ระบุว่าแก้บรรทัดไหนของ `admin-router.ts`

---

## STOP

หยุดแล้วรายงานทันทีถ้า:
- typecheck ไม่ผ่าน และแก้ไม่ได้ใน 1 รอบ
- เทสต์เดิมพังเกิน 4 ตัว (แปลว่าแก้พฤติกรรมเดิม)
- รู้สึกว่าใกล้ชนเพดานรอบ → รายงานสิ่งที่เสร็จ + ที่เหลือ ดีกว่าไล่ทำจนผลหาย

---

# สเปกละเอียด (ทำตามนี้ได้เลย ไม่ต้องถามกลับ)

## 1 · Migration `deploy/hostinger/migrations/012_technician_teams.sql`

```sql
-- Admin-managed roster of the install teams shown in the Technician Dispatch
-- Calendar. Until now the 10 teams lived as a constant inside the API and the
-- web bundle, so adding or retiring a team meant a code change plus a deploy.

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

INSERT INTO public.technician_teams (code, name, short_name, aliases, sort_order) VALUES
  ('TP', 'ช่างยี่',   'ยี่',    '["แอนนี่"]'::jsonb,                 10),
  ('PP', 'ช่างเนตร',  'เนตร',  '[]'::jsonb,                          20),
  ('ST', 'ช่างทู',    'ทู',     '[]'::jsonb,                          30),
  ('CM', 'ช่างเจมส์', 'เจมส์',  '[]'::jsonb,                          40),
  ('KF', 'ทีมโรงงาน', 'โรงงาน', '["ทีมออฟฟิศ", "ทีมออฟฟิต"]'::jsonb,   50),
  ('PA', 'ช่างเปา',   'เปา',    '[]'::jsonb,                          60),
  ('PM', 'ช่างพร้อม', 'พร้อม',  '[]'::jsonb,                          70),
  ('TJ', 'ช่างกอล์ฟ', 'กอล์ฟ',  '[]'::jsonb,                          80),
  ('AM', 'ช่างเจ๋ง',  'เจ๋ง',   '[]'::jsonb,                          90),
  ('CL', 'ช่างชัยยา', 'ชัยยา',  '[]'::jsonb,                         100)
ON CONFLICT (code) DO NOTHING;
```

**ทำไม KF มี 2 alias:** ในกลุ่ม LINE เขียนทั้ง "ทีมโรงงาน", "ทีมออฟฟิศ" และ "ทีมออฟฟิต" (ต กับ ศ ปนกัน)
ถ้าใส่ไม่ครบ งานของ KF จะหายจากปฏิทิน

**ทำไมห้าม alias คำลอย ๆ:** เคยลองใส่ `"โรงงาน"` เดี่ยว ๆ แล้วไปแมตช์ข้อความ
"ไปรับแผ่นสีน้ำเงินโรงงานพี่อ้วน" ซึ่งเป็นธุระ ไม่ใช่งานติดตั้ง — alias ต้องเป็นวลีเต็มของทีมเท่านั้น

## 2 · Drizzle model — เพิ่มท้าย `lib/db/src/schema/index.ts`

```ts
export const technicianTeams = pgTable(
  "technician_teams",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 8 }).notNull().unique(),
    name: varchar("name", { length: 80 }).notNull(),
    shortName: varchar("short_name", { length: 40 }).notNull(),
    aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...auditColumns,
  },
  (table) => [
    index("technician_teams_active_sort_idx").on(table.active, table.sortOrder, table.code),
  ],
);
```

## 3 · แก้ `admin-router.ts` — รายชื่อทีม

**คงของเดิมไว้เป็น seed/ค่าเริ่มต้น เพื่อไม่ให้เทสต์เดิมพัง** แล้วเปลี่ยนชื่อตัวแปร:

```ts
/** Seed roster. The live roster now comes from `technician_teams`; this constant
 *  is the default for unit tests and the fallback if the table is empty. */
export const SEED_TECHNICIAN_TEAMS: TechnicianTeam[] = [
  { code: "TP", name: "ช่างยี่",   shortName: "ยี่",    aliases: ["แอนนี่"] },
  { code: "PP", name: "ช่างเนตร",  shortName: "เนตร",  aliases: [] },
  { code: "ST", name: "ช่างทู",    shortName: "ทู",     aliases: [] },
  { code: "CM", name: "ช่างเจมส์", shortName: "เจมส์",  aliases: [] },
  { code: "KF", name: "ทีมโรงงาน", shortName: "โรงงาน", aliases: ["ทีมออฟฟิศ", "ทีมออฟฟิต"] },
  { code: "PA", name: "ช่างเปา",   shortName: "เปา",    aliases: [] },
  { code: "PM", name: "ช่างพร้อม", shortName: "พร้อม",  aliases: [] },
  { code: "TJ", name: "ช่างกอล์ฟ", shortName: "กอล์ฟ",  aliases: [] },
  { code: "AM", name: "ช่างเจ๋ง",  shortName: "เจ๋ง",   aliases: [] },
  { code: "CL", name: "ช่างชัยยา", shortName: "ชัยยา",  aliases: [] },
];
```

`computeTechnicianCapacity(leads, now, teams = SEED_TECHNICIAN_TEAMS)` — เพิ่มพารามิเตอร์ที่ 3
**มี default** เพื่อให้เทสต์เดิมเรียกแบบ 2 อาร์กิวเมนต์ได้เหมือนเดิม

`matchedTechnicianTeamCode(text, teams = SEED_TECHNICIAN_TEAMS)` — เพิ่มพารามิเตอร์เช่นกัน

เพิ่มตัวโหลดรายชื่อจาก DB (ใช้ซ้ำทุกที่):

```ts
async function loadTechnicianTeams(includeInactive = false): Promise<TechnicianTeam[]> {
  const rows = await database
    .select()
    .from(technicianTeams)
    .where(includeInactive ? undefined : eq(technicianTeams.active, true))
    .orderBy(technicianTeams.sortOrder, technicianTeams.code);
  if (rows.length === 0) return SEED_TECHNICIAN_TEAMS;   // กันระบบพังถ้าตารางว่าง
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    shortName: row.shortName,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
  }));
}
```

**จุดที่ต้องเปลี่ยนมาใช้ `loadTechnicianTeams()`**
- `computeTechnicianCapacity(...)` ตอนประกอบ `technicianCapacity` ของ dashboard
- ปฏิทินคิวช่าง (`GET /admin/technician-calendar`) ตอนสร้างรายชื่อทีมของแต่ละวัน
- `PATCH /admin/leads/:id/technician` ตอนตรวจ `technicianTeamCode`
  → **ยอมรับรหัสที่อยู่ในตารางแม้ `active = false`** (งานเก่ายังต้องแก้ได้) แต่ dropdown จะเสนอเฉพาะ active

## 4 · Endpoint ใหม่ 3 ตัว

ทั้งหมดใช้ `requireAdminPermission("leads", "edit")`

```
GET /api/admin/technician-teams?includeInactive=1
  200 → [{ "id": 1, "code": "TP", "name": "ช่างยี่", "shortName": "ยี่",
           "aliases": ["แอนนี่"], "sortOrder": 10, "active": true }]

POST /api/admin/technician-teams
  body { "code": "NK", "name": "ช่างใหม่", "shortName": "ใหม่",
         "aliases": ["ทีมใหม่"], "sortOrder": 110 }
  201 → { ...ทีมที่สร้าง }
  400 → code ไม่ตรง ^[A-Z]{2,8}$ | code ซ้ำ | name ว่าง | shortName ว่าง
  403 → ไม่มีสิทธิ์ leads:edit

PATCH /api/admin/technician-teams/:id
  body { "name"?, "shortName"?, "aliases"?, "sortOrder"?, "active"? }   // ห้ามแก้ code
  200 → { ...ทีมที่แก้ }
  400 → ไม่ส่งฟิลด์ใดเลย | name ว่าง | aliases ไม่ใช่ array ของ string
  404 → ไม่พบ id
```

หมายเหตุ: ไม่มี `DELETE` โดยเจตนา — "ลดทีม" ทำด้วย `PATCH { "active": false }`
เพื่อให้งานเก่ายังอ้างรหัสเดิมได้ ไม่พังย้อนหลัง

## 5 · Acceptance ที่ต้อง curl จริง

| # | ยิงอะไร | ต้องได้ |
|---|---|---|
| 1 | `GET /admin/technician-teams` | 200 + 10 ทีม เรียงตาม sortOrder |
| 2 | `POST` ด้วย code `"TP"` (ซ้ำ) | 400 |
| 3 | `POST` ด้วย code `"tp"` (พิมพ์เล็ก) | 400 (บังคับ A-Z) |
| 4 | `POST` ด้วย code `"NK"` ชื่อครบ | 201 |
| 5 | `PATCH /:id` เปลี่ยนชื่อ `NK` → `"ช่างใหม่2"` | 200 + ชื่อใหม่ |
| 6 | `PATCH /:id` ด้วย `{}` | 400 |
| 7 | `PATCH /:id` ของ id ที่ไม่มี | 404 |
| 8 | `PATCH { "active": false }` แล้ว `GET` | ตัวนั้นหายจากลิสต์ปกติ |
| 9 | `GET ?includeInactive=1` | เห็นตัวที่ปิดใช้งานกลับมา |
| 10 | `PATCH /admin/leads/:id/technician` ด้วยรหัสที่ไม่มีในตาราง | 400 |
| 11 | ยิงทั้งหมดโดยไม่มีสิทธิ์ | 403 |

## 6 · `openapi.yaml`

- ลบ `enum: [TP, PP, ST, CM, KF, PA, PM, TJ, AM, CL, null]` ออก (รายชื่อทีมเป็นข้อมูล ไม่ใช่ค่าคงที่แล้ว)
  เปลี่ยนเป็น `type: [string, "null"]` + `pattern: "^[A-Z]{2,8}$"` และอัปเดต description ว่า
  ต้องเป็นรหัสที่มีอยู่ใน `GET /admin/technician-teams`
- เพิ่ม 3 paths ใหม่ + schema `TechnicianTeam`, `TechnicianTeamCreateInput`, `TechnicianTeamUpdateInput`
- รัน `pnpm run --filter @workspace/api-spec codegen` แล้ว commit ไฟล์ generated ด้วย
