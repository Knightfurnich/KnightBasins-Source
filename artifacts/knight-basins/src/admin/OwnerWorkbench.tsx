import { useState } from "react";
import { ArrowLeft, BarChart3, CheckCircle2, CircleDollarSign, ExternalLink, FileText, Image, LayoutDashboard, LockKeyhole, MessageCircle, Package, PlayCircle, ShieldCheck, TriangleAlert } from "lucide-react";
import { Link } from "wouter";
import { getHealthCheckQueryKey, useGetAdminSession, useGetCatalog, useHealthCheck, type HealthStatus } from "@workspace/api-client-react";
import { KnightSupport, LineLoginButton } from "@/components/KnightSupport";
import { BasinVisual } from "@/components/BasinVisual";
import { knightFurnichLogo } from "@/data/assets";
import { AdminLogin, AdminLogout } from "./AdminApp";
import { BasinsManager } from "./BasinsManager";
import { InstalledStonesManager } from "./InstalledStonesManager";
import { SheetStonesManager } from "./SheetStonesManager";

type WorkbenchSection = "overview" | "basins" | "installed" | "sheets";
type LineReadinessState = "ready" | "missing-credentials" | "malformed-callback" | "wrong-host" | "callback-issue" | "unavailable";

const navItems: Array<{ key: WorkbenchSection; label: string; icon: typeof LayoutDashboard }> = [
  { key: "overview", label: "ภาพรวม", icon: LayoutDashboard },
  { key: "basins", label: "อ่างล้างหน้า", icon: Package },
  { key: "installed", label: "หิน · พร้อมติดตั้ง", icon: CircleDollarSign },
  { key: "sheets", label: "หิน · ขายแผ่น", icon: FileText },
];

export default function OwnerWorkbench() {
  const { data: session, isLoading } = useGetAdminSession();
  const { data: catalog } = useGetCatalog();
  const [section, setSection] = useState<WorkbenchSection>("overview");
  const navCounts = {
    basins: catalog?.basins.length ?? 0,
    installed: catalog?.installedStones.length ?? 0,
    sheets: catalog?.sheetStones.length ?? 0,
  };

  if (isLoading) return <div className="workbench-loading">กำลังตรวจสอบสิทธิ์...</div>;
  if (!session?.authenticated) return <AdminLogin />;

  return (
    <div className="owner-workbench">
      <div className="workbench-topline"><span>KNIGHT FURNICH / PRIVATE WORKBENCH</span><span>เจ้าของร้านเท่านั้น · เซสชันปลอดภัย</span></div>
      <header className="workbench-header">
        <Link href="/" className="workbench-brand"><img src={knightFurnichLogo} alt="Knight Furnich" /><span><strong>KNIGHT FURNICH</strong><small>CATALOGUE MANAGEMENT</small></span></Link>
        <div className="workbench-header-actions"><Link href="/" className="workbench-back"><ArrowLeft size={16} /> กลับไปแคตตาล็อก</Link><LineLoginButton compact /><AdminLogout /></div>
      </header>
      <div className="workbench-mobile-nav">{navItems.map((item) => <WorkbenchNavButton key={item.key} item={item} active={section === item.key} onClick={() => setSection(item.key)} mobile counts={navCounts} />)}</div>
      <div className="workbench-shell">
        <aside className="workbench-sidebar">
          <p>CATALOGUE CONTROL</p>
          <nav>{navItems.map((item) => <WorkbenchNavButton key={item.key} item={item} active={section === item.key} onClick={() => setSection(item.key)} counts={navCounts} />)}</nav>
          <div className="workbench-owner-note"><ShieldCheck size={15} /><strong>โหมดจัดการส่วนตัว</strong><span>ข้อมูลชุดนี้จะแสดงผลกับลูกค้าเมื่อกด “บันทึกและเผยแพร่” เท่านั้น</span></div>
        </aside>
        <main className="workbench-main">
          {section === "overview" && <WorkbenchOverview onNavigate={setSection} />}
          {section === "basins" && <BasinsManager />}
          {section === "installed" && <InstalledStonesManager />}
          {section === "sheets" && <SheetStonesManager />}
        </main>
      </div>
      <KnightSupport />
    </div>
  );
}

function WorkbenchNavButton({ item, active, onClick, mobile = false, counts }: { item: (typeof navItems)[number]; active: boolean; onClick: () => void; mobile?: boolean; counts: { basins: number; installed: number; sheets: number } }) {
  const Icon = item.icon;
  const count = item.key === "basins" ? counts.basins : item.key === "installed" ? counts.installed : counts.sheets;
  return <button type="button" className={`workbench-nav-button ${active ? "is-active" : ""} ${mobile ? "is-mobile" : ""}`} onClick={onClick}><Icon size={15} /><span>{item.label}</span>{!mobile && item.key !== "overview" && <em>{count}</em>}</button>;
}

function WorkbenchOverview({ onNavigate }: { onNavigate: (section: WorkbenchSection) => void }) {
  const { data: catalog, isLoading } = useGetCatalog();
  const basins = catalog?.basins ?? [];
  const installedCount = catalog?.installedStones.length ?? 0;
  const sheetCount = catalog?.sheetStones.length ?? 0;
  const topSkus = ["KF001", "KF020", "KF023"];
  const topBasins = topSkus.map((sku) => basins.find((basin) => basin.sku === sku)).filter(Boolean);
  const counterCount = basins.filter((basin) => basin.category === "counter basin").length;
  const roundCount = basins.filter((basin) => basin.dimensions.includes("Ø")).length;
  const squareCount = Math.max(0, basins.length - counterCount - roundCount);
  const basinTotal = basins.length || 1;
  const counterWidth = `${Math.round((counterCount / basinTotal) * 100)}%`;
  const squareWidth = `${Math.round((squareCount / basinTotal) * 100)}%`;
  const roundWidth = `${Math.round((roundCount / basinTotal) * 100)}%`;

  if (isLoading) return <div className="workbench-loading">กำลังโหลดข้อมูลแคตตาล็อก...</div>;
  return <div className="workbench-overview">
    <div className="workbench-page-heading"><div><p className="workbench-eyebrow">WORKBENCH / OVERVIEW</p><h1>ศูนย์รวมอ่างล้างหน้า<br /><em>และวัสดุหินสังเคราะห์</em></h1><p>ตรวจสอบสถานะราคา สื่อสินค้า และรายการที่เปิดแสดงในแคตตาล็อก Knight Furnich</p></div><span className="workbench-updated"><CheckCircle2 size={14} /> ข้อมูลล่าสุดจากเซิร์ฟเวอร์</span></div>
    <div className="workbench-stat-grid">
      <button type="button" className="workbench-stat workbench-stat--primary" onClick={() => onNavigate("basins")}><span>อ่างล้างหน้าในแคตตาล็อก</span><strong>{basins.length}</strong><small>รุ่น · มีวิดีโอ 3D 360°</small><b>01 / 04</b></button>
      <button type="button" className="workbench-stat" onClick={() => onNavigate("installed")}><span>หินพร้อมติดตั้ง</span><strong>{installedCount}</strong><small>สี · ภาพ HD</small></button>
      <button type="button" className="workbench-stat" onClick={() => onNavigate("sheets")}><span>หินขายเป็นแผ่น</span><strong>{sheetCount}</strong><small>สี · แบ่งราคาตามจำนวนสั่งซื้อ</small></button>
    </div>
    <LineReadinessPanel />
     <section className="workbench-overview-grid">
       <div className="workbench-card basin-breakdown"><div className="workbench-card-heading"><div><p className="workbench-eyebrow">BASIN MIX / {basins.length} MODELS</p><h2>สัดส่วนรุ่นอ่าง</h2></div><BarChart3 size={20} /></div><div className="breakdown-row"><span>วางเคาน์เตอร์</span><strong>{counterCount}</strong><i style={{ width: counterWidth }} /></div><div className="breakdown-row"><span>ตั้งพื้นทรงเหลี่ยม</span><strong>{squareCount}</strong><i style={{ width: squareWidth }} /></div><div className="breakdown-row"><span>ตั้งพื้นทรงกลม</span><strong>{roundCount}</strong><i style={{ width: roundWidth }} /></div><p className="workbench-muted">โครงสร้างข้อมูลรักษาสัญลักษณ์ Ø สำหรับขนาดทรงกลม และ KF029/KF030 ไม่มีข้อมูลขนาดหลุม</p></div>
      <div className="workbench-card studio-note"><p className="workbench-eyebrow">STUDIO NOTE / 06</p><h2>อ่างล้างหน้าหินสังเคราะห์หล่อขึ้นรูปชิ้นเดียว สวย ทนทาน ไร้รอยต่อ</h2><span className="note-rule" /><p>ข้อมูลสื่อ วิดีโอ 3D 360° และภาพแผ่น HD เชื่อมจากเซิร์ฟเวอร์กลาง เพื่อให้ทีมขายใช้ข้อมูลชุดเดียวกับหน้าร้าน</p></div>
    </section>
    <section className="workbench-card top-basins"><div className="workbench-card-heading"><div><p className="workbench-eyebrow">TOP BASINS / CUSTOMER FAVOURITES</p><h2>อ่างรุ่นยอดนิยม</h2></div><button type="button" className="workbench-text-button" onClick={() => onNavigate("basins")}>ดูตารางราคาหลัก <ExternalLink size={14} /></button></div><div className="top-basin-grid">{topBasins.map((basin) => <article key={basin!.sku}><div className="top-basin-art" style={{ background: basin!.imageTone }}><BasinVisual tone={basin!.imageTone} imageUrl={basin!.imageUrl} alt={`${basin!.sku} ${basin!.colorName}`} tall={basin!.category === "tall vertical washbasin"} className="top-basin-visual" /><span>{basin!.sku}</span><a href={basin!.videoUrl} target="_blank" rel="noreferrer"><PlayCircle size={15} /> 3D 360°</a></div><div><strong>{basin!.colorName}</strong><small>{basin!.dimensions}</small></div></article>)}</div></section>
    <div className="workbench-rules"><LockKeyhole size={15} /><span><strong>Admin Rules</strong> การลบถาวรต้องยืนยันอีกครั้ง · ใช้ Archived/ซ่อนเมื่อต้องการเก็บรายการไว้ · ขนาดทรงกลมต้องคง Ø · KF029 และ KF030 เก็บ bowl_mm เป็น null</span></div>
  </div>;
}

function isHealthStatus(value: unknown): value is HealthStatus {
  if (!value || typeof value !== "object") return false;
  const lineLogin = (value as { lineLogin?: unknown }).lineLogin;
  if (!lineLogin || typeof lineLogin !== "object") return false;

  const diagnostic = lineLogin as Record<string, unknown>;
  return typeof diagnostic.ready === "boolean"
    && typeof diagnostic.channelConfigured === "boolean"
    && typeof diagnostic.secretConfigured === "boolean"
    && typeof diagnostic.callbackUrlConfigured === "boolean"
    && typeof diagnostic.callbackUrlValid === "boolean"
    && typeof diagnostic.callbackEnvironment === "string"
    && typeof diagnostic.callbackReason === "string";
}

function healthStatusFromError(error: unknown): HealthStatus | undefined {
  if (!error || typeof error !== "object") return undefined;
  return isHealthStatus((error as { data?: unknown }).data) ? (error as { data: HealthStatus }).data : undefined;
}

function lineReadinessState(health: HealthStatus | undefined): LineReadinessState {
  if (!health) return "unavailable";
  const { lineLogin } = health;
  if (lineLogin.ready) return "ready";
  if (!lineLogin.channelConfigured || !lineLogin.secretConfigured) return "missing-credentials";
  if (lineLogin.callbackReason === "unexpected_host") return "wrong-host";
  if (lineLogin.callbackReason === "malformed") return "malformed-callback";
  return "callback-issue";
}

function lineReadinessCopy(state: LineReadinessState, health: HealthStatus | undefined) {
  switch (state) {
    case "ready":
      return { label: "พร้อมใช้งาน", title: "LINE Login พร้อมสำหรับลูกค้า", description: "Channel และ Callback URL ผ่านการตรวจสอบแล้ว" };
    case "missing-credentials":
      return { label: "ตั้งค่าไม่ครบ", title: "ยังขาดข้อมูลเชื่อมต่อ LINE", description: "เพิ่ม LINE Channel ID และ Channel Secret ใน Secrets ของโปรเจกต์ แล้วตรวจสอบอีกครั้ง" };
    case "wrong-host":
      return { label: "Host ไม่ถูกต้อง", title: "Callback URL ชี้ไปยัง host ที่ไม่ใช่ production", description: "เปลี่ยน Callback URL ให้ชี้ไปยัง host ของ Knight Furnich ที่ตั้งไว้ใน LINE Developers Console" };
    case "malformed-callback":
      return { label: "รูปแบบไม่ถูกต้อง", title: "Callback URL อ่านรูปแบบไม่ได้", description: "ตรวจสอบว่า Callback URL เป็น URL เต็มรูปแบบและไม่มีอักขระที่ไม่ถูกต้อง" };
    case "callback-issue":
      return { label: "ตรวจสอบ Callback", title: "ต้องแก้ไข Callback URL", description: callbackReasonCopy(health?.lineLogin.callbackReason) };
    default:
      return { label: "ตรวจสอบไม่ได้", title: "ยังอ่านสถานะ LINE Login ไม่ได้", description: "เซิร์ฟเวอร์ไม่ตอบข้อมูลวินิจฉัยที่ปลอดภัย ลองรีเฟรชหน้านี้อีกครั้ง" };
  }
}

function callbackReasonCopy(reason: HealthStatus["lineLogin"]["callbackReason"] | undefined) {
  switch (reason) {
    case "missing":
      return "ยังไม่ได้ตั้งค่า Callback URL ในระบบ";
    case "not_https":
      return "Callback URL ต้องใช้ HTTPS ใน production";
    case "unexpected_path":
      return "path ของ Callback URL ไม่ตรงกับเส้นทางที่ระบบรองรับ";
    case "unexpected_format":
      return "Callback URL ไม่ตรงกับรูปแบบ production ที่ระบบรองรับ";
    default:
      return "ตรวจสอบ Callback URL ให้ตรงกับค่าที่ลงทะเบียนไว้ใน LINE Developers Console";
  }
}

function LineReadinessPanel() {
  const { data, error, isLoading, isError } = useHealthCheck({
    query: {
      queryKey: getHealthCheckQueryKey(),
      retry: false,
      staleTime: 30_000,
    },
  });
  const health = data ?? healthStatusFromError(error);
  const state = isLoading ? "unavailable" : lineReadinessState(health);
  const copy = isLoading ? { label: "กำลังตรวจสอบ", title: "กำลังตรวจสอบ LINE Login", description: "กำลังอ่านสถานะการตั้งค่าที่ปลอดภัยจากเซิร์ฟเวอร์" } : lineReadinessCopy(state, health);
  const diagnostic = health?.lineLogin;
  const isReady = state === "ready";
  const isUnavailable = isError && !health;

  return (
    <section className={`workbench-card line-readiness-panel line-readiness-panel--${state}`} aria-labelledby="line-readiness-title">
      <div className="line-readiness-heading">
        <div>
          <p className="workbench-eyebrow">LINE LOGIN / READINESS</p>
          <h2 id="line-readiness-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <span className="line-readiness-status">
          {isReady ? <CheckCircle2 size={15} /> : <TriangleAlert size={15} />}
          {copy.label}
        </span>
      </div>
      {diagnostic ? (
        <div className="line-readiness-checks">
          <ReadinessCheck label="Channel ID" configured={diagnostic.channelConfigured} />
          <ReadinessCheck label="Channel Secret" configured={diagnostic.secretConfigured} />
          <ReadinessCheck label="Callback URL" configured={diagnostic.callbackUrlConfigured && diagnostic.callbackUrlValid} />
        </div>
      ) : (
        <p className="line-readiness-unavailable">{isUnavailable ? "ไม่พบข้อมูลสถานะจาก API" : "กำลังโหลดข้อมูลสถานะ..."}</p>
      )}
      <p className="line-readiness-safe-note">แสดงเฉพาะสถานะการตั้งค่าเท่านั้น ไม่แสดงค่า Channel ID, Secret หรือ URL ที่บันทึกไว้</p>
    </section>
  );
}

function ReadinessCheck({ label, configured }: { label: string; configured: boolean }) {
  return (
    <div className="line-readiness-check">
      {configured ? <CheckCircle2 size={14} /> : <TriangleAlert size={14} />}
      <span>{label}</span>
      <strong>{configured ? "ตั้งค่าแล้ว" : "ยังไม่มี"}</strong>
    </div>
  );
}
