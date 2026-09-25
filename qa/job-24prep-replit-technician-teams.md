# ใบงานที่ 24-PREP (ฉบับ 2 · Replit) — เตรียมหน้าจอทีมช่าง + แก้ workspace ให้ตรง main

```
✅ มาตรฐานการออกใบงาน · 12/12 · 24 ก.ย. 69 · เดวิด
```

**Branch:** `feat/replit-technician-teams-prep` (draft — ห้ามเปิด PR)
**เอกสารแนบ:** `/opt/data/knight-design-kb/qa/job-24-replit-technician-teams-spec.md`

ส่งเป็นสตริงเดียวให้ Replit — ข้อความในบล็อกข้างล่างนี้คือใบงานเต็ม

```
⛔ ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal
   และห้ามเด้งกล่องถามเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL      : (0) ทำให้ workspace ตรงกับ main ล่าสุดก่อน (1) เตรียมหน้าจอ /admin/technician-teams
            ให้เสร็จทั้งหน้า (layout, ตาราง, ฟอร์มเพิ่มทีม, ปุ่มเปิด-ปิดใช้งาน, เมนู, route,
            permission gate) และแก้หน้าปฏิทินให้เลิกรายชื่อทีมที่ฝังในโค้ด โดยต่อผ่าน
            ไฟล์สะพานชั่วคราว 1 ไฟล์ เพื่อให้ typecheck/build เขียวได้ตอนนี้
            แม้ API จริงจะยังไม่มา — ตอน API มาแล้วเหลือแค่สลับ import 1 บรรทัด

SCOPE     : /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/technician-teams-bridge.ts  (ใหม่ · ไฟล์สะพานชั่วคราว)
            /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/TechnicianTeamsManager.tsx  (ใหม่)
            /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/TechnicianCalendarPage.tsx
            /opt/data/cache/kbsrc/artifacts/knight-basins/src/admin/AdminApp.tsx
            อ่านได้ (ห้ามแก้): /opt/data/knight-design-kb/qa/job-24-replit-technician-teams-spec.md

FORBIDDEN : ห้ามแตะ artifacts/api-server/** และ lib/** (ของชัย)
            ห้ามแตะ index.css · print layout · ใบเสนอราคา · StudioPage.tsx
            ห้าม import จาก @workspace/api-client-react สำหรับ 3 hook ใหม่นี้ (ยังไม่มี จะทำให้ build แดง)
            ห้ามใส่ข้อมูลตัวอย่าง/ข้อมูลจำลองใด ๆ — ไฟล์สะพานต้องคืนลิสต์ว่างเท่านั้น
            ห้ามเปิด PR จาก branch นี้ และห้าม merge เข้า main (branch นี้เป็น draft)
            ห้าม push เข้า main
            ห้ามแก้ไฟล์นอกรายการ SCOPE เพื่อ workaround ปัญหา workspace
              (ถ้า workspace ยังไม่ตรง ให้หยุดแล้วรายงาน ไม่ใช่แก้เอง)

EVIDENCE  : 0) ก่อนเริ่ม: ยืนยันว่า workspace ตรงกับ main แล้ว — แนบผล git log -1 (hash)
               และยืนยันว่ามี 2 ไฟล์นี้อยู่จริง:
                 artifacts/knight-basins/src/admin/AdminDashboard.tsx
                 lib/api-client-react/src/index.ts  (ต้องมีบรรทัด export { customFetch })
            1) npx pnpm run typecheck จาก root -> 0 errors
            2) PORT=3000 npx pnpm run --filter @workspace/knight-basins build
               -> ผ่าน + verify-production-assets OK
            3) cd artifacts/knight-basins && npm test
               -> baseline ก่อนเริ่ม (เดวิดรันเองบน main): tests 189 / pass 185 / fail 2
                  (2 ที่ตกคือ basin-visual.browser.test.ts กับ quote-print.browser.test.ts
                   ซึ่งรันใน container ไม่ได้ — ยอมรับได้)
                  ต้องไม่มี fail ใหม่เพิ่มจาก 2
            4) screenshot หน้า /admin/technician-teams (จะเห็น empty state จริง ไม่ใช่ข้อมูลปลอม)
            5) screenshot หน้าปฏิทิน ที่ dropdown "ทีมช่าง" ว่างเปล่า (เพราะยังไม่มี API)
            6) branch + commit hash ที่ส่งกลับ

OUTPUT    : ลิงก์ branch (draft) · commit hash · ไฟล์ที่แก้ + จำนวนบรรทัด · หลักฐาน 0-6 ข้างบน

STOP      : หยุดแล้วรายงานถ้า (ก) typecheck ไม่ผ่านแก้ไม่ได้ใน 1 รอบ
            (ข) build ไม่ผ่าน (ค) มี fail ใหม่เกิน 2 ในข้อ 3
            (ง) workspace ยังไม่ตรงกับ main หลัง resync
            ห้ามเดาต่อ ห้ามใส่ mock data เพื่อให้ดูเหมือนทำงานได้
            ห้ามแก้ไฟล์นอก SCOPE เพื่อ workaround

BRANCH    : feat/replit-technician-teams-prep   (draft — ห้ามเปิด PR)

CONTRACT (ทำตามนี้ ไม่ต้องเดา):

0) แก้ workspace ให้ตรง main ก่อน (เดวิดตรวจแล้วว่า main สมบูรณ์ — ไฟล์ที่ขาดคือ workspace ค้าง)
   - resync workspace จาก GitHub Connection ให้ตรงกับ main ล่าสุด
   - ตรวจว่าเห็น 2 ไฟล์นี้ก่อนเริ่มงาน:
       artifacts/knight-basins/src/admin/AdminDashboard.tsx
       lib/api-client-react/src/index.ts  (ต้องมี export { customFetch } from "./custom-fetch")
   - ถ้ายังไม่เห็น ให้หยุดแล้วส่งกลับ: ข้อความ error ดิบ + git log -1 ของ workspace
     (ห้ามสร้างไฟล์นั้นเอง ห้าม patch import เพื่อให้ผ่าน)

1) ไฟล์สะพาน technician-teams-bridge.ts — ประกาศ type + hook ให้ signature ตรงกับที่จะ codegen

   export type TechnicianTeam = {
     id: number; code: string; name: string; shortName: string;
     aliases: string[]; sortOrder: number; active: boolean;
   };
   useGetAdminTechnicianTeams(params?: { includeInactive?: number })
     -> { data: TechnicianTeam[]; isLoading: boolean; isError: boolean }  คืน { data: [], ... }
   useCreateAdminTechnicianTeam()  -> { mutate(v, opts?), isPending }
   useUpdateAdminTechnicianTeam()  -> { mutate(v, opts?), isPending }
   ทั้งสอง mutate เรียก opts?.onError?.(new Error("API ยังไม่พร้อมใช้งาน"))
   ใส่ comment หัวไฟล์ว่าเป็นไฟล์ชั่วคราว + จะถูกลบในใบงาน 24 (ฉบับจริง)

2) TechnicianTeamsManager.tsx — โค้ดเต็มอยู่ในเอกสารแนบข้อ 2 เปลี่ยนแค่ import
   จาก @workspace/api-client-react -> ./technician-teams-bridge ที่เหลือทำตามสเปกเป๊ะ
   รวม data-testid ทุกจุดตามที่ระบุในเอกสารแนบ

3) TechnicianCalendarPage.tsx — ลบอาร์เรย์ TECHNICIAN_TEAMS ที่ฝังอยู่ออกทั้งก้อน
   ใช้ useGetAdminTechnicianTeams().data จาก ./technician-teams-bridge (ชั่วคราว)
   ห้ามเขียนรายชื่อทีมสำรองไว้ในโค้ด

4) AdminApp.tsx — เพิ่มเมนู { href: "/admin/technician-teams", label: "ทีมช่างติดตั้ง",
   exact: false, permission: "leads" } + route ที่มี AdminPermissionGate permission="leads"

5) หน้าตา — ใช้ token/CSS เดิมทั้งหมด (var(--line), var(--card-paper), var(--ink), var(--brand-blue))
   · ห้ามใส่ font-size px ใหม่ (ใช้ <h1>/<h2>/<h3> ให้ CSS type scale จัดการ) · rounded-none
```

## บันทึกการทบทวนก่อนออกใบงาน (เช็คลิสต์ 12 ข้อ)

| # | ข้อ | ผล |
|---|---|---|
| 1 | ลำดับ | ✅ ไม่พึ่ง 23 — ใช้ไฟล์สะพาน ทำงานคู่ขนานกับชัยได้ ไม่ชนไฟล์ |
| 2 | SCOPE ครบ | ✅ ตรวจแล้วว่า `knight-basins/test/` **ไม่มี** เทสต์ที่อ้าง `AdminApp`/`TechnicianCalendarPage` → ไม่มีไฟล์เทสต์ต้องเพิ่ม · แต่ใส่ `npm test` ใน EVIDENCE พร้อม baseline จริง |
| 3 | ขัดกันเอง | ✅ ใบงานนี้ไม่มี codegen → ไม่มีไฟล์ generated ขัดกับข้อจำกัด SCOPE |
| 4 | อ้างถึงอะไร | ✅ เอกสารแนบใส่ **path เต็ม** ใน SCOPE · baseline ตัวเลขอยู่ในใบงานเอง |
| 5 | คำสั่งจริง | ✅ `npx pnpm` · `npm test` · baseline 189/185/2 มาจากการรันจริงของเดวิด |
| 6 | สิทธิ์ | – ไม่เกี่ยวข้อง (Replit) |
| 7 | รูปที่เทียบ | ✅ ระบุ type `TechnicianTeam` ให้ตรงกับที่จะ codegen จริง |
| 8 | ข้อห้าม | ✅ เพิ่มข้อใหม่: **ห้ามแก้ไฟล์นอก SCOPE เพื่อ workaround ปัญหา workspace** (บทเรียนจากรอบก่อน) |
| 9 | STOP | ✅ ตัวเลข: fail ใหม่เกิน 2 · typecheck/build ไม่ผ่าน · workspace ไม่ตรง |
| 10 | ครึ่งเดียว | ✅ ไม่ตัด — ส่วนที่เหลือเป็นใบงาน 24 ฉบับจริงที่ตั้งใจแยก (สลับ import + ลบไฟล์สะพาน) |
| 11 | Replit | ✅ บรรทัดบังคับ GitHub Connection บนสุด · ระบุ branch · ห้าม PR · EVIDENCE ต้องมี commit hash · โค้ดตัวอย่างครบในเอกสารแนบ |
| 12 | เพดานรอบ | – ไม่ใช้ chai.sh (Replit รันเอง) |
