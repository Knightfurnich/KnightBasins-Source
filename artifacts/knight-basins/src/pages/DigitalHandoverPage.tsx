import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  ImageOff,
  MapPin,
  Phone,
  Printer,
  Ruler,
  Share2,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { knightFurnichLogo } from "@/data/assets";

type StageKey = "quote_accepted" | "in_production" | "ready_to_install" | "installing" | "completed";
type HandoverPhoto = {
  id: string;
  imageUrl: string;
  stage: string;
  caption?: string;
  takenAt?: string | null;
};

type HandoverStudio = {
  shape?: string;
  dimensionsMm?: {
    depth?: number;
    runA?: number;
    runB?: number;
    runC?: number;
  };
  basinSkus?: string[];
  basinModel?: string;
  stoneType?: string;
  stoneColor?: string;
  slabSize?: string;
};

type HandoverJob = {
  jobCode?: string;
  quoteNumber?: string;
  customerName?: string;
  projectName?: string;
  timeline: Array<{ stage: StageKey; date?: string | null; done?: boolean }>;
  studio?: HandoverStudio | null;
  photos: HandoverPhoto[];
  site?: string;
  address?: string;
  phone?: string;
  completionDate?: string;
  handoverDate?: string;
};

type HandoverState =
  | { kind: "loading" }
  | { kind: "no-token" }
  | { kind: "error"; message: string; notFound: boolean }
  | { kind: "empty" }
  | { kind: "ready"; job: HandoverJob };

/**
 * Carries whether a failed fetch was a 404 (bad/expired token -- retrying
 * won't help) vs a real transient error (server hiccup -- retrying might).
 * The error panel below uses this to label the error correctly instead of
 * always saying "TEMPORARY ISSUE", which is misleading for a link that will
 * never resolve.
 */
class HandoverFetchError extends Error {
  notFound: boolean;
  constructor(message: string, notFound: boolean) {
    super(message);
    this.notFound = notFound;
  }
}

const STAGES: ReadonlyArray<StageKey> = [
  "quote_accepted",
  "in_production",
  "ready_to_install",
  "installing",
  "completed",
];
const ALLOWED_STAGES = new Set<StageKey>(STAGES);

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

function safeImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const candidate = value.trim();
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  if (candidate.startsWith("./")) return candidate;
  try {
    const parsed = new URL(candidate, window.location.origin);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

function parsePayload(payload: unknown): HandoverJob | null {
  const envelope = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
  if (!isRecord(envelope)) return null;

  const timeline = (Array.isArray(envelope.timeline) ? envelope.timeline : []).reduce<HandoverJob["timeline"]>(
    (items, item) => {
      if (!isRecord(item)) return items;
      const stage = item.stage;
      if (typeof stage !== "string" || !ALLOWED_STAGES.has(stage as StageKey)) return items;
      items.push({
        stage: stage as StageKey,
        date: validDate(item.date),
        done: item.done === true || item.status === "done",
      });
      return items;
    },
    [],
  );

  const rawStudio = isRecord(envelope.studio) ? envelope.studio : null;
  const studio = rawStudio
    ? {
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
        basinModel: optionalString(rawStudio.basinModel),
        stoneType: optionalString(rawStudio.stoneType),
        stoneColor: optionalString(rawStudio.stoneColor),
        slabSize: optionalString(rawStudio.slabSize),
      }
    : null;

  const rawPhotos = Array.isArray(envelope.sitePhotos)
    ? envelope.sitePhotos
    : Array.isArray(envelope.photos)
      ? envelope.photos
      : [];
  const photos = rawPhotos.reduce<HandoverPhoto[]>((items, item) => {
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

  const timelineCompletionDate = [...timeline]
    .reverse()
    .find((item) => item.stage === "completed" && item.done && item.date)?.date ?? undefined;
  const completionDate = validDate(envelope.completionDate)
    ?? validDate(envelope.completedAt)
    ?? validDate(envelope.installationCompletedAt)
    ?? timelineCompletionDate;
  const handoverDate = validDate(envelope.handoverDate)
    ?? validDate(envelope.handoverAt);
  const job: HandoverJob = {
    jobCode: optionalString(envelope.jobCode),
    quoteNumber: optionalString(envelope.quoteNumber),
    customerName: optionalString(envelope.customerName),
    projectName: optionalString(envelope.projectName),
    timeline,
    studio,
    photos,
    site: optionalString(envelope.site),
    address: optionalString(envelope.address),
    phone: optionalString(envelope.phone),
    completionDate: completionDate ?? undefined,
    handoverDate: handoverDate ?? undefined,
  };

  return job.jobCode
    || job.quoteNumber
    || job.customerName
    || job.projectName
    || job.timeline.length
    || job.studio
    || job.photos.length
    || job.site
    || job.address
    ? job
    : null;
}

function formatDate(value?: string | null): string {
  if (!value) return "ยังไม่ระบุ";
  try {
    return new Intl.DateTimeFormat("th-TH", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "ยังไม่ระบุ";
  }
}

function useHandoverJob() {
  const [state, setState] = useState<HandoverState>({ kind: "loading" });
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
        if (!response.ok) {
          const notFound = response.status === 404;
          throw new HandoverFetchError(notFound ? "ไม่พบข้อมูลงานสำหรับลิงก์นี้" : "ระบบส่งมอบงานไม่พร้อมใช้งานชั่วคราว", notFound);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        const job = parsePayload(payload);
        setState(job ? { kind: "ready", job } : { kind: "empty" });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof HandoverFetchError) {
          setState({ kind: "error", message: error.message, notFound: error.notFound });
          return;
        }
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "ไม่สามารถโหลดเอกสารส่งมอบงานได้",
          notFound: false,
        });
      });

    return () => controller.abort();
  }, [reloadKey]);

  return { state, retry: () => setReloadKey((key) => key + 1) };
}

function PrintStyles() {
  return (
    <style>{`
      .digital-handover-page {
        --handover-ink: var(--ink, #173f6b);
        --handover-muted: var(--ink-soft, #55718a);
        --handover-paper: var(--paper, #f4f9fd);
        --handover-panel: var(--card-paper, #ffffff);
        --handover-line: var(--line, #d7e5ef);
        --handover-blue: var(--brand-blue, #1268b3);
        --handover-sky: var(--brand-sky, #e5f4fb);
        --handover-gold: #bb7a28;
        min-height: 100dvh;
        color: var(--handover-ink);
        background:
          linear-gradient(145deg, rgba(229, 244, 251, .88), transparent 34%),
          var(--handover-paper);
        font-family: var(--storefront-sans, var(--app-font-sans, "Manrope", "Noto Sans Thai", sans-serif));
      }
      .digital-handover-page *, .digital-handover-page *::before, .digital-handover-page *::after { box-sizing: border-box; }
      .digital-handover-page button, .digital-handover-page a { -webkit-tap-highlight-color: transparent; }
      .digital-handover-page button { font: inherit; }
      .handover-shell { width: min(1120px, calc(100% - 40px)); margin: 0 auto; }
      .handover-header {
        display: flex;
        min-height: 80px;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        border-bottom: 1px solid rgba(215, 229, 239, .9);
      }
      .handover-brand { display: inline-flex; align-items: center; gap: 12px; color: var(--handover-ink); text-decoration: none; }
      .handover-brand img { width: 42px; height: 42px; object-fit: contain; }
      .handover-brand-copy { display: grid; gap: 2px; }
      .handover-brand-copy strong { font-size: 12px; letter-spacing: .12em; }
      .handover-brand-copy small, .handover-mono { color: var(--handover-muted); font: 500 10px/1.35 var(--storefront-mono, monospace); letter-spacing: .1em; }
      .handover-header-note { display: inline-flex; align-items: center; gap: 8px; color: var(--handover-muted); font-size: 12px; }
      .handover-header-note svg { color: var(--handover-blue); }
      .handover-main { padding: 52px 0 78px; animation: handover-in .48s ease both; }
      .handover-hero { display: grid; grid-template-columns: minmax(0, 1fr) 255px; align-items: end; gap: 42px; padding: 20px 0 34px; }
      .handover-eyebrow { margin: 0 0 12px; color: var(--handover-gold); font: 600 10px/1.4 var(--storefront-mono, monospace); letter-spacing: .18em; }
      .handover-hero h1 { max-width: 650px; margin: 0; font: 600 clamp(39px, 6vw, 70px)/.96 var(--storefront-display, Georgia, serif); letter-spacing: -.06em; }
      .handover-hero h1 em { color: var(--handover-blue); font-style: italic; }
      .handover-lede { max-width: 600px; margin: 20px 0 0; color: var(--handover-muted); font-size: 14px; line-height: 1.75; }
      .handover-reference { min-width: 0; padding: 20px 21px 18px; border: 1px solid var(--handover-line); border-top: 3px solid var(--handover-gold); background: rgba(255, 255, 255, .68); box-shadow: 0 12px 30px rgba(23, 63, 107, .055); }
      .handover-reference-label { display: block; color: var(--handover-muted); font: 500 10px/1.4 var(--storefront-mono, monospace); letter-spacing: .14em; }
      .handover-reference strong { display: block; margin-top: 9px; overflow-wrap: anywhere; font: 600 23px/1.2 var(--storefront-mono, monospace); letter-spacing: -.05em; }
      .handover-reference small { display: block; margin-top: 9px; color: var(--handover-muted); font-size: 12px; }
      .handover-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 0 0 22px; }
      .handover-action { display: inline-flex; min-height: 40px; align-items: center; justify-content: center; gap: 8px; padding: 0 14px; border: 1px solid var(--handover-line); color: var(--handover-ink); background: var(--handover-panel); font-size: 12px; font-weight: 700; cursor: pointer; transition: transform .2s ease, border-color .2s ease, background-color .2s ease; }
      .handover-action:hover { transform: translateY(-2px); border-color: var(--handover-blue); background: var(--handover-sky); }
      .handover-action:focus-visible { outline: 3px solid rgba(18, 104, 179, .2); outline-offset: 2px; }
      .handover-action--line { border-color: var(--handover-blue); color: var(--handover-blue); }
      .handover-identity { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px; border: 1px solid var(--handover-line); background: var(--handover-line); }
      .handover-identity-item { min-width: 0; padding: 17px 20px 18px; background: rgba(255, 255, 255, .67); }
      .handover-label { display: block; margin-bottom: 6px; color: var(--handover-muted); font-size: 11px; }
      .handover-identity-item strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; }
      .handover-identity-item small { display: block; margin-top: 4px; color: var(--handover-muted); font-size: 11px; overflow-wrap: anywhere; }
      .handover-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(280px, .8fr); gap: 14px; margin-top: 14px; align-items: start; }
      .handover-panel { min-width: 0; border: 1px solid var(--handover-line); background: rgba(255, 255, 255, .7); }
      .handover-panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 21px 22px 17px; border-bottom: 1px solid var(--handover-line); }
      .handover-panel-heading h2 { margin: 0; font-size: 19px; letter-spacing: -.035em; }
      .handover-panel-heading svg { color: var(--handover-blue); }
      .handover-kicker { margin: 0 0 8px; color: var(--handover-muted); font: 600 10px/1.35 var(--storefront-mono, monospace); letter-spacing: .15em; }
      .handover-summary-grid { display: grid; grid-template-columns: 1fr 1fr; margin: 0; }
      .handover-summary-item { min-width: 0; padding: 18px 19px; border-bottom: 1px solid var(--handover-line); }
      .handover-summary-item:nth-child(odd) { border-right: 1px solid var(--handover-line); }
      .handover-summary-item:nth-last-child(-n + 2) { border-bottom: 0; }
      .handover-summary-item dt { color: var(--handover-muted); font-size: 11px; }
      .handover-summary-item dd { margin: 7px 0 0; overflow-wrap: anywhere; font-size: 14px; font-weight: 700; }
      .handover-summary-empty, .handover-gallery-empty { padding: 22px; color: var(--handover-muted); font-size: 13px; }
      .handover-summary-empty p, .handover-gallery-empty p { margin: 0; }
      .handover-warranty { padding: 21px 22px 23px; }
      .handover-warranty-row { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 12px; padding: 0 0 18px; }
      .handover-warranty-row + .handover-warranty-row { padding-top: 18px; border-top: 1px solid var(--handover-line); }
      .handover-warranty-mark { display: grid; width: 34px; height: 34px; place-items: center; color: var(--handover-blue); background: var(--handover-sky); }
      .handover-warranty-row h3 { margin: 0; font-size: 14px; }
      .handover-warranty-row p { margin: 5px 0 0; color: var(--handover-muted); font-size: 12px; line-height: 1.65; }
      .handover-care { margin-top: 14px; padding: 21px 22px; border: 1px solid var(--handover-line); background: var(--handover-ink); color: #f4f9fd; }
      .handover-care .handover-kicker { color: #a9c8df; }
      .handover-care h2 { margin: 0; color: #f4f9fd; font-size: 19px; letter-spacing: -.035em; }
      .handover-care-list { display: grid; gap: 12px; margin: 18px 0 0; padding: 0; list-style: none; }
      .handover-care-list li { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 9px; color: #deebf3; font-size: 12px; line-height: 1.6; }
      .handover-care-list svg { margin-top: 2px; color: #e5b76e; }
      .handover-gallery-panel { margin-top: 14px; }
      .handover-gallery-count { color: var(--handover-muted); font: 500 11px var(--storefront-mono, monospace); }
      .handover-gallery-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 15px; }
      .handover-photo { position: relative; overflow: hidden; min-height: 170px; border: 0; padding: 0; background: var(--handover-sky); }
      .handover-photo img { display: block; width: 100%; height: 100%; min-height: 170px; object-fit: cover; transition: transform .35s ease; }
      .handover-photo:hover img { transform: scale(1.035); }
      .handover-photo figcaption { position: absolute; right: 0; bottom: 0; left: 0; padding: 28px 11px 10px; color: #fff; background: linear-gradient(transparent, rgba(16, 62, 107, .83)); font-size: 11px; }
      .handover-photo time { display: block; margin-top: 2px; opacity: .8; font-size: 10px; }
      .handover-footer { display: flex; align-items: flex-start; justify-content: space-between; gap: 22px; margin-top: 30px; padding-top: 17px; border-top: 1px solid var(--handover-line); color: var(--handover-muted); font-size: 11px; line-height: 1.6; }
      .handover-footer p { max-width: 650px; margin: 0; }
      .handover-footer strong { color: var(--handover-ink); }
      .handover-state { display: flex; min-height: 430px; flex-direction: column; align-items: center; justify-content: center; padding: 44px 24px; border: 1px solid var(--handover-line); background: rgba(255, 255, 255, .7); text-align: center; }
      .handover-state-icon { display: grid; width: 52px; height: 52px; place-items: center; color: var(--handover-blue); background: var(--handover-sky); }
      .handover-state--error .handover-state-icon { color: #a24439; background: rgba(162, 68, 57, .09); }
      .handover-state-kicker { margin: 17px 0 7px; color: var(--handover-muted); font: 600 10px/1.3 var(--storefront-mono, monospace); letter-spacing: .15em; }
      .handover-state h1 { margin: 0; font: 600 32px/1.08 var(--storefront-display, Georgia, serif); letter-spacing: -.04em; }
      .handover-state p:not(.handover-state-kicker) { max-width: 430px; margin: 10px 0 18px; color: var(--handover-muted); font-size: 13px; line-height: 1.7; }
      .handover-state--loading { align-items: stretch; }
      .handover-skeleton { animation: handover-pulse 1.5s ease-in-out infinite; background: var(--handover-line); }
      .handover-skeleton--kicker { width: 125px; height: 11px; margin-bottom: 18px; }
      .handover-skeleton--title { width: min(440px, 75%); height: 48px; }
      .handover-skeleton--copy { width: min(500px, 90%); height: 13px; margin-top: 18px; }
      .handover-skeleton--copy-short { width: min(320px, 60%); margin-top: 8px; }
      .handover-skeleton--panel { width: 100%; height: 144px; margin-top: 31px; }
      @keyframes handover-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes handover-pulse { 0%, 100% { opacity: .52; } 50% { opacity: 1; } }
      @media (max-width: 760px) {
        .handover-shell { width: min(100% - 28px, 620px); }
        .handover-header { min-height: 72px; }
        .handover-header-note { max-width: 122px; text-align: right; }
        .handover-main { padding-top: 31px; }
        .handover-hero { display: block; padding-top: 8px; }
        .handover-reference { margin-top: 25px; }
        .handover-actions { display: grid; grid-template-columns: 1fr 1fr; }
        .handover-action { width: 100%; padding: 0 8px; }
        .handover-identity, .handover-grid { grid-template-columns: 1fr; }
        .handover-identity { gap: 1px; }
        .handover-summary-grid { grid-template-columns: 1fr; }
        .handover-summary-item:nth-child(odd) { border-right: 0; }
        .handover-summary-item:nth-last-child(-n + 2) { border-bottom: 1px solid var(--handover-line); }
        .handover-summary-item:last-child { border-bottom: 0; }
        .handover-gallery-grid { grid-template-columns: 1fr 1fr; }
        .handover-photo, .handover-photo img { min-height: 135px; }
        .handover-footer { display: block; }
        .handover-footer .handover-mono { display: block; margin-top: 13px; }
      }
      @media (max-width: 420px) {
        .handover-brand-copy small { display: none; }
        .handover-header-note { font-size: 11px; }
        .handover-gallery-grid { grid-template-columns: 1fr; }
      }
      @media (prefers-reduced-motion: reduce) {
        .digital-handover-page, .handover-skeleton { animation: none; }
        .handover-action, .handover-photo img { transition: none; }
      }
      @media print {
        @page { size: A4; margin: 12mm 13mm; }
        html, body { background: #fff !important; }
        body::before { display: none !important; }
        .digital-handover-page { min-height: 0; background: #fff; color: #173f6b; }
        .handover-shell { width: 100%; }
        .handover-header { min-height: 60px; }
        .handover-main { padding: 22px 0 0; animation: none; }
        .handover-hero { grid-template-columns: minmax(0, 1fr) 205px; gap: 24px; padding: 10px 0 20px; }
        .handover-hero h1 { font-size: 39px; }
        .handover-lede { margin-top: 10px; font-size: 11px; }
        .handover-actions, .handover-photo figcaption { display: none !important; }
        .handover-reference { box-shadow: none; }
        .handover-identity { break-inside: avoid; }
        .handover-grid { grid-template-columns: minmax(0, 1.15fr) minmax(230px, .85fr); gap: 10px; margin-top: 10px; }
        .handover-panel-heading { padding: 14px 16px 12px; }
        .handover-panel-heading h2 { font-size: 16px; }
        .handover-summary-item { padding: 12px 14px; }
        .handover-summary-item dd { font-size: 12px; }
        .handover-warranty { padding: 14px 16px; }
        .handover-warranty-row { padding-bottom: 12px; }
        .handover-warranty-row + .handover-warranty-row { padding-top: 12px; }
        .handover-warranty-row p, .handover-care-list li { font-size: 10px; }
        .handover-care { margin-top: 10px; padding: 14px 16px; break-inside: avoid; }
        .handover-care-list { gap: 7px; margin-top: 10px; }
        .handover-gallery-panel { margin-top: 10px; break-inside: avoid; }
        .handover-gallery-grid { gap: 7px; padding: 10px; }
        .handover-photo, .handover-photo img { min-height: 125px; }
        .handover-footer { margin-top: 16px; padding-top: 10px; }
      }
    `}</style>
  );
}

function HandoverHeader() {
  return (
    <header className="handover-header">
      <a className="handover-brand" href="/" data-testid="link-handover-brand">
        <img src={knightFurnichLogo} alt="Knight Furnich" />
        <span className="handover-brand-copy">
          <strong>KNIGHT FURNICH</strong>
          <small>SOLID SURFACE / BASINS</small>
        </span>
      </a>
      <div className="handover-header-note">
        <FileCheck2 size={15} aria-hidden="true" />
        <span>เอกสารส่งมอบและรับประกันงานติดตั้ง</span>
      </div>
    </header>
  );
}

function HandoverStatePanel({
  state,
  retry,
}: {
  state: Exclude<HandoverState, { kind: "ready" }>;
  retry: () => void;
}) {
  if (state.kind === "loading") {
    return (
      <section className="handover-state handover-state--loading" aria-busy="true" data-testid="status-digital-handover-loading">
        <div className="handover-skeleton handover-skeleton--kicker" />
        <div className="handover-skeleton handover-skeleton--title" />
        <div className="handover-skeleton handover-skeleton--copy" />
        <div className="handover-skeleton handover-skeleton--copy handover-skeleton--copy-short" />
        <div className="handover-skeleton handover-skeleton--panel" />
      </section>
    );
  }

  const noToken = state.kind === "no-token";
  const empty = state.kind === "empty";
  const notFound = state.kind === "error" && state.notFound;
  return (
    <section
      className={`handover-state ${state.kind === "error" ? "handover-state--error" : ""}`}
      data-testid={
        noToken
          ? "status-digital-handover-no-token"
          : empty
            ? "status-digital-handover-empty"
            : "status-digital-handover-error"
      }
    >
      <div className="handover-state-icon" aria-hidden="true">
        {state.kind === "error" ? <CircleAlert size={23} /> : <FileCheck2 size={22} />}
      </div>
      <p className="handover-state-kicker">{noToken ? "PRIVATE HANDOVER RECORD" : empty ? "NO HANDOVER DETAILS" : notFound ? "LINK NOT FOUND" : "TEMPORARY ISSUE"}</p>
      <h1>
        {noToken
          ? "เปิดเอกสารส่งมอบจาก Knight Furnich"
          : empty
            ? "ยังไม่มีรายละเอียดงานให้แสดง"
            : "ไม่สามารถโหลดเอกสารส่งมอบได้"}
      </h1>
      <p>
        {noToken
          ? "ลิงก์เอกสารของคุณจะมีรหัสเฉพาะหลังคำว่า token กรุณาใช้ลิงก์ที่ร้านส่งให้"
          : empty
            ? "ตรวจสอบลิงก์อีกครั้ง หรือติดต่อทีมงานเพื่อขอเอกสารฉบับที่ถูกต้อง"
            : state.message}
      </p>
      {/* A 404 means this token will never resolve -- retrying just reproduces
          the same error, so the button would be misleading busywork. */}
      {!noToken && !notFound && (
        <button type="button" className="handover-action" onClick={retry} data-testid="button-retry-digital-handover">
          ลองโหลดอีกครั้ง
        </button>
      )}
    </section>
  );
}

function HandoverSummary({ studio }: { studio?: HandoverStudio | null }) {
  const dimensionParts = [
    ["ด้าน A", studio?.dimensionsMm?.runA],
    ["ด้าน B", studio?.dimensionsMm?.runB],
    ["ด้าน C", studio?.dimensionsMm?.runC],
    ["ระยะลึก", studio?.dimensionsMm?.depth],
  ]
    .filter((item): item is [string, number] => typeof item[1] === "number")
    .map(([label, value]) => `${label} ${value.toLocaleString("th-TH")}`);
  const counterDimensions = studio?.slabSize
    || (dimensionParts.length ? `${dimensionParts.join(" · ")} มม.` : undefined);
  const basinModel = studio?.basinModel || studio?.basinSkus?.join(", ");
  const details = [
    { label: "ประเภทหินสังเคราะห์", testId: "stone-type", value: studio?.stoneType },
    { label: "สีหิน", testId: "stone-color", value: studio?.stoneColor },
    { label: "รุ่นอ่าง / SKU", testId: "basin-model", value: basinModel },
    { label: "รูปแบบเคาน์เตอร์", testId: "counter-shape", value: studio?.shape },
    { label: "ขนาดเคาน์เตอร์", testId: "counter-dimensions", value: counterDimensions },
  ].filter((item): item is { label: string; testId: string; value: string } => Boolean(item.value));

  return (
    <section className="handover-panel" aria-labelledby="handover-summary-title" data-testid="section-installed-details">
      <div className="handover-panel-heading">
        <div>
          <p className="handover-kicker">INSTALLED SPECIFICATION</p>
          <h2 id="handover-summary-title">รายละเอียดชิ้นงานที่ติดตั้ง</h2>
        </div>
        <Ruler size={20} aria-hidden="true" />
      </div>
      {details.length ? (
        <dl className="handover-summary-grid">
          {details.map((detail) => (
            <div className="handover-summary-item" key={detail.label}>
              <dt>{detail.label}</dt>
              <dd data-testid={`text-handover-${detail.testId}`}>{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="handover-summary-empty" data-testid="status-handover-details-empty">
          <p>รายละเอียดวัสดุกำลังจัดเตรียมให้คุณ</p>
        </div>
      )}
    </section>
  );
}

function WarrantyPanel() {
  return (
    <section className="handover-panel" aria-labelledby="warranty-title" data-testid="section-warranty">
      <div className="handover-panel-heading">
        <div>
          <p className="handover-kicker">WARRANTY COVERAGE</p>
          <h2 id="warranty-title">เงื่อนไขการรับประกัน</h2>
        </div>
        <ShieldCheck size={20} aria-hidden="true" />
      </div>
      <div className="handover-warranty">
        <div className="handover-warranty-row">
          <span className="handover-warranty-mark" aria-hidden="true"><Wrench size={17} /></span>
          <div>
            <h3>รับประกันงานประกอบและติดตั้ง 1 ปี</h3>
            <p>ครอบคลุมความบกพร่องจากการประกอบและการติดตั้ง โดยเริ่มนับจากวันที่ส่งมอบงาน</p>
          </div>
        </div>
        <div className="handover-warranty-row">
          <span className="handover-warranty-mark" aria-hidden="true"><ShieldCheck size={17} /></span>
          <div>
            <h3>รับประกันวัสดุตามเงื่อนไขผู้ผลิต</h3>
            <p>วัสดุหินสังเคราะห์อยู่ภายใต้เงื่อนไขและระยะเวลารับประกันของผู้ผลิตวัสดุนั้น</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CarePanel() {
  return (
    <section className="handover-care" aria-labelledby="care-title" data-testid="section-care-guide">
      <p className="handover-kicker">CARE NOTES</p>
      <h2 id="care-title">ดูแลให้สวยเหมือนวันส่งมอบ</h2>
      <ul className="handover-care-list">
        <li><Check size={17} aria-hidden="true" /><span>เช็ดทำความสะอาดเป็นประจำด้วยสบู่อ่อนหรือน้ำยาล้างจาน และผ้านุ่ม</span></li>
        <li><Check size={17} aria-hidden="true" /><span>หลีกเลี่ยงการวางภาชนะหรือเครื่องครัวที่ร้อนจัดลงบนเคาน์เตอร์โดยตรง ควรใช้แผ่นรอง</span></li>
        <li><Check size={17} aria-hidden="true" /><span>หลีกเลี่ยงสารเคมีที่มีฤทธิ์เป็นกรดหรือด่างรุนแรง รวมถึงน้ำยาขัดที่มีฤทธิ์กัดผิว</span></li>
      </ul>
    </section>
  );
}

function CompletedGallery({ photos }: { photos: HandoverPhoto[] }) {
  return (
    <section className="handover-panel handover-gallery-panel" aria-labelledby="handover-gallery-title" data-testid="section-completed-work">
      <div className="handover-panel-heading">
        <div>
          <p className="handover-kicker">COMPLETED WORK</p>
          <h2 id="handover-gallery-title">ภาพงานติดตั้งที่ส่งมอบ</h2>
        </div>
        <span className="handover-gallery-count" data-testid="text-handover-photo-count">{photos.length ? `${photos.length} ภาพ` : "ยังไม่มีภาพ"}</span>
      </div>
      {photos.length ? (
        <div className="handover-gallery-grid">
          {photos.map((photo) => (
            <figure className="handover-photo" key={photo.id} data-testid={`figure-handover-photo-${photo.id}`}>
              <img src={photo.imageUrl} alt={photo.caption || "ภาพงานติดตั้งเคาน์เตอร์ของคุณ"} loading="lazy" />
              <figcaption>
                {photo.caption || "งานติดตั้ง Knight Furnich"}
                {photo.takenAt && <time dateTime={photo.takenAt}>{formatDate(photo.takenAt)}</time>}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="handover-gallery-empty" data-testid="status-handover-photos-empty">
          <ImageOff size={20} aria-hidden="true" />
          <p>ยังไม่มีรูปถ่ายส่งมอบสำหรับงานนี้</p>
        </div>
      )}
    </section>
  );
}

function ReadyHandover({ job }: { job: HandoverJob }) {
  const reference = job.jobCode || job.quoteNumber || "—";
  const completionDate = job.handoverDate || job.completionDate;
  const phone = job.phone;
  const location = job.site || job.address;
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, []);
  const lineShareUrl = useMemo(() => {
    if (!shareUrl) return "";
    const text = `เอกสารส่งมอบงาน Knight Furnich ${reference}\n${shareUrl}`;
    return `https://line.me/R/msg/text/?text=${encodeURIComponent(text)}`;
  }, [reference, shareUrl]);

  return (
    <>
      <section className="handover-hero">
        <div>
          <p className="handover-eyebrow">KNIGHT FURNICH / DIGITAL HANDOVER</p>
          <h1>เอกสารส่งมอบงาน<br /><em>พร้อมดูแลต่อจากเรา</em></h1>
          <p className="handover-lede">บันทึกอ้างอิงสำหรับเคาน์เตอร์หินสังเคราะห์ที่ติดตั้งในโครงการของคุณ พร้อมรายละเอียดวัสดุ การรับประกัน และแนวทางดูแลรักษา</p>
        </div>
        <div className="handover-reference" data-testid="card-handover-reference">
          <span className="handover-reference-label">HANDOVER REFERENCE</span>
          <strong data-testid="text-handover-reference">{reference}</strong>
          {job.quoteNumber && <small data-testid="text-handover-quote">ใบเสนอราคา {job.quoteNumber}</small>}
          <small data-testid="text-handover-date"><CalendarDays size={12} aria-hidden="true" /> ส่งมอบเมื่อ {formatDate(completionDate)}</small>
        </div>
      </section>

      <div className="handover-actions" aria-label="การดำเนินการเอกสาร">
        <button
          type="button"
          className="handover-action"
          onClick={() => window.print()}
          data-testid="button-print-handover"
          aria-label="พิมพ์เอกสารส่งมอบงาน"
        >
          <Printer size={16} aria-hidden="true" />
          พิมพ์เอกสาร
        </button>
        <a
          className="handover-action handover-action--line"
          href={lineShareUrl || "#"}
          target="_blank"
          rel="noreferrer"
          data-testid="button-share-handover-line"
          aria-label="แชร์เอกสารส่งมอบงานผ่าน LINE"
          onClick={(event) => { if (!lineShareUrl) event.preventDefault(); }}
        >
          <Share2 size={16} aria-hidden="true" />
          แชร์ผ่าน LINE
        </a>
      </div>

      <section className="handover-identity" aria-label="ข้อมูลลูกค้าและโครงการ">
        <div className="handover-identity-item">
          <span className="handover-label">ลูกค้า</span>
          <strong data-testid="text-handover-customer">{job.customerName || "ลูกค้า Knight Furnich"}</strong>
          <small data-testid="text-handover-phone" aria-label="หมายเลขโทรศัพท์ที่ปกปิดบางส่วน">
            <Phone size={12} aria-hidden="true" /> {phone || "ไม่ได้ระบุ"}
          </small>
        </div>
        <div className="handover-identity-item">
          <span className="handover-label">โครงการ</span>
          <strong data-testid="text-handover-project">{job.projectName || "ไม่ได้ระบุชื่อโครงการ"}</strong>
        </div>
        <div className="handover-identity-item">
          <span className="handover-label"><MapPin size={12} aria-hidden="true" /> สถานที่ติดตั้ง</span>
          <strong data-testid="text-handover-location">{location || "ไม่ได้ระบุสถานที่"}</strong>
        </div>
      </section>

      <div className="handover-grid">
        <HandoverSummary studio={job.studio} />
        <div>
          <WarrantyPanel />
          <CarePanel />
        </div>
      </div>
      <CompletedGallery photos={job.photos} />

      <footer className="handover-footer">
        <p><strong>เอกสารฉบับนี้จัดทำเพื่อเป็นบันทึกการส่งมอบงาน</strong><br />หากต้องการสอบถามเรื่องการรับประกันหรือการดูแลรักษา กรุณาแจ้งหมายเลขอ้างอิงนี้แก่ทีมงาน Knight Furnich</p>
        <span className="handover-mono">KF / HANDOVER RECORD</span>
      </footer>
    </>
  );
}

export function DigitalHandoverPage() {
  const { state, retry } = useHandoverJob();

  return (
    <div className="digital-handover-page" data-testid="page-digital-handover">
      <PrintStyles />
      <div className="handover-shell">
        <HandoverHeader />
        <main className="handover-main">
          {state.kind === "ready" ? <ReadyHandover job={state.job} /> : <HandoverStatePanel state={state} retry={retry} />}
        </main>
      </div>
    </div>
  );
}

export default DigitalHandoverPage;