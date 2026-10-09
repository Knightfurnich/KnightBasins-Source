# ใบงาน 295-C (ชัย) — **ตรวจงานเดวิด: เปลี่ยนชื่อโฮสต์ API** (`api.srv1964473` → `api.knightbasins.com`) + เหตุขัดข้องที่เกิดระหว่างทำ

**วันที่:** 9 ต.ค. 69 · **ออกโดย:** เดวิด · **เจ้าของงาน:** **ชัย** · **ผู้ตรวจรับ:** **บอส**
**ที่มา:** บอสเคาะ (ค2) "เปลี่ยนชื่อ api.srv1964473 → api.knightbasins.com" · ระหว่างทำ **เกิดเหตุขัดข้องจริง ~2 นาที** (อธิบายในใบ) แล้วเดวิดแก้เสร็จ ⇒ บอสสั่งให้ตรวจอิสระ
**กติกา:** งานนี้ **อ่านอย่างเดียว 100%** · ทุกข้อต้องมีคำสั่ง + ผลรันดิบ · ข้อที่เข้าไม่ถึง = เขียน "ตรวจไม่ได้ + เหตุผล" **ห้ามเดา**

## สรุปสิ่งที่เดวิดทำ (9 ต.ค. 69 เวลาไทย 16:2x–16:5x)
```
1) เพิ่ม DNS:  api.knightbasins.com  A  72.62.79.84      (Hostinger API · อ่านค่ากลับแล้ว · resolve ทันที)
2) Traefik router `knightapi` label เปลี่ยนเป็น:
     Host(`api.knightbasins.com`) || Host(`api.srv1964473.hstgr.cloud`)   ← เก็บชื่อเดิมไว้เป็นทางสำรองก่อน
   ไฟล์: /docker/hermes-agent-2xwn/data/knight-design-kb/api-proxy/docker-compose.yml
3) ⚠️ recreate container `knight-api` → **nginx สตาร์ทไม่ขึ้น (Restarting)** เพราะ config อ้าง upstream แบบชื่อตรง ๆ:
     [emerg] host not found in upstream "knight-images-admin" in /etc/nginx/conf.d/default.conf:74
   ⇒ เป็น "กับดักที่ซ่อนอยู่ก่อนแล้ว": บอสหยุด container `knight-images-admin` ไว้ (9 ต.ค.) แต่ nginx ของ proxy
     resolve ชื่อ upstream ตอน start เท่านั้น ⇒ พอ recreate = ล้มทันที → **404 ทั้ง 2 โฮสต์ (~2 นาที)**
4) แก้ config ให้ทนทาน (ใช้ variable + resolver แทนชื่อตรง ๆ):
     - proxy_pass http://knight-images-admin:8080/;
     + set $images_admin http://knight-images-admin:8080;
     + rewrite ^/kb/admin/(.*)$ /$1 break;
     + proxy_pass $images_admin;
   ⇒ ต่อจากนี้ ถ้า image manager ถูกหยุด route /kb/admin/ จะได้ 502 เฉพาะเส้นนั้น ไม่ลาก /kb/ /v1/ /health ล่มไปด้วย
   ไฟล์: /docker/hermes-agent-2xwn/data/knight-design-kb/api-proxy/nginx.conf (สำรอง *.bak-upstream-*)
5) recreate อีกครั้ง → nginx -t ผ่าน · knight-api Up · ตรวจครบ 3 ปลายทาง = 200
6) แก้ .env ของแอป: HERMES_API_URL = https://api.knightbasins.com (สำรอง .env.bak-api-rename-*) + recreate api/web
   → ยืนยันค่าที่ container เห็นจริงด้วย `docker exec knightbasins-api printenv HERMES_API_URL`
7) แก้สคริปต์ฝั่ง Hermes 18 ไฟล์ที่ยังอ้างชื่อเดิม (รวม bin/verify_deploy.py · bin/knight_watchdog.sh) — สำรอง *.bak-apirename-*
8) บอส start container `knight-images-admin` กลับ → route /kb/admin/ = 200 · เดวิดถอดชื่อออกจาก state/intentionally-stopped-containers
```

```
✅ มาตรฐานการออกใบงาน · 12/12 · 9 ต.ค. 69 · เดวิด

GOAL:
  A. **ยืนยันโฮสต์ใหม่ให้บริการจริง** (ยิงเองจากภายนอก — ไม่ต้องมีสิทธิ์ในเครื่อง):
       `https://api.knightbasins.com/kb/pricing.json` · `/kb/images/slab/QS288.png` · `/health` → **200**
       `https://api.knightbasins.com/v1/models` → **401** (แปลว่าเส้นทางถึง Hermes API และต้องใช้คีย์)
       `https://api.knightbasins.com/kb/admin/` → **200** (image manager กลับมาแล้ว)
  B. **ยืนยันชื่อเดิมยังใช้ได้ (ทางสำรองที่ตั้งใจเก็บไว้)** — ยิง 3 เส้นข้างบนที่ `https://api.srv1964473.hstgr.cloud/...` → ต้อง 200 เหมือนกัน
     (ถ้าไม่ 200 = ทางสำรองพัง ต้องแจ้งทันที)
  C. **ตรวจใบรับรองของโฮสต์ใหม่** (จากภายนอก ผ่าน IP VPS + SNI):
       CN = api.knightbasins.com · SAN ต้องมี `api.knightbasins.com` (และอาจมีชื่อเดิมระหว่างเปลี่ยนผ่าน) · ระบุ notAfter
       เกณฑ์: **ต้องไม่ใช่ใบ default ของ Traefik** (CN=TRAEFIK DEFAULT CERT) — ถ้าเป็นใบ default = ยังออกใบไม่สำเร็จ
  D. **ตรวจว่าแอปไม่พัง**: `https://knightbasins.com/` · `/stone` · `/api/healthz` · `/api/catalog` · `/kb/images/slab/QS288.png` → **200 ทุกเส้น**
     + นับ `srv1964473` ใน payload ของ `/api/catalog` → **ต้องเป็น 0** (แอป rewrite เป็นโดเมนหลัก)
  E. **ทบทวนการแก้ config ของเดวิดจากหลักฐานที่แนบมา** (ท้ายใบนี้) — ตอบว่าเห็นด้วย/ไม่เห็นด้วย + ถ้าไม่เห็นด้วย เสนอทางที่ดีกว่า
       ประเด็นที่ควรคิด: (1) การใช้ variable + resolver แทนชื่อตรง ๆ ถูกต้องตามพฤติกรรม nginx ไหม (2) `rewrite ... break` รักษา path เดิมหรือไม่
       (3) มี route อื่นในไฟล์เดียวกันที่ยังอ้างชื่อ container แบบตรง ๆ (เสี่ยงแบบเดียวกัน) เหลืออยู่ไหม
  F. **ข้อเสนอ**: ควรถอดชื่อเดิม (`api.srv1964473`) ออกจาก router เมื่อไร และมีอะไรต้องทำก่อน (เดวิดยังไม่ถอด เพราะ DB 203 แถวยังเก็บ URL ชื่อเดิม)

SCOPE (path สัมบูรณ์ในเครื่องเรา):
  - /opt/data/cache/kbsrc/qa/report-chai-review-api-rename-20261009.md         (ใหม่)
  - /opt/data/cache/kbsrc/qa/job-295-chai-review-api-rename-20261009.md         อ่านเท่านั้น
  - /opt/data/knight-design-kb/api-proxy/nginx.conf                             อ่านเท่านั้น (แนบเนื้อหาไว้ท้ายใบนี้)
  - /opt/data/knight-design-kb/api-proxy/docker-compose.yml                     อ่านเท่านั้น

FORBIDDEN:
  - ห้ามแก้ไฟล์ระบบ/config/DB/container ใด ๆ (read-only 100%) · ห้าม restart/recreate · ห้าม POST ไปที่ production
  - ห้าม merge/แก้ PR ของเดวิด · ห้าม push ตรงเข้า `main` · ห้ามพิมพ์ค่าลับ/คีย์ (ใบนี้ไม่ต้องใช้คีย์)
  - ห้ามสรุปว่า "ผ่าน" จากคำอธิบายของเดวิด — ต้องมีคำสั่ง + ผลที่รันเอง (หรือระบุ "ตรวจไม่ได้")

EVIDENCE (คำสั่งที่ต้องรันจริง — แนบผลดิบทุกข้อ):
  1) `for p in /kb/pricing.json /kb/images/slab/QS288.png /health /v1/models /kb/admin/; do curl -s -o /dev/null -w "%{http_code} $p\n" https://api.knightbasins.com$p; done`
  2) คำสั่งเดียวกันกับโฮสต์เดิม `https://api.srv1964473.hstgr.cloud` (ข้อ B)
  3) `echo | openssl s_client -connect 72.62.79.84:443 -servername api.knightbasins.com 2>/dev/null | openssl x509 -noout -subject -dates -ext subjectAltName`
  4) หน้าเว็บ + API + นับ 0 จุดใน payload (ข้อ D) — แนบตัวเลขต่อ URL
  5) ข้อ E: ตาราง เห็นด้วย/ไม่เห็นด้วย ทีละประเด็น (1)(2)(3) พร้อมเหตุผล
  6) ข้อ F: ความเห็น + สิ่งที่ต้องทำก่อนถอดชื่อเดิม
  7) commit SHA ของสาขารายงาน (`git log -1 --format=%H`) + เวลาไทยที่ตรวจ · baseline: 200 ×5 · 401 ×1 · SAN มีชื่อใหม่ · 0 จุด

OUTPUT:
  - `qa/report-chai-review-api-rename-20261009.md` — ตาราง A–F: **ผ่าน / ไม่ผ่าน / ตรวจไม่ได้** + หลักฐานดิบ
  - สรุป 5 บรรทัด: ยืนยันได้อะไร · ยังไม่น่าเชื่อถืออะไร · ความเสี่ยงคงเหลือ · ข้อเสนอ · สิ่งที่ต้องรอเจ้าของ
  - เปิด PR (docs) แล้วส่งลิงก์ + รายงานสั้นในแชท

STOP:
  - เมื่อครบ A–F และมีผลดิบครบ · หรือทำงานครบ **12 turns** ให้หยุดและรายงานสิ่งที่ทำเสร็จ + ที่เหลือ
  - ห้ามขยายขอบเขตไปแก้ของที่พบ (รายงานอย่างเดียว) — พบปัญหาที่กระทบ production ให้รายงานเดวิด/บอสทันที
```

## เช็คลิสต์ท้ายใบ (ติ๊กในรายงาน/PR)

| # | สิ่งที่ต้องยืนยัน | เกณฑ์ |
|---|---|---|
| 1 | โฮสต์ใหม่: price feed | 200 |
| 2 | โฮสต์ใหม่: รูป KB | 200 |
| 3 | โฮสต์ใหม่: /health | 200 |
| 4 | โฮสต์ใหม่: /v1/models | 401 |
| 5 | โฮสต์ใหม่: /kb/admin/ | 200 |
| 6 | โฮสต์เดิม (สำรอง) | 200 ทั้ง 3 เส้น |
| 7 | cert โฮสต์ใหม่ | SAN มีชื่อใหม่ · ไม่ใช่ใบ default |
| 8 | หน้าเว็บ 4 เส้น | 200 |
| 9 | /api/catalog | 0 จุด srv1964473 |
| 10 | ทบทวน config (3 ประเด็น) | เห็นด้วย/ไม่เห็นด้วย + เหตุผล |
| 11 | route อื่นที่เสี่ยงแบบเดียวกัน | ระบุว่ามี/ไม่มี |
| 12 | ข้อเสนอการถอดชื่อเดิม | มีความเห็นชัด |

## หลักฐานแนบ: config ที่แก้ (ให้ทบทวนข้อ E)

`/docker/hermes-agent-2xwn/data/knight-design-kb/api-proxy/docker-compose.yml`
```yaml
      # ก่อน
      traefik.http.routers.knightapi.rule: "Host(`api.srv1964473.hstgr.cloud`)"
      # หลัง
      traefik.http.routers.knightapi.rule: "Host(`api.knightbasins.com`) || Host(`api.srv1964473.hstgr.cloud`)"
```

`/docker/hermes-agent-2xwn/data/knight-design-kb/api-proxy/nginx.conf`
```nginx
    # ก่อน (ทำให้ nginx สตาร์ทไม่ขึ้นเมื่อ container เป้าหมายถูกหยุด)
    location /kb/admin/ {
        proxy_pass http://knight-images-admin:8080/;
        ...
    }

    # หลัง
    location /kb/admin/ {
        set $images_admin http://knight-images-admin:8080;
        rewrite ^/kb/admin/(.*)$ /$1 break;
        proxy_pass $images_admin;
        ...
    }
```
บริบทในไฟล์เดียวกัน: มี `resolver 127.0.0.11 valid=10s ipv6=off;` + `set $hermes_api http://hermes-agent-2xwn-hermes-agent-1:8642;` อยู่แล้ว (ใช้รูปแบบ variable เหมือนกัน) — `location /` จึงไม่ล้มแบบเดียวกัน

## ข้อความส่งต่อให้บอสวาง (relay)

```
[เดวิด → ชัย] ใบ 295-C ครับ — ตรวจงานเปลี่ยนชื่อโฮสต์ API (api.srv1964473 → api.knightbasins.com) ตามที่บอสเคาะ (ค2)
เรื่องที่ต้องรู้: ระหว่างทำเกิดเหตุจริง ~2 นาที — recreate knight-api แล้ว nginx สตาร์ทไม่ขึ้น เพราะ config อ้าง upstream ชื่อ knight-images-admin ตรง ๆ (container ที่บอสหยุดไว้) → 404 ทั้ง 2 โฮสต์ · เดวิดแก้เป็น variable + resolver แล้ว (route /kb/admin/ จะได้ 502 เฉพาะเส้นนั้นถ้าตัวนั้นหยุด ไม่ลากทั้งระบบ) · บอส start images-admin กลับแล้ว · ตอนนี้ 200 ครบ
ให้ตรวจเอง (read-only 100%): A โฮสต์ใหม่ 5 เส้น (200/200/200/401/200) · B โฮสต์เดิมยังใช้ได้ · C cert SAN ต้องมีชื่อใหม่และไม่ใช่ใบ default · D หน้าเว็บ+API 200 และ /api/catalog 0 จุด · E ทบทวน config ที่แนบ (variable+resolver ถูกไหม · rewrite รักษา path ไหม · มี route อื่นเสี่ยงแบบเดียวกันไหม) · F ควรถอดชื่อเดิมเมื่อไร
ห้าม: แก้ไฟล์/DB/container · restart/recreate · POST ไป production · merge PR เดวิด · พิมพ์คีย์
ผลลัพธ์: qa/report-chai-review-api-rename-20261009.md + PR (docs) + ระบุ ผ่าน/ไม่ผ่าน/ตรวจไม่ได้ ทีละข้อ · STOP 12 turns
```
