# ใบงาน 414-B (บอย) — **ปุ่ม LINE บนเดสก์ท็อป + "เข้าสู่ระบบด้วย LINE" + ผูกตัวตนกับลีด (ใบเดียว · PR เดียว)**

**วันที่:** 10 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **บอย** (บอสยืนยัน 10 ต.ค. 69: "บอย = Qwen เป็นคนเดียวกัน") · **ผู้ตรวจรับ:** **บอส** (เดวิดตรวจ+merge)
**ที่มา:** บอสทดสอบกดปุ่ม "ทักคุยผ่าน LINE" บนเดสก์ท็อป → ถูกพาไปหน้าโฆษณา LINE (ตายบน) · บอสอนุมัติให้รวม **เฟส 1 (แก้ปุ่ม) + เฟส 2 (รู้ว่าเป็นใคร)** เป็นใบเดียวและ PR เดียว

```
✅ มาตรฐานการออกใบงาน · 12/12 · 10 ต.ค. 69 · เดวิด

GOAL:
  A. **หยุด "ตายบน" บนเดสก์ท็อป** — ปุ่ม "ทักคุยผ่าน LINE" ในกล่องขอราคา/สอบถาม แยกตามอุปกรณ์
       · มือถือ: คงลิงก์เดิม `https://line.me/R/oaMessage/%40789gcnhq/?text=<ข้อความสรุป>` (เปิดแชท OA พร้อมข้อความ — ดีอยู่แล้ว)
       · เดสก์ท็อป: **ห้ามพาออกจากเว็บ** ให้เปิดกล่องในเว็บที่มี
           (1) รูป QR ของ OA: `https://qr-official.line.me/sid/L/789gcnhq.png` (360×360 · ตรวจแล้วเป็น QR จริง)
           (2) ปุ่ม "เปิดหน้าเพิ่มเพื่อน" → `https://line.me/R/ti/p/@789gcnhq` (ลิงก์ที่ถูกบนคอม = หน้า "Scan QR code to add friend")
           (3) ปุ่ม "คัดลอกข้อความสรุป" (คัดลอกข้อความเดียวกับที่จะส่งใน LINE)
           (4) ประโยคสั้น: "บนคอมพิวเตอร์ ให้สแกน QR ด้วยมือถือ LINE หรือคัดลอกข้อความไปส่งในแชท"
       · เหตุผลที่มีหลักฐาน: `oaMessage` เป็น deep link มือถือ — บนเดสก์ท็อปโดน redirect 2 ต่อไป `https://www.line.me/en/` (วัดจริงแล้ว)
  B. **"เข้าสู่ระบบด้วย LINE" (ไม่บังคับ)** — ใช้ระบบ LINE Login ที่มีอยู่แล้วในแอป (ห้ามสร้างใหม่)
       · ปุ่ม/ลิงก์ → `GET /api/auth/line/login?returnTo=<encodeURIComponent(หน้าปัจจุบัน)>`
       · อ่านสถานะด้วย `GET /api/auth/line/status` → `{configured, authenticated, user:{userId, displayName, pictureUrl}}`
       · ล็อกอินแล้ว: แสดง **ชื่อที่แสดง + รูปโปรไฟล์** และเปลี่ยนปุ่ม LINE เป็น "ส่งเข้าแชท LINE ของคุณ"
       · ยังไม่ล็อกอิน: ทุกอย่างต้องใช้ได้เหมือนเดิม (QR/โทรกลับ/คัดลอกข้อความ) — **ห้ามบังคับล็อกอิน**
  C. **ผูกตัวตนกับลีด (ส่วน API — บอสอนุมัติให้รวมใน PR นี้)** — ปัจจุบัน endpoint กล่องนี้ไม่ได้อ่าน session
       · `/api/public/portfolio/inquiry` (`artifacts/api-server/src/routes/portfolio.ts:257`) ต้องอ่าน cookie `knight_line_session`
         ผ่าน `findAuthenticatedAccount()` (มีให้ใช้แล้วที่ `routes/line-auth.ts`) แล้ว **บันทึก `customerAccountId` ลงแถวลีด** เมื่อมี session
       · **ห้ามรับ userId/ตัวตนจากฝั่ง client** — ตัวตนต้องมาจาก session ที่ตรวจแล้วเท่านั้น (ฝั่งเว็บส่งได้แค่ข้อความ)
       · ⚠️ ไฟล์นี้ปกติเป็นขอบเขตของชัย — รอบนี้บอสสั่งให้รวมเป็น PR เดียว จึงให้บอยแก้ **เฉพาะที่จำเป็นจริง** และ **ห้ามแตะไฟล์ api-server อื่น**
  D. **เทสต์ + พิสูจน์สองทาง** สำหรับทุกข้อ A–C
  E. **ห้ามทำพังของเดิม:** ฟอร์มโทรกลับ/เบอร์โทร · การส่งลีดเข้า Telegram · ข้อความสรุปที่มีรุ่น+ราคา+URL · โหมดมือถือ

SCOPE (แก้ได้เฉพาะที่ระบุ — ไฟล์อื่นห้ามแตะ):
  - (รีโป) `artifacts/knight-basins/src/components/PortfolioInquiryModal.tsx`     (ปุ่ม LINE + กล่องใหม่ + สถานะล็อกอิน)
  - (รีโป) `artifacts/api-server/src/routes/portfolio.ts`                          (**เฉพาะ** handler `/public/portfolio/inquiry` — ผูก `customerAccountId`)
  - (รีโป) `artifacts/api-server/src/routes/line-auth.ts`                          (อ่านเท่านั้น — ใช้ `findAuthenticatedAccount`/`SESSION_COOKIE` ที่ export อยู่)
  - (รีโป) เทสต์ที่เกี่ยวข้อง เช่น `artifacts/knight-basins/test/portfolio-inquiry*.test.ts` · `artifacts/knight-basins/test/portfolio-inquiry-search.test.ts` · เทสต์ api-server ของ portfolio inquiry
  - /opt/data/knight-design-kb/qa/proposal-line-identity-dm-v2-20261010.md          (ข้อเสนอที่อนุมัติ — อ่าน)
  - /opt/data/knight-design-kb/qa/report-boy-line-desktop-login-20261010.md         (ใหม่) รายงานของคุณ
  - /opt/data/bin/job_standard_check.py                                             (ตัวตรวจมาตรฐานใบงาน)

FORBIDDEN:
  - ห้ามบังคับล็อกอิน · ห้ามซ่อนทางออกที่ไม่ต้องล็อกอิน (QR / เบอร์โทร / คัดลอกข้อความ) — ต้องมีครบ
  - ห้ามแก้ไฟล์ api-server อื่นนอกจาก `routes/portfolio.ts` (และห้ามแก้ `line-auth.ts` — อ่านเท่านั้น)
  - ห้ามรับ userId/ชื่อ/ตัวตนที่ลูกค้าส่งมาจาก client เป็น "ตัวตนจริง" — ต้องมาจาก session เท่านั้น
  - ห้ามแตะ `src/data/**` · `artifacts/api-server/**` (อื่นจากที่ระบุ) · ราคา · JSON-LD · nginx · DB
  - ห้าม commit เข้า `main` ตรง ๆ · ห้าม merge PR เอง · ห้ามใช้/พิมพ์ค่าลับ (channel secret/token/session secret)
  - ข้อที่ตรวจไม่ได้ให้เขียน **"ตรวจไม่ได้ + เหตุผล"** — ห้ามเดาว่าผ่าน

EVIDENCE (ต้องแนบผลจริง — คำสั่ง/ผลรัน/ตัวเลข):
  1) `git diff --stat` + `git log -1 --format=%H` ของสาขา
  2) เทสต์ที่แตะ: `cd artifacts/knight-basins && node --experimental-strip-types --test test/portfolio-inquiry.test.ts test/portfolio-inquiry-search.test.ts` (หรือชื่อไฟล์ที่คุณเพิ่ม)
  3) เต็มชุด: `cd artifacts/knight-basins && node --experimental-strip-types --test test/*.test.ts` — baseline: **tests 1249 · ผ่าน 1207 · ตก 0 · ข้าม 42** (บน Linux)
  4) `cd artifacts/knight-basins && npx tsc -p tsconfig.json --noEmit` → ต้องได้ **0**
  5) **พิสูจน์สองทาง** อย่างน้อย 2 จุด: (ก) เอากล่องเดสก์ท็อปออก → เทสต์ต้องตก · (ข) เอาผูก `customerAccountId` ออก → เทสต์ต้องตก · คืนแล้วผ่านครบ (แนบข้อความ assert ที่ตกมาด้วย)
  6) ยืนยัน QR + ti/p: `curl -s -o /dev/null -w '%{http_code} %{size_download}' https://qr-official.line.me/sid/L/789gcnhq.png` และ `https://line.me/R/ti/p/@789gcnhq` → ต้องได้ **200** ทั้งคู่
  7) ยืนยันเส้นทางล็อกอินจริง: `curl -s -o /dev/null -w '%{http_code} → %{redirect_url}' "https://knightbasins.com/api/auth/line/login?returnTo=%2Fstone"` → ต้องได้ **302** ไป `access.line.me`
  8) อธิบายพร้อมบรรทัด: วันที่/อุปกรณ์ที่เลือกใช้กล่องใหม่ (breakpoint ที่ใช้) และเหตุผล
  9) รายงานว่าอะไร **ตรวจไม่ได้** (เช่น พฤติกรรมในแอป LINE จริงบนมือถือ) + วิธีที่เดวิดจะตรวจต่อ
  10) เวลาไทยที่ทำ + hash commit

OUTPUT:
  - PR เดียวชื่อแนะนำ `feat(line): desktop LINE dialog + optional LINE login + bind account to inquiry lead`
  - `/opt/data/knight-design-kb/qa/report-boy-line-desktop-login-20261010.md` — สรุป A–E + หลักฐาน
  - สรุป 5 บรรทัด: ทำอะไร · เทสต์ผ่าน/ไม่ผ่าน · ตรวจไม่ได้อะไร · ความเสี่ยง · ข้อเสนอ

STOP:
  - ครบ A–E พร้อมหลักฐาน · หรือทำครบ **18 turns** ให้หยุดและรายงานสิ่งที่เสร็จ + ที่เหลือ
  - **ถ้าเทสต์ชุดเดิมตกเกิน 3 ไฟล์จากการแก้ หรือต้องแตะไฟล์ api-server เพิ่มจากที่ระบุ → หยุดและแจ้งเดวิดทันที**
```

## เช็คลิสต์ท้ายใบ (ติ๊กในรายงาน/PR)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ผ่าน |
|---|---|---|
| 1 | มือถือยังใช้ `oaMessage` | ลิงก์เดิม + ข้อความสรุปครบ |
| 2 | เดสก์ท็อปไม่พาออกจากเว็บ | เปิดกล่องในเว็บ (ไม่ navigate ไป line.me) |
| 3 | QR ในกล่อง | URL `qr-official.line.me/sid/L/789gcnhq.png` + ยิงได้ 200 |
| 4 | ปุ่ม "เปิดหน้าเพิ่มเพื่อน" | `line.me/R/ti/p/@789gcnhq` + ยิงได้ 200 |
| 5 | ปุ่มคัดลอกข้อความสรุป | คัดลอกได้ข้อความเดียวกับที่ส่งใน LINE |
| 6 | ปุ่ม "เข้าสู่ระบบด้วย LINE" | ลิงก์ไป `/api/auth/line/login?returnTo=…` |
| 7 | ไม่บังคับล็อกอิน | ทางออก QR/โทร/คัดลอก ใช้ได้โดยไม่ล็อกอิน |
| 8 | แสดงชื่อ/รูปหลังล็อกอิน | อ่านจาก `/api/auth/line/status` (ไม่ใช่ข้อมูลที่ client แต่ง) |
| 9 | ลีดผูกบัญชีลูกค้า | `customerAccountId` ถูกบันทึกเมื่อมี session (ฝั่ง server) |
| 10 | ไม่รับตัวตนจาก client | ตรวจด้วยเทสต์/รีวิวโค้ด |
| 11 | เทสต์ + พิสูจน์สองทาง | ผ่านครบ + ตกก่อนแก้ (แนบหลักฐาน) |
| 12 | เต็มชุด + typecheck | ผ่าน 1207 / ตก 0 · `tsc --noEmit` = 0 |

> [เดวิด → บอย]
> ใบนี้รวม **เฟส 1 + เฟส 2** เป็นใบเดียว/PR เดียวตามที่บอสสั่งครับ
> · **ปุ่ม LINE บนเดสก์ท็อป:** deep link `oaMessage` ใช้ได้เฉพาะมือถือ — บนคอมมัน redirect ไปหน้าโฆษณา LINE (ผมวัดจริง: 2 ต่อ → `www.line.me/en/`) ⇒ เดสก์ท็อปให้เปิดกล่องในเว็บที่มี QR ของ OA + ปุ่ม "เปิดหน้าเพิ่มเพื่อน" (`line.me/R/ti/p/@789gcnhq`) + ปุ่มคัดลอกข้อความสรุป
> · **เข้าสู่ระบบด้วย LINE:** มีระบบอยู่แล้วในแอป (`/api/auth/line/login` · `/api/auth/line/status` · cookie 30 วัน · ตาราง `customer_accounts.line_user_id`) — **ห้ามสร้างใหม่** · และ **ห้ามบังคับล็อกอิน** (บอสยืนยันตามที่ผมเสนอ)
> · **ผูกตัวตนกับลีด:** เพิ่มแค่ให้ endpoint `/api/public/portfolio/inquiry` อ่าน `knight_line_session` แล้วเขียน `customerAccountId` — ใช้ `findAuthenticatedAccount()` ที่มีอยู่ · ⚠️ ไฟล์นี้ปกติเป็นของชัย แต่บอสสั่งรวม PR เดียว ⇒ แก้ **เฉพาะที่จำเป็น** และห้ามแตะไฟล์ api-server อื่น
> · เก็บข้อมูลตามที่บอสอนุมัติ: userId + ชื่อที่แสดง + รูปโปรไฟล์ + **เบอร์โทรที่ลูกค้ากรอก** (ไม่ต้องร่างนโยบาย)
> · baseline เต็มชุด = **ผ่าน 1207 / ตก 0** · `tsc --noEmit` = 0 · ต้องมี **พิสูจน์สองทาง** ทุกจุดที่แก้
> · เสร็จแล้ว **เปิด PR ไม่ต้อง merge** — เดวิดตรวจ (รวมถึงให้ชัยตรวจส่วน api ตามธรรมเนียม) แล้ว merge ให้
> เกณฑ์ 12 ข้อ + รายละเอียดเต็ม: `qa/job-414-boy-line-desktop-login.md`
