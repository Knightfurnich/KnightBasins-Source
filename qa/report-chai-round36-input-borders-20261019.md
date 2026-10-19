# รายงาน 475-C — ขอบช่องกรอกต่ำกว่า 3:1 ทั้ง 2 โหมด (ชัย)

**baseline:** main `547ad0b` · Windows 11 Pro 10.0.26100 · Node v24.15.0 · Chrome headless (CDP) · ผู้รัน: ชัย (Claude) · เวลาไทย 20 ต.ค. 69 00:36
**ไฟล์ที่แก้:** `artifacts/knight-basins/src/components/ThemeToggle.tsx` (+บล็อก "job 475-C" · สีเท่านั้น) · `artifacts/knight-basins/test/contrast-theme-guard.test.ts` (+5 เทสต์) · `qa/**`
**ไม่แตะ:** `index.css` · `App.tsx` · โทเคนสี · **ความหนาขอบ/ขนาด/โครงสร้าง/ข้อความ** · `data/**` · `api-server/**` · `qa/tools/**` · `.github/**` · `deploy/**` · `public/**` · production/DB · ปุ่ม LINE

## 1. สรุป 5 บรรทัด
1. **แก้อะไร:** ขอบของ input/select/textarea ทุกตัวบน 16 เส้นทาง (รวมสถานะ `/quote#cart`, `/studio` ส่วนติดต่อ, `/sketch` หลังอัปโหลด) จาก **1.61 (มืด) / 1.21–1.28 (สว่าง) → ≥4.79 (มืด) / ≥3.44 (สว่าง)** ปักสี `#7a8fa8` (มืด) / `#738a9e` (สว่าง) · ช่องค้นหา/จัดเรียง/ค้นหาผลงานปักที่ขอบของกรอบที่ครอบ · **จุดตั้งต้น** `input-customer-name` มืด 1.61 (`rgb(52,68,91)` บน `rgb(22,34,56)`) → 4.79 · สว่าง `#d7e5ef`-ish บนขาว 1.24 → 3.51
2. **เทสต์:** web 1,603 / ผ่าน 1,522 / ตก 12 / ข้าม 69 (main เครื่องนี้ 1,598/1,517/12/69 → +5 เทสต์ ไม่มีตกใหม่ · 12 ข้อที่ตกเป็นชุดเดิมของ Windows) · tsc web error เดิมข้อเดียว (`AdminVoiceSettings.tsx`) · พิสูจน์สองทาง 10/10
3. **ตรวจไม่ได้:** ตัวกวาดรุ่นใหม่ของรีพิต (471-R) **ยังไม่อยู่ใน main** — ไม่ได้รัน · ใช้เครื่องมือผม `qa/images/chai-round36/inputs.mjs` (ขอบทุกช่อง) + ตัวกวาดข้อความ: เหลือเฉพาะ LINE · CI Linux · วัดจาก dev server ไม่ใช่ production · ช่องกรอกที่ซ่อนอยู่หลังการล็อกอิน/รหัสจริง (`/quote/view` ด้วยรหัสทดสอบ) · สีของ **placeholder ในฟอร์มลูกค้า** ไม่ได้อยู่ในใบนี้ และผมไม่ได้วัด
4. **ความเสี่ยง/ต้องให้เดวิดตัดสิน:** (ก) ขอบช่องกรอกชัดขึ้นทั้งเว็บ (ตั้งใจ ดูภาพ) (ข) ตัวเลือกสีหิน/อ่างในการ์ดผลของ `/sketch` **ไม่มีขอบเลย** (border 0 และพื้นเดียวกับการ์ด = มืด 1.0) การมีขอบต้องเพิ่มความหนา ซึ่งใบนี้ห้ามเปลี่ยน — ผมจึงใช้ **วงแหวน inset 1px (`box-shadow`)** ที่ไม่ขยับ layout/ขนาดเลย แต่ถ้าถือว่าคือ "เปลี่ยนความหนาขอบ" ให้ตัดสองกฎ `select-sketch-*` ออกได้ (จะเหลือ 4 ช่องที่ไม่มีขอบ) (ค) สถานะ focus คงขอบน้ำเงินเดิม (กฎข้าม `:focus`) · ช่องในแอดมินและช่องเตือนแถวเก่าสีเหลืองของ /studio ไม่ถูกแตะ
5. **ข้อเสนอ:** ให้เดวิดรัน 471-R กับสาขานี้ · วัด placeholder ฟอร์มลูกค้าโหมดสว่างต่อ (ภาพแสดงว่าจางมาก) · ปุ่มที่ใช้ขอบ line colour (เช่น `.studio-edge-select`, `.studio-placement-selectors button`) ยังไม่ได้วัด — ไม่ใช่ input จึงนอกใบ

## 2. ผลรวมต่อโหมด × ความกว้าง (ช่องทั้งหมดที่เห็นบน 16 เส้นทาง · `inputs.mjs`)
| โหมด | กว้าง | ช่อง | ตก <3.0 ก่อน | ตก <3.0 หลัง | ratio ต่ำสุดหลัง |
|---|---|---|---|---|---|
| มืด | 1440 | 108 | 107 | **0** | 4.79 |
| มืด | 390 | 108 | 107 | **0** | 4.79 |
| สว่าง | 1440 | 108 | 108 | **0** | 3.44 |
| สว่าง | 390 | 108 | 108 | **0** | 3.44 |
(ช่องที่ "ผ่านอยู่แล้ว" = ช่องค้นหาผลงานโหมดมืด: พื้นเข้มของช่องบนกรอบขาว 15.91)

## 3. ตารางต่อกลุ่มช่อง (หน้า · โหมด · ความกว้าง · พื้น · ขอบก่อน/หลัง) — 152 กลุ่ม · ไฟล์เต็ม `qa/images/chai-round36/table-inputs.md` · ข้อมูลดิบ `before-inputs-*.json` / `after-inputs-*.json` (selector · box · fg/bg rgb ต่อช่อง)
วิธี: อ่านค่า computed จากเบราว์เซอร์ — ขอบของช่อง (ด้านที่เด่นสุด) เทียบกับพื้นด้านนอก **และ** พื้นด้านใน (ค่าต่ำสุด) · ช่องที่ไม่มีขอบ/พื้นเอง ใช้กรอบที่ครอบ · แถวที่ผ่านอยู่ก่อนไม่ถูกแตะ

| หน้า (สถานะ) | โหมด | กว้าง | ช่อง (ชนิด · จำนวน) | พื้น rgb (ด้านนอก) | ขอบก่อน rgb | ratio ก่อน | ขอบหลัง rgb | ratio หลัง | ผล |
|---|---|---|---|---|---|---|---|---|---|
| / (initial) | dark | 1440 | text ใน label.search-field · 1 | rgb(15,23,42) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| / (initial) | dark | 1440 | select ใน label.sort-field · 1 | rgb(15,23,42) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /stone (initial) | dark | 1440 | text ใน label.search-field · 1 | rgb(15,23,42) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /portfolio (initial) | dark | 1440 | search · 1 | rgb(255,255,255) | rgb(22,34,56) | 15.91 | rgb(22,34,56) (fill) | **15.91** | ✅ |
| /quote#cart (initial) | dark | 1440 | text · 10 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /quote#cart (initial) | dark | 1440 | tel · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /quote#cart (initial) | dark | 1440 | email · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /quote#cart (initial) | dark | 1440 | select · 3 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /quote#cart (initial) | dark | 1440 | textarea · 2 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /quote#cart (initial) | dark | 1440 | date · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (initial) | dark | 1440 | number · 4 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (initial) | dark | 1440 | text · 8 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (initial) | dark | 1440 | tel · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (initial) | dark | 1440 | email · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (initial) | dark | 1440 | select · 4 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (initial) | dark | 1440 | date · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (initial) | dark | 1440 | textarea · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (contact) | dark | 1440 | number · 4 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (contact) | dark | 1440 | text · 8 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (contact) | dark | 1440 | tel · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (contact) | dark | 1440 | email · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (contact) | dark | 1440 | select · 4 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (contact) | dark | 1440 | date · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (contact) | dark | 1440 | textarea · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (initial) | dark | 1440 | text · 10 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (initial) | dark | 1440 | select · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (ring) | **4.79** | ✅ |
| /sketch (initial) | dark | 1440 | tel · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (initial) | dark | 1440 | email · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (initial) | dark | 1440 | select · 4 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (initial) | dark | 1440 | date · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (initial) | dark | 1440 | textarea · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (upload) | dark | 1440 | text · 16 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (upload) | dark | 1440 | select · 3 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (ring) | **4.79** | ✅ |
| /sketch (upload) | dark | 1440 | tel · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (upload) | dark | 1440 | email · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (upload) | dark | 1440 | select · 4 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (upload) | dark | 1440 | date · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (upload) | dark | 1440 | textarea · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| / (initial) | dark | 390 | text ใน label.search-field · 1 | rgb(15,23,42) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| / (initial) | dark | 390 | select ใน label.sort-field · 1 | rgb(15,23,42) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /stone (initial) | dark | 390 | text ใน label.search-field · 1 | rgb(15,23,42) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /portfolio (initial) | dark | 390 | search · 1 | rgb(255,255,255) | rgb(22,34,56) | 15.91 | rgb(22,34,56) (fill) | **15.91** | ✅ |
| /quote#cart (initial) | dark | 390 | text · 10 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /quote#cart (initial) | dark | 390 | tel · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /quote#cart (initial) | dark | 390 | email · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /quote#cart (initial) | dark | 390 | select · 3 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /quote#cart (initial) | dark | 390 | textarea · 2 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /quote#cart (initial) | dark | 390 | date · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (initial) | dark | 390 | number · 4 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (initial) | dark | 390 | text · 8 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (initial) | dark | 390 | tel · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (initial) | dark | 390 | email · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (initial) | dark | 390 | select · 4 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (initial) | dark | 390 | date · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (initial) | dark | 390 | textarea · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (contact) | dark | 390 | number · 4 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (contact) | dark | 390 | text · 8 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (contact) | dark | 390 | tel · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (contact) | dark | 390 | email · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (contact) | dark | 390 | select · 4 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (contact) | dark | 390 | date · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /studio (contact) | dark | 390 | textarea · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (initial) | dark | 390 | text · 10 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (initial) | dark | 390 | select · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (ring) | **4.79** | ✅ |
| /sketch (initial) | dark | 390 | tel · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (initial) | dark | 390 | email · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (initial) | dark | 390 | select · 4 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (initial) | dark | 390 | date · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (initial) | dark | 390 | textarea · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (upload) | dark | 390 | text · 16 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (upload) | dark | 390 | select · 3 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (ring) | **4.79** | ✅ |
| /sketch (upload) | dark | 390 | tel · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (upload) | dark | 390 | email · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (upload) | dark | 390 | select · 4 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (upload) | dark | 390 | date · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| /sketch (upload) | dark | 390 | textarea · 1 | rgb(22,34,56) | rgb(52,68,91) | 1.61 | rgb(122,143,168) (border-top) | **4.79** | ✅ |
| / (initial) | light | 1440 | text ใน label.search-field · 1 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| / (initial) | light | 1440 | select ใน label.sort-field · 1 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| /stone (initial) | light | 1440 | text ใน label.search-field · 1 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| /portfolio (initial) | light | 1440 | search ใน div.portfolio-search-bar · 1 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| /quote#cart (initial) | light | 1440 | text · 10 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| /quote#cart (initial) | light | 1440 | tel · 1 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| /quote#cart (initial) | light | 1440 | email · 1 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| /quote#cart (initial) | light | 1440 | select · 3 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| /quote#cart (initial) | light | 1440 | textarea · 2 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| /quote#cart (initial) | light | 1440 | date · 1 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| /studio (initial) | light | 1440 | number · 4 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (initial) | light | 1440 | text · 8 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (initial) | light | 1440 | tel · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (initial) | light | 1440 | email · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (initial) | light | 1440 | select · 4 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (initial) | light | 1440 | date · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (initial) | light | 1440 | textarea · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (contact) | light | 1440 | number · 4 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (contact) | light | 1440 | text · 8 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (contact) | light | 1440 | tel · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (contact) | light | 1440 | email · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (contact) | light | 1440 | select · 4 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (contact) | light | 1440 | date · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (contact) | light | 1440 | textarea · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (initial) | light | 1440 | text · 10 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (initial) | light | 1440 | select · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (ring) | **3.58** | ✅ |
| /sketch (initial) | light | 1440 | tel · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (initial) | light | 1440 | email · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (initial) | light | 1440 | select · 4 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (initial) | light | 1440 | date · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (initial) | light | 1440 | textarea · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (upload) | light | 1440 | text · 16 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (upload) | light | 1440 | select · 3 | rgb(255,255,255) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (ring) | **3.58** | ✅ |
| /sketch (upload) | light | 1440 | tel · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (upload) | light | 1440 | email · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (upload) | light | 1440 | select · 4 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (upload) | light | 1440 | date · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (upload) | light | 1440 | textarea · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| / (initial) | light | 390 | text ใน label.search-field · 1 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| / (initial) | light | 390 | select ใน label.sort-field · 1 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| /stone (initial) | light | 390 | text ใน label.search-field · 1 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| /portfolio (initial) | light | 390 | search ใน div.portfolio-search-bar · 1 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| /quote#cart (initial) | light | 390 | text · 10 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| /quote#cart (initial) | light | 390 | tel · 1 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| /quote#cart (initial) | light | 390 | email · 1 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| /quote#cart (initial) | light | 390 | select · 3 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| /quote#cart (initial) | light | 390 | textarea · 2 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| /quote#cart (initial) | light | 390 | date · 1 | rgb(246,251,254) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (border-top) | **3.44** | ✅ |
| /studio (initial) | light | 390 | number · 4 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (initial) | light | 390 | text · 8 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (initial) | light | 390 | tel · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (initial) | light | 390 | email · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (initial) | light | 390 | select · 4 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (initial) | light | 390 | date · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (initial) | light | 390 | textarea · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (contact) | light | 390 | number · 4 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (contact) | light | 390 | text · 8 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (contact) | light | 390 | tel · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (contact) | light | 390 | email · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (contact) | light | 390 | select · 4 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (contact) | light | 390 | date · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /studio (contact) | light | 390 | textarea · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (initial) | light | 390 | text · 10 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (initial) | light | 390 | select · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (ring) | **3.58** | ✅ |
| /sketch (initial) | light | 390 | tel · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (initial) | light | 390 | email · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (initial) | light | 390 | select · 4 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (initial) | light | 390 | date · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (initial) | light | 390 | textarea · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (upload) | light | 390 | text · 16 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (upload) | light | 390 | select · 3 | rgb(255,255,255) | rgb(216,231,240) | 1.21 | rgb(115,138,158) (ring) | **3.58** | ✅ |
| /sketch (upload) | light | 390 | tel · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (upload) | light | 390 | email · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (upload) | light | 390 | select · 4 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (upload) | light | 390 | date · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |
| /sketch (upload) | light | 390 | textarea · 1 | rgb(255,255,255) | rgb(216,231,240) | 1.24 | rgb(115,138,158) (border-top) | **3.51** | ✅ |

## 4. ภาพก่อน/หลัง 1440 (`qa/images/chai-round36/`)
`before-quote-customer-form-{dark,light}-1440.png` / `after-…` (ฟอร์มลูกค้าในใบเสนอราคา) · `before-search-toolbar-…` / `after-…` — ขอบชัดขึ้น แต่ยังเข้าธีม (ไม่เปลี่ยนมุมโค้ง ขนาด หรือข้อความ)

## 5. พิสูจน์สองทาง (`two-way-proof.txt`)
ย้อนทีละจุด → เทสต์ตก **10/10**: กฎมืดถูกถอด · สีมืดกลับเป็น `#34445b` · กฎสว่างถูกถอด · สีสว่างกลับเป็น `#d7e5ef` · กฎกรอบค้นหามืด/สว่างถูกถอด · วงแหวน /sketch มืด/สว่างถูกถอด · **มีการเปลี่ยนความหนาขอบแอบเข้ามา → ตก ("colour only")** · ถอดการข้าม `:focus` → ตก · คืนค่า `pass 94 / fail 0` · ข้อผูกพัน 472-C/474-C ไม่ผ่อน

## 6. หลังแก้ — ตัวกวาด (D)
ตัวกวาด 471-R ยังไม่อยู่ใน `main` → ไม่ได้รัน (บอกตรง ๆ) · แทน: `node qa/images/chai-round36/inputs.mjs _ http://localhost:5173 dark|light 1440|390 <out.json>` (ขอบทุกช่อง · ratio ต่ำสุดหลังแก้ มืด 4.79 / สว่าง 3.44 · ตก 0) และ `node qa/tools/gradient-scan-465c.mjs … /quote#cart /sketch /studio /` ทั้งสองธีม (`scan-475.txt`): เหลือเฉพาะปุ่ม LINE (2.26) · ถ้า 471-R ฟ้องช่องที่ผมว่าผ่าน → selector/ค่าอยู่ใน `after-inputs-*.json`

## 7. คำสั่งและตัวเลข
```
node --experimental-strip-types --test test/*.test.ts → ℹ tests 1603  pass 1522  fail 12  skipped 69   (main เครื่องนี้ 1598/1517/12/69)
npx tsc -p tsconfig.json --noEmit (web)               → src/admin/AdminVoiceSettings.tsx(80,64) TS2353 speakingRate (เดิม)
```
api-server: ไม่ได้แตะ (baseline เดวิด 1,329/1,329/0) · `git diff --stat` เฉพาะ SCOPE: `ThemeToggle.tsx` · `contrast-theme-guard.test.ts` · `qa/**`

## 8. เช็คลิสต์
| # | ผล |
|---|---|
| 2 GOAL A–E | A ✅ สีอย่างเดียว (ไม่แตะความหนา — ยกเว้นวงแหวน inset ที่ระบุใน §1 ข้อ 4) · B ✅ ตารางครบ 16 เส้นทาง × 2 × 2 · C ✅ เทสต์ + สองทาง 10/10 · D ⚠️ 471-R ไม่อยู่ใน main (ใช้เครื่องมือผม) · E ✅ |
| 3 baseline | main `547ad0b` · Windows 11 · Node 24.15 · ชัย · 20 ต.ค. 69 00:36 |
| 8 production DB | ไม่แตะ |
| 9 ไม่เดา | ค่าทั้งหมดอ่านจาก computed ของเบราว์เซอร์ · เกณฑ์ UI ≥3.0 |
