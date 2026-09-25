import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { AlertTriangle, ArrowRight, BookOpen, Check, CheckCircle2, ChevronDown, Clock, Copy, Download, FileText, GripVertical, Minus, Phone, Plus, PlayCircle, Printer, QrCode, Search, ShoppingBag, SlidersHorizontal, Trash2, Upload, Wrench, X } from "lucide-react";
import { WorkshopProductionSheet, type ProductionItem } from "@/components/WorkshopProductionSheet";
import { SitePhotoUpload } from "@/components/SitePhotoUpload";
import { TrustBadges } from "@/components/TrustBadges";
import { InstallationShowcase } from "@/components/InstallationShowcase";
import { QuickFAQ } from "@/components/QuickFAQ";
import { WorksiteAddressAutocomplete } from "@/components/WorksiteAddressAutocomplete";
import {
  formatTHB,
  INSTALLATION_PRICE,
  productBySku,
  PRODUCTS,
  stoneColorByName,
  stoneInstalledUnitPrice,
  stoneSheetUnitPrice,
  stoneColorsForMode,
  STONE_COLORS,
  STONE_GLUE_PRICE,
  STONE_INSTALLED_MIN_BANGKOK_SQM,
  STONE_INSTALLED_MIN_PROVINCE_SQM,
  STONE_SMALL_JOB_BANGKOK_FEE,
  STONE_SMALL_JOB_PROVINCE_FEE,
  STONE_SHEET_SIZE,
  STONE_SHEET_THICKNESS,
  VAT_RATE,
  CUSTOMER_CONTACT_OPTIONS,
  CUSTOMER_ROLE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  basinProductFromCatalog,
  sortBasinProductsBySku,
  reconcileStoneSelections,
  removeStoneSelection,
  stoneColorMatchesSelection,
  stoneColorsFromCatalog,
  toggleBasinSelection,
  toggleStoneSelection,
  upsertStoneSelection,
  type CustomerDetails,
  type BasinProduct,
  type QuoteBasinLine,
  type StoneColor,
  type StoneConfig,
} from "@/data/catalog";
import { calculateFormalQuoteTotals, formatQuoteMonth, quoteQrImageUrl, thaiNumberText, type QuoteFormat } from "@/data/quote-utils";
import { formatThaiDate, thaiDateInputValue } from "@/data/date-time";
import { createStudioShareLink } from "@/data/studio-draft";
import { StudioPage, type StudioNotificationSnapshot, type StudioSubmission } from "@/components/StudioPage";
import { pieceBounds, studioPieces, type StudioEstimate, type StudioOrderMode, type StudioState } from "@/data/studio-model";
import { downloadStudioDxf, downloadStudioPng, printStudioLayout, studioExportDimensionsValid, studioPrintTitle, STUDIO_PRINT_NOTE } from "@/data/studio-export";
import { StudioFootprint } from "@/components/StudioFootprint";
import { BasinVisual } from "@/components/BasinVisual";
import { BasinGalleryTrigger } from "@/components/BasinGalleryLightbox";
import { isValidEmailAddress } from "@/data/validation";
import { stoneHeroFrame } from "@/data/stone-hero";
import { CustomerProfilePage } from "@/components/CustomerProfilePage";
import { knightFurnichLogo, lineQrCode } from "@/data/assets";

const emptyCustomer: CustomerDetails = {
  name: "",
  company: "",
  taxId: "",
  taxName: "",
  taxBranch: "",
  taxAddress: "",
  phone: "",
  lineContact: "",
  email: "",
  purchasingDepartment: "",
  address: "",
  project: "",
  site: "",
  preferredContact: "",
  customerRole: "",
  propertyType: "",
  condoFloor: "",
  expectedInstallationDate: "",
  notes: "",
};
const defaultStone: StoneConfig = { enabled: false, mode: "whole-sheet", color: "BW010", quantity: 1, widthCm: 60, lengthCm: 120, areaSqM: 0.72, unitPrice: stoneSheetUnitPrice("BW010", 1) ?? 0, installationPrice: 0 };

function formatStonePrice(price: number | null) {
  return price === null ? "—" : formatTHB(price);
}

function stonePriceForMode(color: StoneColor, isWhole: boolean) {
  return isWhole ? color.sheetPriceTHB : color.installedPriceTHB;
}

function stoneAreaSqM(stone: StoneConfig) {
  return stone.widthCm > 0 && stone.lengthCm > 0 ? (stone.widthCm * stone.lengthCm) / 10000 : 0;
}

function stoneOrderModeLabel(mode: StoneConfig["mode"]) {
  return mode === "whole-sheet" ? "ซื้อแผ่นเต็ม" : "ซื้อเป็น ตร.ม. · ตัดและติดตั้ง";
}

function stoneUnitPrice(stone: StoneConfig, colors: ReadonlyArray<StoneColor> = STONE_COLORS) {
  return stone.mode === "whole-sheet"
    ? stoneSheetUnitPrice(stone.color, stone.quantity, colors)
    : stoneInstalledUnitPrice(stone.color, colors);
}

function stoneTotal(stone: StoneConfig, colors: ReadonlyArray<StoneColor> = STONE_COLORS) {
  const unitPrice = stoneUnitPrice(stone, colors);
  if (!stone.enabled || unitPrice === null) return 0;
  return unitPrice * (stone.mode === "whole-sheet" ? stone.quantity : stoneAreaSqM(stone));
}

function isInvalidStone(stone: StoneConfig, colors: ReadonlyArray<StoneColor> = STONE_COLORS) {
  return stone.enabled && (stoneUnitPrice(stone, colors) === null || (stone.mode === "installed" && (stone.widthCm < 10 || stone.lengthCm < 10)));
}

function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}

function readStoredCustomer(value: unknown): CustomerDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...emptyCustomer };
  return { ...emptyCustomer, ...(value as Partial<CustomerDetails>) };
}

function useStoredCustomer(key: string) {
  const [value, setValue] = useState<CustomerDetails>(() => {
    try { return readStoredCustomer(JSON.parse(localStorage.getItem(key) || "null")); } catch { return { ...emptyCustomer }; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}

function useStoredStones(key: string, fallback: StoneConfig[]) {
  const [value, setValue] = useState<StoneConfig[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "null");
      if (Array.isArray(stored)) return stored;
      return fallback;
    } catch {
      return fallback;
    }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}

function upsertStone(
  stones: StoneConfig[],
  incoming: StoneConfig,
  colors: ReadonlyArray<StoneColor> = STONE_COLORS,
) {
  return upsertStoneSelection(stones, incoming, colors);
}

function formatDate(date = new Date()) {
  return formatThaiDate(date);
}

function Header({ cartCount }: { cartCount: number }) {
  const [location] = useLocation();
  return <header className="site-header">
    <Link href="/" className="brand" data-testid="link-brand"><img className="brand-logo brand-logo--png" src={knightFurnichLogo} alt="Knight Furnich" /><span className="brand-copy"><strong>KNIGHT FURNICH</strong><small>SOLID SURFACE / BASINS</small></span></Link>
    <nav className="main-nav" aria-label="หลัก">
      <Link href="/" className={location === "/" ? "is-active" : ""} data-testid="link-catalog">แคตตาล็อก</Link>
      <Link href="/stone" className={location === "/stone" ? "is-active" : ""} data-testid="link-stone">หินสังเคราะห์</Link>
      <Link href="/quote" className={`quote-link ${location === "/quote" ? "is-active" : ""}`} data-testid="link-quote">ใบเสนอราคา <span>{cartCount}</span></Link>
    </nav>
    <div className="header-actions">
      <LineLoginButton compact />
      <Link href="/quote" className="mobile-cart" aria-label="ดูใบเสนอราคา" data-testid="link-mobile-quote"><ShoppingBag size={18} /><span>{cartCount}</span></Link>
    </div>
  </header>;
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-brand-col">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img className="footer-logo footer-logo--png" src={knightFurnichLogo} alt="Knight Furnich" />
          <div>
            <span className="footer-kicker">SOLID SURFACE / BASINS</span>
            <p>พื้นผิวที่ทำให้รายละเอียดเล็ก ๆ มีน้ำหนักขึ้นมา</p>
          </div>
        </div>
      </div>
      <div className="footer-contact">
        <strong>บริษัท ไนท์ เฟอร์นิช จำกัด (สำนักงานใหญ่และโรงงานผลิต)</strong>
        <div className="footer-address">35/170, 35/267 หมู่ที่ 1 ซอยร่วมสุข 8/13 ถนนติวานนท์-แจ้งวัฒนะ ต.บ้านใหม่ อ.เมือง จ.ปทุมธานี 12000</div>
        <a
          className="footer-maps-link"
          href="https://www.google.com/maps/search/?api=1&query=%E0%B8%9A%E0%B8%A3%E0%B8%B4%E0%B8%A9%E0%B8%B1%E0%B8%97+%E0%B9%84%E0%B8%99%E0%B8%97%E0%B9%8C+%E0%B9%80%E0%B8%9F%E0%B8%AD%E0%B8%A3%E0%B9%8C%E0%B8%99%E0%B8%B4%E0%B8%8A+%E0%B8%88%E0%B8%B3%E0%B8%81%E0%B8%B1%E0%B8%94+%E0%B8%9B%E0%B8%97%E0%B8%B8%E0%B8%A1%E0%B8%98%E0%B8%B2%E0%B8%99%E0%B8%B5"
          target="_blank"
          rel="noreferrer"
          data-testid="link-footer-maps"
        >
          🗺️ นำทาง Google Maps มายังโรงงาน / สำนักงานใหญ่
        </a>
        <div className="footer-contact-grid">
          <div>📞 094-496-1949, 089-762-2209</div>
          <div>💬 LINE: <strong>@789gcnhq</strong> (KnightBot)</div>
          <div>🌐 <a href="https://www.knightfurnich.com" target="_blank" rel="noreferrer">www.knightfurnich.com</a></div>
          <div>⏱️ จ.-ศ. 08:30–16:30 | ส. 08:30–11:30 (หยุดวันอาทิตย์)</div>
        </div>
      </div>
      <div className="footer-line-qr" data-testid="footer-line-qr">
        <img src={lineQrCode} alt="QR Code แอด LINE @789gcnhq" loading="lazy" />
        <div>
          <strong>สแกนแอด LINE</strong>
          <span>คุยกับน้องไนท์ได้ทันที</span>
          <span className="footer-line-qr-id">@789gcnhq</span>
        </div>
      </div>
      <div className="footer-meta">
        <span>TH / 2026 COLLECTION</span>
        <span>ราคาสินค้ายังไม่รวม VAT</span>
        <Link href="/?workbench=1" className="footer-owner-link">Private Workbench</Link>
      </div>
    </footer>
  );
}

function QuoteDropZone({ cart, setCart, setStones, stoneColors }: { cart: QuoteBasinLine[]; setCart: Dispatch<SetStateAction<QuoteBasinLine[]>>; setStones: Dispatch<SetStateAction<StoneConfig[]>>; stoneColors: ReadonlyArray<StoneColor> }) {
  const [dragging, setDragging] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    const onStart = () => setDragging(true);
    const onEnd = () => { setDragging(false); setDragOver(false); };
    window.addEventListener("dragstart", onStart);
    window.addEventListener("dragend", onEnd);
    return () => { window.removeEventListener("dragstart", onStart); window.removeEventListener("dragend", onEnd); };
  }, []);
  const showFeedback = (message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback((current) => current === message ? "" : current), 2600);
  };
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const type = event.dataTransfer.getData("application/x-knight-type");
    if (type === "basin") {
      const sku = event.dataTransfer.getData("application/x-knight-basin");
      if (!productBySku(sku)) return showFeedback("ไม่พบสินค้าที่ลากมา กรุณาลองใหม่");
      setCart((current) => current.some((line) => line.sku === sku)
        ? current
        : [...current, { sku, quantity: 1, installationSelected: false }]);
      return showFeedback(`เพิ่ม ${sku} ลงใบเสนอราคาแล้ว`);
    }
    if (type === "stone") {
      try {
        const payload = JSON.parse(event.dataTransfer.getData("application/x-knight-stone")) as StoneConfig;
        if (payload.enabled) {
          setStones((current) => upsertStone(current, payload));
           return showFeedback(`เพิ่ม ${stoneColorByName(payload.color, stoneColors).name} ลงใบเสนอราคาแล้ว`);
        }
      } catch {
        showFeedback("ไม่สามารถเพิ่มรายการหินได้ กรุณาลองใหม่");
        return;
      }
    }
    showFeedback("ลากสินค้า หรือรายการหินที่เลือกมาวางในพื้นที่นี้");
  };
  if (!dragging && !feedback) return null;
  return <div className={`quote-drop-shell ${dragOver ? "is-over" : ""}`} aria-live="polite">
    <div className="quote-drop-zone" onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} role="region" aria-label="เพิ่มรายการลงใบเสนอราคา">
      <GripVertical size={19} aria-hidden="true" /><div><strong>{dragOver ? "ปล่อยเพื่อเพิ่มลงใบเสนอราคา" : "เพิ่มลงใบเสนอราคา"}</strong><small>ลากอ่างล้างหน้าหรือรายการหินที่เลือกมาวางที่นี่</small></div><Link href="/quote" className="drop-zone-link">ดูใบเสนอราคา <ArrowRight size={15} /></Link>
    </div>
    {feedback && <div className="drop-feedback"><Check size={15} /> {feedback}</div>}
  </div>;
}
function Layout({ children, cart, setCart, stones, setStones, stoneColors, catalogNotice, onDismissCatalogNotice, onAddToQuote, onRequestQuote, onLeadEvent }: { children: ReactNode; cart: QuoteBasinLine[]; setCart: Dispatch<SetStateAction<QuoteBasinLine[]>>; stones: StoneConfig[]; setStones: Dispatch<SetStateAction<StoneConfig[]>>; stoneColors: ReadonlyArray<StoneColor>; catalogNotice?: string; onDismissCatalogNotice?: () => void; onAddToQuote: (sku: string) => void; onRequestQuote: (skus: string[]) => void; onLeadEvent: (status: "new_lead" | "selecting", productSkus?: string[]) => void }) {
  const count = cart.reduce((sum, line) => sum + line.quantity, 0) + stones.length;
  return <><Header cartCount={count} />{catalogNotice && <div className="catalog-freshness-notice" role="status" aria-live="polite"><span>{catalogNotice}</span>{onDismissCatalogNotice && <button type="button" onClick={onDismissCatalogNotice} aria-label="ปิดการแจ้งเตือนแคตตาล็อก"><X size={15} /></button>}</div>}<main aria-label="เนื้อหาหลัก" data-testid="storefront-main">{children}</main><QuoteDropZone cart={cart} setCart={setCart} setStones={setStones} stoneColors={stoneColors} /><Footer /><KnightSupport onAddToQuote={onAddToQuote} onRequestQuote={onRequestQuote} onLeadEvent={onLeadEvent} /></>;
}

function ProductCard({ sku, cart, onToggle }: { sku: string; cart: QuoteBasinLine[]; onToggle: (sku: string) => void }) {
  const product = productBySku(sku)!;
  const isTall = product.category === "tall vertical washbasin";
  const inQuote = cart.find((line) => line.sku === sku);
  const toggle = () => onToggle(sku);
  const galleryImages = [product.imageUrl, ...(product.galleryImageUrls ?? [])].filter((url): url is string => Boolean(url));
  return <article
    className={`product-card ${inQuote ? "is-selected" : ""}`}
    draggable
    role="checkbox"
    aria-checked={Boolean(inQuote)}
    tabIndex={0}
    onClick={toggle}
    onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); toggle(); } }}
    onDragStart={(event) => { event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("application/x-knight-type", "basin"); event.dataTransfer.setData("application/x-knight-basin", sku); }}
    data-testid={`card-product-${sku}`}
  >
     {inQuote && <SelectionMarker className="product-selected-badge" />}
     <div className="product-art"><span className="product-index">{sku}</span><BasinVisual tone={product.imageTone} imageUrl={product.imageUrl} hoverImageUrl={product.quoteImageUrl} alt={`${product.sku} ${product.colorName}`} tall={isTall} /><span className="art-note">{isTall ? "VERTICAL SERIES" : "COUNTER SERIES"}</span>{galleryImages.length > 1 && <BasinGalleryTrigger images={galleryImages} alt={`${product.sku} ${product.colorName}`} />}{product.videoUrl && <a className="product-video-link" href={product.videoUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><PlayCircle size={13} /> 3D 360°</a>}</div>
     <div className="product-info"><div><p className="eyebrow">{product.colorCode}</p><h3>{product.colorName}</h3></div></div>
     <div className="product-specs"><span>{product.dimensions}</span><span>{product.basinDimensions ? `หลุมอ่าง ${product.basinDimensions}` : "งานทรงสูง"}</span></div>
     <strong className="product-price">{formatTHB(product.priceTHB)}</strong>
      <div className="product-card-actions" role="group" aria-label={`ตัวเลือกการสั่งซื้อ ${product.sku}`}>
        <button
          type="button"
          className="product-card-action product-card-action--quote"
          onClick={(event) => { event.stopPropagation(); onToggle(sku); }}
          aria-pressed={Boolean(inQuote)}
          data-testid={`button-quote-basin-${sku}`}
        >
          🛒 ซื้อเฉพาะอ่าง
        </button>
        <Link
          href={`/studio?basin=${encodeURIComponent(sku)}`}
          className="product-card-action product-card-action--studio"
          onClick={(event) => event.stopPropagation()}
          data-testid={`link-basin-studio-${sku}`}
        >
          ✨ สั่งผลิตพร้อมท็อปเคาน์เตอร์
        </Link>
      </div>
  </article>;
}

function SelectionMarker({ className = "" }: { className?: string }) {
  return <span className={`selection-marker ${className}`.trim()} aria-label="เลือกแล้ว"><Check size={14} aria-hidden="true" /></span>;
}

type StorefrontCategory = {
  name: string;
  active?: boolean;
  sortOrder?: number;
};

const legacyCategoryLabels: Record<string, string> = {
  "counter basin": "เคาน์เตอร์",
  "tall vertical washbasin": "ทรงสูง",
};

function categoryLabel(name: string) {
  return legacyCategoryLabels[name] ?? name;
}

function categoryTestId(name: string) {
  if (name === "counter basin") return "button-filter-counter";
  if (name === "tall vertical washbasin") return "button-filter-tall";
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9ก-๙]+/g, "-").replace(/^-+|-+$/g, "");
  return `button-filter-category-${slug || "custom"}`;
}

function compareProductNames(left: BasinProduct, right: BasinProduct) {
  return left.colorName.localeCompare(right.colorName, "th", { numeric: true, sensitivity: "base" })
    || left.sku.localeCompare(right.sku, "en", { numeric: true });
}

function HomePage({ cart, setCart, categories, products = PRODUCTS }: { cart: QuoteBasinLine[]; setCart: Dispatch<SetStateAction<QuoteBasinLine[]>>; categories?: StorefrontCategory[]; products?: ReadonlyArray<BasinProduct> }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("catalog");
  const catalogCount = products.length;
  const visibleCategories = useMemo(() => {
    const persistedCategories = categories?.filter((item) => item.active !== false && item.name.trim()) ?? [];
    if (persistedCategories.length) return persistedCategories;
    return [...new Set(products.map((product) => product.category))].map((name, sortOrder) => ({ name, sortOrder }));
  }, [categories, products]);
  const selectedProductCount = useMemo(() => {
    const selectedSkus = new Set(cart.map((line) => line.sku));
    return products.filter((product) => selectedSkus.has(product.sku)).length;
  }, [cart, products]);
  const categoryCounts = useMemo(() => new Map(
    visibleCategories.map((item) => [item.name, products.filter((product) => product.category === item.name).length]),
  ), [products, visibleCategories]);
  const toggle = (sku: string) => setCart((current) => toggleBasinSelection(current, sku));
  const filtered = useMemo(() => {
    const selectedSkus = new Set(cart.map((line) => line.sku));
    const visibleProducts = products.filter((product) => {
    const haystack = `${product.sku} ${product.colorCode} ${product.colorName}`.toLowerCase();
    const matchesCategory = category === "all"
      || (category === "selected" && selectedSkus.has(product.sku))
      || product.category === category;
    return matchesCategory && haystack.includes(query.toLowerCase());
    });
    if (sort === "sku-az") return sortBasinProductsBySku(visibleProducts);
    return visibleProducts.sort((left, right) => {
      if (sort === "name-az") return compareProductNames(left, right);
      if (sort === "name-za") return compareProductNames(right, left);
      if (sort === "price-low") return left.priceTHB - right.priceTHB || compareProductNames(left, right);
      if (sort === "price-high") return right.priceTHB - left.priceTHB || compareProductNames(left, right);
      if (sort === "selected") return Number(selectedSkus.has(right.sku)) - Number(selectedSkus.has(left.sku)) || compareProductNames(left, right);
      return 0;
    });
  }, [cart, category, products, query, sort]);
   return <div className="page-wrap">
       <section className="catalog-hero"><div><p className="eyebrow accent">KNIGHT BASINS / 2026</p><h1>Knight Basins<br /><em>อ่างล้างหน้า by ไนท์ เฟอร์นิช</em></h1><p className="hero-copy">อ่างล้างหน้าหินสังเคราะห์ที่คัดสรรมาเพื่อพื้นที่ซึ่งต้องการความเรียบ ความทนทาน และรายละเอียดที่อยู่ได้นานกว่ากระแส</p><Link href="/stone" className="text-link" data-testid="link-hero-stone">ดูวัสดุหินสังเคราะห์ <ArrowRight size={16} /></Link></div><div className="catalog-hero-art"><BasinHeroMedia products={products} /><div className="hero-index"><span>01</span><div className="hero-line" /><span>{catalogCount} SKU</span></div></div></section>
       <section className="catalog-toolbar"><div><p className="eyebrow">THE BASIN INDEX</p><h2>ทุกทรง ทุกโทน <span>/ เลือกได้ชัดเจน</span></h2></div><div className="catalog-controls"><label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหา SKU หรือสี" data-testid="input-product-search" />{query && <button onClick={() => setQuery("")} aria-label="ล้างการค้นหา" data-testid="button-clear-search"><X size={14} /></button>}</label><div className="filter-tabs" role="tablist"><button className={category === "all" ? "is-active" : ""} onClick={() => setCategory("all")} data-testid="button-filter-all">ทั้งหมด {catalogCount}</button><button className={category === "selected" ? "is-active" : ""} onClick={() => setCategory("selected")} data-testid="button-filter-selected">อ่างที่เลือก {selectedProductCount}</button>{visibleCategories.map((item) => <button key={item.name} className={category === item.name ? "is-active" : ""} onClick={() => setCategory(item.name)} data-testid={categoryTestId(item.name)}>{categoryLabel(item.name)} {categoryCounts.get(item.name) ?? 0}</button>)}</div><label className="sort-field"><SlidersHorizontal size={14} /><span className="sort-field-content"><select value={sort} onChange={(event) => setSort(event.target.value)} aria-describedby="catalog-sort-help" data-testid="select-sort"><option value="catalog">เรียงตามแคตตาล็อก</option><option value="name-az">ชื่อสี: A–Z</option><option value="name-za">ชื่อสี: Z–A</option><option value="sku-az">รหัสรุ่น / SKU: น้อยไปมาก</option><option value="price-low">ราคา: ต่ำไปสูง</option><option value="price-high">ราคา: สูงไปต่ำ</option><option value="selected">รายการที่เลือกก่อน</option></select><span id="catalog-sort-help" className="sort-field-help" data-testid="text-sort-help">เป็นการเรียงลำดับ ไม่ใช่ตัวกรอง · รวมทุกรุ่นที่เปิดใช้งานและรุ่นใหม่อัตโนมัติ</span></span><ChevronDown size={14} /></label></div></section>
     {filtered.length ? <section className="product-grid">{filtered.map((product) => <ProductCard key={product.sku} sku={product.sku} cart={cart} onToggle={toggle} />)}</section> : <div className="empty-state" data-testid="status-no-results"><span className="empty-number">—</span><h3>ไม่พบรายการที่ตรงกัน</h3><p>ลองใช้ SKU เช่น KF014 หรือค้นหาด้วยชื่อสี</p><button className="button button--outline" onClick={() => { setQuery(""); setCategory("all"); }} data-testid="button-reset-filters">แสดงสินค้าทั้งหมด</button></div>}
  </div>;
}

function StoneHeroMedia({ colors, fallbackColor }: { colors: ReadonlyArray<StoneColor>; fallbackColor: StoneColor }) {
  const [heroIndex, setHeroIndex] = useState(0);
  const [failedImageUrls, setFailedImageUrls] = useState<ReadonlySet<string>>(() => new Set());
  const [reducedMotion, setReducedMotion] = useState(false);
  const heroColors = colors.length ? colors : [fallbackColor];
  const heroSignature = heroColors.map((color) => `${color.code}:${color.imageUrl?.trim() ?? ""}`).join("|");

  useEffect(() => {
    setHeroIndex(0);
  }, [heroSignature]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener?.("change", updatePreference);
    return () => mediaQuery.removeEventListener?.("change", updatePreference);
  }, []);

  useEffect(() => {
    if (reducedMotion || heroColors.length < 2) return;
    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % heroColors.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [heroColors.length, reducedMotion]);

  const { color: heroColor, imageUrl, showImage } = stoneHeroFrame(colors, heroIndex, fallbackColor, failedImageUrls);

  return <div
    className="material-swatch"
    style={{ backgroundColor: heroColor.tone }}
    data-testid="stone-hero-media"
    data-stone-code={heroColor.code}
    data-image-state={showImage ? "image" : "tone"}
    aria-label={`${heroColor.code} ${heroColor.name}`}
  >
    {showImage && <img key={`${heroColor.code}:${imageUrl}`} src={imageUrl} alt={`${heroColor.code} ${heroColor.name}`} onError={() => setFailedImageUrls((current) => new Set(current).add(imageUrl))} />}
    <span><strong>{heroColor.code}</strong><small>{heroColor.name}</small></span>
  </div>;
}

function BasinHeroMedia({ products }: { products: ReadonlyArray<BasinProduct> }) {
  const [heroIndex, setHeroIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [failedImageUrls, setFailedImageUrls] = useState<ReadonlySet<string>>(() => new Set());
  const heroProducts = useMemo(() => products.length ? products.slice(0, 8) : PRODUCTS.slice(0, 1), [products]);
  const heroSignature = heroProducts.map((product) => `${product.sku}:${product.imageUrl?.trim() ?? ""}`).join("|");
  const heroProduct = heroProducts[heroIndex % heroProducts.length] ?? PRODUCTS[0];
  const imageUrl = heroProduct.imageUrl?.trim() ?? "";
  const showImage = Boolean(imageUrl) && !failedImageUrls.has(imageUrl);

  useEffect(() => {
    setHeroIndex(0);
  }, [heroSignature]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener?.("change", updatePreference);
    return () => mediaQuery.removeEventListener?.("change", updatePreference);
  }, []);

  useEffect(() => {
    if (reducedMotion || heroProducts.length < 2) return;
    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % heroProducts.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [heroProducts.length, reducedMotion]);

  return <div
    className="catalog-basin-hero"
    data-testid="catalog-basin-hero-media"
    data-basin-sku={heroProduct.sku}
    data-image-state={showImage ? "image" : "empty"}
    aria-label={`${heroProduct.sku} ${heroProduct.colorName}`}
  >
    {showImage && <img
      key={`${heroProduct.sku}:${imageUrl}`}
      className="catalog-basin-hero-image"
      src={imageUrl}
      alt={`${heroProduct.sku} ${heroProduct.colorName}`}
      onError={() => setFailedImageUrls((current) => new Set(current).add(imageUrl))}
    />}
  </div>;
}

function StonePage({ stones, setStones, stoneColorsByMode }: { stones: StoneConfig[]; setStones: Dispatch<SetStateAction<StoneConfig[]>>; stoneColorsByMode: { wholeSheet: ReadonlyArray<StoneColor>; installed: ReadonlyArray<StoneColor> } }) {
  const [dimensionError, setDimensionError] = useState("");
  const [stoneQuery, setStoneQuery] = useState("");
  const [stonePriceFilter, setStonePriceFilter] = useState("all");
  const [activeColor, setActiveColor] = useState<string | null>(stones[0]?.color ?? null);
  const [unselectedMode, setUnselectedMode] = useState<StoneConfig["mode"]>("whole-sheet");
  const activeMode = stones.find((stone) => stone.color === activeColor)?.mode ?? unselectedMode;
  const availableColors = activeMode === "whole-sheet" ? stoneColorsByMode.wholeSheet : stoneColorsByMode.installed;
  const effectiveActiveColor = activeColor
    ? availableColors.find((color) => stoneColorMatchesSelection(color, activeColor))?.code ?? null
    : null;
  const selectedStone = effectiveActiveColor
    ? stones.find((stone) => {
      const color = availableColors.find((candidate) => candidate.code === effectiveActiveColor);
      return color ? stoneColorMatchesSelection(color, stone.color) : false;
    }) ?? { ...defaultStone, color: effectiveActiveColor, mode: activeMode }
    : null;
  const editorStone = selectedStone ?? { ...defaultStone, color: "", mode: activeMode };
  const isWhole = editorStone.mode === "whole-sheet";
  const selectedColor = stoneColorByName(effectiveActiveColor ?? "", availableColors);
  const area = stoneAreaSqM(editorStone);
  const invalidInstalledSize = !isWhole && (editorStone.widthCm < 10 || editorStone.lengthCm < 10);
  const selectedPrice = selectedStone ? stoneUnitPrice(editorStone, availableColors) : null;
  const priceFilterOptions = useMemo(() => {
    const counts = new Map<number, number>();
    availableColors.forEach((color) => {
      const price = stonePriceForMode(color, isWhole);
      if (price !== null) counts.set(price, (counts.get(price) ?? 0) + 1);
    });
    const selectedCount = availableColors.filter((color) => stones.some((stone) => stoneColorMatchesSelection(color, stone.color))).length;
    return [
      { value: "all", label: "ทั้งหมด", count: availableColors.length },
      { value: "selected", label: "สีที่เลือก", count: selectedCount },
      ...[...counts.entries()]
        .sort(([left], [right]) => left - right)
        .map(([price, count]) => ({ value: String(price), label: formatTHB(price), count })),
    ];
  }, [availableColors, isWhole, stones]);
  const activePriceFilter = priceFilterOptions.some((option) => option.value === stonePriceFilter) ? stonePriceFilter : "all";
  useEffect(() => {
    if (effectiveActiveColor !== activeColor) setActiveColor(effectiveActiveColor);
  }, [activeColor, effectiveActiveColor]);
  const visibleColors = useMemo(() => {
    const query = stoneQuery.trim().toLowerCase();
    return availableColors.filter((color) =>
      (activePriceFilter === "all"
         || (activePriceFilter === "selected" && stones.some((stone) => stoneColorMatchesSelection(color, stone.color)))
        || (activePriceFilter !== "selected" && String(stonePriceForMode(color, isWhole)) === activePriceFilter))
      && (!query || [color.name, color.code, ...color.documentCodes].some((value) => value.toLowerCase().includes(query))),
    );
  }, [activePriceFilter, availableColors, isWhole, stoneQuery, stones]);
  const update = (changes: Partial<StoneConfig>) => setStones((current) => {
    if (!selectedStone) return current;
    const next = { ...selectedStone, ...changes, enabled: true };
    return upsertStone(current, next, availableColors);
  });
  const toggleColor = (color: string) => {
    const selectedColor = availableColors.find((candidate) => candidate.code === color);
    const selected = Boolean(selectedColor && stones.some((stone) => stoneColorMatchesSelection(selectedColor, stone.color)));
    if (selected) {
      if (activeColor === color) setActiveColor(stones.find((stone) => stone.color !== color)?.color ?? null);
      setStones((current) => removeStoneSelection(current, color, availableColors));
      setDimensionError("");
      return;
    }
    const next: StoneConfig = { ...defaultStone, mode: isWhole ? "whole-sheet" : "installed", color, enabled: true, unitPrice: isWhole ? stoneSheetUnitPrice(color, 1, availableColors) ?? 0 : stoneInstalledUnitPrice(color, availableColors) ?? 0 };
    setUnselectedMode(next.mode);
    setActiveColor(color);
    setStones((current) => toggleStoneSelection(current, color, next, availableColors));
    setDimensionError("");
  };
  const switchMode = (mode: StoneConfig["mode"]) => {
    if (!selectedStone) {
      setUnselectedMode(mode);
      setStonePriceFilter("all");
      setDimensionError("");
      return;
    }
    const targetColors = mode === "whole-sheet" ? stoneColorsByMode.wholeSheet : stoneColorsByMode.installed;
    const targetColor = targetColors.some((color) => color.code === selectedStone.color)
      ? selectedStone.color
      : targetColors[0]?.code;
    if (!targetColor) {
      setStones((current) => removeStoneSelection(current, selectedStone.color));
      setDimensionError("ยังไม่มีรายการหินที่เปิดใช้งานสำหรับรูปแบบนี้");
      return;
    }
    const next: StoneConfig = { ...selectedStone, mode, color: targetColor, enabled: true };
    setActiveColor(targetColor);
    setStonePriceFilter("all");
    setStones((current) => upsertStone(current, next, targetColors));
    setDimensionError("");
  };
  const validateDimensions = () => { if (!selectedStone || !editorStone.widthCm || !editorStone.lengthCm || editorStone.widthCm < 10 || editorStone.lengthCm < 10) setDimensionError("กรุณาระบุความกว้างและความยาวอย่างน้อย 10 ซม. เพื่อคำนวณพื้นที่"); else setDimensionError(""); };
  return <div className="page-wrap stone-page"><section className="stone-hero"><div><p className="eyebrow accent">MATERIAL / CONFIGURATOR</p><h1>หินสังเคราะห์<br /><em>ตามพื้นที่ของคุณ</em></h1><p className="hero-copy">เริ่มจากแผ่นมาตรฐาน หรือบอกขนาดพื้นที่ที่ต้องการติดตั้ง ระบบจะจัดโครงสร้างราคาให้เห็นก่อนส่งต่อเป็นใบเสนอราคา</p></div><StoneHeroMedia colors={availableColors} fallbackColor={selectedColor} /></section>
    <div className="config-layout"><section className="config-main"><div className="section-heading"><span className="step">01</span><div><p className="eyebrow">CHOOSE FORMAT</p><h2>เลือกรูปแบบการสั่งซื้อ</h2></div></div><div className="mode-switch"><button className={isWhole ? "is-active" : ""} onClick={() => switchMode("whole-sheet")} data-testid="button-stone-whole-sheet"><span>แผ่นเต็ม</span><small>ราคาขายแผ่นมาตรฐาน</small></button><button className={!isWhole ? "is-active" : ""} onClick={() => switchMode("installed")} data-testid="button-stone-installed"><span>ตัดและติดตั้ง</span><small>ราคาต่อตารางเมตร รวมติดตั้ง</small></button></div>
          <div className="section-heading">
            <span className="step">02</span>
            <div><p className="eyebrow">SURFACE TONE</p><h2>เลือกสีหิน <span>/ เลือกได้หลายสี</span></h2></div>
          </div>
          <div className="stone-search-row">
            <label className="search-field">
              <Search size={16} />
              <input value={stoneQuery} onChange={(event) => setStoneQuery(event.target.value)} placeholder="ค้นหาชื่อหรือรหัสสินค้า" data-testid="input-stone-search" />
              {stoneQuery && <button onClick={() => setStoneQuery("")} aria-label="ล้างการค้นหาหิน" data-testid="button-clear-stone-search"><X size={14} /></button>}
            </label>
            <span>{stones.length} สีที่เลือก · {visibleColors.length} / {availableColors.length} รายการ</span>
          </div>
          <div className="stone-price-filters" role="tablist" aria-label={isWhole ? "กรองราคาขายแผ่น" : "กรองราคาตัดและติดตั้ง"}>
            {priceFilterOptions.map((option) => (
              <button
                type="button"
                role="tab"
                aria-selected={activePriceFilter === option.value}
                className={activePriceFilter === option.value ? "is-active" : ""}
                onClick={() => setStonePriceFilter(option.value)}
                key={option.value}
                data-testid={`button-stone-price-filter-${option.value}`}
              >
                {option.label} <small>{option.count}</small>
              </button>
            ))}
          </div>
          <div className="stone-price-legend"><span>ราคาขายแผ่น</span><span>ราคารวมติดตั้ง</span></div>
          <div className="stone-colors">
            {visibleColors.length
              ? visibleColors.map((color) => {
                const selected = stones.some((stone) => stone.color === color.code);
                return (
                  <button
                    key={color.code}
                    className={`${selected ? "is-active" : ""} ${activeColor === color.code ? "is-editing" : ""}`}
                    onClick={() => toggleColor(color.code)}
                    aria-pressed={selected}
                    data-testid={`button-stone-color-${color.code}`}
                  >
                    <span className="stone-card-image-wrap" style={{ background: color.tone }}>
                      {color.imageUrl && <img className="stone-card-image" src={color.imageUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
                    </span>
                    <strong>{color.name}</strong>
                    <small>{color.code}</small>
                    <small className="stone-card-prices">แผ่น {formatStonePrice(color.sheetPriceTHB)} · ติดตั้ง {formatStonePrice(color.installedPriceTHB)}</small>
                    {selected && <Check size={14} />}
                  </button>
                );
              })
              : <div className="empty-state empty-state--stone"><span className="empty-number">—</span><p>ไม่พบสีหรือรหัสสินค้าที่ค้นหา</p></div>}
          </div>
       <div className="section-heading"><span className="step">03</span><div><p className="eyebrow">SIZE & QUANTITY</p><h2>{isWhole ? "จำนวนแผ่น" : "ขนาดพื้นที่"} <span>/ กำลังแก้ไข {selectedStone ? selectedColor.code : "ยังไม่ได้เลือกสี"}</span></h2></div></div>{isWhole ? <div className="quantity-editor large"><button onClick={() => update({ quantity: Math.max(1, editorStone.quantity - 1) })} disabled={!selectedStone} data-testid="button-stone-quantity-minus"><Minus size={16} /></button><strong data-testid="text-stone-quantity">{selectedStone ? editorStone.quantity : "—"}</strong><button onClick={() => update({ quantity: editorStone.quantity + 1 })} disabled={!selectedStone} data-testid="button-stone-quantity-plus"><Plus size={16} /></button><span>แผ่นมาตรฐาน / 760 × 3680 mm</span></div> : <div className="dimensions-form"><label>กว้าง (ซม.)<input type="number" min="10" value={selectedStone ? editorStone.widthCm || "" : ""} onChange={(event) => update({ widthCm: Number(event.target.value) })} onBlur={validateDimensions} disabled={!selectedStone} data-testid="input-stone-width" /></label><span>×</span><label>ยาว (ซม.)<input type="number" min="10" value={selectedStone ? editorStone.lengthCm || "" : ""} onChange={(event) => update({ lengthCm: Number(event.target.value) })} onBlur={validateDimensions} disabled={!selectedStone} data-testid="input-stone-length" /></label><div className="area-result"><small>พื้นที่รวม</small><strong>{area.toFixed(2)} m²</strong></div>{dimensionError && <p className="field-error" data-testid="status-stone-dimension-error">{dimensionError}</p>}</div>}</section>
         <aside className="config-summary" draggable={editorStone.enabled && !invalidInstalledSize && selectedPrice !== null} onDragStart={(event) => { if (!selectedStone || !editorStone.enabled || invalidInstalledSize || selectedPrice === null) return; event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("application/x-knight-type", "stone"); event.dataTransfer.setData("application/x-knight-stone", JSON.stringify(editorStone)); }}><p className="eyebrow">CONFIGURATION NOTE</p><div className="summary-swatch" style={{ background: selectedColor.tone }}>{selectedColor.imageUrl && <img src={selectedColor.imageUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</div><h3>{selectedStone ? selectedColor.name : "ยังไม่ได้เลือกสีหิน"}</h3><p className="muted">{stoneOrderModeLabel(editorStone.mode)} · {selectedStone ? selectedColor.code : "เลือกจากรายการด้านบน"}</p><div className="summary-divider" /><div className="summary-row"><span>{isWhole ? "ราคาขายแผ่น" : "ราคารวมติดตั้ง"}<small>{isWhole ? `${STONE_SHEET_SIZE} · ${STONE_SHEET_THICKNESS}` : "คิดตามพื้นที่แผ่นตัด"}</small></span><strong>{formatStonePrice(selectedPrice)} {isWhole ? "/ แผ่น" : "/ m²"}</strong></div>{!isWhole && <div className="summary-row"><span>ค่าแรงติดตั้ง</span><strong>{selectedPrice === null ? "ไม่มีราคา" : "รวมในราคาแล้ว"}</strong></div>}<div className="summary-total"><span>ประมาณการ</span><strong>{selectedPrice === null ? "—" : formatTHB(stoneTotal(editorStone, availableColors))}</strong></div>{selectedStone && editorStone.enabled && !invalidInstalledSize && selectedPrice !== null && <p className="drag-summary-hint"><GripVertical size={14} /> ลากสรุปนี้ไปเพิ่มในใบเสนอราคา</p>}<Link href="/quote" className={`button button--dark full-width ${!selectedStone || invalidInstalledSize || selectedPrice === null ? "is-disabled" : ""}`} onClick={(event) => { if (!selectedStone) { event.preventDefault(); setDimensionError("กรุณาเลือกสีหินก่อนเพิ่มลงในใบเสนอราคา"); } else if (invalidInstalledSize) { event.preventDefault(); setDimensionError("กรุณาระบุความกว้างและความยาวอย่างน้อย 10 ซม. ก่อนเพิ่มลงในใบเสนอราคา"); } else if (selectedPrice === null) { event.preventDefault(); setDimensionError("รายการนี้ไม่มีราคาในเอกสารราคา จึงยังเพิ่มในใบเสนอราคาไม่ได้"); } }} data-testid="link-stone-to-quote">ดูใบเสนอราคา <ArrowRight size={16} /></Link><p className="price-note">{!selectedStone ? "เลือกสีหินก่อนเพิ่มลงในใบเสนอราคา" : selectedPrice === null ? "ไม่มีราคาของรูปแบบนี้ในเอกสารราคา จึงยังเพิ่มในใบเสนอราคาไม่ได้" : isWhole ? `ราคาขายแผ่นยังไม่รวม VAT และกาว 250 ml (${formatTHB(STONE_GLUE_PRICE)} / หลอด)` : `กรุงเทพฯ/ปริมณฑลขั้นต่ำ ${STONE_INSTALLED_MIN_BANGKOK_SQM} m² · ต่างจังหวัดขั้นต่ำ ${STONE_INSTALLED_MIN_PROVINCE_SQM} m²`}</p>{!isWhole && selectedStone && selectedPrice !== null && <p className="price-note">งานต่ำกว่าขั้นต่ำคิดค่าดำเนินการ {formatTHB(STONE_SMALL_JOB_BANGKOK_FEE)} ในกรุงเทพฯ หรือ {formatTHB(STONE_SMALL_JOB_PROVINCE_FEE)} ต่างจังหวัด</p>}</aside>
     </div><div className="source-note"><span>แหล่งอ้างอิง</span> ราคาขายแผ่นและราคารวมติดตั้งจากเอกสาร Knight Furnich ที่แนบมา · ราคายังไม่รวม VAT 7%</div></div>;
}

function QuoteStoneRow({ stone, onRemove, stoneColors }: { stone: StoneConfig; onRemove: (color: string) => void; stoneColors: ReadonlyArray<StoneColor> }) {
  const selectedStone = stoneColorByName(stone.color, stoneColors);
  const currentStoneUnitPrice = stoneUnitPrice(stone, stoneColors);
  return <div className="stone-line" data-testid={`row-quote-stone-${selectedStone.code}`}>
    <span className="stone-chip" style={{ background: selectedStone.tone }}>{selectedStone.imageUrl && <img src={selectedStone.imageUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</span>
    <div><strong>{selectedStone.name} · {selectedStone.code}</strong><small>รูปแบบ: {stoneOrderModeLabel(stone.mode)} · {stone.mode === "whole-sheet" ? `${stone.quantity} แผ่น · ราคาขายแผ่น` : `พื้นที่ ${stoneAreaSqM(stone).toFixed(2)} m² · ราคารวมติดตั้ง`}</small></div>
    <strong className="line-price">{currentStoneUnitPrice === null ? "ไม่มีราคา" : formatTHB(stoneTotal(stone, stoneColors))}</strong>
    <button type="button" className="icon-button stone-remove-button" onClick={() => onRemove(stone.color)} aria-label={`ลบหิน ${selectedStone.name} ออกจากใบเสนอราคา`} title={`ลบ ${selectedStone.name}`} data-testid={`button-remove-quote-stone-${selectedStone.code}`}><Trash2 size={15} /></button>
  </div>;
}

type FormalQuoteItem = {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  areaSqM?: number | null;
  productUnitPrice?: number | null;
  laborUnitPrice?: number | null;
  workQuantity?: number | null;
  workUnit?: string;
  dimensions?: string;
  cutoutDimensions?: string;
  imageUrl?: string;
  videoUrl?: string;
  notificationKind?: "basin" | "stone" | "service";
};

function formatQuoteDate(date: Date) {
  return formatDate(date);
}

function FormalItemDescription({ item, format }: { item: FormalQuoteItem; format: QuoteFormat }) {
  const description = item.description;
  const detailLines = description.split(" · ").filter(Boolean);
  return <div className={`formal-item-description formal-item-description--${format.toLowerCase()}`}>
    <div className="formal-item-copy">
      <strong className="formal-code">{item.code}</strong>
      <span>{detailLines[0] || "—"}</span>
      {format === "OF" && detailLines.slice(1).map((line, index) => <small key={`${item.code}-${index}`}>{line}</small>)}
    </div>
    {item.imageUrl && <img className="formal-item-image" src={item.imageUrl} alt="" loading="lazy" />}
  </div>;
}

function savedQuotePrintTitle(quoteNumber: string) {
  const safe = quoteNumber.trim().replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "quote";
  return `KF-Basins-Quote-${safe}.pdf`;
}

type QuickQuoteSnapshot = {
  kind: "quick-purchase";
  quoteFormat: QuoteFormat;
  customer: CustomerDetails;
  items: FormalQuoteItem[];
  grossSubtotal: number;
  discountAmount: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  vat: boolean;
  sitePhotos?: string[];
};

const COMPANY_DETAILS = {
  name: "บริษัท ไนท์ เฟอร์นิช จำกัด (สำนักงานใหญ่)",
  taxId: "0-1355-53014-11-4",
  address: "โรงงาน / สำนักงานใหญ่ ปทุมธานี",
  phones: "094-496-1949 · 089-762-2209",
  email: "info@knightfurnich.com",
  bankName: "ธ.กรุงศรีอยุธยา",
  bankBranch: "สาขาปตท. ติวานนท์",
  bankAccountName: "บริษัท ไนท์ เฟอร์นิช จำกัด",
  bankAccountNumber: "574-1-18925-4",
  salesRepresentative: "คุณอุไรวรรณ สังข์อารียกุล (นิด)",
  salesPhone: "091-978-2292",
};

const QUOTE_PRODUCT_DETAILS = [
  "หินสังเคราะห์คุณภาพสูง Acrylic Solid Surface 100% รับประกันสีไม่เปลี่ยน (ขนาด 0.76 ม. X 3.60 ม.)",
  "งานที่มีลักษณะโค้ง หรือเหลี่ยมเพชร จะใช้หินมากกว่างานที่มีลักษณะตรง (คิดพื้นที่ตามแผ่นตัด)",
  "หินสังเคราะห์ลายสายแร่ จะมองเห็นลายที่ไม่ต่อเนื่องกันได้ (คิดพื้นที่ตามแผ่นตัด)",
  "หินสังเคราะห์โทนสีเข้ม สีดำ เป็นรอย ขีด ข่วน ได้ง่ายต้องระวังการใช้งานเป็นพิเศษ",
  "สินค้า ในแต่ละสี มีการจำหน่ายทุกวัน กรุณาตรวจสอบสินค้าก่อนทำการสั่งซื้อทุกครั้ง",
  "ใบเสนอราคาระบุเงื่อนไขการชำระเงิน กรุณาตรวจสอบก่อนทำการสั่งซื้อ",
  "กำหนดรับสินค้า ( จันทร์-ศุกร์ เวลา 08.30-16.30) , ( เสาร์ 08.30-11.30)",
] as const;

const QUOTE_NOTE_DETAILS = [
  "กรุณาตรวจสอบเงื่อนไขให้ชัดเจนก่อนทำการสั่งซื้อและชำระเงิน",
  "สำหรับงานช่วงเวลากลางคืน (20.00 น. - 05.00 น.) คิดค่าดำเนินการเพิ่มต่างหาก 5,000 บาท/คืน",
  "งานในกรุงเทพฯและปริมณฑล งานจัดส่งและติดตั้ง พื้นที่น้อยกว่า 5 ตรม. (กรณีลูกค้ารับสินค้าเองไม่คิดค่าดำเนินการ) คิดค่าดำเนินการ 5,000 บาท",
  "พื้นที่น้อยติดตั้งขั้นต่ำ คิดเหมาที่ 1 ตรม. (กทม)",
  "งานต่างจังหวัด งานจัดส่งและติดตั้ง พื้นที่น้อยกว่า 10 ตรม. คิดค่าดำเนินการ 8,000 บาท",
  "พื้นที่น้อยติดตั้งขั้นต่ำ คิดเหมาที่ 3 ตรม. (ตจว.)",
  "ในกรณีงานต่างจังหวัด ทางบริษัทขอรับชำระค่าเดินทาง และเบี้ยเลี้ยงก่อนวันไปติดตั้งล่วงหน้าอย่างน้อย 1 วัน",
  "ในกรณีใบเสนอราคาคำนวณเบื้องต้นจากแบบ และมีขนาดเปลี่ยนแปลงจากหน้างาน ทางบริษัทจะแจ้งให้ทราบภายหลังจากที่ช่างได้ทำการเข้าวัดพื้นที่ 1-3 วัน",
  "50% เมื่อเซ็นต์อนุมัติสั่งซื้อ / ก่อนวัดพื้นที่ / ก่อนผลิตงาน",
  "50% ก่อนเข้าติดตั้งงานอย่างน้อย 2 วันทำการ",
  "ยอดสั่งซื้อสินค้าไม่เกิน 40,000 บาท ชำระ 100%",
  "การซื้อขายจะสมบูรณ์ต่อเมื่อผู้ซื้อ ได้ชำระเงินต่อผู้ขายครบถ้วนแล้ว มิฉะนั้นให้ถือว่ากรรมสิทธิ์ ในสินค้าที่ขายยังเป็นของผู้ขายโดยชอบธรรม",
] as const;

function formatQuoteMetric(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

function FormalQuote({
  format,
  quoteNumber,
  issueDate,
  expiryDate,
  customer,
  items,
  grossSubtotal,
  discountAmount,
  subtotal,
  vatAmount,
  total,
  vat,
}: {
  format: QuoteFormat;
  quoteNumber: string;
  issueDate: Date;
  expiryDate: Date;
  customer: CustomerDetails;
  items: FormalQuoteItem[];
  grossSubtotal: number;
  discountAmount: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  vat: boolean;
}) {
  return <section className={`formal-quote-sheet formal-quote-sheet--${format.toLowerCase()}`} data-testid="formal-quote-sheet">
    <header className="formal-quote-header">
      <div className="formal-document-label"><strong>ใบเสนอราคา</strong><span>(Quotation)</span><small>{format} · {format === "US" ? "สรุปตามพื้นที่ / แผ่น" : "รายละเอียดตามห้อง / จุดติดตั้ง"}</small></div>
      <div className="formal-company">
        <div>
          <h2>{COMPANY_DETAILS.name}</h2>
          <p>เลขประจำตัวผู้เสียภาษี {COMPANY_DETAILS.taxId}</p>
          <p>{COMPANY_DETAILS.address} · {COMPANY_DETAILS.phones}</p>
          <p>{COMPANY_DETAILS.email}</p>
        </div>
        <img src={knightFurnichLogo} alt="Knight Furnich" className="formal-company-logo" />
      </div>
      <div className="formal-quote-meta">
        <p className="eyebrow">ใบเสนอราคาอย่างเป็นทางการ / {format}</p>
        <strong>{quoteNumber}</strong>
        <span>ยืนราคา 30 วัน · ถึง {formatQuoteDate(expiryDate)}</span>
      </div>
    </header>

    <div className="formal-quote-title">
      <div>
        <p className="eyebrow">ใบเสนอราคาอย่างเป็นทางการ</p>
        <h1>{format === "US" ? "ใบเสนอราคา / สรุปตามพื้นที่" : "ใบเสนอราคา / รายละเอียดหน้างาน"}</h1>
      </div>
      <span className="formal-format-chip">{format === "US" ? "สรุปตามพื้นที่ / แผ่น" : "รายละเอียดตามห้อง / จุดติดตั้ง"}</span>
    </div>

    <div className="formal-customer-grid">
      <div className="formal-customer-wide"><span>ลูกค้า</span><strong>{customer.company || customer.taxName || customer.name || "—"}</strong></div>
      <div><span>ผู้ติดต่อ</span><strong>{customer.name || "—"}</strong></div>
      <div><span>โทรศัพท์</span><strong>{customer.phone || "—"}</strong></div>
      <div className="formal-customer-wide"><span>โครงการ / สถานที่ติดตั้ง</span><strong>{customer.project || customer.site || "—"}</strong></div>
      <div><span>เลขประจำตัวผู้เสียภาษี</span><strong>{customer.taxId || "—"}</strong></div>
      <div><span>สาขา</span><strong>{customer.taxBranch || "สำนักงานใหญ่"}</strong></div>
      <div className="formal-customer-wide"><span>ที่อยู่</span><strong>{customer.address || customer.taxAddress || "—"}</strong></div>
      <div><span>อีเมล</span><strong>{customer.email || "—"}</strong></div>
      <div><span>ฝ่ายบัญชี</span><strong>{customer.purchasingDepartment || "—"}</strong></div>
    </div>

    <div className="formal-quote-table-wrap">
     <table className={`formal-quote-table formal-quote-table--${format.toLowerCase()}`} data-testid="formal-quote-table">
       <thead>{format === "US" ? <tr><th className="formal-index-column">ลำดับ</th><th className="formal-description-cell">รายละเอียดสินค้า</th><th className="formal-qr-column"><QrCode size={14} /> 3D</th><th className="formal-us-area-column">พื้นที่งาน (ตร.ม.)</th><th className="formal-us-price-column">ค่าสินค้า / ตร.ม.</th><th className="formal-us-labor-column">ค่าแรง / ตร.ม.</th><th className="formal-us-quantity-column">จำนวนงาน</th><th className="formal-total-column">จำนวนเงิน (บาท)</th></tr> : <tr><th className="formal-index-column">ลำดับ</th><th className="formal-description-cell">รายละเอียดงาน</th><th className="formal-qr-column"><QrCode size={14} /> 3D</th><th className="formal-of-qty-column">จำนวน</th><th className="formal-of-unit-column">หน่วย</th><th className="formal-of-price-column">ราคาต่อหน่วย</th><th className="formal-total-column">จำนวนเงิน (บาท)</th></tr>}</thead>
       <tbody>{items.map((item, index) => <tr key={`${item.code}-${item.unit}`}>
        <td className="formal-index-column">{index + 1}</td>
        <td className="formal-description-cell"><FormalItemDescription item={item} format={format} /></td>
        <td className="formal-qr-column">{item.videoUrl && <a href={item.videoUrl} target="_blank" rel="noreferrer"><img src={quoteQrImageUrl(item.videoUrl)} alt={`QR วิดีโอ ${item.code}`} /><small>สแกนดู 3D</small></a>}</td>
         {format === "US" ? <>
            <td className="formal-number formal-us-area-column">{formatQuoteMetric(item.areaSqM)}</td>
           <td className="formal-money formal-us-price-column">{item.productUnitPrice === null || item.productUnitPrice === undefined ? "—" : formatTHB(item.productUnitPrice)}</td>
           <td className="formal-money formal-us-labor-column">{item.laborUnitPrice === null || item.laborUnitPrice === undefined ? "—" : formatTHB(item.laborUnitPrice)}</td>
            <td className="formal-number formal-us-quantity-column">{formatQuoteMetric(item.workQuantity ?? item.quantity)} {item.workUnit ? <small>{item.workUnit}</small> : null}</td>
           <td className="formal-money formal-total-column">{formatTHB(item.total)}</td>
         </> : <>
            <td className="formal-number formal-of-qty-column">{formatQuoteMetric(item.quantity)}</td>
            <td className="formal-of-unit-column">{item.unit}</td>
           <td className="formal-money formal-of-price-column">{formatTHB(item.unitPrice)}</td>
           <td className="formal-money formal-total-column">{formatTHB(item.total)}</td>
         </>}
      </tr>)}</tbody>
    </table>
    </div>

    <div className={`formal-quote-bottom formal-quote-bottom--${format.toLowerCase()}`}>
      <div className="formal-notes formal-notes-container">
        <div className="formal-notes-col">
          <h3>รายละเอียดสินค้า</h3>
          {QUOTE_PRODUCT_DETAILS.map((line, index) => <p key={`product-${index}`}>• {line}</p>)}
          {customer.notes && <p className="formal-customer-note">• <strong>หมายเหตุลูกค้า:</strong> {customer.notes}</p>}
        </div>
        <div className="formal-notes-col">
          <h3 className="formal-notes-subheading">หมายเหตุและเงื่อนไข</h3>
          {QUOTE_NOTE_DETAILS.map((line, index) => <p key={`note-${index}`}>• {line}</p>)}
        </div>
      </div>
      <div className="formal-summary-sidebar">
        <div className="formal-totals">
          <div><span>รวมก่อนส่วนลด</span><strong>{formatTHB(grossSubtotal)}</strong></div>
          <div><span>ส่วนลด / สิทธิ์ติดตั้งฟรี</span><strong>{discountAmount ? `-${formatTHB(discountAmount)}` : "—"}</strong></div>
          <div><span>รวมหลังส่วนลด</span><strong>{formatTHB(subtotal)}</strong></div>
          <div><span>ภาษีมูลค่าเพิ่ม 7% {vat ? "" : "(ยังไม่คิด)"}</span><strong>{formatTHB(vatAmount)}</strong></div>
          <div className="formal-grand-total"><span>จำนวนเงินสุทธิ</span><strong>{formatTHB(total)}</strong><small>{thaiNumberText(total)}</small></div>
        </div>
        <div className="formal-bank-details">
          <strong>บัญชีรับเงิน</strong>
          <span>{COMPANY_DETAILS.bankName} {COMPANY_DETAILS.bankBranch}</span>
          <span>{COMPANY_DETAILS.bankAccountName}</span>
          <span>{COMPANY_DETAILS.bankAccountNumber}</span>
        </div>
      </div>
    </div>
      <footer className="formal-quote-signature"><span>ผู้เสนอราคา<br /><b>{COMPANY_DETAILS.salesRepresentative}</b><small>{COMPANY_DETAILS.salesPhone}</small></span><span className="formal-signature-block">ผู้มีอำนาจอนุมัติสั่งซื้อ / ลูกค้า<span className="formal-signature-line" /><b>ลงชื่อ / ประทับตราบริษัท (ถ้ามี)</b></span></footer>
  </section>;
}

type SavedStudioPayload = {
  kind: "studio";
  state: StudioState;
  estimate: StudioEstimate;
  notification?: StudioNotificationSnapshot;
};

type SavedQuotePayload = SavedStudioPayload | QuickQuoteSnapshot;

function readSavedQuotePayload(value: unknown): SavedQuotePayload | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.kind === "quick-purchase" && Array.isArray(record.items) && record.customer && typeof record.customer === "object") {
    return record as unknown as QuickQuoteSnapshot;
  }
  if (!record.state || typeof record.state !== "object" || !record.estimate || typeof record.estimate !== "object") return null;
  return {
    kind: "studio",
    state: record.state as StudioState,
    estimate: record.estimate as StudioEstimate,
    notification: record.notification as StudioNotificationSnapshot | undefined,
  };
}

function StudioLayoutSnapshot({ state, quoteNumber }: { state: StudioState; quoteNumber: string }) {
  const pieces = studioPieces(state);
  const formatPlacementCoordinate = (value: number) => Math.round(value).toLocaleString("th-TH");
  const exportReady = studioExportDimensionsValid(state);
  const exportFile = async (format: "dxf" | "pdf" | "png") => {
    if (format === "dxf") await downloadStudioDxf(state, quoteNumber || "studio-layout");
    else if (format === "png") await downloadStudioPng(state, quoteNumber || "studio-layout", stoneColorByName(state.activeStone).tone);
    else printStudioLayout(studioPrintTitle(quoteNumber || "studio-layout", pieces.length));
  };
  return <section className="studio-saved-layout studio-print-layout" data-testid="saved-studio-layout">
    <div className="studio-saved-layout-heading">
       <div><p className="eyebrow">แบบสตูดิโอ 2D ที่บันทึกไว้</p><h2>แบบที่บันทึกไว้</h2></div>
        <span>{pieces.length} ชิ้นงาน · {pieces.reduce((sum, piece) => sum + piece.rectangles.length, 0)} แผ่น</span>
    </div>
    <div className="studio-saved-layout-meta">
       <span>หินที่ใช้คำนวณ: <strong>{stoneColorByName(state.activeStone).name} ({state.activeStone})</strong></span>
       <span>{state.backsplash.enabled ? `กันน้ำสูง ${state.backsplash.heightMm} มม.` : "ไม่มีกันน้ำ"}</span>
       <span>{state.location === "bangkok-metro" ? "กรุงเทพฯ / ปริมณฑล" : "ต่างจังหวัด"}</span>
    </div>
    <div className="studio-saved-piece-list">{pieces.map((piece) => {
      const bounds = pieceBounds(piece);
      const placements = state.basinPlacements.filter((placement) => (placement.pieceId ?? pieces[0]?.id) === piece.id);
       return <div className="studio-saved-piece" key={piece.id}><h3>{piece.name}</h3><StudioFootprint piece={piece} stoneTone={stoneColorByName(state.activeStone).tone} className="studio-canvas--saved" testId={`saved-studio-canvas-${piece.id}`} ariaLabel={`ผัง ${piece.name} ที่บันทึกไว้`}>
        {placements.map((placement) => {
          const unknown = placement.widthMm === null || placement.depthMm === null;
           return <div key={placement.id} className={`studio-placement ${unknown ? "studio-placement--unknown" : ""}`} style={{ left: `${(placement.xMm / Math.max(1, bounds.widthMm)) * 100}%`, top: `${(placement.yMm / Math.max(1, bounds.heightMm)) * 100}%`, width: unknown ? "18%" : `${((placement.widthMm ?? 0) / Math.max(1, bounds.widthMm)) * 100}%`, height: unknown ? "18%" : `${((placement.depthMm ?? 0) / Math.max(1, bounds.heightMm)) * 100}%` }}><strong>{placement.sku}</strong><small>{unknown ? "ขนาดหลุมไม่ระบุ" : `${formatPlacementCoordinate(placement.xMm)}, ${formatPlacementCoordinate(placement.yMm)} มม.`}</small></div>;
        })}
         {!placements.length && <span className="studio-canvas-empty">ไม่มีตำแหน่งอ่างที่บันทึกไว้</span>}
      </StudioFootprint></div>;
    })}</div>
    <div className="studio-saved-layout-actions"><button type="button" className="button button--outline" disabled={!exportReady} onClick={() => void exportFile("dxf")} data-testid="button-download-saved-studio-dxf"><Download size={15} /> ดาวน์โหลดแบบ (DXF)</button><button type="button" className="button button--outline" disabled={!exportReady} onClick={() => void exportFile("pdf")} data-testid="button-download-saved-studio-pdf"><Download size={15} /> ดาวน์โหลดแบบ (PDF)</button><button type="button" className="button button--outline" disabled={!exportReady} onClick={() => void exportFile("png")} data-testid="button-download-studio-png"><Download size={15} /> ดาวน์โหลดภาพ (PNG)</button></div>
    <p className="studio-saved-layout-note">ตำแหน่งอ่างเป็นแบบอ่านอย่างเดียวที่บันทึกพร้อมใบเสนอราคา ไม่สามารถแก้ไขจากลิงก์นี้ได้</p>
    <p className="studio-print-warning">{STUDIO_PRINT_NOTE}</p>
  </section>;
}

function PaymentSlipUpload({ publicQuoteToken }: { publicQuoteToken: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ status: "verified" | "needs_review" | "rejected"; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    form.append("token", publicQuoteToken);
    form.append("kind", "deposit");
    try {
      const response = await fetch("/api/leads/payment-slip", { method: "POST", body: form });
      const payload = await response.json() as { status?: "pending" | "verified" | "needs_review" | "rejected"; verifiedAmountThb?: number | null; senderName?: string | null; message?: string };
      if (!response.ok) throw new Error(payload.message || "ตรวจสอบสลิปไม่สำเร็จ");
      setResult(
        payload.status === "verified"
          ? { status: "verified", message: `ตรวจสอบแล้วค่ะ เงินโอน ${payload.verifiedAmountThb?.toLocaleString("th-TH") ?? "-"} บาท จาก ${payload.senderName ?? "-"} เข้าเรียบร้อย` }
          : payload.status === "needs_review"
            ? { status: "needs_review", message: "ได้รับรูปที่แนบมาแล้วค่ะ แต่ระบบตรวจสอบอัตโนมัติหาข้อมูลยืนยันการโอนในรูปนี้ไม่เจอ ถ้าเป็นรูปสลิปโอนเงินจริง ทีมงานจะเปิดดูและยืนยันให้อีกครั้งค่ะ แต่ถ้าไม่ใช่รูปสลิปโอนเงิน รบกวนแนบรูปสลิปที่ถูกต้องมาใหม่อีกครั้งนะคะ" }
            : { status: "rejected", message: "ตรวจสอบสลิปแล้วยังไม่ผ่านค่ะ (ยอดเงินหรือข้อมูลอาจไม่ตรงกัน) ทีมขายจะติดต่อกลับเพื่อตรวจสอบให้อีกครั้งนะคะ" },
      );
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (error) {
      setResult({ status: "rejected", message: error instanceof Error ? error.message : "อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่" });
    } finally {
      setUploading(false);
    }
  };

  return <div className="saved-quote-payment" data-testid="section-payment-slip-upload">
    <div className="saved-quote-payment-heading">
      <Upload size={16} />
      <div>
        <strong>อัปโหลดสลิปโอนเงินมัดจำ</strong>
        <p>ระบบตรวจสอบสลิปอัตโนมัติผ่าน SlipOK — อัปโหลดสลิปหลังโอนมัดจำ 50% เพื่อให้ทีมขายยืนยันได้ทันที</p>
      </div>
    </div>
    <div className="saved-quote-payment-controls">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setFile(event.target.files?.[0] ?? null)} data-testid="input-payment-slip-file" />
      <button type="button" className="button button--accent" onClick={upload} disabled={!file || uploading} data-testid="button-upload-payment-slip">
        {uploading ? "กำลังตรวจสอบ..." : "อัปโหลดและตรวจสอบสลิป"}
      </button>
    </div>
    {result && <p className={`saved-quote-payment-result ${result.status === "verified" ? "is-verified" : result.status === "needs_review" ? "is-review" : "is-rejected"}`} role="status" data-testid="status-payment-slip-result">
      {result.status === "verified" ? <CheckCircle2 size={15} /> : result.status === "needs_review" ? <Clock size={15} /> : <AlertTriangle size={15} />} {result.message}
    </p>}
  </div>;
}

function SavedQuotePage() {
  const [location, setLocation] = useLocation();
  const publicQuoteToken = new URLSearchParams(window.location.search).get("token") ?? "";
  const { data: lead, isLoading, error } = useGetSavedQuote(
    { token: publicQuoteToken },
    { query: { enabled: Boolean(publicQuoteToken), retry: false, queryKey: ["saved-quote", publicQuoteToken] } },
  );
  const [copied, setCopied] = useState(false);
  const [savedSheetMode, setSavedSheetMode] = useState<"formal" | "workshop">("formal");
  const notifyMutation = useNotifySavedQuote();
  const [notificationMessage, setNotificationMessage] = useState(() => new URLSearchParams(window.location.search).get("notification") ?? "");
  const shouldPrint = new URLSearchParams(window.location.search).get("print") === "1";
  useEffect(() => {
    if (!shouldPrint || !lead) return;
    const timer = window.setTimeout(() => window.print(), 500);
    return () => window.clearTimeout(timer);
  }, [shouldPrint, lead?.quoteNumber]);

  if (!publicQuoteToken) {
    return <div className="page-wrap empty-state"><span className="empty-number">—</span><h3>ไม่พบลิงก์ใบเสนอราคา</h3><p>ต้องใช้ลิงก์สาธารณะที่ลงลายมือชื่อแล้วเพื่อเปิดเอกสารนี้</p><Link href="/quote" className="text-link">กลับไปสร้างใบเสนอราคา <ArrowRight size={15} /></Link></div>;
  }
  if (isLoading) {
    return <div className="page-wrap empty-state" data-testid="status-saved-quote-loading"><span className="empty-number">…</span><h3>กำลังเปิดใบเสนอราคา</h3><p>กำลังโหลดแบบและตัวเลขที่บันทึกไว้</p></div>;
  }
  if (error || !lead) {
    return <div className="page-wrap empty-state" data-testid="status-saved-quote-error"><span className="empty-number">404</span><h3>ไม่พบใบเสนอราคานี้</h3><p>ลิงก์อาจไม่ถูกต้อง หรือเอกสารยังไม่ได้บันทึก</p><Link href="/" className="text-link">กลับไปแคตตาล็อก <ArrowRight size={15} /></Link></div>;
  }
  const saved = readSavedQuotePayload(lead.studioData);
  if (!saved) {
    return <div className="page-wrap empty-state" data-testid="status-saved-quote-invalid"><span className="empty-number">—</span><h3>เอกสารนี้ไม่มี snapshot ที่บันทึกไว้</h3><Link href="/" className="text-link">กลับไปแคตตาล็อก <ArrowRight size={15} /></Link></div>;
  }
  const legacySitePhotos = (() => {
    if (!lead.studioData || typeof lead.studioData !== "object") return [];
    const photos = (lead.studioData as Record<string, unknown>).sitePhotos;
    return Array.isArray(photos)
      ? photos.filter((photo): photo is string => typeof photo === "string" && photo.length > 0)
      : [];
  })();
  const savedSitePhotos = saved.kind === "quick-purchase"
    ? (saved.sitePhotos ?? legacySitePhotos)
    : legacySitePhotos;

  const issueDate = new Date(lead.createdAt);
  const expiryDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  let state: StudioState | null = null;
  let customer: CustomerDetails;
  let formalItems: FormalQuoteItem[];
  let format: QuoteFormat;
  let grossSubtotal: number;
  let discountAmount: number;
  let subtotal: number;
  let vatAmount: number;
  let total: number;
  let vat: boolean;
  let lineSummary: string;

  if (saved.kind === "quick-purchase") {
    customer = saved.customer;
    formalItems = saved.items;
    format = saved.quoteFormat;
    grossSubtotal = saved.grossSubtotal;
    discountAmount = saved.discountAmount;
    subtotal = saved.subtotal;
    vatAmount = saved.vatAmount;
    total = saved.total;
    vat = saved.vat;
    lineSummary = `Knight Furnich ใบเสนอราคา ${lead.quoteNumber}\n${saved.customer.project || ""}\nโทร ${saved.customer.phone || "-"} · LINE ${saved.customer.lineContact || "-"} · ${saved.customer.email || "-"}\nยอดรวม ${formatTHB(saved.total)}`;
  } else {
    state = saved.state;
    const estimate = saved.estimate;
    customer = {
      name: lead.name ?? "",
      company: lead.company ?? "",
      taxId: lead.taxId ?? "",
      taxName: lead.taxName ?? "",
      taxBranch: lead.taxBranch ?? "",
      taxAddress: lead.taxAddress ?? "",
      phone: lead.phone ?? "",
      lineContact: lead.lineContact ?? "",
      email: lead.email ?? "",
      purchasingDepartment: "",
      address: lead.address ?? "",
      project: lead.project ?? "",
      site: lead.site ?? "",
      preferredContact: (lead.preferredContact as CustomerDetails["preferredContact"]) ?? "",
      customerRole: (lead.customerRole as CustomerDetails["customerRole"]) ?? "",
      propertyType: (lead.propertyType as CustomerDetails["propertyType"]) ?? "",
      condoFloor: lead.condoFloor ?? "",
      expectedInstallationDate: lead.expectedInstallationDate ?? "",
      notes: lead.notes ?? "",
    };
    const placements = state.basinPlacements.length
      ? state.basinPlacements
      : state.basinSkus.map((sku, index) => ({ sku, id: `${sku}-${index}`, xMm: 70, yMm: 70, ...(() => {
        const product = productBySku(sku);
        return product ? { widthMm: product.basinDimensions ? Number(product.basinDimensions.match(/\d+/)?.[0] ?? 0) || null : null, depthMm: product.basinDimensions ? Number(product.basinDimensions.match(/\d+/g)?.[1] ?? 0) || null : null } : { widthMm: null, depthMm: null };
      })() }));
    const basinCounts = new Map<string, number>();
    placements.forEach((placement) => basinCounts.set(placement.sku, (basinCounts.get(placement.sku) ?? 0) + 1));
    formalItems = [];
    basinCounts.forEach((quantity, sku) => {
      const product = productBySku(sku);
      if (!product) return;
      formalItems.push({
        code: product.sku,
        description: `${product.colorName} · ${product.category === "counter basin" ? "อ่างวางเคาน์เตอร์" : "อ่างตั้งพื้น"} · ${product.dimensions}${product.basinDimensions ? ` · หลุม ${product.basinDimensions}` : ""}`,
        quantity,
        unit: "ใบ",
        unitPrice: product.priceTHB,
        total: product.priceTHB * quantity,
          workQuantity: quantity,
          workUnit: "ชุด",
        dimensions: product.dimensions,
        cutoutDimensions: product.basinDimensions,
        imageUrl: product.quoteImageUrl,
        videoUrl: product.videoUrl,
          notificationKind: "basin",
      });
    });
    const requestedInstallation = placements.length * INSTALLATION_PRICE;
     if (requestedInstallation > 0) formalItems.push({ code: "INSTALL", description: "ค่าติดตั้ง / ค่าแรงต่อชุด", quantity: placements.length, unit: "ชุด", unitPrice: INSTALLATION_PRICE, total: requestedInstallation, notificationKind: "service" });
     if (estimate.stoneUnitPriceTHB !== null) {
       const activeStone = stoneColorByName(state.activeStone);
       const materialUnitPrice = activeStone.sheetPriceTHB;
       formalItems.push({
         code: activeStone.code,
         description: `${activeStone.name} · พื้นที่แผ่นรวมตามแบบ`,
         quantity: estimate.counterAreaSqM ?? estimate.stoneAreaSqM,
         unit: "ตร.ม.",
         unitPrice: estimate.stoneUnitPriceTHB,
         total: Math.max(0, (estimate.stoneTotalTHB ?? 0) - (estimate.upstandTotalTHB ?? 0)),
          areaSqM: estimate.counterAreaSqM ?? estimate.stoneAreaSqM,
          productUnitPrice: materialUnitPrice,
          laborUnitPrice: materialUnitPrice === null ? null : Math.max(0, estimate.stoneUnitPriceTHB - materialUnitPrice),
          workQuantity: estimate.counterAreaSqM ?? estimate.stoneAreaSqM,
          workUnit: "ตร.ม.",
         notificationKind: "stone",
       });
       if ((estimate.upstandLengthM ?? 0) > 0) {
         formalItems.push({
           code: "UPSTAND",
           description: `บัว ${estimate.upstandLengthM.toFixed(2)} ม. · สูง ${state.upstandHeightMm ?? "ไม่ระบุ"} มม.`,
           quantity: estimate.upstandLengthM,
           unit: "ม.",
           unitPrice: estimate.upstandTotalTHB && estimate.upstandLengthM ? estimate.upstandTotalTHB / estimate.upstandLengthM : 0,
           total: estimate.upstandTotalTHB ?? 0,
            workQuantity: estimate.upstandLengthM,
            workUnit: "ม.",
           notificationKind: "service",
         });
       }
     }
     if ((estimate.openEdgeLengthM ?? 0) > 0) {
       formalItems.push({
         code: "OPEN-EDGE",
         description: `ขอบเปิด ${estimate.openEdgeLengthM.toFixed(2)} ม. · ${estimate.openEdgeUnitPriceTHB === 0 ? "ฟรี" : estimate.openEdgeUnitPriceTHB === null ? "รอทีมขายกรอกราคา" : "ราคาต่อเมตร"}`,
         quantity: estimate.openEdgeLengthM,
         unit: "ม.",
         unitPrice: estimate.openEdgeUnitPriceTHB ?? 0,
         total: estimate.openEdgeTotalTHB ?? 0,
          workQuantity: estimate.openEdgeLengthM,
          workUnit: "ม.",
         notificationKind: "service",
       });
     }
      if (estimate.smallJobFeeTHB > 0) formalItems.push({ code: "SMALL-JOB", description: "ค่าดำเนินการงานพื้นที่เล็ก", quantity: 1, unit: "งาน", unitPrice: estimate.smallJobFeeTHB, total: estimate.smallJobFeeTHB, workQuantity: 1, workUnit: "งาน", notificationKind: "service" });
     if (saved.notification) {
       formalItems = saved.notification.items.filter((item) => item.code !== "WORKPIECES").map((item) => ({
         code: item.code,
         description: item.description,
         quantity: item.quantity,
         unit: item.unit,
         unitPrice: item.unitPriceTHB ?? 0,
         total: item.totalTHB ?? Math.round(item.quantity * (item.unitPriceTHB ?? 0)),
          areaSqM: item.areaSqM,
          productUnitPrice: item.productUnitPriceTHB,
          laborUnitPrice: item.laborUnitPriceTHB,
          workQuantity: item.workQuantity,
          workUnit: item.workUnit,
          dimensions: item.dimensions,
          cutoutDimensions: item.cutoutDimensions,
         notificationKind: item.kind,
       }));
     }
    format = state.quoteFormat ?? "US";
     subtotal = saved.notification?.subtotal ?? estimate.subtotalTHB ?? estimate.totalTHB;
      discountAmount = saved.notification?.discountAmount ?? (estimate.installationDiscountTHB ?? 0) + (estimate.discountTHB ?? 0);
      grossSubtotal = saved.notification?.grossSubtotal ?? estimate.grossSubtotalTHB ?? subtotal + discountAmount;
     vatAmount = saved.notification?.vatAmount ?? estimate.vatAmountTHB ?? 0;
     total = saved.notification?.total ?? estimate.totalTHB;
     vat = saved.notification?.vat ?? Boolean(state.vat);
     lineSummary = `Knight Furnich ใบเสนอราคา ${lead.quoteNumber}\n${lead.project ?? ""}\nชิ้นงาน ${estimate.pieceCount ?? 1} ชิ้น · บัว ${estimate.upstandLengthM?.toFixed(2) ?? "0.00"} ม. · ขอบ ${estimate.openEdgeLengthM?.toFixed(2) ?? "0.00"} ม.\nยอดรวม ${formatTHB(estimate.totalTHB)}`;
  }
  const savedQuoteNumber = lead.quoteNumber ?? "saved-quote";
  const printSavedQuote = () => {
    setSavedSheetMode("formal");
    const previousTitle = document.title;
    document.body.classList.remove("print-workshop");
    const cleanup = () => {
      document.title = previousTitle;
    };
    document.title = savedQuotePrintTitle(savedQuoteNumber);
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1000);
  };
  const printSavedWorkshop = () => {
    setSavedSheetMode("workshop");
    const previousTitle = document.title;
    document.body.classList.add("print-workshop");
    const cleanup = () => {
      document.title = previousTitle;
      document.body.classList.remove("print-workshop");
    };
    document.title = `KF-Basins-JobOrder-${savedQuoteNumber.replace(/[^\p{L}\p{N}._-]+/gu, "-")}.pdf`;
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1000);
  };
  const copyLink = async () => {
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const sendNotification = async () => {
    setNotificationMessage("กำลังส่งแจ้งเตือน...");
    try {
      const result = await notifyMutation.mutateAsync({ data: { token: publicQuoteToken } });
      setNotificationMessage(result.message);
    } catch (error) {
      setNotificationMessage(error instanceof Error ? error.message : "บันทึกแล้ว แต่ส่งแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่");
    }
  };
  const copySavedStudioToEditor = () => {
    if (!state) return;
    const url = new URL(createStudioShareLink(state));
    setLocation(`${url.pathname}${url.search}`);
  };

  return <div className="page-wrap quote-page saved-quote-page" data-testid="saved-quote-page">
    <section className="quote-heading saved-quote-heading">
      <div><p className="eyebrow accent">SAVED QUOTATION / {lead.quoteNumber}</p><h1>ใบเสนอราคา<br /><em>พร้อมแบบที่บันทึกไว้</em></h1><p className="hero-copy">เอกสารนี้เปิดดูได้จากลิงก์เดิม และข้อมูลในแบบเป็น read-only</p></div>
       <div className="quote-date"><span>วันที่ออกเอกสาร</span><strong>{formatQuoteDate(issueDate)}</strong><small>ใช้ได้ถึง {formatQuoteDate(expiryDate)} · 30 วัน</small><button onClick={printSavedQuote} data-testid="button-print-saved-quote"><Printer size={15} /> พิมพ์ใบเสนอราคา</button><button onClick={printSavedWorkshop} className="button--secondary" style={{ marginLeft: 6 }} data-testid="button-print-saved-workshop"><Wrench size={15} /> พิมพ์ใบสั่งผลิตช่าง</button></div>
    </section>
    <div className="saved-quote-next-steps" role="status" data-testid="status-saved-quote-next-steps">
      <Check size={16} />
      <div>
        <strong>ส่งใบเสนอราคาเรียบร้อยแล้ว</strong>
        <p>ทีมขาย Knight Furnich จะติดต่อกลับภายใน 24 ชั่วโมงทำการ{customer.preferredContact ? ` ผ่านทาง${CUSTOMER_CONTACT_OPTIONS.find((option) => option.value === customer.preferredContact)?.label ?? "ช่องทางที่คุณระบุไว้"}` : ""} · เก็บลิงก์นี้ไว้เพื่อเปิดดูแบบและราคาอีกครั้งได้ตลอด</p>
      </div>
    </div>
    <div className="quote-editor saved-quote-editor">
    <div className="saved-quote-actions">
      <button className="button button--dark" onClick={copyLink} data-testid="button-copy-saved-quote-link">{copied ? <><Check size={15} /> คัดลอกลิงก์แล้ว</> : "คัดลอกลิงก์ใบเสนอราคา"}</button>
       {state && <button className="button button--accent" onClick={copySavedStudioToEditor} data-testid="button-copy-saved-studio-to-editor"><Copy size={15} /> คัดลอกผังนี้ไปปรับแต่งใหม่</button>}
      <button className="button button--accent" onClick={sendNotification} disabled={notifyMutation.isPending} data-testid="button-send-saved-quote-notification">{notifyMutation.isPending ? "กำลังส่ง..." : "ส่งเข้า Telegram"}</button>
      <button className="button button--outline" onClick={() => setLocation("/")} data-testid="button-saved-quote-home">กลับไปแคตตาล็อก</button>
    </div>
    {notificationMessage && <p className="studio-result" role="status" data-testid="status-saved-quote-notification">{notificationMessage}</p>}
    </div>
    <PaymentSlipUpload publicQuoteToken={publicQuoteToken} />
    <div className="saved-quote-support" data-testid="section-after-sales-contact">
      <Phone size={16} />
      <div>
        <strong>ติดต่อหลังการขาย</strong>
        <p>โทร 094-496-1949 หรือ LINE Official</p>
        <p className="saved-quote-support-hours"><Clock size={13} /> จันทร์-ศุกร์ 08:00–17:00 · เสาร์ 08:00–12:00</p>
      </div>
    </div>
    {state && <StudioLayoutSnapshot state={state} quoteNumber={savedQuoteNumber} />}
    <div className="quote-sheet-type-switch" role="tablist">
      <button
        type="button"
        className={savedSheetMode === "formal" ? "is-active" : ""}
        onClick={() => setSavedSheetMode("formal")}
        data-testid="button-saved-sheet-mode-formal"
      >
        <FileText size={15} /> ดูใบเสนอราคา (ลูกค้า)
      </button>
      <button
        type="button"
        className={savedSheetMode === "workshop" ? "is-active" : ""}
        onClick={() => setSavedSheetMode("workshop")}
        data-testid="button-saved-sheet-mode-workshop"
      >
        <Wrench size={15} /> ดูใบสั่งผลิต (โรงงาน/ช่าง)
      </button>
    </div>
    {savedSheetMode === "formal" ? (
      <FormalQuote format={format} quoteNumber={savedQuoteNumber} issueDate={issueDate} expiryDate={expiryDate} customer={customer} items={formalItems} grossSubtotal={grossSubtotal} discountAmount={discountAmount} subtotal={subtotal} vatAmount={vatAmount} total={total} vat={vat} />
    ) : (
      <WorkshopProductionSheet quoteNumber={savedQuoteNumber} issueDate={issueDate} customer={customer} items={formalItems as ProductionItem[]} sitePhotos={savedSitePhotos} />
    )}
    {savedSheetMode === "formal" && <div className="source-note">แบบและราคา snapshot จากวันที่สร้างเอกสาร · {lineSummary}</div>}
  </div>;
}

function QuotePage({ cart, setCart, stones, setStones, stoneColors, customer, setCustomer, vat, setVat, onSubmitQuote }: { cart: QuoteBasinLine[]; setCart: Dispatch<SetStateAction<QuoteBasinLine[]>>; stones: StoneConfig[]; setStones: Dispatch<SetStateAction<StoneConfig[]>>; stoneColors: ReadonlyArray<StoneColor>; customer: CustomerDetails; setCustomer: Dispatch<SetStateAction<CustomerDetails>>; vat: boolean; setVat: Dispatch<SetStateAction<boolean>>; onSubmitQuote: (snapshot: QuickQuoteSnapshot, notify?: boolean, worksitePlaceId?: string | null) => Promise<void> }) {
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [historyNotice, setHistoryNotice] = useState("");
  const [worksitePlaceId, setWorksitePlaceId] = useState<string | null>(null);
  const [sitePhotos, setSitePhotos] = useStored<string[]>("knight-site-photos", []);
  const [sheetMode, setSheetMode] = useState<"formal" | "workshop">("formal");
  const { data: lineAuth } = useGetLineAuthStatus();
  const viewQuoteHistory = () => {
    if (lineAuth?.authenticated) {
      window.location.assign("/profile#quote-history");
      return;
    }
    setHistoryNotice("ต้องเข้าสู่ระบบด้วย LINE ก่อน ถึงจะดูใบเสนอราคาก่อนหน้าได้");
  };
  const [quoteFormat, setQuoteFormat] = useStored<QuoteFormat>("knight-quote-format", "US");
  const [quoteSerial] = useStored("knight-quote-serial", String(Math.floor(1000 + Math.random() * 8999)));
  const issueDate = useMemo(() => new Date(), []);
  const expiryDate = useMemo(() => new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000), [issueDate]);
  const today = thaiDateInputValue(new Date());
  const quoteNumber = `${formatQuoteMonth(issueDate)} / ${quoteFormat} / ${quoteSerial}`;
  const basinSubtotal = cart.reduce((sum, line) => sum + (productBySku(line.sku)?.priceTHB || 0) * line.quantity, 0);
  const basinSets = cart.reduce((sum, line) => sum + line.quantity, 0);
  const requestedInstallationCharge = cart.reduce((sum, line) => sum + (line.installationSelected ? INSTALLATION_PRICE * line.quantity : 0), 0);
  const stoneActive = stones.length > 0;
  const totalStone = stones.reduce((sum, stone) => sum + stoneTotal(stone, stoneColors), 0);
  const { installationDiscount, installationCharge, grossSubtotal, subtotal, vatAmount, total } = calculateFormalQuoteTotals({ basinSubtotal, requestedInstallationCharge, basinSets, stoneTotal: totalStone, vat, vatRate: VAT_RATE });
  const hasInvalidEmail = !isValidEmailAddress(customer.email);
  const hasMissing = false;
  const hasInvalidTaxId = Boolean(customer.taxId && !/^[0-9]{13}$/.test(customer.taxId));
  const hasPastInstallationDate = Boolean(customer.expectedInstallationDate && customer.expectedInstallationDate < today);
  const missingTaxIdForVat = vat && !/^[0-9]{13}$/.test(customer.taxId);
  const hasInvalidStone = stones.some((stone) => isInvalidStone(stone, stoneColors));
  const canGenerate = !hasInvalidEmail && !hasInvalidTaxId && !hasPastInstallationDate && !hasInvalidStone && cart.length > 0;
  const formalItems: FormalQuoteItem[] = cart.map((line) => {
    const product = productBySku(line.sku)!;
    return {
      code: product.sku,
      description: `${product.colorName} · ${product.category === "counter basin" ? "อ่างวางเคาน์เตอร์" : "อ่างตั้งพื้น"} · ${product.dimensions}${product.basinDimensions ? ` · หลุม ${product.basinDimensions}` : ""}${quoteFormat === "OF" ? ` · จุดติดตั้ง ${customer.site || customer.project || "ตามแบบ"}` : ""}`,
      quantity: line.quantity,
      unit: "ชุด",
      unitPrice: product.priceTHB,
      total: product.priceTHB * line.quantity,
       workQuantity: line.quantity,
       workUnit: "ชุด",
      dimensions: product.dimensions,
      cutoutDimensions: product.basinDimensions,
      imageUrl: product.quoteImageUrl,
      videoUrl: product.videoUrl,
      notificationKind: "basin",
    };
  });
    if (requestedInstallationCharge > 0) formalItems.push({ code: "INSTALL", description: quoteFormat === "OF" ? `ค่าติดตั้ง / ค่าแรง แยกรายจุด · ${customer.site || customer.project || "ตามแบบ"}` : "ค่าติดตั้ง / ค่าแรงต่อชุด", quantity: requestedInstallationCharge / INSTALLATION_PRICE, unit: "ชุด", unitPrice: INSTALLATION_PRICE, total: requestedInstallationCharge, laborUnitPrice: INSTALLATION_PRICE, workQuantity: requestedInstallationCharge / INSTALLATION_PRICE, workUnit: "ชุด", notificationKind: "service" });
  stones.forEach((stone) => {
     const selectedStone = stoneColorByName(stone.color, stoneColors);
     const currentStoneUnitPrice = stoneUnitPrice(stone, stoneColors);
     if (currentStoneUnitPrice === null || isInvalidStone(stone, stoneColors)) return;
     const materialUnitPrice = selectedStone.sheetPriceTHB;
     formalItems.push({
      code: selectedStone.code,
      description: `${selectedStone.name} · ${stoneOrderModeLabel(stone.mode)} · ${stone.mode === "whole-sheet" ? "แผ่นมาตรฐาน 760 × 3680 mm" : `พื้นที่ ${stone.widthCm} × ${stone.lengthCm} cm`}`,
      quantity: stone.mode === "whole-sheet" ? stone.quantity : stoneAreaSqM(stone),
      unit: stone.mode === "whole-sheet" ? "แผ่น" : "ตร.ม.",
      unitPrice: currentStoneUnitPrice,
       total: stoneTotal(stone, stoneColors),
       areaSqM: stone.mode === "whole-sheet" ? null : stoneAreaSqM(stone),
       productUnitPrice: materialUnitPrice,
       laborUnitPrice: stone.mode === "whole-sheet" || materialUnitPrice === null ? 0 : Math.max(0, currentStoneUnitPrice - materialUnitPrice),
       workQuantity: stone.mode === "whole-sheet" ? stone.quantity : stoneAreaSqM(stone),
       workUnit: stone.mode === "whole-sheet" ? "แผ่น" : "ตร.ม.",
       notificationKind: "stone",
    });
  });
  const lineSummary = [
    `Knight Furnich ใบเสนอราคา ${quoteNumber}`,
    `รูปแบบ: ${quoteFormat === "US" ? "US / สรุปตามพื้นที่" : "OF / รายละเอียดหน้างาน"}`,
    `ผู้ติดต่อ: ${customer.name} · โครงการ: ${customer.project}`,
    `ประเภทสถานที่: ${customer.propertyType || "-"}${customer.condoFloor ? ` · ชั้น ${customer.condoFloor}` : ""} · วันที่คาดว่าจะติดตั้ง: ${customer.expectedInstallationDate || "-"}`,
    `ใบกำกับภาษี: ${customer.taxName || "-"} · ${customer.taxId || "-"} · ${customer.taxBranch || "-"}`,
    `สินค้า: ${cart.map((line) => `${line.sku} x${line.quantity}`).join(", ") || "-"}`,
    `หินสังเคราะห์: ${stoneActive ? stones.map((stone) => `${stoneColorByName(stone.color).code} · ${stoneOrderModeLabel(stone.mode)} · ${stone.mode === "whole-sheet" ? `${stone.quantity} แผ่น` : `${stoneAreaSqM(stone).toFixed(2)} m²`}`).join(", ") : "ไม่ได้เลือก"}`,
    `ยอดสุทธิประมาณการ: ${formatTHB(total)}`,
    `เอกสารมีอายุ 30 วันนับจากวันที่ออกเอกสาร (${formatDate(expiryDate)})`,
    "ขอให้ทีมงานยืนยันแบบและติดต่อกลับเพื่อสรุปหน้างาน",
  ].join("\n");
  const copyLineSummary = async () => {
    await navigator.clipboard?.writeText(lineSummary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const updateLine = (sku: string, changes: Partial<QuoteBasinLine>) => setCart((lines) => lines.map((line) => line.sku === sku ? { ...line, ...changes } : line).filter((line) => line.quantity > 0));
  const removeStone = (color: string) => setStones((current) => removeStoneSelection(current, color, stoneColors));
  const snapshot: QuickQuoteSnapshot = {
    kind: "quick-purchase",
    quoteFormat,
    customer,
    items: formalItems,
    grossSubtotal,
    discountAmount: installationDiscount,
    subtotal,
    vatAmount,
    total,
    vat,
    sitePhotos,
  };
  const focusQuoteRequirement = () => {
    const targetTestId = !cart.length
      ? "link-add-more"
      : hasInvalidEmail
        ? "input-customer-email"
        : hasInvalidTaxId
          ? "input-customer-taxId"
          : hasPastInstallationDate
            ? "input-customer-expectedInstallationDate"
            : hasInvalidStone
              ? "link-edit-stone"
              : "";
    if (!targetTestId) return;
    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(`[data-testid="${targetTestId}"]`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus();
    }, 0);
  };
  const saveQuote = async (notify = false) => {
    if (!canGenerate) {
      setSubmitted(true);
      focusQuoteRequirement();
      return;
    }
    setSubmitted(true);
    setSaveError("");
    setSaving(true);
    try {
      await onSubmitQuote(snapshot, notify, worksitePlaceId);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "บันทึกใบเสนอราคาไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };
  const generateQuote = () => {
    void saveQuote();
  };
  const printQuote = () => {
    if (!canGenerate) {
      setSubmitted(true);
      focusQuoteRequirement();
      return;
    }
    setSubmitted(true);
    setSheetMode("formal");
    const previousTitle = document.title;
    document.body.classList.remove("print-workshop");
    const cleanup = () => {
      document.title = previousTitle;
    };
    document.title = savedQuotePrintTitle(quoteNumber);
    window.addEventListener("afterprint", cleanup, { once: true });
    void saveQuote();
    window.setTimeout(() => {
      window.print();
      window.setTimeout(cleanup, 1000);
    }, 80);
  };
  const printWorkshop = () => {
    if (!canGenerate) {
      setSubmitted(true);
      focusQuoteRequirement();
      return;
    }
    setSubmitted(true);
    setSheetMode("workshop");
    const previousTitle = document.title;
    document.body.classList.add("print-workshop");
    const cleanup = () => {
      document.title = previousTitle;
      document.body.classList.remove("print-workshop");
    };
    const safeNumber = quoteNumber.replace(/[^\p{L}\p{N}._-]+/gu, "-");
    document.title = `KF-Basins-JobOrder-${safeNumber}.pdf`;
    window.addEventListener("afterprint", cleanup, { once: true });
    void saveQuote();
    window.setTimeout(() => {
      window.print();
      window.setTimeout(cleanup, 1000);
    }, 80);
  };
  const customerFields: Array<{ key: keyof CustomerDetails; label: string; placeholder: string; inputMode?: "numeric" }> = [
    { key: "name", label: "ชื่อผู้ติดต่อ", placeholder: "เช่น คุณนรินทร์" },
    { key: "company", label: "บริษัท / นิติบุคคล", placeholder: "ถ้ามี" },
    { key: "phone", label: "เบอร์โทรศัพท์", placeholder: "0812345678 (ถ้ามี)", inputMode: "numeric" },
    { key: "lineContact", label: "LINE สำหรับติดต่อ", placeholder: "@ไอดี หรือชื่อบัญชี (ถ้ามี)" },
    { key: "email", label: "อีเมล", placeholder: "name@company.com (ถ้ามี)" },
    { key: "project", label: "ชื่อโครงการ", placeholder: "เช่น บ้านพักอาศัยสุขุมวิท" },
    { key: "purchasingDepartment", label: "ฝ่ายจัดซื้อ / บัญชี", placeholder: "ถ้ามี" },
    { key: "taxName", label: "ชื่อสำหรับใบกำกับภาษี", placeholder: "ถ้าต้องการใบกำกับภาษี" },
    { key: "taxId", label: "เลขประจำตัวผู้เสียภาษี", placeholder: "13 หลัก (ถ้ามี)", inputMode: "numeric" },
    { key: "taxBranch", label: "สาขา", placeholder: "สำนักงานใหญ่ / ถ้ามี" },
  ];
  const renderCustomerField = (field: (typeof customerFields)[number]) => (
    <label key={field.key}>
      {field.label}
      <input
        type={field.key === "email" ? "email" : field.key === "phone" ? "tel" : undefined}
        inputMode={field.inputMode}
        value={customer[field.key] ?? ""}
        placeholder={field.placeholder}
        onChange={(event) => setCustomer((current) => ({
          ...current,
          [field.key]: field.key === "taxId"
            ? event.target.value.replace(/\D/g, "").slice(0, 13)
            : field.key === "phone"
              ? event.target.value.replace(/\D/g, "").slice(0, 10)
              : event.target.value,
        }))}
        data-testid={`input-customer-${field.key}`}
        aria-invalid={(field.key === "email" && hasInvalidEmail) || (field.key === "taxId" && hasInvalidTaxId)}
      />
    </label>
  );
  return <div className="page-wrap quote-page">
    <div className="quote-editor">
      <div className="saved-quote-actions quote-notification-actions">
        <button className="button button--accent" onClick={() => void saveQuote(true)} disabled={saving || !canGenerate} data-testid="button-send-quote-notification">{saving ? "กำลังบันทึก..." : "บันทึกและส่งเข้า Telegram"}</button>
        {saveError && <span className="summary-warning" role="alert" data-testid="status-quote-save-error">{saveError}</span>}
      </div>
      <section className="quote-heading"><div><p className="eyebrow accent">QUOTE BUILDER / {quoteNumber}</p><h1>จากรายการ<br /><em>สู่ตัวเลขที่ชัดเจน</em></h1><p className="hero-copy">ตรวจสอบรายการ ปรับรายละเอียด และออกใบเสนอราคาทางการสำหรับโปรเจกต์ของคุณ</p></div><div className="quote-date"><span>วันที่ออกเอกสาร</span><strong>{formatDate(issueDate)}</strong><small>ใช้ได้ถึง {formatDate(expiryDate)} · 30 วัน</small><button onClick={printQuote} data-testid="button-print-quote"><Printer size={15} /> พิมพ์ใบเสนอราคา</button><button onClick={printWorkshop} className="button--secondary" style={{ marginLeft: 6 }} data-testid="button-print-workshop"><Wrench size={15} /> พิมพ์ใบสั่งผลิตช่าง</button><button type="button" className="text-link" onClick={viewQuoteHistory} data-testid="button-view-quote-history">ดูใบเสนอราคาก่อนหน้า</button>{historyNotice && <span className="summary-warning" role="alert" data-testid="status-quote-history-login-required">{historyNotice}</span>}</div></section>
        <section className="quote-format-panel"><div><p className="eyebrow">รูปแบบเอกสาร</p><strong>เลือกรูปแบบใบเสนอราคา</strong><small>US สรุปตามพื้นที่/แผ่น · OF แยกรายห้อง/จุดติดตั้ง</small></div><div className="quote-format-switch"><button className={quoteFormat === "US" ? "is-active" : ""} onClick={() => setQuoteFormat("US")} data-testid="button-quote-format-us"><span>US</span><small>พื้นที่ / แผ่น</small></button><button className={quoteFormat === "OF" ? "is-active" : ""} onClick={() => setQuoteFormat("OF")} data-testid="button-quote-format-of"><span>OF</span><small>รายห้อง / จุด</small></button></div></section>
      <div className="quote-layout"><section className="quote-main"><div className="quote-block"><div className="block-header"><div><p className="eyebrow">01 / BASINS</p><h2>รายการอ่างล้างหน้า</h2></div><Link href="/" className="text-link" data-testid="link-add-more">เพิ่มรายการ <Plus size={15} /></Link></div>{cart.length ? cart.map((line) => { const product = productBySku(line.sku)!; return <div className="quote-line" key={line.sku} data-testid={`row-quote-${line.sku}`}><BasinVisual tone={product.imageTone} imageUrl={product.imageUrl} alt={`${product.sku} ${product.colorName}`} tall={product.category === "tall vertical washbasin"} /><div className="quote-line-name"><span className="eyebrow">{product.sku} / {product.colorCode}</span><strong>{product.colorName}</strong><small>{product.category === "counter basin" ? "เคาน์เตอร์" : "ทรงสูง"} · {product.dimensions}</small></div><div className="line-quantity"><button onClick={() => updateLine(line.sku, { quantity: line.quantity - 1 })} aria-label={`ลดจำนวน ${line.sku}`} data-testid={`button-quantity-minus-${line.sku}`}><Minus size={13} /></button><span data-testid={`text-quantity-${line.sku}`}>{line.quantity}</span><button onClick={() => updateLine(line.sku, { quantity: line.quantity + 1 })} aria-label={`เพิ่มจำนวน ${line.sku}`} data-testid={`button-quantity-plus-${line.sku}`}><Plus size={13} /></button></div><label className="install-toggle"><input type="checkbox" checked={line.installationSelected} onChange={(event) => updateLine(line.sku, { installationSelected: event.target.checked })} data-testid={`input-installation-${line.sku}`} /><span />ติดตั้ง</label><strong className="line-price">{formatTHB(product.priceTHB * line.quantity)}</strong><button className="icon-button" onClick={() => setCart((lines) => lines.filter((item) => item.sku !== line.sku))} aria-label={`ลบ ${line.sku}`} data-testid={`button-remove-${line.sku}`}><Trash2 size={15} /></button></div>; }) : <div className="quote-empty" data-testid="status-quote-empty"><ShoppingBag size={22} /><p>ยังไม่มีสินค้าในใบเสนอราคา</p><Link href="/" className="text-link" data-testid="link-empty-catalog">เลือกจากแคตตาล็อก <ArrowRight size={15} /></Link></div>}<div className="install-note">ค่าติดตั้งอ่าง <strong>5,000 บาท/ชุด</strong> · ฟรีค่าดำเนินการติดตั้งเมื่อสั่งตั้งแต่ 3 ชุดขึ้นไป</div></div>
           <div className="quote-block"><div className="block-header"><div><p className="eyebrow">02 / STONE</p><h2>หินสังเคราะห์</h2></div><Link href="/stone" className="text-link" data-testid="link-edit-stone">{stoneActive ? "แก้ไขการกำหนดค่า" : "เพิ่มหินสังเคราะห์"} <ArrowRight size={15} /></Link></div>{stoneActive ? stones.map((stone) => <QuoteStoneRow key={stone.color} stone={stone} stoneColors={stoneColors} onRemove={removeStone} />) : <div className="quote-empty quote-empty--compact" data-testid="status-stone-empty"><p>ยังไม่ได้เลือกหินสังเคราะห์</p><Link href="/stone" className="text-link" data-testid="link-empty-stone">เลือกสีและรูปแบบการสั่งซื้อ <ArrowRight size={15} /></Link></div>}</div>
        <div className="quote-block customer-block"><div className="block-header"><div><p className="eyebrow">03 / CUSTOMER</p><h2>ข้อมูลลูกค้าและหน้างาน</h2><p className="customer-intro">กรอกเท่าที่มีได้เลยครับ ข้อมูลลูกค้ายังไม่ครบก็ออกใบเสนอราคาได้ ระบบจะแจ้งเฉพาะค่าที่กรอกแล้วแต่รูปแบบไม่ถูกต้อง</p></div></div><div className="customer-grid"><div className="customer-group-title span-2"><strong>1 / ข้อมูลลูกค้าและที่อยู่ใบเสนอราคา</strong><small>ชื่อและที่อยู่ช่วยให้ทีมขายจัดทำเอกสารได้ตรงใจ แต่ไม่บังคับ</small></div>{customerFields.slice(0, 2).map(renderCustomerField)}<div className="span-2 customer-address-field"><WorksiteAddressAutocomplete value={customer.address ?? ""} selectedPlaceId={worksitePlaceId} inputTestId="input-customer-address" onValueChange={(value) => setCustomer((current) => ({ ...current, address: value }))} onPlaceSelect={setWorksitePlaceId} onClearPlace={() => setWorksitePlaceId(null)} /></div><div className="customer-group-title span-2"><strong>2 / ช่องทางติดต่อ</strong><small>กรอกช่องทางที่สะดวกอย่างน้อยหนึ่งช่องทางได้ตามต้องการ</small></div>{customerFields.slice(2, 5).map(renderCustomerField)}<label>ช่องทางติดต่อที่สะดวก<select value={customer.preferredContact} onChange={(event) => setCustomer((current) => ({ ...current, preferredContact: event.target.value as CustomerDetails["preferredContact"] }))} data-testid="input-customer-preferred-contact"><option value="">ยังไม่ระบุ</option>{CUSTOMER_CONTACT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><div className="customer-group-title span-2"><strong>3 / ข้อมูลใบกำกับภาษี (ไม่บังคับ)</strong><small>กรอกเมื่อขอใบกำกับภาษีในนามบริษัทหรือนิติบุคคล</small></div>{customerFields.slice(7, 10).map(renderCustomerField)}<label className="span-2 customer-address-field"><span>ที่อยู่สำหรับใบกำกับภาษี</span><textarea value={customer.taxAddress ?? ""} onChange={(event) => setCustomer((current) => ({ ...current, taxAddress: event.target.value }))} placeholder="กรอกเมื่อใช้ที่อยู่ภาษีต่างจากที่อยู่ใบเสนอราคา" data-testid="input-customer-tax-address" /></label><div className="customer-group-title span-2"><strong>4 / รายละเอียดหน้างาน (ไม่บังคับ)</strong><small>ช่วยให้ทีมงานประเมินงานและนัดหมายได้ตรงจุด</small></div><label>โลเคชันหน้างาน<input value={customer.site ?? ""} onChange={(event) => setCustomer((current) => ({ ...current, site: event.target.value }))} placeholder="เช่น ห้องน้ำชั้น 2" data-testid="input-customer-site" /></label><label>ประเภทสถานที่<select value={customer.propertyType} onChange={(event) => setCustomer((current) => ({ ...current, propertyType: event.target.value as CustomerDetails["propertyType"], condoFloor: event.target.value === "condo" ? current.condoFloor : "" }))} data-testid="input-customer-property-type"><option value="">ยังไม่ระบุ</option>{PROPERTY_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>{customer.propertyType === "condo" && <label>ชั้นคอนโด<input value={customer.condoFloor} onChange={(event) => setCustomer((current) => ({ ...current, condoFloor: event.target.value }))} maxLength={32} data-testid="input-customer-condo-floor" /></label>}<label>วันที่คาดว่าจะติดตั้ง<input type="date" min={today} value={customer.expectedInstallationDate} onChange={(event) => setCustomer((current) => ({ ...current, expectedInstallationDate: event.target.value }))} data-testid="input-customer-installation-date" /></label><label>บทบาทลูกค้า<select value={customer.customerRole} onChange={(event) => setCustomer((current) => ({ ...current, customerRole: event.target.value as CustomerDetails["customerRole"] }))} data-testid="input-customer-role"><option value="">ยังไม่ระบุ</option>{CUSTOMER_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="span-2">หมายเหตุเพิ่มเติม<textarea value={customer.notes ?? ""} onChange={(event) => setCustomer((current) => ({ ...current, notes: event.target.value }))} placeholder="ถ้ามีรายละเอียดเพิ่มเติมเกี่ยวกับงาน" data-testid="input-customer-notes" /></label><SitePhotoUpload photos={sitePhotos} onChange={setSitePhotos} /></div>{hasInvalidEmail && <p className="summary-warning" role="alert" data-testid="status-quote-email-validation">กรุณากรอกอีเมลให้ถูกต้อง (เช่น name@example.com)</p>}{hasInvalidTaxId && <p className="summary-warning" role="alert" data-testid="status-quote-tax-id-validation">เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก</p>}{hasPastInstallationDate && <p className="summary-warning" role="alert" data-testid="status-quote-installation-date-validation">วันที่เข้าติดตั้งต้องไม่เป็นวันที่ผ่านมา</p>}</div>
         </section><aside className="quote-summary"><p className="eyebrow">04 / TOTAL</p><h2>สรุปใบเสนอราคา</h2><div className="total-rows"><div><span>สินค้าอ่างล้างหน้า <small>{basinSets} ชุด</small></span><strong>{formatTHB(basinSubtotal)}</strong></div><div><span>ค่าติดตั้งอ่าง</span><strong className={installationCharge === 0 ? "free-text" : ""}>{installationCharge === 0 ? "ฟรี" : formatTHB(installationCharge)}</strong></div>{stoneActive && <div><span>หินสังเคราะห์ <small>{stones.length} สี · อ้างอิงราคาจากเอกสาร</small></span><strong>{hasInvalidStone ? "ตรวจสอบรายการ" : formatTHB(totalStone)}</strong></div>}<div className="discount-row"><span>ส่วนลด / สิทธิ์ติดตั้งฟรี</span><strong>{installationDiscount ? `-${formatTHB(installationDiscount)}` : "—"}</strong></div></div><div className="vat-row"><label><input type="checkbox" checked={vat} onChange={(event) => setVat(event.target.checked)} data-testid="input-vat" /><span />คิด VAT 7%</label><strong>{formatTHB(vatAmount)}</strong></div>{missingTaxIdForVat && <p className="summary-warning" role="status" data-testid="status-quote-vat-tax-id">💡 กรุณากรอกเลขประจำตัวผู้เสียภาษี 13 หลักในโปรไฟล์เพื่อให้ออกใบกำกับภาษีได้สมบูรณ์</p>}<div className="grand-total"><span>ยอดรวมทั้งสิ้น</span><strong data-testid="text-grand-total">{formatTHB(total)}</strong><small>{thaiNumberText(total)}</small></div><button className="button button--accent full-width" onClick={generateQuote} data-testid="button-generate-quote">{submitted && canGenerate ? <><Check size={16} /> สร้างใบเสนอราคาแล้ว</> : <>ออกใบเสนอราคาทางการ <ArrowRight size={16} /></>}</button>{hasMissing && <p className="summary-warning" data-testid="status-quote-validation">กรอกชื่อผู้ติดต่อ โทรศัพท์ อีเมล และชื่อโครงการ เพื่อสร้างใบเสนอราคาที่สมบูรณ์</p>}{hasPastInstallationDate && <p className="summary-warning" data-testid="status-quote-installation-date-summary-validation">วันที่เข้าติดตั้งต้องไม่เป็นวันที่ผ่านมา</p>}{hasInvalidStone && <p className="summary-warning" data-testid="status-quote-stone-validation">กลับไปหน้าหินสังเคราะห์และกรอกขนาดอย่างน้อย 10 × 10 ซม. หรือเลือกสีที่มีราคาในเอกสาร ก่อนสร้างใบเสนอราคา</p>}{!cart.length && <p className="summary-warning" data-testid="status-quote-cart-validation">เพิ่มสินค้าอย่างน้อย 1 รายการก่อนออกใบเสนอราคา</p>}{submitted && canGenerate && <div className="success-message" data-testid="status-quote-success"><Check size={16} /> {quoteNumber} พร้อมพิมพ์หรือบันทึกเป็น PDF</div>}<div className="quote-share"><strong>ยืนยันแบบ / ขอให้ทีมงานติดต่อกลับ</strong><p>กดคัดลอกข้อความสำหรับส่งทาง LINE หรือเปิด LINE เพื่อส่งต่อได้ทันที</p><div className="quote-share-actions"><button type="button" className="button button--dark" onClick={copyLineSummary} data-testid="button-copy-line-summary">{copied ? <><Check size={15} /> คัดลอกแล้ว</> : "คัดลอกสรุปส่ง LINE"}</button><a className="button button--outline" href={`https://line.me/R/msg/text/?text=${encodeURIComponent(lineSummary)}`} target="_blank" rel="noreferrer" data-testid="link-send-line-summary">เปิด LINE</a></div></div><div className="quote-terms"><strong>หมายเหตุจากแคตตาล็อก</strong><p>ราคาสินค้าไม่รวม VAT · หินตัดและติดตั้งใช้อัตรารวมติดตั้งแล้ว · งานหินต่ำกว่าพื้นที่ขั้นต่ำอาจมีค่าดำเนินการเพิ่มตามพื้นที่</p></div></aside></div>
    </div>
     <div className="customer-extra-fields quote-block" data-testid="section-quote-project-details"><div><p className="eyebrow">PROJECT DETAILS / ข้อมูลหน้างาน</p><strong>ข้อมูลสำหรับหัวใบเสนอราคา</strong></div><label>ชื่อโครงการ<input value={customer.project ?? ""} onChange={(event) => setCustomer((current) => ({ ...current, project: event.target.value }))} placeholder="เช่น บ้านพักอาศัยสุขุมวิท" data-testid="input-customer-project" /></label><label>ฝ่ายจัดซื้อ / บัญชี<input value={customer.purchasingDepartment ?? ""} onChange={(event) => setCustomer((current) => ({ ...current, purchasingDepartment: event.target.value }))} placeholder="ถ้ามี" data-testid="input-customer-purchasing-department" /></label></div>
     {submitted && canGenerate && <>
       <div className="quote-sheet-type-switch" role="tablist">
         <button
           type="button"
           className={sheetMode === "formal" ? "is-active" : ""}
           onClick={() => setSheetMode("formal")}
           data-testid="button-sheet-mode-formal"
         >
           <FileText size={15} /> ดูใบเสนอราคา (ลูกค้า)
         </button>
         <button
           type="button"
           className={sheetMode === "workshop" ? "is-active" : ""}
           onClick={() => setSheetMode("workshop")}
           data-testid="button-sheet-mode-workshop"
         >
           <Wrench size={15} /> ดูใบสั่งผลิต (โรงงาน/ช่าง)
         </button>
       </div>
       {sheetMode === "formal" ? (
         <FormalQuote format={quoteFormat} quoteNumber={quoteNumber} issueDate={issueDate} expiryDate={expiryDate} customer={customer} items={formalItems} grossSubtotal={grossSubtotal} discountAmount={installationDiscount} subtotal={subtotal} vatAmount={vatAmount} total={total} vat={vat} />
       ) : (
         <WorkshopProductionSheet quoteNumber={quoteNumber} issueDate={issueDate} customer={customer} worksitePlaceId={worksitePlaceId} items={formalItems as ProductionItem[]} sitePhotos={sitePhotos} />
       )}
     </>}
    {sheetMode === "formal" && <div className="source-note">ข้อมูลสินค้าจาก Knight Basins Catalogue Part 1–2 · ราคาหินอ้างอิงจากเอกสารราคาขายแผ่นและราคารวมติดตั้งของ Knight Furnich</div>}
  </div>;
}

import AdminApp from "./admin/AdminApp";
import SalesGuide from "./components/SalesGuide";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useGetCatalog, useGetCustomerProfile, useGetLineAuthStatus, useGetSavedQuote, useNotifySavedQuote, useUpsertLead } from "@workspace/api-client-react";
import { KnightSupport, LineLoginButton } from "@/components/KnightSupport";
import OwnerWorkbench from "./admin/OwnerWorkbench";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function OrderModeTabs({ mode, setMode, onModeChange }: { mode: StudioOrderMode; setMode: Dispatch<SetStateAction<StudioOrderMode>>; onModeChange?: (mode: StudioOrderMode) => void }) {
  return <div className="order-mode-tabs" role="tablist" aria-label="รูปแบบการสั่งซื้อ">
    {([
      ["quick-purchase", "ซื้อด่วนจากแคตตาล็อก", "เลือกสินค้าและเพิ่มลงใบเสนอราคา"],
      ["studio", "ออกแบบใน 2D Studio", "กำหนดขนาดและจัดวางอ่าง"],
      ["sketch", "ส่งแบบร่างด้วยมือ", "แนบภาพให้ทีมขายช่วยดูแบบ"],
    ] as const).map(([value, label, description]) => <button type="button" key={value} role="tab" aria-selected={mode === value} className={mode === value ? "is-active" : ""} onClick={() => { setMode(value); onModeChange?.(value); }} data-testid={`button-order-mode-${value}`}><strong>{label}</strong><small>{description}</small></button>)}
  </div>;
}

function Storefront() {
  const { data: remoteCatalog } = useGetCatalog({
    query: {
      staleTime: 0,
      refetchInterval: 15_000,
      refetchIntervalInBackground: true,
      refetchOnMount: "always",
      refetchOnReconnect: true,
    },
  });
  const { data: lineAuth } = useGetLineAuthStatus();
  const { data: customerProfile } = useGetCustomerProfile({ query: { queryKey: ["customer-profile"], enabled: lineAuth?.authenticated === true, retry: false } });
  const [catalogStoneColors, setCatalogStoneColors] = useState<{
    wholeSheet: ReadonlyArray<StoneColor>;
    installed: ReadonlyArray<StoneColor>;
    all: ReadonlyArray<StoneColor>;
  }>({
    wholeSheet: STONE_COLORS,
    installed: STONE_COLORS,
    all: STONE_COLORS,
  });
  const [cart, setCart] = useStored<QuoteBasinLine[]>("knight-cart", []);
  const [stones, setStones] = useStoredStones("knight-stones-v2", []);
  const [customer, setCustomer] = useStoredCustomer("knight-customer");
  const [vat, setVat] = useStored<boolean>("knight-vat", true);
  const activeBasinProducts = useMemo(() => remoteCatalog?.basins.map(basinProductFromCatalog) ?? PRODUCTS, [remoteCatalog?.basins]);
  const [catalogNotice, setCatalogNotice] = useState("");
  const [orderMode, setOrderMode] = useState<StudioOrderMode>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const m = params.get("mode");
      if (m === "quick-purchase" || m === "studio" || m === "sketch") return m;
    }
    return "quick-purchase";
  });

  useEffect(() => {
    const syncModeFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const m = params.get("mode");
      if (m === "quick-purchase" || m === "studio" || m === "sketch") {
        setOrderMode(m);
      }
    };
    syncModeFromUrl();
    window.addEventListener("popstate", syncModeFromUrl);
    return () => window.removeEventListener("popstate", syncModeFromUrl);
  }, []);
  const [leadKey] = useStored("knight-lead-key", `lead-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [, setLocation] = useLocation();
  const lastCatalogFingerprint = useRef<string | null>(null);
  const upsertLead = useUpsertLead();
  const notifyQuoteMutation = useNotifySavedQuote();
  const contactDefaults = useMemo(() => ({
    name: customerProfile?.fullName || customerProfile?.displayName || customer.name,
    company: customerProfile?.company || customer.company,
    taxId: customerProfile?.taxId || customer.taxId,
    taxName: customerProfile?.taxName || customer.taxName,
    taxBranch: customerProfile?.taxBranch || customer.taxBranch,
    taxAddress: customerProfile?.taxAddress || customer.taxAddress,
    phone: customerProfile?.phone || customer.phone,
    lineContact: customerProfile?.lineContact || customer.lineContact,
    email: customerProfile?.email || customer.email,
    project: customerProfile?.project || customer.project,
    address: customerProfile?.address || customer.address,
    site: customer.site,
    purchasingDepartment: customer.purchasingDepartment,
    notes: customer.notes,
    preferredContact: (customerProfile?.preferredContact || customer.preferredContact || "") as CustomerDetails["preferredContact"],
    customerRole: (customerProfile?.customerRole || customer.customerRole || "") as CustomerDetails["customerRole"],
    propertyType: (customerProfile?.propertyType || customer.propertyType || "") as CustomerDetails["propertyType"],
    condoFloor: customerProfile?.condoFloor || customer.condoFloor,
    expectedInstallationDate: customerProfile?.expectedInstallationDate || customer.expectedInstallationDate,
  }), [customer, customerProfile?.fullName, customerProfile?.displayName, customerProfile?.company, customerProfile?.taxId, customerProfile?.taxName, customerProfile?.taxBranch, customerProfile?.taxAddress, customerProfile?.phone, customerProfile?.lineContact, customerProfile?.email, customerProfile?.project, customerProfile?.address, customerProfile?.preferredContact, customerProfile?.customerRole, customerProfile?.propertyType, customerProfile?.condoFloor, customerProfile?.expectedInstallationDate]);
  useEffect(() => {
    if (!customerProfile) return;
    setCustomer((current) => ({
      ...current,
      name: contactDefaults.name || current.name,
      company: contactDefaults.company || current.company,
      taxId: contactDefaults.taxId || current.taxId,
      taxName: contactDefaults.taxName || current.taxName,
      taxBranch: contactDefaults.taxBranch || current.taxBranch,
      taxAddress: contactDefaults.taxAddress || current.taxAddress,
      phone: contactDefaults.phone || current.phone,
      lineContact: contactDefaults.lineContact || current.lineContact,
      email: contactDefaults.email || current.email,
      project: contactDefaults.project || current.project,
      address: contactDefaults.address || current.address,
      preferredContact: contactDefaults.preferredContact || current.preferredContact,
      customerRole: contactDefaults.customerRole || current.customerRole,
      propertyType: contactDefaults.propertyType || current.propertyType,
      condoFloor: contactDefaults.condoFloor || current.condoFloor,
      expectedInstallationDate: contactDefaults.expectedInstallationDate || current.expectedInstallationDate,
      site: contactDefaults.site || current.site,
      purchasingDepartment: contactDefaults.purchasingDepartment || current.purchasingDepartment,
      notes: contactDefaults.notes || current.notes,
    }));
  }, [customerProfile?.id, customerProfile?.updatedAt]);
  const persistStudioContact = useCallback((contact: StudioSubmission["contact"]) => {
    setCustomer((current) => {
      const keys = Object.keys(contact) as Array<keyof StudioSubmission["contact"]>;
      if (keys.every((key) => current[key] === contact[key])) return current;
      return { ...current, ...contact };
    });
  }, [setCustomer]);
  useEffect(() => {
    if (!remoteCatalog) return;
    const catalogFingerprint = JSON.stringify({
      basins: remoteCatalog.basins.map((basin) => [basin.sku, basin.priceTHB, basin.active, basin.sortOrder]),
      categories: remoteCatalog.categories.map((category) => [category.name, category.active, category.sortOrder]),
      installedStones: remoteCatalog.installedStones.map((stone) => [stone.code, stone.name, stone.pricePerSqmTHB, stone.active, stone.sortOrder]),
      sheetStones: remoteCatalog.sheetStones.map((stone) => [stone.code, stone.name, stone.basePriceTHB, stone.active, stone.sortOrder]),
    });
    const catalogChanged = lastCatalogFingerprint.current !== null && lastCatalogFingerprint.current !== catalogFingerprint;
    lastCatalogFingerprint.current = catalogFingerprint;
    PRODUCTS.splice(0, PRODUCTS.length, ...remoteCatalog.basins.map(basinProductFromCatalog));
    const wholeSheet = stoneColorsForMode(remoteCatalog.installedStones, remoteCatalog.sheetStones, "whole-sheet");
    const installed = stoneColorsForMode(remoteCatalog.installedStones, remoteCatalog.sheetStones, "installed");
    const all = stoneColorsFromCatalog(remoteCatalog.installedStones, remoteCatalog.sheetStones);
    setCatalogStoneColors({ wholeSheet, installed, all });
    STONE_COLORS.splice(0, STONE_COLORS.length, ...all);
    const stoneReconciliation = reconcileStoneSelections(stones, { "whole-sheet": wholeSheet, installed });
    const canonicalizationChanged = stoneReconciliation.active.some((stone, index) => stone.color !== stones[index]?.color);
    const activeBasinSkus = new Set(remoteCatalog.basins.map((basin) => basin.sku));
    const removedBasinSkus = cart.filter((line) => !activeBasinSkus.has(line.sku)).map((line) => line.sku);
    if (stoneReconciliation.hidden.length || canonicalizationChanged) setStones(stoneReconciliation.active);
    if (removedBasinSkus.length) setCart((current) => current.filter((line) => activeBasinSkus.has(line.sku)));
    if (catalogChanged || stoneReconciliation.hidden.length || canonicalizationChanged || removedBasinSkus.length) {
      const hiddenStones = stoneReconciliation.hidden.map((stone) => stone.color).join(", ");
      const hiddenBasins = [...new Set(removedBasinSkus)].join(", ");
      const removed = [
        hiddenStones && `หิน ${hiddenStones} ถูกซ่อนและนำออกจากรายการที่กำลังเลือก`,
        hiddenBasins && `อ่าง ${hiddenBasins} ไม่เปิดใช้งานแล้วและนำออกจากใบเสนอราคา`,
      ].filter(Boolean);
      setCatalogNotice(removed.length
        ? `แคตตาล็อกอัปเดตแล้ว · ${removed.join(" · ")} รายการที่ยังเปิดใช้และรายละเอียดที่กำลังแก้ไขยังคงเดิม`
        : "แคตตาล็อกอัปเดตแล้ว · รายการที่เปิดใช้งานล่าสุดพร้อมให้เลือกแล้ว");
    }
  }, [cart, remoteCatalog, stones]);
  const addToQuote = (sku: string) => setCart((current) => current.some((line) => line.sku === sku) ? current.map((line) => line.sku === sku ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { sku, quantity: 1, installationSelected: false }]);
  const syncLead = (status: "new_lead" | "selecting" | "quote_requested", source: string, details: Partial<CustomerDetails> & { productSkus?: string[]; orderMode?: StudioOrderMode; studioData?: unknown } = {}) => {
    return upsertLead.mutateAsync({
      data: {
        leadKey,
        status,
        source,
        productSkus: [...new Set(details.productSkus ?? cart.map((line) => line.sku))],
        name: details.name ?? (customer.name || null),
        company: details.company ?? (customer.company || null),
        phone: details.phone ?? (customer.phone || null),
        lineContact: details.lineContact ?? (customer.lineContact || null),
        email: details.email ?? (customer.email || null),
        project: details.project ?? (customer.project || null),
        address: details.address ?? (customer.address || null),
        site: details.site ?? (customer.site || null),
        purchasingDepartment: details.purchasingDepartment ?? (customer.purchasingDepartment || null),
        notes: details.notes ?? (customer.notes || null),
        taxName: details.taxName ?? (customer.taxName || null),
        taxId: details.taxId ?? (customer.taxId || null),
        taxBranch: details.taxBranch ?? (customer.taxBranch || null),
        taxAddress: details.taxAddress ?? (customer.taxAddress || null),
        preferredContact: details.preferredContact || customer.preferredContact || null,
        customerRole: details.customerRole || customer.customerRole || null,
        propertyType: details.propertyType || customer.propertyType || null,
        condoFloor: details.condoFloor || customer.condoFloor || null,
        expectedInstallationDate: details.expectedInstallationDate || customer.expectedInstallationDate || null,
        orderMode: details.orderMode ?? "quick-purchase",
        studioData: details.studioData ? { ...(details.studioData as Record<string, unknown>) } : null,
      },
    });
  };
  const leadEvent = (status: "new_lead" | "selecting", productSkus: string[] = []) => syncLead(status, "knight_support", { productSkus });
  const requestQuote = (skus: string[]) => {
    skus.forEach(addToQuote);
    leadEvent("selecting", skus);
    setLocation("/quote");
  };
  const submitQuote = async (snapshot: QuickQuoteSnapshot, notify = false, worksitePlaceId: string | null = null) => {
    const lead = await syncLead("quote_requested", "quote_builder", {
      ...snapshot.customer,
      productSkus: cart.map((line) => line.sku),
      orderMode: "quick-purchase",
      studioData: { ...snapshot, worksitePlaceId },
    });
    if (!lead.quoteNumber || !lead.publicQuoteToken) throw new Error("ระบบยังไม่ได้สร้างลิงก์ใบเสนอราคา");
    let notificationMessage = "";
    if (notify) {
      try {
        const result = await notifyQuoteMutation.mutateAsync({ data: { token: lead.publicQuoteToken } });
        notificationMessage = result.message;
      } catch (error) {
        notificationMessage = error instanceof Error ? error.message : "บันทึกแล้ว แต่ส่งแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่";
      }
    }
    const notificationQuery = notificationMessage ? `&notification=${encodeURIComponent(notificationMessage)}` : "";
    setLocation(`/quote/view?token=${encodeURIComponent(lead.publicQuoteToken)}${notificationQuery}`);
  };
  const submitStudio = async ({ state, estimate, contact, worksitePlaceId, notification }: StudioSubmission) => {
    setCustomer((current) => ({ ...current, ...contact }));
    const lead = await syncLead("quote_requested", "studio", { ...contact, site: contact.site || contact.address || undefined, productSkus: state.basinSkus, orderMode: "studio", studioData: { state, estimate, notification, worksitePlaceId } });
    if (!lead.quoteNumber || !lead.publicQuoteToken) throw new Error("ระบบยังไม่ได้สร้างลิงก์ใบเสนอราคา");
    setLocation(`/quote/view?token=${encodeURIComponent(lead.publicQuoteToken)}`);
  };
  const initialBasinSkus = useMemo(() => [...new Set(cart.map((line) => line.sku))].slice(0, 2), [cart]);
  const initialStoneColors = useMemo(() => [...new Set(stones.filter((stone) => stone.enabled).map((stone) => stone.color))].slice(0, 3), [stones]);
  const navigateFromStoneMode = (mode: StudioOrderMode) => {
    if (mode === "studio") setLocation("/studio");
    else setLocation("/");
  };
  return <Layout cart={cart} setCart={setCart} stones={stones} setStones={setStones} stoneColors={catalogStoneColors.all} catalogNotice={catalogNotice} onDismissCatalogNotice={() => setCatalogNotice("")} onAddToQuote={addToQuote} onRequestQuote={requestQuote} onLeadEvent={leadEvent}><Switch><Route path="/"><OrderModeTabs mode={orderMode} setMode={setOrderMode} /><Link href="/readme" className="text-link homepage-guide-link" data-testid="link-homepage-guide"><BookOpen size={15} /> อ่านคู่มือการใช้งานก่อนเริ่ม</Link>{orderMode === "quick-purchase" ? <HomePage cart={cart} setCart={setCart} categories={remoteCatalog?.categories} products={activeBasinProducts} /> : <StudioPage mode={orderMode} leadKey={leadKey} onSubmitStudio={submitStudio} onContactChange={persistStudioContact} contactDefaults={contactDefaults} initialBasinSkus={initialBasinSkus} initialStoneColors={initialStoneColors} stoneColors={catalogStoneColors.installed} basinProducts={activeBasinProducts} />}<TrustBadges /><InstallationShowcase /><QuickFAQ /></Route><Route path="/studio"><StudioPage mode="studio" leadKey={leadKey} onSubmitStudio={submitStudio} onContactChange={persistStudioContact} contactDefaults={contactDefaults} initialBasinSkus={initialBasinSkus} initialStoneColors={initialStoneColors} stoneColors={catalogStoneColors.installed} basinProducts={activeBasinProducts} /></Route><Route path="/sketch"><StudioPage mode="sketch" leadKey={leadKey} onSubmitStudio={submitStudio} onContactChange={persistStudioContact} contactDefaults={contactDefaults} initialBasinSkus={initialBasinSkus} initialStoneColors={initialStoneColors} stoneColors={catalogStoneColors.installed} basinProducts={activeBasinProducts} /></Route><Route path="/stone"><OrderModeTabs mode={orderMode} setMode={setOrderMode} onModeChange={navigateFromStoneMode} /><Link href="/readme" className="text-link homepage-guide-link" data-testid="link-stone-guide"><BookOpen size={15} /> อ่านคู่มือการใช้งานก่อนเริ่ม</Link><StonePage stones={stones} setStones={setStones} stoneColorsByMode={catalogStoneColors} /></Route><Route path="/quote/view"><SavedQuotePage /></Route><Route path="/quote"><Link href="/readme" className="text-link homepage-guide-link" data-testid="link-quote-guide"><BookOpen size={15} /> อ่านคู่มือการใช้งานก่อนเริ่ม</Link><QuotePage cart={cart} setCart={setCart} stones={stones} setStones={setStones} stoneColors={catalogStoneColors.all} customer={customer} setCustomer={setCustomer} vat={vat} setVat={setVat} onSubmitQuote={submitQuote} /></Route><Route path="/profile"><CustomerProfilePage /></Route><Route><div className="empty-state"><span className="empty-number">404</span><h3>ไม่พบหน้านี้</h3><Link href="/" className="text-link" data-testid="link-not-found-home">กลับไปแคตตาล็อก <ArrowRight size={15} /></Link></div></Route></Switch></Layout>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/admin" component={AdminApp} />
        <Route path="/admin/*" component={AdminApp} />
        <Route path="/readme" component={SalesGuide} />
        <Route path="/" component={RootEntry} />
        <Route component={Storefront} />
      </Switch>
      <Toaster />
    </QueryClientProvider>
  );
}

function RootEntry() {
  return new URLSearchParams(window.location.search).get("workbench") === "1" ? <OwnerWorkbench /> : <Storefront />;
}

export default App;
