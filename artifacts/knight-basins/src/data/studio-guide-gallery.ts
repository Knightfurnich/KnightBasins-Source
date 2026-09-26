/**
 * Rotating gallery shown on the customer-facing /studio-guide page.
 *
 * The boss supplies these reference shots himself (Telegram) and asked for all
 * of them to be shown, cycling automatically — "เอาทั้งหมด แล้วให้ภาพวนๆไป".
 *
 * Keep the wording descriptive-only: the captions say what is *in the picture*
 * (a straight run, a kitchen top with a hob, a pedestal basin …). Do not claim
 * "ผลงานติดตั้งของเรา" here unless the file actually came from the company
 * portfolio (uploads/portfolio/) — some of these are reference renders.
 */
export type StudioGuideGalleryImage = {
  /** Public path under artifacts/knight-basins/public → served from the web root. */
  src: string;
  /** Short label rendered as a chip on the slide. */
  tag: string;
  /** One-line description shown under the slide. */
  caption: string;
  /** Alt text for screen readers / SEO. */
  alt: string;
};

/** Milliseconds each slide stays on screen before the carousel advances. */
export const STUDIO_GUIDE_GALLERY_INTERVAL_MS = 4500;

export const STUDIO_GUIDE_GALLERY: StudioGuideGalleryImage[] = [
  {
    src: "/guide/counter-straight-01.webp",
    tag: "ทรงตรง I",
    caption: "เคาน์เตอร์หินพร้อมอ่างล้างหน้าในเนื้อหิน · ยาวตรงแผ่นเดียว",
    alt: "เคาน์เตอร์หินสีเทาลายจุด ทรงตรง พร้อมอ่างล้างหน้าฝังในเนื้อหินและก๊อกสีทอง",
  },
  {
    src: "/guide/counter-kitchen-02.webp",
    tag: "ทรงตรง I · ครัว",
    caption: "เคาน์เตอร์ครัวหินลายไม้ พร้อมบัวชิดผนังและเตาไฟฟ้าฝังเรียบ",
    alt: "เคาน์เตอร์ครัวหินลายไม้เบจชิดผนังพร้อมบัว เตาไฟฟ้าฝังเรียบ และอ่างล้างในเนื้อหิน",
  },
  {
    src: "/guide/basin-marble-03.webp",
    tag: "งานห้องน้ำ",
    caption: "อ่างล้างหน้าร่องลาดในเนื้อหิน ลายหินอ่อน วางบนตู้ไม้โทนเข้ม",
    alt: "อ่างล้างหน้าหินลายหินอ่อนสีขาวแบบร่องลาดในเนื้อหิน วางบนตู้ไม้โทนเข้ม",
  },
  {
    src: "/guide/basin-vanity-04.webp",
    tag: "งานห้องน้ำ",
    caption: "อ่างล้างหน้าแบบต่อเนื่องในเนื้อหิน บนตู้ลอย พร้อมชั้นผ้าขนหนู",
    alt: "อ่างล้างหน้าเนื้อหินสีขาวแบบต่อเนื่องบนเคาน์เตอร์ วางบนตู้ลอยสีเขียวเข้ม",
  },
  {
    src: "/guide/basin-pedestal-05.webp",
    tag: "อ่างตั้งพื้น",
    caption: "อ่างหินแบบตั้งพื้น เนื้อลายหินอ่อน งานห้องน้ำสองอ่างคู่กัน",
    alt: "อ่างล้างหน้าแบบตั้งพื้นเนื้อหินลายหินอ่อนสีครีม จำนวนสองตัวในห้องน้ำ",
  },
  {
    src: "/guide/basin-wood-06.webp",
    tag: "อ่างตั้งพื้น",
    caption: "อ่างทรงกระบอกตั้งพื้น วางคู่เคาน์เตอร์ไม้ธรรมชาติ",
    alt: "อ่างล้างหน้าทรงกระบอกสีเข้มแบบตั้งพื้น วางคู่กับเคาน์เตอร์ไม้ธรรมชาติ",
  },
];
