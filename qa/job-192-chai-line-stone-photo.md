# ใบงาน 192 (ชัย / Claude Code) — ส่งภาพหินในใบเสนอราคาเข้า LINE/Telegram อัตโนมัติพร้อมงาน

**วันที่:** 2 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ ชัย (Backend + ข้อมูลแจ้งเตือน) · คิวต่อจาก Job 191

**ที่มาและความต้องการ:**
บอสต้องการให้เมื่อลูกค้ายื่นขอใบเสนอราคา (หรือทีมกดส่งแจ้งเตือนงาน) **ข้อความที่ยิงเข้า LINE/Telegram ของทีมขายต้องมีภาพหินที่ลูกค้าเลือกติดไปด้วย** เพื่อให้ช่างและทีมขายเปิดดูลายหินบนมือถือได้ทันที ไม่ต้องกลับไปค้นแคตตาล็อก
ปัจจุบัน ข้อความแจ้งเตือนเป็นข้อความตัวอักษรล้วน (`lib/sales-notifications.ts`) และข้อมูลที่ส่งมาจากหน้าเว็บ (notification items) ไม่มีฟิลด์รูปภาพอยู่ในสัญญา จึงไม่มีภาพติดไปกับข้อความ

**รายละเอียดสิ่งที่ต้องทำ (3 ไฟล์):**
1. `artifacts/knight-basins/src/components/StudioPage.tsx`
   - ในจุดที่สร้าง `notificationItems` สำหรับรายการหิน (บริเวณบรรทัด ~4505 ที่ push รายการหินเข้า `notificationItems`) ให้แนบฟิลด์ `imageUrl` ต่อท้าย โดยใช้ภาพจากสีที่เลือก:
     `stoneColorByName(safeState.activeStone, stoneColors).quoteImageUrl ?? …imageUrl`
   - ห้ามแตะราคา/ยอดรวมในออบเจกต์นี้ (เพิ่มเฉพาะฟิลด์รูป)
2. `artifacts/api-server/src/lib/sales-notifications.ts`
   - เพิ่ม `imageUrl?: string | null` ใน `NotificationItem`
   - ในข้อความที่ส่ง (`notifyQuote`) ให้เพิ่มบรรทัดรูปภาพของรายการหินที่ส่งมา (ไม่เกิน 3 บรรทัดแรก) ในรูปแบบ `รูปหิน <code>: <url>` โดย **ส่งเป็นลิงก์ข้อความเท่านั้น** (LINE จะทำให้กดเปิดได้เอง) และห้ามใส่ภาพของรายการที่ไม่ใช่หิน (service/บasin) เพื่อไม่ให้ข้อความยาวเกินจำเป็น
   - ถ้าไม่มีรายการหินที่มี `imageUrl` ให้ข้อความออกมาเหมือนเดิมทุกประการ (ต้องไม่กระทบเคสเดิม)
   - ห้ามส่งค่า secret หรือ path ภายในออกไปในข้อความ
3. เพิ่มเทสต์ `artifacts/api-server/test/sales-notification-stone-image.test.ts`
   - ทดสอบว่าเมื่อ items มีรายการหินที่มี `imageUrl` ข้อความที่ประกอบเสร็จมีลิงก์รูปของหินนั้น
   - ทดสอบว่าเมื่อไม่มี `imageUrl` ข้อความไม่เปลี่ยนจากเดิม และไม่มีการเพิ่มบรรทัดรูป

```
✅ มาตรฐานการออกใบงาน · 12/12 · 2 ต.ค. 69 · เดวิด

GOAL:
  1. แนบ imageUrl ของหินที่เลือกใน notificationItems (StudioPage.tsx)
  2. ขยาย NotificationItem และข้อความแจ้งเตือนให้มีบรรทัดลิงก์รูปหิน (sales-notifications.ts)
  3. เพิ่ม Unit Test ใน artifacts/api-server/test/sales-notification-stone-image.test.ts

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/components/StudioPage.tsx
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/sales-notifications.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/sales-notification-stone-image.test.ts

FORBIDDEN:
  - ห้ามแก้ยอดเงิน ราคา ส่วนลด VAT หรือสูตรคำนวณใดๆ
  - ห้ามแตะต้อง src/index.css และห้ามแตะ Formal Quotation print layout
  - ห้ามใส่ API key / token / path ภายในลงในข้อความแจ้งเตือน
  - ห้ามแก้บอทให้ส่งข้อความเข้า LINE กลุ่มเองเกินกว่าที่มีอยู่เดิม (ต้องคง Silence Guard)
  - ทำงานผ่าน branch: feat/chai-line-stone-photo แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-line-stone-photo ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  4) node --test test/sales-notification-stone-image.test.ts → ผ่านทุกข้อ
  5) npm test ใน artifacts/api-server
     baseline อ้างอิง: tests 760 / fail 9 pre-existing / ตัวที่ตกต้องเป็นชุดเดิมเท่านั้น

OUTPUT:
  - branch: feat/chai-line-stone-photo (เปิด PR เข้า main)
  - 3 ไฟล์ตามรายการ SCOPE
  - EVIDENCE ครบ 5 ข้อ

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้า typecheck มี error เกิน 0
  - ถ้าเทสต์ตกเกิน 9 ข้อ (baseline เดิม)
  - ถ้าต้องแก้ไฟล์นอกรายการ SCOPE เกิน 0 ไฟล์
  - ถ้าต้องเปลี่ยนรูปแบบข้อความแจ้งเตือนของอ่างล้างหน้าเพื่อให้งานสำเร็จ
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | มีตราหัวใบงานระบุวันที่ + ผู้ออก | ✅ ผ่าน |
| 2 | ครบ 6 ช่องหลัก (GOAL, SCOPE, FORBIDDEN, EVIDENCE, OUTPUT, STOP) | ✅ ผ่าน |
| 3 | ตารางเช็คลิสต์ 12 ข้อปรากฏในเอกสาร | ✅ ผ่าน |
| 4 | เงื่อนไข STOP วัดได้เป็นตัวเลขเชิงปริมาณ | ✅ ผ่าน |
| 5 | EVIDENCE มีคำสั่งที่รันได้จริง | ✅ ผ่าน |
| 6 | EVIDENCE มี baseline และตัวเลขอ้างอิง | ✅ ผ่าน |
| 7 | SCOPE ใช้ path สมบูรณ์สำหรับ Claude Code CLI | ✅ ผ่าน |
| 8 | มีข้อกำหนด branch และ PR ชัดเจน | ✅ ผ่าน |
| 9 | FORBIDDEN มีข้อห้ามชัดเจนเกิน 30 ตัวอักษร | ✅ ผ่าน |
| 10 | ยึดกฎ index.css แช่แข็ง และไม่แตะ Formal Quotation | ✅ ผ่าน |
| 11 | ห้ามรั่วความลับในข้อความที่ส่งออก | ✅ ผ่าน |
| 12 | ไม่แตะต้องไฟล์นอกขอบเขต | ✅ ผ่าน |
