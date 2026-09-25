import type { PortfolioCategory } from "@/pages/PortfolioPage";

const SITE = "https://knightbasins.srv1964473.hstgr.cloud";

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