# ใบงาน 198-B (บอส) — วินิจฉัยและปิดเทสต์ API ที่ตกค้าง (Stale Test Harness Sweep)

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**ผู้รับผิดชอบ:** บอส (Aunnop Sengmanee) — รันและวินิจฉัยด้วยตนเอง
**เป้าหมาย:** ปิดเทสต์ฝั่ง Backend API ที่ตกค้างแบบ "ยืนยันสาเหตุได้จริง" โดยแยกให้ชัดว่าอันไหนคือบั๊กของระบบจริง และอันไหนคือเทสต์/Harness ล้าสมัย

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ปิดเทสต์ที่ตกใน /opt/data/cache/kbsrc/artifacts/api-server/test/leads-persistence.test.ts (ตก 1 ข้อ: "returns and persists the complete tax and site details payload" ได้ HTTP 500)
  2. วินิจฉัยเทสต์ที่ตกใน /opt/data/cache/kbsrc/artifacts/api-server/test/support-route.test.ts (ตก 3 ข้อ ด้วย Error: getaddrinfo EAI_AGAIN support-route-test)
  3. วินิจฉัยเทสต์กลุ่ม Google TTS / Vertex Gemini ที่ผ่านเมื่อรันไฟล์เดียว แต่ตกในชุดเต็ม แล้วระบุว่าเป็น env pollution หรือ harness
  4. สรุปสิ่งที่พบลงใน /opt/data/cache/kbsrc/qa/job-198-boss-api-test-sweep-report.md พร้อมแนวทางแก้ที่รันยืนยันแล้ว

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/test/leads-persistence.test.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/support-route.test.ts
  - /opt/data/cache/kbsrc/qa/job-198-boss-api-test-sweep-report.md (ใหม่)

FORBIDDEN:
  - ห้ามแก้โค้ด Business Logic หรือ router ใดๆ ในใบงานนี้ (แก้ได้เฉพาะไฟล์เทสต์/harness)
  - ห้ามรันคำสั่งที่เขียนหรือลบข้อมูลบน Production (ห้ามแตะ knightbasins-db)
  - ห้ามรันเทสต์บน VPS Production (คอนเทนเนอร์ knightbasins-api มีแค่ dist ไม่มีซอร์ส/เทสต์)
  - ห้าม commit ค่า SESSION_SECRET หรือ secret จริงลง repo (ใช้ค่าทดสอบในเครื่องเท่านั้น)
  - ทำงานบนเครื่องบอสที่ D:\ClaudeCodeWorkSpace\KnightBasins-Source (หรือ container dev ของเดวิด) เท่านั้น

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) รันก่อนแก้: cd artifacts/api-server && node --test test/leads-persistence.test.ts → ยืนยันตก 1 ข้อ (500 !== 200)
  2) รันคำสั่งพิสูจน์สาเหตุ: SESSION_SECRET=<ค่าทดสอบ> node --test test/leads-persistence.test.ts → ผ่าน 3/3
  3) หลังแก้ไฟล์เทสต์: node --test test/leads-persistence.test.ts → tests 3 / pass 3 / fail 0
  4) node --test test/support-route.test.ts → ระบุ Error ที่แท้จริง (getaddrinfo EAI_AGAIN) และสรุปสาเหตุ
  5) รัน baseline ทั้งชุด: npm test ใน artifacts/api-server และเทียบตัวเลข fail ก่อน/หลัง

OUTPUT:
  - artifacts/api-server/test/leads-persistence.test.ts (แก้ harness ให้มี SESSION_SECRET ครบ)
  - qa/job-198-boss-api-test-sweep-report.md

STOP:
  - เมื่อเทสต์ leads-persistence ผ่าน 3/3 และมีรายงานสรุปครบทั้ง 3 กลุ่ม
  - หรือเมื่อทำงานครบ 60 นาที ให้หยุดและสรุปสิ่งที่พบ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ระบุ 3 กลุ่มเทสต์ที่จะปิด/วินิจฉัย |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุเฉพาะไฟล์เทสต์และไฟล์รายงาน |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ router, ห้ามแตะ Production |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | มีคำสั่งรันจริงและตัวเลข baseline |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ผลลัพธ์ |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | ระบุ 3/3 และ 60 นาที |
| 7 | ตรวจสอบ path แล้วมีจริง | ผ่าน | ไฟล์เทสต์ทั้ง 2 มีอยู่จริงในเครื่องเดวิด |
| 8 | ระบุที่รันชัดเจน | ผ่าน | เครื่องบอส หรือ container dev (ไม่ใช่ VPS) |
| 9 | ห้ามแตะ Production DB | ผ่าน | ระบุชัดเจน |
| 10 | มีผลวินิจฉัยนำทาง | ผ่าน | ระบุสาเหตุที่ตรวจพบแล้ว 2 ข้อ |
| 11 | มี baseline ตัวเลขเปรียบเทียบ | ผ่าน | เทียบ fail ก่อน/หลัง |
| 12 | เป็นมิตรกับระบบ CI/CD | ผ่าน | ไม่กระทบ production build |

---

## 🔬 ผลวินิจฉัยที่เดวิดตรวจพบแล้ว (บอสเริ่มจากตรงนี้ได้เลย)

### กลุ่ม 1 · `leads-persistence.test.ts` — **สาเหตุยืนยันแล้ว 100%**
* **อาการ:** `AssertionError: 500 !== 200` ที่บรรทัด 140
* **สาเหตุจริง (เดวิดแกะ stack ออกมาแล้ว):**
  ```
  Error: SESSION_SECRET is required
      at sessionSecret (…) → sign (…) → createPublicQuoteToken (…) → publicQuoteTokenForLead (…)
  ```
  เมื่อระบบมีระบบลิงก์ใบเสนอราคาสาธารณะ (`publicQuoteToken`) เส้นทาง `POST /api/leads` จำเป็นต้องใช้ `SESSION_SECRET` ในการเซ็น token
  แต่ไฟล์เทสต์นี้ตั้งค่าให้เฉพาะ `DATABASE_URL` ใน `before()` **ยังขาด `SESSION_SECRET`** → route โยน error → ตอบ 500
* **เป็นบั๊กของระบบไหม:** **ไม่ใช่** — Production มี `SESSION_SECRET` ตั้งไว้จริง (ceremony 600) ระบบทำงานปกติ เป็นเพียงเทสต์ที่ยังไม่ตั้ง env ใหม่นี้
* **วิธีแก้ (พิสูจน์แล้ว):** ใน `before()` ตั้ง `process.env["SESSION_SECRET"]` เป็นค่าทดสอบ และคืนค่าเดิมใน `after()`
* **หลักฐานที่เดวิดรันมาแล้ว:**
  ```
  SESSION_SECRET=<test> node --test test/leads-persistence.test.ts
  ✔ returns and persists the complete tax and site details payload
  ✔ removes a sketch upload when the lead database write fails
  ✔ returns a server error and cleans up when sketch storage write fails
  ℹ tests 3 / pass 3 / fail 0
  ```
  👉 **เทสต์เดียวกันที่ตก 1 ข้อ ผ่านครบ 3/3 ทันทีเมื่อมี SESSION_SECRET** ยืนยันสาเหตุชัดเจน

### กลุ่ม 2 · `support-route.test.ts` — **สาเหตุยืนยันแล้ว**
* **อาการ:** ตก 3 ข้อ โดย 2 ข้อแรกเร็วผิดปกติ (~20ms) และฟ้อง
  ```
  Error: getaddrinfo EAI_AGAIN support-route-test
  ```
* **สาเหตุ:** เทสต์ตั้ง `DATABASE_URL` เป็น host ปลอม (`support-route-test`) แต่โค้ดปัจจุบันสร้าง connection pool ของฐานข้อมูลตอน import โมดูล → Node พยายาม resolve DNS จริง → ล้มเหลวก่อนถึง logic ที่ต้องการทดสอบ
* **เป็นบั๊กของระบบไหม:** **ไม่ใช่** — เป็นเรื่อง harness ต้อง inject/stub ตัวเชื่อมต่อ DB (เช่นเดียวกับที่กลุ่มอื่นใช้ fake database) หรือกำหนดให้โมดูลไม่สร้าง pool เมื่ออยู่ในโหมดเทสต์
* **สิ่งที่ต้องตัดสินใจในใบงานนี้:** เลือกวิธี stub ที่ไม่แตะโค้ด Production (เช่น mock โมดูล `lib/db` ผ่าน harness) แล้วบันทึกเหตุผลในรายงาน

### กลุ่ม 3 · Google TTS / Vertex Gemini (`google-tts.test.ts`, `vertex-gemini.test.ts`)
* **อาการ:** เมื่อบอสรันไฟล์เดียว → **ผ่าน 11/11** แต่ในชุดเต็มมีข้อ `is false when no Google service account is configured` ตก
* **ข้อสังเกต:** ลักษณะนี้ชี้ว่าเป็น **env pollution ระหว่างการรันชุดเต็ม** (มีไฟล์เทสต์อื่นตั้ง `GOOGLE_SERVICE_ACCOUNT_JSON` / ค่าที่เกี่ยวข้องค้างไว้) ไม่ใช่บั๊กของระบบ
* **สิ่งที่ต้องทำ:** พิสูจน์ด้วยการรันไฟล์เดียวเทียบกับรันรวม และระบุไฟล์ที่ก่อ pollution

---

## 📌 กฎการนับ baseline (อัปเดต 3 ต.ค. 69)
* เดวิดแก้ stale mocks ไปแล้วใน PR #142 (`admin-technician-calendar` 32/32, `admin-dashboard-stats` 41/41)
* ตัวเลข baseline ปัจจุบันของ api-server: **tests 778 / pass 764 / fail 14** → หลังปิดกลุ่มนี้คาดว่าจะเหลือ **fail 9–11** (ขึ้นกับกลุ่ม 3)
* ตัวเลข baseline ของ `artifacts/knight-basins` (non-browser): **659 pass / 0 fail / 1 TODO (P3)**

## 📌 หมายเหตุสำคัญ
* **บน VPS ไม่มีซอร์สและไม่มีเทสต์** — คอนเทนเนอร์ `knightbasins-api` มีเฉพาะ `dist/` (bundle) กับ `uploads/` การรันเทสต์ต้องทำบนเครื่องนักพัฒนาหรือ container dev เท่านั้น
