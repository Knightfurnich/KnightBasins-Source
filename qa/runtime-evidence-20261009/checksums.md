# md5 ของสคริปต์ที่สร้างหลักฐานชุดนี้ (ตรวจว่าเวอร์ชันตรงกับที่รันจริง)

**เก็บเมื่อ:** 2026-10-10 00:40 +07 · **ที่มา:** `md5sum` บนเครื่อง Hermes (รีเฟรชหลังแก้ตามรีวิว 409-C/410-Q · รีโป ops `f809a45`)

> ℹ️ **ค่า asset ที่เสิร์ฟจริง:** ใช้ **sha256** เป็นหลัก (ตัวเลขไบต์ขึ้นกับวิธีวัด/การบีบอัด — รีวิว 410-Q จับได้ ±8 B)
> `/assets/index-CBuXnlCN.css` = **386,347 B · sha256 `5ec13b68f3637b54b7e7cce2c7e08aaecba13664a62a2bf660e8bccb2d796e8f`** (ยืนยันโดย Qwen + เดวิด)

> ⚠️ รีวิว 293-C/294-Q ชี้ถูกว่า md5 **ยังเทียบไม่ได้จริง** เพราะตัวสคริปต์ไม่ได้อยู่ในรีโป
> (md5 ทำได้แค่ยืนยันว่า *รอบนี้* ไฟล์ที่รันมีค่าเท่านี้) — ตัวสคริปต์อยู่ในรีโปส่วนตัว
> `Knightfurnich/hermes-ops-private` แล้ว (commit ล่าสุด **`f809a45`**) ซึ่ง **รวม `plugins/knight-team/tools.py` เข้าชุดตรวจด้วย** (รีวิว 402-C/403-Q)

| ไฟล์ | md5 |
|---|---|
| `bin/verify_deploy.py` | `a3c2e329c06e7568f3f8f80f1b7ce7d3` |
| `plugins/knight-team/tools.py` | `d1401daa3e057807fef388dea3697303` |
| `bin/model_rate_limit_watch.py` | `289aa4a14ada42cfa8f06e2c78009446` |
| `bin/knight_crawler_report.sh` | `8ebb3b6af9d2087c6f02c111e28cb259` |
| `bin/knight_bundle_probe.sh` | `5d5aefa535ad75fb01226e0de00638bc` |
| `bin/verify_vps_repo_drift.py` | `90a1c922880b0712a5d00a563b67358d` |
| `knight-design-kb/build-public.py` | `d0fd87ba99b3ae85a53a60a7edf64c1d` |
| `knight-design-kb/sync-kb.py` | `1fbd6b0a3eb4da62e70cd591007320ee` |
| `scripts/knight_crawler_report.sh` | `5397447bc2716deb52ccf505c306554e` |
| `bin/knight_watchdog.sh` | `a0dd8f5c8916d56b5569f663564f6977` |
| `scripts/knightbasins_watchdog.sh` | `d39bb090834265133f8fc99ba7217770` |
| `bin/kb_colour_counts.py` | `29ff5389bb51ad619bdcda8a6c9b48f4` |
| `bin/kb_web_asset_check.py` | `3d1479e767959b225b1fc89351c9104c` |
| `bin/push_indexnow.py` | `ed1918b7ca679cbea86dda216c5ba685` |
| `bin/gsc_deep_check.py` | `5602768f8971f4ed66c542dff272fb1e` |
| `bin/seo_onpage_check.py` | `1a33f4c2170630c6fd88f27f33d19400` |
| `scripts/kb_sync_from_admin.py` | `3baf7ae1e2f83baea91b65c9398e7f13` |

## ตัวสคริปต์อยู่ที่ไหน (ปิดช่อง md5 — อัปเดต 9 ต.ค. 69)

รีวิว 293-C/294-Q ชี้ถูกว่า md5 ข้างบน **เทียบไม่ได้จริง** ถ้าไม่มีตัวสคริปต์ ⇒ ตอนนี้ตัวสคริปต์อยู่ใน
**repo ส่วนตัว `Knightfurnich/hermes-ops-private`** (เห็นได้เฉพาะทีม — ผม push แล้ว 154 ไฟล์ · commit `5892144`)

วิธีใช้สำหรับผู้ตรวจ (ชัย / Qwen):
1. ขอสิทธิ์อ่าน repo ส่วนตัวจากเจ้าของ (หรือให้เดวิดแนบไฟล์ที่ต้องการในคอมเมนต์ PR)
2. `md5sum bin/verify_deploy.py` (หรือไฟล์ใดในตารางข้างบน) แล้วเทียบกับค่าในตารางนี้
3. ผลที่ควรได้: **ตรงทุกไฟล์** — ถ้าไม่ตรง = สคริปต์ถูกแก้หลังเก็บหลักฐาน ให้แจ้งเดวิด

⚠️ ยังคงเป็น **ภาพ ณ เวลาหนึ่ง** — สคริปต์ที่แก้หลังจากนี้จะ md5 ไม่ตรง (ให้ยึดหลัก "ผู้ตรวจเทียบเองได้" มากกว่าตัวเลข)
