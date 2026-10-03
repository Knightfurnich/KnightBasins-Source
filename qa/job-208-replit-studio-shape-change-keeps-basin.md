# ใบงาน 208-R (Replit) — Bug: อ่างหายจากผังเมื่อเปลี่ยนทรงเคาน์เตอร์เป็น L แล้วกด "ประกอบผังลงกระดาน"

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit · **ได้รับอนุมัติให้แก้ `StudioPage.tsx` ตามขอบเขตใบงานนี้** (บอสสั่งแก้โดยตรง 3 ต.ค. 69)
**Branch:** `fix/replit-studio-shape-change-keeps-basin`
**ระดับความรุนแรง:** 🔴 **สูง** — ลูกค้าเสียอ่างออกจากใบเสนอราคาโดยไม่รู้ตัว ทำให้คิดราคาต่ำกว่าความจริงและต้องแก้ใบเสนอราคาใหม่

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. แก้บั๊กใน /opt/data/cache/kbsrc/artifacts/knight-basins/src/components/StudioPage.tsx ฟังก์ชัน applyCustomShape (บรรทัด ~1490-1530)
     - ปัจจุบัน: เมื่อ geometryChanged เป็นจริง โค้ดจะ "ลบ" อ่างทุกตัวของชิ้นงานนั้นออก
       (บรรทัด ~1523: basinPlacements: geometryChanged ? current.basinPlacements.filter((placement) => (placement.pieceId ?? currentPiece.id) !== currentPiece.id) : current.basinPlacements)
     - ต้องแก้เป็น: "เก็บอ่างไว้เสมอ" และจัดตำแหน่งใหม่ให้อยู่ในผังใหม่
  2. การจัดตำแหน่งใหม่ (re-anchor) ต้องใช้ตัวช่วยที่มีอยู่แล้วในระบบ ห้ามเขียนสูตรใหม่:
     - ใช้ clampPlacementToSheet(placement, piece, xMm, yMm) จาก src/data/studio-model.ts (บรรทัด ~1279) เพื่อดึงตำแหน่งอ่างกลับเข้าไปในขอบผังใหม่
     - ถ้าอ่างล้นออกนอกผังใหม่ ให้ย้ายตำแหน่งให้อยู่ในผัง (clamp) ไม่ใช่ลบทิ้ง
     - ถ้าอ่างไม่พอดีกับผังใหม่จริง ๆ (placementFitsStudioPiece จาก studio-model.ts บรรทัด ~1079 คืนค่า false) ให้คงอ่างไว้และปล่อยให้ระบบเตือนตามกลไกเดิม (placementWarnings / คลาส .studio-placement--invalid หรือ --inactive) ห้ามลบ
  3. เพิ่มการแสดงผลให้ตรวจสอบได้ง่าย: หลังกด "ประกอบผังลงกระดาน" บนทรงใหม่ อ่างต้องยังเห็นบนผังพร้อมป้าย SKU (ป้ายเดิมมีอยู่แล้ว ไม่ต้องออกแบบใหม่)
  4. เพิ่ม Static Source Test ใน /opt/data/cache/kbsrc/artifacts/knight-basins/test/studio-shape-change-keeps-basin.test.ts ตรวจว่า:
     - applyCustomShape ไม่มีรูปแบบการลบ placement ของชิ้นงานตัวเอง (ห้ามมี .filter ที่ตัด placement ของ currentPiece.id ออกในเส้นทางนี้)
     - มีการเรียก clampPlacementToSheet (หรือ clampBasinPlacementPosition) เพื่อ re-anchor หลังเปลี่ยนทรง
     - และยืนยันว่าการเปลี่ยนทรงยังอัปเดต shape เป็น L/U/I ตามเดิม

SCOPE:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/test/studio-shape-change-keeps-basin.test.ts (ใหม่)

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff) — ใบนี้แก้เฉพาะ logic ใน StudioPage.tsx
  - ห้ามแก้สูตรราคา พื้นที่ (ตร.ม.) หรือเรตราคาใด ๆ ใน studio-model.ts (ห้ามแก้ไฟล์ studio-model.ts เลย ยกเว้นจำเป็นจริงและต้องรายงานก่อน)
  - ห้ามแก้ไฟล์อื่นนอก SCOPE (ห้ามแตะ App.tsx, index.html, llms.txt)
  - ห้ามเปลี่ยนพฤติกรรมปุ่ม "ประกอบผังลงกระดาน" ในเรื่องการคำนวณพื้นที่/ราคา (ยังต้องคำนวณหลังกดปุ่มเท่านั้น)
  - ทำงานผ่าน branch: fix/replit-studio-shape-change-keeps-basin แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง fix/replit-studio-shape-change-keeps-basin ชัดเจน
  2) แนบ diff ของ applyCustomShape ให้เห็นว่าเปลี่ยนจาก filter-ทิ้ง เป็น keep + clamp
  3) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  4) node --test test/studio-shape-change-keeps-basin.test.ts และ test/studio-model.test.ts (ถ้ามีเคสที่เกี่ยวข้อง) → ผ่านทุกข้อ (ระบุจำนวน)
  5) npm test ใน artifacts/knight-basins (non-browser suite) → เทียบตัวเลขกับ baseline ฝั่ง main ล่าสุด และยืนยัน src/index.css 0 diff
  6) ทดสอบมือใน preview: เปิด /studio?basin=KF003 → เลือกทรงตรง → วางอ่าง KF003 → กด "ประกอบผังลงกระดาน" → เปลี่ยนเป็น "L ขวา" → กด "ประกอบผังลงกระดาน" อีกครั้ง → อ่าง KF003 ต้องยังอยู่บนผัง (แนบภาพหรือคำอธิบายผลที่เห็น + ระบุว่าพื้นที่/ราคาอัปเดตเป็นเท่าไร)

OUTPUT:
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/test/studio-shape-change-keeps-basin.test.ts

STOP:
  - เมื่อ typecheck ผ่าน 0 errors เทสต์ผ่านครบ และทดสอบมือตามข้อ 6 แล้วอ่างยังอยู่
  - หรือเมื่อทำงานครบ 40 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ + สิ่งที่เหลือ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ระบุบรรทัดและพฤติกรรมที่ต้องเป็น |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 2 ไฟล์ ตรวจกับดิสก์แล้ว |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ CSS/ราคา/ไฟล์นอกขอบเขต |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | มีคำสั่งจริง + ทดสอบมือ |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ผลลัพธ์ |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 40 turns |
| 7 | Replit SCOPE ใช้ path สัมพัทธ์ | ผ่าน | ไม่มี absolute path |
| 8 | Replit บังคับ GitHub Connection | ผ่าน | มีบรรทัดบังคับครบ |
| 9 | ระบุอนุมัติการแก้ไฟล์แช่แข็ง | ผ่าน | StudioPage.tsx ได้รับอนุมัติตามขอบเขตนี้ |
| 10 | มี branch name ชัดเจน | ผ่าน | fix/replit-studio-shape-change-keeps-basin |
| 11 | มีเกณฑ์ตรวจได้ | ผ่าน | 0 errors / 0 diff / อ่างยังอยู่ |
| 12 | เป็นมิตรกับ CI/CD | ผ่าน | CI unit-tests ใหม่จะตรวจให้ |

---

## 🔬 การวินิจฉัยของเดวิด (หลักฐานจากโค้ดจริงบน main)

**อาการที่บอสรายงาน (3 ต.ค. 69):**
> เปิด `/studio?basin=KF003` → ทรงตรง มีอ่างแสดงบนผัง → เปลี่ยนเป็น **L ขวา** → กด **"ประกอบผังลงกระดาน"** → **รูปอ่างหายไป** และชิ้นงานแสดงเป็นสีหินที่เลือก (ซึ่งเป็นสีเดียวกับอ่าง จึงดูเหมือนไม่มีอ่างเลย)

**ต้นตอ (ยืนยันจากโค้ด):** `StudioPage.tsx` ฟังก์ชัน `applyCustomShape` บรรทัด ~1523

```ts
basinPlacements: geometryChanged
  ? current.basinPlacements.filter((placement) => (placement.pieceId ?? currentPiece.id) !== currentPiece.id)
  : current.basinPlacements,
```

* `geometryChanged` จะเป็นจริงเมื่อ "ทรงหรือตำแหน่ง/ขนาดแผ่นเปลี่ยน" — การเปลี่ยนจากทรงตรงเป็น L เข้าเงื่อนไขนี้ทันที
* ผลคือ **อ่างทุกตัวของชิ้นงานนั้นถูกลบออกจาก state โดยตรง** (`filter` ตัดออก) ไม่ใช่แค่ย้ายตำแหน่ง
* ตัวแปร `geometryChanged` ยังถูกใช้ตัดสินใจเรื่องนี้เพียงอย่างเดียว จึงไม่มีเส้นทางใดที่ re-anchor อ่างให้เข้ากับทรงใหม่

**ผลกระทบทางธุรกิจ (สำคัญ):**
1. **ใบเสนอราคาขาดอ่าง** → ลูกค้าได้ราคาต่ำกว่าความจริง แล้วต้องแก้ใบเสนอราคาใหม่
2. **ผังที่ส่งช่างผลิตขาดช่องเจาะอ่าง** → เสี่ยงผลิตผิด ต้องแก้ที่หน้างาน
3. ลูกค้าเห็นอ่างหายแล้วเข้าใจว่าระบบพัง (เสียความเชื่อมั่นในเครื่องมือ)

**สิ่งที่ต้องเป็นหลังแก้:**
* เปลี่ยนทรงได้ตามปกติ แต่อ่าง **ต้องอยู่ครบ** และถูกจัดตำแหน่งใหม่ให้อยู่ในผังใหม่
* ถ้าอ่างไม่พอดี (เช่น ขนาดอ่างใหญ่กว่าขา L) ให้ **เตือน** ตามกลไกเดิม ไม่ใช่ลบเงียบ ๆ
* พื้นที่/ราคายังคำนวณหลังกดปุ่มเช่นเดิม (ห้ามเปลี่ยน)
