/**
 * โครงร่างเทสต์โดยเดวิด (5 ต.ค. 69) — ใบงาน 270 (รีพิต)
 * TODO(รีพิต): เปิดใช้เมื่อ prerender เสร็จ — ตรวจว่าไฟล์ dist/public/<route>/index.html
 *   มีครบทุก URL ใน sitemap และ title ไม่ซ้ำกันทุกหน้า + JSON-LD ยังอยู่
 *   (ตอนนี้ "ข้าม" เพื่อไม่ให้กระทบชุด CI ก่อนเริ่มงาน)
 */
import test from "node:test";

test("prerender output covers every public sitemap route", { skip: "TODO(job 270): เปิดใช้หลังทำ prerender เสร็จ" }, () => {});
