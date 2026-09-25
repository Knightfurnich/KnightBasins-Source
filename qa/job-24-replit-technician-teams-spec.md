# ใบงานที่ 24 — หน้าจัดการทีมช่าง + dropdown จาก API (Frontend)

**ผู้รับ:** Replit · **ผู้ออกใบงาน:** เดวิด · **วันที่:** 24 ก.ย. 2569
**Branch ที่ต้องสร้าง:** `feat/replit-technician-teams-manager`

> ⚠️ ระบบนี้ใช้ **GitHub Connection เท่านั้น** — ห้ามรันคำสั่ง git ใน Terminal
> และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch + push ผ่าน GitHub Connection อัตโนมัติทันที
>
> ⚠️ ใบงานนี้เขียนสเปก API มาให้ครบแล้ว **ไม่ต้องถามกลับ** — ต่อกับ endpoint ตามที่ระบุได้เลย
> ฝั่ง backend (ชัย) ทำคู่ขนานกันไป ถ้า API ยังไม่ขึ้นให้ทำ UI ต่อได้เลย แล้วค่อยทดสอบตอน API merge

---

## GOAL

1. สร้างหน้าใหม่ **`/admin/technician-teams`** ให้แอดมินเพิ่ม / แก้ชื่อ / เปิด-ปิดใช้งานทีมช่างติดตั้ง
2. หน้า **ปฏิทินคิวช่าง** เลิกใช้รายชื่อทีมที่ฝังในโค้ด → ดึงจาก API

---

## SCOPE (แตะได้เฉพาะไฟล์เหล่านี้)

| # | ไฟล์ | การแก้ |
|---|---|---|
| 1 | `artifacts/knight-basins/src/admin/TechnicianTeamsManager.tsx` | ใหม่ |
| 2 | `artifacts/knight-basins/src/admin/TechnicianCalendarPage.tsx` | ลบ `TECHNICIAN_TEAMS` ที่ฝังอยู่ → ใช้ hook |
| 3 | `artifacts/knight-basins/src/admin/AdminApp.tsx` | เพิ่มเมนู + route + permission gate |
| 4 | `lib/api-client-react/**` | จาก codegen เท่านั้น — ห้ามแก้มือ |

---

## FORBIDDEN

- ห้ามแตะ `artifacts/api-server/**` (งานของชัย — ใบงานที่ 23)
- ห้ามแตะ `index.css` · print layout · ใบเสนอราคา (`App.tsx` ส่วน `formal-*`)
- ห้าม hardcode รายชื่อทีมกลับเข้าไปในโค้ดอีก
- ห้ามแตะ `StudioPage.tsx` (ปิดงานไปแล้วในใบงานที่ 21)
- ห้าม push เข้า `main` ตรง ๆ

---

## EVIDENCE

1. `pnpm run typecheck` จาก root → 0 errors
2. `PORT=3000 pnpm run --filter @workspace/knight-basins build` → ผ่าน + `verify-production-assets` OK
3. screenshot หน้า `/admin/technician-teams` (มีทีมจริงแสดงอยู่)
4. screenshot dropdown "ทีมช่าง" ในปฏิทิน ที่ดึงชื่อจาก API
5. branch + commit hash

---

## OUTPUT

- ลิงก์ branch/PR
- ไฟล์ที่แก้ + จำนวนบรรทัด
- หลักฐาน 4 ข้อข้างบน

---

## STOP

หยุดแล้วรายงานถ้า typecheck ไม่ผ่านและแก้ไม่ได้ใน 1 รอบ

---

# สเปกละเอียด (ทำตามนี้ได้เลย)

## 1 · สัญญา API (ใช้ได้ทันที ไม่ต้องรอ backend merge)

```
GET /api/admin/technician-teams
  200 → [{ "id": 1, "code": "TP", "name": "ช่างยี่", "shortName": "ยี่",
           "aliases": ["แอนนี่"], "sortOrder": 10, "active": true }, ...]
  query ?includeInactive=1 → รวมทีมที่ปิดใช้งาน

POST /api/admin/technician-teams
  body { "code": "NK", "name": "ช่างใหม่", "shortName": "ใหม่",
         "aliases": ["ทีมใหม่"], "sortOrder": 110 }
  201 → ทีมที่สร้าง | 400 code ซ้ำ/รูปแบบผิด/ชื่อว่าง | 403 ไม่มีสิทธิ์

PATCH /api/admin/technician-teams/:id
  body { "name"?, "shortName"?, "aliases"?, "sortOrder"?, "active"? }   // แก้ code ไม่ได้
  200 → ทีมที่แก้ | 400 ไม่ส่งฟิลด์มา | 404 ไม่พบ id
```

รหัสทีม = `^[A-Z]{2,8}$` (ตัวพิมพ์ใหญ่เท่านั้น) · ชื่อ/ชื่อย่อ ห้ามว่าง

## 2 · `TechnicianTeamsManager.tsx` (ไฟล์ใหม่)

โครงที่ต้องการ — ใช้ token/CSS variable เดิมของระบบทั้งหมด (`var(--line)`, `var(--card-paper)`,
`var(--ink)`, `var(--ink-soft)`, `var(--brand-blue)`) และ `text-*` ของ Tailwind
**ห้ามใส่ font-size เป็น px ตรง ๆ** เพราะระบบเพิ่งรวม type scale เป็น pattern เดียว

```tsx
import { useState } from "react";
import { Plus, Check, Ban, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useGetAdminTechnicianTeams,
  useCreateAdminTechnicianTeam,
  useUpdateAdminTechnicianTeam,
} from "@workspace/api-client-react";

export function TechnicianTeamsManager() {
  const [showInactive, setShowInactive] = useState(false);
  const [draft, setDraft] = useState({ code: "", name: "", shortName: "", aliases: "" });
  const [error, setError] = useState<string | null>(null);

  const teams = useGetAdminTechnicianTeams({ includeInactive: showInactive ? 1 : undefined });
  const createTeam = useCreateAdminTechnicianTeam();
  const updateTeam = useUpdateAdminTechnicianTeam();

  const submit = () => {
    setError(null);
    const code = draft.code.trim().toUpperCase();
    if (!/^[A-Z]{2,8}$/.test(code)) return setError("รหัสทีมต้องเป็นตัวพิมพ์ใหญ่ 2–8 ตัว เช่น NK");
    if (!draft.name.trim() || !draft.shortName.trim()) return setError("กรอกชื่อทีมและชื่อย่อให้ครบ");
    createTeam.mutate(
      {
        data: {
          code,
          name: draft.name.trim(),
          shortName: draft.shortName.trim(),
          aliases: draft.aliases.split(",").map((a) => a.trim()).filter(Boolean),
          sortOrder: 0,
        },
      },
      {
        onSuccess: () => setDraft({ code: "", name: "", shortName: "", aliases: "" }),
        onError: () => setError("บันทึกไม่สำเร็จ — รหัสทีมนี้อาจมีอยู่แล้ว"),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5" data-testid="technician-teams-page">
      <header className="border-b border-[var(--line)] pb-5">
        <p className="eyebrow accent">INSTALL TEAMS</p>
        <h1 className="font-semibold font-display tracking-tight">ทีมช่างติดตั้ง</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--ink-soft)]">
          เพิ่มทีมใหม่ หรือปิดใช้งานทีมที่เลิกรับงาน — ทีมที่ปิดใช้งานจะไม่ถูกเสนอในปฏิทิน
          แต่ประวัติงานเก่ายังอยู่ครบ
        </p>
      </header>

      <section className="border border-[var(--line)] bg-[var(--card-paper)] p-4">
        <h2 className="font-semibold">เพิ่มทีมใหม่</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <label className="grid gap-1 text-[10px] font-medium text-[var(--ink-soft)]">
            <span>รหัสทีม (A–Z)</span>
            <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                   placeholder="NK" data-testid="input-team-code" className="rounded-none" />
          </label>
          <label className="grid gap-1 text-[10px] font-medium text-[var(--ink-soft)]">
            <span>ชื่อทีม</span>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                   placeholder="ช่างใหม่" data-testid="input-team-name" className="rounded-none" />
          </label>
          <label className="grid gap-1 text-[10px] font-medium text-[var(--ink-soft)]">
            <span>ชื่อย่อ (ใช้จับคู่ในแชท)</span>
            <Input value={draft.shortName} onChange={(e) => setDraft({ ...draft, shortName: e.target.value })}
                   placeholder="ใหม่" data-testid="input-team-short-name" className="rounded-none" />
          </label>
          <label className="grid gap-1 text-[10px] font-medium text-[var(--ink-soft)]">
            <span>คำเรียกอื่น (คั่นด้วย ,)</span>
            <Input value={draft.aliases} onChange={(e) => setDraft({ ...draft, aliases: e.target.value })}
                   placeholder="ทีมใหม่, ช่างใหม่" data-testid="input-team-aliases" className="rounded-none" />
          </label>
        </div>
        {error && <p className="mt-3 text-xs text-[#a24439]" role="alert" data-testid="team-form-error">{error}</p>}
        <Button className="mt-3 rounded-none" onClick={submit} disabled={createTeam.isPending} data-testid="button-create-team">
          <Plus className="mr-2 h-4 w-4" /> เพิ่มทีม
        </Button>
      </section>

      <label className="flex items-center gap-2 text-xs text-[var(--ink-soft)]">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)}
               data-testid="toggle-show-inactive" />
        แสดงทีมที่ปิดใช้งานด้วย
      </label>

      <div className="overflow-x-auto border border-[var(--line)]">
        <table className="w-full text-left">
          <thead className="bg-[#f1f8fb]">
            <tr>
              <th className="px-3 py-2">รหัส</th>
              <th className="px-3 py-2">ชื่อทีม</th>
              <th className="px-3 py-2">ชื่อย่อ</th>
              <th className="px-3 py-2">คำเรียกอื่น</th>
              <th className="px-3 py-2">สถานะ</th>
              <th className="px-3 py-2 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {teams.data?.map((team) => (
              <tr key={team.id} className="border-t border-[var(--line)]" data-testid={`team-row-${team.code}`}>
                <td className="px-3 py-2 font-mono text-xs">{team.code}</td>
                <td className="px-3 py-2 text-sm">{team.name}</td>
                <td className="px-3 py-2 text-sm">{team.shortName}</td>
                <td className="px-3 py-2 text-xs text-[var(--ink-soft)]">
                  {team.aliases?.length ? team.aliases.join(", ") : "—"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {team.active
                    ? <span className="text-[#17816d]">ใช้งาน</span>
                    : <span className="text-[#a24439]">ปิดใช้งาน</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button variant="outline" className="rounded-none"
                          data-testid={`button-toggle-team-${team.code}`}
                          disabled={updateTeam.isPending}
                          onClick={() => updateTeam.mutate({ id: team.id, data: { active: !team.active } })}>
                    {team.active
                      ? <><Ban className="mr-2 h-3.5 w-3.5" /> ปิดใช้งาน</>
                      : <><RotateCcw className="mr-2 h-3.5 w-3.5" /> เปิดใช้งาน</>}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {teams.isLoading && <p className="text-sm text-[var(--ink-soft)]">กำลังโหลดรายชื่อทีม…</p>}
    </div>
  );
}
```

> ชื่อ hook (`useGetAdminTechnicianTeams` ฯลฯ) ให้ยึดตามที่ codegen สร้างจริงจาก `openapi.yaml`
> ถ้าชื่อต่างจากนี้ให้ใช้ชื่อจริงจาก codegen (ดู `lib/api-client-react/src/generated/api.ts`)

## 3 · แก้ `TechnicianCalendarPage.tsx`

**ลบ** อาร์เรย์ `TECHNICIAN_TEAMS` ที่ฝังอยู่ในไฟล์นี้ออกทั้งก้อน แล้วเปลี่ยนมาใช้ API:

```tsx
// ลบ import เดิม แล้วเพิ่ม
import { useGetAdminTechnicianTeams } from "@workspace/api-client-react";

// ใน TechnicianCalendarPage()
const teamsQuery = useGetAdminTechnicianTeams();
const technicianTeams = teamsQuery.data ?? [];
```

ใน dropdown เปลี่ยนจาก `TECHNICIAN_TEAMS.map(...)` เป็น:

```tsx
{technicianTeams.map((team) => (
  <option key={team.code} value={team.code}>{team.code} — {team.name}</option>
))}
```

**ห้าม** เขียนรายชื่อทีมสำรองไว้ในโค้ด — ถ้า API ยังโหลดไม่เสร็จให้ dropdown ว่างก่อน

## 4 · แก้ `AdminApp.tsx`

เพิ่มใน `NAV_ITEMS` ต่อจากบรรทัด `/admin/calendar`:

```tsx
{ href: "/admin/technician-teams", label: "ทีมช่างติดตั้ง", exact: false, permission: "leads" },
```

เพิ่ม route (วางข้าง route ของ `/admin/calendar`) พร้อม gate แบบเดียวกับหน้าอื่น:

```tsx
<AdminPermissionGate permission="leads" resource="ทีมช่างติดตั้ง">
  <TechnicianTeamsManager />
</AdminPermissionGate>
```

## 5 · จุดที่ต้องระวัง

- **ห้ามใส่ font-size เป็น px** ใน CSS/className ใหม่ — ระบบใช้ type scale กลาง
  (`--type-size-heading-xl` = h1 หน้าแอดมิน, `--type-size-heading-lg` = h2, `--type-size-heading-md` = h3)
  ถ้าต้องการหัวข้อ ให้ใช้ `<h1>/<h2>/<h3>` แล้วปล่อยให้ CSS จัดการ
- ปุ่ม/ช่องกรอก ใช้ `rounded-none` และโทนสีเดิมของหน้าแอดมิน เพื่อให้กลมกลืนกับหน้าอื่น
- ใส่ `data-testid` ตามที่ระบุในตัวอย่าง เพื่อให้ตรวจงานได้
