# 451-R — ตรวจสอบ Production Knight Basins (11 ต.ค. 2569)

- **ตรวจเมื่อ:** 11 ต.ค. 2569 เวลาประมาณ 17:25 น. ICT
- **ขอบเขต:** อ่าน production เท่านั้น ไม่เข้าสู่ระบบ ไม่กรอกหรือส่งฟอร์ม ไม่เพิ่มสินค้าในใบเสนอราคา และไม่แก้ source/config ของแอป
- **Production:** https://knightbasins.com ตอบ 200; /api/catalog ตอบ 200 และส่งสินค้า 30 รายการ
- **รหัส production:** ยืนยันไม่ได้ — response ไม่เปิดเผย deployment SHA และรายการ GitHub deployments ที่ตรวจไว้ไม่มีข้อมูล deployment ที่ใช้ผูกหน้าเว็บกับ commit ได้
- **ข้อควรระวัง:** main HEAD 65e866dc1424bdf746cff1615cec21da4ce56f47 เป็น docs-only และไม่ใช่หลักฐานว่า production ใช้ commit นี้
- **HTTP:** หน้าเว็บรายงาน Last-Modified: Sun, 11 Oct 2026 08:35:17 GMT; เวลา response ของ catalog ที่ตรวจล่าสุด: Sun, 11 Oct 2026 10:25:06 GMT

## ผลตรวจแคตตาล็อกและข้อมูลสินค้า

- API และหน้าแคตตาล็อกให้ผลรวม 30 รุ่น: **เคาน์เตอร์ 18**, **ทรงสูง 10**, **เสาวางของตั้งพื้น 2**. พบการ์ดสินค้า 30 ใบ และการ์ด KF029/KF030 แสดงชื่อชุดเสาวางของตั้งพื้นสำเร็จรูปถูกต้อง
- ตัวกรองที่หน้าแคตตาล็อกมี “ทั้งหมด 30”, “เคาน์เตอร์ 18” และ “ทรงสูง 10”; ไม่มีตัวกรอง “เสาวางของตั้งพื้น 2”. เมื่อกดตัวกรองสองหมวดแรก จำนวนการ์ดเป็น 18 และ 10 ตามลำดับ
- **พบข้อผิดพลาดใน JSON-LD:** Product ของ KF029 และ KF030 มี description ขึ้นต้นว่า “อ่างล้างหน้าหินสังเคราะห์ Knight Basins รุ่น …” ทั้งที่การ์ดและ API จัดเป็นเสาวางของตั้งพื้นสำเร็จรูป. ข้อมูล structured data จึงยังเรียกสินค้า 2 รุ่นนี้ว่าอ่าง
- API มี bowlShapeLabel 25 รุ่น และทั้ง 25 ปรากฏบนการ์ด; ไม่มี label ใดมีคำ “รูน้ำล้น”. รุ่น KF007, KF009, KF010, KF029 และ KF030 ไม่มี bowlShapeLabel และไม่พบข้อความ “รูน้ำล้น” บนการ์ดทั้งห้า
- ข้อความจาก API ของ basinOverflowNote คือ: “อ่างทุกรุ่นสั่งทำได้ทั้งแบบมีและไม่มีรูน้ำล้น (ปกติโรงงานทำให้แบบไม่มี) — ถ้าต้องการแบบมี แจ้งทีมขายได้” ตรวจ DOM เริ่มต้นของทั้งหก route แล้วไม่พบข้อความนี้หรือคำ “รูน้ำล้น” จึงไม่มีข้อความบนหน้าให้เทียบแบบตัวอักษรต่ออักษรในการตรวจรอบนี้; ไม่ได้เพิ่มสินค้าเข้า quote เพื่อเปิด state เพิ่มเติม

## วัด horizontal overflow — 30 cells

วัด documentElement.scrollWidth ลบ clientWidth; ค่าในตารางเป็นส่วนต่างพิกเซล. ใช้ Chromium แบบ desktop และ classic scrollbar. สำหรับ CSS viewport 390/360 px ใช้ device metrics override โดย mobile=false เพราะหน้าต่าง headless ปกติจำกัดความกว้างขั้นต่ำ 500 px; ค่า innerWidth ที่วัดได้ตรงกับ viewport เป้าหมาย. การเลื่อนภายในแถบเมนู/ชิปไม่ถือเป็น page overflow

| Route | 1440×900 (client 1425) | 1024×768 (1009) | 768×1024 (753) | 390×844 (375) | 360×800 (345) |
|---|---:|---:|---:|---:|---:|
| / | 0 | 0 | 0 | 0 | 0 |
| /stone | 0 | 0 | 0 | 0 | 0 |
| /portfolio | 0 | 0 | 0 | 0 | 0 |
| /quote | 0 | 0 | 0 | 0 | 0 |
| /price-guide | 0 | 0 | 0 | 0 | 0 |
| /readme | 0 | 0 | 0 | 0 | 0 |

ไม่พบ root horizontal overflow ทั้ง 30/30 cells. แถบชิปผลงานบน /portfolio เป็น horizontal scroller ภายใน (scrollWidth 2443, clientWidth 343 ที่ viewport 390) และมีลูกศร/แถบเลื่อนที่มองเห็นได้; ไม่ใช่ page overflow

## ทบทวนข้อค้นพบเดิม 6 ข้อ

1. **ขนาดตัวอักษรเมนู:** ที่ viewport 390 px เมนู storefront ใช้ 13 px และพื้นที่ลิงก์สูง 44 px; ไม่พบ 11 px ในเมนูที่ตรวจ
2. **คอนทราสต์:** ข้อความเมนูสี rgb(95, 123, 146) เทียบพื้นขาวได้ 4.435:1 ซึ่งยังต่ำกว่า WCAG AA 4.5:1 สำหรับข้อความปกติเล็กน้อย
3. **Price guide:** หน้า /price-guide เปิดได้ และมีลิงก์ใน footer ของหน้า storefront แต่ไม่มีรายการ price guide ใน primary navigation
4. **ชิปผลงาน:** รายการยาวและต้องเลื่อนในแนวนอน แต่ที่มือถือมีลูกศรซ้าย/ขวาและแถบเลื่อนให้เห็น; ข้อสังเกตเดิมเรื่องไม่มี cue ไม่เกิดซ้ำ
5. **ส่วนหัว:** ยังใช้ header คนละรูปแบบ/ความสูงที่ 390 px — storefront 101 px, portfolio 91 px, price guide 81 px, readme 120 px. /, /stone และ /quote ใช้ header storefront เดียวกัน
6. **เป้าหมายสัมผัส:** ลิงก์ตะกร้ามือถือ link-mobile-quote วัดได้ 42×19 px. ไม่พบ element ที่ตรง 180×23 px พอดี แต่ยังมีลิงก์ข้อความใกล้เคียง เช่น 179×20 และ 183×20 บน price guide และ 161×23 ใน footer จึงยังมีเป้าหมายเล็กกว่า 44×44 px

## ภาพ production

เก็บภาพ 9 ภาพใน qa/images/round21/ (JPEG): desktop 1440×900 ครบทั้งหก route และ viewport 390×844 ของ /, /stone และ /portfolio

- [Home — 1440×900](images/round21/1440x900-home.jpg)
- [Stone — 1440×900](images/round21/1440x900-stone.jpg)
- [Portfolio — 1440×900](images/round21/1440x900-portfolio.jpg)
- [Quote — 1440×900](images/round21/1440x900-quote.jpg)
- [Price guide — 1440×900](images/round21/1440x900-price-guide.jpg)
- [Readme — 1440×900](images/round21/1440x900-readme.jpg)
- [Home — 390×844](images/round21/390x844-home.jpg)
- [Stone — 390×844](images/round21/390x844-stone.jpg)
- [Portfolio — 390×844](images/round21/390x844-portfolio.jpg)

## ข้อสรุป

หน้าที่ตรวจตอบ HTTP 200 และไม่พบ horizontal overflow ระดับหน้าใน 30 cells. การนับ API/การ์ดถูกต้อง แต่ตัวกรองไม่มีหมวดเสาวางของตั้งพื้น และ JSON-LD ยังจัด KF029/KF030 เป็นอ่าง. ข้อความ basinOverflowNote มีใน API แต่ไม่แสดงใน DOM เริ่มต้นของหก route. ตรวจแบบ read-only; ไม่มีการเปลี่ยน production หรือส่งข้อมูลลูกค้า