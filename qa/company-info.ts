/**
 * ข้อมูลทางการของบริษัท ไนท์ เฟอร์นิช จำกัด (สำนักงานใหญ่)
 * ใช้เป็น Single Source of Truth สำหรับหัวใบเสนอราคา ใบกำกับภาษี และเอกสารทางการทั้งหมด
 * ถอดจากเอกสารจริง: Sep 26 / US / 0754 และ Sep 26 / OF / 1125
 */

export const KNIGHT_COMPANY_INFO = {
  companyNameTh: "บริษัท ไนท์ เฟอร์นิช จำกัด (สำนักงานใหญ่)",
  companyNameEn: "KNIGHT FURNICH Co., Ltd",
  brandName: "Knight Design",
  taxId: "0-1355-53014-11-4",
  taxIdRaw: "0135553014114",
  addressTh: "35/170, 35/267 หมู่ที่ 1 ซอยร่วมสุข 8/13 ถนนติวานนท์-แจ้งวัฒนะ ตำบลบ้านใหม่ อำเภอเมืองปทุมธานี จังหวัดปทุมธานี 12000",
  phones: ["094-496-1949", "089-762-2209"],
  phonesDisplay: "094-496-1949, 089-762-2209",
  email: "info@knightfurnich.com",
  website: "www.knightfurnich.com",
  lineOa: "KnightBot (@789gcnhq)",
  lineOaId: "@789gcnhq",

  // บัญชีธนาคารสำหรับชำระเงิน
  bankAccount: {
    bankName: "ธนาคารกรุงศรีอยุธยา",
    branch: "สาขา ปตท. ติวานนท์",
    accountName: "บริษัท ไนท์ เฟอร์นิช จำกัด",
    accountNumber: "574-1-18925-4",
    accountNumberRaw: "5741189254",
  },

  // เงื่อนไขการชำระเงินมาตรฐาน
  paymentTerms: {
    general: [
      "50% เมื่อเซ็นอนุมัติสั่งซื้อ / ก่อนวัดพื้นที่ / ก่อนผลิตงาน",
      "50% ก่อนเข้าติดตั้งงานอย่างน้อย 2 วันทำการ",
    ],
    fullPaymentThreshold: 40000, // ยอดไม่เกิน 40,000 บาท ชำระ 100%
    fullPaymentCondition: "ยอดสั่งซื้อสินค้าไม่เกิน 40,000 บาท ชำระ 100%",
    billingNotice: "วางบิลทาง Email หรือไลน์เท่านั้น (เป็นระบบโอน ไม่มีรับเช็ค)",
    receiptNotice: "เอกสาร/ใบเสร็จ/ใบกำกับจัดส่งทางไปรษณีย์",
  },

  // กำหนดยืนราคา
  quoteValidityDays: 30,
  quoteValidityText: "ระยะเวลา 30 วัน นับตั้งแต่วันที่เสนอราคา",

  // เวลาทำการ / รับสินค้า
  operatingHours: {
    weekday: "จันทร์ - ศุกร์ เวลา 08.30 - 16.30 น.",
    saturday: "เสาร์ เวลา 08.30 - 11.30 น.",
    sunday: "ปิดทำการ",
  },

  // ค่าดำเนินการ / ค่าบริการติดตั้ง
  operatingFees: {
    nightShiftFee: 5000,
    nightShiftText: "สำหรับงานช่วงเวลากลางคืน (20.00 น. - 05.00 น.) คิดค่าดำเนินการเพิ่ม 5,000 บาท/คืน",
    bkkSmallAreaFee: 5000,
    bkkSmallAreaText: "งานในกรุงเทพฯและปริมณฑล งานจัดส่งและติดตั้งพื้นที่น้อยกว่า 5 ตรม. คิดค่าดำเนินการ 5,000 บาท (กรณีลูกค้ารับสินค้าเองไม่คิดค่าดำเนินการ)",
    bkkMinArea: 1, // ขั้นต่ำ 1 ตรม.
    upcountrySmallAreaFee: 8000,
    upcountrySmallAreaText: "งานต่างจังหวัด งานจัดส่งและติดตั้งพื้นที่น้อยกว่า 10 ตรม. คิดค่าดำเนินการ 8,000 บาท (พื้นที่น้อยติดตั้งขั้นต่ำ คิดเหมาที่ 3 ตรม.)",
    upcountryMinArea: 3,
  },

  // ข้อกำหนดวัสดุ
  materialWarranty: "หินสังเคราะห์คุณภาพสูง Acrylic Solid Surface 100% รับประกันสีไม่เปลี่ยน (ขนาด 0.76 ม. X 3.60 ม. หนา 12 มม.)",
  areaCalculationNotice: "งานที่มีลักษณะโค้งหรือเหลี่ยมเพชร หรือลายสายแร่ จะคิดพื้นที่ตามแผ่นตัด",
} as const;

export type KnightCompanyInfo = typeof KNIGHT_COMPANY_INFO;
