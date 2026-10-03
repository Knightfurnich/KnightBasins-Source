# ใบงาน 211 (ชัย) — Studio B: Real Stone Texture on Studio Canvas

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม) · **ร่างเนื้อหาโดย:** ชัย (ตามที่เดวิดอนุมัติ)
**ผู้รับผิดชอบ:** ชัย (Programmer) · **เริ่มหลังใบงาน 210 merge**
**Branch:** `feat/chai-studio-real-stone-texture`
**ที่มา:** ผังใช้ "โทนสี" แบนๆ ไม่มีลายหิน และสีหิน 68 สีมี 29 สีที่ค่อนไปทางขาว (ความสว่างเกิน 225/255) จึงแยกแทบไม่ออกแม้เปลี่ยนสีจริง
**การอนุมัติจากเดวิด:** ใช้ inline style (index.css 0 diff) เป็นหลัก; ถ้าจำเป็นต้องแตะ `.studio-piece-rectangle` (เช่น background-size) อนุญาตเป็นข้อยกเว้นเฉพาะบล็อกคลาสนั้นเท่านั้น

```
GOAL:
  1. แสดงภาพหินของ "สีหลักที่ active" เป็นพื้นผิวของแผ่นบนผังหน้าจอ (StudioFootprint) โดยใช้ slabImageUrl (JPEG มัธยฐาน ~42 KB สูงสุด ~111 KB) เป็นหลัก
     - ห้ามใช้ quoteImageUrl (PNG มัธยฐาน ~1 MB สูงสุด ~2.1 MB อยู่คนละ host)
     - โหลดเฉพาะสี active 1 รูป: preload ด้วย Image แล้วค่อยใช้ มี fallback เป็นโทนสีระหว่างโหลดและเมื่อโหลดล้มเหลว
     - ใช้ inline style backgroundImage บนแผ่น ให้ background-color จาก --studio-stone-tone เป็นพื้นรองเสมอ
  2. ความอ่านง่าย: เส้นบอกขนาด/ชื่ออ่าง/ขอบ ต้องอ่านได้บนลายหินทั้งอ่อนและเข้ม (ชั้นโปร่งแสงบางๆ ถ้าจำเป็น; สี ink เดิมที่คำนวณจาก tone ยังใช้)
  3. โหมดพิมพ์ (.studio-print-canvas), ตัวอย่างแบบร่างที่บันทึก และหน้า /quote/view: คงโทนสีแบนเหมือนเดิม
  4. ติดป้าย "ลายหินตัวอย่าง" ใกล้ผัง กันลูกค้าเข้าใจว่าลายตรงกับแผ่นที่ตัดจริง
  5. สีที่ไม่มีภาพ → โทนสีแบนเหมือนเดิม ไม่ขึ้น error
  6. เทสต์: ฟังก์ชัน pure ที่คืนสไตล์พื้นผิว (มี/ไม่มี slabImageUrl, โหมดพิมพ์ = ไม่มีภาพ) + static ตรวจว่าโหมดพิมพ์/แบบร่าง/quote-view ไม่ได้รับภาพ + ทดสอบแล้วว่าจับได้จริง

SCOPE:
  - artifacts/knight-basins/src/components/StudioFootprint.tsx
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/test/ (ไฟล์ใหม่)
  - artifacts/knight-basins/src/index.css (ข้อยกเว้นเฉพาะบล็อก .studio-piece-rectangle เท่านั้น และเฉพาะเมื่อ inline style ไม่พอ — ให้รายงานเหตุผลใน PR)

FORBIDDEN:
  - ห้ามโหลดรูปหินหลายสีพร้อมกัน, ห้ามใช้ quoteImageUrl
  - ห้ามแก้สูตรราคา/API/โหมดพิมพ์/ข้อความไทยเดิม
  - ห้ามแตะ index.css นอกบล็อก .studio-piece-rectangle
  - ห้ามลบ/ปิดเทสต์เพื่อให้ผ่าน
  - ทำงานผ่าน branch: feat/chai-studio-real-stone-texture แล้วเปิด PR เข้า main

EVIDENCE (แนบผลรันจริงทุกข้อ):
  1) git status + branch
  2) tsc knight-basins → 0 errors
  3) เทสต์ผ่าน (ระบุไฟล์+จำนวน) · npm test non-browser เทียบ baseline (และ CI บน GitHub)
  4) ภาพหน้าจอสดบน Production: สีขาว 2 เฉดที่ต่างกันเห็นต่างกัน + สีเข้ม 1 สี + ข้อความอ่านได้
  5) Network: โหลดรูปหินเพียง 1 รูปต่อการเลือก 1 สี (ระบุขนาด)
  6) git diff origin/main...HEAD -- artifacts/knight-basins/src/index.css ว่าง (หรือเฉพาะบล็อกที่อนุญาตพร้อมเหตุผล)

OUTPUT:
  - artifacts/knight-basins/src/components/StudioFootprint.tsx
  - artifacts/knight-basins/src/components/StudioPage.tsx
  - artifacts/knight-basins/test/ (ไฟล์เทสต์)

STOP:
  - เมื่อ tsc 0 errors, เทสต์ผ่านครบ, ทดสอบสดผ่าน
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงาน
```
