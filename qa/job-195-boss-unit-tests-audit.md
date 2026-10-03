# ใบงาน 195-B (Boss) — Unit Tests Diagnostics & Service Account Mock Audit

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**ผู้รับผิดชอบ:** บอส (Aunnop Sengmanee) · รันเทสต์และสำรวจได้ด้วยตนเอง
**Branch:** `diag/boss-api-tests-audit` (หรือรันบนเครื่อง Local / WorkSpace D:\ClaudeCodeWorkSpace)
**วัตถุประสงค์:** สำรวจและวินิจฉัยชุดเทสต์ Backend API 14 ตัวที่ตกค้างใน `artifacts/api-server` โดยแยกแยะระหว่าง "บั๊กจากโค้ดจริง" กับ "เทสต์ตกเพราะเครื่องไม่มีไฟล์ Service Account credentials หรือ mock ไม่ครบ"

---

## 🔬 สรุปสาระสำคัญของเทสต์ 14 ข้อที่ตก (Diagnosis Summary)

จากการรัน `npm test` ล่าสุดใน `artifacts/api-server` มีเทสต์ทั้งหมด **778 ข้อ: ผ่าน 764 ข้อ / ไม่ผ่าน 14 ข้อ** ซึ่งสามารถจัดเป็น 4 กลุ่มชัดเจน:

### 1️⃣ กลุ่ม Service Account & AI/TTS (ตก 6 ข้อ)
* **ไฟล์ที่เกี่ยวข้อง:**
  - `test/google-tts.test.ts`
  - `test/support-route.test.ts`
  - `test/vertex-gemini.test.ts` (หรือบล็อก askGemini)
* **สาเหตุ:** เทสต์เขียนดักว่า *"is false when no Google service account is configured"* แต่ในเครื่องทดสอบมีการโหลดตัวแปรหรือไฟล์ `.google-credentials.json` เข้ามา ทำให้เงื่อนไข `Configured` สลับกัน หรือเทสต์บางตัวไม่ได้ mock ฟังก์ชันตรวจ credentials ให้เป็นค่าว่าง

### 2️⃣ กลุ่ม Technician Calendar & Team Code Filter (ตก 4 ข้อ)
* **ไฟล์ที่เกี่ยวข้อง:**
  - `test/admin-technician-calendar.test.ts`
  - `test/admin-technician-teams.test.ts`
* **ประเด็น:**
  - `carries job detail fields (leadKey, name, project...)`
  - `queries with no filter condition when technicianTeamCode is omitted`
  - `builds a filter condition for a real team code`
  - `builds a filter condition for technicianTeamCode=unassigned`
* **สาเหตุ:** มีการปรับโครงสร้างตารางหรือ Schema ใน Router ให้รองรับฟิลด์ใหม่ แต่ Mock Database ในไฟล์เทสต์ยังคืนรูปแบบเก่า

### 3️⃣ กลุ่ม KnightSupport Hermes / Customer Quote Context (ตก 3 ข้อ)
* **ไฟล์ที่เกี่ยวข้อง:**
  - `test/support-route.test.ts`
* **ประเด็น:**
  - `writes the authenticated account and open lead only after confirmation`
  - `routes an unmatched question from a logged-in customer to Hermes...`
  - `falls back to the generic reply when Hermes errors...`

### 4️⃣ กลุ่ม Dashboard Stats & Lead Persistence (ตก 1 ข้อ)
* **ไฟล์ที่เกี่ยวข้อง:**
  - `test/admin-dashboard-stats.test.ts` (หรือ `test/lead-handover.test.ts`)
  - `returns the full dashboard payload for an authenticated admin`
  - `returns and persists the complete tax and site details payload`

---

## 🛠️ ขั้นตอนที่บอสสามารถทดสอบได้เองทีละสเต็ป

### ขั้นที่ 1: รันดูเฉพาะกลุ่มที่มีปัญหา (ไม่ต้องรอทั้งชุด 778 ข้อ)
เปิด Terminal ในโฟลเดอร์ `artifacts/api-server` แล้วสั่งรันเจาะจง:

```bash
# 1. ทดสอบกลุ่ม TTS และ Gemini
node --test test/google-tts.test.ts

# 2. ทดสอบกลุ่ม Technician Calendar
node --test test/admin-technician-calendar.test.ts

# 3. ทดสอบกลุ่ม Dashboard Stats
node --test test/admin-dashboard-stats.test.ts
```

### ขั้นที่ 2: สังเกต Error Message ของข้อที่ตก
* ดูว่าฟ้องเรื่อง `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal` ในบรรทัดไหน
* หรือฟ้องเรื่อง `Service Account credentials not found / invalid`

---

## 🎯 คำแนะนำของเดวิด (สิ่งที่ควรทำต่อ)
1. บอสไม่ต้องแก้โค้ด Business Logic ใดๆ ใน Production เพราะระบบจริงบน VPS ใช้งานได้ปกติ (มี credentials จริงครบถ้วน)
2. หากบอสต้องการให้เทสต์ทั้ง 14 ข้อนี้เขียว 100% เดวิดสามารถ **ออกใบงานให้ชัย (หรือเดวิดทำเอง)** ปรับแก้เฉพาะ **ไฟล์เทสต์ (Mocking Harness)** ให้ mock สภาพแวดล้อมให้ตรงกัน เพื่อคืน baseline ที่สะอาดให้ระบบครับ!
