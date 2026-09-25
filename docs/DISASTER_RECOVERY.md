# แผนกู้คืนระบบฉุกเฉิน (Disaster Recovery Runbook)
## Knight Furnich / Knight Basins — SLA ≤ 4 ชั่วโมง

> **เป้าหมายระดับการให้บริการ (Disaster Recovery SLA):**
> * **RTO (Recovery Time Objective):** ไม่เกิน **4 ชั่วโมง** (เวลาฟื้นคืนระบบจริง: ~15 นาที)
> * **RPO (Recovery Point Objective):** ไม่เกิน **24 ชั่วโมง** (มีระบบสำรองอัตโนมัติทุกคืนเวลา 02:00 น. + ประวัติแชท LINE)

---

## 1. ข้อมูลที่เก็บอยู่ในชุดสำรองฉุกเฉิน (`knight_basins_disaster_recovery_*.tar.gz`)
ไฟล์ชุดนี้มีขนาดประมาณ 46–50 MB ประกอบด้วย:
1. **ฐานข้อมูล PostgreSQL (`knight_basins_*.sql.gz`):** ครบทั้ง 18 ตาราง (รายชื่อลูกค้า/คำสั่งซื้อ 72 ราย, อ่าง 30 รุ่น, สลิปโอนเงิน 55 ใบ, ภาพหน้างาน, สิทธิ์ผู้ใช้)
2. **โฟลเดอร์รูปภาพทั้งหมด (`uploads/`):** ภาพถ่ายหน้างานจริงจากช่าง, ภาพอ่าง Top View, ภาพแคตตาล็อกสินค้า
3. **สคริปต์กู้ชีพคำสั่งเดียว (`disaster_recovery_restore.sh`):** สคริปต์อัตโนมัติสำหรับกู้คืนระบบในคำสั่งเดียว

---

## 2. ขั้นตอนกู้คืนระบบบน VPS เครื่องใหม่ (3 ขั้นตอน จบใน 15 นาที)

### สถานการณ์สมมติ:
เซิร์ฟเวอร์เดิมเสียหายถาวร (ฮาร์ดดิสก์พัง / โดนลบ / ผู้ให้บริการล่ม) และเราได้เปิด Cloud VPS ใหม่ (เช่น Hostinger, DigitalOcean, Linode, AWS หรือ Hetzner) ติดตั้งระบบปฏิบัติการ **Ubuntu 22.04 หรือ 24.04 LTS**

---

### ขั้นตอนที่ 1: เตรียมเครื่องใหม่และติดตั้ง Docker (~3 นาที)
ล็อกอินเข้า VPS เครื่องใหม่ผ่าน SSH แล้วรันคำสั่ง:
```bash
# อัปเดตแพ็กเกจและติดตั้ง Docker + Git
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

---

### ขั้นตอนที่ 2: ดึงโค้ดระบบและนำไฟล์สำรองขึ้นเครื่องใหม่ (~2 นาที)
```bash
# 1. โคลนโครงสร้างระบบจาก GitHub
git clone https://github.com/Knightfurnich/KnightBasins-Source.git /docker/knightbasins
cd /docker/knightbasins

# 2. นำไฟล์ knight_basins_disaster_recovery_*.tar.gz 
#    จากคอมพิวเตอร์ขึ้นมาไว้ที่โฟลเดอร์ /docker/knightbasins/backups/
#    (สามารถใช้ WinSCP, FileZilla หรือ scp ก็ได้)
mkdir -p /docker/knightbasins/backups
```

---

### ขั้นตอนที่ 3: สั่งคำสั่งเดียวกู้ชีพทั้งระบบ (~2 นาที)
```bash
cd /docker/knightbasins
bash backups/disaster_recovery_restore.sh backups/knight_basins_disaster_recovery_*.tar.gz
```

**สิ่งที่ระบบจะทำให้โดยอัตโนมัติ:**
* แตกไฟล์สำรองและวางไฟล์ภาพถ่ายหน้างานจริงทั้งหมดเข้าโฟลเดอร์ `/docker/knightbasins/uploads`
* สตาร์ท Docker containers (`knightbasins-db`, `knightbasins-api`, `knightbasins-web`)
* รันคำสั่งเทฐานข้อมูล PostgreSQL กลับคืนมาครบทั้ง 18 ตาราง
* ทดสอบระบบและแจ้งสถานะความพร้อมใช้งานทันที

---

## 3. การเปลี่ยนการชี้โดเมน (DNS Switch) (~2 นาที)
* เข้าสู่ระบบจัดการ DNS (เช่น Cloudflare, Hostinger DNS หรือผู้ให้บริการโดเมน)
* แก้ไข A Record ของโดเมน:
  * โดเมน: `knightbasins.srv1964473.hstgr.cloud` (หรือโดเมนหลักของบริษัท)
  * ชี้ IP Address ไปยัง: **`IP ของ VPS เครื่องใหม่`**
* ระบบจะกลับมาให้บริการลูกค้าและทีมงานได้ทันที 100%

---

## 4. บัญชีฉุกเฉินและการเข้าสู่ระบบ
* หน้าเข้าใช้งานระบบแอดมิน: `https://<your-domain>/admin`
* ใช้รหัสผ่าน Admin เดิมที่กำหนดไว้ใน `.env`
* ข้อมูลลูกค้า สลิป และคลังภาพหน้างานจะกลับมาครบถ้วนเหมือนเดิมทุกประการ
