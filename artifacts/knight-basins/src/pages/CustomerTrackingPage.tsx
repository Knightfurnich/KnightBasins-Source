import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, CheckCircle2, ChevronRight, CircleAlert, Clock3, ImageOff, LockKeyhole, MessageCircle, X } from "lucide-react";
import { knightFurnichLogo } from "@/data/assets";

type StageKey = "quote_accepted" | "in_production" | "ready_to_install" | "installing" | "completed";
type StageStatus = "done" | "active" | "pending";

type PublicTimelineItem = {
  stage: StageKey;
  status: StageStatus;
  date?: string | null;
};

type PublicPhoto = {
  id: string;
  imageUrl: string;
  stage: string;
  caption?: string;
  takenAt?: string | null;
};

type PublicStudioDimensions = {
  depth?: number;
  runA?: number;
  runB?: number;
  runC?: number;
};

type PublicStudioSummary = {
  basinModel?: string;
  stoneType?: string;
  stoneColor?: string;
  slabSize?: string;
  shape?: string;
  dimensionsMm?: PublicStudioDimensions;
  basinSkus?: string[];
};

type PublicTrackingJob = {
  jobCode?: string;
  quoteNumber?: string;
  customerName?: string;
  projectName?: string;
  timeline: PublicTimelineItem[];
  studio?: PublicStudioSummary | null;
  photos: PublicPhoto[];
};

type TrackingState =
  | { kind: "loading" }
  | { kind: "no-token" }
  | { kind: "error"; message: string }
  | { kind: "empty" }
  | { kind: "ready"; job: PublicTrackingJob };

const STAGES: ReadonlyArray<{ key: StageKey; label: string; shortLabel: string; description: string }> = [
  { key: "quote_accepted", label: "รับออเดอร์/ยืนยันแบบ", shortLabel: "ยืนยันงาน", description: "รับคำสั่งซื้อและยืนยันแบบเรียบร้อย" },
  { key: "in_production", label: "กำลังตัดประกอบหิน", shortLabel: "กำลังผลิต", description: "กำลังตัดและประกอบชิ้นงานตามแบบของคุณ" },
  { key: "ready_to_install", label: "ผลิตเสร็จ นัดหมายติดตั้ง", shortLabel: "พร้อมติดตั้ง", description: "ชิ้นงานผลิตเสร็จและเตรียมนัดหมายติดตั้ง" },
  { key: "installing", label: "ทีมช่างเข้าติดตั้งหน้างาน", shortLabel: "ติดตั้งหน้างาน", description: "กำลังติดตั้งชิ้นงานสำหรับโครงการของคุณ" },
  { key: "completed", label: "ส่งมอบงานเรียบร้อย", shortLabel: "ส่งมอบงาน", description: "ส่งมอบงานและปิดการติดตั้งเรียบร้อย" },
];

const allowedStages = new Set<StageKey>(STAGES.map((stage) => stage.key));
const allowedStatuses = new Set<StageStatus>(["done", "active", "pending"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalIdentifier(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return optionalString(value);
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function validDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) return null;
  return value;
}

function formatDimensionsMm(dimensions?: PublicStudioDimensions): string | undefined {
  if (!dimensions) return undefined;
  const parts = [
    dimensions.runA === undefined ? undefined : `A ${dimensions.runA}`,
    dimensions.runB === undefined ? undefined : `B ${dimensions.runB}`,
    dimensions.runC === undefined ? undefined : `C ${dimensions.runC}`,
    dimensions.depth === undefined ? undefined : `ลึก ${dimensions.depth}`,
  ].filter((part): part is string => Boolean(part));
  return parts.length ? `${parts.join(" × ")} มม.` : undefined;
}

function safeImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const candidate = value.trim();
  if ((candidate.startsWith("/") && !candidate.startsWith("//")) || candidate.startsWith("./")) return candidate;
  try {
    const parsed = new URL(candidate, window.location.origin);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

function parseTrackingPayload(payload: unknown): PublicTrackingJob | null {
  const envelope = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
  if (!isRecord(envelope)) return null;

  const rawTimeline = Array.isArray(envelope.timeline) ? envelope.timeline : [];
  const timeline = rawTimeline.reduce<PublicTimelineItem[]>((items, item) => {
    if (!isRecord(item)) return items;
    const stage = item.stage;
    const status = item.status;
    if (typeof stage !== "string" || !allowedStages.has(stage as StageKey)) return items;
    if (typeof status !== "string" || !allowedStatuses.has(status as StageStatus)) return items;
    items.push({ stage: stage as StageKey, status: status as StageStatus, date: validDate(item.date) });
    return items;
  }, []);

  const rawStudio = isRecord(envelope.studio) ? envelope.studio : null;
  const studio = rawStudio
    ? {
        basinModel: optionalString(rawStudio.basinModel),
        stoneType: optionalString(rawStudio.stoneType),
        stoneColor: optionalString(rawStudio.stoneColor),
        slabSize: optionalString(rawStudio.slabSize),
        shape: optionalString(rawStudio.shape),
        dimensionsMm: isRecord(rawStudio.dimensionsMm)
          ? {
              depth: optionalNumber(rawStudio.dimensionsMm.depth),
              runA: optionalNumber(rawStudio.dimensionsMm.runA),
              runB: optionalNumber(rawStudio.dimensionsMm.runB),
              runC: optionalNumber(rawStudio.dimensionsMm.runC),
            }
          : undefined,
        basinSkus: Array.isArray(rawStudio.basinSkus)
          ? rawStudio.basinSkus.map(optionalString).filter((value): value is string => Boolean(value))
          : undefined,
      }
    : null;

  const rawPhotos = Array.isArray(envelope.sitePhotos)
    ? envelope.sitePhotos
    : Array.isArray(envelope.photos)
      ? envelope.photos
      : [];
  const photos = rawPhotos.reduce<PublicPhoto[]>((items, item) => {
    if (!isRecord(item) || item.stage !== "completed") return items;
    const imageUrl = safeImageUrl(item.imageUrl);
    const id = optionalIdentifier(item.id);
    if (!imageUrl || !id) return items;
    items.push({
      id,
      imageUrl,
      stage: "completed",
      caption: optionalString(item.caption),
      takenAt: validDate(item.takenAt),
    });
    return items;
  }, []);

  const job: PublicTrackingJob = {
    jobCode: optionalString(envelope.jobCode),
    quoteNumber: optionalString(envelope.quoteNumber),
    customerName: optionalString(envelope.customerName),
    projectName: optionalString(envelope.projectName),
    timeline,
    studio,
    photos,
  };
  return job.jobCode || job.quoteNumber || job.customerName || job.projectName || timeline.length || studio || photos.length ? job : null;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
  } catch {
    return "";
  }
}

function getStatusLabel(status: StageStatus) {
  if (status === "done") return "เสร็จแล้ว";
  if (status === "active") return "กำลังดำเนินการ";
  return "รอดำเนินการ";
}

function useTrackingJob() {
  const [state, setState] = useState<TrackingState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
    if (!token) {
      setState({ kind: "no-token" });
      return;
    }

    const controller = new AbortController();
    setState({ kind: "loading" });
    fetch(`/api/public/track?token=${encodeURIComponent(token)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? "ไม่พบข้อมูลงานสำหรับลิงก์นี้" : "ระบบติดตามงานไม่พร้อมใช้งานชั่วคราว");
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        const job = parseTrackingPayload(payload);
        setState(job ? { kind: "ready", job } : { kind: "empty" });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ kind: "error", message: error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลงานได้" });
      });

    return () => controller.abort();
  }, [reloadKey]);

  return { state, retry: () => setReloadKey((key) => key + 1) };
}

function BrandHeader() {
  return (
    <header className="customer-track-header">
      <a className="customer-track-brand" href="/" data-testid="link-tracking-brand">
        <img src={knightFurnichLogo} alt="Knight Furnich" />
        <span>
          <strong>KNIGHT FURNICH</strong>
          <small>SOLID SURFACE / BASINS</small>
        </span>
      </a>
      <div className="customer-track-header-note">
        <LockKeyhole size={14} aria-hidden="true" />
        <span>พื้นที่ข้อมูลส่วนตัวของคุณ</span>
      </div>
    </header>
  );
}

function StatePanel({ state, retry }: { state: Exclude<TrackingState, { kind: "ready" }>; retry: () => void }) {
  if (state.kind === "loading") {
    return (
      <section className="customer-track-state customer-track-state--loading" aria-busy="true" data-testid="status-customer-tracking-loading">
        <div className="track-skeleton track-skeleton--small" />
        <div className="track-skeleton track-skeleton--title" />
        <div className="track-skeleton track-skeleton--copy" />
        <div className="track-skeleton track-skeleton--copy track-skeleton--copy-short" />
        <div className="track-skeleton track-skeleton--card" />
      </section>
    );
  }

  const noToken = state.kind === "no-token";
  const empty = state.kind === "empty";
  return (
    <section className="customer-track-state" data-testid={noToken ? "status-customer-tracking-no-token" : empty ? "status-customer-tracking-empty" : "status-customer-tracking-error"}>
      <div className="customer-track-state-icon" aria-hidden="true">
        {state.kind === "error" ? <CircleAlert size={22} /> : <MessageCircle size={21} />}
      </div>
      <p className="customer-track-kicker">{noToken ? "PRIVATE JOB PORTAL" : empty ? "NO JOB DETAILS" : "TEMPORARY ISSUE"}</p>
      <h1>{noToken ? "เปิดลิงก์ติดตามงานจาก Knight Furnich" : empty ? "ยังไม่มีรายละเอียดงานให้แสดง" : "ไม่สามารถโหลดข้อมูลงานได้"}</h1>
      <p>
        {noToken
          ? "ลิงก์ติดตามงานของคุณจะมีรหัสเฉพาะหลังคำว่า token กรุณาใช้ลิงก์ที่ร้านส่งให้"
          : empty
            ? "ตรวจสอบลิงก์อีกครั้ง หรือติดต่อทีมงานผ่าน LINE เพื่อขอความช่วยเหลือ"
            : state.message}
      </p>
      {!noToken && (
        <button type="button" className="customer-track-button customer-track-button--dark" onClick={retry} data-testid="button-retry-customer-tracking">
          ลองโหลดอีกครั้ง
        </button>
      )}
    </section>
  );
}

function Timeline({ items }: { items: PublicTimelineItem[] }) {
  const byStage = useMemo(() => new Map(items.map((item) => [item.stage, item])), [items]);
  return (
    <section className="track-panel track-timeline-panel" aria-labelledby="timeline-title" data-testid="timeline-job-tracking">
      <div className="track-panel-heading">
        <div>
          <p className="customer-track-kicker">JOB PROGRESS</p>
          <h2 id="timeline-title">สถานะงานของคุณ</h2>
        </div>
        <Clock3 size={20} aria-hidden="true" />
      </div>
      <ol className="track-timeline">
        {STAGES.map((stage, index) => {
          const item = byStage.get(stage.key);
          const status = item?.status ?? "pending";
          return (
            <li className={`track-timeline-item track-timeline-item--${status}`} key={stage.key} data-testid={`timeline-stage-${stage.key}`}>
              <div className="track-timeline-marker" aria-hidden="true">
                {status === "done" ? <Check size={15} strokeWidth={2.6} /> : status === "active" ? <span /> : <span className="track-timeline-marker-number">{index + 1}</span>}
              </div>
              <div className="track-timeline-content">
                <div className="track-timeline-title-row">
                  <h3>{stage.label}</h3>
                  <span className="track-status-pill">{getStatusLabel(status)}</span>
                </div>
                <p>{stage.description}</p>
                {item?.date && <time dateTime={item.date}>{formatDate(item.date)}</time>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StudioSummary({ studio }: { studio?: PublicStudioSummary | null }) {
  const details = [
    { label: "รูปทรงเคาน์เตอร์", value: studio?.shape },
    { label: "ขนาดเคาน์เตอร์", value: formatDimensionsMm(studio?.dimensionsMm) },
    { label: "รุ่นอ่าง", value: studio?.basinModel },
    { label: "รหัสอ่าง", value: studio?.basinSkus?.join(", ") },
    { label: "ประเภทหิน", value: studio?.stoneType },
    { label: "สีหิน", value: studio?.stoneColor },
    { label: "ขนาดแผ่น", value: studio?.slabSize },
  ].filter((detail): detail is { label: string; value: string } => Boolean(detail.value));

  return (
    <section className="track-panel track-summary-panel" aria-labelledby="summary-title">
      <div className="track-panel-heading">
        <div>
          <p className="customer-track-kicker">YOUR SELECTION</p>
          <h2 id="summary-title">รายละเอียดชิ้นงาน</h2>
        </div>
        <span className="track-summary-mark" aria-hidden="true">KF</span>
      </div>
      {details.length ? (
        <dl className="track-summary-grid">
          {details.map((detail) => (
            <div key={detail.label} className="track-summary-item">
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="track-panel-empty">
          <p>รายละเอียดวัสดุกำลังจัดเตรียมให้คุณ</p>
        </div>
      )}
    </section>
  );
}

function CompletedGallery({ photos, inProgress }: { photos: PublicPhoto[]; inProgress: boolean }) {
  const [selected, setSelected] = useState<PublicPhoto | null>(null);

  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [selected]);

  return (
    <>
      <section className="track-panel track-gallery-panel" aria-labelledby="gallery-title" data-testid="gallery-completed-photos">
        <div className="track-panel-heading">
          <div>
            <p className="customer-track-kicker">COMPLETED WORK</p>
            <h2 id="gallery-title">ภาพผลงานของคุณ</h2>
          </div>
          <span className="track-gallery-count">{photos.length ? `${photos.length} ภาพ` : "ยังไม่มีภาพ"}</span>
        </div>
        {photos.length ? (
          <div className="track-gallery-grid">
            {photos.map((photo) => (
              <button type="button" className="track-gallery-item" key={photo.id} onClick={() => setSelected(photo)} data-testid={`button-open-completed-photo-${photo.id}`} aria-label={`เปิดภาพ${photo.caption ? ` ${photo.caption}` : ""}`}>
                <img src={photo.imageUrl} alt={photo.caption || "ภาพผลงานติดตั้งของคุณ"} loading="lazy" />
                <span className="track-gallery-item-overlay"><ArrowUpRight size={18} aria-hidden="true" /></span>
                {photo.caption && <span className="track-gallery-caption">{photo.caption}</span>}
              </button>
            ))}
          </div>
        ) : (
          <div className="track-gallery-empty">
            <ImageOff size={21} aria-hidden="true" />
            <p>{inProgress ? "อยู่ระหว่างการผลิตและเตรียมการติดตั้ง" : "ยังไม่มีรูปถ่ายส่งมอบสำหรับงานนี้"}</p>
          </div>
        )}
      </section>

      {selected && (
        <div className="track-lightbox" role="dialog" aria-modal="true" aria-label="ภาพผลงานขนาดใหญ่" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <button type="button" className="track-lightbox-close" onClick={() => setSelected(null)} aria-label="ปิดภาพ" data-testid="button-close-completed-photo">
            <X size={20} aria-hidden="true" />
          </button>
          <figure className="track-lightbox-figure">
            <img src={selected.imageUrl} alt={selected.caption || "ภาพผลงานติดตั้งของคุณ"} />
            {(selected.caption || selected.takenAt) && <figcaption>{selected.caption}{selected.caption && selected.takenAt ? " · " : ""}{selected.takenAt ? formatDate(selected.takenAt) : ""}</figcaption>}
          </figure>
        </div>
      )}
    </>
  );
}

function ReadyView({ job }: { job: PublicTrackingJob }) {
  const reference = job.jobCode || job.quoteNumber || "—";
  const identity = [job.customerName, job.projectName].filter(Boolean);
  const updatedAt = [...job.timeline].reverse().find((item) => item.date)?.date;
  const completed = job.timeline.some((item) => item.stage === "completed" && item.status === "done");
  return (
    <main className="customer-track-main">
      <section className="customer-track-hero">
        <div className="customer-track-hero-copy">
          <p className="customer-track-kicker customer-track-kicker--gold">KNIGHT FURNICH / JOB PORTAL</p>
          <h1>งานของคุณ<br /><em>อยู่ในมือเรา</em></h1>
          <p className="customer-track-lede">ติดตามความคืบหน้าของชิ้นงานได้ทุกขั้นตอน พร้อมรายละเอียดที่จำเป็นสำหรับการเตรียมรับงาน</p>
        </div>
        <div className="customer-track-reference-card">
          <span>JOB REFERENCE</span>
          <strong>{reference}</strong>
          {job.jobCode && job.quoteNumber && <small>ใบเสนอราคา {job.quoteNumber}</small>}
          {updatedAt && <small>อัปเดตล่าสุด {formatDate(updatedAt)}</small>}
        </div>
      </section>

      <section className="track-identity-strip" aria-label="ข้อมูลโครงการ">
        <div className="track-identity-person">
          <span className="track-identity-label">สำหรับ</span>
          <strong>{identity[0] || "ลูกค้า Knight Furnich"}</strong>
        </div>
        {job.projectName && job.customerName && <ChevronRight className="track-identity-arrow" size={19} aria-hidden="true" />}
        {job.projectName && <div className="track-identity-project"><span className="track-identity-label">โครงการ</span><strong>{job.projectName}</strong></div>}
        <div className="track-identity-trust"><CheckCircle2 size={17} aria-hidden="true" /><span>ข้อมูลอัปเดตสำหรับคุณโดยเฉพาะ</span></div>
      </section>

      <div className="track-content-grid">
        <Timeline items={job.timeline} />
        <div className="track-side-column">
          <StudioSummary studio={job.studio} />
          <section className="track-contact-card">
            <div className="track-contact-icon"><MessageCircle size={19} aria-hidden="true" /></div>
            <div>
              <p className="customer-track-kicker">NEED AN UPDATE?</p>
              <h2>คุยกับทีมงานผ่าน LINE</h2>
              <p>ส่งรหัสงานนี้ให้เรา แล้วทีม Knight Furnich จะช่วยตอบคำถามของคุณ</p>
              <a className="customer-track-button customer-track-button--line" href="https://line.me/R/ti/p/@789gcnhq" target="_blank" rel="noreferrer" data-testid="link-line-official">
                <MessageCircle size={16} aria-hidden="true" />
                LINE Official @789gcnhq
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
          </section>
        </div>
      </div>
      <CompletedGallery photos={job.photos} inProgress={!completed} />
    </main>
  );
}

export function CustomerTrackingPage() {
  const { state, retry } = useTrackingJob();
  return (
    <div className="customer-track-page" data-testid="page-customer-tracking">
      <style>{`
        .customer-track-page {
          --track-ink: var(--ink, #173f6b);
          --track-muted: var(--ink-soft, #55718a);
          --track-paper: var(--paper, #f4f9fd);
          --track-panel: var(--card-paper, #fff);
          --track-line: var(--line, #d7e5ef);
          --track-blue: var(--brand-blue, #1268b3);
          --track-sky: var(--brand-sky, #e5f4fb);
          --track-gold: #c48638;
          min-height: 100dvh;
          color: var(--track-ink);
          background:
            linear-gradient(130deg, rgba(229,244,251,.74), transparent 36%),
            var(--track-paper);
          font-family: var(--storefront-sans, var(--app-font-sans, "Manrope", "Noto Sans Thai", sans-serif));
        }
        .customer-track-page *, .customer-track-page *::before, .customer-track-page *::after { box-sizing: border-box; }
        .customer-track-page button, .customer-track-page a { -webkit-tap-highlight-color: transparent; }
        .customer-track-page button { font: inherit; }
        .customer-track-header {
          width: min(1240px, calc(100% - 40px));
          min-height: 76px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          border-bottom: 1px solid rgba(215,229,239,.84);
        }
        .customer-track-brand { display: inline-flex; align-items: center; gap: 12px; color: var(--track-ink); text-decoration: none; }
        .customer-track-brand img { width: 40px; height: 40px; object-fit: contain; }
        .customer-track-brand span { display: grid; gap: 2px; }
        .customer-track-brand strong { font-size: 12px; letter-spacing: .12em; }
        .customer-track-brand small { color: var(--track-muted); font: 500 9px/1.2 var(--storefront-mono, monospace); letter-spacing: .12em; }
        .customer-track-header-note { display: inline-flex; align-items: center; gap: 7px; color: var(--track-muted); font-size: 12px; }
        .customer-track-header-note svg { color: var(--track-blue); }
        .customer-track-main { width: min(1120px, calc(100% - 40px)); margin: 0 auto; padding: 76px 0 90px; animation: track-page-in .55s ease both; }
        .customer-track-hero { display: flex; align-items: end; justify-content: space-between; gap: 40px; padding-bottom: 48px; }
        .customer-track-kicker { margin: 0 0 12px; color: var(--track-muted); font: 600 10px/1.3 var(--storefront-mono, monospace); letter-spacing: .16em; text-transform: uppercase; }
        .customer-track-kicker--gold { color: var(--track-gold); }
        .customer-track-hero h1 { margin: 0; font: 600 clamp(42px, 7vw, 76px)/.96 var(--storefront-display, Georgia, serif); letter-spacing: -.055em; }
        .customer-track-hero h1 em { color: var(--track-blue); font-style: italic; }
        .customer-track-lede { max-width: 510px; margin: 23px 0 0; color: var(--track-muted); font-size: 15px; line-height: 1.75; }
        .customer-track-reference-card { min-width: 220px; padding: 21px 22px 19px; border: 1px solid var(--track-line); border-top: 3px solid var(--track-gold); background: rgba(255,255,255,.62); box-shadow: 0 11px 30px rgba(23,63,107,.06); }
        .customer-track-reference-card span { display: block; color: var(--track-muted); font: 500 10px/1.4 var(--storefront-mono, monospace); letter-spacing: .13em; }
        .customer-track-reference-card strong { display: block; margin-top: 10px; color: var(--track-ink); font: 600 24px/1.1 var(--storefront-mono, monospace); letter-spacing: -.05em; overflow-wrap: anywhere; }
        .customer-track-reference-card small { display: block; margin-top: 8px; color: var(--track-muted); font-size: 12px; }
        .track-identity-strip { display: flex; align-items: center; gap: 17px; min-height: 80px; padding: 17px 22px; border: 1px solid var(--track-line); background: rgba(255,255,255,.48); }
        .track-identity-person, .track-identity-project { display: grid; gap: 3px; min-width: 0; }
        .track-identity-label { color: var(--track-muted); font-size: 11px; }
        .track-identity-person strong, .track-identity-project strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; }
        .track-identity-arrow { flex: none; color: var(--track-gold); }
        .track-identity-trust { display: inline-flex; align-items: center; gap: 7px; margin-left: auto; color: var(--track-blue); font-size: 12px; white-space: nowrap; }
        .track-content-grid { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(290px, .8fr); gap: 16px; margin-top: 16px; align-items: start; }
        .track-side-column { display: grid; gap: 16px; }
        .track-panel, .track-contact-card { border: 1px solid var(--track-line); background: rgba(255,255,255,.68); }
        .track-panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 23px 24px 19px; border-bottom: 1px solid var(--track-line); }
        .track-panel-heading h2 { margin: 0; font-size: 20px; letter-spacing: -.035em; }
        .track-panel-heading > svg { color: var(--track-blue); }
        .track-timeline { position: relative; list-style: none; margin: 0; padding: 25px 24px 27px; }
        .track-timeline::before { position: absolute; top: 38px; bottom: 38px; left: 43px; width: 1px; background: var(--track-line); content: ""; }
        .track-timeline-item { position: relative; display: flex; gap: 17px; min-height: 78px; }
        .track-timeline-item:last-child { min-height: 0; }
        .track-timeline-marker { z-index: 1; display: grid; flex: none; place-items: center; width: 38px; height: 38px; border: 1px solid var(--track-line); border-radius: 50%; color: var(--track-muted); background: var(--track-panel); }
        .track-timeline-item--done .track-timeline-marker { border-color: var(--track-blue); color: var(--track-panel); background: var(--track-blue); }
        .track-timeline-item--active .track-timeline-marker { border: 2px solid var(--track-gold); color: var(--track-gold); background: var(--track-panel); box-shadow: 0 0 0 5px rgba(196,134,56,.12); }
        .track-timeline-marker > span:not(.track-timeline-marker-number) { width: 8px; height: 8px; border-radius: 50%; background: currentColor; animation: track-pulse 1.7s ease-in-out infinite; }
        .track-timeline-marker-number { font: 500 11px var(--storefront-mono, monospace); }
        .track-timeline-content { min-width: 0; padding: 1px 0 24px; }
        .track-timeline-title-row { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
        .track-timeline-content h3 { margin: 0; font-size: 15px; }
        .track-timeline-content p { margin: 5px 0 5px; color: var(--track-muted); font-size: 12px; line-height: 1.55; }
        .track-timeline-content time { color: var(--track-muted); font: 500 11px var(--storefront-mono, monospace); }
        .track-status-pill { display: inline-flex; min-height: 21px; align-items: center; padding: 3px 8px; border-radius: 99px; color: var(--track-muted); background: var(--track-sky); font-size: 10px; }
        .track-timeline-item--active .track-status-pill { color: #8b5a20; background: rgba(196,134,56,.13); }
        .track-timeline-item--done .track-status-pill { color: var(--track-blue); }
        .track-summary-mark { display: grid; width: 32px; height: 32px; place-items: center; color: var(--track-gold); border: 1px solid rgba(196,134,56,.45); font: 500 10px var(--storefront-mono, monospace); }
        .track-summary-grid { display: grid; grid-template-columns: 1fr 1fr; margin: 0; }
        .track-summary-item { min-width: 0; padding: 19px 20px; border-bottom: 1px solid var(--track-line); }
        .track-summary-item:nth-child(odd) { border-right: 1px solid var(--track-line); }
        .track-summary-item:nth-last-child(-n+2) { border-bottom: 0; }
        .track-summary-item dt { color: var(--track-muted); font-size: 11px; }
        .track-summary-item dd { margin: 7px 0 0; font-size: 14px; font-weight: 700; overflow-wrap: anywhere; }
        .track-panel-empty { padding: 24px; color: var(--track-muted); font-size: 13px; }
        .track-panel-empty p { margin: 0; }
        .track-contact-card { display: flex; gap: 14px; padding: 22px; }
        .track-contact-icon { display: grid; flex: none; width: 38px; height: 38px; place-items: center; color: var(--track-blue); background: var(--track-sky); }
        .track-contact-card h2 { margin: 0; font-size: 16px; letter-spacing: -.02em; }
        .track-contact-card p:not(.customer-track-kicker) { margin: 7px 0 15px; color: var(--track-muted); font-size: 12px; line-height: 1.65; }
        .customer-track-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 0 13px; border: 1px solid transparent; text-decoration: none; font-size: 12px; font-weight: 700; cursor: pointer; transition: transform .2s ease, background-color .2s ease, border-color .2s ease; }
        .customer-track-button:hover { transform: translateY(-2px); }
        .customer-track-button--line { color: var(--track-panel); background: var(--track-blue); }
        .customer-track-button--line:hover { background: var(--track-ink); }
        .customer-track-button--dark { color: var(--track-panel); background: var(--track-ink); }
        .track-gallery-panel { margin-top: 16px; }
        .track-gallery-count { color: var(--track-muted); font: 500 11px var(--storefront-mono, monospace); }
        .track-gallery-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 11px; padding: 20px 24px 24px; }
        .track-gallery-item { position: relative; min-width: 0; overflow: hidden; aspect-ratio: 4 / 3; padding: 0; border: 0; background: var(--track-sky); cursor: pointer; }
        .track-gallery-item img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform .45s ease; }
        .track-gallery-item:hover img { transform: scale(1.04); }
        .track-gallery-item-overlay { position: absolute; right: 10px; top: 10px; display: grid; width: 30px; height: 30px; place-items: center; color: var(--track-ink); background: rgba(255,255,255,.85); opacity: 0; transform: translateY(4px); transition: opacity .2s ease, transform .2s ease; }
        .track-gallery-item:hover .track-gallery-item-overlay, .track-gallery-item:focus-visible .track-gallery-item-overlay { opacity: 1; transform: translateY(0); }
        .track-gallery-caption { position: absolute; right: 0; bottom: 0; left: 0; padding: 28px 11px 10px; color: #fff; background: linear-gradient(transparent, rgba(16,62,107,.8)); text-align: left; font-size: 11px; }
        .track-gallery-empty { display: grid; min-height: 130px; place-items: center; align-content: center; gap: 8px; padding: 22px; color: var(--track-muted); text-align: center; }
        .track-gallery-empty p { margin: 0; font-size: 12px; }
        .track-lightbox { position: fixed; z-index: 50; inset: 0; display: grid; place-items: center; padding: 30px; background: rgba(16,62,107,.82); animation: track-fade-in .2s ease both; }
        .track-lightbox-close { position: absolute; top: 18px; right: 18px; display: grid; width: 42px; height: 42px; place-items: center; color: var(--track-ink); background: var(--track-panel); cursor: pointer; }
        .track-lightbox-figure { max-width: min(980px, 94vw); max-height: 90vh; margin: 0; }
        .track-lightbox-figure img { display: block; max-width: 100%; max-height: 82vh; object-fit: contain; box-shadow: 0 22px 65px rgba(0,0,0,.24); }
        .track-lightbox-figure figcaption { margin-top: 10px; color: rgba(255,255,255,.84); font-size: 12px; }
        .customer-track-state { width: min(560px, calc(100% - 40px)); min-height: 430px; margin: 85px auto; padding: 52px 34px; border: 1px solid var(--track-line); background: rgba(255,255,255,.68); text-align: center; animation: track-page-in .5s ease both; }
        .customer-track-state-icon { display: grid; width: 50px; height: 50px; margin: 0 auto 19px; place-items: center; color: var(--track-blue); background: var(--track-sky); }
        .customer-track-state h1 { margin: 0; font: 600 32px/1.08 var(--storefront-display, Georgia, serif); letter-spacing: -.045em; }
        .customer-track-state > p:not(.customer-track-kicker) { max-width: 400px; margin: 14px auto 24px; color: var(--track-muted); font-size: 13px; line-height: 1.75; }
        .customer-track-state .customer-track-kicker { color: var(--track-gold); }
        .customer-track-state--loading { min-height: 430px; text-align: left; }
        .customer-track-footer { width: min(1120px, calc(100% - 40px)); margin: 0 auto; padding: 0 0 27px; color: var(--track-muted); font-size: 12px; }
        .customer-track-footer a { display: inline-flex; align-items: center; gap: 7px; text-decoration: none; transition: color .2s ease; }
        .customer-track-footer a:hover { color: var(--track-blue); }
        .track-skeleton { border-radius: 2px; background: linear-gradient(90deg, rgba(215,229,239,.55), rgba(229,244,251,.95), rgba(215,229,239,.55)); background-size: 200% 100%; animation: track-shimmer 1.4s ease-in-out infinite; }
        .track-skeleton--small { width: 110px; height: 12px; }
        .track-skeleton--title { width: min(100%, 390px); height: 53px; margin-top: 19px; }
        .track-skeleton--copy { width: min(100%, 410px); height: 12px; margin-top: 19px; }
        .track-skeleton--copy-short { width: 260px; margin-top: 9px; }
        .track-skeleton--card { width: 100%; height: 155px; margin-top: 44px; }
        @keyframes track-page-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes track-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes track-pulse { 0%, 100% { opacity: .5; transform: scale(.8); } 50% { opacity: 1; transform: scale(1); } }
        @keyframes track-shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
        @media (max-width: 760px) {
          .customer-track-header, .customer-track-main { width: min(100% - 28px, 600px); }
          .customer-track-footer { width: min(100% - 28px, 600px); }
          .customer-track-header { min-height: 68px; }
          .customer-track-header-note span { display: none; }
          .customer-track-main { padding: 47px 0 62px; }
          .customer-track-hero { display: block; padding-bottom: 30px; }
          .customer-track-hero h1 { font-size: clamp(43px, 13vw, 64px); }
          .customer-track-reference-card { margin-top: 29px; }
          .track-identity-strip { align-items: flex-start; flex-wrap: wrap; gap: 8px 13px; padding: 16px; }
          .track-identity-trust { flex: 0 0 100%; margin: 8px 0 0; padding-top: 12px; border-top: 1px solid var(--track-line); }
          .track-content-grid { grid-template-columns: 1fr; }
          .track-gallery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 15px; }
          .track-panel-heading { padding: 19px 17px 16px; }
          .track-timeline { padding: 22px 17px 24px; }
          .track-timeline::before { left: 36px; }
          .track-lightbox { padding: 18px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .customer-track-main, .customer-track-state, .track-lightbox, .track-skeleton, .track-timeline-marker > span:not(.track-timeline-marker-number) { animation: none; }
          .customer-track-button, .track-gallery-item img, .track-gallery-item-overlay { transition: none; }
        }
      `}</style>
      <BrandHeader />
      {state.kind === "ready" ? <ReadyView job={state.job} /> : <StatePanel state={state} retry={retry} />}
      <footer className="customer-track-footer">
        <a href="/" data-testid="link-tracking-back-to-store"><ArrowLeft size={14} aria-hidden="true" /> กลับหน้าร้าน Knight Basins</a>
      </footer>
    </div>
  );
}

export default CustomerTrackingPage;