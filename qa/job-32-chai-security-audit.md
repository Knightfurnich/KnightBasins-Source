# ใบงาน 32 (ชัย) — ตรวจสอบช่องโหว่ความปลอดภัยระบบ (Security Audit) และแนวทางแก้ไข

**วันที่:** 24 ก.ย. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** พร้อมส่ง

**ความต้องการ:** ให้ชัยตรวจหาช่องโหว่ของโปรแกรม (เน้นความปลอดภัย API, สิทธิ์การเข้าถึง, การอัปโหลดไฟล์, การป้องกันการยิงระบบ) และจัดทำรายงานสรุปพร้อมแนวทางแก้ไขที่เป็นรูปธรรม

```
✅ มาตรฐานการออกใบงาน · 12/12 · 24 ก.ย. 69 · เดวิด

GOAL:
  ตรวจสอบช่องโหว่ด้านความปลอดภัยและการทำงาน (Security & Vulnerability Audit) ของระบบ API Server
  โดยอิงมาตรฐาน OWASP API Security Top 10 เพื่อระบุจุดเสี่ยง พร้อมแนวทางแก้ไข (Remediation) ที่ชัดเจน

SCOPE (absolute path — ใช้ได้กับชัย):
  1. /opt/data/cache/kbsrc/artifacts/api-server/src/middlewares/admin-auth.ts
  2. /opt/data/cache/kbsrc/artifacts/api-server/src/routes/leads.ts
  3. /opt/data/cache/kbsrc/artifacts/api-server/src/routes/admin-router.ts
  4. /opt/data/cache/kbsrc/artifacts/api-server/src/lib/rate-limit.ts
  5. /opt/data/cache/kbsrc/artifacts/api-server/src/lib/slipok.ts

FORBIDDEN (ห้ามแตะเด็ดขาด):
  - งานนี้เป็นงานตรวจสอบเชิงวิเคราะห์ (Audit) ห้ามแก้ไขไฟล์โค้ดในโปรดักชันโดยพลการ
  - ห้ามรันสคริปต์โจมตี (Attack/Exploit) ยิงใส่ URL จริงของ Production เด็ดขาด ให้วิเคราะห์จาก Source Code
  - ห้ามพิมพ์ค่าความลับ รหัสผ่าน Token หรือ Key จริงลงในรายงาน (ให้ระบุเป็น [REDACTED])
  - ห้าม push เข้า main ตรง ๆ

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git branch --show-current + git log --oneline -1
  2) cd artifacts/api-server && npm test
     baseline อ้างอิง (วัดเองบน main 24 ก.ย. 69): tests 251 / pass 247 / fail 4
  3) cd artifacts/api-server && npm audit --omit=dev  -> แนบจำนวนช่องโหว่ dependencies (Critical/High/Moderate)
  4) แสดงรายการช่องโหว่ที่ตรวจพบใน Source Code อย่างน้อย 5 จุด ระบุไฟล์และบรรทัดจริง
  5) ทุกช่องโหว่ต้องมีตัวอย่างโค้ดแนวทางแก้ไข (Fix Example) กำกับ

OUTPUT:
  - รายงานตรวจสอบช่องโหว่ความปลอดภัย จัดเป็นตารางสรุป:
    | ลำดับ | ไฟล์:บรรทัด | ระดับความเสี่ยง (Critical/High/Medium/Low) | ช่องโหว่ | แนวทางแก้ไข |
  - รายละเอียดการวิเคราะห์ใน 5 ด้านหลัก:
    1. การพิสูจน์ตัวตนและเซสชัน (Authentication & Sessions)
    2. สิทธิ์การเข้าถึงข้อมูลลูกค้า (Broken Object Level Authorization / IDOR)
    3. การรับส่งและอัปโหลดไฟล์ (File Upload, MIME type vs Magic Bytes)
    4. การจำกัดอัตราการเรียกใช้งาน (Rate Limiting & DoS Protection)
    5. ข้อมูลรั่วไหลและข้อผิดพลาด (Information Disclosure & Error Handling)

STOP (หยุดทันทีแล้วรายงาน ถ้าเข้าเงื่อนไขใด):
  - ถ้าพบช่องโหว่ระดับ Critical รุนแรงสูงที่ทำให้ระบบถูกแฮกได้ทันที ให้หยุดและแจ้งเตือนด่วน
  - ถ้าผลรัน npm test มีจำนวนข้อผิดพลาดเพิ่มเกิน 4 ตัวเดิมใน baseline
  - ถ้าต้องใช้เวลาวิเคราะห์เกิน 30 รอบคำสั่ง ให้หยุดและสรุปเฉพาะข้อสำคัญที่สุดที่พบก่อน

CONTRACT:
  1. การตรวจสอบต้องครอบคลุม:
     - ช่องโหว่การปลอมแปลง Token หรือเซสชันหมดอายุใน admin-auth.ts
     - การเข้าถึงรูปสเก็ตช์หรือสลิปของลูกค้ารายอื่นโดยรู้เพียง id ใน leads.ts
     - การตรวจสอบนามสกุลไฟล์เทียบกับ Magic Bytes จริงในการอัปโหลดรูป
     - ความทนทานของ in-memory rate limiter เมื่อรีสตาร์ทหรือมีผู้ใช้จำนวนมาก
  2. ข้อความรายงานต้องเป็นภาษาไทย สุภาพ กระชับ อิงข้อเท็จจริงตามโค้ดจริง
```

---

## ตราใบงาน — เช็คลิสต์มาตรฐาน 12 ข้อ

| # | ข้อ | ผล |
|---|---|---|
| 1 | งานเดียว จบในใบเดียว | ✅ ตรวจสอบความปลอดภัย API Server |
| 2 | GOAL วัดได้ | ✅ ระบุช่องโหว่ + ความรุนแรง + แนวทางแก้ |
| 3 | SCOPE ระบุไฟล์ + path ตรงผู้อ่าน | ✅ 5 ไฟล์ absolute ชัยเข้าถึงได้จริง |
| 4 | FORBIDDEN ชัด | ✅ ห้ามแก้โค้ด production, ห้ามยิงโจมตีจริง, ห้ามเปิดเผย secret |
| 5 | EVIDENCE เป็นคำสั่ง/ตัวเลข | ✅ npm audit + npm test 251/247/4 + ชี้บรรทัดจริง |
| 6 | OUTPUT ชัด | ✅ ตารางสรุป 5 ระดับ + แผนแก้ 5 ด้าน |
| 7 | STOP วัดได้ | ✅ 3 เงื่อนไข มีตัวเลข baseline |
| 8 | baseline วัดจาก environment ผู้รับ | ✅ tests 251 / pass 247 / fail 4 |
| 9 | CONTRACT ระบุประเด็นตรวจจริง | ✅ OWASP 4 หมวดหลัก |
| 10 | ไม่ขัดกันเอง | ✅ ไม่มีข้อขัดแย้ง |
| 11 | ข้อความไทยไม่ใช้ chr()/escape | ✅ UTF-8 ล้วน |
| 12 | path ตรงผู้อ่าน (ชัย = absolute) | ✅ absolute path ทั้งหมด |
