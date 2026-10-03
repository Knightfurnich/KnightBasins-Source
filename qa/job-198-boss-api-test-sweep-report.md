# รายงานใบงาน 198 — ตรวจเทสต์ api-server ที่ตก (ชัย)

**วันที่:** 3 ต.ค. 69 · **ทำบน:** เครื่องบอส (Windows, Node ตามเครื่อง) · **ฐาน:** `main` ที่ `f3214e6` แล้ว rebase ไป `765fe9e`
**ไม่ได้แตะ:** business logic, router, production DB, VPS

## สรุปตัวเลข

| ชุด | tests | pass | fail |
|---|---|---|---|
| ก่อนแก้ (main `f3214e6`, วัดเฉพาะไฟล์) | leads-persistence 3 ข้อ | 2 | **1** (500 !== 200) |
| ก่อนแก้ (main `33e5ce1` หลัง PR #149, `npm test` ทั้งชุด) | 778 | 775 | **3** (support-route ทั้งหมด) |
| หลังแก้ (branch นี้, `npm test` 2 รอบ) | 775 | 775 | **0** |

หมายเหตุ: ตัวเลข tests ลดจาก 778 เป็น 775 เพราะ `node --test` นับ `describe` ที่ถูก skip เป็น suite ที่ข้าม ไม่นับเทสต์ข้างในเป็น "skipped" — เทสต์ support-route 3 ข้อถูกข้ามเมื่อไม่มีฐานข้อมูลทดสอบ ไม่ได้หายไป

## 1) leads-persistence — "returns and persists the complete tax and site details payload"

- **ผลก่อนแก้:** `node --test test/leads-persistence.test.ts` → pass 2 / fail 1, `500 !== 200`
- **สาเหตุ:** การบันทึก lead เซ็นลิงก์ใบเสนอราคาสาธารณะผ่าน `src/lib/quote-access.ts` ซึ่งโยน `SESSION_SECRET is required` ถ้าไม่มีตัวแปรนี้ → route ตอบ 500 เทสต์จึงผ่านเฉพาะเครื่องที่ export `SESSION_SECRET` ไว้ก่อน
- **พิสูจน์:** `SESSION_SECRET=<ค่าทดสอบ> node --test test/leads-persistence.test.ts` → 3/3 ผ่าน
- **วิธีแก้:** ให้ harness ตั้ง `SESSION_SECRET` เองใน `before()` และคืนค่าเดิมใน `after()` (รูปแบบเดียวกับ `quote-access.test.ts`)
- **สถานะ:** PR #149 (`fix/david-leads-persistence-session-secret`) merge เข้า `main` ตอน 08:31 น. ขณะใบงานนี้กำลังทำ ด้วยการแก้แบบเดียวกัน ผมจึงไม่ส่งไฟล์นี้ซ้ำ (ใช้ของ `main`) หลัง rebase ทดสอบโดยไม่ตั้งตัวแปรใดๆ ในเชลล์ → 3/3 ผ่าน

## 2) support-route — ตก 3 ข้อ

- **Error จริง:** `getaddrinfo ENOTFOUND support-route-test` บนเครื่องนี้ (`EAI_AGAIN` บนคอนเทนเนอร์ของเดวิด เป็น DNS ล้มเหลวคนละอาการ ต้นเหตุเดียวกัน) stack ชี้ไป `pg-pool` ที่เชื่อมต่อฐานข้อมูล
- **สาเหตุ:** เทสต์นี้เป็น **integration test ที่ต้องใช้ Postgres จริง** ไม่เหมือนเทสต์ route อื่นที่จำลองฐานข้อมูล: มัน `INSERT` ลง `customer_accounts`, `customer_sessions`, `customer_leads` ผ่าน `pg.Pool` และ route อ่านแคตตาล็อกจากฐานข้อมูลเดียวกัน (`getCatalogData → seedCatalogIfEmpty`) แต่ไฟล์ตั้ง `DATABASE_URL ??= "postgres://support-route-test"` ถ้าไม่มี DB จริงจึงพยายามต่อโฮสต์ที่ไม่มีอยู่ → ตกทั้ง 3 ข้อ
- **ความเสี่ยงที่พบ:** ถ้าเครื่องไหน export `DATABASE_URL` ของ production ไว้ (เช่น โหลด `.env` production) เทสต์นี้จะ **เขียนบัญชี/เซสชัน/lead ทดสอบลงฐานข้อมูลจริง** โดยไม่เตือน
- **วิธีแก้ที่ทำ (เฉพาะไฟล์เทสต์):** ข้ามทั้งสอง `describe` พร้อมเหตุผลเมื่อ
  1. ไม่ได้ตั้ง `DATABASE_URL`, หรือ
  2. URL ไม่ถูกต้อง, หรือ
  3. โฮสต์ไม่ใช่ loopback (`localhost`, `127.0.0.1`, `::1`) เว้นแต่ตั้ง `ALLOW_REMOTE_TEST_DB=1` อย่างจงใจ
  ตรวจแล้วทั้ง 3 กรณีข้ามพร้อมข้อความ (รวมกรณีโฮสต์ `knightbasins-db` ถูกปฏิเสธ)
- **ยังไม่ได้ยืนยัน:** เส้นทางที่ *รันจริง* กับ Postgres ท้องถิ่น (เครื่องนี้ไม่มี Docker/Postgres) ตรรกะเดิมของเทสต์ไม่ได้ถูกแก้ ใครมี DB ทดสอบท้องถิ่นให้รัน `DATABASE_URL=postgres://…@localhost:5432/<db ทดสอบที่มี schema> node --test test/support-route.test.ts` เพื่อยืนยัน
- **ข้อเสนอ:** ถ้าต้องการให้เทสต์ชุดนี้รันเป็นประจำ ให้ทำ CI job ที่มี Postgres service + migrations (ใบงานแยก)

## 3) กลุ่ม Google TTS / Vertex Gemini — "ผ่านเมื่อรันเดี่ยว แต่ตกในชุดเต็ม"

- **ผล: ยังทำซ้ำไม่ได้** ไฟล์ `google-tts-cost` (5), `google-tts` (11), `vertex-gemini` (14) = 30 ข้อ ผ่านทั้งเดี่ยวและในชุดเต็ม **5 รอบ** (3 รอบปกติ + 2 รอบ `--test-concurrency=24`) ไม่ตกเลย
- **env pollution ข้ามไฟล์เป็นไปไม่ได้:** `node --test` รันแต่ละไฟล์ใน process แยก และเทสต์กลุ่มนี้เก็บค่า `GOOGLE_SERVICE_ACCOUNT_JSON` / `GOOGLE_APPLICATION_CREDENTIALS` ใน `before` แล้วคืนใน `after` ถ้ามีการตกจริง ต้นเหตุน่าจะเป็นความหน่วง/เวลาหมดอายุตอนเครื่องโหลดหนัก หรือค่า env ของเครื่องที่รัน ไม่ใช่การปนกันระหว่างไฟล์
- **ข้อสังเกตที่เกี่ยวข้อง:** ตอนทำใบงาน 192 (รันชุดเต็ม 4 รอบ) เจอ 2 ครั้งที่ไฟล์ *อื่น* ล้มทั้งไฟล์ (`portfolio-batch-delete`, `public-job-tracking`) ขณะเครื่องกำลังทำงานอื่นอยู่ แต่ละไฟล์ผ่านเมื่อรันเดี่ยว และใน 8 รอบของใบงานนี้ (ปกติ 3, stress 2, ก่อนแก้ 1, หลังแก้ 2) ไม่เกิดอีก ยังไม่ทราบสาเหตุ
- **ขอจากเดวิด:** แนบ output ตอนที่กลุ่ม TTS/Vertex ตกจริง (ชื่อข้อที่ตกและข้อความ error) และค่า `GOOGLE_*` ที่ตั้งไว้ในคอนเทนเนอร์ จะวินิจฉัยต่อได้

## 4) ข้อพบเพิ่มเติม

- **CI ไม่รัน unit test ใดๆ:** `.github/workflows/release-validation.yml` ตรวจแค่สคริปต์กันไฟล์อัปโหลด (`check-upload-files.sh`) ไม่ได้รัน `npm test` ของ api-server หรือ knight-basins เทสต์ที่ตกจึงไม่เคยบล็อกการ merge — ตัวเลข baseline ที่เราใช้อ้างอิงมาจากการรันด้วยมือ
- เทสต์ knight-basins ข้อ `admin-portfolio-webp-optimizer` ตกบน Windows เพราะ regex ใช้ `\n` กับไฟล์ CRLF (ไม่เกี่ยวกับใบงานนี้ และไม่ได้แก้)

## ไฟล์ที่เปลี่ยนใน PR นี้

- `artifacts/api-server/test/support-route.test.ts` — ข้ามเมื่อไม่มี DB ทดสอบท้องถิ่น
- `qa/job-198-boss-api-test-sweep-report.md` — รายงานนี้
- (`leads-persistence.test.ts` ใช้ของ `main` จาก PR #149)
