# ใบงาน 196 (ชัย) — Studio Auto-Notify Sales: ส่งแจ้งเตือนงานขายเข้า Telegram อัตโนมัติทันทีที่ยื่นใบเสนอราคาจาก Studio

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**ผู้รับผิดชอบ:** ชัย (Programmer) · เริ่มได้ทันที
**Branch:** `feat/chai-studio-auto-notify`
**วัตถุประสงค์:** ปรับฟังก์ชัน `submitStudio` ใน `App.tsx` ให้ส่งแจ้งเตือนงานขายอัตโนมัติทันทีที่มีการกดยื่นขอใบเสนอราคาจาก 2D Studio (`/studio`) แบบเดียวกับหน้าร้าน (`submitQuote`) เพื่อไม่ให้ทีมขายพลาดข้อมูลลูกค้าที่ไม่ได้กดปุ่มส่งแจ้งเตือนซ้ำในหน้าใบเสนอราคา

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ปรับฟังก์ชัน submitStudio ใน /opt/data/cache/kbsrc/artifacts/knight-basins/src/App.tsx ให้เรียก notifyQuoteMutation.mutateAsync({ data: { token: lead.publicQuoteToken } }) โดยอัตโนมัติหลังจาก syncLead สำเร็จ
  2. จัดการข้อผิดพลาดด้วย try/catch ไม่ให้การส่งแจ้งเตือนที่ล้มเหลว (เช่น เครือข่ายมีปัญหา) ไปบล็อกการนำทางไปยังหน้า /quote/view ของลูกค้า
  3. หากส่งแจ้งเตือนสำเร็จหรือมีข้อความตอบกลับ ให้ส่ง query param ?notification=... ไปยังหน้า /quote/view เพื่อแสดงสถานะให้ลูกค้าทราบเหมือนกับ submitQuote
  4. เขียนการทดสอบใน /opt/data/cache/kbsrc/artifacts/knight-basins/test/studio-auto-notify.test.ts ตรวจสอบการเชื่อมโยงฟังก์ชัน submitStudio กับการแจ้งเตือน

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/App.tsx
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/studio-auto-notify.test.ts

FORBIDDEN:
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามแตะต้องโค้ดคำนวณราคา หรือโครงสร้างใบเสนอราคาทางการ (Print Layout)
  - ห้ามบล็อกการเปิดดูใบเสนอราคาของลูกค้าหากระบบส่งข้อความแจ้งเตือนไม่สำเร็จ (Graceful Degradation)
  - ทำงานผ่าน branch: feat/chai-studio-auto-notify แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-studio-auto-notify ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) node --test test/studio-auto-notify.test.ts ใน artifacts/knight-basins → ผ่านทุกข้อ
  4) npm test ใน artifacts/knight-basins (non-browser suite)
     baseline อ้างอิง: tests 659 / pass 659 / fail 0
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/studio-auto-notify.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และเทสต์ใหม่ผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ระบุเป้าหมายเชื่อม notifyQuoteMutation ใน submitStudio |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | แตะเฉพาะ App.tsx และ test ใหม่ |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ index.css, ห้ามแตะสูตรราคา, ห้ามบล็อก flow |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่ง tsc, node test, npm test baseline |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ผลลัพธ์ |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | ระบุ 30 turns |
| 7 | SCOPE ระบุชัดเจน | ผ่าน | ตรวจสอบแล้วมีไฟล์อยู่จริงบนเครื่อง |
| 8 | มีแนวทาง Error Handling | ผ่าน | Try/catch graceful degradation |
| 9 | ห้ามแตะ src/index.css | ผ่าน | ระบุชัดเจน 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | feat/chai-studio-auto-notify |
| 11 | มี baseline ตัวเลขเปรียบเทียบ | ผ่าน | 659 tests / 0 failures |
| 12 | เป็นมิตรกับระบบ CI/CD | ผ่าน | ไม่กระทบ production build |
