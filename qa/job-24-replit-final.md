# ใบงานที่ 24 (ฉบับจริง · Replit) — สลับไฟล์สะพานเป็น hook จริง + ลบไฟล์สะพาน

```
✅ มาตรฐานการออกใบงาน · 12/12 · 24 ก.ย. 69 · เดวิด
```

**Branch:** ทำงานต่อบน `feat/replit-technician-teams-prep` (branch เดิม) — รอบนี้**อนุญาตให้ merge ได้หลังเดวิดตรวจ**
**เอกสารแนบ:** `/opt/data/knight-design-kb/qa/job-24-replit-technician-teams-spec.md`

ส่งเป็นสตริงเดียวให้ Replit

```
⛔ ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal
   และห้ามเด้งกล่องถามเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที

GOAL      : สลับไฟล์สะพาน technician-teams-bridge.ts เป็น hook จริงจาก @workspace/api-client-react
            แล้วลบไฟล์สะพานออก เพื่อให้หน้าจัดการทีมช่างและ dropdown ในปฏิทินใช้ข้อมูลจริงจาก API
            (API ขึ้น production แล้ว · migration 012 รันแล้ว · มี 10 ทีมจริงใน DB)

SCOPE     : artifacts/knight-basins/src/admin/TechnicianTeamsManager.tsx
            artifacts/knight-basins/src/admin/TechnicianCalendarPage.tsx
            ลบไฟล์: artifacts/knight-basins/src/admin/technician-teams-bridge.ts
            (path ทั้งหมดเป็น path สัมพัทธ์จาก root ของ repo)

FORBIDDEN : ห้ามแตะ artifacts/api-server/** · lib/** (ของชัย)
            ห้ามแก้ไฟล์ generated (lib/api-client-react/**, lib/api-zod/**) ด้วยมือ
            ห้ามแตะ index.css · print layout · ใบเสนอราคา · StudioPage.tsx
            ห้ามเก็บไฟล์สะพานไว้ — ต้องลบให้หมด
            ห้ามใส่ข้อมูลตัวอย่าง/ข้อมูลจำลอง
            ห้าม push เข้า main ตรง ๆ

EVIDENCE  : 1) ยืนยันว่า branch อิงจาก main ที่มี commit 8cc10a7 (หรือใหม่กว่า) — แนบ git log -1
            2) npx pnpm run typecheck จาก root -> 0 errors
            3) PORT=3000 npx pnpm run --filter @workspace/knight-basins build
               -> ผ่าน + verify-production-assets OK
            4) cd artifacts/knight-basins && npm test
               -> baseline: tests 189 / pass 185 / fail 2
                  (2 ที่ตกคือ basin-visual.browser.test.ts กับ quote-print.browser.test.ts
                   รันใน container ไม่ได้ — ยอมรับได้) ต้องไม่มี fail ใหม่
            5) screenshot หน้า /admin/technician-teams ที่แสดง 10 ทีมจริงจาก API
               (TP ช่างยี่ · PP ช่างเนตร · ST ช่างทู · CM ช่างเจมส์ · KF ทีมโรงงาน ·
                PA ช่างเปา · PM ช่างพร้อม · TJ ช่างกอล์ฟ · AM ช่างเจ๋ง · CL ช่างชัยยา)
            6) screenshot dropdown "ทีมช่าง" ในปฏิทิน
               ถ้า dev DB ยังขึ้น API-error ให้แนบภาพนั้นพร้อมป้าย "blocked by environment"
               แล้วระบุชัดว่าเป็นข้อจำกัดของ dev DB (เดวิดจะตรวจบน production เอง)
            7) ยืนยันว่าไฟล์สะพานถูกลบแล้ว — แนบผล ls ที่ไม่พบ technician-teams-bridge.ts
            8) branch + commit hash ที่ส่งกลับ

OUTPUT    : ลิงก์ branch · commit hash · ไฟล์ที่แก้ + จำนวนบรรทัด · หลักฐาน 1-8 ข้างบน

STOP      : หยุดแล้วรายงานถ้า (ก) typecheck ไม่ผ่านแก้ไม่ได้ใน 1 รอบ
            (ข) build ไม่ผ่าน (ค) มี fail ใหม่เกิน 2 ในข้อ 4
            ห้ามเดาต่อ ห้ามใส่ mock data ห้ามแก้ไฟล์นอก SCOPE

BRANCH    : feat/replit-technician-teams-prep   (branch เดิม — รอบนี้ merge ได้หลังเดวิดตรวจ)

CONTRACT (ทำตามนี้ ไม่ต้องเดา):

1) ชื่อ hook จริงจาก codegen — ใช้ชื่อเหล่านี้เป๊ะ (ผมเคยเขียนสเปกผิดเป็น useGet... ขออภัย)
     useListAdminTechnicianTeams      (GET  /api/admin/technician-teams)
     useCreateAdminTechnicianTeam     (POST /api/admin/technician-teams)
     useUpdateAdminTechnicianTeam     (PATCH /api/admin/technician-teams/{id})
     type TechnicianTeam
   signature ของตัว GET: useListAdminTechnicianTeams(params?: { includeInactive?: 1 }, options?)
     -> UseQueryResult<TechnicianTeam[]>
   ตัว type อยู่ใน lib/api-client-react/src/generated/api.schemas.ts

2) TechnicianTeamsManager.tsx
   - เปลี่ยน import จาก "./technician-teams-bridge" เป็น "@workspace/api-client-react"
   - เปลี่ยนชื่อ hook useGetAdminTechnicianTeams -> useListAdminTechnicianTeams
   - ที่เหลือคงเดิมทั้งหมด (โครง/สไตล์/data-testid ตามที่ทำไว้แล้ว)

3) TechnicianCalendarPage.tsx
   - เปลี่ยน import จาก "./technician-teams-bridge" เป็น "@workspace/api-client-react"
   - เปลี่ยนชื่อ hook เป็น useListAdminTechnicianTeams
   - ห้ามเขียนรายชื่อทีมสำรองไว้ในโค้ด

4) ลบไฟล์ artifacts/knight-basins/src/admin/technician-teams-bridge.ts ออกทั้งไฟล์

5) หน้าตา — คงเดิม ห้ามใส่ font-size px ใหม่ · ใช้ token/CSS เดิมของระบบ
```

## บันทึกการทบทวนก่อนออกใบงาน (เช็คลิสต์ 12 ข้อ)

| # | ข้อ | ผล |
|---|---|---|
| 1 | ลำดับ | ✅ API merge + deploy + migration 012 รันบน production แล้ว → hook มีจริงใน generated client แล้ว |
| 2 | SCOPE ครบ | ✅ ตรวจแล้วว่า knight-basins test ไม่มีไฟล์ที่อ้าง 2 component นี้ → ไม่มีไฟล์เทสต์ต้องเพิ่ม · แต่ใส่ `npm test` + baseline จริง |
| 3 | ขัดกันเอง | ✅ ไม่มี codegen ในใบนี้ · ไฟล์ generated อยู่ใน FORBIDDEN |
| 4 | อ้างถึงอะไร | ✅ baseline 189/185/2 อยู่ในใบงาน · รายชื่อ 10 ทีมที่ต้องเห็นอยู่ใน EVIDENCE |
| 5 | คำสั่งจริง | ✅ `npx pnpm` · `npm test` — เดวิดรันเองได้ตัวเลขจริง |
| 6 | สิทธิ์ | – ไม่เกี่ยวข้อง |
| 7 | รูปที่เทียบ | ✅ **แก้ชื่อ hook ให้ตรงของจริงแล้ว** (`useListAdminTechnicianTeams`) — จุดนี้ผมเคยระบุผิด |
| 8 | ข้อห้าม | ✅ ครบ + ห้ามเก็บไฟล์สะพาน + ห้ามแก้ generated ด้วยมือ |
| 9 | STOP | ✅ ตัวเลขชัด |
| 10 | ครึ่งเดียว | ✅ ใบนี้ปิดงานครบ — ไม่เหลือส่วนค้าง |
| 11 | Replit | ✅ บรรทัดบังคับบนสุด · ระบุ branch · EVIDENCE ต้องมี commit hash · ระบุว่า merge ได้หลังตรวจ |
| 12 | เพดานรอบ | – ไม่ใช้ chai.sh |
