# ใบงาน Replit — บังคับใช้เวลาไทย (Asia/Bangkok, GMT+7) ทุกจุดในระบบ (รวมถึง Telegram, LINE และน้องไนท์ Chatbot)
สร้าง 15 ก.ย. 2026 · Knight Basins · หลักฐาน: VPS + container API ตั้งเป็น **UTC** แต่หน้าจอ/เอกสารใช้ **timezone ของอุปกรณ์ผู้ใช้** จึงแสดงเวลาไทยไม่ตรง

## ปัญหาที่พิสูจน์แล้ว (หลักฐานจริง)
- VPS: `date` = `Tue Sep 15 03:20 UTC 2026` · `/etc/timezone` = `Etc/UTC` · container `knightbasins-api` = UTC
- ขณะเวลาไทย ~10:20 น. หน้าเว็บแสดง "บันทึกอัตโนมัติล่าสุด 15 ก.ย. 2569 **03:16**" → ห่างจากเวลาไทย 7 ชั่วโมง
- สาเหตุ: โค้ดใช้ `Intl.DateTimeFormat("th-TH", ...)` **โดยไม่ระบุ `timeZone`** → ใช้ timezone ของเครื่องที่เปิด

## สิ่งที่ต้องแก้ (ระบุไฟล์/บรรทัด)
1. `artifacts/knight-basins/src/components/StudioPage.tsx`
   - `formatDraftTimestamp()` (~150-154) → เพิ่ม `timeZone: "Asia/Bangkok"`
   - `defaultNamedDraft()` (~162-164) → ชื่อเริ่มต้น "แบบร่าง [วัน/เวลา]" ต้องเป็นเวลาไทย
   - ใช้กับทุกลูกความ: แถบ "พบแบบร่างที่ทำค้างไว้เมื่อ …", "บันทึกล่าสุด …", "บันทึกอัตโนมัติล่าสุด …", ชื่อแบบร่าง default
2. `artifacts/knight-basins/src/App.tsx`
   - `formatDate()` (~87-88) และ `formatQuoteDate()` (~318-321) → `timeZone: "Asia/Bangkok"` (ทั้ง TH และ EN)
   - หมายเหตุ: `issueDate` = `new Date(lead.createdAt)` + 30 วัน เป็นการบวกเวลา ห้ามแก้เป็นUTC±7 ให้ใช้ instant เดิม แล้ว format เป็น Bangkok
3. `artifacts/knight-basins/src/admin/LeadsManager.tsx` (~40-44) และ `src/admin/leads-utils.ts` (~32,36)
   - ตัวกรองวันที่/แสดงวันที่ในหลังบ้าน → ต้องคิดช่วงวันตามเวลาไทย (เริ่มวัน 00:00–23:59 น. ไทย ไม่ใช่ UTC)
4. `artifacts/api-server/src/routes/leads.ts` (~17)
   - เลขที่ใบเสนอราคาใช้เดือน/ปี: `new Intl.DateTimeFormat("en-US",{month:"short",year:"2-digit"})` → **ต้องเพิ่ม `timeZone: "Asia/Bangkok"`**
   - ผลถ้าไม่แก้: ออกใบตอน 00:00–06:59 น. ไทย จะได้เลขที่เดือนก่อนหน้า (เช่น 1 ต.ค. 06:00 ไทย → "Sep 26 / …")
5. **ข้อความแจ้งเตือน Telegram & LINE**:
   - เพิ่มบรรทัดเวลาไทยในข้อความแจ้งเตือน: `⏰ 15 ก.ย. 2569 10:20 น.` (ระบุ `timeZone: "Asia/Bangkok"`)
6. **น้องไนท์ Chatbot (`KnightSupport.tsx`)**:
   - หากมีการแสดงเวลาที่ส่งข้อความหรือเวลาที่รับข้อมูล ให้แสดงเป็นเวลาไทย (GMT+7 `Asia/Bangkok`) ทั้งหมด

## เกณฑ์ตรวจรับ (แนบหลักฐานจริง)
1. ตั้ง timezone เบราว์เซอร์เป็น `UTC` และ `America/New_York` → เปิด Studio แล้วบันทึกแบบร่าง → **เวลาที่แสดงต้องเป็นเวลาไทยตรงกันทั้งสองกรณี** (แนบภาพเทียบ 2 ภาพ + เวลาไทยจริงจากนาฬิกา)
2. เอกสารใบเสนอราคา (TH และ EN) แสดงวันที่ออก–หมดอายุเป็นวันที่ไทย แม้เครื่องตั้ง UTC (แนบภาพ)
3. ข้อความแจ้งเตือนเข้า Telegram & LINE แสดงบรรทัดเวลาไทย `⏰ [วัน/เดือน/ปี เวลา น.]` ตรงกับเวลาไทยจริง (แนบภาพข้อความ)
4. น้องไนท์ Chatbot แสดงเวลาเป็นเวลาไทย GMT+7 (แนบภาพ)
5. หลังบ้าน (Leads) ตัวกรองวันที่และคอลัมน์วันที่เป็นเวลาไทย (แนบภาพ)
6. หน่วงเวลา: ตั้งวันที่บนเครื่องเป็น 30 ก.ย. 23:30 UTC (= 1 ต.ค. 06:30 ไทย) แล้วออกใบ → เลขที่ต้องขึ้นเดือน ต.ค. (แนบภาพ/ค่าจริง)
7. เทสต์เดิมทั้งหมด + build/asset guard ผ่าน · เพิ่ม regression test อย่างน้อย 1 เคสที่บังคับ timeZone = Asia/Bangkok
8. ห้ามแตะ Auth/Session/Admin Guard/ฐานข้อมูล · ห้าม deploy production เอง (push GitHub เท่านั้น)

## หมายเหตุการส่งงาน
แจ้ง commit + SHA-256 ของ `web-dist/assets/*.js`, `web-dist/index.html`, `api-dist/index.mjs`
