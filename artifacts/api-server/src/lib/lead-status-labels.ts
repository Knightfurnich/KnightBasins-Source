/**
 * Shared source of Thai lead-status labels for the operations assistant and CSV exports.
 * Keep status text here; consumers should call displayLeadStatus instead of copying a map.
 */

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new_lead: "งานใหม่",
  selecting: "กำลังเลือกสินค้า",
  quote_requested: "ขอใบเสนอราคา",
  quote_sent: "ส่งใบเสนอราคาแล้ว",
  waiting_deposit: "รอมัดจำ",
  team_reported_paid: "ทีมรายงานชำระแล้ว",
  deposit_paid: "มัดจำแล้ว",
  confirmed: "ชำระเงินแล้ว",
  in_production: "กำลังผลิต",
  ready_for_production: "พร้อมผลิต",
  closed: "ปิดการขาย",
  // Compatibility labels for legacy lead rows and the SlipOK auto-close state.
  new: "งานใหม่",
  contacted: "ติดต่อแล้ว",
  qualified: "ผ่านการคัดกรอง",
  quoted: "ส่งใบเสนอราคาแล้ว",
  lost: "ยุติการติดตาม",
};

/** คืนป้ายไทยของสถานะงาน (ค่าที่ไม่รู้จักให้ป้ายกลางที่อ่านเข้าใจได้) */
export function displayLeadStatus(status: string): string {
  return LEAD_STATUS_LABELS[status] ?? "ไม่ทราบขั้นตอนงาน";
}
