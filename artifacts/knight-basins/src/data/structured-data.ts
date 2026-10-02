import type { PortfolioCategory } from "@/pages/PortfolioPage";
import type { BasinProduct } from "@/data/catalog";
import { KNIGHT_FAQ_ITEMS, type FAQItem } from "./faq-data.ts";

const SITE = "https://knightbasins.srv1964473.hstgr.cloud";

function absoluteImageUrl(imageUrl: string): string {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl;
  return `${SITE}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
}

/**
 * Builds the JSON-LD document for the public /portfolio gallery.
 *
 * Search engines and AI assistants cite an ImageGallery as the canonical
 * evidence that a contractor really does this kind of work. The gallery is
 * deliberately described at the collection level (categories + counts) rather
 * than listing hundreds of individual ImageObject entries: the grid pages in
 * progressively and the counts change as photos are hidden or published from
 * /admin/portfolio, so a collection description stays accurate where a static
 * per-photo list would immediately drift.
 */
export function buildPortfolioStructuredData(
  categories: ReadonlyArray<PortfolioCategory>,
  total: number,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    "@id": `${SITE}/portfolio#gallery`,
    url: `${SITE}/portfolio`,
    name: "คลังผลงานติดตั้งจริง — Knight Furnich",
    description: `รวมภาพถ่ายผลงานติดตั้งหินสังเคราะห์และอ่างล้างหน้าเสร็จสมบูรณ์กว่า ${total} ภาพ จากบ้าน คอนโด และโครงการต่าง ๆ โดยทีมช่าง บริษัท ไนท์ เฟอร์นิช จำกัด`,
    inLanguage: "th-TH",
    isPartOf: { "@id": `${SITE}/#website` },
    publisher: { "@id": `${SITE}/#organization` },
    about: [
      { "@type": "Thing", "name": "เคาน์เตอร์หินสังเคราะห์ไร้รอยต่อ" },
      { "@type": "Thing", "name": "อ่างล้างหน้าหินสังเคราะห์" },
      { "@type": "Thing", "name": "Solid Surface" },
    ],
    numberOfItems: total,
    ...(categories.length
      ? {
          hasPart: categories.map((category) => ({
            "@type": "ImageGallery",
            name: category.name,
            url: `${SITE}/portfolio?category=${encodeURIComponent(category.slug)}`,
            numberOfItems: category.count,
          })),
        }
      : {}),
  };
}

/**
 * Builds the JSON-LD document for the /site-prep guide.
 *
 * Modelled as a HowTo because that is the shape assistants lift answers from
 * when a user asks "what do I need to prepare before the installers arrive?" —
 * each step carries its own name and explanation rather than being buried in
 * one prose blob.
 */
export function buildSitePrepStructuredData(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": `${SITE}/site-prep#howto`,
    url: `${SITE}/site-prep`,
    name: "วิธีเตรียมหน้างานก่อนติดตั้งเคาน์เตอร์หินสังเคราะห์",
    description:
      "คู่มือมาตรฐานการเตรียมหน้างานสำหรับช่างและผู้รับเหมา ก่อนทีมช่างของ ไนท์ เฟอร์นิช เข้าทำการติดตั้งเคาน์เตอร์หินสังเคราะห์และอ่างล้างหน้า พร้อมภาพถ่ายตัวอย่างจริง",
    inLanguage: "th-TH",
    isPartOf: { "@id": `${SITE}/#website` },
    publisher: { "@id": `${SITE}/#organization` },
    totalTime: "P1D",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "เตรียมโครงสร้างรับน้ำหนัก",
        text: "โครงรับเคาน์เตอร์ต้องแข็งแรงได้ระดับ รับน้ำหนักหินได้ และรองรับตำแหน่งอ่างล้างหน้าตรงตามแบบ",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "จัดตำแหน่งท่อน้ำดีและท่อน้ำทิ้ง",
        text: "ท่อน้ำดีและท่อน้ำทิ้งต้องอยู่ในระยะที่กำหนดตามแบบ ก่อนเริ่มตัดแผ่นหินในโรงงาน",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "ตรวจแนวผนังและระดับพื้นให้ได้ฉาก",
        text: "ผนังและพื้นควรเรียบและได้ฉาก 90 องศา เพื่อให้เคาน์เตอร์แนบสนิทและเก็บงานขอบได้เรียบร้อย",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "เตรียมระบบไฟสำหรับ LED ใต้เคาน์เตอร์",
        text: "หากต้องการไฟ LED ใต้เคาน์เตอร์ ให้เตรียมจุดปลั๊กและเดินสายไฟรอไว้ก่อนติดตั้ง",
      },
    ],
  };
}
/**
 * Builds the JSON-LD document for the /studio-guide page.
 *
 * Modelled as a HowTo with three steps, mirroring the page copy exactly. The
 * accepted edge finishes are listed as the same five values the configurator
 * stores, so an assistant quoting this guide cannot invent a sixth option.
 */
export function buildStudioGuideStructuredData(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": `${SITE}/studio-guide#howto`,
    url: `${SITE}/studio-guide`,
    name: "วิธีออกแบบเคาน์เตอร์หินสังเคราะห์ด้วยตัวเองใน 3 ขั้นตอน",
    description:
      "คู่มือใช้งานระบบ 2D Studio ของ Knight Furnich สำหรับลูกค้าและทีมขาย — เลือกสีหิน ระบุขนาดเคาน์เตอร์ และกำหนดสถานะขอบแต่ละด้าน เพื่อดูผังและราคาประมาณการก่อนขอใบเสนอราคา",
    inLanguage: "th-TH",
    isPartOf: { "@id": `${SITE}/#website` },
    publisher: { "@id": `${SITE}/#organization` },
    totalTime: "PT10M",
    tool: [{ "@type": "HowToTool", name: "เว็บเบราว์เซอร์" }],
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "เลือกสีหิน",
        text: "กดปุ่มสีหินบนแถบด้านบน กรองตามเรตราคา ฿7,500 / ฿8,500 / ฿9,500 ต่อตารางเมตร หรือพิมพ์ค้นหาชื่อสีและรหัสสี แล้วเลือกสีที่ต้องการ",
        url: `${SITE}/studio`,
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "เลือกทรงและกรอกขนาดแผ่นจริง",
        text: "เลือกทรงเคาน์เตอร์ ทรงตรง I ฉาก L หรือตัว U แล้วกรอกขนาดความยาวและความลึกเป็นมิลลิเมตรแยกตามจำนวนแผ่นจริง และวางอ่างลงบนผัง",
        url: `${SITE}/studio`,
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "ระบุขอบ 4 สถานะ แล้วประกอบผัง",
        text: "กำหนดสถานะขอบของแต่ละแผ่น: ติดบัว, ชิดผนัง, ขอบเปิด หรือขอบปิด และมีระบบล็อกรอยต่อระหว่างแผ่นอัตโนมัติ จากนั้นกดปุ่มประกอบผังลงกระดานเพื่อวาดผังและคำนวณราคา",
        url: `${SITE}/studio-guide`,
      },
    ],
  };
}

/**
 * Builds the JSON-LD @graph of Product+Offer nodes for every basin SKU, so
 * an AI shopping assistant can cite a specific model's price/size directly
 * instead of only the category-level OfferCatalog on the Organization node.
 *
 * Takes the live product list as a parameter (same shape as
 * buildPortfolioStructuredData's categories/total) rather than importing
 * PRODUCTS directly, so it always reflects whatever catalog data the caller
 * is actually showing (static fallback or the remote-admin-edited one) and
 * never drifts into hardcoded prices. `image` is only included when the
 * product actually has one -- never a fabricated placeholder URL.
 */
export function buildBasinProductsJsonLd(products: ReadonlyArray<BasinProduct>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": products.map((product) => ({
      "@type": "Product",
      "@id": `${SITE}/#product-${product.sku}`,
      name: `Knight Basins ${product.sku}`,
      sku: product.sku,
      description: `อ่างล้างหน้าหินสังเคราะห์ Knight Basins รุ่น ${product.sku} สี ${product.colorName} (${product.colorCode}) ขนาดเคาน์เตอร์ ${product.dimensions}${product.basinDimensions ? ` หลุมอ่าง ${product.basinDimensions}` : ""}`,
      ...(product.imageUrl ? { image: absoluteImageUrl(product.imageUrl) } : {}),
      offers: {
        "@type": "Offer",
        price: product.priceTHB,
        priceCurrency: "THB",
        availability: "https://schema.org/InStock",
      },
    })),
  };
}

/**
 * Builds the FAQPage JSON-LD document from the single FAQ source of truth
 * (job-174). Defaults to KNIGHT_FAQ_ITEMS so a caller can pass a subset or a
 * test fixture, but production call sites should rely on the default so the
 * schema and the on-page QuickFAQ accordion (job-175) never drift apart
 * again.
 */
export function buildFaqPageJsonLd(items: ReadonlyArray<FAQItem> = KNIGHT_FAQ_ITEMS): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
