# รายงานตรวจสอบช่องโหว่ความปลอดภัย API Server (OWASP API Security Top 10)

- **วันที่ตรวจ:** 25 ก.ย. 2569
- **ผู้ตรวจ:** ชัย (Claude Code)
- **Branch:** `audit/chai-api-security-owasp`
- **ขอบเขต:** วิเคราะห์ source code เท่านั้น ไม่มีการยิง request ใส่ production จริง
  - `artifacts/api-server/src/middlewares/admin-auth.ts`
  - `artifacts/api-server/src/routes/leads.ts`
  - `artifacts/api-server/src/routes/admin-router.ts`
  - `artifacts/api-server/src/lib/rate-limit.ts`
  - `artifacts/api-server/src/lib/slipok.ts`
  - อ่านเพิ่มเติมนอก SCOPE เพื่อวิเคราะห์ตามหัวข้อที่ CONTRACT ระบุ (ไม่ได้แก้ไข): `src/lib/image-upload.ts` (ตรวจ Magic Bytes ที่ CONTRACT ข้อ 1 ระบุ), `src/lib/quote-access.ts` (กลไกกันสิทธิ์เข้าถึงใบเสนอราคาลูกค้าที่ leads.ts เรียกใช้)

## สรุปภาพรวม

**ไม่พบช่องโหว่ระดับ Critical ที่แฮกระบบได้ทันที** งานส่วนที่ตรวจสอบสร้างมาค่อนข้างรัดกุม (เซสชันเซ็นด้วย HMAC, เข้าถึงใบเสนอราคาด้วย secret 256-bit ไม่ใช่ id เดา, อัปโหลดไฟล์ตรวจ Magic Bytes จริง) แต่พบจุดที่ควรแก้ไข 5 จุด ระดับ Medium/Low ตามตาราง

| # | ไฟล์:บรรทัด | ระดับความเสี่ยง | ช่องโหว่ | แนวทางแก้ไข |
|---|---|---|---|---|
| 1 | `lib/rate-limit.ts:15,26-31` | **Medium** | Rate limiter เก็บ state ใน `Map` ในหน่วยความจำ process เดียว ไม่มีการเก็บกวาด (sweep) entry เก่า | ใช้ store กลาง (Redis) หรือเพิ่ม periodic sweep + TTL |
| 2 | `middlewares/admin-auth.ts:104-112,306-325` | **Medium** | Session token เป็น self-signed token ไม่มี server-side revocation — token ที่หลุดจะใช้ได้จนหมดอายุ (12 ชม.) แม้กด "ออกจากระบบ" | เพิ่มตาราง/แคช denylist สำหรับ token ที่ถูกเพิกถอน |
| 3 | `middlewares/admin-auth.ts:122` | **Medium** | Cookie `Secure` flag อิงตาม string `NODE_ENV === "production"` เท่านั้น ไม่ได้ตรวจการเชื่อมต่อจริง | เปลี่ยนไปอิง `req.secure` (ใช้ได้เพราะตั้ง `trust proxy` แล้ว) หรือเพิ่ม assertion ตอนสตาร์ท |
| 4 | `lib/image-upload.ts:303-351` | **Low** | ไฟล์ที่อัปโหลด (sketch/slip) ถูกเก็บและเสิร์ฟตรงโดยไม่ล้าง EXIF อาจมีพิกัด GPS ของลูกค้าติดไปกับรูป | ล้าง EXIF ด้วยไลบรารีประมวลผลภาพก่อนบันทึก (เช่น sharp) |
| 5 | `routes/leads.ts:144` (`GET /quotes`) | **Low** | endpoint นี้ไม่มี rate limit ต่างจาก endpoint อื่นในไฟล์เดียวกัน (ความเสี่ยงจริงต่ำเพราะต้องเดา secret 256-bit) | เพิ่ม rate limiter แบบเดียวกับ `/quotes/notify` เพื่อป้องกันการ scrape/DoS |

---

## 1. การพิสูจน์ตัวตนและเซสชัน (Authentication & Sessions)

**จุดแข็งที่พบ:**
- Session token เป็น `payload.signature` เซ็นด้วย HMAC-SHA256 และตรวจสอบด้วย `timingSafeEqual` ([admin-auth.ts:80-97](artifacts/api-server/src/middlewares/admin-auth.ts#L80-L97)) ป้องกันการปลอมแปลง token และ timing attack ได้ดี
- Token มีเวลาหมดอายุฝังในตัว (`expiresAt`) และตรวจก่อนใช้งานทุกครั้ง ([admin-auth.ts:96](artifacts/api-server/src/middlewares/admin-auth.ts#L96))
- ถ้า `SESSION_SECRET` ไม่ถูกตั้งค่า ระบบ throw error ทันที ไม่ fallback ไปใช้ค่า default ที่ไม่ปลอดภัย ([admin-auth.ts:74-78](artifacts/api-server/src/middlewares/admin-auth.ts#L74-L78))
- Login endpoint มี rate limit (5 ครั้ง/นาที/IP) ป้องกัน brute-force รหัสผ่าน ([admin-router.ts:1072,1120](artifacts/api-server/src/routes/admin-router.ts#L1072))

**ช่องโหว่ #2 (Medium) — ไม่มีการเพิกถอน (revoke) session ฝั่งเซิร์ฟเวอร์**

```ts
// admin-auth.ts:104-108
export function createAdminToken(memberId?: number) {
  const expiresAt = Date.now() + SESSION_AGE_MS;
  const payload = memberId ? `${expiresAt}:member:${memberId}` : String(expiresAt);
  return `${payload}.${sign(payload)}`;
}
```

Token ตรวจสอบด้วยลายเซ็น + วันหมดอายุเท่านั้น ไม่มีการอ้างอิงกลับไปที่ฐานข้อมูล/แคชใด ๆ ว่า token นี้ "ยังใช้ได้อยู่หรือถูกเพิกถอนแล้ว" ผลคือ:
- ถ้า token หลุด (เช่น จาก log, เบราว์เซอร์ที่ใช้ร่วมกัน, หรือแอดมินลาออก) จะใช้งานต่อได้จนครบ 12 ชม. แม้เจ้าของระบบจะกด logout หรือปิดสิทธิ์สมาชิกทีมแล้วก็ตาม (การปิดสิทธิ์สมาชิกทีมใน `admin_members.active` มีผลจริง เพราะ `findActiveAdminMember` เช็ค DB ทุกครั้ง แต่ token แบบรหัสผ่านล้วน — ไม่มี memberId — **ไม่มีทางเพิกถอนได้เลย** เพราะไม่ผูกกับอะไรในฐานข้อมูล)
- `DELETE /admin/session` ([admin-router.ts:998-1001](artifacts/api-server/src/routes/admin-router.ts#L998)) แค่ `res.clearCookie(...)` ที่ฝั่งเบราว์เซอร์ ไม่ได้ทำให้ตัว token เป็นโมฆะฝั่งเซิร์ฟเวอร์

**แนวทางแก้ไข:**
```ts
// เพิ่มตาราง admin_revoked_tokens (tokenHash, revokedAt) แล้วเช็คใน tokenPayload()
function tokenPayload(token: string | undefined) {
  // ... existing signature/expiry checks ...
  if (await isTokenRevoked(hashToken(token))) return null;
  return { expiresAt, memberId };
}
```
สำหรับ session แบบรหัสผ่านอย่างเดียว (ไม่มี memberId) อาจเพิ่ม "epoch" ค่าหนึ่งใน env ที่เพิ่มขึ้นทุกครั้งที่ต้องการบังคับให้ทุก session หมดอายุพร้อมกัน (เช่น หลังเปลี่ยนรหัสผ่านแอดมิน)

**ช่องโหว่ #3 (Medium) — Cookie `Secure` flag อิงตาม string เดียว**

```ts
// admin-auth.ts:118-126
export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env["NODE_ENV"] === "production",
    maxAge: SESSION_AGE_MS,
    path: "/",
  };
}
```
ถ้า deploy จริงลืมตั้ง `NODE_ENV=production` (เช่น รันด้วย `node dist/index.mjs` ตรง ๆ โดยไม่ตั้ง env, หรือ container image ไม่ได้ pass env ตัวนี้) cookie จะถูกส่งได้แม้ผ่าน HTTP ธรรมดา เปิดช่องให้ดักฟัง session บนเครือข่ายที่ไม่ปลอดภัยได้ (`app.ts:12` ตั้ง `trust proxy: 1` ไว้แล้ว จึง `req.secure` ใช้งานได้ถูกต้องหลัง Traefik)

**แนวทางแก้ไข:**
```ts
export function adminCookieOptions(req: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: req.secure || process.env["NODE_ENV"] === "production",
    maxAge: SESSION_AGE_MS,
    path: "/",
  };
}
```

---

## 2. สิทธิ์การเข้าถึงข้อมูลลูกค้า (Broken Object Level Authorization / IDOR)

**จุดแข็งที่พบ — ออกแบบป้องกัน IDOR ได้ดี:**

หน้าลูกค้า (`GET /quotes`, `POST /quotes/notify`, `POST /leads/payment-slip` ใน `leads.ts`) **ไม่ได้ใช้ตัวเลข lead id ตรง ๆ** เป็นตัวควบคุมการเข้าถึงเลย แต่ใช้ token ที่ประกอบด้วย `quoteNumber` + `accessSecret` แบบสุ่ม 256 บิต เซ็นด้วย HMAC ([quote-access.ts:32-44](artifacts/api-server/src/lib/quote-access.ts#L32-L44)) แล้วเทียบด้วย `timingSafeEqual` ([quote-access.ts:65-68](artifacts/api-server/src/lib/quote-access.ts#L65-L68)):

```ts
// leads.ts:150-162 (ตัวอย่าง GET /quotes)
const [lead] = await database.select().from(customerLeads)
  .where(eq(customerLeads.quoteNumber, access.quoteNumber)).limit(1);
if (!lead || ... || !quoteAccessSecretMatches(lead.quoteAccessSecret, access.accessSecret)) {
  return res.status(404).json({ message: "Quote not found" });
}
```
ลูกค้า A เดาหรือไล่เลข quoteNumber ของลูกค้า B **ใช้ไม่ได้** เพราะยังขาด `accessSecret` 256 บิตที่สุ่มต่อ lead ผลคือช่องโหว่ IDOR แบบคลาสสิก (เปลี่ยนเลข id ใน URL แล้วเห็นข้อมูลคนอื่น) **ไม่พบในเส้นทางที่ลูกค้าเรียกถึง**

ฝั่งแอดมิน (`admin-router.ts`) เข้าถึง lead ของลูกค้าคนไหนก็ได้ตาม `:id` แต่เป็นการออกแบบที่ตั้งใจ (แอดมินต้องเห็นทุก lead) และมี `requireAdminPermission("leads", ...)` คุมทุก route ที่ตรวจแล้ว ([admin-router.ts:1529,1573,1601,1729](artifacts/api-server/src/routes/admin-router.ts#L1529)) จึงไม่ถือเป็น IDOR แต่เป็นสิทธิ์ตามบทบาทที่ถูกต้อง

**ไม่พบช่องโหว่ระดับ Critical/High ในหัวข้อนี้**

---

## 3. การรับส่งและอัปโหลดไฟล์ (File Upload, MIME type vs Magic Bytes)

**จุดแข็งที่พบ:** ระบบตรวจ **ทั้ง MIME type ที่ client ส่งมา และ Magic Bytes จริงของไฟล์** ไม่เชื่อ MIME/extension อย่างเดียว:

```ts
// image-upload.ts:160-168, ใช้งานที่บรรทัด 230 และ 292
function hasFileSignature(buffer: Buffer, contentType: string) {
  if (contentType === "image/jpeg") return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (contentType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  // ... webp / gif / mp4 / webm ตรวจ signature จริงเช่นกัน
}
```
ไฟล์ที่ผ่านการตรวจจะถูกตั้งชื่อใหม่ด้วย token สุ่ม (`crypto.randomBytes(8)`) ไม่ใช้ชื่อไฟล์จาก client ป้องกัน path traversal ได้ ([image-upload.ts:310-320](artifacts/api-server/src/lib/image-upload.ts#L310-L320)) และมีการตรวจ `filePath.startsWith(uploadRoot)` ซ้ำอีกชั้นก่อนเขียนไฟล์จริง

Response header `X-Content-Type-Options: nosniff` ถูกตั้งไว้ทุก response ใน `app.ts` (ครอบคลุม route เสิร์ฟไฟล์อัปโหลดด้วย เพราะ middleware ตั้งค่าก่อน `express.static` ถูก mount) ทำให้เบราว์เซอร์ไม่เดา content-type เอง ลดความเสี่ยงไฟล์แปลกปลอมถูกตีความเป็น HTML/JS

**ช่องโหว่ #4 (Low) — ไม่ล้าง EXIF metadata ของรูปที่ลูกค้าอัปโหลด**

รูปสเก็ตช์/สลิปที่ลูกค้าถ่ายจากมือถือมักมี EXIF ฝังพิกัด GPS ที่ถ่าย ระบบบันทึกไฟล์ดิบเข้า disk ตรง ๆ โดยไม่ผ่านการประมวลผลใด ๆ ([image-upload.ts:334-335](artifacts/api-server/src/lib/image-upload.ts#L334)):
```ts
try {
  await handle.writeFile(media.buffer); // ไม่มีขั้นตอน strip EXIF
}
```
URL ของไฟล์ (`sketchUrl`) ถูกเก็บใน `studioData` และเป็นส่วนหนึ่งของ `publicQuoteResponse` ที่ส่งกลับไปหน้าใบเสนอราคา — ถ้ามีการแชร์ลิงก์ต่อ (เช่น แคปหน้าจอ หรือ copy URL รูปไปแปะที่อื่น) พิกัด GPS ในรูปจะหลุดไปด้วย แม้ตัวหน้าเว็บจะไม่แสดงพิกัดนั้นตรง ๆ

**แนวทางแก้ไข:**
```ts
import sharp from "sharp";
// ก่อน handle.writeFile(media.buffer):
const stripped = await sharp(media.buffer).rotate().withMetadata({ exif: {} }).toBuffer();
await handle.writeFile(stripped);
```

---

## 4. การจำกัดอัตราการเรียกใช้งาน (Rate Limiting & DoS Protection)

**ช่องโหว่ #1 (Medium) — In-memory rate limiter ไม่ทนต่อการรีสตาร์ทและไม่มีการเก็บกวาด**

```ts
// rate-limit.ts:15,26-31
const buckets = new Map<string, Bucket>();
// ...
const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + options.windowMs };
bucket.count += 1;
buckets.set(key, bucket);
```

พบ 2 ปัญหาซ้อนกันในจุดเดียว:
1. **รีสตาร์ทแล้วนับใหม่หมด** — `buckets` อยู่ใน RAM ของ process เดียว ทุกครั้งที่ deploy/restart (ปกติของ CI/CD auto-deploy ที่ใช้อยู่) ตัวนับ rate limit ทุกตัวรีเซ็ตเป็น 0 ทันที ผู้โจมตีที่ตั้งเวลาให้ตรงกับช่วง deploy จะได้โควตาการยิง login/upload ใหม่ทุกครั้ง
2. **ไม่มีการเก็บกวาด entry เก่า (no TTL sweep)** — key ที่ไม่ถูกเรียกซ้ำจะค้างอยู่ใน `Map` ตลอดไป โดยเฉพาะ limiter ที่ผสม key แบบไดนามิกอย่าง `notificationRateLimit` ที่ผูกกับทั้ง IP และ token ของลูกค้า ([leads.ts:56-61](artifacts/api-server/src/routes/leads.ts#L56-L61)):
   ```ts
   const notificationRateLimit = createRateLimiter({
     name: "quote-notification", max: 3, windowMs: 15 * 60 * 1000,
     key: (req) => `${req.ip}:${String(req.body?.token ?? "")}`,
   });
   ```
   ผู้โจมตีที่ยิง request พร้อมสุ่ม/เปลี่ยน `token` ในทุกครั้ง จะสร้าง key ใหม่ใน `Map` ไม่รู้จบ ทำให้หน่วยความจำโตขึ้นเรื่อย ๆ จนกระทบ process (memory-exhaustion DoS ระดับเบา ๆ)
3. ถ้า deploy มากกว่า 1 instance (horizontal scale) ในอนาคต แต่ละ instance มี `Map` แยกกัน ทำให้ limit จริงกลายเป็น `max × จำนวน instance`

**แนวทางแก้ไข:**
```ts
// เพิ่ม sweep เป็นระยะ กัน memory โต ไม่จำกัด
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, 5 * 60 * 1000).unref();
```
ถ้าจะรองรับหลาย instance ในอนาคต ควรย้ายไป Redis (`INCR` + `EXPIRE`) แทน `Map` ในหน่วยความจำ

**จุดที่ตรวจแล้วไม่พบปัญหา:** endpoint ที่มีผลกระทบสูง (`POST /admin/session`, `POST /leads/sketch`, `POST /leads/payment-slip`) มี rate limit ครบทุกตัว และ `createConcurrencyLimiter` ([rate-limit.ts:44-63](artifacts/api-server/src/lib/rate-limit.ts#L44)) ช่วยกัน DoS จากการอัปโหลดพร้อมกันจำนวนมากได้อีกชั้น

**ช่องโหว่ #5 (Low) — `GET /quotes` ไม่มี rate limit**

Endpoint เดียวในกลุ่ม public quote ที่ไม่ผ่าน `createRateLimiter` เลย ([leads.ts:144](artifacts/api-server/src/routes/leads.ts#L144)) ต่างจาก `/quotes/notify` ที่มี ความเสี่ยงจริงต่ำมากเพราะยังต้องรู้ `accessSecret` 256 บิตที่เดาไม่ได้ในทางปฏิบัติ แต่ควรใส่ไว้เป็นเกราะป้องกันชั้นที่สอง (defense in depth) เผื่อ secret รั่วจากช่องทางอื่นในอนาคต

---

## 5. ข้อมูลรั่วไหลและข้อผิดพลาด (Information Disclosure & Error Handling)

**จุดแข็งที่พบ:**
- Global error handler ใน `app.ts:78-86` ส่งข้อความทั่วไป `"Internal server error"` กลับไปเสมอ ไม่แสดง stack trace หรือ query SQL ให้ client เห็น
- ทุกจุดที่ตรวจใน `admin-router.ts`/`leads.ts` ที่ส่ง `error.message` กลับไปหา client (เช่น [admin-router.ts:1849-1850](artifacts/api-server/src/routes/admin-router.ts#L1849)) มีการ `test` ข้อความด้วย regex ก่อนเสมอ (`/required|invalid|choose|allowed|large/i`) เพื่อให้มั่นใจว่าเป็นข้อความ validation ที่เขียนเองเท่านั้น ไม่ใช่ raw error จาก DB/OS หลุดออกไป
- Security header set ครบใน `app.ts:59-68`: CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, และ `HSTS` เมื่อ production

**ไม่พบช่องโหว่ระดับ High ในหัวข้อนี้ภายใน SCOPE ที่ตรวจ** ข้อสังเกตเดียวคือ log กลาง (`pino-http` ใน `app.ts:14-32`) log เฉพาะ `method`/`url`/`statusCode` ไม่ log request body จึงไม่มีความเสี่ยง credential รั่วเข้า log จากจุดนี้

---

## หมายเหตุปิดท้าย

- **EVIDENCE #2** (`npm test`): `tests 251 / pass 247 / fail 4` — ตรงกับ baseline ที่เดวิดวัดไว้เป๊ะ ความล้มเหลว 4 ตัวเป็นปัญหาสภาพแวดล้อม sandbox เดิม (`getaddrinfo ENOTFOUND support-route-test`) ไม่เกี่ยวกับงานนี้
- **EVIDENCE #3** (`npm audit`): repo นี้เป็น pnpm workspace ไม่มี `package-lock.json` ทำให้ `npm audit --omit=dev` รันไม่ได้ (`ENOLOCK`) ใช้ `pnpm audit --prod` แทนซึ่งเทียบเท่ากัน ผลคือ **"No known vulnerabilities found"** (0 Critical/High/Moderate/Low ใน dependency ทั้ง workspace)
- ไม่มีการรันคำสั่งโจมตีหรือยิง request ใส่ URL production จริงตามที่ FORBIDDEN ระบุ การวิเคราะห์ทั้งหมดอ่านจาก source code เท่านั้น
- ไม่พบช่องโหว่ระดับ Critical ที่เข้าเงื่อนไข STOP จึงดำเนินการจนจบและสรุปรายงานฉบับเต็ม
