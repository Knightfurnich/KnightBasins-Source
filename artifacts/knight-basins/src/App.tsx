import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { ArrowRight, Check, ChevronDown, GripVertical, Minus, Plus, PlayCircle, Printer, QrCode, Search, ShoppingBag, SlidersHorizontal, Trash2, X } from "lucide-react";
import {
  formatTHB,
  INSTALLATION_PRICE,
  productBySku,
  PRODUCTS,
  stoneColorByName,
  stoneInstalledUnitPrice,
  stoneSheetUnitPrice,
  STONE_COLORS,
  STONE_GLUE_PRICE,
  STONE_INSTALLED_MIN_BANGKOK_SQM,
  STONE_INSTALLED_MIN_PROVINCE_SQM,
  STONE_SMALL_JOB_BANGKOK_FEE,
  STONE_SMALL_JOB_PROVINCE_FEE,
  STONE_SHEET_SIZE,
  STONE_SHEET_THICKNESS,
  VAT_RATE,
  basinProductFromCatalog,
  removeStoneSelection,
  toggleBasinSelection,
  upsertStoneSelection,
  type CustomerDetails,
  type QuoteBasinLine,
  type StoneConfig,
} from "@/data/catalog";
import { calculateFormalQuoteTotals, formatQuoteMonth, quoteQrImageUrl, thaiNumberText, type QuoteFormat } from "@/data/quote-utils";
import { StudioPage, type StudioSubmission } from "@/components/StudioPage";
import type { StudioOrderMode } from "@/data/studio-model";

const emptyCustomer: CustomerDetails = { name: "", company: "", taxId: "", phone: "", email: "", purchasingDepartment: "", address: "", project: "", site: "", notes: "" };
const defaultStone: StoneConfig = { enabled: false, mode: "whole-sheet", color: "BW010", quantity: 1, widthCm: 60, lengthCm: 120, areaSqM: 0.72, unitPrice: stoneSheetUnitPrice("BW010", 1) ?? 0, installationPrice: 0 };

function formatStonePrice(price: number | null) {
  return price === null ? "—" : formatTHB(price);
}

function stoneAreaSqM(stone: StoneConfig) {
  return stone.widthCm > 0 && stone.lengthCm > 0 ? (stone.widthCm * stone.lengthCm) / 10000 : 0;
}

function stoneUnitPrice(stone: StoneConfig) {
  return stone.mode === "whole-sheet" ? stoneSheetUnitPrice(stone.color, stone.quantity) : stoneInstalledUnitPrice(stone.color);
}

function stoneTotal(stone: StoneConfig) {
  const unitPrice = stoneUnitPrice(stone);
  if (!stone.enabled || unitPrice === null) return 0;
  return unitPrice * (stone.mode === "whole-sheet" ? stone.quantity : stoneAreaSqM(stone));
}

function isInvalidStone(stone: StoneConfig) {
  return stone.enabled && (stoneUnitPrice(stone) === null || (stone.mode === "installed" && (stone.widthCm < 10 || stone.lengthCm < 10)));
}

function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}

function useStoredStones(key: string, fallback: StoneConfig[]) {
  const [value, setValue] = useState<StoneConfig[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "null");
      if (Array.isArray(stored)) return stored;
      const legacy = JSON.parse(localStorage.getItem("knight-stone") || "null") as StoneConfig | null;
      return legacy?.enabled ? [legacy] : fallback;
    } catch {
      return fallback;
    }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}

function upsertStone(stones: StoneConfig[], incoming: StoneConfig) {
  return upsertStoneSelection(stones, incoming);
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("th-TH", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function BasinVisual({ tone, imageUrl, alt, tall = false }: { tone: string; imageUrl?: string; alt?: string; tall?: boolean }) {
  return <div className={`basin-visual ${tall ? "basin-visual--tall" : ""}`} style={{ "--basin-tone": tone } as CSSProperties & { "--basin-tone": string }}>
    <div className="basin-shadow" />
    <div className="basin-body"><div className="basin-bowl" /><div className="basin-drain" /></div>
    {tall && <div className="basin-stem" />}
    {imageUrl && <img className="basin-image" src={imageUrl} alt={alt ?? ""} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
  </div>;
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
  return <footer className="site-footer"><div><img className="footer-logo footer-logo--png" src={knightFurnichLogo} alt="Knight Furnich" /><span className="footer-kicker">SOLID SURFACE / BASINS</span><p>พื้นผิวที่ทำให้รายละเอียดเล็ก ๆ<br />มีน้ำหนักขึ้นมา</p></div><div className="footer-meta"><span>TH / 2026 COLLECTION</span><span>ราคาสินค้ายังไม่รวม VAT</span><Link href="/?workbench=1" className="footer-owner-link">Private Workbench</Link></div></footer>;
}

function QuoteDropZone({ cart, setCart, setStones }: { cart: QuoteBasinLine[]; setCart: Dispatch<SetStateAction<QuoteBasinLine[]>>; setStones: Dispatch<SetStateAction<StoneConfig[]>> }) {
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
          return showFeedback(`เพิ่ม ${stoneColorByName(payload.color).name} ลงใบเสนอราคาแล้ว`);
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
function Layout({ children, cart, setCart, stones, setStones, onAddToQuote, onRequestQuote, onLeadEvent }: { children: ReactNode; cart: QuoteBasinLine[]; setCart: Dispatch<SetStateAction<QuoteBasinLine[]>>; stones: StoneConfig[]; setStones: Dispatch<SetStateAction<StoneConfig[]>>; onAddToQuote: (sku: string) => void; onRequestQuote: (skus: string[]) => void; onLeadEvent: (status: "new_lead" | "selecting", productSkus?: string[]) => void }) {
  const count = cart.reduce((sum, line) => sum + line.quantity, 0) + stones.length;
  return <><Header cartCount={count} /><main>{children}</main><QuoteDropZone cart={cart} setCart={setCart} setStones={setStones} /><Footer /><KnightSupport onAddToQuote={onAddToQuote} onRequestQuote={onRequestQuote} onLeadEvent={onLeadEvent} /></>;
}

function ProductCard({ sku, cart, onToggle }: { sku: string; cart: QuoteBasinLine[]; onToggle: (sku: string) => void }) {
  const product = productBySku(sku)!;
  const isTall = product.category === "tall vertical washbasin";
  const inQuote = cart.find((line) => line.sku === sku);
  const toggle = () => onToggle(sku);
  return <article
    className={`product-card ${inQuote ? "is-selected" : ""}`}
    draggable
    role="checkbox"
    aria-checked={Boolean(inQuote)}
    tabIndex={0}
    onClick={toggle}
    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); } }}
    onDragStart={(event) => { event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("application/x-knight-type", "basin"); event.dataTransfer.setData("application/x-knight-basin", sku); }}
    data-testid={`card-product-${sku}`}
  >
     {inQuote && <span className="product-selected-badge" aria-label="เลือกแล้ว"><Check size={15} />✓</span>}
     <div className="product-art"><span className="product-index">{sku}</span><BasinVisual tone={product.imageTone} imageUrl={product.imageUrl} alt={`${product.sku} ${product.colorName}`} tall={isTall} /><span className="art-note">{isTall ? "VERTICAL SERIES" : "COUNTER SERIES"}</span>{product.videoUrl && <a className="product-video-link" href={product.videoUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><PlayCircle size={13} /> 3D 360°</a>}</div>
     <div className="product-info"><div><p className="eyebrow">{product.colorCode}</p><h3>{product.colorName}</h3></div></div>
     <div className="product-specs"><span>{product.dimensions}</span><span>{product.basinDimensions ? `หลุมอ่าง ${product.basinDimensions}` : "งานทรงสูง"}</span></div>
     <strong className="product-price">{formatTHB(product.priceTHB)}</strong>
  </article>;
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

function HomePage({ cart, setCart, categories }: { cart: QuoteBasinLine[]; setCart: Dispatch<SetStateAction<QuoteBasinLine[]>>; categories?: StorefrontCategory[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("catalog");
  const catalogCount = PRODUCTS.length;
  const visibleCategories = useMemo(() => {
    const persistedCategories = categories?.filter((item) => item.active !== false && item.name.trim()) ?? [];
    if (persistedCategories.length) return persistedCategories;
    return [...new Set(PRODUCTS.map((product) => product.category))].map((name, sortOrder) => ({ name, sortOrder }));
  }, [categories]);
  const categoryCounts = useMemo(() => new Map(
    visibleCategories.map((item) => [item.name, PRODUCTS.filter((product) => product.category === item.name).length]),
  ), [visibleCategories]);
   const toggle = (sku: string) => setCart((current) => toggleBasinSelection(current, sku));
  const filtered = useMemo(() => PRODUCTS.filter((product) => {
    const haystack = `${product.sku} ${product.colorCode} ${product.colorName}`.toLowerCase();
    return (category === "all" || product.category === category) && haystack.includes(query.toLowerCase());
  }).sort((a, b) => sort === "price-low" ? a.priceTHB - b.priceTHB : sort === "price-high" ? b.priceTHB - a.priceTHB : a.sku.localeCompare(b.sku)), [category, query, sort]);
   return <div className="page-wrap">
      <section className="catalog-hero"><div><p className="eyebrow accent">KNIGHT BASINS / 2026</p><h1>Knight Basins<br /><em>อ่างล้างหน้า by ไนท์ เฟอร์นิช</em></h1><p className="hero-copy">อ่างล้างหน้าหินสังเคราะห์ที่คัดสรรมาเพื่อพื้นที่ซึ่งต้องการความเรียบ ความทนทาน และรายละเอียดที่อยู่ได้นานกว่ากระแส</p><Link href="/stone" className="text-link" data-testid="link-hero-stone">ดูวัสดุหินสังเคราะห์ <ArrowRight size={16} /></Link></div><div className="hero-index"><span>01</span><div className="hero-line" /><span>{catalogCount} SKU</span></div></section>
     <section className="catalog-toolbar"><div><p className="eyebrow">THE BASIN INDEX</p><h2>ทุกทรง ทุกโทน <span>/ เลือกได้ชัดเจน</span></h2></div><div className="catalog-controls"><label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหา SKU หรือสี" data-testid="input-product-search" />{query && <button onClick={() => setQuery("")} aria-label="ล้างการค้นหา" data-testid="button-clear-search"><X size={14} /></button>}</label><div className="filter-tabs" role="tablist"><button className={category === "all" ? "is-active" : ""} onClick={() => setCategory("all")} data-testid="button-filter-all">ทั้งหมด {catalogCount}</button>{visibleCategories.map((item) => <button key={item.name} className={category === item.name ? "is-active" : ""} onClick={() => setCategory(item.name)} data-testid={categoryTestId(item.name)}>{categoryLabel(item.name)} {categoryCounts.get(item.name) ?? 0}</button>)}</div><label className="sort-field"><SlidersHorizontal size={14} /><select value={sort} onChange={(event) => setSort(event.target.value)} data-testid="select-sort"><option value="catalog">เรียงตามแคตตาล็อก</option><option value="price-low">ราคา: ต่ำไปสูง</option><option value="price-high">ราคา: สูงไปต่ำ</option></select><ChevronDown size={14} /></label></div></section>
     {filtered.length ? <section className="product-grid">{filtered.map((product) => <ProductCard key={product.sku} sku={product.sku} cart={cart} onToggle={toggle} />)}</section> : <div className="empty-state" data-testid="status-no-results"><span className="empty-number">—</span><h3>ไม่พบรายการที่ตรงกัน</h3><p>ลองใช้ SKU เช่น KF014 หรือค้นหาด้วยชื่อสี</p><button className="button button--outline" onClick={() => { setQuery(""); setCategory("all"); }} data-testid="button-reset-filters">แสดงสินค้าทั้งหมด</button></div>}
    <section className="catalog-note"><span className="note-mark">i</span><p>ราคาอ่างล้างหน้าทุกชิ้นยังไม่รวม VAT · ค่าดำเนินการติดตั้ง <strong>5,000 บาท/ชุด</strong> และฟรีค่าดำเนินการเมื่อสั่งตั้งแต่ 3 ชุดขึ้นไป</p><Link href="/quote" data-testid="link-catalog-note">ไปยังใบเสนอราคา <ArrowRight size={15} /></Link></section>
  </div>;
}

function StonePage({ stones, setStones }: { stones: StoneConfig[]; setStones: Dispatch<SetStateAction<StoneConfig[]>> }) {
  const [dimensionError, setDimensionError] = useState("");
  const [stoneQuery, setStoneQuery] = useState("");
  const [activeColor, setActiveColor] = useState(stones[0]?.color ?? defaultStone.color);
  const activeStone = stones.find((stone) => stone.color === activeColor) ?? { ...defaultStone, color: activeColor };
  const isWhole = activeStone.mode === "whole-sheet";
  const selectedColor = stoneColorByName(activeStone.color);
  const area = stoneAreaSqM(activeStone);
  const invalidInstalledSize = !isWhole && (activeStone.widthCm < 10 || activeStone.lengthCm < 10);
  const selectedPrice = stoneUnitPrice(activeStone);
  const visibleColors = useMemo(() => {
    const query = stoneQuery.trim().toLowerCase();
    if (!query) return STONE_COLORS;
    return STONE_COLORS.filter((color) =>
      [color.name, color.code, ...color.documentCodes].some((value) => value.toLowerCase().includes(query)),
    );
  }, [stoneQuery]);
  const update = (changes: Partial<StoneConfig>) => setStones((current) => {
    const next = { ...activeStone, ...changes, enabled: true };
    return upsertStone(current, next);
  });
  const toggleColor = (color: string) => {
    const selected = stones.some((stone) => stone.color === color);
    if (selected) {
      if (activeColor !== color) {
        setActiveColor(color);
        setDimensionError("");
        return;
      }
      setStones((current) => current.filter((stone) => stone.color !== color));
      if (activeColor === color) setActiveColor(stones.find((stone) => stone.color !== color)?.color ?? defaultStone.color);
      return;
    }
    const next = { ...defaultStone, color, enabled: true, unitPrice: stoneSheetUnitPrice(color, 1) ?? 0 };
    setActiveColor(color);
    setStones((current) => upsertStone(current, next));
    setDimensionError("");
  };
  const switchMode = (mode: StoneConfig["mode"]) => { update({ mode }); setDimensionError(""); };
  const validateDimensions = () => { if (!activeStone.widthCm || !activeStone.lengthCm || activeStone.widthCm < 10 || activeStone.lengthCm < 10) setDimensionError("กรุณาระบุความกว้างและความยาวอย่างน้อย 10 ซม. เพื่อคำนวณพื้นที่"); else setDimensionError(""); };
  return <div className="page-wrap stone-page"><section className="stone-hero"><div><p className="eyebrow accent">MATERIAL / CONFIGURATOR</p><h1>หินสังเคราะห์<br /><em>ตามพื้นที่ของคุณ</em></h1><p className="hero-copy">เริ่มจากแผ่นมาตรฐาน หรือบอกขนาดพื้นที่ที่ต้องการติดตั้ง ระบบจะจัดโครงสร้างราคาให้เห็นก่อนส่งต่อเป็นใบเสนอราคา</p></div><div className="material-swatch" style={{ background: selectedColor.tone }}><span>{selectedColor.code}</span></div></section>
    <div className="config-layout"><section className="config-main"><div className="section-heading"><span className="step">01</span><div><p className="eyebrow">CHOOSE FORMAT</p><h2>เลือกรูปแบบการสั่งซื้อ</h2></div></div><div className="mode-switch"><button className={isWhole ? "is-active" : ""} onClick={() => switchMode("whole-sheet")} data-testid="button-stone-whole-sheet"><span>แผ่นเต็ม</span><small>ราคาขายแผ่นมาตรฐาน</small></button><button className={!isWhole ? "is-active" : ""} onClick={() => switchMode("installed")} data-testid="button-stone-installed"><span>ตัดและติดตั้ง</span><small>ราคาต่อตารางเมตร รวมติดตั้ง</small></button></div>
        <div className="section-heading"><span className="step">02</span><div><p className="eyebrow">SURFACE TONE</p><h2>เลือกสีหิน <span>/ เลือกได้หลายสี</span></h2></div></div><div className="stone-search-row"><label className="search-field"><Search size={16} /><input value={stoneQuery} onChange={(event) => setStoneQuery(event.target.value)} placeholder="ค้นหาชื่อหรือรหัสสินค้า" data-testid="input-stone-search" />{stoneQuery && <button onClick={() => setStoneQuery("")} aria-label="ล้างการค้นหาหิน" data-testid="button-clear-stone-search"><X size={14} /></button>}</label><span>{stones.length} สีที่เลือก · {visibleColors.length} / {STONE_COLORS.length} รายการ</span></div><div className="stone-price-legend"><span>ราคาขายแผ่น</span><span>ราคารวมติดตั้ง</span></div><div className="stone-colors">{visibleColors.length ? visibleColors.map((color) => { const selected = stones.some((stone) => stone.color === color.code); return <button key={color.code} className={`${selected ? "is-active" : ""} ${activeColor === color.code ? "is-editing" : ""}`} onClick={() => toggleColor(color.code)} aria-pressed={selected} data-testid={`button-stone-color-${color.code}`}><span className="stone-card-image-wrap" style={{ background: color.tone }}>{color.imageUrl && <img className="stone-card-image" src={color.imageUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</span><strong>{color.name}</strong><small>{color.code}</small><small className="stone-card-prices">แผ่น {formatStonePrice(color.sheetPriceTHB)} · ติดตั้ง {formatStonePrice(color.installedPriceTHB)}</small>{selected && <Check size={14} />}</button>; }) : <div className="empty-state empty-state--stone"><span className="empty-number">—</span><p>ไม่พบสีหรือรหัสสินค้าที่ค้นหา</p></div>}</div>
       <div className="section-heading"><span className="step">03</span><div><p className="eyebrow">SIZE & QUANTITY</p><h2>{isWhole ? "จำนวนแผ่น" : "ขนาดพื้นที่"} <span>/ กำลังแก้ไข {selectedColor.code}</span></h2></div></div>{isWhole ? <div className="quantity-editor large"><button onClick={() => update({ quantity: Math.max(1, activeStone.quantity - 1) })} data-testid="button-stone-quantity-minus"><Minus size={16} /></button><strong data-testid="text-stone-quantity">{activeStone.quantity}</strong><button onClick={() => update({ quantity: activeStone.quantity + 1 })} data-testid="button-stone-quantity-plus"><Plus size={16} /></button><span>แผ่นมาตรฐาน / 760 × 3680 mm</span></div> : <div className="dimensions-form"><label>กว้าง (ซม.)<input type="number" min="10" value={activeStone.widthCm || ""} onChange={(event) => update({ widthCm: Number(event.target.value) })} onBlur={validateDimensions} data-testid="input-stone-width" /></label><span>×</span><label>ยาว (ซม.)<input type="number" min="10" value={activeStone.lengthCm || ""} onChange={(event) => update({ lengthCm: Number(event.target.value) })} onBlur={validateDimensions} data-testid="input-stone-length" /></label><div className="area-result"><small>พื้นที่รวม</small><strong>{area.toFixed(2)} m²</strong></div>{dimensionError && <p className="field-error" data-testid="status-stone-dimension-error">{dimensionError}</p>}</div>}</section>
         <aside className="config-summary" draggable={activeStone.enabled && !invalidInstalledSize && selectedPrice !== null} onDragStart={(event) => { if (!activeStone.enabled || invalidInstalledSize || selectedPrice === null) return; event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("application/x-knight-type", "stone"); event.dataTransfer.setData("application/x-knight-stone", JSON.stringify(activeStone)); }}><p className="eyebrow">CONFIGURATION NOTE</p><div className="summary-swatch" style={{ background: selectedColor.tone }} /><h3>{selectedColor.name}</h3><p className="muted">{isWhole ? "แผ่นเต็มมาตรฐาน" : "ตัดตามขนาดและติดตั้ง"} · {selectedColor.code}</p><div className="summary-divider" /><div className="summary-row"><span>{isWhole ? "ราคาขายแผ่น" : "ราคารวมติดตั้ง"}<small>{isWhole ? `${STONE_SHEET_SIZE} · ${STONE_SHEET_THICKNESS}` : "คิดตามพื้นที่แผ่นตัด"}</small></span><strong>{formatStonePrice(selectedPrice)} {isWhole ? "/ แผ่น" : "/ m²"}</strong></div>{!isWhole && <div className="summary-row"><span>ค่าแรงติดตั้ง</span><strong>{selectedPrice === null ? "ไม่มีราคา" : "รวมในราคาแล้ว"}</strong></div>}<div className="summary-total"><span>ประมาณการ</span><strong>{selectedPrice === null ? "—" : formatTHB(stoneTotal(activeStone))}</strong></div>{activeStone.enabled && !invalidInstalledSize && selectedPrice !== null && <p className="drag-summary-hint"><GripVertical size={14} /> ลากสรุปนี้ไปเพิ่มในใบเสนอราคา</p>}<Link href="/quote" className={`button button--dark full-width ${invalidInstalledSize || selectedPrice === null ? "is-disabled" : ""}`} onClick={(event) => { if (invalidInstalledSize) { event.preventDefault(); setDimensionError("กรุณาระบุความกว้างและความยาวอย่างน้อย 10 ซม. ก่อนเพิ่มลงใบเสนอราคา"); } else if (selectedPrice === null) { event.preventDefault(); setDimensionError("รายการนี้ไม่มีราคาในเอกสารราคา จึงยังเพิ่มในใบเสนอราคาไม่ได้"); } }} data-testid="link-stone-to-quote">ดูใบเสนอราคา <ArrowRight size={16} /></Link><p className="price-note">{selectedPrice === null ? "ไม่มีราคาของรูปแบบนี้ในเอกสารราคา จึงยังเพิ่มในใบเสนอราคาไม่ได้" : isWhole ? `ราคาขายแผ่นยังไม่รวม VAT และกาว 250 ml (${formatTHB(STONE_GLUE_PRICE)} / หลอด)` : `กรุงเทพฯ/ปริมณฑลขั้นต่ำ ${STONE_INSTALLED_MIN_BANGKOK_SQM} m² · ต่างจังหวัดขั้นต่ำ ${STONE_INSTALLED_MIN_PROVINCE_SQM} m²`}</p>{!isWhole && selectedPrice !== null && <p className="price-note">งานต่ำกว่าขั้นต่ำคิดค่าดำเนินการ {formatTHB(STONE_SMALL_JOB_BANGKOK_FEE)} ในกรุงเทพฯ หรือ {formatTHB(STONE_SMALL_JOB_PROVINCE_FEE)} ต่างจังหวัด</p>}</aside>
     </div><div className="source-note"><span>แหล่งอ้างอิง</span> ราคาขายแผ่นและราคารวมติดตั้งจากเอกสาร Knight Furnich ที่แนบมา · ราคายังไม่รวม VAT 7%</div></div>;
}

function QuoteStoneRow({ stone, onRemove }: { stone: StoneConfig; onRemove: (color: string) => void }) {
  const selectedStone = stoneColorByName(stone.color);
  const currentStoneUnitPrice = stoneUnitPrice(stone);
  return <div className="stone-line" data-testid={`row-quote-stone-${selectedStone.code}`}>
    <span className="stone-chip" style={{ background: selectedStone.tone }} />
    <div><strong>{selectedStone.name} · {selectedStone.code}</strong><small>{stone.mode === "whole-sheet" ? `${stone.quantity} แผ่นมาตรฐาน · ราคาขายแผ่น` : `พื้นที่ ${stoneAreaSqM(stone).toFixed(2)} m² · ราคารวมติดตั้ง`}</small></div>
    <strong className="line-price">{currentStoneUnitPrice === null ? "ไม่มีราคา" : formatTHB(stoneTotal(stone))}</strong>
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
  videoUrl?: string;
};

const COMPANY_DETAILS = {
  name: "บริษัท ไนท์ เฟอร์นิช จำกัด (สำนักงานใหญ่)",
  taxId: "0-1355-53014-11-4",
  address: "โรงงาน / สำนักงานใหญ่ ปทุมธานี",
  phones: "094-496-1949 · 089-762-2209",
  email: "info@knightfurnich.com",
  bank: "ธนาคารกรุงศรีอยุธยา · 574-1-18925-4",
};

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
  return <section className="formal-quote-sheet" data-testid="formal-quote-sheet">
    <header className="formal-quote-header">
      <div className="formal-company">
        <img src={knightFurnichLogo} alt="Knight Furnich" className="formal-company-logo" />
        <div>
          <h2>{COMPANY_DETAILS.name}</h2>
          <p>เลขประจำตัวผู้เสียภาษี {COMPANY_DETAILS.taxId}</p>
          <p>{COMPANY_DETAILS.address} · {COMPANY_DETAILS.phones}</p>
          <p>{COMPANY_DETAILS.email}</p>
        </div>
      </div>
      <div className="formal-quote-meta">
        <p className="eyebrow">FORMAL QUOTATION / {format}</p>
        <strong>{quoteNumber}</strong>
        <span>วันที่ออก {formatDate(issueDate)}</span>
        <span>ยืนราคา 30 วัน · ถึง {formatDate(expiryDate)}</span>
      </div>
    </header>

    <div className="formal-quote-title">
      <div>
        <p className="eyebrow">ใบเสนอราคาอย่างเป็นทางการ</p>
        <h1>{format === "US" ? "ใบเสนอราคา / สรุปตามพื้นที่" : "ใบเสนอราคา / รายละเอียดหน้างาน"}</h1>
      </div>
      <span className="formal-format-chip">{format} · {format === "US" ? "พื้นที่ / แผ่น" : "รายห้อง / จุดติดตั้ง"}</span>
    </div>

    <div className="formal-customer-grid">
      <div><span>บริษัท / สำนักงาน</span><strong>{customer.company || "—"}</strong></div>
      <div><span>เลขประจำตัวผู้เสียภาษีลูกค้า</span><strong>{customer.taxId || "—"}</strong></div>
      <div><span>ผู้ติดต่อ</span><strong>{customer.name || "—"}</strong></div>
      <div><span>ฝ่ายจัดซื้อ / บัญชี</span><strong>{customer.purchasingDepartment || "—"}</strong></div>
      <div><span>โทรศัพท์ · อีเมล</span><strong>{customer.phone || "—"} · {customer.email || "—"}</strong></div>
      <div><span>โครงการ / สถานที่ติดตั้ง (SITE)</span><strong>{customer.project || "—"} · {customer.site || customer.address || "—"}</strong></div>
      <div className="formal-customer-wide"><span>ที่อยู่ลูกค้า</span><strong>{customer.address || "—"}</strong></div>
    </div>

    <div className="formal-quote-table-wrap">
    <table className="formal-quote-table" data-testid="formal-quote-table">
      <thead><tr><th>รหัส</th><th>รายการรายละเอียด</th><th>จำนวน</th><th>หน่วย</th><th>ราคาต่อหน่วย</th><th>รวมเงิน</th><th className="formal-qr-column"><QrCode size={14} /> 3D</th></tr></thead>
      <tbody>{items.map((item) => <tr key={`${item.code}-${item.unit}`}>
        <td className="formal-code">{item.code}</td>
        <td>{item.description}</td>
        <td className="formal-number">{item.quantity.toLocaleString("th-TH", { maximumFractionDigits: 2 })}</td>
        <td>{item.unit}</td>
        <td className="formal-money">{formatTHB(item.unitPrice)}</td>
        <td className="formal-money">{formatTHB(item.total)}</td>
        <td className="formal-qr-column">{item.videoUrl && <a href={item.videoUrl} target="_blank" rel="noreferrer"><img src={quoteQrImageUrl(item.videoUrl)} alt={`QR วิดีโอ ${item.code}`} /><small>สแกนดู 360°</small></a>}</td>
      </tr>)}</tbody>
    </table>
    </div>

    <div className="formal-quote-bottom">
      <div className="formal-notes">
        <h3>เงื่อนไขและหมายเหตุ</h3>
        <p>• มัดจำ 50% เมื่อเซ็นอนุมัติใบเสนอราคา และชำระ 50% ก่อนเข้าติดตั้งอย่างน้อย 2 วันทำการ</p>
        <p>• ยอดสั่งซื้อไม่เกิน 40,000 บาท ชำระเต็มจำนวนก่อนเริ่มงาน</p>
        <p>• ราคานี้ยืนราคา 30 วัน และอาจเปลี่ยนแปลงเมื่อมีการปรับแบบหรือหน้างาน</p>
        <p>• ราคาหินสังเคราะห์เป็นไปตามรูปแบบ US หรือ OF ที่เลือก และยังไม่รวมงานนอกขอบเขต</p>
        <p>• ชำระเงินเข้าบัญชี {COMPANY_DETAILS.bank}</p>
        {customer.notes && <p>• หมายเหตุลูกค้า: {customer.notes}</p>}
      </div>
      <div className="formal-totals">
        <div><span>รวมก่อนส่วนลด</span><strong>{formatTHB(grossSubtotal)}</strong></div>
        <div><span>ส่วนลด / สิทธิ์ติดตั้งฟรี</span><strong>{discountAmount ? `-${formatTHB(discountAmount)}` : "—"}</strong></div>
        <div><span>รวมหลังส่วนลด</span><strong>{formatTHB(subtotal)}</strong></div>
        <div><span>ภาษีมูลค่าเพิ่ม 7% {vat ? "" : "(ยังไม่คิด)"}</span><strong>{formatTHB(vatAmount)}</strong></div>
        <div className="formal-grand-total"><span>จำนวนเงินสุทธิ</span><strong>{formatTHB(total)}</strong><small>{thaiNumberText(total)}</small></div>
      </div>
    </div>
    <footer className="formal-quote-signature"><span>ผู้เสนอราคา<br /><b>บริษัท ไนท์ เฟอร์นิช จำกัด</b></span><span>ผู้อนุมัติ / ลูกค้า<br /><b>ลงชื่อ ____________________</b></span></footer>
  </section>;
}

function QuotePage({ cart, setCart, stones, setStones, customer, setCustomer, vat, setVat, onSubmitQuote }: { cart: QuoteBasinLine[]; setCart: Dispatch<SetStateAction<QuoteBasinLine[]>>; stones: StoneConfig[]; setStones: Dispatch<SetStateAction<StoneConfig[]>>; customer: CustomerDetails; setCustomer: Dispatch<SetStateAction<CustomerDetails>>; vat: boolean; setVat: Dispatch<SetStateAction<boolean>>; onSubmitQuote: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [quoteFormat, setQuoteFormat] = useStored<QuoteFormat>("knight-quote-format", "US");
  const [quoteSerial] = useStored("knight-quote-serial", String(Math.floor(1000 + Math.random() * 8999)));
  const issueDate = useMemo(() => new Date(), []);
  const expiryDate = useMemo(() => new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000), [issueDate]);
  const quoteNumber = `${formatQuoteMonth(issueDate)} / ${quoteFormat} / ${quoteSerial}`;
  const basinSubtotal = cart.reduce((sum, line) => sum + (productBySku(line.sku)?.priceTHB || 0) * line.quantity, 0);
  const basinSets = cart.reduce((sum, line) => sum + line.quantity, 0);
  const requestedInstallationCharge = cart.reduce((sum, line) => sum + (line.installationSelected ? INSTALLATION_PRICE * line.quantity : 0), 0);
  const stoneActive = stones.length > 0;
  const totalStone = stones.reduce((sum, stone) => sum + stoneTotal(stone), 0);
  const { installationDiscount, installationCharge, grossSubtotal, subtotal, vatAmount, total } = calculateFormalQuoteTotals({ basinSubtotal, requestedInstallationCharge, basinSets, stoneTotal: totalStone, vat, vatRate: VAT_RATE });
  const hasMissing = !customer.name.trim() || !customer.phone.trim() || !customer.email.trim() || !customer.project.trim();
  const hasInvalidStone = stones.some(isInvalidStone);
  const canGenerate = !hasMissing && !hasInvalidStone && cart.length > 0;
  const formalItems: FormalQuoteItem[] = cart.map((line) => {
    const product = productBySku(line.sku)!;
    return {
      code: product.sku,
      description: `${product.colorName} · ${product.category === "counter basin" ? "อ่างวางเคาน์เตอร์" : "อ่างตั้งพื้น"} · ${product.dimensions}${product.basinDimensions ? ` · หลุม ${product.basinDimensions}` : ""}${quoteFormat === "OF" ? ` · จุดติดตั้ง ${customer.site || customer.project || "ตามแบบ"}` : ""}`,
      quantity: line.quantity,
      unit: "ชุด",
      unitPrice: product.priceTHB,
      total: product.priceTHB * line.quantity,
      videoUrl: product.videoUrl,
    };
  });
  if (requestedInstallationCharge > 0) formalItems.push({ code: "INSTALL", description: quoteFormat === "OF" ? `ค่าติดตั้ง / ค่าแรง แยกรายจุด · ${customer.site || customer.project || "ตามแบบ"}` : "ค่าติดตั้ง / ค่าแรงต่อชุด", quantity: requestedInstallationCharge / INSTALLATION_PRICE, unit: "ชุด", unitPrice: INSTALLATION_PRICE, total: requestedInstallationCharge });
  stones.forEach((stone) => {
    const selectedStone = stoneColorByName(stone.color);
    const currentStoneUnitPrice = stoneUnitPrice(stone);
    if (currentStoneUnitPrice === null || isInvalidStone(stone)) return;
    formalItems.push({
      code: selectedStone.code,
      description: `${selectedStone.name} · ${stone.mode === "whole-sheet" ? "แผ่นมาตรฐาน 760 × 3680 mm" : `ตัดและติดตั้ง ${stone.widthCm} × ${stone.lengthCm} cm`}`,
      quantity: stone.mode === "whole-sheet" ? stone.quantity : stoneAreaSqM(stone),
      unit: stone.mode === "whole-sheet" ? "แผ่น" : "ตร.ม.",
      unitPrice: currentStoneUnitPrice,
      total: stoneTotal(stone),
    });
  });
  const lineSummary = [
    `Knight Furnich ใบเสนอราคา ${quoteNumber}`,
    `รูปแบบ: ${quoteFormat === "US" ? "US / สรุปตามพื้นที่" : "OF / รายละเอียดหน้างาน"}`,
    `ผู้ติดต่อ: ${customer.name} · โครงการ: ${customer.project}`,
    `สินค้า: ${cart.map((line) => `${line.sku} x${line.quantity}`).join(", ") || "-"}`,
    `หินสังเคราะห์: ${stoneActive ? stones.map((stone) => `${stoneColorByName(stone.color).code} ${stone.mode === "whole-sheet" ? `${stone.quantity} แผ่น` : `${stoneAreaSqM(stone).toFixed(2)} m²`}`).join(", ") : "ไม่ได้เลือก"}`,
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
  const removeStone = (color: string) => setStones((current) => removeStoneSelection(current, color));
  const generateQuote = () => {
    if (!canGenerate) return;
    setSubmitted(true);
    onSubmitQuote();
  };
  const printQuote = () => {
    if (!canGenerate) {
      setSubmitted(true);
      return;
    }
    setSubmitted(true);
    onSubmitQuote();
    window.setTimeout(() => window.print(), 80);
  };
  const customerFields: Array<{ key: keyof CustomerDetails; label: string; placeholder: string; required?: boolean }> = [
    { key: "name", label: "ชื่อผู้ติดต่อ", placeholder: "เช่น คุณนรินทร์", required: true },
    { key: "company", label: "บริษัท / สำนักงาน", placeholder: "ถ้ามี" },
    { key: "taxId", label: "เลขประจำตัวผู้เสียภาษีลูกค้า", placeholder: "ถ้ามี" },
    { key: "phone", label: "โทรศัพท์", placeholder: "08x-xxx-xxxx", required: true },
    { key: "email", label: "อีเมล", placeholder: "name@company.com", required: true },
    { key: "purchasingDepartment", label: "ฝ่ายจัดซื้อ / บัญชี", placeholder: "ถ้ามี" },
    { key: "project", label: "ชื่อโครงการ", placeholder: "เช่น บ้านพักอาศัยสุขุมวิท", required: true },
    { key: "site", label: "สถานที่ติดตั้ง (SITE)", placeholder: "เช่น ห้องน้ำชั้น 2" },
  ];
  return <div className="page-wrap quote-page">
    <div className="quote-editor">
      <section className="quote-heading"><div><p className="eyebrow accent">QUOTE BUILDER / {quoteNumber}</p><h1>จากรายการ<br /><em>สู่ตัวเลขที่ชัดเจน</em></h1><p className="hero-copy">ตรวจสอบรายการ ปรับรายละเอียด และออกใบเสนอราคาทางการสำหรับโปรเจกต์ของคุณ</p></div><div className="quote-date"><span>วันที่ออกเอกสาร</span><strong>{formatDate(issueDate)}</strong><small>ใช้ได้ถึง {formatDate(expiryDate)} · 30 วัน</small><button onClick={printQuote} data-testid="button-print-quote"><Printer size={15} /> พิมพ์ / PDF ทางการ</button></div></section>
      <section className="quote-format-panel"><div><p className="eyebrow">DOCUMENT FORMAT</p><strong>เลือกรูปแบบใบเสนอราคา</strong><small>US สรุปตามพื้นที่/แผ่น · OF แยกรายห้อง/จุดติดตั้ง</small></div><div className="quote-format-switch"><button className={quoteFormat === "US" ? "is-active" : ""} onClick={() => setQuoteFormat("US")} data-testid="button-quote-format-us"><span>US</span><small>พื้นที่ / แผ่น</small></button><button className={quoteFormat === "OF" ? "is-active" : ""} onClick={() => setQuoteFormat("OF")} data-testid="button-quote-format-of"><span>OF</span><small>รายห้อง / จุด</small></button></div></section>
      <div className="quote-layout"><section className="quote-main"><div className="quote-block"><div className="block-header"><div><p className="eyebrow">01 / BASINS</p><h2>รายการอ่างล้างหน้า</h2></div><Link href="/" className="text-link" data-testid="link-add-more">เพิ่มรายการ <Plus size={15} /></Link></div>{cart.length ? cart.map((line) => { const product = productBySku(line.sku)!; return <div className="quote-line" key={line.sku} data-testid={`row-quote-${line.sku}`}><BasinVisual tone={product.imageTone} imageUrl={product.imageUrl} alt={`${product.sku} ${product.colorName}`} tall={product.category === "tall vertical washbasin"} /><div className="quote-line-name"><span className="eyebrow">{product.sku} / {product.colorCode}</span><strong>{product.colorName}</strong><small>{product.category === "counter basin" ? "เคาน์เตอร์" : "ทรงสูง"} · {product.dimensions}</small></div><div className="line-quantity"><button onClick={() => updateLine(line.sku, { quantity: line.quantity - 1 })} aria-label={`ลดจำนวน ${line.sku}`} data-testid={`button-quantity-minus-${line.sku}`}><Minus size={13} /></button><span data-testid={`text-quantity-${line.sku}`}>{line.quantity}</span><button onClick={() => updateLine(line.sku, { quantity: line.quantity + 1 })} aria-label={`เพิ่มจำนวน ${line.sku}`} data-testid={`button-quantity-plus-${line.sku}`}><Plus size={13} /></button></div><label className="install-toggle"><input type="checkbox" checked={line.installationSelected} onChange={(event) => updateLine(line.sku, { installationSelected: event.target.checked })} data-testid={`input-installation-${line.sku}`} /><span />ติดตั้ง</label><strong className="line-price">{formatTHB(product.priceTHB * line.quantity)}</strong><button className="icon-button" onClick={() => setCart((lines) => lines.filter((item) => item.sku !== line.sku))} aria-label={`ลบ ${line.sku}`} data-testid={`button-remove-${line.sku}`}><Trash2 size={15} /></button></div>; }) : <div className="quote-empty" data-testid="status-quote-empty"><ShoppingBag size={22} /><p>ยังไม่มีสินค้าในใบเสนอราคา</p><Link href="/" className="text-link" data-testid="link-empty-catalog">เลือกจากแคตตาล็อก <ArrowRight size={15} /></Link></div>}<div className="install-note">ค่าติดตั้งอ่าง <strong>5,000 บาท/ชุด</strong> · ฟรีค่าดำเนินการติดตั้งเมื่อสั่งตั้งแต่ 3 ชุดขึ้นไป</div></div>
           <div className="quote-block"><div className="block-header"><div><p className="eyebrow">02 / STONE</p><h2>หินสังเคราะห์</h2></div><Link href="/stone" className="text-link" data-testid="link-edit-stone">{stoneActive ? "แก้ไขการกำหนดค่า" : "เพิ่มหินสังเคราะห์"} <ArrowRight size={15} /></Link></div>{stoneActive ? stones.map((stone) => <QuoteStoneRow key={stone.color} stone={stone} onRemove={removeStone} />) : <div className="quote-empty quote-empty--compact" data-testid="status-stone-empty"><p>ยังไม่ได้เลือกหินสังเคราะห์</p><Link href="/stone" className="text-link" data-testid="link-empty-stone">เลือกสีและรูปแบบการสั่งซื้อ <ArrowRight size={15} /></Link></div>}</div>
          <div className="quote-block customer-block"><div className="block-header"><div><p className="eyebrow">03 / CUSTOMER</p><h2>ข้อมูลลูกค้าและหน้างาน</h2></div>{hasMissing && <span className="missing-badge" data-testid="status-customer-missing">กรุณากรอกข้อมูลที่จำเป็น</span>}</div><div className="customer-grid">{customerFields.map((field) => <label key={field.key}>{field.label}{field.required && <sup>*</sup>}<input value={customer[field.key] ?? ""} placeholder={field.placeholder} onChange={(event) => setCustomer((current) => ({ ...current, [field.key]: event.target.value }))} data-testid={`input-customer-${field.key}`} /></label>)}<label className="span-2">ที่อยู่ลูกค้า / สถานที่จัดส่ง<textarea value={customer.address ?? ""} onChange={(event) => setCustomer((current) => ({ ...current, address: event.target.value }))} data-testid="input-customer-address" /></label><label className="span-2">หมายเหตุเพิ่มเติม<textarea value={customer.notes ?? ""} onChange={(event) => setCustomer((current) => ({ ...current, notes: event.target.value }))} data-testid="input-customer-notes" /></label></div></div>
         </section><aside className="quote-summary"><p className="eyebrow">04 / TOTAL</p><h2>สรุปใบเสนอราคา</h2><div className="total-rows"><div><span>สินค้าอ่างล้างหน้า <small>{basinSets} ชุด</small></span><strong>{formatTHB(basinSubtotal)}</strong></div><div><span>ค่าติดตั้งอ่าง</span><strong className={installationCharge === 0 ? "free-text" : ""}>{installationCharge === 0 ? "ฟรี" : formatTHB(installationCharge)}</strong></div>{stoneActive && <div><span>หินสังเคราะห์ <small>{stones.length} สี · อ้างอิงราคาจากเอกสาร</small></span><strong>{hasInvalidStone ? "ตรวจสอบรายการ" : formatTHB(totalStone)}</strong></div>}<div className="discount-row"><span>ส่วนลด / สิทธิ์ติดตั้งฟรี</span><strong>{installationDiscount ? `-${formatTHB(installationDiscount)}` : "—"}</strong></div></div><div className="vat-row"><label><input type="checkbox" checked={vat} onChange={(event) => setVat(event.target.checked)} data-testid="input-vat" /><span />คิด VAT 7%</label><strong>{formatTHB(vatAmount)}</strong></div><div className="grand-total"><span>ยอดรวมทั้งสิ้น</span><strong data-testid="text-grand-total">{formatTHB(total)}</strong><small>{thaiNumberText(total)}</small></div><button className="button button--accent full-width" onClick={generateQuote} data-testid="button-generate-quote">{submitted && canGenerate ? <><Check size={16} /> สร้างใบเสนอราคาแล้ว</> : <>ออกใบเสนอราคาทางการ <ArrowRight size={16} /></>}</button>{hasMissing && <p className="summary-warning" data-testid="status-quote-validation">กรอกชื่อผู้ติดต่อ โทรศัพท์ อีเมล และชื่อโครงการ เพื่อสร้างใบเสนอราคาที่สมบูรณ์</p>}{hasInvalidStone && <p className="summary-warning" data-testid="status-quote-stone-validation">กลับไปหน้าหินสังเคราะห์และกรอกขนาดอย่างน้อย 10 × 10 ซม. หรือเลือกสีที่มีราคาในเอกสาร ก่อนสร้างใบเสนอราคา</p>}{!cart.length && <p className="summary-warning" data-testid="status-quote-cart-validation">เพิ่มสินค้าอย่างน้อย 1 รายการก่อนออกใบเสนอราคา</p>}{submitted && canGenerate && <div className="success-message" data-testid="status-quote-success"><Check size={16} /> {quoteNumber} พร้อมพิมพ์หรือบันทึกเป็น PDF</div>}<div className="quote-share"><strong>ยืนยันแบบ / ขอให้ทีมงานติดต่อกลับ</strong><p>กดคัดลอกข้อความสำหรับส่งทาง LINE หรือเปิด LINE เพื่อส่งต่อได้ทันที</p><div className="quote-share-actions"><button type="button" className="button button--dark" onClick={copyLineSummary} data-testid="button-copy-line-summary">{copied ? <><Check size={15} /> คัดลอกแล้ว</> : "คัดลอกสรุปส่ง LINE"}</button><a className="button button--outline" href={`https://line.me/R/msg/text/?text=${encodeURIComponent(lineSummary)}`} target="_blank" rel="noreferrer" data-testid="link-send-line-summary">เปิด LINE</a></div></div><div className="quote-terms"><strong>หมายเหตุจากแคตตาล็อก</strong><p>ราคาสินค้าไม่รวม VAT · หินตัดและติดตั้งใช้อัตรารวมติดตั้งแล้ว · งานหินต่ำกว่าพื้นที่ขั้นต่ำอาจมีค่าดำเนินการเพิ่มตามพื้นที่</p></div></aside></div>
    </div>
    {submitted && canGenerate && <FormalQuote format={quoteFormat} quoteNumber={quoteNumber} issueDate={issueDate} expiryDate={expiryDate} customer={customer} items={formalItems} grossSubtotal={grossSubtotal} discountAmount={installationDiscount} subtotal={subtotal} vatAmount={vatAmount} total={total} vat={vat} />}
    <div className="source-note">ข้อมูลสินค้าจาก Knight Basins Catalogue Part 1–2 · ราคาหินอ้างอิงจากเอกสารราคาขายแผ่นและราคารวมติดตั้งของ Knight Furnich</div>
  </div>;
}

import AdminApp from "./admin/AdminApp";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import knightFurnichLogo from "@assets/Knightfurnich-logo_1789302266220.png";
import { useGetCatalog, useUpsertLead } from "@workspace/api-client-react";
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

function OrderModeTabs({ mode, setMode }: { mode: StudioOrderMode; setMode: Dispatch<SetStateAction<StudioOrderMode>> }) {
  return <div className="order-mode-tabs" role="tablist" aria-label="รูปแบบการสั่งซื้อ">
    {([
      ["quick-purchase", "ซื้อด่วนจากแคตตาล็อก", "เลือกสินค้าและเพิ่มลงใบเสนอราคา"],
      ["studio", "ออกแบบใน 2D Studio", "กำหนดขนาดและจัดวางอ่าง"],
      ["sketch", "ส่งแบบร่างด้วยมือ", "แนบภาพให้ทีมขายช่วยดูแบบ"],
    ] as const).map(([value, label, description]) => <button type="button" key={value} role="tab" aria-selected={mode === value} className={mode === value ? "is-active" : ""} onClick={() => setMode(value)} data-testid={`button-order-mode-${value}`}><strong>{label}</strong><small>{description}</small></button>)}
  </div>;
}

function Storefront() {
  const { data: remoteCatalog } = useGetCatalog();
  const [, setCatalogRevision] = useState(0);
  const [cart, setCart] = useStored<QuoteBasinLine[]>("knight-cart", []);
  const [stones, setStones] = useStoredStones("knight-stones", []);
  const [customer, setCustomer] = useStored<CustomerDetails>("knight-customer", emptyCustomer);
  const [vat, setVat] = useStored<boolean>("knight-vat", true);
  const [orderMode, setOrderMode] = useState<StudioOrderMode>("quick-purchase");
  const [leadKey] = useStored("knight-lead-key", `lead-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [, setLocation] = useLocation();
  const upsertLead = useUpsertLead();
  useEffect(() => {
    if (!remoteCatalog) return;
     PRODUCTS.splice(0, PRODUCTS.length, ...remoteCatalog.basins.map(basinProductFromCatalog));

    const installedByCode = new Map(remoteCatalog.installedStones.map((item) => [item.code, item]));
    const sheetByCode = new Map(remoteCatalog.sheetStones.map((item) => [item.code, item]));
    const codes = [...new Set([...installedByCode.keys(), ...sheetByCode.keys()])];
    STONE_COLORS.splice(0, STONE_COLORS.length, ...codes.map((code) => {
      const installed = installedByCode.get(code);
      const sheet = sheetByCode.get(code);
      const source = installed ?? sheet!;
      return {
        code,
        name: source.name,
        tone: source.tone,
        sheetPriceTHB: sheet?.basePriceTHB ?? null,
        installedPriceTHB: installed?.pricePerSqmTHB ?? null,
        documentCodes: [...new Set([...(installed?.aliases ?? []), ...(sheet?.aliases ?? [])])],
        imageUrl: installed?.imageUrl ?? sheet?.imageUrl,
      };
    }));
    setCatalogRevision((revision) => revision + 1);
  }, [remoteCatalog]);
  const addToQuote = (sku: string) => setCart((current) => current.some((line) => line.sku === sku) ? current.map((line) => line.sku === sku ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { sku, quantity: 1, installationSelected: false }]);
  const syncLead = (status: "new_lead" | "selecting" | "quote_requested", source: string, details: Partial<CustomerDetails> & { productSkus?: string[]; orderMode?: StudioOrderMode; studioData?: unknown } = {}) => {
    upsertLead.mutate({
      data: {
        leadKey,
        status,
        source,
        productSkus: [...new Set(details.productSkus ?? cart.map((line) => line.sku))],
        name: details.name ?? (customer.name || null),
        company: details.company ?? (customer.company || null),
        phone: details.phone ?? (customer.phone || null),
        email: details.email ?? (customer.email || null),
        project: details.project ?? (customer.project || null),
        address: details.address ?? (customer.address || null),
        notes: details.notes ?? (customer.notes || null),
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
  const submitQuote = () => syncLead("quote_requested", "quote_builder");
  const submitStudio = ({ state, estimate, contact }: StudioSubmission) => {
    setCustomer((current) => ({ ...current, ...contact }));
    syncLead("quote_requested", "studio", { ...contact, productSkus: state.basinSkus, orderMode: "studio", studioData: { state, estimate } });
  };
  return <Layout cart={cart} setCart={setCart} stones={stones} setStones={setStones} onAddToQuote={addToQuote} onRequestQuote={requestQuote} onLeadEvent={leadEvent}><Switch><Route path="/"><OrderModeTabs mode={orderMode} setMode={setOrderMode} />{orderMode === "quick-purchase" ? <HomePage cart={cart} setCart={setCart} categories={remoteCatalog?.categories} /> : <StudioPage mode={orderMode} leadKey={leadKey} onSubmitStudio={submitStudio} />}</Route><Route path="/stone"><StonePage stones={stones} setStones={setStones} /></Route><Route path="/quote"><QuotePage cart={cart} setCart={setCart} stones={stones} setStones={setStones} customer={customer} setCustomer={setCustomer} vat={vat} setVat={setVat} onSubmitQuote={submitQuote} /></Route><Route><div className="empty-state"><span className="empty-number">404</span><h3>ไม่พบหน้านี้</h3><Link href="/" className="text-link" data-testid="link-not-found-home">กลับไปแคตตาล็อก <ArrowRight size={15} /></Link></div></Route></Switch></Layout>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/admin" component={AdminApp} />
        <Route path="/admin/*" component={AdminApp} />
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
