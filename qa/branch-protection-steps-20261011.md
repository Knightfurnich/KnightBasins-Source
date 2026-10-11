# วิธีตั้ง Branch protection ของ main (แนะนำโดยเดวิด 11 ต.ค. 69)

## ค่าที่แนะนำ
| ตัวเลือก | ตั้งเป็น | เหตุผล |
|---|---|---|
| Require a pull request before merging | ✅ เปิด | ตรงกับกฎทีม (ห้าม push ตรง) |
| Require approvals | ❌ **ปิด** | บอสไม่ต้องกดอนุมัติทุก PR — ผม merge เองได้ (ยังมี check บังคับกันพลาดอยู่) |
| Require status checks to pass | ✅ เปิด | ด่านเทสต์อัตโนมัติ |
| — `Unit tests (api-server and knight-basins)` | ✅ required | มีอยู่แล้ว |
| — `Validate release contents` | ✅ **เพิ่มตัวที่ 2** | ปิดช่องโหว่: ตอนนี้บังคับแค่ Unit tests |
| Require branches to be up to date before merging | ✅ เปิด (แนะนำ) | กัน conflict ที่เกิดจาก merge ทีหลัง — ผม update branch ผ่าน API ได้ |

## วิธีเพิ่ม required check ตัวที่ 2 (หาไม่เจอให้ทำตามนี้)
1. เปิด https://github.com/Knightfurnich/KnightBasins-Source/settings/branches
2. ที่แถว **main** กด **Edit**
3. หัวข้อ **"Require status checks to pass before merging"** → ในช่อง **"Search for status checks in the last week for this repository"** พิมพ์หรือวางชื่อนี้ **ให้ตรงเป๊ะ (มีช่องว่าง)**
   `Validate release contents`
4. เลือกจากรายการที่เด้งขึ้น (ต้องเลือก = จะมีกรอบติด) → **Save changes**
5. ถ้าหน้านี้ใช้ **Rulesets** (ไม่ใช่ classic): เปิด https://github.com/Knightfurnich/KnightBasins-Source/settings/rules → เลือกกฎของ main → **Require status checks to pass** → **Add checks** → ค้นชื่อเดียวกัน → Save

**ทำไมต้องตรงเป๊ะ:** GitHub ค้นจากชื่อ check ที่ *รันจริงในรอบ 7 วันล่าสุด* — ตรวจแล้วว่าชื่อนี้รันจริงบน PR ของเราเมื่อ 11 ต.ค. 69 (#557: Unit tests + Validate release contents = success)
