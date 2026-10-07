type RouteMetaEntry = {
  title: string;
  description: string;
};

type MetaDocument = Pick<Document, "querySelector"> & { title: string };

/**
 * Title/description for every route that should be indexed as its own page.
 * A route left out of this table (private pages like /track, /quote/view,
 * /profile, /admin, or a mistyped URL that falls through to the 404 view)
 * gets `noindex` instead -- see applyRouteMeta below. Keyed by bare pathname
 * so query strings (?token=..., ?category=...) never affect the lookup.
 */
export const ROUTE_META: Record<string, RouteMetaEntry> = {
  "/": {
    title: "Knight Furnich | อ่างล้างหน้า & เคาน์เตอร์หินสังเคราะห์ ไร้รอยต่อ",
    description:
      "โรงงานผลิตและติดตั้งอ่างล้างหน้าหินสังเคราะห์และเคาน์เตอร์ Solid Surface ไร้รอยต่อ 30 รุ่น กว่า 60 เฉดสี พร้อมระบบคำนวณราคาและใบเสนอราคาออนไลน์ รับประกัน 1 ปี",
  },
  "/portfolio": {
    title: "ภาพผลงานจริง | Knight Furnich",
    description: "รวมภาพผลงานติดตั้งอ่างล้างหน้าและเคาน์เตอร์หินสังเคราะห์จริงจากลูกค้า Knight Furnich แยกตามหมวดหมู่",
  },
  "/stone": {
    title: "ท็อปครัว & เคาน์เตอร์หินสังเคราะห์ ไร้รอยต่อ | Knight Furnich",
    description: "สั่งทำท็อปเคาน์เตอร์ครัวและเคาน์เตอร์ห้องน้ำหินสังเคราะห์แท้ ไร้รอยต่อ หรือซื้อแผ่นดิบมาตรฐาน คำนวณราคาตามขนาดจริง พร้อมบริการติดตั้ง",
  },
  "/price-guide": {
    title: "ราคาเคาน์เตอร์หินสังเคราะห์และวิธีเลือก | Knight Furnich",
    description:
      "รวมแนวทางเลือกราคาเคาน์เตอร์หินสังเคราะห์ วิธีวัดพื้นที่ ค่าดำเนินการตามเงื่อนไข สีและลาย วิธีดูแลรักษา และคำถามที่พบบ่อย พร้อมลิงก์ขอใบเสนอราคา",
  },
  "/quote": {
    title: "สร้างใบเสนอราคาออนไลน์ | Knight Furnich",
    description: "สร้างใบเสนอราคาอ่างล้างหน้าและเคาน์เตอร์หินสังเคราะห์ออนไลน์ด้วยตัวเอง รู้ราคาก่อนสั่งผลิต",
  },
  "/studio": {
    title: "Studio ออกแบบเคาน์เตอร์ 2D | Knight Furnich",
    description: "ออกแบบเคาน์เตอร์และอ่างล้างหน้าหินสังเคราะห์แบบ 2 มิติ ปรับขนาดและสีได้ตามพื้นที่จริง",
  },
  "/sketch": {
    title: "อัปโหลดสเก็ตช์หน้างาน | Knight Furnich",
    description: "อัปโหลดภาพสเก็ตช์หรือแบบหน้างานให้ทีม Knight Furnich คำนวณราคาและออกแบบให้",
  },
  "/site-prep": {
    title: "คู่มือเตรียมหน้างานติดตั้ง | Knight Furnich",
    description: "ขั้นตอนเตรียมพื้นที่ก่อนติดตั้งอ่างล้างหน้าและเคาน์เตอร์หินสังเคราะห์ Knight Furnich",
  },
  "/studio-guide": {
    title: "คู่มือใช้งาน Studio ออกแบบ | Knight Furnich",
    description: "วิธีใช้ Studio ออกแบบเคาน์เตอร์หินสังเคราะห์ 2 มิติของ Knight Furnich ทีละขั้นตอน",
  },
  "/readme": {
    title: "คู่มือการใช้งานเว็บไซต์ | Knight Furnich",
    description: "คำแนะนำการใช้งานระบบสั่งซื้อ คำนวณราคา และติดตามงานของ Knight Furnich",
  },
  "/updates": {
    title: "ความเคลื่อนไหวและอัปเดตระบบ | Knight Furnich",
    description: "สรุปฟีเจอร์และการอัปเดตล่าสุดของระบบ Knight Furnich",
  },
  "/network": {
    title: "เครือข่ายเว็บไซต์ Knight Furnich | Knight Basins",
    description: "รู้จักบริษัท Knight Furnich, ระบบ Knight Basins และศูนย์ความรู้หินสังเคราะห์ พร้อมช่องทาง LINE OA, Facebook และลิงก์ชมผลงานกับใบเสนอราคา",
  },

};

function upsertMetaContent(doc: MetaDocument, selector: string, value: string): () => void {
  const el = doc.querySelector<HTMLMetaElement>(selector);
  if (!el) return () => {};
  const previous = el.getAttribute("content");
  el.setAttribute("content", value);
  return () => {
    if (previous === null) el.removeAttribute("content");
    else el.setAttribute("content", previous);
  };
}

/**
 * Sets <title>/description/canonical/OG for `pathname`, returning a cleanup
 * function that restores every previous value -- so a route swap (or
 * unmount) never leaves a stale canonical/title from the page the visitor
 * just left. This is the fix for every route sharing the homepage's
 * canonical/title: the main reason Googlebot was only indexing one content
 * page despite the rest of the AEO groundwork (robots.txt/llms.txt/JSON-LD)
 * being in place.
 *
 * `doc`/`origin` are injectable (mirroring this repo's `createXxxRouter(db =
 * db)` pattern on the API side) so this can be unit-tested without a real
 * browser DOM.
 */
export function applyRouteMeta(
  pathname: string,
  doc: MetaDocument = document,
  origin?: string,
): () => void {
  const entry = ROUTE_META[pathname];

  if (!entry) {
    // Private pages (/track, /handover, /quote/view, /profile, /admin*)
    // and any unmatched path (the soft-404 fallback) have no business being
    // indexed -- flip the global robots meta to noindex while mounted.
    // Nginx also sends X-Robots-Tag for the private pages; this is a
    // harmless second signal, never a conflicting one (unlike robots.txt
    // Disallow, which would stop the crawler from ever seeing this tag).
    return upsertMetaContent(doc, 'meta[name="robots"]', "noindex, nofollow");
  }

  const previousTitle = doc.title;
  doc.title = entry.title;
  const canonicalHref = doc
    .querySelector<HTMLLinkElement>('link[rel="canonical"]')
    ?.getAttribute("href");
  let canonicalOrigin =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  if (origin === undefined && canonicalHref) {
    try {
      canonicalOrigin = new URL(canonicalHref, canonicalOrigin).origin;
    } catch {
      // Keep the current browser origin when the shell has no usable canonical URL.
    }
  }
  const canonicalUrl = `${canonicalOrigin}${pathname}`;

  const restoreFns = [
    upsertMetaContent(doc, 'meta[name="description"]', entry.description),
    upsertMetaContent(doc, 'meta[property="og:title"]', entry.title),
    upsertMetaContent(doc, 'meta[property="og:description"]', entry.description),
    upsertMetaContent(doc, 'meta[property="og:url"]', canonicalUrl),
    upsertMetaContent(doc, 'meta[name="twitter:title"]', entry.title),
    upsertMetaContent(doc, 'meta[name="twitter:description"]', entry.description),
  ];

  const canonicalLink = doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const previousCanonical = canonicalLink?.getAttribute("href") ?? null;
  canonicalLink?.setAttribute("href", canonicalUrl);

  return () => {
    doc.title = previousTitle;
    restoreFns.forEach((restore) => restore());
    if (canonicalLink && previousCanonical !== null) canonicalLink.setAttribute("href", previousCanonical);
  };
}
