// Answers for a visitor who is not signed in with LINE (job 421-C). No model is called here: these are fixed templates
// filled from the same catalogue and trade constants the storefront prices with, so the numbers cannot drift from the app.
//
// Rule for this file: a figure is never typed here. Prices come from the catalogue the caller passes in, VAT and fees from
// `commercialConstants()` (lib/commercial-constants.ts), phone lines from lib/contact-info.ts.

import { commercialConstants } from "./commercial-constants.ts";
import { SUPPORT_PHONE_PRIMARY, SUPPORT_PHONES_TEXT } from "./contact-info.ts";
import { shoppingTopic } from "./support-signals.ts";

export const ASSISTANT_NAME = "น้องไนท์";

// Same wording as `image_disclaimer` in the knowledge-base feed (https://api.knightbasins.com/kb/pricing.json), which is
// built outside this repo, so the sentence is the one copy that cannot be read from here. It has no figures in it.
export const IMAGE_DISCLAIMER = "ภาพเป็นตัวอย่างเพื่อการอ้างอิง สีจริงอาจต่างจากการแสดงผลบนจอ แนะนำดูตัวอย่างจริงที่โชว์รูม";

/** The part of the catalogue these templates read (a subset of what `getCatalogData` returns). */
export type GuestCatalog = {
  basins: ReadonlyArray<{ sku: string; category: string; priceTHB: number; dimensions: string }>;
  installedStones: ReadonlyArray<{ code: string; pricePerSqmTHB: number }>;
  sheetStones: ReadonlyArray<{ code: string; basePriceTHB: number }>;
};

const baht = (value: number) => value.toLocaleString("th-TH");

function range(values: number[]): string {
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high ? baht(low) : `${baht(low)}–${baht(high)}`;
}

// ---- Conditions that must travel with every price ------------------------------------------------------------------

export function vatLine(): string {
  return `ยังไม่รวม VAT ${commercialConstants().vat_percent}%`;
}

/** The installation charge for a basin set (`basin_install` add-on), or "" if the price book no longer has it. */
export function basinInstallLine(): string {
  const addon = commercialConstants().addons.find((item) => item.id === "basin_install");
  return addon ? `ติดตั้งมีค่าดำเนินการ ${baht(addon.price)} ${addon.unit}` : "";
}

/** The small-job charges for cut-and-installed stone, read from the installation rules. */
export function smallJobLine(): string {
  const charged = commercialConstants().installation.rules.filter(
    (rule) => typeof rule.charge === "number" && rule.charge > 0 && /พื้นที่น้อยกว่า/u.test(rule.condition),
  );
  if (charged.length === 0) return "";
  const short = (condition: string) => condition.replace(/^พื้นที่น้อยกว่า\s*/u, "<");
  return `งานเล็ก: ${charged.map((rule) => `${short(rule.condition)} (${rule.scope}) ${baht(rule.charge as number)} ${rule.unit}`).join(" · ")}`;
}

/** What to append to an answer that quotes a stone price (`images`: the answer also points at photos / the colour). */
export function stoneTermsLines(options: { installed: boolean; images: boolean }): string[] {
  return [vatLine(), ...(options.installed ? [smallJobLine()] : []), ...(options.images ? [IMAGE_DISCLAIMER] : [])].filter(Boolean);
}

/** What to append to an answer that quotes a basin price (`images`: the answer also points at photos / the colour). */
export function basinTermsLines(options: { images: boolean }): string[] {
  const terms = [vatLine(), basinInstallLine()].filter(Boolean).join(" · ");
  return [terms, ...(options.images ? [IMAGE_DISCLAIMER] : [])];
}

/** The two ways forward offered to a visitor: sign in to talk in full, or call the team. */
export function nextStepsLine(): string {
  return `คุยต่อ: เข้าสู่ระบบด้วย LINE ที่ปุ่มด้านบน หรือโทร ${SUPPORT_PHONE_PRIMARY}`;
}

// ---- Fixed answers ---------------------------------------------------------------------------------------------------

/** Who/what are you. Always says it is an automated assistant -- never a person. */
export function identityReply(): string {
  return [
    `${ASSISTANT_NAME}เป็นผู้ช่วยอัตโนมัติของทีม Knight Furnich ค่ะ ไม่ใช่คนจริง`,
    "ช่วยเรื่องชุดอ่างล้างหน้ากับท็อปครัวหินสังเคราะห์ — รุ่น ราคา ขนาด และสีที่มี",
    `อยากคุยกับทีมงาน โทร ${SUPPORT_PHONES_TEXT} ได้เลยค่ะ`,
  ].join("\n");
}

/** Age, family, hometown... nothing is invented: one honest line, then back to the products. */
export function personalQuestionReply(): string {
  return [
    `${ASSISTANT_NAME}เป็นผู้ช่วยอัตโนมัติ เรื่องส่วนตัวจึงไม่มีให้เล่าค่ะ`,
    "แต่เรื่องอ่างล้างหน้ากับท็อปครัวหินสังเคราะห์ ถามได้เลยค่ะ",
  ].join("\n");
}

/** Branch / province questions: the price book has province rules but no branch list, so say exactly that. */
export function serviceAreaReply(): string {
  const rules = commercialConstants().installation.rules;
  const province = rules.find((rule) => rule.scope === "ต่างจังหวัด" && typeof rule.charge === "number");
  const travel = rules.find((rule) => rule.charge === null && /ต่างจังหวัด/u.test(rule.condition));
  const lines = ["ตอนนี้ไม่มีข้อมูลสาขาในระบบ จึงยืนยันว่ามีหรือไม่มีให้ไม่ได้ค่ะ"];
  if (province) {
    lines.push(
      `แต่รับงานต่างจังหวัดได้: ${province.condition.replace(/^พื้นที่น้อยกว่า\s*/u, "<")} ค่าดำเนินการ ${baht(province.charge as number)} ${province.unit}${travel ? ` · ค่าเดินทาง+เบี้ยเลี้ยง${travel.unit}` : ""}`,
    );
  }
  lines.push(`บอกจังหวัดกับงาน แล้วโทร ${SUPPORT_PHONE_PRIMARY} หรือเข้าสู่ระบบด้วย LINE ที่ปุ่มด้านบนค่ะ`);
  return lines.join("\n");
}

// ---- "I want one" ----------------------------------------------------------------------------------------------------

function basinPurchaseReply(catalog: GuestCatalog, askedAboutInstall: boolean): string {
  const counter = catalog.basins.filter((item) => item.category === "counter basin");
  const standing = catalog.basins.filter((item) => item.category !== "counter basin");
  const parts = [
    { label: "อ่างวางเคาน์เตอร์", items: counter },
    { label: "อ่างตั้งพื้น", items: standing },
  ].filter((part) => part.items.length > 0);
  if (parts.length === 0) return [`ได้เลยค่ะ เรื่องชุดอ่างล้างหน้า ${nextStepsLine()}`].join("\n");

  const cheapest = [...(counter.length > 0 ? counter : standing)].sort((a, b) => a.priceTHB - b.priceTHB)[0]!;
  // "ติดตั้งฟรีไหม": answer that first. Whether a bigger order waives it is not in the price book, so the team confirms.
  const installFirst = askedAboutInstall && basinInstallLine()
    ? [`${basinInstallLine()}ค่ะ ส่วนเงื่อนไขพิเศษตามจำนวนชุดให้ทีมยืนยันอีกครั้งนะคะ`]
    : [];
  return [
    ...installFirst,
    `${installFirst.length > 0 ? "" : "ได้เลยค่ะ "}ชุดอ่างล้างหน้า ${parts.length} แบบ: ${parts.map((part) => `${part.label} ${range(part.items.map((item) => item.priceTHB))} บาท/ชุด`).join(" · ")} (เช่น ${cheapest.sku})`,

    ...(installFirst.length > 0 ? [vatLine()] : basinTermsLines({ images: false })),
    nextStepsLine(),
  ].join("\n");
}

function stonePurchaseReply(catalog: GuestCatalog): string {
  const installed = catalog.installedStones.map((item) => item.pricePerSqmTHB);
  const sheets = catalog.sheetStones.map((item) => item.basePriceTHB);
  if (installed.length === 0 && sheets.length === 0) return `ได้เลยค่ะ เรื่องท็อปครัวหินสังเคราะห์ ${nextStepsLine()}`;

  const prices = [
    installed.length > 0 ? `ตัดและติดตั้ง ${range(installed)} บาท/ตร.ม.` : "",
    sheets.length > 0 ? `ขายแผ่น ${range(sheets)} บาท/แผ่น` : "",
  ].filter(Boolean);
  const exampleCode = (catalog.installedStones[0] ?? catalog.sheetStones[0])!.code;
  return [
    `ได้เลยค่ะ ท็อปครัวหินสังเคราะห์ ${prices.length > 1 ? "2 แบบ" : "แบบ"}: ${prices.join(" · ")} · บอกพื้นที่หรือรหัสสี เช่น ${exampleCode} แล้วเช็กราคาให้ค่ะ`,
    ...stoneTermsLines({ installed: installed.length > 0, images: false }),
    nextStepsLine(),
  ].join("\n");
}

/** The answer to "I want a basin / a countertop..." for a visitor: from the catalogue, never a sign-in wall. */
export function shoppingReply(message: string, catalog: GuestCatalog): string {
  return shoppingTopic(message) === "stone" ? stonePurchaseReply(catalog) : basinPurchaseReply(catalog, /ติดตั้ง/u.test(message));
}
