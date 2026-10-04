# ใบงาน 254-C (ชัย) — "จำนวนคำขอ" ของเฮอร์มีส ต้องนับจำนวนการเรียกโมเดลจริง (ฟิลด์ api_calls)

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ชัย · บอสถามเองว่า "จำนวนคำขอ" นับอย่างไร
**Branch:** `fix/chai-hermes-request-count-from-api-calls`
**ที่มา:** บอสถามว่า จำนวนคำขอ = จำนวนครั้งที่คุยกับ AI หรือไม่ · ข้อเท็จจริงที่เดวิดตรวจแล้ว:
  หน้า /admin/ai-cost นับ `requests` = จำนวน "บรรทัด" (event) ในไฟล์ audit ต่อบริการ
  - บริการของแอป (ผู้ช่วยขาย/อ่านแบบร่าง/TTS/Vertex) 1 บรรทัด = 1 การเรียก AI จริง ✅
  - เฮอร์มีส 1 บรรทัด = 1 รอบที่รายงาน (งาน cron 1 ครั้ง หรือรอบอัปเดตทุก 15 นาที) → **ไม่ใช่จำนวนครั้งที่คุยกับ AI**
  สคริปต์ฝั่ง Hermes (เดวิด) แนบจำนวนการเรียกโมเดลจริงมาในฟิลด์ `api_calls` แล้วทุกบรรทัด เช่น
    {"ts": "2026-10-04T11:34:00Z", "model": "deepseek/deepseek-v4.1-flash", "source": "hermes_interactive", "session": "...", "api_calls": 4, "prompt_tokens": 29137, "completion_tokens": 148, "total_tokens": 29285, "duration_ms": null, "error": null}
  แต่ฝั่งแอปยังนับ requests จากจำนวนบรรทัด จึงได้ 16 คำขอต่อ 213 ล้านโทเคน ซึ่งไม่สะท้อนความจริง

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. ให้ parseHermesAuditLine อ่านฟิลด์ "api_calls" ของบรรทัดนั้นด้วย (จำนวนเต็ม ≥ 1) แล้วเก็บไว้กับ event
     ถ้าไม่มีฟิลด์นี้ หรือค่าไม่ใช่จำนวนเต็ม ≥ 1 → ใช้ค่า 1 (พฤติกรรมเดิมของบรรทัด cron ของ engine ต้องไม่เปลี่ยน)
  2. ให้การรวมยอดของบริการ hermes_ops นับ "จำนวนคำขอ" เป็นผลรวมของค่านั้น (sum) แทนการนับจำนวนบรรทัด
     โดยบริการอื่น (sales_bot · sketch_vision · vertex_gemini · google_tts) ต้องคงพฤติกรรมเดิมทุกประการ
  3. ห้ามทำให้ค่า tokens หรือต้นทุนเปลี่ยน (เฉพาะจำนวนคำขอ) และต้องไม่ทำให้ค่าเฉลี่ยต่อคำขอผิดพลาดเมื่อ requests = 0
  4. เพิ่มเทสต์: บรรทัดมี api_calls=4 → นับเพิ่ม 4 · บรรทัดไม่มีฟิลด์ → นับ 1 · ค่าเสีย (0, -3, "x") → นับ 1

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/ai-cost-tracker.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/ai-cost-center.test.ts

FORBIDDEN:
  - ห้ามแตะ UI ทุกไฟล์ (artifacts/knight-basins/**) รวม src/index.css — ส่วนแสดงผลเป็นงานของรีพิต (ใบงาน 253)
  - ห้ามแก้ราคา/เรต · ห้ามแก้สูตรต้นทุน · ห้ามแตะ routes/leads.ts
  - ห้ามแตะ Production · ห้าม push ตรง main

EVIDENCE:
  1) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  2) node --experimental-strip-types --test test/*.test.ts ใน artifacts/api-server → ระบุ tests/pass/fail
     ตัวเลขอ้างอิงตั้งต้น (หลัง merge #301): 1108 tests / 1105 pass / 3 fail (ชุด incident-alerts เดิมของ Windows) / 0 skip
  3) เทสต์ใหม่ตามข้อ 4 ผ่านครบ และกรณีของบรรทัด cron (ไม่มี api_calls) ยังนับเป็น 1
  4) พิสูจน์ว่าเทสต์จับบั๊กได้: ย้อน ai-cost-tracker.ts เป็นของ main แล้วรันเทสต์ไฟล์นี้ → ต้องตก (แนบชื่อข้อ)
  5) ยิงจริงกับไฟล์จริงของ Hermes: ตั้ง HERMES_AUDIT_LOG_PATH=/opt/data/hermes-usage/usage_audit.jsonl แล้วเรียก getUnifiedAiCostSummary("today")
     แนบตัวเลข: requests ของ hermes_ops ต้องมากกว่าจำนวนบรรทัด (เพราะผลรวม api_calls) พร้อม tokens/ต้นทุนที่เท่าเดิม
  6) git diff main...HEAD -- artifacts/knight-basins/src/index.css | wc -l → 0

OUTPUT:
  - ai-cost-tracker.ts ที่นับจำนวนคำขอของเฮอร์มีสจาก api_calls
  - เทสต์ใหม่ใน test/ai-cost-center.test.ts
  - PR เข้า main พร้อมตัวเลขก่อน/หลัง (จำนวนบรรทัด → ผลรวม api_calls) และผลยิงจริง

STOP:
  - เมื่อ tsc 0 errors · เทสต์ผ่าน (ยกเว้น 3 ข้อ incident-alerts เดิม) · พิสูจน์จับบั๊กได้ · มีตัวเลขยิงจริง และเปิด PR แล้ว
  - หรือเมื่อทำงานครบ 25 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | อ่าน api_calls + รวมเป็นจำนวนคำขอ |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 2 ไฟล์ (lib + test) |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ UI (งานรีพิต) |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | tsc + ชุดเต็ม + ย้อนโค้ด + ยิงจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ไฟล์ + PR + ตัวเลขก่อน/หลัง |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 25 turns |
| 7 | SCOPE ใช้ absolute path | ผ่าน | /opt/data/cache/kbsrc/... |
| 8 | ไม่มี code fence ซ้อน | ผ่าน | ตัวอย่างบรรทัดแสดงแบบ indented |
| 9 | ห้ามแตะ src/index.css | ผ่าน | ระบุ 0 diff |
| 10 | มี branch name ชัดเจน | ผ่าน | fix/chai-hermes-request-count-from-api-calls |
| 11 | อ้างตัวเลข baseline | ผ่าน | 1108 / 1105 / 3 |
| 12 | ไม่ทับไฟล์กับใบงาน 253 | ผ่าน | 253 เป็น UI · 254 เป็น api-server |

## ข้อความส่งต่อ (บอส copy ส่งให้ชัย)

[เดวิด → ชัย]

งานใหม่ (เล็ก): ใบงาน 254 — `qa/job-254-chai-hermes-request-count-from-api-calls.md`
บอสถามว่า "จำนวนคำขอ" นับอย่างไร — ผมตรวจแล้ว: หน้าเว็บนับจาก **จำนวนบรรทัด** ในไฟล์ audit ต่อบริการ
- บริการแอป = 1 บรรทัดต่อการเรียก AI จริง (ถูกต้องอยู่แล้ว)
- เฮอร์มีส = 1 บรรทัดต่อ 1 รอบรายงาน → **ไม่ใช่จำนวนครั้งที่คุยกับ AI** (นี่คือเหตุที่ได้ 16 คำขอต่อ 213 ล้านโทเคน)
ผมแนบจำนวนการเรียกโมเดลจริงมาในฟิลด์ **`api_calls`** ของทุกบรรทัดที่สคริปต์ผมเขียนแล้ว
งานคุณ: ให้ parser อ่าน `api_calls` และนับจำนวนคำขอของบริการ `hermes_ops` เป็น **ผลรวมของฟิลด์นี้** (ไม่มีฟิลด์ = 1 เหมือนเดิม) · บริการอื่นห้ามเปลี่ยนพฤติกรรม · tokens/ต้นทุนต้องเท่าเดิม
หลักฐาน: tsc 0 · ชุด api-server (baseline ปัจจุบัน **1126/1123/3** — 3 ตกเป็นชุด incident-alerts เดิมของ Windows) · เทสต์ใหม่ (api_calls=4 → +4 · ไม่มีฟิลด์ → +1 · ค่าเสีย → +1) · ย้อนโค้ดแล้วต้องตก · ยิงจริงกับไฟล์จริง `/opt/data/hermes-usage/usage_audit.jsonl` แล้วแนบตัวเลข requests ก่อน/หลัง
