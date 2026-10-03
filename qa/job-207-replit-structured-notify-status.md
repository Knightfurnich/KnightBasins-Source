# ใบงาน 207-R (Replit) — Structured Notification Status: เลิกพึ่งถ้อยคำไทยในการกันส่งซ้ำ

**วันที่:** 3 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ Replit · เริ่มได้ทันที (งานสั้น ประมาณ 30–45 นาที)
**Branch:** `feat/replit-structured-notify-status`
**ที่มา:** PR #161 (Job 204) กันกดส่งซ้ำโดยตรวจถ้อยคำภาษาไทย (`notificationMessage.startsWith("ส่ง") && includes("แล้ว")`) ซึ่งเปราะ: ถ้ามีใครแก้ข้อความสำเร็จของ API เพิ่ม/เปลี่ยนคำ ปุ่มส่งซ้ำจะกลับมาโผล่โดยเทสต์ไม่จับ (ชัยเป็นผู้ชี้จุดนี้ — เดวิดเห็นชอบและอนุมัติให้แก้ทันที)
**วัตถุประสงค์:** ใช้สถานะแบบโครงสร้าง (`notificationStatus` ของ API) เป็นสัญญาณหลัก และคงการตรวจถ้อยคำไว้เป็น fallback สำหรับลิงก์เก่าที่ส่งก่อนหน้านี้

```
✅ มาตรฐานการออกใบงาน · 12/12 · 3 ต.ค. 69 · เดวิด

GOAL:
  1. ใน artifacts/knight-basins/src/App.tsx ปรับทั้ง 2 จุดที่นำทางไปหน้าใบเสนอราคาหลังส่งแจ้งเตือน (submitQuote และ submitStudio) ให้แนบพารามิเตอร์แบบโครงสร้างเพิ่มอีกตัว:
     - ถ้าผลลัพธ์จาก notifyQuoteMutation มี notificationStatus === "notified" ให้ต่อท้าย &notified=1 (แนบ &notification=<ข้อความเดิม> ไว้เหมือนเดิม ห้ามลบ เพราะหน้าจอใช้แสดงผล)
     - ถ้าไม่ใช่ "notified" (เช่น saved_not_notified หรือโยน error) ห้ามใส่ &notified=1
  2. ในหน้า SavedQuotePage (คอมโพเนนต์ SavedQuotePage ใน App.tsx) เปลี่ยนตัวแปร notificationWasAlreadySent ให้ใช้สัญญาณแบบโครงสร้างเป็นหลัก:
     - อ่านค่าจาก query string: notified === "1" (หรือ true) = ส่งสำเร็จแล้ว
     - คงเงื่อนไขเดิมที่ตรวจถ้อยคำ (startsWith("ส่ง") && includes("แล้ว")) ไว้เป็น fallback เฉพาะกรณีไม่มีพารามิเตอร์ notified (ลิงก์เก่า) แล้วใส่คอมเมนต์อธิบายว่าทำไมต้องมี fallback
     - พฤติกรรมที่ห้ามเปลี่ยน: ถ้าส่งไม่สำเร็จ (ข้อความขึ้นต้น "บันทึกแล้ว แต่...") ต้องยังเห็นปุ่มให้กดลองส่งใหม่เสมอ
  3. ปรับ/เพิ่มเทสต์ใน artifacts/knight-basins/test/quote-notify-guard.test.ts ให้ครอบคลุม:
     - มีพารามิเตอร์ notified=1 → ซ่อนปุ่มและแสดงสถานะ "ส่งข้อมูลถึงทีมขายแล้ว" แม้ข้อความ notification จะเป็นคำอื่น (พิสูจน์ว่าไม่พึ่งถ้อยคำแล้ว)
     - ไม่มีพารามิเตอร์ แต่ข้อความสำเร็จรูปแบบเดิม → ยังซ่อนปุ่ม (fallback ทำงาน)
     - ข้อความล้มเหลว → ยังเห็นปุ่ม

SCOPE:
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/quote-notify-guard.test.ts

FORBIDDEN:
  - ข้อบังคับสำหรับ Replit: ระบบนี้ใช้ GitHub Connection เท่านั้น ห้ามรันคำสั่ง git ใน Terminal และห้ามเด้งกล่องถามยืนยันเรื่อง Git/Branch ให้สร้าง branch และ push ผ่าน GitHub Connection อัตโนมัติทันที
  - ห้ามแตะต้องหรือแก้ไข src/index.css เด็ดขาด (0 diff)
  - ห้ามแก้ข้อความภาษาไทยที่แสดงต่อลูกค้า (notificationMessage, "ส่งข้อมูลถึงทีมขายแล้ว") และห้ามแก้ข้อความของ API ใน artifacts/api-server/
  - ห้ามแตะ endpoint /api/quotes/notify, สูตรราคา, หรือ Print Layout ของใบเสนอราคา
  - ห้ามลบ fallback เดิมทิ้ง (ลิงก์ที่ส่งไปแล้วก่อนหน้านี้ต้องยังทำงานถูก)
  - ทำงานผ่าน branch: feat/replit-structured-notify-status แล้วเปิด PR เข้า main

EVIDENCE (ต้องแนบผลรันจริงทุกข้อ — ตัวเลข ไม่ใช่คำรับรอง):
  1) git status และ branch แสดง feat/replit-structured-notify-status ชัดเจน
  2) npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit → 0 errors
  3) node --test test/quote-notify-guard.test.ts และ test/studio-auto-notify.test.ts → ผ่านทุกข้อ (ระบุจำนวน)
  4) npm test ใน artifacts/knight-basins (non-browser suite) → เทียบตัวเลขกับ baseline ฝั่ง main ล่าสุด
  5) git diff main...HEAD -- artifacts/knight-basins/src/index.css ได้ผลลัพธ์ว่าง (0 diff)

OUTPUT:
  - artifacts/knight-basins/src/App.tsx
  - artifacts/knight-basins/test/quote-notify-guard.test.ts

STOP:
  - เมื่อรัน typecheck ผ่าน 0 errors และเทสต์ที่ระบุผ่านครบทุกข้อ
  - หรือเมื่อทำงานครบ 30 turns ให้หยุดและรายงานทันที
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | ใช้สถานะโครงสร้าง + คง fallback |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 2 ไฟล์ ตรวจกับดิสก์แล้ว |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ CSS/API/ข้อความลูกค้า |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | มีคำสั่งจริง + จำนวนเทสต์ |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ระบุไฟล์ผลลัพธ์ |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 30 turns |
| 7 | Replit SCOPE ใช้ path สัมพัทธ์ | ผ่าน | ไม่มี absolute path |
| 8 | Replit บังคับ GitHub Connection | ผ่าน | มีบรรทัดบังคับครบ |
| 9 | ห้ามแตะ src/index.css | ผ่าน | 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | feat/replit-structured-notify-status |
| 11 | มีเกณฑ์ตัวเลข | ผ่าน | 0 errors / 0 diff |
| 12 | เป็นมิตรกับ CI/CD | ผ่าน | CI unit-tests ใหม่จะตรวจให้ |

---

## 📌 ข้อมูลอ้างอิงที่เดวิดตรวจแล้ว (โค้ดปัจจุบันบน main)
```ts
// App.tsx บรรทัด ~1134 — จุดที่ต้องเปลี่ยน
const notificationWasAlreadySent = notificationMessage.startsWith("ส่ง") && notificationMessage.includes("แล้ว");

// App.tsx บรรทัด ~1938 และ ~1954 — จุดที่ต้องแนบพารามิเตอร์ใหม่
const notificationQuery = notificationMessage ? `&notification=${encodeURIComponent(notificationMessage)}` : "";

// App.tsx บรรทัด ~1383 — จุดที่ใช้ค่า (ห้ามแก้ข้อความ)
{notificationWasAlreadySent ? <p ... data-testid="status-saved-quote-notification-sent">ส่งข้อมูลถึงทีมขายแล้ว</p> : <button ... >}
```

**สัญญาที่ API มีอยู่แล้ว (ไม่ต้องแก้):** `notificationStatus: "notified" | "saved_not_notified"` ใน response ของ `/api/quotes/notify` (ดู `lib/api-spec/openapi.yaml` บรรทัด ~1957 และ `artifacts/api-server/src/lib/sales-notifications.ts`)
