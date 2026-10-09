# สรุปการใช้โมเดลจาก `hermes-usage/.ledger.jsonl` (ทั้งไฟล์ · 8 ก.ย. – 9 ต.ค. 69)

| โมเดล | calls | prompt tokens | completion tokens |
|---|---|---|---|
| deepseek/deepseek-v4.1-flash | 254 | 232,436,399 | 10,376,430 |
| gemini-3.8-flash | 37 | 145,438,819 | 3,150,695 |
| gemini-3.6-flash | 13 | 33,826,469 | 362,535 |
| cohere/north-mini-code:free | 3 | 140,668 | 6,678 |
| deepseek/deepseek-v4-flash-0731 | 1 | 29,137 | 148 |
| nvidia/nemotron-3-ultra-550b-a55b:free | 1 | 268 | 64 |
| gemini-3.5-flash | 1 | 589,787 | 8,926 |

**ข้อจำกัด:** คอลัมน์ต้นทุน (`total_cost`) ในไฟล์นี้เป็น 0 ทุกแถว — ledger นี้ไม่เก็บราคา ⇒ คำนวณ "ประหยัดได้กี่บาท" จากไฟล์นี้ไม่ได้ ต้องใช้ราคาต่อโมเดลจาก OpenRouter คูณเอง · โมเดลฟรีที่เริ่มถูกใช้จริงหลังสลับ cron (9 ต.ค.): `cohere/north-mini-code:free` = 3 calls
