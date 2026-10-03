# ใบงาน 225 (Security & Auth Hardening) — ปิดช่องโหว่ Rate Limit Bypass, LINE Open Redirect และป้องกัน Deploy Concurrency

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead)
**สถานะ:** มอบหมายให้ ชัย (Claude CLI) · ภารกิจความปลอดภัยระบบหลัก (Quick-Fix Sprint)
**Branch:** `feat/chai-security-auth-and-deploy-concurrency`
**ที่มา:** จากการตรวจพบช่องโหว่ความปลอดภัยร่วมกันระหว่างชัยและ Replit: (1) Rate limiter ใช้ User-Agent เป็นส่วนหนึ่งของ bucket key ทำให้ผู้โจมตีสุ่ม User-Agent เพื่อข้ามการจำกัดครั้งได้ (2) returnTo ใน LINE Login ยอมรับอักขระ `/\` ทำให้เกิด Open Redirect ไปยังโดเมนภายนอกได้ (3) GitHub Actions Deploy workflow ไม่มีคิว Concurrency ทำให้ deploy ซ้อนกันได้เมื่อมีการ merge ติดต่อกัน

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/api-server/src/lib/rate-limit.ts:
     - ปรับปรุงฟังก์ชัน clientKey(req): ตัดส่วนแฮช User-Agent (#fingerprint) ออกอย่างเด็ดขาด ให้คืนค่าเฉพาะ resolvedClientIp(req)
     - ⚠️ คำเตือนความปลอดภัย: ห้ามใช้ socket IP ตรงๆ เด็ดขาด เพราะเป็น IP ของคอนเทนเนอร์ nginx ซึ่งจะทำให้ผู้ใช้ทุกคนแชร์ bucket เดียวกัน ให้ใช้ resolvedClientIp(req) เดิมที่มีตรรกะ hop ของ nginx อยู่แล้ว
  2. ใน artifacts/api-server/src/routes/line-auth.ts:
     - ปรับปรุงฟังก์ชัน returnTo(value: unknown): ปฏิเสธค่าที่มีอักขระ backslash (`\`) หรือ URL-encoded backslash (`%5c`, `%5C`) หรือใช้ URL canonicalization เพื่อให้แน่ใจว่าปลายทางเป็น internal path บนโดเมนเดียวกันเท่านั้น (เช่น ขึ้นต้นด้วย `/` ตัวเดียว และไม่มี `//` หรือ `/\`) หากไม่ถูกต้องให้ fallback กลับไปที่ `/`
  3. ใน .github/workflows/deploy.yml:
     - เพิ่มการควบคุม concurrency ที่ระดับ workflow:
       concurrency:
         group: deploy-hostinger-vps
         cancel-in-progress: false
       (เพื่อให้การ deploy เรียงคิวทำงานทีละงานจนจบ ไม่รันชนกัน)
  4. ชุดทดสอบ:
     - อัปเดตและเพิ่มเคสใน artifacts/api-server/test/security-audit.test.ts:
       - ทดสอบว่าการยิงคำขอจาก IP เดิมแต่เปลี่ยน User-Agent ถูกนับใน bucket เดียวกันและติด 429 เมื่อครบโควตาจริง (กลับด้านการทดสอบเดิมบรรทัด ~254)
       - ทดสอบ returnTo ด้วยค่าอันตราย เช่น `/\evil.example/path`, `/\evil.com`, `//evil.com` ต้องถูกปฏิเสธและได้ `/`
     - artifacts/api-server/test/deploy-concurrency-guard.test.ts (หรือทดสอบโครงสร้าง deploy.yml ให้มี concurrency group)

SCOPE:
  - artifacts/api-server/src/lib/rate-limit.ts
  - artifacts/api-server/src/routes/line-auth.ts
  - .github/workflows/deploy.yml
  - artifacts/api-server/test/security-audit.test.ts
  - artifacts/api-server/test/deploy-concurrency-guard.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามใช้ req.socket.remoteAddress เป็น clientKey โดยตรงเด็ดขาด (ต้องใช้ resolvedClientIp)
  - ห้ามเปลี่ยนพฤติกรรมการ redirect ปกติของ LINE Login สำหรับ internal paths ที่ถูกต้อง
  - ห้ามลด step ความปลอดภัยเดิมใน deploy.yml

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/chai-security-auth-and-deploy-concurrency ชัดเจน
  2) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  3) node --test test/security-audit.test.ts ใน api-server → ผ่านทุกข้อ (ระบุจำนวนข้อจริง)
  4) npm test ใน artifacts/api-server (full suite baseline: 831 ผ่าน / 0 ตก / 0 ข้าม)
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/api-server/src/lib/rate-limit.ts
  - artifacts/api-server/src/routes/line-auth.ts
  - .github/workflows/deploy.yml
  - artifacts/api-server/test/security-audit.test.ts
  - artifacts/api-server/test/deploy-concurrency-guard.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และชุดทดสอบ security-audit ผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | Rate limit fix, Open redirect fix, Deploy concurrency |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | ระบุ 5 ไฟล์ชัดเจน ไม่แตะส่วนอื่น |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามใช้ socket IP ตรงๆ, index.css 0 diff |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งและ baseline 831 ข้อจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ส่งมอบตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | ระบุเงื่อนไขและจำกัด 30 turns |
| 7 | ไม่แตะไฟล์ freeze | ผ่าน | index.css 0 diff |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | 9/9 |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | ชัย (Claude CLI) |
| 10 | กฎคำสั่งบอสไม่ตกหล่น | ผ่าน | ปิดช่องโหว่ความปลอดภัย Auth/Rate Limit |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ใช้ resolvedClientIp ป้องกัน proxy spoof |
| 12 | อัปเดต KANBAN | ผ่าน | ลงทะเบียน Task 225 เรียบร้อย |
