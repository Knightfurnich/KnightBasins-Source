# สรุปการใช้โมเดล — `hermes-usage/.ledger.jsonl` (ฉบับแก้ไข 9 ต.ค. 69 หลังรีวิว 294-Q)

**แก้ไขเมื่อ:** 9 ต.ค. 69 (TH) · **สาเหตุ:** Qwen (294-Q ข้อ D.3/E) ชี้ถูกว่า **ตารางฉบับก่อนหารผิดคู่** (เอา `prompt_tokens` หารด้วยจำนวน *เซสชัน* แทนจำนวน *การเรียก*) ⇒ ได้ 3.9M tokens/call ซึ่งเป็นไปไม่ได้ ⇒ **ถอนตารางเดิมทั้งตาราง** และแทนด้วยตารางนี้

## วิธีนับ (ต้องอ่านก่อนใช้ตัวเลข)
- ไฟล์นี้เก็บ **1 บรรทัด = 1 เซสชัน** (ไม่ใช่ 1 การเรียก) โดยมีฟิลด์ `api_calls` = จำนวนครั้งที่เรียกโมเดลในเซสชันนั้น และ `prompt_tokens`/`completion_tokens`/`total_tokens` = ยอดรวมของทั้งเซสชัน
- **tokens/call = Σ`total_tokens` ÷ Σ`api_calls` ของโมเดลนั้น (หารจากยอดรวมทั้งช่วง ไม่ใช่ค่าเฉลี่ยของอัตราส่วนรายแถว)**
- ช่วงข้อมูล: `2026-09-08T07:52:24Z` → `2026-10-09T08:53:44Z` · จำนวนบรรทัด: **324** · คีย์/token: **0** (ไฟล์นี้ไม่เก็บคีย์)

## ตารางที่ถูกต้อง (คำนวณใหม่ทั้งไฟล์)
| โมเดล | เซสชัน | api_calls | prompt_tokens | completion_tokens | total_tokens | tokens/call |
|---|---|---|---|---|---|---|
| `deepseek/deepseek-v4.1-flash` | 268 | 11,825 | 238,006,930 | 10,507,025 | 248,513,955 | **21,016** |
| `gemini-3.8-flash` | 37 | 12,201 | 145,438,819 | 3,150,695 | 148,589,514 | **12,178** |
| `gemini-3.6-flash` | 13 | 1,984 | 33,826,469 | 362,535 | 34,189,004 | **17,232** |
| `gemini-3.5-flash` | 1 | 22 | 589,787 | 8,926 | 598,713 | **27,214** |
| `cohere/north-mini-code:free` | 3 | 16 | 140,668 | 6,678 | 147,346 | **9,209** |
| `deepseek/deepseek-v4-flash-0731` | 1 | 4 | 29,137 | 148 | 29,285 | **7,321** |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 1 | 1 | 268 | 64 | 332 | **332** |
| **รวม** | **324** | **26,053** | **418,032,078** | **14,036,071** | **432,068,149** | **16,584** |

**เกณฑ์สุขภาพ:** ค่า tokens/call ของทุกโมเดลอยู่ช่วง 332–27,214 ซึ่ง **สมเหตุสมผล** กับขนาด context ของโมเดลเหล่านี้ (ต่างจาก 3.9M ของตารางเดิม)

## 3 บรรทัดดิบแรกของไฟล์ (ให้ตรวจวิธีนับได้เอง)
```json
{"ts":"2026-09-08T07:52:24.471201Z","model":"deepseek/deepseek-v4-flash-0731","source":"hermes_interactive","session":"20260908_074548_ecbf09","api_calls":4,"prompt_tokens":29137,"completion_tokens":148,"total_tokens":29285}
{"ts":"2026-09-11T06:25:58.865598Z","model":"deepseek/deepseek-v4.1-flash","source":"hermes_interactive","session":"20260911_043748_b4db79","api_calls":290,"prompt_tokens":1881261,"completion_tokens":222935,"total_tokens":2104196}
{"ts":"2026-09-12T07:58:56.598688Z","model":"deepseek/deepseek-v4.1-flash","source":"hermes_interactive","session":"20260911_044612_a03ef45c","api_calls":1486,"prompt_tokens":26984797,"completion_tokens":1591511,"total_tokens":28576308}
```
ตรวจตัวอย่างบรรทัดที่ 3 ด้วยมือ: `28,576,308 ÷ 1,486 = 19,230 tokens/call` ✅ อยู่ในช่วงที่สมเหตุสมผล

## ⛔ ห้ามใช้ไฟล์นี้ตอบคำถามเรื่องเงิน
- ทุกบรรทัดมี `total_cost` = **0** (ledger ไม่เก็บราคา) ⇒ **คำนวณ "ประหยัดได้กี่บาท" จากไฟล์นี้ไม่ได้** (คำตอบเดียวกับฉบับก่อน — ยังถูกต้อง)
- การนับนี้เป็น **ยอดสะสมของเซสชัน** ⇒ ไม่แยกได้ว่าส่วนใดเป็น cached-read หรือ retry; ถ้าต้องใช้ตัดสินใจเรื่องงบ ให้ใช้แดชบอร์ดผู้ให้บริการ (OpenRouter usage) เป็นแหล่งจริง

## การสลับโมเดลสำรอง (failover) — หลักฐานดิบ
`model-watch-dry-run.txt` รายงาน "สลับโมเดลสำรอง 1 ครั้งใน 60 นาที" และ Qwen ขอให้ระบุ **จาก/ไปยังตัวไหน** (294-Q ข้อ D ข้อ 2) — บรรทัดจริงใน log:
```
2026-10-09 05:53:46,950 INFO [20261007_200422_85dad695] agent.chat_completion_helpers: Fallback activated: deepseek/deepseek-v4.1-flash → gemini-3.5-flash (gemini)
```
⇒ การสลับครั้งนั้นคือ **ตัวหลัก → ตัวสำรองลำดับที่ 1 (`gemini-3.5-flash`) ไม่ใช่ apodex** จึงไม่ขัดกับผลทดสอบภาษาไทยที่ apodex ตอบว่าง (294-Q ข้อ D ข้อ 2) · เก็บบรรทัดดิบไว้ใน `model-watch-failover-raw.txt`

## chain ปัจจุบัน = **5 รายการ** (ตัวหลัก + 4 สำรอง) — แก้จากที่เอกสารก่อนหน้าเขียนว่า 4
```
1) deepseek/deepseek-v4.1-flash        (ตัวหลัก · openrouter)
2) gemini-3.5-flash                    (สำรอง 1 · gemini)
3) cohere/north-mini-code:free         (สำรอง 2 · openrouter · ฟรี)
4) apodex/apodex-1.1-mini:free         (สำรอง 3 · openrouter · ฟรี)
5) deepseek/deepseek-chat              (สำรอง 4 · openrouter)
```
ที่มา: `config.yaml` → `model.provider: openrouter` + `fallback_providers` 4 รายการ (ตรวจสด 9 ต.ค. 69)
