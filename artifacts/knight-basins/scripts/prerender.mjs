/**
 * โครงร่างโดยเดวิด (5 ต.ค. 69) — ใบงาน 270 (รีพิต): prerender หน้าสาธารณะ
 *
 * เป้าหมาย: หลัง `vite build` ให้ render หน้าสาธารณะ (10 URL ตาม public/sitemap.xml)
 * ด้วย headless Chromium แล้วเขียน dist/public/<route>/index.html
 * เพื่อให้ Googlebot และ AI crawlers (ที่ไม่รัน JS) เห็นเนื้อหา + title/description/canonical เฉพาะหน้า
 *
 * TODO(รีพิต): ทำตามใบงาน qa/job-270-replit-prerender-public-pages.md
 *   - อ่านรายการเส้นทางจาก public/sitemap.xml (10 URL)
 *   - render แต่ละหน้า → เขียน dist/public/<route>/index.html
 *   - ตรวจว่า title/description/canonical ต่างกันตามหน้า และ body มีข้อความ > 0 คำ
 *   - อย่า prerender /admin*
 * ถ้าติดตั้ง Chromium ใน CI ไม่ได้ → ทำแบบ static SEO shell แทน แล้วรายงานเหตุผล
 */
console.log("[prerender] โครงร่าง — ยังไม่ได้ติดตั้งใน build (รอรีพิตทำตามใบงาน 270)");
