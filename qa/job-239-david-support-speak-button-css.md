# ใบงาน 239 (ซ่อม CSS ปุ่ม 🔊 ที่หายไป + การ์ดกันคลาสตกหล่น) — ลงมือโดยเดวิด

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด (Tech Lead) · **อนุมัติโดย:** บอส (คุณนพ — "แก้ไข 3 เรื่องนี้เลย บอสอนุมัติ")
**สถานะ:** เดวิดลงมือเอง (บั๊กจริง ตรวจพบและยืนยัน 3 ชั้น)
**Branch:** `fix/david-support-speak-button-css`

**ที่มา:** `KnightSupport.tsx` เรียกใช้คลาส `knight-support-speak-button` และ `knight-support-speak-spin`
แต่ `src/index.css` **ไม่มีนิยามของทั้งสองคลาส** และไฟล์ CSS ที่ production เสิร์ฟ (`/assets/index-B9WxwfoC.css`)
ก็ไม่มีเช่นกัน ขณะที่คลาสพี่น้อง (`knight-support-message--user`, `knight-support-actions`) มีครบ
→ เมื่อเจ้าของเปิดฟีเจอร์เสียง ปุ่ม "ฟังเสียง" จะแสดงแบบหน้าตาธรรมดา ไม่ตรงดีไซน์
CSS 5 บรรทัดนี้ติดค้างอยู่ใน PR #13 ที่เปิดไว้ตั้งแต่ 25 ก.ย. และไม่เคยเข้า main

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. เพิ่มนิยาม CSS ที่หายไปใน /opt/data/cache/kbsrc/artifacts/knight-basins/src/index.css
     ให้ครบทั้งสองคลาส โดยใช้ค่าจากส่วนต่างของ PR #13 (ยืนยันแล้วว่าเป็นค่าที่ออกแบบไว้):
       .knight-support-speak-button          → justify-self: start; display: inline-flex;
                                               align-items: center; gap: 5px; padding: 5px 10px;
                                               border: 1px solid #8fc5df; border-radius: 7px;
                                               background: white; color: var(--brand-blue);
                                               font-size: 12px; font-weight: 600; cursor: pointer;
       .knight-support-speak-button:hover    → background: #eaf7fc
       .knight-support-speak-button:disabled → opacity: .5; cursor: not-allowed
       .knight-support-speak-spin            → animation: knight-support-speak-spin 1s linear infinite
       @keyframes knight-support-speak-spin  → to { transform: rotate(360deg) }
     วางต่อจากบล็อก .knight-support-message-wrap--user ในกลุ่ม .knight-support-* เดิม
     และห้ามแก้บรรทัดอื่นในไฟล์นี้แม้แต่บรรทัดเดียว
  2. เพิ่มเทสต์กันคลาสตกหล่น /opt/data/cache/kbsrc/artifacts/knight-basins/test/support-css-classes.test.ts
     ตรวจแบบอ่านซอร์ส (Static Source Inspection) เท่านั้น:
       - ดึงทุก className ที่ขึ้นต้นด้วย knight-support จาก src/components/KnightSupport.tsx
       - ยืนยันว่าทุกคลาสมีชื่อปรากฏอยู่ใน src/index.css
       - บังคับให้มีอย่างน้อย .knight-support-speak-button และ .knight-support-speak-spin
     เทสต์นี้ต้อง "จับได้จริง": ถ้าลบ CSS 2 บรรทัดออกจะต้องตก (พิสูจน์แล้วตอนพัฒนา)

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/knight-basins/src/index.css   (เพิ่ม 5 บรรทัดท้ายกลุ่ม knight-support เท่านั้น)
  - /opt/data/cache/kbsrc/artifacts/knight-basins/test/support-css-classes.test.ts  (ใหม่)

FORBIDDEN:
  - ห้ามแก้บรรทัดอื่นใดใน src/index.css (ต้องได้ diff = +5 บรรทัดเท่านั้น ไม่มีการลบหรือแก้ของเดิม)
  - ห้ามแตะ artifacts/api-server/** ทุกไฟล์
  - ห้ามแตะ StudioPage.tsx / WorkshopProductionSheet.tsx / App.tsx (ไฟล์แช่แข็ง)
  - ห้ามแตะ artifacts/knight-basins/src/components/KnightSupport.tsx (markup ถูกต้องแล้ว)
  - ห้ามนำเข้าไลบรารีใหม่หรือแก้ package.json
  - ห้ามปิด PR #13 ก่อนที่ CSS ชุดนี้จะอยู่บน main และ deploy สำเร็จ
  - ห้าม push เข้า main — ต้องเปิด PR เท่านั้น

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git diff --stat origin/main → ต้องได้ index.css +5 บรรทัด และไม่มีไฟล์อื่นในกลุ่ม src/ ถูกแก้
  2) git diff ต่อ index.css แล้วแสดงว่ามีแต่บรรทัดเพิ่ม (+) ไม่มีบรรทัดลบ (-)
  3) cd artifacts/knight-basins && npx tsc -p tsconfig.json --noEmit → 0 errors (ต้องรัน pnpm run typecheck:libs ก่อน)
  4) node --experimental-strip-types --test test/support-css-classes.test.ts → ผ่านทุกข้อ ระบุจำนวนข้อจริง
  5) พิสูจน์ว่าเทสต์จับได้จริง: ลบ CSS ออก 2 บรรทัดชั่วคราว → เทสต์ต้องตก → ใส่กลับ → ผ่าน (แนบผลทั้งสองรอบ)
  6) ชุด non-browser เต็ม: node --experimental-strip-types --test $(ls test/*.test.ts | grep -v '\.browser\.test\.ts$')
     → ระบุ ผ่าน/ตก/ข้าม เทียบ baseline ที่วัดเองบน main ก่อนแก้ (baseline ล่าสุดบน Linux: 981/974/0/7)
  7) npx pnpm run --filter @workspace/knight-basins build → ต้องสำเร็จ และไฟล์ assets/index-*.css ที่ได้ต้องมีคำว่า
     knight-support-speak-button (แนบคำสั่ง grep ที่ใช้)
  8) หลัง deploy: curl ไฟล์ CSS ที่ production เสิร์ฟจริง แล้วยืนยันว่ามี knight-support-speak-button และ knight-support-speak-spin

OUTPUT:
  - artifacts/knight-basins/src/index.css
  - artifacts/knight-basins/test/support-css-classes.test.ts

STOP:
  - เมื่อ tsc ผ่าน 0 errors · เทสต์ใหม่ผ่าน · เทสต์พิสูจน์การจับได้จริงทั้งสองรอบ · bundle มีคลาสครบ
  - หรือเมื่อทำงานครบ 40 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | CSS 5 บรรทัด + เทสต์กันตกหล่น |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 2 ไฟล์ ไม่ลาม |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | index.css ห้ามลบบรรทัดเดิม |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | ระบุคำสั่งจริง + baseline เลขจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ตรงกับ SCOPE |
| 6 | มีบล็อก STOP ชัดเจน | ผ่าน | จำกัด 40 turns |
| 7 | ไม่แตะไฟล์แช่แข็ง | ผ่าน | StudioPage / App.tsx / WorkshopProductionSheet |
| 8 | ผ่านเกณฑ์ job_standard_check.py | ผ่าน | ตรวจแล้วท้ายใบงาน |
| 9 | มอบหมายผู้รับผิดชอบชัดเจน | ผ่าน | เดวิด (บั๊กจริง ตรวจพบเอง) |
| 10 | กฎของเจ้าของไม่ตกหล่น | ผ่าน | index.css แก้ตามขอบเขตที่บอสอนุมัติ |
| 11 | การแบ่งแยกความลับสมบูรณ์ | ผ่าน | ไม่มีค่า secret ในใบงาน |
| 12 | อัปเดต KANBAN | ผ่าน | Task 239 + ปรับ 9 แถวที่ล้าสมัยในรอบเดียวกัน |
