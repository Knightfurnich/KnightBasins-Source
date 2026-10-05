# ใบ 270-fix (เดวิด) — deploy ล้มเพราะ Node 20 แต่ CI ใช้ Node 24 + เพิ่มด่าน CI ให้ตรงกับ deploy

- **วันที่:** 5 ต.ค. 2569
- **เจ้าของ:** เดวิด (ไฟล์ `.github/workflows/*` = ขอบเขต ops/deploy ของเดวิด ไม่ทับงานรีพีต)
- **สาเหตุจาก:** ใบ 270 (PR #359 · merge `3f86fa7`) — merge แล้ว CI เขียว แต่ **deploy ล้มที่ขั้น “Build Web App”**

## อาการ
- Deploy run `37295120760` (attempt 1 และ 2 หลัง re-run) → ขั้น **9. Build Web App = failure** → ขั้น 10-15 (copy dist / migrate / restart) ถูกข้ามทั้งหมด ⇒ production ไม่ถูกแตะ แต่ **การ deploy ของ main ถูกบล็อก**
- GitHub annotation ให้แค่ `Process completed with exit code 1` — อ่าน log ของ runner ไม่ได้ผ่าน API (401)

## สาเหตุจริง (รีโปรดิวซ์เองได้ ไม่ใช่สมมติฐาน)
| สภาพแวดล้อม | คำสั่ง | ผล |
|---|---|---|
| Node 20.20.2 (ตรงกับ `deploy.yml`) | `PORT=3000 NODE_ENV=production pnpm run build` | ❌ ล้มที่ prerender |
| Node 24 (ตรงกับ CI) / Node 26 | คำสั่งเดียวกัน | ✅ ผ่าน · ออก 10 หน้า |

ข้อความ error จริงบน Node 20:
```
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts" for
  /…/artifacts/knight-basins/src/components/RouteMeta.logic.ts
    at Object.getFileProtocolModuleFormat … code: 'ERR_UNKNOWN_FILE_EXTENSION'
```
`scripts/prerender.mjs` ทำ `import` ไฟล์ **TypeScript** (`RouteMeta.logic.ts`) โดยตรง — การ strip type ทำงานได้เฉพาะ **Node ≥ 22.6** จึงล้มเฉพาะบน Node 20 (CI ของ repo ใช้ Node 24 จึงเขียว ⇒ “CI เขียว แต่ deploy แดง”)

## สิ่งที่แก้ (PR นี้)
1. `.github/workflows/deploy.yml` → `node-version: '20'` → **`'24'`** (พร้อมคอมเมนต์กันคนแก้กลับ)
2. `.github/workflows/release-validation.yml` → เพิ่มขั้น **`Build Web App (deploy parity)`** รันคำสั่งเดียวกับ deploy (`PORT=3000 NODE_ENV=production pnpm run build` ใน `artifacts/knight-basins`) ⇒ เคสแบบนี้จะตกตั้งแต่ตอน PR
3. `KANBAN.md` — อัปเดตสถานะ 270 + บันทึกสาเหตุ

## หลักฐานการแก้ (เดวิดรันจริง)
- Node 20 → ล้มด้วย error ข้างบน (ข้อความเต็มใน commit message ของ PR)
- Node 26 + Chrome (`CHROME_BIN=/opt/data/chrome/chrome-headless-shell-linux64/chrome-headless-shell` v154) → build ผ่าน และได้เนื้อหาจริงต่อหน้า:
  `/` 1,861 คำ · `/studio` 1,287 · `/stone` 1,080 · `/sketch` 1,069 · `/updates` 833 · `/readme` 812 · `/studio-guide` 681 · `/quote` 552 · `/portfolio` 93 · `/site-prep` 77
  (ก่อนหน้าบน production: **0 คำ ทุกหน้า** — 13,622 bytes SPA shell)
- static fallback (ไม่มี Chrome): ผ่านเช่นกัน (14–44 คำ/หน้า)

## งานที่ยังเป็นของรีพีต (ใบ 270-fix ต่อ)
1. `scripts/prerender.mjs` — **ห้าม throw ทำให้ build ตาย**: ถ้ามี Chrome แต่ render ไม่สำเร็จ ให้ fallback เป็น static shell + `console.warn` (โหมดเข้มงวดได้เมื่อตั้ง env เช่น `PRERENDER_REQUIRE_BROWSER=1`)
2. พิสูจน์ 2 โหมดและรายงานผลจริง

## หมายเหตุ ops (จดไว้ใช้ซ้ำ)
- `deploy/hostinger/nginx.conf` **ไม่ถูก deploy อัตโนมัติ** (workflow copy แค่ `web-dist`, `api-dist`, `migrations`) ⇒ แก้ nginx ต้อง apply บน VPS เอง + สำรองก่อนทุกครั้ง
- VPS: `web-dist` ได้จาก `artifacts/knight-basins/dist/public/*` (strip_components 4 → รวมโฟลเดอร์ย่อยของหน้าที่ prerender)
