# ข้อความส่ง Replit — สั่ง deploy production (ฟีเจอร์ "ขนาดจริง + หลายอ่าง")

> สร้าง 12 ก.ย. 2026 · commit ที่ต้อง deploy: `764c1468c69dad426492441e13829276aa29f76b`
> ตรวจโค้ด/รัน regression เองแล้วผ่าน — เหลือขั้นตอน deploy เท่านั้น

---

ทำ deployment ขึ้น production ของ commit นี้ครับ

```
764c1468c69dad426492441e13829276aa29f76b
Support real and multiple sink cutouts
```

**วิธี deploy** — ใช้ตาม `deploy/vps/knightdesign/README.md`
```sh
bash deploy/vps/knightdesign/deploy.sh
```
ต้องเห็นบรรทัดสุดท้าย `KnightDesign deployment checks completed successfully.`

**เงื่อนไขที่ห้ามละเมิด**
- ห้าม recreate container ของ Hermes / LINE proxy / n8n / api proxy (ตาม README)
- deploy รอบนี้ต้อง **ไม่ rotate** `SESSION_SECRET` (ห้ามตั้ง `KNIGHTDESIGN_ROTATE_SESSION_SECRET=1`)
  → ลูกค้าที่ล็อกอินค้างอยู่ต้องไม่ถูก log out
- copy artifact เขียนทับในโฟลเดอร์เดิม (inode ต้องไม่เปลี่ยน)

---

## ⚠️ สำคัญ — บัญชี admin ที่ใช้ใน smoke check

บัญชี **`johnnopy9@gmail.com` (TEMP admin) ถูกลบออกจากฐานข้อมูลแล้ว** เมื่อ 12 ก.ย. 08:06 UTC
ถ้า `ADMIN_EMAIL` / `ADMIN_PASSWORD` ใน protected env ยังเป็นบัญชีนี้ **smoke check จะ fail closed**
(scripts บังคับให้มี `ADMIN_EMAIL` + `ADMIN_PASSWORD` และจะ exit ทันทีถ้าล็อกอินไม่ได้)

บัญชี admin ที่เหลืออยู่ในระบบมีบัญชีเดียว: **`support@knightfurnich.com`**
ถ้ารหัสของบัญชีนี้ไม่ได้อยู่ใน protected env ให้แจ้งกลับก่อน deploy อย่าเดารหัส

---

## หลักฐานที่ต้องส่งหลัง deploy

**1) bundle ใหม่ขึ้นจริง**
```sh
ls -t /docker/knightdesign/web-dist/assets/*.js | head -1
grep -c bowlMm /docker/knightdesign/web-dist/assets/*.js     # ต้อง > 0 (ของเดิม = 0)
```
ชื่อไฟล์ต้องไม่ใช่ `index-D5A_BYm4.js` (ของเดิมก่อน deploy)

**2) วัดช่องเจาะจาก DOM จริง** (ต้องล็อกอินก่อน)
```js
// KF003 ต้องได้ 0.35 ม. × 0.50 ม. (ค่าที่อ่านได้หาร stageScale)
document.querySelector('[data-testid="overlay-basin-KF003"]').getBoundingClientRect()
// KF023 (กลม) ต้องเป็นวงกลม Ø 0.35 ม. -> border-radius: 9999px + กว้าง = สูง
document.querySelector('[data-testid="overlay-basin-KF023"]')
// KF029 ต้องไม่มีกล่องขนาด + มีข้อความ "ขนาดหลุมอ่างไม่ระบุในแคตตาล็อก"
document.querySelector('[data-testid="overlay-basin-unknown-KF029"]')
```

**3) พฤติกรรมที่ต้องทดสอบจริง**
- ลากช่องเจาะ → ตำแหน่งเปลี่ยน → บันทึก draft → โหลดกลับ → ตำแหน่งเดิม
- เพิ่มอ่างตัวที่ 2 → เห็น 2 ตัวพร้อมขนาด (`panel-basins-selected`) → ลบตัวหนึ่ง → เหลือตัวที่ถูก

**4) ราคาต้องไม่ขยับ**
```
0.60 × 1.80 SG420 กทม. = 9,180 + 5,000 = 14,180 · VAT 992.6 · รวม 15,172.6
เลือกอ่าง 1 ตัว / 2 ตัว -> ตัวเลขต้องเท่าเดิมทุกกรณี
```

**5) URL ที่ควรตอบ 200 หลัง deploy**: `/` · `/login` · `/design` · asset จริง 200 · asset ที่ไม่มีไฟล์ต้อง 404

---

หลัง deploy แล้วเสร็จ **แจ้งกลับพร้อมแนบข้อ 1) และ 2)** — ฝั่งเราจะตรวจซ้ำอิสระอีกชั้น
(ยิง bundle จริงจาก public + วัด DOM + ลาก + draft + ราคา)
