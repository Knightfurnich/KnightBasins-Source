# ใบงาน 251-C (ชัย) — แถว "เฮอร์มีส" ในหน้ต้นทุน AI ขึ้น 0 เพราะอ่านชื่อฟิลด์ไม่ตรงกับไฟล์จริง

**วันที่:** 4 ต.ค. 69 · **ออกโดย:** เดวิด (หัวหน้าทีม)
**สถานะ:** มอบหมายให้ชัย (บอสเห็นชอบแล้ว) · **งานเล็กระดับ parser + เทสต์**
**Branch:** `fix/chai-hermes-usage-audit-field-names`
**ที่มา:** บอสเปิดหน้า /admin/ai-cost แล้วเห็น "เฮอร์มีส (งานบริหารระบบ & งานช่าง)" = 0 ทั้งที่ใช้งานจริงทุกวัน
**ข้อเท็จจริงที่เดวิดพิสูจน์แล้ว (4 ต.ค. 69):** ไฟล์ที่ระบบอ่านคือ /opt/data/cron/usage_audit.jsonl ซึ่งเป็นไฟล์ที่ engine ของ Hermes เขียนเอง
  ตัวอย่างบรรทัดจริงในไฟล์ (ชื่อฟิลด์เป็น snake_case ไม่ใช่ camelCase ที่ parser คาดไว้):
    {"ts": "2026-10-04T10:42:01.309Z", "job_id": "8b4deceecb1a", "prompt_tokens": 42557, "completion_tokens": 1392, "total_tokens": 43949, "model": "deepseek/deepseek-v4.1-flash", "duration_ms": 7854, "error": null}
  driver ปัจจุบันอ่าน body["timestamp"], body["promptTokens"], body["completionTokens"], body["totalTokens"], body["durationMs"] → ได้ undefined หมด → ต้นทุน 0

```
✅ มาตรฐานการออกใบงาน · 12/12 · 4 ต.ค. 69 · เดวิด

GOAL:
  1. แก้ parseHermesAuditLine ใน artifacts/api-server/src/lib/ai-cost-tracker.ts ให้รับชื่อฟิลด์ได้ทั้ง 2 แบบ
     (ก) แบบที่ engine ของ Hermes เขียนจริง: ts · prompt_tokens · completion_tokens · total_tokens · duration_ms · error · model
     (ข) แบบ camelCase เดิม: timestamp · promptTokens · completionTokens · totalTokens · durationMs · success
     ถ้ามีทั้งคู่ให้ใช้ค่าที่ไม่ว่าง และห้าม throw ทุกกรณี (บรรทัดเสีย = ข้าม ไม่ทำให้ทั้งไฟล์พัง)
  2. แปลงค่าเวลา: "ts" ที่เป็น ISO string ต้องใช้เป็น timestamp ของ event (ถ้า parse ไม่ได้ให้ fallback เป็นเวลาปัจจุบันเหมือนเดิม)
  3. error ที่ไม่ใช่ null → ถือว่า success = false (เพื่อให้ต้นทุนที่ล้มเหลวยังถูกนับตามจริง — ห้ามทิ้ง)
  4. คงพฤติกรรมเมื่อไฟล์ไม่มี/อ่านไม่ได้ = คืนรายการว่าง ไม่ throw (ปัจจุบันถูกแล้ว — ห้ามทำพัง)
  5. ห้ามแก้ฝั่ง UI และห้ามแตะไฟล์ที่ผู้อื่นถือ — หน้าเว็บอ่านจาก services[] อยู่แล้ว จึงไม่ต้องแก้ UI

SCOPE:
  - /opt/data/cache/kbsrc/artifacts/api-server/src/lib/ai-cost-tracker.ts
  - /opt/data/cache/kbsrc/artifacts/api-server/test/ai-cost-center.test.ts

FORBIDDEN:
  - ห้ามแตะไฟล์ UI ทุกไฟล์ (artifacts/knight-basins/**) รวม src/index.css
  - ห้ามแตะ routes/leads.ts · lib/sketch-vision*.ts (งาน 247 ปิดไปแล้ว — ไม่ต้องกลับไปแก้)
  - ห้ามแก้ราคา/เรตในตาราง cost · ห้าม hard-code คีย์หรือ path ใหม่ในโค้ด (path มาจาก env HERMES_AUDIT_LOG_PATH อยู่แล้ว)
  - ห้ามแตะ Production · ห้าม push ตรง main

EVIDENCE:
  1) npx tsc -p artifacts/api-server/tsconfig.json --noEmit → 0 errors
  2) node --experimental-strip-types --test test/*.test.ts ใน artifacts/api-server → ระบุ tests/pass/fail/skip
     ตัวเลขอ้างอิงตั้งต้น: บน Linux ก่อนแก้ ชุดนี้ได้ 1093 tests / 1090 pass / 3 fail (ชุด incident-alerts เดิมของ Windows) / 0 skip — ให้บันทึกตัวเลขจริงที่วัดได้ในรอบของตัวเอง
  3) เทสต์ใหม่ต้องครอบ: (ก) บรรทัด snake_case จาก engine → ได้ prompt/completion/total tokens ถูกต้อง (ข) บรรทัด camelCase เดิมยังทำงาน
     (ค) "ts" ถูกใช้เป็นเวลา (ง) error ≠ null → success=false (จ) ไฟล์หาย/บรรทัดเสีย → ไม่ throw
  4) พิสูจน์ว่าเทสต์จับบั๊กได้จริง: ย้อนโค้ด ai-cost-tracker.ts กลับเป็นของ main แล้วรันเทสต์ไฟล์นี้ → ต้องตกอย่างน้อย 2 ข้อ (แนบชื่อข้อที่ตก) แล้วคืนโค้ด
  5) ยิงจริง 1 ครั้งด้วยไฟล์ตัวอย่างจาก production: คัดลอกบรรทัดจริงจาก /opt/data/cron/usage_audit.jsonl ใส่ไฟล์ชั่วคราว แล้วตั้ง HERMES_AUDIT_LOG_PATH ชี้ไปที่ไฟล์นั้น
     รัน getUnifiedAiCostSummary แล้วแนบตัวเลขว่า services[] แถว hermes_ops ได้ tokens เท่าไร (ต้องไม่ใช่ 0)

OUTPUT:
  - artifacts/api-server/src/lib/ai-cost-tracker.ts (แก้ parser + คอมเมนต์อธิบายว่าทำไมต้องรับ 2 แบบ)
  - artifacts/api-server/test/ai-cost-center.test.ts (เพิ่มเทสต์ตามข้อ 3 ในไฟล์เดิมที่มีอยู่)
  - PR เข้า main พร้อมผลรันจริงและตัวเลขก่อน/หลัง (0 → ค่าจริง)

STOP:
  - เมื่อ tsc 0 errors · เทสต์ชุดเต็มผ่าน (ยกเว้น 3 ข้อ incident-alerts เดิม) · พิสูจน์จับบั๊กได้ · ยิงจริง 1 ครั้งมีตัวเลข และเปิด PR แล้ว
  - หรือเมื่อทำงานครบ 25 turns ให้หยุดและรายงานสิ่งที่ทำเสร็จ/เหลือ
```

| ข้อ | รายการตรวจ | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | มีบล็อก GOAL ชัดเจน | ผ่าน | รับ 2 รูปแบบชื่อฟิลด์ + เวลา + error |
| 2 | มีบล็อก SCOPE ชัดเจน | ผ่าน | 2 ไฟล์ (lib + test) |
| 3 | มีบล็อก FORBIDDEN ชัดเจน | ผ่าน | ห้ามแตะ UI · ห้ามแตะไฟล์งาน 247 |
| 4 | มีบล็อก EVIDENCE ชัดเจน | ผ่าน | tsc + ชุดเต็ม + เทสต์ใหม่ 5 เคส + พิสูจน์จับบั๊ก + ยิงจริง |
| 5 | มีบล็อก OUTPUT ชัดเจน | ผ่าน | ไฟล์ + PR + ตัวเลขก่อน/หลัง |
| 6 | มีบล็อก STOP เป็นตัวเลข | ผ่าน | 25 turns |
| 7 | SCOPE ใช้ absolute path | ผ่าน | /opt/data/cache/kbsrc/... |
| 8 | ไม่มี code fence ซ้อนในบล็อกใบงาน | ผ่าน | บรรทัดตัวอย่างแสดงแบบ indented |
| 9 | ห้ามแตะ src/index.css | ผ่าน | ระบุชัด |
| 10 | มี branch name ชัดเจน | ผ่าน | fix/chai-hermes-usage-audit-field-names |
| 11 | อ้างตัวเลข baseline | ผ่าน | 1093 / 1090 / 3 |
| 12 | ไม่ทับไฟล์กับใบงานอื่น | ผ่าน | ไฟล์นี้ไม่มีใบงานอื่นถืออยู่ |

## ข้อความส่งต่อ (บอส copy ส่งให้ชัย)

[เดวิด → ชัย]

งานใหม่ (เล็ก): ใบงาน 251 — `qa/job-251-chai-hermes-cost-audit-parser.md`
สาเหตุที่หน้า /admin/ai-cost แถว "เฮอร์มีส" ขึ้น 0 (ผมพิสูจน์แล้ว): ระบบอ่านไฟล์ `/opt/data/cron/usage_audit.jsonl` **ได้ถูกไฟล์** แต่ **ชื่อฟิลด์ไม่ตรงกัน** — engine ของ Hermes เขียนเป็น `ts` / `prompt_tokens` / `completion_tokens` / `total_tokens` / `duration_ms` / `error` แต่ parser อ่านแบบ camelCase (`timestamp` / `promptTokens` / …) → ได้ undefined ทั้งหมด → ต้นทุนเป็น 0
แก้: ให้ parser รับ **ทั้งสองแบบ** + ใช้ `ts` เป็นเวลา + `error ≠ null` = success=false + ห้าม throw
หลักฐาน: tsc 0 · ชุด api-server (baseline 1093/1090/3) · เทสต์ใหม่ 5 เคส · ย้อนโค้ดแล้วต้องตก ≥2 ข้อ · ยิงจริงกับบรรทัดจริงจากไฟล์ production แล้วต้องได้ tokens ไม่ใช่ 0
หมายเหตุ: **ไม่ต้องแก้ UI** (หน้าเว็บอ่านจาก services[] อยู่แล้ว) และ **ไม่ต้องแก้ฝั่ง Hermes** — ผม (เดวิด) จะทำส่วน mount ให้คอนเทนเนอร์อ่านไฟล์นี้ได้เอง
