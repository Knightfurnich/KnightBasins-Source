# รายงานชัย รอบ 15 · ใบงาน 436-C — ให้สำเนา static ตรงกับแอป (DB/แอดมิน)

**ผู้ทำ:** ชัย (ผ่าน Claude Code) · **ทำเมื่อ:** 11 ต.ค. 69 ราว 00:30–01:15 น. (เวลาไทย)
**ฐาน:** `main` ที่ `a7386be` · **สาขา:** `fix/chai-round15-align-to-app`
**แตะเฉพาะ:** `artifacts/knight-basins/src/data/catalog.ts` · `artifacts/knight-basins/test/stone-status-visibility.test.ts` · `artifacts/knight-basins/test/fixtures/app-catalog-snapshot.json` (ใหม่) · รายงานนี้
**ไม่แตะ:** App.tsx · components/** · admin/** · DB production · KB/ฟีด · api-server
**หมายเหตุที่เก็บรายงาน:** `/opt/data/knight-design-kb/qa/` อยู่บน VPS ของเดวิด เครื่องนี้เข้าไม่ถึง จึงวางรายงานที่ `qa/` ในรีโปแทน

## สรุป 5 บรรทัด
1. **แก้อะไร:** คืนชื่อสำเนา static เป็น `Glalet Crystals/Ebony/Grey/Ice` (+ `Glalet Grey (N)` ที่ซ่อนอยู่ + อ่าง KF015/KF018) ตรงกับที่ `/api/catalog` ส่ง; เก็บ `Galet …` เป็น alias ค้นได้ทั้งสองแบบ; เพิ่มเทสต์เทียบสำเนากับ snapshot ของแอปทั้งชุด (ชื่อ·ราคาแผ่น·ราคาติดตั้ง·อ่าง 30 รุ่น)
2. **เทสต์:** web 1299 / ผ่าน 1245 / ตก 12 / ข้าม 42 (main ก่อนแก้ 1297 / 1243 / 12 / 42 → ชุดที่ตกเป็นชุดเดิมทุกข้อ) · api-server 1275 / ผ่าน 1270 / ตก 5 (ไม่ได้แตะ api-server) · เทสต์ที่แก้ 19/19 ผ่าน
3. **ตรวจไม่ได้:** baseline ตาม Linux ของใบ (web ตก 0) เทียบตรง ๆ ไม่ได้ เพราะเครื่องผมเป็น Windows ตก 12 ข้อเดิม (release notes / llms / prerender / CRLF) ทั้งก่อนและหลัง · `tsc --noEmit` ของ web = 0 error, ของ api-server มี error เดิม `speakingRate`/`enabled` (lib ที่ลิงก์ค้าง ไม่เกี่ยวใบนี้) · ต้องส่งหมายเหตุ: ตรวจเทียบ production ได้เฉพาะ ณ 11 ต.ค. 69 ที่ดึง snapshot
4. **ความเสี่ยง:** snapshot ใน fixtures คือภาพ ณ เวลาที่ดึง — ถ้าบอสแก้ชื่อ/ราคาในแอดมิน เทสต์จะตก (ตั้งใจ) ต้องรีเฟรช snapshot + สำเนาคู่กัน · ชื่อใน `stone-status.json` (ไฟล์ของเดวิด) ไม่แตะ
5. **ข้อเสนอ:** ให้เดวิดตั้ง job ดึง snapshot อัตโนมัติ (คำสั่ง curl ด้านล่าง) ก่อน release · ถ้าบอสอยากให้เป็น `Galet` จริง ให้แก้ในแอดมินก่อน แล้วค่อยเปลี่ยนสำเนา+snapshot

## 0. Baseline
`GET https://knightbasins.com/api/catalog` (ดึง 11 ต.ค. 69 ราว 00:40 น., 112,790 ไบต์): sheetStones 64 · installedStones 65 · basins 30 · ชื่อ 4 รหัสเป็น `Glalet …`; สำเนา static (หลัง #491) เป็น `Galet …` ⇒ ไม่ตรงกันโดยตั้งใจตอนนั้น

```bash
curl -s https://knightbasins.com/api/catalog > /tmp/cat.json
```
สคริปต์เทียบ (ฟิลด์: ชื่อ · ราคาแผ่น · ราคาติดตั้ง · การมองเห็น ต่อสี; รหัสสี · ชื่อสี · ราคา · ประเภท · ขนาดนอก · ขนาดหลุม ต่ออ่าง) ดึงค่าสำเนาด้วย `node --experimental-strip-types` import `catalog.ts` แล้วเทียบกับ JSON

## 1. ตารางเทียบ (ผลจริง)
| ชนิด | เทียบทั้งชุด | ก่อนแก้ | หลังแก้ |
|---|---|---|---|
| ชื่อสี | 68 สีที่มองเห็น (live 64 แผ่น ∪ 65 ติดตั้ง) | **4 ต่าง** (GC714 GE118 GG884 GI017) | 0 |
| ราคาแผ่น | ทุกสี | 0 | 0 |
| ราคาติดตั้ง | ทุกสี | 0 | 0 |
| ชุดสีที่ขาย | visible static = live | ตรง | ตรง |
| ชื่อสีบนอ่าง | 30 อ่าง | **2 ต่าง** (KF015 KF018) | 0 |
| ราคาอ่าง · ขนาดนอก · ขนาดหลุม · ประเภท | 30 อ่าง | 0 | 0 |

| ข้อ C | ค่าแอป (แอดมินแสดง) | สำเนา static | สถานะ |
|---|---|---|---|
| `MU010` | Evermoin Ultra Bright (฿7,500 / ติดตั้ง 7,500) | ตรง | ปิด ไม่ต้องแก้ |
| `VD175` | Dandelion (แผ่น ฿12,000, ไม่มีราคาติดตั้ง) | ตรง | ปิด ไม่ต้องแก้ |

**ราคา/ขนาดผิดจริงไหม:** ไม่พบค่าที่ดูผิด สำเนากับแอปตรงกันทุกค่าที่ลูกค้าเห็น จึงไม่มีเรื่องให้หยุดรายงาน

## 2. ข้อ D — KF003 vs KF006 (ข้อเท็จจริงจากแอป)
| ฟิลด์ | KF003 | KF006 |
|---|---|---|
| สี / ราคา | RW316 River White · ฿19,000 | เหมือนกัน |
| ขนาดนอก / หลุม | 600×800×200 / 350×500×130 | เหมือนกัน |
| imageUrl | `…catalog-mua05rff-0a5b2aa0…jpg` | `…catalog-mua06q66-d9865050…jpg` |
| quoteImageUrl | `/kb/images/basin-hd/KF003.jpg` | `…catalog-mu42kczj-5ca8d30c…jpg` |
| วิดีโอ | `catalog-muh6ly7h-…mp4` | `catalog-muh6mq0b-…mp4` |
| ภาพ 3D (topView) | `/assets/basins-transparent/KF003.webp` | `…/KF006.webp` |
| sortOrder | 2 | 5 |
| ข้อความที่ทำให้แยกไม่ออก | ไม่มีฟิลด์ที่บอกรูปทรงหลุม (ชื่อ/สี/ขนาด/ราคาเหมือนกันทุกค่า) | |
รูปทรงหลุมตามรายงาน 429-C: KF003 หลุมสี่เหลี่ยมมุมมน ไม่มีรูน้ำล้น · KF006 หลุมวงรี มีรูน้ำล้น

## 3. เทสต์
`artifacts/knight-basins/test/stone-status-visibility.test.ts` — บล็อก "the built-in catalogue equals what the app sends (job 436-C)" 6 ข้อ เทียบกับ `test/fixtures/app-catalog-snapshot.json`

### พิสูจน์สองทาง
| ย้อนอะไร | ผล | คืนแล้ว |
|---|---|---|
| คืนไฟล์ catalog.ts ของ #491 (ชื่อ Galet) | **ตก 3** | ผ่าน 19/19 |
| BW010 ราคาแผ่น 5900→5800 | **ตก 1** | ผ่าน |
| MU010 ราคาติดตั้ง 7500→7600 | **ตก 1** | ผ่าน |
| MU010 ชื่อ Evermoin→Evermion | **ตก 2** | ผ่าน |
| ขนาดหลุมอ่าง 350→360 | **ตก 1** | ผ่าน |

### ผลรันเต็ม
| ชุด | ก่อน (main `a7386be`) | หลัง |
|---|---|---|
| web | 1297 · 1243 · 12 · skip 42 | 1299 · 1245 · 12 · skip 42 |
| api-server | (ไม่แตะ) | 1275 · 1270 · 5 |
ตกเดิมทั้งหมดไม่เกี่ยวใบนี้: release notes ×7, llms/sitemap/prerender ×5 (web) · slip digest/support-guest ×5 (api)

เวลา: 11 ต.ค. 69 01:07 น. · base hash `a7386be`
