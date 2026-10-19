# ONBOARDING — บอย (Qwen) · ผู้ช่วยพัฒนา Frontend/UI + ตรวจงานอิสระ

> สร้าง **19 ต.ค. 2569** (ฉบับตั้งต้นการเชื่อมต่อใหม่ ตามคำสั่งบอส: "ข้อมูลการเชื่อมต่อของทีมที่ชื่อ Qwen หายหมด — ให้เดวิดรันกระบวนการ onboarding ใหม่")
> **ต้นฉบับอยู่ที่ `/opt/data/knight-design-kb/ONBOARDING-qwen.md` บนเครื่อง Hermes — ห้ามแก้สำเนาในรีโป (`docs/team/ONBOARDING-qwen.md`) ตรง ๆ** ให้แจ้งเดวิดเพื่อแก้ต้นฉบับแล้วซิงก์
> **กฎที่มีผลจริง** = `CLAUDE.md` · `CONTRIBUTING.md` · `KANBAN.md` · `qa/QUEUE.md` (คิวคำสั่งจริง) · เอกสารนี้เป็น "จุดเริ่มต้น" เท่านั้น
> **ชื่อ:** ไทย = **บอย** · อังกฤษ = **Qwen** (บอสยืนยัน 11 ต.ค. 69) · **ฟรีบัฟ (Freebuff) = คนละคน**

## 1 · บทบาทและขอบเขตไฟล์ (สำคัญที่สุด)

**บอย (Qwen) = ผู้ช่วยพัฒนา Frontend/UI + ผู้ตรวจงานอิสระ**
เจ้าของไฟล์: **`artifacts/knight-basins/src/components/**`** และ **`artifacts/knight-basins/src/admin/**`** (+ ไฟล์ที่ใบงานระบุเป็นรายครั้ง)

| ใคร | เจ้าของไฟล์ | ห้ามแตะ |
|---|---|---|
| **ชัย** | `artifacts/api-server/**`, `artifacts/knight-basins/src/data/**` | UI ทุกไฟล์ |
| **บอย (คุณ)** | `artifacts/knight-basins/src/components/**`, `src/admin/**` | `src/data/**`, `api-server/**`, `src/index.css`, `src/App.tsx` (hero) |
| **ฟรีบัฟ (Freebuff)** | `artifacts/knight-basins/src/pages/**` + ไฟล์ที่ใบงานระบุ | `src/components/**`, `src/admin/**`, `src/data/**`, `api-server/**`, `src/index.css`, `src/App.tsx` |
| **รีพิต** | งานตรวจ/วัด + เครื่องมือวัด (`qa/tools/**`) | ไฟล์ UI ที่คนอื่นถือ |
| **เดวิด** | ops · KB · nginx · ใบงาน · ตรวจรับ · merge | โค้ดแอป (ยกเว้นบอสสั่ง) |

- **หนึ่งใบงาน = หนึ่งสาขา = หนึ่ง PR** · ห้ามรวมหลายงานในใบเดียว
- **ห้ามแก้ไฟล์เดียวกันพร้อมคนอื่น** — เช็ก **ทะเบียนไฟล์ (ท้าย `KANBAN.md`)** ก่อนเริ่มทุกครั้ง · ถ้าจำเป็นต้องแตะไฟล์ของคนอื่น ให้แจ้งเดวิดก่อน
- **ไฟล์ที่ถูกถืออยู่ ณ 19 ต.ค. 69 (ห้ามแตะ · อ่านได้):** `src/components/ThemeToggle.tsx` → **ชัยถือตามใบ 472-C** · `qa/tools/**` + `.github/workflows/release-validation.yml` → **รีพิตถือตามใบ 471-R**

## 2 · การเชื่อมต่อ GitHub (ส่วนที่ต้องตั้งใหม่รอบนี้)

- **รีโป:** `https://github.com/Knightfurnich/KnightBasins-Source` (branch หลัก `main`) — **รีโปสาธารณะ ⇒ `git clone` เพื่ออ่าน/รันเทสต์ทำได้เลย ไม่ต้องใช้ token**
- **การ push / เปิด PR ต้องมี token ของตัวเอง** — ชื่อที่ตั้งไว้เดิม: **`qwen-knightbasins-pc`** (fine-grained · สิทธิ์ repo เดียว: Contents + Pull requests) ⇒ **ขอจากบอสหรือเดวิดผ่านช่องทางส่วนตัว** (ห้ามขอ/ส่งในกลุ่มแชท)
- ⚠️ **กฎความลับ:** ห้ามพิมพ์ token/คีย์/`.env` ลงแชท รายงาน ล็อก หรือ commit · ถ้า token หลุด ⇒ แจ้งบอสทันทีเพื่อลบและสร้างใหม่
- **วิธีใช้แบบไม่ให้ค่าหลุด** (แบบเดียวกับที่เดวิดใช้):
  ```bash
  # เก็บค่าใน env ของเชลล์เท่านั้น (ไม่ echo)
  export KB_TOKEN='<วางค่าที่ได้รับ>'      # อย่าให้ค่านี้ไปอยู่ในไฟล์/ประวัติคำสั่ง
  printf '#!/bin/sh\ncase "$1" in *Username*) echo x-access-token;; *) echo "$KB_TOKEN";; esac\n' > /tmp/askpass.sh
  chmod +x /tmp/askpass.sh

  git clone https://github.com/Knightfurnich/KnightBasins-Source.git
  cd KnightBasins-Source
  git checkout -b qwen/<ชื่องานสั้น>
  # ... แก้ไฟล์/เพิ่มรายงาน ...
  GIT_ASKPASS=/tmp/askpass.sh GIT_TERMINAL_PROMPT=0 git push https HEAD:qwen/<ชื่องานสั้น>
  # แล้วเปิด PR บน GitHub (ห้าม merge เอง)
  ```
- **ขั้นพิสูจน์ว่าเชื่อมได้จริง (ทำในใบแรก):** `git ls-remote` ต้องคืนรายการ ref (ไม่ error) → สร้าง branch → commit → push → เปิด PR (สถานะ OPEN) · **แนบผลคำสั่งในรายงาน** (ห้ามแนบตัว token)
- **ถ้ายังไม่มี token (ไม่บล็อกงาน):** ใช้เส้นทางเดิมได้ทันที — ทำบนเครื่องบอส/เครื่องตัวเอง → ส่ง **รายงาน + ไฟล์** ให้บอสหรือเดวิด → **เดวิดเป็นคน commit และเปิด PR ให้** · ให้ระบุในรายงานว่าใช้เส้นทางไหน
- **ห้าม** push ตรงเข้า `main` · **ห้าม** merge PR เอง · **ห้าม** deploy เอง (merge เป็นหน้าที่เดวิดเมื่อหลักฐานครบและ CI เขียว)

## 2.1 · วิธีรับ token อย่างปลอดภัย (สำหรับบอส/เดวิด → Qwen)

> กฎเหล็ก: **ห้ามส่งค่า token ในแชท/กลุ่ม/รายงาน/commit** — ผู้รับ (Qwen) ต้องไม่มีค่าอยู่ใน transcript
> และ **Qwen ส่ง token ให้ตัวเองไม่ได้** (คนที่ออก token คือ **บอส** ซึ่งเป็นเจ้าของบัญชี GitHub)

**ขั้นตอนสำหรับบอส (ครั้งเดียว ~4 นาที · ทำใน GitHub ของบอส)**
1. GitHub → Settings → Developer settings → **Personal access tokens → Fine-grained tokens → Generate new token**
2. Name: `qwen-knightbasins-pc` · Expiration: ตั้งตามที่บอสต้องการ (แนะนำ 90 วัน แล้วหมุนรอบ)
3. Repository access: **Only select repositories → `Knightfurnich/KnightBasins-Source`**
4. Permissions (Repository): **Contents: Read and write** · **Pull requests: Read and write** · (ไม่ต้องให้สิทธิ์อื่น)
5. Generate แล้ว **คัดลอกค่า** — GitHub จะแสดงครั้งเดียว

**วิธีส่งถึง Qwen แบบไม่ให้ค่าหลุดในแชท (เลือกอย่างใดอย่างหนึ่ง)**
> **เครื่องของ Qwen = เครื่อง Windows ของบอส** ⇒ บอสทำเองได้ทันที: เปิด **Notepad** → วางค่า token (บรรทัดเดียว ไม่มีช่องว่าง/อัญประกาศ) → **Save as** → `%USERPROFILE%\knight-token.txt` (เลือก "All files" เพื่อไม่ให้ได้ .txt.txt) → แจ้ง Qwen ว่า "อ่าน token จาก `%USERPROFILE%\knight-token.txt`"
> แนะนำจำกัดสิทธิ์ไฟล์: คลิกขวา → Properties → Security → เอาเฉพาะบัญชีบอส/ผู้ใช้ที่รัน Qwen (ไม่ต้องแชร์ให้ Everyone)
- **ก (แนะนำ):** เขียนค่าลง **ไฟล์บนเครื่องที่ Qwen รันอยู่** แล้วให้ Qwen อ่านไฟล์นั้น เช่น `~/.knight/qwen-token` (หรือที่อยู่ที่ตกลงกัน) — Qwen จะอ่านด้วยคำสั่งที่ไม่ echo:
  ```bash
  export KB_TOKEN=$(cat ~/.knight/qwen-token)   # ห้าม echo $KB_TOKEN
  ```
- **ข:** ตั้งเป็น **environment variable ของโปรเซสที่รัน Qwen** (ไม่ผ่านแชท)
- **ค:** วางผ่าน secret manager/vault ที่ทั้งสองฝ่ายเข้าถึง

**หลังได้ค่า — Qwen ทดสอบเอง (อย่าแนบค่าในรายงาน · แนบแค่ผล):**
```bash
git ls-remote https://github.com/Knightfurnich/KnightBasins-Source.git >/dev/null && echo "read OK"
printf '#!/bin/sh\ncase "$1" in *Username*) echo x-access-token;; *) echo "$KB_TOKEN";; esac\n' > /tmp/askpass.sh && chmod +x /tmp/askpass.sh
GIT_ASKPASS=/tmp/askpass.sh GIT_TERMINAL_PROMPT=0 git push --dry-run https HEAD:refs/heads/qwen-token-check   # ควรผ่าน (ไม่สร้างสาขาจริง)
```
- ถ้า push ไม่ผ่าน (401/403) ⇒ **แจ้งเดวิด/บอสทันที** ห้ามลองซ้ำหลายครั้ง และ **ห้ามพิมพ์ค่าเพื่อดีบัก**
- ถ้าสงสัยว่าค่าหลุด ⇒ แจ้งบอสเพื่อ revoke + ออกใหม่ทันที

## 2.2 · รีโปที่สอง: `Knightfurnich/hermes-ops-private` (บอสเปิดสิทธิให้ 19 ต.ค. 69)

> **สถานะ:** บอสเปิดสิทธิรีโป ops ให้ Qwen · **ยังต้องยืนยันระดับสิทธิ์** (อ่านอย่างเดียว หรืออ่าน+เขียน) และ Qwen ต้องมี **ใบงาน** ทุกครั้งที่แตะรีโปนี้

**รีโปนี้คืออะไร (ตรวจโดยเดวิด · 19 ต.ค. 69):** private · 171 ไฟล์ · **ไม่มี CI/workflow** · ประกอบด้วย
- `bin/` · `scripts/` = **สคริปต์ปฏิบัติการที่แตะระบบจริงได้**: `deploy_api.py` · `deploy_web.py` · `restart_gateway.sh` · `hssh.py` (SSH เข้า VPS) · ตัว apply nginx · watchdog · `verify_deploy.py`
- `knight-design-kb/` = **สำเนา KB** (ข้อความธุรกิจ/ราคา — **ไม่ใช่แหล่งจริง**; แหล่งจริงคือหน้าแอดมิน/`GET /api/catalog`)
- `checksums.md` · `plugins/` · `.gitignore`
- ตรวจแล้ว: **ไม่มีไฟล์คีย์/ความลับโดยชื่อ** และสคริปต์ที่สุ่มตรวจไม่มีค่าความลับฝังอยู่

**กฎเหล็กของรีโปนี้ (ใช้ทุกกรณี — อ่านหรือเขียน)**
1. **ห้าม push ตรง `main`** · ทุกอย่างผ่าน **branch + PR** · **ห้าม merge/deploy เอง** (เดวิดตรวจรับ + merge)
2. **ห้ามรันคำสั่งปฏิบัติการ** แม้จะอยู่ในรีโป: `deploy_*.py` · `restart_gateway.sh` · `hssh.py` · ตัว apply nginx · watchdog — เป็นของฝั่ง ops (เดวิด/บอส) เท่านั้น
3. **ห้ามคัดลอกค่าความลับ** (คีย์/โทเคน/รหัส/host) จากไฟล์/สคริปต์/`.env` ลงรายงาน แชท หรือ commit — อ้างอิงได้แค่ **ชื่อไฟล์/บรรทัด/ชื่อตัวแปร**
4. **ห้ามใช้ `knight-design-kb/` ในรีโปนี้เป็นแหล่งข้อมูลราคา/สี** — ให้ยึดหน้าแอดมิน/`GET /api/catalog` และสอบถามเดวิดเมื่อไม่แน่ใจ
5. **หนึ่งใบงาน = หนึ่งสาขา = หนึ่ง PR** · เช็กทะเบียนไฟล์ท้าย `KANBAN.md` ก่อนเริ่ม (ไฟล์ ops ส่วนใหญ่ **เดวิดถือ**)

**คำแนะนำสิทธิ์ (least privilege)**
- ถ้างานของคุณในรีโปนี้คือ **อ่าน/อ้างอิง/เขียนรายงาน** ⇒ ให้ขอ **Read-only** (Contents: Read) — ปลอดภัยที่สุด
- ถ้าบอสต้องการให้แก้สคริปต์ ops จริง ⇒ Read+Write ได้ แต่ต้องยึดกฎข้อ 1–5 ข้างบนทุกข้อ
- ผลข้างเคียงที่ควรรู้: รีโปนี้ **ไม่มี CI** ⇒ การ push ไม่มีด่านอัตโนมัติตรวจจับ ความปลอดภัยจึงพึ่ง "วินัย + ใบงาน + PR + การตรวจรับของเดวิด" เป็นหลัก

## 3 · เอกสารที่ต้องอ่านก่อนเริ่ม (เรียงลำดับ)

**อ่านจากใน repo เท่านั้น** (ถ้าเปิดไม่เจอ ให้บอกเดวิด — เขาจะให้ *path ในรีโป*; ห้ามขอสิทธิ์เข้าเครื่อง Hermes):

1. `docs/team/README.md` — ดัชนี + กฎห้ามพลาด 6 ข้อ (อ่านอันนี้ก่อน)
2. `docs/team/ONBOARDING-qwen.md` — ไฟล์นี้
3. `docs/team/TEAM.md` — โครงสร้างทีม บทบาท มารยาท
4. `CONTRIBUTING.md` — กฎ commit/branch/หลักฐาน
5. `KANBAN.md` — งานทั้งหมด สถานะ + **ทะเบียนไฟล์ที่ถูกถืออยู่ (ท้ายไฟล์)**
6. `qa/QUEUE.md` — **คิวคำสั่งจริงต่อคนต่อรอบ** (หนึ่งคน = หนึ่งข้อความต่อรอบ · WIP ไม่เกิน 2 ใบ)
7. `qa/job-*.md` — ใบงาน (GOAL · SCOPE · FORBIDDEN · EVIDENCE · OUTPUT · STOP)

**อ่านจากเครื่อง Hermes ไม่ได้ (ไม่ต้องพยายาม):** `CLAUDE.md` บนเครื่อง Hermes · โฟลเดอร์ `knight-design-kb/` — กฎที่คนทำงานต้องรู้ถูกสรุปใน `docs/team/README.md` แล้ว · ถ้าต้องการข้อมูล KB ส่วนใดให้แจ้งเดวิด (ห้ามเดาตัวเลขธุรกิจ)

## 4 · กฎเหล็ก 10 ข้อ

1. **ธุรกิจ:** Knight Furnich = หินสังเคราะห์ 3 รูปแบบขาย (แผ่นดิบ / งานผลิต+ติดตั้ง / อ่างชุดสำเร็จ) · B2C 70% / B2B 30%
2. **แอปจริง:** `https://knightbasins.com` · โค้ด GitHub `Knightfurnich/KnightBasins-Source` (branch `main`)
3. **ห้ามแตะ production:** ห้าม `docker`/recreate · ห้ามเขียน/ลบข้อมูล prod · ห้าม `DELETE` · ห้ามรัน migration (ต้องผ่าน PR)
4. **ความลับ:** ห้ามพิมพ์คีย์/token/`.env`/รหัส ลงรายงาน แชท หรือล็อก
5. **ราคา/สี/ขนาด:** ห้ามคิดเลขเอง — ยึดข้อมูลจริงจาก `GET /api/catalog` (หน้าแอดมินเป็นแหล่งจริง) · รหัสสีคือตัวตนของสี (`KZ802` ≠ `KZ802N`)
6. **อ่างล้างหน้า:** รุ่นกลมต้องเป็น `Ø350x150` (ตัวอักษร Ø) ไม่ใช่ `D350x150` · `KF029/KF030` = "เสาวางของตั้งพื้น" ไม่ใช่อ่าง · รูน้ำล้น = ตัวเลือกสั่งทำ ไม่ใช่สเปกของรุ่น
7. **หลักฐานคือหัวใจ:** ทุกข้อสรุปต้องมี HTTP code / ผลรันจริง / ตัวเลข · **พิสูจน์สองทาง** (ถอดการแก้ → ตก · คืน → ผ่าน) · **ห้ามกุตัวเลข ห้ามคำรับรองลอย ๆ**
8. **ทำงานผ่านใบงานเท่านั้น:** `qa/job-NNN-*.md` → สาขาของตัวเอง → เปิด PR (**ห้าม push `main` ตรง · ห้าม merge เอง**)
9. **เวลา:** รายงานเป็นเวลาไทย (GMT+7) · เซิร์ฟเวอร์/DB ใช้ UTC
10. **มารยาท:** ไทย สุภาพ ติงานไม่ติคน · พลาดให้บอกทันทีพร้อมทางแก้ · รายงานตามจริง 100%

## 5 · คำสั่งพื้นฐาน (และ baseline ปัจจุบัน)

```bash
# typecheck
npx tsc -p artifacts/knight-basins/tsconfig.json --noEmit
npx tsc -p artifacts/api-server/tsconfig.json --noEmit

# เทสต์ (รันในโฟลเดอร์นั้น ๆ)
cd artifacts/knight-basins && node --experimental-strip-types --test $(find test -maxdepth 1 -name '*.test.ts' ! -name '*.browser.test.ts' | sort)
cd artifacts/api-server && node --experimental-strip-types --test test/*.test.ts
```
**baseline อ้างอิง (main · 19 ต.ค. 69 · Linux · เดวิดรัน):** web **1,529 / ผ่าน 1,520 / ตก 0 / ข้าม 9** · api **1,329 / 1,329 / 0** · `tsc` = 0 ทั้ง 2
⚠️ เครื่องคุณอาจได้เลขต่าง (OS/Node ต่าง) ⇒ **รันเองแล้วรายงาน commit + OS + ผู้รันของคุณ** ห้ามคัดลอกตัวเลขคนอื่น

## 6 · ส่งงานอย่างไร

- รายงานเป็นไฟล์ในรีโปที่ **`qa/`** (`qa/report-qwen-round<N>-<หัวข้อ>-<วันที่>.md`) + ภาพหลักฐานใน `qa/images/...` แล้วเปิด PR (หรือส่งให้เดวิดเปิด PR ให้ ถ้ายังไม่มี token)
- **สรุป 5 บรรทัด:** สิ่งที่ทำ · ผ่าน/ไม่ผ่าน · **ตรวจไม่ได้อะไร (พร้อมเหตุผล)** · ความเสี่ยง · ข้อเสนอ
- เกณฑ์ตรวจรับใบงาน: มาตรฐาน **12 ข้อ** (ดูท้ายใบงานทุกใบ) + ตัวตรวจ `bin/job_standard_check.py` (อยู่เครื่อง Hermes — ขอให้เดวิดรันได้)

## 7 · การตรวจงานอิสระ (หน้าที่ที่ทีมต้องพึ่งคุณ)

- **ห้ามเชื่อคำสรุปใน PR** — ต้องรันเทสต์เอง ยิงเส้นทางจริงที่ผู้ใช้ใช้ วัดค่าจาก HTTP/DOM และแนบ **หลักฐานดิบทีละข้อ**
- ถ้าตัวเลขที่รายงานกับที่คุณวัดได้ไม่ตรง ⇒ **รายงานส่วนต่างพร้อมคำสั่งที่ใช้** (ของทีมเคยจับข้ออ้างเกินจริงได้ด้วยวิธีนี้)
- จุดที่ด่านอัตโนมัติ **มองไม่เห็น** ต้องใช้ตา+มือตรวจ: ข้อความบนพื้นไล่สี/พื้นรูป · ข้อความในคอนโทรลฟอร์ม (`<input>` · ปุ่มไอคอนเดียว · checkbox วาดเอง) · ข้อความสั้น 1–2 ตัวอักษร · สถานะ error/empty/loading
- เกณฑ์คอนทราสต์ของทีม: **≥ 4.5** (ตัวใหญ่ ≥ 3.0) ทั้งโหมดสว่างและมืด · ข้อยกเว้นเดียวที่บอสอนุมัติ = ปุ่ม LINE (เขียว 2.26)

---

**ติดต่อ:** รายงานผ่านบอสหรือเดวิด · งานด่วน/ติดขัด ⇒ บอกทันที ไม่ต้องรอครบรอบ
