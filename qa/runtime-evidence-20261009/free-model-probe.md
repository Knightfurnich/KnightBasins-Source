# ผลตรวจโมเดลฟรีของ OpenRouter (15 ตัว) — 9 ต.ค. 69

คำสั่งที่ใช้ (คีย์อ่านจาก `/opt/data/.env` ไม่พิมพ์ออกมา):
```python
# 1) วันหมดอายุ — endpoint ที่ต้องมีคีย์
GET  https://openrouter.ai/api/v1/models/user          # field: expiration_date
# 2) privacy probe — บังคับ provider.data_collection = deny
POST https://openrouter.ai/api/v1/chat/completions
     {"model": "<id>", "messages": [{"role":"user","content":"hi"}], "max_tokens": 4,
      "provider": {"data_collection": "deny"}}
#   200        = endpoint ยอมไม่เก็บข้อมูล (safe)
#   404 + "data policy" = endpoint บังคับให้ยอมให้ผู้ให้บริการนำข้อมูลไปฝึก (train) ⇒ ห้ามใช้กับข้อมูลธุรกิจ
```

## ตารางผล (รัน 9 ต.ค. 69 ~10:05 น. ไทย)
| โมเดลฟรี | privacy probe | วันหมดอายุ | ใช้กับงานเราได้ไหม |
|---|---|---|---|
| apodex/apodex-1.1-mini:free | **200 safe** | ไม่มี | ✅ (อยู่ใน fallback chain) |
| cohere/north-mini-code:free | **200 safe** | ไม่มี | ✅ (ใช้กับ cron 2 งาน) |
| dots-studio/dots-3-note-preview:free | **200 safe** | **2026-12-31** | ✅ แต่มีวันหมดอายุ |
| google/gemma-4-26b-a4b-it:free | 429 (ติด rate limit ตอนตรวจ) | ไม่มี | ⚠️ ตรวจไม่จบ |
| google/gemma-4-31b-it:free | 429 | ไม่มี | ⚠️ ตรวจไม่จบ |
| liquid/lfm-2.5-2.6b:free | 404 data policy | ไม่มี | ❌ train |
| nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free | 404 data policy | ไม่มี | ❌ train |
| nvidia/nemotron-3-super-120b-a12b:free | 404 data policy | ไม่มี | ❌ train |
| nvidia/nemotron-3-ultra-550b-a55b:free | 404 data policy | ไม่มี | ❌ train |
| nvidia/nemotron-3.5-content-safety:free | 404 data policy | ไม่มี | ❌ train |
| nvidia/nemotron-3.5-lightning:free | 404 data policy | ไม่มี | ❌ train |
| poolside/laguna-s-2.1:free | 404 data policy | **2026-10-31** | ❌ train + หมดอายุ |
| poolside/laguna-xs-2.1:free | 404 data policy | **2026-10-31** | ❌ train + หมดอายุ |
| thinkingmachines/inkling-small:free | 403 | ไม่มี | ⚠️ ตรวจไม่จบ |
| thinkingmachines/inkling:free | 403 | ไม่มี | ⚠️ ตรวจไม่จบ |

**สรุป:** safe 3 · train 8 · ตรวจไม่จบ 4 → ตรงกับตัวเลขที่ watchdog รายงาน (`รุ่นฟรีไม่ฝึกข้อมูล: 3 · บังคับฝึก: 8 · ใช้ไม่ได้: 4`)

## ข้อสังเกตที่ควรรู้
- ตัวที่คนใช้มากที่สุดในหน้า OpenRouter (nemotron-3-super, nemotron-3.5-lightning, poolside) **ตกเกณฑ์ทั้งหมด** เพราะบังคับยอมให้ผู้ให้บริการนำข้อมูลไปฝึก ⇒ ใช้กับข้อมูลธุรกิจ/ลูกค้าไม่ได้
- `dots-3-note-preview` (ความจุ 512k) ผ่าน privacy แต่มี **วันหมดอายุ 31 ธ.ค. 69** ⇒ ไม่ถูกเลือกเป็นตัวสำรองหลัก (เลือก apodex ที่ไม่มีวันหมดอายุ)
- ตัวที่ได้ 429/403 เป็นการจำกัดชั่วคราวของผู้ให้บริการ ไม่ใช่ "ตกเกณฑ์" — ต้องรันซ้ำจึงจะสรุปได้

## หมายเหตุวิธีทดสอบภาษาไทย (ข้อ C ของใบ 292-Q)
ทดสอบด้วย `POST /chat/completions` (ไม่ใช่ metadata) ผลที่วัดได้ 9 ต.ค. 69:
| โมเดล | คำถามไทยสั้น | ผล |
|---|---|---|
| cohere/north-mini-code:free | สรุปตัวเลข crawler | ✅ ตอบไทย 113 ตัวอักษร · `finish_reason=stop` |
| apodex/apodex-1.1-mini:free | คำถามเดียวกัน | ❌ `content=None` · `finish_reason=length` (โมเดลสายคิด — เผางบ token ไปกับ `reasoning`) |
| dots-studio/dots-3-note-preview:free | คำถามเดียวกัน | 🟡 ตอบไทย 93 ตัวอักษร แต่มีคำเพี้ยน ("728 ครั้ง family หน้าทั้ง 12 หน้าแล้ว") |
