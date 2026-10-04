/**
 * แหล่งความจริงเดียวของ “ป้ายสถานะงาน” (ทั้งผู้ช่วย AI และไฟล์ส่งออก CSV ใช้ชุดเดียวกัน)
 *
 * โครงร่างโดยเดวิด (4 ต.ค. 69) — รีพิตเติมป้ายตามใบงาน 264 (ภาคผนวก):
 *   ต้องมีป้ายไทยครบทุกค่าที่พบจริงในฐานข้อมูล 4 ต.ค. 69 (65 งาน):
 *   team_reported_paid · in_production · ready_for_production · closed · quote_sent · confirmed
 *   และค่าเดิมเพื่อความเข้ากันได้: new_lead · contacted · qualified · quoted · lost ฯลฯ
 *
 * ห้ามคัดลอกแผนที่ป้ายไปไว้ที่อื่น — ให้ import จากไฟล์นี้เท่านั้น
 */
export const LEAD_STATUS_LABELS: Record<string, string> = {
  // TODO(รีพิต): เติมป้ายไทยตามใบงาน
};

/** คืนป้ายไทยของสถานะงาน (ค่าที่ไม่รู้จักให้ป้ายกลางที่อ่านเข้าใจได้) */
export function displayLeadStatus(status: string): string {
  return LEAD_STATUS_LABELS[status] ?? "ไม่ทราบขั้นตอนงาน";
}
