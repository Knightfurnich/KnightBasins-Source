# ใบงาน 201 (ชัย) — Decouple Google Service Account Discovery from Host Filesystem for Deterministic Testing

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**ผู้รับผิดชอบ:** ชัย (Programmer) · เริ่มได้ทันที
**Branch:** `feat/chai-google-service-account-decouple`
**วัตถุประสงค์:** ปรับฟังก์ชัน `loadGoogleServiceAccountCredentials` ใน `google-service-account.ts` ให้สามารถควบคุม Search Paths หรือข้ามการค้นหาไฟล์ดิสก์ผ่านอาร์กิวเมนต์หรือตัวแปรควบคุมได้ เพื่อไม่ให้เทสต์กลุ่ม TTS และ Gemini วิ่งไปหยิบไฟล์จริงบนโฮสต์ (`/opt/data/.google-credentials.json`) จนทำให้ผลเทสต์ผิดเพี้ยนระหว่างเครื่อง Windows และ Linux

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน /opt/data/cache/kbsrc/artifacts/api-server/src/lib/google-service-account.ts ปรับฟังก์ชัน loadGoogleServiceAccountCredentials ให้รับพารามิเตอร์ทางเลือก candidatePathsOverride?: ReadonlyArray<string> (หรือตรวจสอบตัวแปรควบคุม เช่น DISABLE_GOOGLE_CREDENTIALS_DISK_SEARCH) เพื่อให้ caller หรือ test harness สามารถสั่งตัดการค้นหาไฟล์บนดิสก์ได้
  2. รักษาพฤติกรรมเดิมบน Production 100%: ถ้าไม่มีการ override ให้ยังคงค้นหาไฟล์ตาม DEFAULT_SEARCH_PATHS เดิม (/app/..., ./..., /docker/..., /opt/data/...) ปกติ
  3. ใน /opt/data/cache/kbsrc/artifacts/api-server/test/google-tts.test.ts และ /opt/data/cache/kbsrc/artifacts/api-server/test/vertex-gemini.test.ts ปรับเทสต์เคสที่ทดสอบ "กรณีไม่ได้ตั้งค่า credentials" ให้สั่งข้ามการค้นหาไฟล์บนดิสก์ เพื่อให้ได้ผลลัพธ์ false แน่นอน 100% แม้รันบนโฮสต์ที่มีไฟล์จริง
  4. ยืนยันว่าเทสต์ google-tts.test.ts (11 ข้อ) และ vertex-gemini.test.ts (14 ข้อ) ผ่านเขียวครบ 100% ทั้งบนเครื่อง Windows และ Linux container

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/google-service-account.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/google-tts.test.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/vertex-gemini.test.ts

FORBIDDEN:
  - ห้ามกระทบพฤติกรรมการโหลด Credentials บน Production VPS (ถ้าไม่มี override ต้องอ่านไฟล์จริงได้ตามปกติ)
  - ห้ามแตะต้องโค้ดฝั่ง frontend (artifacts/knight-basins/) และห้ามแตะ src/index.css เด็ดขาด
  - ห้าม commit คีย์จริงหรือ Secret ใดๆ ลง git
  - ทำงานผ่าน branch: feat/chai-google-service-account-decouple แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-google-service-account-decouple ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) node --test test/google-tts.test.ts ใน artifacts/api-server → 11/11 ผ่านครบ
  4) node --test test/vertex-gemini.test.ts ใน artifacts/api-server → 14/14 ผ่านครบ
  5) npm test ใน artifacts/api-server → ผ่านครบ 100% (775/775 pass หรือดีขึ้น)

OUTPUT:
  - artifacts/api-server/src/lib/google-service-account.ts
  - artifacts/api-server/test/google-tts.test.ts
  - artifacts/api-server/test/vertex-gemini.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และเทสต์ทั้งสองไฟล์ผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ระบุเป้าหมาย decouple search paths ใน google-service-account |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | แตะ 3 ไฟล์ฝั่ง api-server มีอยู่จริง |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามกระทบ production, ห้ามแตะ frontend, ห้ามรั่ว secret |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่ง tsc, node test, npm test baseline |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ผลลัพธ์ 3 ไฟล์ |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | ระบุ 30 turns |
| 7 | SCOPE ระบุชัดเจน | ผ่าน | ตรวจสอบไฟล์มีอยู่จริงบนเครื่องครบ 3 ไฟล์ |
| 8 | มีแนวทาง Backward Compatibility | ผ่าน | รักษาพฤติกรรมเดิมบน production 100% |
| 9 | ห้ามแตะ src/index.css | ผ่าน | ระบุชัดเจน |
| 10 | มี branch name ชัดเจน | ผ่าน | feat/chai-google-service-account-decouple |
| 11 | มี baseline ตัวเลขเปรียบเทียบ | ผ่าน | 11/11, 14/14, 775/775 |
| 12 | เป็นมิตรกับระบบ CI/CD | ผ่าน | ไม่กระทบ production build |
