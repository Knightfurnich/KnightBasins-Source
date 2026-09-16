export type SupportProfileField =
  | "fullName"
  | "phone"
  | "email"
  | "address"
  | "propertyType"
  | "condoFloor"
  | "taxName"
  | "taxId"
  | "taxBranch"
  | "taxAddress";

export type SupportProfileFields = Partial<Record<SupportProfileField, string>>;

const fieldLabels: Record<SupportProfileField, string> = {
  fullName: "ชื่อผู้ติดต่อ",
  phone: "เบอร์โทรศัพท์",
  email: "อีเมล",
  address: "ที่อยู่จัดส่ง / ติดตั้ง",
  propertyType: "ประเภทสถานที่",
  condoFloor: "ชั้นคอนโด",
  taxName: "ชื่อออกใบกำกับภาษี",
  taxId: "เลขประจำตัวผู้เสียภาษี",
  taxBranch: "สาขา",
  taxAddress: "ที่อยู่ใบกำกับภาษี",
};

const labelAliases: Record<SupportProfileField, string[]> = {
  fullName: ["ชื่อผู้ติดต่อ", "ชื่อจริง", "ผู้ติดต่อ"],
  phone: ["เบอร์โทรศัพท์", "เบอร์โทร", "โทรศัพท์", "โทร", "มือถือ"],
  email: ["อีเมล", "email", "e-mail"],
  address: ["ที่อยู่จัดส่ง", "ที่อยู่ติดตั้ง", "ที่อยู่หน้างาน", "ที่อยู่โครงการ"],
  propertyType: ["ประเภทสถานที่", "ประเภทบ้าน", "สถานที่ติดตั้ง"],
  condoFloor: ["ชั้นคอนโด", "ชั้น"],
  taxName: ["ชื่อออกใบกำกับภาษี", "ชื่อภาษีใหม่", "ชื่อภาษี", "ชื่อสำหรับใบกำกับภาษี", "นามผู้เสียภาษี"],
  taxId: ["เลขประจำตัวผู้เสียภาษี", "เลขผู้เสียภาษี", "เลขภาษี", "tax id", "taxid"],
  taxBranch: ["สาขาใบกำกับภาษี", "สาขา"],
  taxAddress: ["ที่อยู่ใบกำกับภาษี", "ที่อยู่ภาษี", "ที่อยู่ออกใบกำกับภาษี"],
};

const allAliases = Object.values(labelAliases).flat().sort((left, right) => right.length - left.length);

function normalized(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function labelPattern(labels: string[]) {
  return labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
}

function captureLabeledValue(message: string, field: SupportProfileField) {
  const labels = labelPattern(labelAliases[field]);
  const nextLabels = labelPattern(allAliases.filter((label) => !labelAliases[field].includes(label)));
  const pattern = new RegExp(
    `(?:^|[\\s;|])\\s*(?:${labels})\\s*(?:คือ|ได้แก่|[:：-])?\\s*(.+?)(?=\\s+(?:${nextLabels})\\s*(?:คือ|ได้แก่|[:：-])?|[\\n;|]|$)`,
    "iu",
  );
  const match = message.match(pattern);
  return match?.[1] ? normalized(match[1]) : "";
}

function cleanValue(value: string) {
  return normalized(value).replace(/[,.]+$/, "").trim();
}

function extractTaxId(message: string) {
  const labeled = message.match(/(?:เลข(?:ประจำตัว)?ผู้เสียภาษี|เลขภาษี|tax\s*id|taxid)[^\d]{0,24}(\d{13})/iu)?.[1];
  if (labeled) return labeled;
  if (/(ภาษี|tax)/iu.test(message)) return message.match(/(?<!\d)\d{13}(?!\d)/)?.[0] ?? "";
  return "";
}

function extractPhone(message: string) {
  return message.match(/(?:เบอร์(?:โทรศัพท์)?|โทรศัพท์|โทร|มือถือ)[^\d]{0,18}(0\d{9})(?!\d)/iu)?.[1] ?? "";
}

function extractEmail(message: string) {
  return message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu)?.[0] ?? "";
}

function extractPropertyType(message: string) {
  if (/(?:คอนโด|คอนโดมิเนียม|condo|condominium)/iu.test(message)) return "condo";
  if (/(?:บ้านเดี่ยว|ทาวน์โฮม|ทาวน์เฮาส์|บ้านพัก|บ้าน|house|townhome)/iu.test(message)) return "house-townhome";
  if (/(?:อาคารพาณิชย์|สำนักงาน|ร้านค้า|commercial)/iu.test(message)) return "commercial";
  return "";
}

function extractCondoFloor(message: string) {
  return message.match(/(?:ชั้นคอนโด|ชั้น)[^\d]{0,8}(\d{1,3}(?:\/\d{1,3})?)/iu)?.[1] ?? "";
}

export function extractSupportProfileFields(message: string): SupportProfileFields {
  const fields: SupportProfileFields = {};
  const labeled = (field: SupportProfileField) => cleanValue(captureLabeledValue(message, field));

  const fullName = labeled("fullName");
  const phone = extractPhone(message);
  const email = extractEmail(message);
  const address = labeled("address");
  const taxName = labeled("taxName");
  const taxBranch = labeled("taxBranch");
  const taxAddress = labeled("taxAddress");
  const taxId = extractTaxId(message);
  const propertyType = extractPropertyType(message);
  const condoFloor = extractCondoFloor(message);

  if (fullName) fields.fullName = fullName;
  if (phone) fields.phone = phone;
  if (email) fields.email = email;
  if (address) fields.address = address;
  if (taxName) fields.taxName = taxName;
  if (taxId) fields.taxId = taxId;
  if (taxBranch) fields.taxBranch = taxBranch;
  if (taxAddress) fields.taxAddress = taxAddress;
  if (propertyType) fields.propertyType = propertyType;
  if (propertyType === "condo" && condoFloor) fields.condoFloor = condoFloor;

  return fields;
}

export function isSupportConfirmation(message: string) {
  return /^(?:ยืนยัน|ใช่|ตกลง|โอเค|ok|okay|confirm|ยืนยันข้อมูล)\s*(?:(?:นะ)?(?:ครับ|ค่ะ|คะ)|krub|ka)?$/iu.test(normalized(message));
}

export function isSupportCancellation(message: string) {
  return /^(?:ยกเลิก|ไม่ใช่|ไม่ตกลง|ไม่ต้องการ|cancel|no)\s*(?:(?:นะ)?(?:ครับ|ค่ะ|คะ)|krub|ka)?$/iu.test(normalized(message));
}

export function supportProfileFieldLabel(field: SupportProfileField) {
  return fieldLabels[field];
}

export function supportProfileValue(field: SupportProfileField, value: unknown) {
  if (value === null || value === undefined || value === "") return "ยังไม่ระบุ";
  if (field === "propertyType") {
    return { condo: "คอนโด", "house-townhome": "บ้าน / ทาวน์โฮม", commercial: "อาคารพาณิชย์" }[String(value)] ?? String(value);
  }
  return String(value);
}