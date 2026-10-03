# 🐴 Knight Basins — Production Suite & 2D Studio

> ระบบออกแบบและประมาณราคาเคาน์เตอร์หินสังเคราะห์ครบวงจร (Knight Furnich)  
> ครอบคลุม: หน้าร้านคำนวณราคาอัตโนมัติ · 2D Studio ออกแบบเคาน์เตอร์ · ระบบจัดการหลังบ้านช่างและแอดมิน · ความปลอดภัยทางการเงิน · AI Operations & Auto-Migration

[![Build and Deploy to Hostinger VPS](https://github.com/Knightfurnich/KnightBasins-Source/actions/workflows/deploy.yml/badge.svg)](https://github.com/Knightfurnich/KnightBasins-Source/actions/workflows/deploy.yml)
[![Release Validation](https://github.com/Knightfurnich/KnightBasins-Source/actions/workflows/release-validation.yml/badge.svg)](https://github.com/Knightfurnich/KnightBasins-Source/actions/workflows/release-validation.yml)
[![Version](https://img.shields.io/badge/version-v2.0.0-blue.svg)](https://github.com/Knightfurnich/KnightBasins-Source/releases)

---

## 🌟 จุดเด่นและความสามารถหลัก (v2.0.0)

### 1. 📐 2D Layout Studio & Custom Countertop Composition
* **ออกแบบเคาน์เตอร์หินสังเคราะห์:** รองรับทรงตรง (I), ทรงฉาก (L ซ้าย/ขวา) และทรงตัวยู (U)
* **Smart Basin Positioning (ปุ่ม 7 ระดับอัจฉริยะ):**
  * สแน็ปตำแหน่งอ่างอัตโนมัติ 7 ระดับ (ระดับ 1 = 100 มม. ซ้าย/บน, ระดับ 4 = กึ่งกลาง 50%, ระดับ 7 = 100 มม. ขวา/ล่าง)
  * **รองรับทั้งแผ่นหลักแนวนอน และแผ่นขาแนวตั้ง (L/U)** พร้อมคำนวณปรับระยะปลอดภัยอัตโนมัติ
* **มาตรฐานความปลอดภัยงานช่าง:** ล็อกระยะปลอดภัยรอบขอบเจาะอ่างหินสังเคราะห์ $\ge 100$ มม. (`MIN_BASIN_CLEARANCE_MM`) ทุกด้าน ป้องกันหินแตกร้าว
* **Real Stone Texture & Transparent Assets:** แสดงพื้นผิวภาพถ่ายหินจริง 64 สีคมชัด พร้อมภาพเจาะหลุมอ่างโปร่งใสไร้กรอบ (WebP Optimized ลดขนาดลง 88.4%)

### 2. 🛡️ Enterprise Financial Safety & Link Security
* **การบังคับใช้อายุลิงก์ 45 วัน (Strict Expiry Guard):** สกัดกั้นลิงก์ใบเสนอราคาที่หมดอายุในทุกเส้นทางสาธารณะ ปฏิเสธ HTTP 410 `quote_expired` ในการส่งสลิปและดูสถานะงาน ป้องกันลูกค้านำลิงก์เก่ามาโอนเงิน
* **Financial Safety Lock:** ล็อกการลบ Lead ที่มีประวัติสลิปโอนเงิน เพื่อความถูกต้องของบัญชี
* **Real-time Slip Verification:** ระบบเชื่อมต่อ SlipOK ตรวจสอบสลิปแบบอัตโนมัติ พร้อม Audit Logs ครบวงจร

### 3. 🚨 Automated Health & Emergency Alert Suite
* **Proactive Threshold Incident Alerts:** ตรวจจับข้อผิดพลาดการอัปโหลดสลิปครบ 3 ครั้งใน 1 ชั่วโมง ส่งแจ้งเตือนด่วนเข้า Telegram ทีมงานทันที พร้อม Cooldown 30 นาที
* **Knight UX Digest:** ระบบสรุปรายงานข้อมูลเชิงลึกและจุดติดขัดของลูกค้าประจำสัปดาห์ ส่งตรงเข้า Telegram ผู้บริหาร
* **Audit Logs & Export:** ระบบบันทึกประวัติการเปลี่ยนแปลงระดับละเอียด พร้อมตัวกรอง 3 หมวด (UX/Payment/Form) และส่งออก CSV สำหรับ Excel (UTF-8 BOM ป้องกัน Formula Injection)

### 4. 🚀 CI/CD & DevOps Automation
* **Automated Database Migrations:** เชื่อมโยงสคริปต์ `migrate.sh` เข้าสู่ GitHub Actions Deploy Workflow คัดลอกและรัน `.sql` migrations อัตโนมัติทุกครั้งที่ Deploy (Idempotent ปลอดภัย ไม่ต้อง SSH รันมือ)
* **CI Quality Gates:** ตรวจสอบ Unit tests และ Typecheck ผ่าน 100% ก่อน Merge เสมอ

---

## 🏗️ โครงสร้างสถาปัตยกรรม (Architecture)

```text
KnightBasins-Source/
├── artifacts/
│   ├── knight-basins/       # Frontend SPA (React 19 + TypeScript + Vite + Tailwind)
│   │   ├── src/             # โค้ดส่วนติดต่อผู้ใช้ (Storefront, 2D Studio, Admin)
│   │   └── test/            # ชุดทดสอบระดับคอมโพเนนต์และโมเดลธุรกิจ
│   └── api-server/          # Backend API (Node.js + Express + TypeScript)
│       ├── src/             # เส้นทาง API, บริการแจ้งเตือน, ระบบความปลอดภัย, AI Service
│       └── test/            # ชุดทดสอบ API, Security Guards, Mocks
├── deploy/
│   └── hostinger/           # Docker Compose, Nginx Reverse Proxy, VPS Migration scripts
├── lib/
│   ├── db/                  # Drizzle ORM Schema & PostgreSQL client definitions
│   └── api-spec/            # OpenAPI 3.0 Specification
└── qa/                      # ใบงานมาตรฐานระบบ KANBAN (Job 01 - 224)
```

---

## 💻 การติดตั้งและทดสอบในเครื่องพัฒนา (Local Development)

### ความต้องการของระบบ:
* Node.js >= 20
* pnpm >= 9

```bash
# ติดตั้ง dependencies
pnpm install

# รัน Typecheck ทั้งระบบ
pnpm run typecheck

# รันชุดทดสอบ Backend API (831+ tests)
cd artifacts/api-server && npm test

# รันชุดทดสอบ Frontend (936+ tests)
cd artifacts/knight-basins && npm test
```

---

## 🏷️ ประวัติรุ่นสำคัญ (Release History)

* **v2.0.0 (3 ต.ค. 2569):**
  * Studio UX Polish: ปุ่ม 7 ระดับรองรับแผ่นขาแนวตั้ง (ชิ้นงานตัว L/U)
  * Catalog Alignment: แยกเสาวางของตั้งพื้น (KF029/030) ออกจากผังเจาะเคาน์เตอร์
  * Asset WebP Optimization: แปลงภาพอ่าง 30 รุ่นเป็น WebP โปร่งใส ลดขนาดลง 88.4%
  * Security Expiry Enforcement: ปิดช่องโหว่ลิงก์ 45 วันในจุดส่งสลิปและติดตามงาน
  * DevOps: เชื่อมระบบ Auto-Migration เข้าสู่ GitHub Actions Deploy Workflow
  * Alert Suite: ระบบแจ้งเตือนฉุกเฉิน Telegram เมื่อสลิปเกิดข้อผิดพลาด + Weekly UX Digest
* **v1.7.0:** ระบบ Digital Handover, ใบรับประกันสินค้า และ Customer Tracking Portal
* **v1.6.0:** ระบบ 2D Custom Shape & Multi-piece Countertop Composition
* **v1.5.0:** ระบบสต็อกหินอัจฉริยะ (Staron / Zen) Auto-GID และ Material Roles

---

## 📜 ลิขสิทธิ์และการพัฒนา
พัฒนาและดูแลโดยทีมงาน **Knight Furnich (คุณนพ / เดวิด / ชัย / Replit)**  
สงวนลิขสิทธิ์ © 2026 บริษัท ไนท์ เฟอร์นิช จำกัด
