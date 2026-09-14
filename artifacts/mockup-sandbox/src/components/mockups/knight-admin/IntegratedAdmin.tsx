import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Edit3,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  MessageCircle,
  Package,
  Search,
  Settings2,
  ShieldCheck,
  Video,
  X,
} from "lucide-react";
import "./_group.css";

type Section = "overview" | "basins" | "installed" | "sheets";
type CatalogRow = {
  id: number;
  code: string;
  name: string;
  detail: string;
  price: number;
  secondary?: number;
  status: boolean;
  tone: string;
  videoUrl?: string;
  imageUrl?: string;
  bowlMm?: string | null;
};

const basinVideoUrl = (code: string) => `https://api.srv1964473.hstgr.cloud/kb/images/basin-videos/${code}.mp4`;
const slabImageUrl = (code: string) => `https://api.srv1964473.hstgr.cloud/kb/images/slab/${code}.png`;

const basins: CatalogRow[] = [
  { id: 1, code: "KF001", name: "Snow White", detail: "เคาน์เตอร์ · 500 × 500 × 150 มม.", price: 8900, status: true, tone: "#f2f4f1", videoUrl: basinVideoUrl("KF001") },
  { id: 2, code: "KF002", name: "Cloud Grey", detail: "เคาน์เตอร์ · 600 × 450 × 150 มม.", price: 9700, status: true, tone: "#d7dbda", videoUrl: basinVideoUrl("KF002") },
  { id: 3, code: "KF003", name: "Warm Sand", detail: "ทรงกลม · Ø350 × 150 มม.", price: 10100, status: true, tone: "#d8c9b5", videoUrl: basinVideoUrl("KF003"), bowlMm: "Ø350 × 150" },
  { id: 4, code: "KF004", name: "Ivory Mist", detail: "ทรงเหลี่ยม · 500 × 500 × 850 มม.", price: 14800, status: true, tone: "#e6e1d6", videoUrl: basinVideoUrl("KF004") },
  { id: 5, code: "KF006", name: "Pebble White", detail: "เคาน์เตอร์ · 550 × 400 × 150 มม.", price: 10500, status: true, tone: "#e2e6e3", videoUrl: basinVideoUrl("KF006") },
  { id: 6, code: "KF008", name: "Deep Ocean", detail: "เคาน์เตอร์ · 600 × 450 × 150 มม.", price: 11900, status: false, tone: "#7894a6", videoUrl: basinVideoUrl("KF008") },
];

const installedStones: CatalogRow[] = [
  { id: 101, code: "BW010", name: "Arctic White", detail: "ติดตั้ง · สีพื้นเรียบ", price: 4200, status: true, tone: "#e9eeec", imageUrl: slabImageUrl("BW010") },
  { id: 102, code: "BW011", name: "Snow Drift", detail: "ติดตั้ง · ลายละเอียด", price: 4550, status: true, tone: "#dfe5e5", imageUrl: slabImageUrl("BW011") },
  { id: 103, code: "BW012", name: "Cotton Cloud", detail: "ติดตั้ง · สีพื้นเรียบ", price: 3980, status: true, tone: "#f0efea", imageUrl: slabImageUrl("BW012") },
  { id: 104, code: "BW020", name: "Silver Veil", detail: "ติดตั้ง · ลายหินอ่อน", price: 4850, status: true, tone: "#bfc8cb", imageUrl: slabImageUrl("BW020") },
  { id: 105, code: "BW031", name: "Stone Ash", detail: "ติดตั้ง · โทนเทา", price: 5100, status: true, tone: "#989b9a", imageUrl: slabImageUrl("BW031") },
  { id: 106, code: "BW044", name: "Night Tide", detail: "ติดตั้ง · โทนเข้ม", price: 5750, status: false, tone: "#53606a", imageUrl: slabImageUrl("BW044") },
];

const sheetStones: CatalogRow[] = [
  { id: 201, code: "BW010", name: "Arctic White", detail: "แผ่นเต็ม · 760 × 3680 มม.", price: 14800, secondary: 14100, status: true, tone: "#e9eeec", imageUrl: slabImageUrl("BW010") },
  { id: 202, code: "BW011", name: "Snow Drift", detail: "แผ่นเต็ม · 760 × 3680 มม.", price: 15900, secondary: 15100, status: true, tone: "#dfe5e5", imageUrl: slabImageUrl("BW011") },
  { id: 203, code: "BW020", name: "Silver Veil", detail: "แผ่นเต็ม · 760 × 3680 มม.", price: 17600, secondary: 16700, status: true, tone: "#bfc8cb", imageUrl: slabImageUrl("BW020") },
  { id: 204, code: "BW031", name: "Stone Ash", detail: "แผ่นเต็ม · 760 × 3680 มม.", price: 18400, secondary: 17500, status: true, tone: "#989b9a", imageUrl: slabImageUrl("BW031") },
  { id: 205, code: "BW044", name: "Night Tide", detail: "แผ่นเต็ม · 760 × 3680 มม.", price: 19900, secondary: 18900, status: true, tone: "#53606a", imageUrl: slabImageUrl("BW044") },
  { id: 206, code: "BW052", name: "Cedar Vein", detail: "แผ่นเต็ม · 760 × 3680 มม.", price: 21500, secondary: 20400, status: false, tone: "#a99889", imageUrl: slabImageUrl("BW052") },
];

const topBasins = [
  { code: "KF001", name: "Snow White", detail: "วางเคาน์เตอร์ · 500 × 500 มม.", tone: "#f2f4f1" },
  { code: "KF020", name: "Soft Curve", detail: "ตั้งพื้นทรงเหลี่ยม · 420 × 820 มม.", tone: "#d7dbda" },
  { code: "KF023", name: "Round Tide", detail: "ตั้งพื้นทรงกลม · Ø350 × 150 มม.", tone: "#bfc8cb" },
];

const groupMeta: Record<Section, { label: string; count: number; eyebrow: string; description: string }> = {
  overview: { label: "ภาพรวม", count: 0, eyebrow: "WORKBENCH / OVERVIEW", description: "ศูนย์รวมอ่างล้างหน้าและวัสดุหินสังเคราะห์" },
  basins: { label: "อ่างล้างหน้า", count: 30, eyebrow: "01 / BASINS", description: "ราคาและข้อมูลอ่างล้างหน้าหินสังเคราะห์ทั้ง 30 รายการ" },
  installed: { label: "หิน · พร้อมติดตั้ง", count: 71, eyebrow: "02 / INSTALLED STONES", description: "ราคาหินสังเคราะห์แบบตัดตามพื้นที่ พร้อมงานติดตั้ง" },
  sheets: { label: "หิน · ขายแผ่น", count: 73, eyebrow: "03 / SHEET STONES", description: "ราคาขายหินสังเคราะห์เป็นแผ่น แยกตามจำนวนสั่งซื้อ" },
};

const sections: { key: Section; label: string; count?: number; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "ภาพรวม", icon: LayoutDashboard },
  { key: "basins", label: "อ่างล้างหน้า", count: 30, icon: Package },
  { key: "installed", label: "หิน · พร้อมติดตั้ง", count: 71, icon: Settings2 },
  { key: "sheets", label: "หิน · ขายแผ่น", count: 73, icon: FileText },
];

function formatPrice(value: number) {
  return value.toLocaleString("th-TH");
}

function Navigation({ active, onChange }: { active: Section; onChange: (section: Section) => void }) {
  return (
    <>
      <aside className="ka-sidebar">
        <p className="ka-side-kicker">CATALOGUE CONTROL</p>
        <nav className="ka-nav" aria-label="เมนูจัดการข้อมูล">
          {sections.map(({ key, label, count, icon: Icon }) => (
            <button className={`ka-nav-button ${active === key ? "is-active" : ""}`} key={key} onClick={() => onChange(key)}>
              <span className="ka-nav-icon"><Icon size={16} strokeWidth={1.7} /></span>
              <span className="ka-nav-label">{label}</span>
              {count && <span className="ka-nav-count">{count}</span>}
            </button>
          ))}
        </nav>
        <div className="ka-side-note">
          <strong>โหมดจัดการส่วนตัว</strong>
          ข้อมูลชุดนี้จะแสดงกับลูกค้าเมื่อกด “บันทึกและเผยแพร่” เท่านั้น
        </div>
      </aside>
      <nav className="ka-mobile-nav" aria-label="เมนูจัดการข้อมูลบนมือถือ">
        {sections.map(({ key, label, count, icon: Icon }) => (
          <button className={`ka-mobile-nav-button ${active === key ? "is-active" : ""}`} key={key} onClick={() => onChange(key)}>
            <Icon size={14} /> {label} {count ? `· ${count}` : ""}
          </button>
        ))}
      </nav>
    </>
  );
}

function Header({ onCustomerView, onChat, onLineLogin }: { onCustomerView: () => void; onChat: () => void; onLineLogin: () => void }) {
  return (
    <>
      <div className="ka-topline">
        <strong>KNIGHT FURNICH / PRIVATE WORKBENCH</strong>
        <span>เจ้าของร้านเท่านั้น · เซสชันปลอดภัย</span>
      </div>
      <header className="ka-header">
        <div className="ka-brand">
          <img src="/__mockup/images/knight-furnich-logo.png" alt="Knight Furnich" />
          <div className="ka-brand-copy">
            <strong>KNIGHT FURNICH</strong>
            <span>CATALOGUE MANAGEMENT</span>
          </div>
        </div>
        <div className="ka-header-right">
          <button className="ka-back" onClick={onCustomerView}><ArrowLeft size={15} /> กลับไปแคตตาล็อก</button>
          <button className="ka-line-login" onClick={onLineLogin}>LINE Login</button>
          <button className="ka-support-button" onClick={onChat}><MessageCircle size={15} /><span className="ka-support-label">KnightSupport</span></button>
          <div className="ka-profile" aria-label="บัญชีเจ้าของร้าน">
            <span className="ka-avatar">KF</span>
            <span>
              <strong>ผู้ดูแลระบบ</strong>
              <span>จัดการราคา</span>
            </span>
          </div>
        </div>
      </header>
    </>
  );
}

function Status({ active }: { active: boolean }) {
  return <span className={`ka-status ${active ? "" : "off"}`}><i />{active ? "เปิดแสดง" : "ซ่อนอยู่"}</span>;
}

function StatCards({ onSection }: { onSection: (section: Section) => void }) {
  return (
    <div className="ka-stat-grid">
      <button className="ka-stat" onClick={() => onSection("basins")}>
        <span className="ka-stat-mark">01 / 04</span>
        <div className="ka-stat-label">อ่างล้างหน้าในแคตตาล็อก</div>
        <div className="ka-stat-value">30 <small>รายการ</small></div>
          <div className="ka-stat-meta">เคาน์เตอร์ 18 · ตั้งพื้นเหลี่ยม 8 · กลม 4</div>
      </button>
      <button className="ka-stat" onClick={() => onSection("installed")}>
        <span className="ka-stat-mark">M²</span>
        <div className="ka-stat-label">หินพร้อมติดตั้ง</div>
        <div className="ka-stat-value">71 <small>สี</small></div>
        <div className="ka-stat-meta">ราคา / ตารางเมตร</div>
      </button>
      <button className="ka-stat" onClick={() => onSection("sheets")}>
        <span className="ka-stat-mark">SHEET</span>
        <div className="ka-stat-label">หินขายเป็นแผ่น</div>
        <div className="ka-stat-value">73 <small>สี</small></div>
        <div className="ka-stat-meta">แบ่งราคาตามจำนวนสั่ง</div>
      </button>
    </div>
  );
}

function Overview({ onSection }: { onSection: (section: Section) => void }) {
  return (
    <>
      <div className="ka-page-heading">
        <div>
          <p className="ka-eyebrow">{groupMeta.overview.eyebrow}</p>
           <h1>ศูนย์รวมอ่างล้างหน้า<br /><em>และวัสดุหินสังเคราะห์</em></h1>
           <p>ตรวจสอบราคา รุ่นสินค้า และสื่อประกอบที่พร้อมไปอยู่หน้าแคตตาล็อก · ราคายังไม่รวม VAT 7%</p>
        </div>
        <span className="ka-updated"><i className="ka-dot" />อัปเดตล่าสุด วันนี้ 10:42</span>
      </div>
      <StatCards onSection={onSection} />
       <div className="ka-basin-breakdown">
         <div><span className="ka-eyebrow">BASIN MIX / 30 MODELS</span><strong>อ่างล้างหน้าในร้าน</strong></div>
         <div className="ka-breakdown-item"><b>18</b><span>วางเคาน์เตอร์</span></div>
         <div className="ka-breakdown-item"><b>8</b><span>ตั้งพื้นทรงเหลี่ยม</span></div>
         <div className="ka-breakdown-item"><b>4</b><span>ตั้งพื้นทรงกลม</span></div>
         <button className="ka-button ghost" onClick={() => onSection("basins")}>เปิดรายการอ่าง <ChevronRight size={14} /></button>
       </div>
       <div className="ka-section-strip ka-top-basins-heading">
         <div><h2>อ่างรุ่นยอดนิยม <span>TOP BASINS</span></h2><span>สามรุ่นที่ถูกเลือกดูบ่อย พร้อมวิดีโอ 3D 360°</span></div>
         <button className="ka-button ghost" onClick={() => onSection("basins")}>ดูทั้ง 30 รุ่น <ChevronRight size={14} /></button>
       </div>
       <div className="ka-top-basins">
         {topBasins.map((basin) => (
           <article className="ka-top-basin" key={basin.code}>
             <div className="ka-top-basin-art" style={{ background: `linear-gradient(145deg, ${basin.tone}, #edf6fb)` }}><span>{basin.code}</span><Video size={17} /></div>
             <div className="ka-top-basin-copy"><div><strong>{basin.name}</strong><span>{basin.detail}</span></div><span className="ka-video-badge"><Video size={11} /> 3D 360°</span></div>
           </article>
         ))}
       </div>
      <div className="ka-section-strip">
        <div><h2>กิจกรรมล่าสุด</h2><span>ตรวจสอบการเปลี่ยนแปลงก่อนเผยแพร่</span></div>
        <button className="ka-button ghost" onClick={() => onSection("installed")}>ดูตารางราคาหลัก <ChevronRight size={14} /></button>
      </div>
      <div className="ka-overview-grid">
        <div className="ka-activity-card">
          <div className="ka-card-heading"><h3>บันทึกการทำงาน</h3><span>วันนี้ / 4 รายการ</span></div>
          <div className="ka-activity"><span className="ka-activity-icon"><CircleDollarSign size={15} /></span><div><strong>อัปเดตราคา BW010</strong><p>หินพร้อมติดตั้ง · 4,200 บาท / ตร.ม.</p></div><time>10:42</time></div>
          <div className="ka-activity"><span className="ka-activity-icon"><CheckCircle2 size={15} /></span><div><strong>เผยแพร่ราคาอ่างล้างหน้า</strong><p>ข้อมูลล่าสุดแสดงบนแคตตาล็อกแล้ว</p></div><time>09:18</time></div>
          <div className="ka-activity"><span className="ka-activity-icon"><Edit3 size={15} /></span><div><strong>แก้ไขชื่อสี KF004</strong><p>เปลี่ยนเป็น Ivory Mist</p></div><time>เมื่อวาน</time></div>
        </div>
        <div className="ka-quiet-card">
          <p className="ka-eyebrow">STUDIO NOTE / 06</p>
           <h3>อ่างล้างหน้าหินสังเคราะห์หล่อขึ้นรูปชิ้นเดียว สวย ทนทาน ไร้รอยต่อ</h3>
          <div className="ka-quiet-line" />
           <p>ตรวจสอบชื่อรุ่น ขนาด รหัสสินค้า สื่อ 3D และราคาให้ตรงกับเอกสารต้นฉบับก่อนส่งต่อให้ลูกค้า</p>
        </div>
      </div>
       <div className="ka-data-rule-strip"><span>DATA RULES</span><strong>Ø คงรูปแบบขนาดทรงกลม</strong><span>KF029 / KF030 · bowl_mm = null เมื่อเอกสารไม่ระบุ</span><span>ลบไม่ได้ · ใช้ Archived แทน</span></div>
    </>
  );
}

function CatalogTable({ section, overrides, onEdit, onToggle, onVideo, onNotice }: { section: Section; overrides: Record<number, { price: number; active: boolean }>; onEdit: (row: CatalogRow) => void; onToggle: (row: CatalogRow) => void; onVideo: (row: CatalogRow) => void; onNotice: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const rows = section === "basins" ? basins : section === "installed" ? installedStones : sheetStones;
  const effectiveRows = rows.map((row) => ({ ...row, ...(overrides[row.id] ?? {}) }));
  const filtered = useMemo(() => effectiveRows.filter((row) => `${row.code} ${row.name} ${row.detail}`.toLowerCase().includes(query.toLowerCase())), [query, overrides, section]);
  const meta = groupMeta[section];
  const isSheet = section === "sheets";
  const isBasin = section === "basins";

  return (
    <>
      <div className="ka-page-heading">
        <div>
          <p className="ka-eyebrow">{meta.eyebrow}</p>
          <h1>จัดการ{meta.label}<br /><em>ให้พร้อมใช้งาน</em></h1>
          <p>{meta.description} · แสดงตัวอย่าง {rows.length} จาก {meta.count} รายการ</p>
        </div>
        <span className="ka-updated"><i className="ka-dot" />บันทึกอัตโนมัติเปิดอยู่</span>
      </div>
      <div className="ka-section-strip">
        <div><h2>{isBasin ? "ราคาอ่างล้างหน้า" : isSheet ? "ตารางราคาขายแผ่น" : "ตารางราคาพร้อมติดตั้ง"}</h2><span>{isSheet ? "ราคาขั้นต้น · 10+ แผ่น · 50+ แผ่น" : isBasin ? "ราคาต่อชิ้น" : "ราคาต่อตารางเมตร"}</span></div>
        <button className="ka-button" onClick={() => onNotice("ฟอร์มเพิ่มรายการจะเปิดเมื่อเชื่อมต่อฐานข้อมูลจริง")}><Package size={14} /> เพิ่มรายการ</button>
      </div>
      <div className="ka-table-toolbar">
        <label className="ka-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหารหัสสินค้า หรือชื่อสี..." /></label>
         <span className="ka-toolbar-meta">แสดง {filtered.length} / {meta.count} รายการ · <b>ไม่ลบถาวร</b></span>
      </div>
      <div className="ka-table-wrap">
        <table className="ka-table">
           <thead><tr><th>รหัสสินค้า</th><th>วัสดุ / ชื่อสี</th>{!isBasin && <th className="center">HD</th>}{isBasin && <th>หมวดหมู่</th>}<th className="numeric">{isBasin ? "ราคา / ชิ้น" : isSheet ? "1–9 แผ่น" : "ราคา / ตร.ม."}</th>{isSheet && <th className="numeric">10+ แผ่น</th>}{isBasin && <th className="center">3D 360°</th>}<th className="center">สถานะ</th><th className="numeric">จัดการ</th></tr></thead>
          <tbody>
            {filtered.length ? filtered.map((row) => (
              <tr key={row.id}>
                <td><span className="ka-code">{row.code}</span></td>
                <td><div className="ka-product-name"><span className="ka-swatch" style={{ background: row.tone }} /><span><strong>{row.name}</strong><span>{row.detail}</span></span></div></td>
                 {!isBasin && <td className="center"><span className="ka-hd-frame"><img className="ka-hd-image" src={row.imageUrl} alt={`ภาพแผ่น ${row.code}`} onError={(event) => { event.currentTarget.style.display = "none"; }} /><span className="ka-hd-fallback">HD</span></span></td>}
                 {isBasin && <td><span className="ka-code">{row.detail.includes("ทรงกลม") ? "ทรงกลม" : row.detail.includes("ทรงเหลี่ยม") ? "ตั้งพื้น" : "เคาน์เตอร์"}</span></td>}
                <td className="numeric"><span className="ka-price highlight">฿ {formatPrice(row.price)}</span></td>
                {isSheet && <td className="numeric"><span className="ka-price">฿ {formatPrice(row.secondary ?? row.price)}</span></td>}
                 {isBasin && <td className="center">{row.videoUrl ? <button className="ka-video-button" onClick={() => onVideo(row)}><Video size={13} /> ดูวิดีโอ</button> : <span className="ka-muted">—</span>}</td>}
                <td className="center"><Status active={row.status} /></td>
                <td><div className="ka-table-actions"><button className="ka-table-action" onClick={() => onEdit(row)} aria-label={`แก้ไข ${row.code}`}><Edit3 size={14} /></button><button className="ka-table-action danger" onClick={() => onToggle(row)} aria-label={`${row.status ? "ซ่อน" : "เปิดแสดง"} ${row.code}`}><LockKeyhole size={14} /></button></div></td>
              </tr>
             )) : <tr><td colSpan={isSheet ? 8 : isBasin ? 8 : 7} style={{ textAlign: "center", padding: "44px", color: "var(--ka-ink-soft)" }}>ไม่พบข้อมูลที่ตรงกับการค้นหา</td></tr>}
          </tbody>
        </table>
        <div className="ka-table-foot"><span>แสดงตัวอย่างรายการที่เรียงตามลำดับแคตตาล็อก</span><strong>ทั้งหมด {meta.count} รายการ <ChevronRight size={13} style={{ verticalAlign: "middle" }} /></strong></div>
      </div>
    </>
  );
}

function EditModal({ row, onClose, onSave }: { row: CatalogRow; onClose: () => void; onSave: (price: number, active: boolean) => void }) {
  const [price, setPrice] = useState(String(row.price));
  const [active, setActive] = useState(row.status);
  return (
    <div className="ka-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="ka-modal" role="dialog" aria-modal="true" aria-labelledby="ka-edit-title">
        <div className="ka-modal-head"><div><h2 id="ka-edit-title">แก้ไขราคา {row.code}</h2><p>{row.name} · {row.detail}</p></div><button className="ka-icon-button" onClick={onClose} aria-label="ปิด"><X size={17} /></button></div>
        <form className="ka-form" onSubmit={(event) => { event.preventDefault(); onSave(Number(price) || 0, active); }}>
          <div className="ka-form-grid">
            <div className="ka-field full"><label htmlFor="ka-price">ราคา (บาท)</label><input id="ka-price" type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} /></div>
            <label className="ka-check-field"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> แสดงรายการนี้ในแคตตาล็อกลูกค้า</label>
          </div>
          <div className="ka-form-actions"><button className="ka-button ghost" type="button" onClick={onClose}>ยกเลิก</button><button className="ka-button" type="submit"><Check size={14} /> บันทึกการแก้ไข</button></div>
        </form>
      </section>
    </div>
  );
}

function VideoModal({ row, onClose }: { row: CatalogRow; onClose: () => void }) {
  return (
    <div className="ka-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="ka-video-modal" role="dialog" aria-modal="true" aria-labelledby="ka-video-title">
        <div className="ka-modal-head"><div><p className="ka-eyebrow">BASIN MEDIA / 360°</p><h2 id="ka-video-title">{row.code} · {row.name}</h2><p>{row.detail}</p></div><button className="ka-icon-button" onClick={onClose} aria-label="ปิด"><X size={17} /></button></div>
        <video className="ka-video-player" controls playsInline src={row.videoUrl}><track kind="captions" /></video>
        <div className="ka-video-modal-foot"><span>วิดีโอ 3D 360° จากเซิร์ฟเวอร์กลาง</span><a href={row.videoUrl} target="_blank" rel="noreferrer">เปิดไฟล์ต้นฉบับ <ChevronRight size={13} /></a></div>
      </section>
    </div>
  );
}

function SupportPanel({ onClose }: { onClose: () => void }) {
  return (
    <aside className="ka-support-panel" aria-label="KnightSupport">
      <div className="ka-support-head"><div><span className="ka-eyebrow">KNIGHTSUPPORT</span><strong>ถามน้องไนท์</strong></div><button className="ka-icon-button" onClick={onClose} aria-label="ปิดแชต"><X size={16} /></button></div>
      <div className="ka-support-message"><span className="ka-support-avatar">N</span><p>สวัสดีครับ สนใจข้อมูลอ่างล้างหน้า รุ่นไหน หรืออยากให้ช่วยเทียบวัสดุหินครับ?</p></div>
      <div className="ka-support-suggestions"><button>แนะนำรุ่นยอดนิยม</button><button>ขอดูวิดีโอ 3D</button><button>เทียบราคาหิน</button></div>
      <div className="ka-support-compose"><input placeholder="พิมพ์คำถาม..." /><button aria-label="ส่งข้อความ"><ChevronRight size={16} /></button></div>
    </aside>
  );
}

function CustomerCatalogue({ onManage, onLineLogin }: { onManage: () => void; onLineLogin: () => void }) {
  return (
    <div className="ka-shell" style={{ display: "block" }}>
      <main className="ka-content">
        <div className="ka-page-heading">
          <div><p className="ka-eyebrow">KNIGHT FURNICH / 2026 COLLECTION</p><h1>วัสดุที่ดี<br /><em>เริ่มต้นจากน้ำ</em></h1><p>แคตตาล็อกสำหรับลูกค้า · เลือกอ่างล้างหน้าและหินสังเคราะห์ที่เหมาะกับพื้นที่ของคุณ</p></div>
          <div className="ka-customer-actions"><button className="ka-line-login customer" onClick={onLineLogin}>เข้าสู่ระบบด้วย LINE</button><button className="ka-button ghost" onClick={onManage}><ShieldCheck size={14} /> สำหรับเจ้าของร้าน</button></div>
        </div>
        <div className="ka-section-strip"><div><h2>แคตตาล็อกสินค้า</h2><span>30 อ่างล้างหน้า · 144 หินสังเคราะห์</span></div><span className="ka-updated"><i className="ka-dot" />ราคาอัปเดตวันนี้</span></div>
        <div className="ka-overview-grid">
          <div className="ka-activity-card">
            <div className="ka-card-heading"><h3>ชุดข้อมูลในร้าน</h3><span>เลือกดูตามวัสดุ</span></div>
            <button className="ka-activity" onClick={onManage}><span className="ka-activity-icon"><Package size={15} /></span><div><strong>อ่างล้างหน้า</strong><p>30 รุ่น · ราคาเริ่มต้น ฿ 8,900</p></div><ChevronRight size={15} /></button>
            <button className="ka-activity" onClick={onManage}><span className="ka-activity-icon"><Settings2 size={15} /></span><div><strong>หินสังเคราะห์พร้อมติดตั้ง</strong><p>71 สี · ราคาตามพื้นที่</p></div><ChevronRight size={15} /></button>
            <button className="ka-activity" onClick={onManage}><span className="ka-activity-icon"><FileText size={15} /></span><div><strong>หินสังเคราะห์ขายเป็นแผ่น</strong><p>73 สี · ราคาตามจำนวน</p></div><ChevronRight size={15} /></button>
          </div>
          <div className="ka-quiet-card"><p className="ka-eyebrow">FOR YOUR PROJECT</p><h3>เรียบ เงียบ และเลือกได้ชัดเจน</h3><div className="ka-quiet-line" /><p>ส่งรายการที่สนใจเพื่อขอใบเสนอราคาจากทีม Knight Furnich</p></div>
        </div>
      </main>
    </div>
  );
}

function App() {
  const [customerMode, setCustomerMode] = useState(false);
  const [section, setSection] = useState<Section>("overview");
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [videoRow, setVideoRow] = useState<CatalogRow | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [savedRows, setSavedRows] = useState<Record<number, { price: number; active: boolean }>>({});
  const saveRow = (price: number, active: boolean) => {
    if (!editing) return;
    setSavedRows((current) => ({ ...current, [editing.id]: { price, active } }));
    setEditing(null);
    setToast(`บันทึก ${editing.code} แล้ว · พร้อมเผยแพร่`);
    window.setTimeout(() => setToast(""), 2800);
  };
  const notice = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };
  const toggleRow = (row: CatalogRow) => {
    setSavedRows((current) => ({ ...current, [row.id]: { price: current[row.id]?.price ?? row.price, active: !row.status } }));
    notice(`${row.code} ${row.status ? "ย้ายไป Archived" : "เปิดใน"} แคตตาล็อกแล้ว`);
  };
  const lineLogin = () => notice("LINE Login พร้อมเชื่อมต่อกับ LINE identity ของลูกค้า");
  const displaySection = section === "overview" ? "overview" : section;

  if (customerMode) return (
    <div className="knight-admin">
      <Header onCustomerView={() => setCustomerMode(false)} onChat={() => setChatOpen(true)} onLineLogin={lineLogin} />
      <CustomerCatalogue onManage={() => setCustomerMode(false)} onLineLogin={lineLogin} />
      {chatOpen && <SupportPanel onClose={() => setChatOpen(false)} />}
      {toast && <div className="ka-toast"><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );

  return (
    <div className="knight-admin">
      <Header onCustomerView={() => setCustomerMode(true)} onChat={() => setChatOpen(true)} onLineLogin={lineLogin} />
      <div className="ka-shell">
        <Navigation active={section} onChange={setSection} />
        <main className="ka-content">
          {displaySection === "overview" ? <Overview onSection={setSection} /> : <CatalogTable section={displaySection} overrides={savedRows} onEdit={setEditing} onToggle={toggleRow} onVideo={setVideoRow} onNotice={notice} />}
        </main>
      </div>
      {editing && <EditModal row={{ ...editing, ...(savedRows[editing.id] ?? {}) }} onClose={() => setEditing(null)} onSave={saveRow} />}
      {videoRow && <VideoModal row={videoRow} onClose={() => setVideoRow(null)} />}
      {chatOpen && <SupportPanel onClose={() => setChatOpen(false)} />}
      {toast && <div className="ka-toast"><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}

export function IntegratedAdmin() {
  return <App />;
}

export default IntegratedAdmin;