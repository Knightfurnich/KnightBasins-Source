# Hermes cron jobs — สรุปสำหรับผู้ตรวจ (9 ต.ค. 69 · เวลาไทย)

| งาน | ตาราง | โหมด | โมเดล | ส่งผลไปที่ | สถานะ |
|---|---|---|---|---|---|
| KnightDesign source mirror sync | 0 0 * * * | script (no LLM) | (default) | local | paused |
| hermes-log-prune | 0 4 * * * | script (no LLM) | (default) | local | active |
| hermes-usage-audit (สร้างไฟล์ต้นทุน Hermes ให้หน้า /admin/ai-cost) | every 15m | script (no LLM) | (default) | local | active |
| kb-colour-counts-sync | 0 0 * * * | script (no LLM) | (default) | telegram | active |
| knight-archive-purge | 0 20 * * * | script (no LLM) | (default) | telegram | active |
| knight-archive-tick | every 60m | script (no LLM) | (default) | telegram | active |
| knight-basins-watchdog | every 30m | script (no LLM) | (default) | telegram | active |
| knight-bundle-watch | every 15m | agent (LLM) | cohere/north-mini-code:free | telegram | active |
| knight-cert-renewal-check-dec | once at 2026-12-01 02:00 | agent (LLM) | (default) | origin | active |
| knight-crawler-collect | every 120m | script (no LLM) | (default) | local | active |
| knight-customer-log-collect | every 30m | script (no LLM) | (default) | origin | active |
| knight-deployment-watchdog | every 60m | script (no LLM) | (default) | local | active |
| knight-gsc-crawler-tracker | 0 2 * * * | agent (LLM) | cohere/north-mini-code:free | telegram | active |
| knight-line-morning-brief | 30 0 * * * | script (no LLM) | (default) | local | active |
| knight-seo-daily-alert | 0 3 * * * | script (no LLM) | (default) | telegram | active |
| knight-tracker-switch-to-weekly | once at 2026-10-23 02:00 | agent (LLM) | (default) | origin | active |
| model-rate-limit-watch | every 30m | script (no LLM) | (default) | telegram | active |
| เตือนย้าย repo กลับเป็น private (1 พ.ย. 69) | once at 2026-11-01 02:00 | agent (LLM) | (default) | origin | paused |

หมายเหตุ: ไม่มีค่า `.env`/คีย์ในไฟล์นี้ · งาน `no_agent` ไม่เรียก LLM เลย (0 token)
· งานที่ย้ายไปโมเดลฟรี 9 ต.ค. 69: `knight-gsc-crawler-tracker`, `knight-bundle-watch` (cohere/north-mini-code:free)
