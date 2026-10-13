import { Link } from "wouter";
import { ArrowLeft, ArrowRight, BookOpen, Ruler, Sparkles } from "lucide-react";
import { RouteStructuredData } from "@/components/RouteStructuredData";
import { StandalonePageHeader } from "@/components/StandalonePageHeader";
import { ROUTE_META } from "@/components/RouteMeta.logic";
import {
  formatTHB,
  INSTALLATION_PRICE,
  NIGHT_WORK_FEE,
  PRODUCTS,
  STONE_COLORS,
  STONE_SHEET_SIZE,
  STONE_SHEET_THICKNESS,
  STONE_INSTALLED_MIN_BANGKOK_SQM,
  STONE_INSTALLED_MIN_PROVINCE_SQM,
  STONE_SMALL_JOB_BANGKOK_FEE,
  STONE_SMALL_JOB_PROVINCE_FEE,
  VAT_RATE,
} from "@/data/catalog";
import { buildPriceGuideJsonLd, offerRangeFrom } from "@/data/structured-data";

const BASIN_INSTALLATION_FREE_FROM = 3;
const NIGHT_WORK_START = "20:00";
const NIGHT_WORK_END = "05:00";

const installedPriceTiers = [
  ...new Set(
    STONE_COLORS.flatMap((stone) =>
      stone.installedPriceTHB === null ? [] : [stone.installedPriceTHB],
    ),
  ),
].sort((first, second) => first - second);

// One label per installed rate, paired by index with the prices read from the catalogue above.
// job-277 restored VW342 "Aria Whisper" (12,000 a sqm, straight from the database), which made the
// catalogue carry a fourth rate; without this entry the page silently dropped it. The wording of the
// new tier is a placeholder until the owner confirms it — the price itself is the database's.
const installedRateLabels = [
  { name: "สีพื้นเรียบ", detail: "โทนสีสม่ำเสมอ ดูเรียบง่ายและเข้ากับพื้นที่ได้หลายแบบ" },
  { name: "ลายเกล็ดชิป", detail: "เพิ่มมิติด้วยลายเม็ดละเอียด เหมาะกับพื้นที่ใช้งานทุกวัน" },
  { name: "ลายหินอ่อน", detail: "ลายเส้นและเฉดสีที่ให้ความรู้สึกโดดเด่นกับพื้นที่" },
  { name: "Aria Whisper", detail: "สีระดับพรีเมียม — เรตสูงสุดของแคตตาล็อก (สูงกว่าเรตลายหินอ่อน)" },
] as const;

export const PRICE_GUIDE_INSTALLATION_RATES = installedRateLabels.flatMap(
  (tier, index) => {
    const price = installedPriceTiers[index];
    return price === undefined ? [] : [{ ...tier, price }];
  },
);


/** The buying options compared in the table below: every number is read from the catalogue, none is typed here. */
const sheetPrices = STONE_COLORS.map((stone) => stone.sheetPriceTHB).filter((price): price is number => price !== null);
const installedPrices = STONE_COLORS.map((stone) => stone.installedPriceTHB).filter((price): price is number => price !== null);
const basinPrices = PRODUCTS.map((product) => product.priceTHB);
const priceRangeTHB = (values: ReadonlyArray<number>) => {
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high ? formatTHB(low) : `${formatTHB(low)}–${formatTHB(high)}`;
};
const BUYING_OPTIONS = [
  {
    key: "fabricated",
    label: "สั่งตัดพร้อมติดตั้ง",
    unit: "บาท / ตร.ม. (ราคารวมตัด เจาะ และติดตั้งหน้างาน)",
    from: priceRangeTHB(installedPrices),
    fits: "เจ้าของบ้านและงานโครงการที่อยากให้ทีมวัดหน้างาน ผลิต และติดตั้งครบวงจร",
  },
  {
    key: "sheet",
    label: "ซื้อแผ่นดิบ",
    unit: `บาท / แผ่น (${STONE_SHEET_SIZE} · ${STONE_SHEET_THICKNESS})`,
    from: priceRangeTHB(sheetPrices),
    fits: "ช่างและโรงงานเฟอร์นิเจอร์ที่ตัดและติดตั้งเอง รับของเองที่โรงงานได้",
  },
  {
    key: "basin",
    label: "อ่างล้างหน้าสำเร็จรูป",
    unit: "บาท / ชุด (ตามรุ่นที่เลือก)",
    from: priceRangeTHB(basinPrices),
    fits: "ห้องน้ำที่ต้องการชุดสำเร็จรูปเลือกได้ทันที สั่ง 3 ชุดขึ้นไปฟรีค่าดำเนินการติดตั้ง",
  },
] as const;

const vatPercent = new Intl.NumberFormat("th-TH", {
  maximumFractionDigits: 2,
}).format(VAT_RATE * 100);

/**
 * The two bands the comparison table shows, handed to the JSON-LD builder so the
 * Product node can publish offers without typing a price into the schema module.
 */
export const PRICE_GUIDE_SCHEMA_PRICES = {
  sheet: offerRangeFrom(sheetPrices, "แผ่น"),
  installed: offerRangeFrom(installedPrices, "ตร.ม."),
};

/**
 * The picture the Product node publishes: the one this route already uses as its social card (ROUTE_META),
 * handed to the JSON-LD builder so the schema module never types an image path.
 */
export const PRICE_GUIDE_SCHEMA_IMAGE = ROUTE_META["/price-guide"]?.image?.path;


/**
 * job 465-C (A): this page used Tailwind `dark:` pairs, but the storefront theme is `data-theme="dark"` on
 * `.storefront-theme-root` (nothing ever adds a `.dark` class), so every `dark:` utility here was dead and the
 * dark theme showed pale `--ink` text on fixed white / slate-100 surfaces. These classes carry the same light
 * colours as before and switch on the real attribute. They are plain (unlayered) rules with a class selector, so
 * they also beat the global `a { color: inherit }` and `h1,h2,h3 { color: var(--ink) }` that outrank utilities.
 */
const PRICE_GUIDE_THEME_CSS = `
.pg-muted { color: #475569; }
.pg-faint { color: #64748b; }
.pg-accent { color: #1e40af; }
.pg-card { background: #ffffff; }
.pg-soft { background: #f1f5f9; }
.pg-soft--note { color: #334155; }
.pg-icon { background: #dbeafe; color: #1e3a8a; }
.pg-next { background: var(--deep); color: #ffffff; }
.pg-next-title { color: #ffffff; }
.pg-next-kicker { color: #bfdbfe; }
.pg-next-text { color: #e2e8f0; }
.pg-next-map { color: #dbeafe; }
.pg-next-map:hover { color: #ffffff; }
.pg-next-cta { background: #ffffff; color: #020617; }
.pg-next-cta:hover { background: #eff6ff; }
[data-theme="dark"] .pg-muted { color: #cbd5e1; }
[data-theme="dark"] .pg-faint { color: #a9b8cc; }
[data-theme="dark"] .pg-accent { color: #93c5fd; }
[data-theme="dark"] .pg-card { background: var(--card-paper); color: var(--ink); }
[data-theme="dark"] .pg-soft { background: #1e293b; color: var(--ink); }
[data-theme="dark"] .pg-soft--note { color: #e2e8f0; }
[data-theme="dark"] .pg-icon { background: #172554; color: #bfdbfe; }
[data-theme="dark"] .pg-btn { color: #0b1324; }
`;

function PriceGuidePage() {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <style>{PRICE_GUIDE_THEME_CSS}</style>
      <RouteStructuredData id="price-guide" data={buildPriceGuideJsonLd(PRICE_GUIDE_SCHEMA_PRICES, PRICE_GUIDE_SCHEMA_IMAGE)} />
            <StandalonePageHeader page="price-guide" subtitle="คู่มือราคาและขั้นตอน · PRICE GUIDE" />

      <main aria-labelledby="price-guide-title" data-testid="price-guide-content">
        <article className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
          <section className="grid gap-8 border-b border-[var(--line)] pb-10 md:grid-cols-[minmax(0,1fr)_18rem] md:items-end">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] pg-accent">
                PRICE GUIDE / SOLID SURFACE
              </p>
              <h1 id="price-guide-title" className="max-w-3xl text-3xl font-bold leading-tight sm:text-5xl">
                ราคาเคาน์เตอร์หินสังเคราะห์ <span className="pg-accent">และวิธีเลือก</span>
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 pg-muted sm:text-lg">
                ดูแนวทางเลือกซื้อ วิธีประเมินพื้นที่ และเงื่อนไขค่าดำเนินการก่อนสั่งทำ
                ราคาเคาน์เตอร์พร้อมติดตั้งคิดตามเรตของสีและลายที่เลือก
                ส่วนแผ่นดิบมีราคาแตกต่างกันตามสี
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/stone" className="button button--dark pg-btn" data-testid="link-price-guide-stone-hero">
                  ดูสีและราคาแผ่นหิน <ArrowRight size={16} />
                </Link>
                <Link href="/quote" className="text-link" data-testid="link-price-guide-quote-hero">
                  ขอใบเสนอราคา
                </Link>
              </div>
            </div>
            <aside className="rounded-2xl border border-[var(--line)] pg-card p-5 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <BookOpen size={17} aria-hidden="true" /> ก่อนเริ่มประเมินราคา
              </p>
              <p className="mt-2 text-sm leading-6 pg-muted">
                เตรียมขนาดพื้นที่ รูปแบบขอบ และสีที่สนใจ เพื่อให้ทีมงานประเมินงานได้ตรงกับหน้างาน
              </p>
            </aside>
          </section>

          <section aria-labelledby="buying-options-title" className="scroll-mt-24 py-10 sm:py-14">
            <div className="mb-6 flex items-start gap-3">
              <span className="mt-1 text-sm font-semibold pg-accent">01</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] pg-faint">BUYING OPTIONS</p>
                <h2 id="buying-options-title" className="mt-1 text-2xl font-bold">3 วิธีสั่งซื้อและช่วงราคา</h2>
              </div>
            </div>
            <p className="mb-6 text-sm leading-6 pg-muted" data-testid="paragraph-price-guide-buying-options-title">
              ราคาต่อหน่วยของแต่ละแบบไม่เหมือนกัน และใครเป็นคนติดตั้งก็เป็นคนละกรณี ตารางด้านล่างเทียบให้เห็นในตารางเดียว ช่วงราคาอ่านจากราคารวมในแคตตาล็อกทั้งหมด
            </p>
<div className="grid gap-4 lg:grid-cols-3">
              <section className="rounded-2xl border border-[var(--line)] pg-card p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] pg-accent">สั่งตัดพร้อมติดตั้ง</p>
                <h3 className="mt-3 text-lg font-bold">เลือกเรตตามสีและลาย</h3>
                <p className="mt-2 text-sm leading-6 pg-muted">
                  คิดราคาต่อตารางเมตรตามกลุ่มสีและลาย โดยตัวเลขด้านล่างอ่านจากราคาติดตั้งในแคตตาล็อก
                </p>
                <div className="mt-5 space-y-3">
                  {PRICE_GUIDE_INSTALLATION_RATES.map((tier) => (
                    <div key={tier.name} className="flex items-start justify-between gap-3 border-t border-[var(--line)] pt-3" data-testid={`price-tier-${tier.name}`}>
                      <div>
                        <p className="font-semibold">{tier.name}</p>
                        <p className="mt-1 text-xs leading-5 pg-faint">{tier.detail}</p>
                      </div>
                      <p className="shrink-0 text-right font-bold tabular-nums">
                        {formatTHB(tier.price)}
                        <span className="block text-xs font-normal pg-faint">/ ตร.ม.</span>
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section data-testid="raw-slab-guidance" className="rounded-2xl border border-[var(--line)] pg-card p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] pg-accent">ซื้อแผ่นดิบ</p>
                <h3 className="mt-3 text-lg font-bold">เลือกแผ่นตามสีที่ต้องการ</h3>
                <p className="mt-2 text-sm leading-6 pg-muted">
                  ราคาแผ่นดิบแตกต่างกันตามสี จึงไม่แสดงตัวเลขราคาเดียวแทนทุกสี
                  ตรวจราคาและรายละเอียดของแต่ละสีได้จากแคตตาล็อก
                </p>
                <Link href="/stone" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold pg-accent hover:underline" data-testid="link-price-guide-raw-stone">
                  ดูราคาแผ่นดิบที่หน้าเลือกหิน <ArrowRight size={15} />
                </Link>
              </section>

              <section className="rounded-2xl border border-[var(--line)] pg-card p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] pg-accent">อ่างล้างหน้า</p>
                <h3 className="mt-3 text-lg font-bold">เลือกรุ่นและจำนวนชุด</h3>
                <p className="mt-2 text-sm leading-6 pg-muted">
                  ราคาตัวอ่างดูตามรุ่นในแคตตาล็อก ส่วนค่าดำเนินการติดตั้งขึ้นอยู่กับจำนวนชุด
                  และเงื่อนไขหน้างาน
                </p>
                <Link href="/" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold pg-accent hover:underline" data-testid="link-price-guide-basin-catalog">
                  ดูรุ่นและสีอ่างในแคตตาล็อก <ArrowRight size={15} />
                </Link>
              </section>
            </div>

            <div className="mt-6 overflow-x-auto" data-testid="table-price-guide-buying">
              <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
                <caption className="sr-only">
                  เปรียบเทียบสามวิธีสั่งซื้อเคาน์เตอร์และอ่างล้างหน้าหินสังเคราะห์ พร้อมช่วงราคาที่อ่านจากแคตตาล็อก
                </caption>
                <thead>
                  <tr className="border-b border-[var(--line)] text-xs uppercase tracking-[0.12em] pg-faint">
                    <th scope="col" className="py-3 pr-4 font-semibold">วิธีซื้อ</th>
                    <th scope="col" className="py-3 pr-4 font-semibold">คิดราคาอย่างไร</th>
                    <th scope="col" className="py-3 pr-4 font-semibold">ช่วงราคาที่มีในแคตตาล็อก</th>
                    <th scope="col" className="py-3 font-semibold">เหมาะกับ</th>
                  </tr>
                </thead>
                <tbody>
                  {BUYING_OPTIONS.map((option) => (
                    <tr key={option.key} className="border-b border-[var(--line)] align-top">
                      <th scope="row" className="py-3 pr-4 font-semibold">{option.label}</th>
                      <td className="py-3 pr-4 pg-muted">{option.unit}</td>
                      <td className="py-3 pr-4 font-semibold tabular-nums">{option.from} บาท</td>
                      <td className="py-3 pg-muted">{option.fits}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className="py-3 pr-4 font-semibold">ขั้นต่ำงานติดตั้ง</th>
                    <td className="py-3 pr-4 pg-muted">ตร.ม. ต่องาน · มีค่าดำเนินการเมื่อพื้นที่ไม่ถึงขั้นต่ำ</td>
                    <td className="py-3 pr-4 font-semibold tabular-nums">
                      {formatTHB(STONE_SMALL_JOB_BANGKOK_FEE)} / {formatTHB(STONE_SMALL_JOB_PROVINCE_FEE)} บาท
                    </td>
                    <td className="py-3 pg-muted">
                      กรุงเทพฯ และปริมณฑลขั้นต่ำ {STONE_INSTALLED_MIN_BANGKOK_SQM} ตร.ม. · ต่างจังหวัดขั้นต่ำ {STONE_INSTALLED_MIN_PROVINCE_SQM} ตร.ม.
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="py-3 pr-4 font-semibold">ภาษี</th>
                    <td className="py-3 pr-4 pg-muted">VAT ที่นำมาแสดงในใบเสนอราคา</td>
                    <td className="py-3 pr-4 font-semibold tabular-nums">{vatPercent}%</td>
                    <td className="py-3 pg-muted">ราคาทุกตัวในหน้านี้เป็นราคายังไม่รวม VAT ระบบจะคำนวณภาษีในขั้นตอนออกใบเสนอราคา</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="area-measurement-title" className="scroll-mt-24 border-t border-[var(--line)] py-10 sm:py-14">
            <div className="mb-6 flex items-start gap-3">
              <span className="mt-1 text-sm font-semibold pg-accent">02</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] pg-faint">MEASURE THE SPACE</p>
                <h2 id="area-measurement-title" className="mt-1 text-2xl font-bold">วิธีคิดพื้นที่และวัดหน้างาน</h2>
              </div>
            </div>
            <p className="mb-6 text-sm leading-6 pg-muted" data-testid="paragraph-price-guide-area-measurement-title">
              คิดราคาจากพื้นที่หน้างานจริงรวมทุกช่วง ไม่ใช่จำนวนแผ่น ถ้ามีหลายช่วงที่สั้นยาวไม่เท่ากัน ให้วัดแยกเป็นส่วนแล้วค่อยรวมกัน
            </p>
<div className="grid gap-6 md:grid-cols-[auto_1fr]">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl pg-icon">
                <Ruler size={26} aria-hidden="true" />
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <h3 className="font-semibold">วัดแต่ละช่วง</h3>
                  <p className="mt-2 text-sm leading-6 pg-muted">จดความยาวและความกว้างของพื้นที่แต่ละส่วน พร้อมระบุจุดต่อหรือมุมที่ต้องทำตามแบบ</p>
                </div>
                <div>
                  <h3 className="font-semibold">คำนวณพื้นที่โดยประมาณ</h3>
                  <p className="mt-2 text-sm leading-6 pg-muted">แปลงขนาดเป็นเมตร แล้วคูณความยาวกับความกว้างของแต่ละช่วง จากนั้นรวมพื้นที่ทุกช่วงเข้าด้วยกัน</p>
                </div>
                <div>
                  <h3 className="font-semibold">ส่งข้อมูลให้ทีมตรวจ</h3>
                  <p className="mt-2 text-sm leading-6 pg-muted">แนบภาพพื้นที่ ตำแหน่งอ่าง ขอบผนัง และจุดที่ต้องเจาะหรือเว้นช่อง เพื่อยืนยันรายละเอียดก่อนทำใบเสนอราคา</p>
                </div>
              </div>
            </div>
            <p className="mt-6 rounded-xl pg-soft pg-soft--note px-5 py-4 text-sm leading-6">
              ขนาดที่วัดเองใช้ประเมินเบื้องต้นเท่านั้น ขนาดผลิตและราคา final ต้องตรวจแบบกับทีมงานก่อนเริ่มงาน
            </p>
          </section>

          <section aria-labelledby="additional-fees-title" className="scroll-mt-24 border-t border-[var(--line)] py-10 sm:py-14">
            <div className="mb-6 flex items-start gap-3">
              <span className="mt-1 text-sm font-semibold pg-accent">03</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] pg-faint">INSTALLATION CONDITIONS</p>
                <h2 id="additional-fees-title" className="mt-1 text-2xl font-bold">ค่าดำเนินการและขั้นต่ำ</h2>
              </div>
            </div>
            <p className="mb-6 text-sm leading-6 pg-muted" data-testid="paragraph-price-guide-additional-fees-title">
              งานที่พื้นที่ไม่ถึงขั้นต่ำยังมีค่าดำเนินการเหมาจ่ายต่อครั้งตามเขตหน้างาน เพื่อคุมต้นทุนการเข้าไซต์แต่ละรอบ
            </p>
<div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-2xl border border-[var(--line)] pg-card p-6">
                <h3 className="font-bold">งานเล็กและพื้นที่ติดตั้ง</h3>
                <div className="mt-4 space-y-3 text-sm leading-6">
                  <p className="flex justify-between gap-4 border-b border-[var(--line)] pb-3">
                    <span>กรุงเทพฯ และปริมณฑล · ขั้นต่ำ {STONE_INSTALLED_MIN_BANGKOK_SQM} ตร.ม.</span>
                    <strong className="shrink-0">{formatTHB(STONE_SMALL_JOB_BANGKOK_FEE)} / งาน</strong>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span>ต่างจังหวัด · ขั้นต่ำ {STONE_INSTALLED_MIN_PROVINCE_SQM} ตร.ม.</span>
                    <strong className="shrink-0">{formatTHB(STONE_SMALL_JOB_PROVINCE_FEE)} / งาน</strong>
                  </p>
                </div>
                <p className="mt-4 text-sm leading-6 pg-muted">
                  ค่าดำเนินการข้างต้นใช้เมื่อพื้นที่ต่ำกว่าขั้นต่ำของพื้นที่ติดตั้งนั้น
                  หากลูกค้ารับแผ่นเอง ไม่คิดค่าดำเนินการงานเล็ก
                </p>
              </section>
              <section className="rounded-2xl border border-[var(--line)] pg-card p-6">
                <h3 className="font-bold">อ่างล้างหน้าและงานกลางคืน</h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 pg-muted">
                  <li>
                    สั่งน้อยกว่า {BASIN_INSTALLATION_FREE_FROM} ชุด: ค่าดำเนินการติดตั้ง{" "}
                    <strong className="text-[var(--ink)]">{formatTHB(INSTALLATION_PRICE)} / ชุด</strong>
                  </li>
                  <li>
                    ตั้งแต่ {BASIN_INSTALLATION_FREE_FROM} ชุดขึ้นไป: ฟรีค่าดำเนินการติดตั้ง
                  </li>
                  <li>
                    เข้าทำงานช่วง {NIGHT_WORK_START}–{NIGHT_WORK_END}: เพิ่ม{" "}
                    <strong className="text-[var(--ink)]">{formatTHB(NIGHT_WORK_FEE)} / คืน</strong>
                  </li>
                </ul>
                <p className="mt-4 border-t border-[var(--line)] pt-4 text-sm leading-6">
                  ยอดรวมคิด VAT {vatPercent}% ตามอัตราในระบบใบเสนอราคา
                </p>
              </section>
            </div>
          </section>

          <section aria-labelledby="choose-color-title" className="scroll-mt-24 border-t border-[var(--line)] py-10 sm:py-14">
            <div className="mb-6 flex items-start gap-3">
              <span className="mt-1 text-sm font-semibold pg-accent">04</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] pg-faint">CHOOSE A COLOUR</p>
                <h2 id="choose-color-title" className="mt-1 text-2xl font-bold">วิธีเลือกสีให้เหมาะกับงาน</h2>
              </div>
            </div>
            <p className="mb-6 text-sm leading-6 pg-muted" data-testid="paragraph-price-guide-choose-color-title">
              เลือกจากลักษณะการใช้งานก่อนว่าจะโดนน้ำ โดนความร้อน หรือโดนกรดด่างบ่อยแค่ไหน แล้วค่อยเทียบสีจริงกับแสงหน้างาน เพราะเรตราคาขึ้นอยู่กับกลุ่มสีที่เลือก
            </p>
<div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--line)] p-5">
                <h3 className="font-semibold">เริ่มจากภาพรวมของห้อง</h3>
                <p className="mt-2 text-sm leading-6 pg-muted">เทียบสีกับผนัง พื้น และหน้าบาน เพื่อให้เคาน์เตอร์กลมกลืนหรือเป็นจุดเด่นอย่างที่ตั้งใจ</p>
              </div>
              <div className="rounded-2xl border border-[var(--line)] p-5">
                <h3 className="flex items-center gap-2 font-semibold"><Sparkles size={16} aria-hidden="true" /> เลือกผิวและลาย</h3>
                <p className="mt-2 text-sm leading-6 pg-muted">สีพื้นให้ความรู้สึกเรียบ ลายเกล็ดช่วยเพิ่มรายละเอียด ส่วนลายหินอ่อนทำให้ลายวัสดุเป็นองค์ประกอบสำคัญของห้อง</p>
              </div>
              <div className="rounded-2xl border border-[var(--line)] p-5">
                <h3 className="font-semibold">ดูสีในพื้นที่จริง</h3>
                <p className="mt-2 text-sm leading-6 pg-muted">แสงและหน้าจออาจทำให้สีที่เห็นต่างกัน ควรตรวจตัวอย่างสีและภาพผลงานประกอบก่อนยืนยัน</p>
              </div>
            </div>
            <Link href="/portfolio" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold pg-accent hover:underline" data-testid="link-price-guide-portfolio">
              ดูภาพผลงานติดตั้งจริง <ArrowRight size={15} />
            </Link>
          </section>

          <section aria-labelledby="care-title" className="scroll-mt-24 border-t border-[var(--line)] py-10 sm:py-14">
            <div className="mb-6 flex items-start gap-3">
              <span className="mt-1 text-sm font-semibold pg-accent">05</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] pg-faint">CARE & MAINTENANCE</p>
                <h2 id="care-title" className="mt-1 text-2xl font-bold">วิธีดูแลรักษาผิวหินสังเคราะห์</h2>
              </div>
            </div>
            <ul className="grid gap-4 sm:grid-cols-3">
              <li className="rounded-2xl pg-soft p-5 text-sm leading-6">เช็ดคราบทั่วไปด้วยผ้านุ่มและน้ำยาทำความสะอาดอ่อน ๆ แล้วเช็ดให้แห้ง</li>
              <li className="rounded-2xl pg-soft p-5 text-sm leading-6">เช็ดคราบที่หกโดยเร็ว และหลีกเลี่ยงการใช้พื้นผิวแทนเขียงตัดอาหาร</li>
              <li className="rounded-2xl pg-soft p-5 text-sm leading-6">หากต้องใช้สารทำความสะอาดเฉพาะ ให้ตรวจคำแนะนำสำหรับวัสดุและสีที่เลือกก่อน</li>
            </ul>
          </section>

          <section aria-labelledby="faq-title" className="scroll-mt-24 border-t border-[var(--line)] py-10 sm:py-14">
            <div className="mb-6 flex items-start gap-3">
              <span className="mt-1 text-sm font-semibold pg-accent">06</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] pg-faint">FAQ</p>
                <h2 id="faq-title" className="mt-1 text-2xl font-bold">คำถามที่พบบ่อย</h2>
              </div>
            </div>
            <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
              <details className="group py-4" open>
                <summary className="cursor-pointer list-none font-semibold" data-testid="faq-price-guide-measure">
                  ควรวัดพื้นที่อย่างไรก่อนขอราคา?
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-6 pg-muted">วัดความยาวและความกว้างของแต่ละช่วง จดตำแหน่งผนัง จุดต่อ และช่องอ่าง พร้อมส่งรูปหน้างานให้ทีมตรวจขนาดก่อนสรุปราคา</p>
              </details>
              <details className="group py-4">
                <summary className="cursor-pointer list-none font-semibold" data-testid="faq-price-guide-raw-sheet">
                  ดูราคาแผ่นดิบได้จากที่ไหน?
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-6 pg-muted">ราคาแผ่นดิบแตกต่างกันตามสี ตรวจราคาแผ่นและรายละเอียดสีที่มีได้ที่ <Link href="/stone" className="font-semibold pg-accent underline">หน้าเลือกหินสังเคราะห์</Link></p>
              </details>
              <details className="group py-4">
                <summary className="cursor-pointer list-none font-semibold" data-testid="faq-price-guide-quote">
                  ราคาประเมินเบื้องต้นเป็นราคาสุดท้ายหรือไม่?
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-6 pg-muted">ไม่ใช่ ขนาดและภาพที่ส่งใช้ประเมินเบื้องต้นเท่านั้น โปรดให้ทีมงานตรวจรายละเอียดและออกใบเสนอราคาก่อนยืนยันงาน</p>
              </details>
              <details className="group py-4">
                <summary className="cursor-pointer list-none font-semibold" data-testid="faq-price-guide-vat">
                  ใบเสนอราคาคิด VAT อย่างไร?
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-6 pg-muted">ระบบแสดง VAT ตามอัตราปัจจุบันในใบเสนอราคา โดยแยกรายการภาษีให้ตรวจสอบได้</p>
              </details>
            </div>
          </section>

          <section className="pg-next rounded-2xl p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-9">
            <div>
              <p className="pg-next-kicker text-xs font-semibold uppercase tracking-[0.16em]">NEXT STEP</p>
              <h2 className="pg-next-title mt-2 text-2xl font-bold">พร้อมเช็กราคาให้ตรงกับหน้างาน</h2>
              <p className="pg-next-text mt-2 max-w-2xl text-sm leading-6">เลือกสี ดูผลงาน และส่งขนาดที่มี เพื่อให้ทีมงานช่วยสรุปรายละเอียดสำหรับใบเสนอราคา</p>
              <a
                href="https://maps.app.goo.gl/o47RDTQAWZTfB4HYA"
                target="_blank"
                rel="noreferrer"
                className="mt-3 pg-next-map inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4"
                data-testid="link-price-guide-map"
              >
                <span aria-hidden="true">📍</span> แผนที่ / นำทาง
              </a>
            </div>
            <Link href="/quote" className="mt-5 inline-flex shrink-0 items-center justify-center gap-2 pg-next-cta rounded-full px-5 py-3 text-sm font-semibold sm:mt-0" data-testid="link-price-guide-final-quote">
              ไปหน้าขอใบเสนอราคา <ArrowRight size={16} />
            </Link>
          </section>

          <p className="mt-8">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium pg-accent hover:underline" data-testid="link-price-guide-back">
              <ArrowLeft size={15} /> กลับหน้าแคตตาล็อก
            </Link>
          </p>
        </article>
      </main>
    </div>
  );
}

export default PriceGuidePage;
