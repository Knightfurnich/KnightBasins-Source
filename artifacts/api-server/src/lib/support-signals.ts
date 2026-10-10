// Cheap, dependency-free signals about what a chat message is for (job 421-C). Kept apart from support-guest-answers.ts
// (which pulls in the price constants) so the profile extractor can use them too.

function normalizeQuery(message: string): string {
  return message
    .trim()
    .toLocaleLowerCase("th-TH")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ");
}

// Wanting / asking about price. "ติดตั้ง" alone is deliberately NOT here: it is also a profile label ("ที่อยู่ติดตั้ง").
const DESIRE =
  /(อยากได้|อยากซื้อ|อยากมี|อยากทำ|อยากสั่ง|ต้องการ|สนใจ|ขอราคา|ขอใบเสนอ|ซื้อ|สั่งทำ|สั่งซื้อ|ราคา|เท่าไหร่|เท่าไร|กี่บาท|แนะนำ|มีรุ่น|มีแบบ|หาอ่าง|หาหิน|ค่าติดตั้ง|ติดตั้ง.*(ฟรี|เท่าไหร่|เท่าไร|กี่บาท|คิด)|ฟรี.*ติดตั้ง)/u;

// What the company sells, or a product code ("kf001", "sg 420").
const PRODUCT =
  /(อ่าง|ซิงค์|ซิงก์|ท็อป|เคาน์เตอร์|เคาเตอร์|ครัว|หินสังเคราะห์|หินควอ|หิน|แผ่น|ห้องน้ำ|vanity|basin|countertop|(?<![a-z])[a-z]{1,3} ?\d{3}(?!\d))/u;

/** True when the visitor says they want / ask the price of something this company sells. */
export function isShoppingMessage(message: string): boolean {
  const query = normalizeQuery(message);
  return query.length > 0 && DESIRE.test(query) && PRODUCT.test(query);
}

export type ShoppingTopic = "basin" | "stone";

/** Which product line a shopping message is about: countertop / stone words win, otherwise basin. */
export function shoppingTopic(message: string): ShoppingTopic {
  const query = normalizeQuery(message);
  if (/(ท็อป|เคาน์เตอร์|เคาเตอร์|ครัว|หินสังเคราะห์|หินควอ|แผ่น|countertop)/u.test(query)) return "stone";
  return "basin";
}

/** Who/what are you -- including "are you a person or a bot". */
export function isIdentityQuestion(message: string): boolean {
  const query = normalizeQuery(message);
  return /(คุณคือใคร|เธอคือใคร|น้องคือใคร|คุณคืออะไร|เป็นใคร|แนะนำตัว|ทำอะไรได้|(คุณ|เธอ|น้อง)ชื่อ(อะไร|ไร)|เป็น(คน|มนุษย์|บอท|เอไอ|หุ่นยนต์)(หรือ|รึ|ป่าว|เปล่า|จริง|ไหม|มั้ย)|(คน|มนุษย์)จริง|คนหรือ(บอท|เอไอ|หุ่นยนต์)|บอทหรือ(คน|มนุษย์)|(บอท|เอไอ)(หรือ|รึ|ป่าว|เปล่า)|แชทบอท|chat ?bot|(?<![a-z])ai(?![a-z])|are you (a )?(human|bot|robot|person))/u.test(query);
}

/** Age, family, marital status... -- things the assistant has no story for and must not invent. */
export function isPersonalQuestion(message: string): boolean {
  const query = normalizeQuery(message);
  return /(อายุ(เท่า|กี่)|กี่ขวบ|มีลูก|ลูกกี่คน|แต่งงาน|มีแฟน|โสด|เงินเดือน|บ้านเกิด|เป็นคนจังหวัด|ผู้หญิงหรือผู้ชาย|เพศอะไร)/u.test(query);
}

/** Branch / showroom / which provinces the team works in. (Address questions are handled by the intent list.) */
export function isServiceAreaQuestion(message: string): boolean {
  const query = normalizeQuery(message);
  return /(สาขา|โชว์รูม|showroom|ต่างจังหวัด|รับงาน.*จังหวัด|ส่ง(ของ|สินค้า)?.*จังหวัด|ติดตั้ง.*จังหวัด|(เชียงใหม่|เชียงราย|ภูเก็ต|ขอนแก่น|โคราช|นครราชสีมา|หาดใหญ่|สงขลา|ชลบุรี|พัทยา|อุดร|อุบล|ระยอง|นครสวรรค์|พิษณุโลก|สุราษฎร์|กระบี่|หัวหิน).*(ไหม|มั้ย|หรือเปล่า|ได้|ส่ง|ติดตั้ง))/u.test(query);
}
