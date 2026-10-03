# ใบงาน 203 (ชัย) — Product Copy Consistency: ปรับตัวเลขจำนวนสีหินให้ตรงกันทั้งระบบ (Single Source of Truth)

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**ผู้รับผิดชอบ:** ชัย (Programmer) · เริ่มได้ทันที
**Branch:** `fix/chai-stone-colour-count-copy`
**วัตถุประสงค์:** ตัวเลขจำนวนสีหินสังเคราะห์ที่เขียนในหน้าเว็บและเอกสารสาธารณะล้าสมัยและไม่ตรงกับแคตตาล็อกที่เปิดขายจริง จึงต้องรวบจุดเดียวและปรับให้ตรงกับข้อมูลจริงที่ระบบดึงมาแสดง

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ตรวจจำนวนสีหินจริงจากแคตตาล็อกที่เปิดใช้งานบน Production (ทั้งสองโหมด: whole-sheet และ installed) และจากตาราง sheet_stone_prices / installed_stone_prices แล้วสรุปตัวเลขที่ถูกต้องพร้อมหลักฐานในรายงาน
  2. ปรับข้อความตัวเลขสีให้เป็น "ค่าเดียวกันทั้งระบบ" ใน 3 จุด:
     - /opt/data/cache/kbsrc/artifacts/knight-basins/index.html (meta description, og:description, twitter:description)
     - /opt/data/cache/kbsrc/artifacts/knight-basins/src/components/RouteMeta.logic.ts (path "/")
     - /opt/data/cache/kbsrc/artifacts/knight-basins/public/llms.txt (บรรทัดแคตตาล็อกหิน)
  3. ห้าม hardcode ตัวเลขใหม่ที่ตรวจสอบไม่ได้: ให้ใช้ถ้อยคำที่อัปเดตได้จริงและไม่ผิดเมื่อแคตตาล็อกเปลี่ยน (เช่น "กว่า 60 เฉดสี" หรือระบุตัวเลขที่ตรวจจาก Production รอบนี้พร้อมวันที่ในรายงาน) แล้วเขียนเหตุผลการเลือกถ้อยคำลงรายงาน
  4. สร้าง static test ใน /opt/data/cache/kbsrc/artifacts/knight-basins/test/stone-colour-count-consistency.test.ts ตรวจว่าไฟล์ทั้ง 3 จุดใช้ตัวเลข/ถ้อยคำชุดเดียวกันจริง และไม่มีคำว่า "74 สี" ตกค้างในไฟล์สาธารณะ

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/index.html
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/components/RouteMeta.logic.ts
  - /opt/data/cache/kbsrc/artifacts/knight-basins/public/llms.txt
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/stone-colour-count-consistency.test.ts (ใหม่)

FORBIDDEN:
  - ห้ามแก้ฐานข้อมูลหรือแคตตาล็อก (งานนี้แก้เฉพาะข้อความ/public copy) — ตัวเลขต้องมาจากการอ่านข้อมูลจริงเท่านั้น
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามแตะต้องสูตรราคา ราคา และตารางราคาใดๆ
  - ห้ามเดาตัวเลข — ถ้าตรวจไม่ชัดเจนให้รายงานกลับมาและยังไม่แก้
  - ทำงานผ่าน branch: fix/chai-stone-colour-count-copy แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง fix/chai-stone-colour-count-copy ชัดเจน
  2) คำสั่งที่ใช้ตรวจจำนวนสีจริงบน Production (เช่น curl /api/catalog หรือ query ตาราง sheet_stone_prices / installed_stone_prices) พร้อมตัวเลขที่ได้ในรายงาน
  3) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  4) node --test test/stone-colour-count-consistency.test.ts → ผ่านทุกข้อ
  5) npm test ใน artifacts/knight-basins (non-browser suite) → เทียบตัวเลข pass/fail กับ baseline ปัจจุบัน และยืนยัน src/index.css 0 diff

OUTPUT:
  - artifacts/knight-basins/index.html
  - artifacts/knight-basins/src/components/RouteMeta.logic.ts
  - artifacts/knight-basins/public/llms.txt
  - artifacts/knight-basins/test/stone-colour-count-consistency.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และเทสต์ใหม่ผ่านครบ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ปรับตัวเลขสี 3 จุด + เทสต์กันตกค้าง |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 4 ไฟล์ ตรวจกับดิสก์แล้ว |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามเดาตัวเลข, ห้ามแตะ CSS/ราคา |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | มีคำสั่งจริงและตัวเลข |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ผลลัพธ์ |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 30 turns |
| 7 | SCOPE path มีอยู่จริง | ผ่าน | ตรวจครบ |
| 8 | บังคับหลักฐานตัวเลขจริง | ผ่าน | ต้อง curl/query จริง |
| 9 | ห้ามแตะ src/index.css | ผ่าน | 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | fix/chai-stone-colour-count-copy |
| 11 | มีเกณฑ์ตัวเลข | ผ่าน | 0 errors / 0 diff |
| 12 | เป็นมิตรกับ CI/CD | ผ่าน | ไม่กระทบ build |

---

## 📌 ข้อมูลที่เดวิดตรวจพบแล้ว (ใช้เป็นจุดตั้งต้น)

คำว่า **"74 สี"** ตกค้างอยู่ใน 3 ไฟล์สาธารณะ:
| ไฟล์ | บรรทัด | ข้อความ |
|---|---|---|
| `artifacts/knight-basins/index.html` | 7, 19, 32 | meta description / og:description / twitter:description: "30 รุ่น 74 สี" |
| `artifacts/knight-basins/src/components/RouteMeta.logic.ts` | 19 | description ของ path "/" : "30 รุ่น 74 สี" |
| `artifacts/knight-basins/public/llms.txt` | 11 | "แคตตาล็อกหินสังเคราะห์ (74 สี 3 เรตราคา)" |

**บริบทที่ต้องระวัง:** เดวิดตรวจหน้า `/stone` พบว่ามีหินเปิดใช้งาน **64 สีต่อโหมด** และรวมรหัสไม่ซ้ำทั้งสองตารางได้ **68 รหัส** — ดังนั้นตัวเลข 74 ซึ่งเป็นการนับจากแคตตาล็อกเดิม (ก่อนมีงานปรับแคตตาล็อกหิน) จึงไม่ตรงกับที่ระบบแสดงจริง
👉 **งานของชัยคือตรวจจริงก่อน แล้วเลือกถ้อยคำที่ปลอดภัย** เช่น "กว่า 60 เฉดสี" พร้อมระบุตัวเลขที่ตรวจได้จริงในรายงาน
