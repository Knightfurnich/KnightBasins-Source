import { useEffect, useMemo, useRef, useState, type Dispatch, type DragEvent, type SetStateAction } from "react";
import { AlertTriangle, ArrowRight, Check, Copy, Download, GripVertical, Plus, RotateCw, Trash2, Upload, X } from "lucide-react";
import {
  PRODUCTS,
  STONE_COLORS,
  filterBasinProducts,
  formatTHB,
  productBySku,
  stoneColorByName,
  type CustomerDetails,
} from "@/data/catalog";
import {
  basinDimensionsForProduct,
  createBasinPlacement,
  pieceBounds,
  pieceOverlapWarnings,
  placementFitsStudioPiece,
  sideStatusKey,
  snapStudioRectanglePosition,
  studioEdgeTotals,
  studioEstimate,
  studioPieceById,
  studioPieceEdges,
  studioPieceJoints,
  studioPieceAreaSqM,
  studioPieces,
  studioRectangleSize,
  studioSideStatuses,
  studioSideStatusLabel,
  studioSubmissionValidationMessage,
  studioStoneName,
  studioStateDimensionsValid,
  studioPieces as getStudioPieces,
  STUDIO_MAX_PIECES,
  STUDIO_MAX_RECTANGLES,
  STUDIO_MAX_BASINS,
  STUDIO_MAX_STONE_COLORS,
  STUDIO_MIN_BASINS,
  STUDIO_MIN_STONE_COLORS,
  type BasinPlacement,
  type SideStatus,
  type StudioEstimate,
  type StudioLocation,
  type StudioOrderMode,
  type StudioPiece,
  type StudioRectangle,
  type StudioState,
} from "@/data/studio-model";
import { StudioFootprint } from "./StudioFootprint";
import { downloadStudioDxf, downloadStudioPng, printStudioLayout, studioExportDimensionsValid, studioPrintTitle, STUDIO_PRINT_NOTE } from "@/data/studio-export";
import { clearStoredStudioDraft, decodeStudioDraft, encodeStudioDraft, readStoredStudioDraft, writeStoredStudioDraft, type StudioDraftRecord } from "@/data/studio-draft";

const emptyContact: Pick<CustomerDetails, "name" | "company" | "phone" | "email" | "project" | "address"> = {
  name: "",
  company: "",
  phone: "",
  email: "",
  project: "",
  address: "",
};

export type StudioSubmission = {
  state: StudioState;
  estimate: StudioEstimate;
  contact: typeof emptyContact;
  notification: StudioNotificationSnapshot;
};

export type StudioNotificationItem = {
  kind: "basin" | "stone" | "service";
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceTHB?: number;
  totalTHB?: number;
};

export type StudioNotificationSnapshot = {
  items: StudioNotificationItem[];
  grossSubtotal: number;
  discountAmount: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  vat: boolean;
};

type StudioPageProps = {
  mode: Extract<StudioOrderMode, "studio" | "sketch">;
  leadKey: string;
  onSubmitStudio: (submission: StudioSubmission) => Promise<void> | void;
};

const makeRectangle = (index: number): StudioRectangle => ({
  id: `rectangle-${Date.now()}-${index}`,
  widthMm: 1800,
  lengthMm: 600,
  xMm: index ? 1800 : 0,
  yMm: 0,
  rotation: 0,
  label: index ? "แผ่นต่อ" : "แผ่นหลัก",
});

const makePiece = (index: number): StudioPiece => {
  const rectangle = makeRectangle(index);
  return { id: `piece-${Date.now()}-${index}`, name: `ชิ้นงาน ${index + 1}`, rectangles: [rectangle], sideStatuses: {} };
};

const initialState: StudioState = {
  mode: "studio",
  shape: "I",
  dimensions: { depthMm: 600, runAMm: 1800, runBMm: 0, runCMm: 0 },
  pieces: [makePiece(0)],
  activePieceId: "",
  backsplash: { enabled: false, heightMm: 120 },
  upstandHeightMm: 120,
  openEdgePricePerMTHB: null,
  discountTHB: 0,
  location: "bangkok-metro",
  vat: false,
  quoteFormat: "US",
  stoneColors: ["BW010", "MU010"],
  activeStone: "BW010",
  basinSkus: ["KF001"],
  basinPlacements: [],
};

function createInitialStudioState(mode: Extract<StudioOrderMode, "studio" | "sketch">): StudioState {
  const piece = makePiece(0);
  return {
    ...initialState,
    mode,
    dimensions: { ...initialState.dimensions },
    pieces: [piece],
    activePieceId: piece.id,
    backsplash: { ...initialState.backsplash },
    stoneColors: [...initialState.stoneColors],
    basinSkus: [...initialState.basinSkus],
    basinPlacements: [],
  };
}

function readLinkedDraft() {
  if (typeof window === "undefined") return { token: "", state: null as StudioState | null };
  const token = new URLSearchParams(window.location.search).get("draft") ?? "";
  return { token, state: token ? decodeStudioDraft(token) : null };
}

function formatDraftTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "ไม่ทราบเวลา";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function studioDraftUrl(state: StudioState) {
  const url = new URL("/studio", window.location.origin);
  url.searchParams.set("draft", encodeStudioDraft(state));
  return url.toString();
}

function numericValue(value: string, fallback = 0) {
  if (value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function StudioContactFields({ contact, setContact }: { contact: typeof emptyContact; setContact: Dispatch<SetStateAction<typeof emptyContact>> }) {
  const update = (key: keyof typeof emptyContact, value: string) => setContact((current) => ({ ...current, [key]: value }));
  return <div className="studio-contact-grid">
    {([
      ["name", "ชื่อผู้ติดต่อ", true],
      ["company", "บริษัท", false],
      ["phone", "โทรศัพท์", true],
      ["email", "อีเมล", false],
      ["project", "ชื่อโครงการ", true],
      ["address", "ที่อยู่ / สถานที่ติดตั้ง", true],
    ] as const).map(([key, label, required]) => <label key={key}>{label}{required && <span> *</span>}<input required={required} value={contact[key]} onChange={(event) => update(key, event.target.value)} data-testid={`input-studio-${key}`} /></label>)}
  </div>;
}

function StudioShortlists({ state, setState }: { state: StudioState; setState: Dispatch<SetStateAction<StudioState>> }) {
  const [basinQuery, setBasinQuery] = useState("");
  const visibleBasins = useMemo(() => filterBasinProducts(PRODUCTS, basinQuery), [basinQuery]);
  const toggleStone = (code: string) => setState((current) => {
    if (current.stoneColors.includes(code)) {
      if (current.stoneColors.length <= STUDIO_MIN_STONE_COLORS) return current;
      const next = current.stoneColors.filter((item) => item !== code);
      return { ...current, stoneColors: next, activeStone: current.activeStone === code ? next[0] : current.activeStone };
    }
    if (current.stoneColors.length >= STUDIO_MAX_STONE_COLORS) return current;
    return { ...current, stoneColors: [...current.stoneColors, code] };
  });
  const toggleBasin = (sku: string) => setState((current) => {
    if (current.basinSkus.includes(sku)) {
      if (current.basinSkus.length <= STUDIO_MIN_BASINS) return current;
      return { ...current, basinSkus: current.basinSkus.filter((item) => item !== sku), basinPlacements: current.basinPlacements.filter((item) => item.sku !== sku) };
    }
    if (current.basinSkus.length >= STUDIO_MAX_BASINS) return current;
    return { ...current, basinSkus: [...current.basinSkus, sku] };
  });
  return <div className="studio-shortlists">
    <section className="studio-panel">
      <div className="studio-panel-heading"><div><p className="eyebrow">01 / MATERIAL SHORTLIST</p><h3>เลือกสีหิน 2–3 สี</h3></div><span>{state.stoneColors.length} / 3</span></div>
      <p className="studio-helper">เลือกสีเพื่อเปรียบเทียบ แล้วเลือกสีที่ใช้คำนวณจากรายการด้านล่าง</p>
      <div className="studio-stone-list">{STONE_COLORS.slice(0, 24).map((stone) => {
        const selected = state.stoneColors.includes(stone.code);
        return <button type="button" key={stone.code} className={`studio-stone-choice ${selected ? "is-selected" : ""} ${state.activeStone === stone.code ? "is-active" : ""}`} onClick={() => toggleStone(stone.code)} aria-pressed={selected} data-testid={`button-studio-stone-${stone.code}`}><span style={{ background: stone.tone }} /> <strong>{stone.code}</strong><small>{stone.name}</small>{selected && <Check size={14} />}</button>;
      })}</div>
      <div className="studio-active-stone"><span>กำลังคำนวณด้วย</span>{state.stoneColors.map((code) => <button type="button" key={code} className={state.activeStone === code ? "is-active" : ""} onClick={() => setState((current) => ({ ...current, activeStone: code }))} data-testid={`button-studio-active-stone-${code}`}>{studioStoneName(code)} · {formatTHB(stoneColorByName(code).installedPriceTHB ?? 0)} / m²</button>)}</div>
    </section>
    <section className="studio-panel">
      <div className="studio-panel-heading"><div><p className="eyebrow">02 / BASIN SHORTLIST</p><h3>เลือกแบบอ่าง 1–2 รุ่น</h3></div><span>{state.basinSkus.length} / 2</span></div>
      <p className="studio-helper">ลากรุ่นที่เลือกไปวางบนแผ่นใดก็ได้ หรือกดเลือกเพื่อเพิ่ม / นำออก</p>
      <label className="studio-basin-search">ค้นหา SKU หรือสี<input type="search" value={basinQuery} onChange={(event) => setBasinQuery(event.target.value)} placeholder="เช่น KF029 หรือ White" aria-label="ค้นหา SKU หรือสีของอ่าง" data-testid="input-studio-basin-search" /></label>
      <p className="studio-basin-result-count">แสดง {visibleBasins.length} จาก {PRODUCTS.length} รุ่น</p>
      <div className="studio-basin-list">{visibleBasins.map((product) => {
        const selected = state.basinSkus.includes(product.sku);
        return <button type="button" key={product.sku} draggable={selected} onDragStart={(event) => event.dataTransfer.setData("application/x-studio-basin", product.sku)} className={`studio-basin-choice ${selected ? "is-selected" : ""}`} onClick={() => toggleBasin(product.sku)} aria-pressed={selected} data-testid={`button-studio-basin-${product.sku}`}><span>{product.sku}</span><strong>{product.colorName}</strong><small>{formatTHB(product.priceTHB)}</small>{selected && <GripVertical size={14} />}</button>;
      })}{visibleBasins.length === 0 && <p className="studio-basin-empty">ไม่พบรุ่นที่ตรงกับการค้นหา</p>}</div>
    </section>
  </div>;
}

function setPieceState(setState: Dispatch<SetStateAction<StudioState>>, pieceId: string, updater: (piece: StudioPiece) => StudioPiece) {
  setState((current) => ({ ...current, pieces: getStudioPieces(current).map((piece) => piece.id === pieceId ? updater(piece) : piece) }));
}

function StudioPieceEditor({ piece, state, setState }: { piece: StudioPiece; state: StudioState; setState: Dispatch<SetStateAction<StudioState>> }) {
  const overlaps = pieceOverlapWarnings(piece);
  const bounds = pieceBounds(piece);
  const placements = state.basinPlacements.filter((placement) => (placement.pieceId ?? state.pieces?.[0]?.id) === piece.id);
  const moveRectangle = (rectangleId: string, xMm: number, yMm: number) => setPieceState(setState, piece.id, (current) => {
    const snapped = snapStudioRectanglePosition(current, rectangleId, xMm, yMm);
    return { ...current, rectangles: current.rectangles.map((rectangle) => rectangle.id === rectangleId ? { ...rectangle, ...snapped } : rectangle) };
  });
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const rectangleId = event.dataTransfer.getData("application/x-studio-rectangle");
    if (rectangleId) {
      const canvasX = ((event.clientX - rect.left) / rect.width) * bounds.widthMm;
      const canvasY = ((event.clientY - rect.top) / rect.height) * bounds.heightMm;
      const moving = piece.rectangles.find((rectangle) => rectangle.id === rectangleId);
      if (moving) moveRectangle(rectangleId, canvasX - studioRectangleSize(moving).widthMm / 2, canvasY - studioRectangleSize(moving).heightMm / 2);
      return;
    }
    const sku = event.dataTransfer.getData("application/x-studio-basin");
    const product = productBySku(sku);
    if (!product || !state.basinSkus.includes(sku)) return;
    const placement = createBasinPlacement(product, state.basinPlacements.length, piece.id);
    const xMm = ((event.clientX - rect.left) / rect.width) * bounds.widthMm - (placement.widthMm ?? 0) / 2;
    const yMm = ((event.clientY - rect.top) / rect.height) * bounds.heightMm - (placement.depthMm ?? 0) / 2;
    const size = placement.widthMm !== null && placement.depthMm !== null ? { xMm, yMm } : { xMm: 0, yMm: 0 };
    setState((current) => ({ ...current, basinPlacements: [...current.basinPlacements, { ...placement, ...size }] }));
  };
  const changeStatus = (rectangleId: string, side: "top" | "right" | "bottom" | "left", status: SideStatus) => setPieceState(setState, piece.id, (current) => {
    const edge = studioPieceEdges(current).find((candidate) => candidate.rectangleId === rectangleId && candidate.side === side);
    const keys = new Set(edge ? [edge.key] : [sideStatusKey(rectangleId, side)]);
    if (edge) {
      studioPieceJoints(current).forEach((joint) => {
        if (joint.first.key === edge.key || joint.second.key === edge.key) {
          keys.add(joint.first.key);
          keys.add(joint.second.key);
        }
      });
    }
    return { ...current, sideStatuses: { ...current.sideStatuses, ...Object.fromEntries([...keys].map((key) => [key, status])) } };
  });
  return <section className="studio-piece-editor">
    <div className="studio-piece-heading">
      <label><span>ชื่อชิ้นงาน</span><input value={piece.name} onChange={(event) => setPieceState(setState, piece.id, (current) => ({ ...current, name: event.target.value }))} data-testid={`input-piece-name-${piece.id}`} /></label>
      <span>{piece.rectangles.length} / {STUDIO_MAX_RECTANGLES} แผ่น · {studioPieceAreaSqM(piece).toFixed(4)} m²</span>
    </div>
    <div className="studio-piece-rectangle-list">
      {piece.rectangles.map((rectangle, index) => {
        const statuses = studioSideStatuses(piece, rectangle.id);
        return <div className="studio-rectangle-editor" key={rectangle.id}>
          <div className="studio-rectangle-editor-heading"><strong>แผ่น {index + 1}</strong><button type="button" className="icon-button" onClick={() => setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.filter((item) => item.id !== rectangle.id) }))} disabled={piece.rectangles.length <= 1} aria-label={`ลบแผ่น ${index + 1}`}><Trash2 size={14} /></button></div>
          <div className="studio-rectangle-inputs">
            <label>กว้าง (มม.)<input type="number" min="1" value={rectangle.widthMm} onChange={(event) => setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.map((item) => item.id === rectangle.id ? { ...item, widthMm: numericValue(event.target.value) } : item) }))} data-testid={`input-rectangle-width-${rectangle.id}`} /></label>
            <label>ยาว (มม.)<input type="number" min="1" value={rectangle.lengthMm} onChange={(event) => setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.map((item) => item.id === rectangle.id ? { ...item, lengthMm: numericValue(event.target.value) } : item) }))} data-testid={`input-rectangle-length-${rectangle.id}`} /></label>
            <label>X<input type="number" min="0" value={rectangle.xMm} onChange={(event) => setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.map((item) => item.id === rectangle.id ? { ...item, xMm: numericValue(event.target.value) } : item) }))} /></label>
            <label>Y<input type="number" min="0" value={rectangle.yMm} onChange={(event) => setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.map((item) => item.id === rectangle.id ? { ...item, yMm: numericValue(event.target.value) } : item) }))} /></label>
          </div>
          <button type="button" className="button button--outline studio-rotate-button" onClick={() => setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.map((item) => item.id === rectangle.id ? { ...item, rotation: item.rotation === 0 ? 90 : 0 } : item) }))}><RotateCw size={14} /> สลับแนวนอน / แนวตั้ง</button>
          <div className="studio-side-status-grid">{statuses.map(({ side, label, status }) => <label key={side}>{label}<select value={status} onChange={(event) => changeStatus(rectangle.id, side, event.target.value as SideStatus)}><option value="normal">ปกติ</option><option value="upstand">ติดบัว ▲</option><option value="open-edge">ขอบเปิด ⊗</option><option value="wall-flush">ชิดผนัง ║</option></select></label>)}</div>
        </div>;
      })}
      <button type="button" className="button button--outline" disabled={piece.rectangles.length >= STUDIO_MAX_RECTANGLES} onClick={() => setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: [...current.rectangles, makeRectangle(current.rectangles.length)] }))}><Plus size={14} /> เพิ่มสี่เหลี่ยม / ขั้น</button>
    </div>
    {overlaps.length > 0 && <p className="studio-warning"><AlertTriangle size={15} /> มีสี่เหลี่ยมซ้อนกัน ({overlaps.length} จุด) พื้นที่ไม่ถูกหักซ้ำ แต่ควรตรวจสอบการจัดวาง</p>}
    <StudioFootprint piece={piece} stoneTone={stoneColorByName(state.activeStone).tone} testId={piece.id === state.pieces?.[0]?.id ? "studio-canvas" : `studio-canvas-${piece.id}`} ariaLabel={`ผังชิ้นงาน ${piece.name}`} onDragOver={(event) => event.preventDefault()} onDrop={drop}>
      {placements.map((placement) => {
        const unknown = placement.widthMm === null || placement.depthMm === null;
        return <div key={placement.id} draggable className={`studio-placement ${unknown ? "studio-placement--unknown" : ""}`} style={{ left: `${(placement.xMm / Math.max(1, bounds.widthMm)) * 100}%`, top: `${(placement.yMm / Math.max(1, bounds.heightMm)) * 100}%`, width: unknown ? "18%" : `${((placement.widthMm ?? 0) / Math.max(1, bounds.widthMm)) * 100}%`, height: unknown ? "18%" : `${((placement.depthMm ?? 0) / Math.max(1, bounds.heightMm)) * 100}%` }} onDragStart={(event) => event.dataTransfer.setData("application/x-studio-placement", placement.id)}><strong>{placement.sku}</strong><small>{unknown ? "ขนาดหลุมไม่ระบุ" : "ลากเพื่อย้าย"}</small><button type="button" onClick={() => setState((current) => ({ ...current, basinPlacements: current.basinPlacements.filter((item) => item.id !== placement.id) }))} aria-label={`นำ ${placement.sku} ออกจากผัง`}><X size={12} /></button></div>;
      })}
      {piece.rectangles.map((rectangle) => <div key={`drag-${rectangle.id}`} className="studio-rectangle-drag-target" draggable onDragStart={(event) => event.dataTransfer.setData("application/x-studio-rectangle", rectangle.id)} style={{ left: `${(rectangle.xMm / Math.max(1, bounds.widthMm)) * 100}%`, top: `${(rectangle.yMm / Math.max(1, bounds.heightMm)) * 100}%`, width: `${(studioRectangleSize(rectangle).widthMm / Math.max(1, bounds.widthMm)) * 100}%`, height: `${(studioRectangleSize(rectangle).heightMm / Math.max(1, bounds.heightMm)) * 100}%` }} aria-label={`ลากแผ่น ${rectangle.widthMm} × ${rectangle.lengthMm} มม.`} />)}
    </StudioFootprint>
    <p className="studio-canvas-hint"><GripVertical size={14} /> ลากแผ่นเพื่อจัดเรียง · ขอบที่ชนกันจะ snap ต่อกัน · เส้นประคือแนวต่อแผ่น</p>
  </section>;
}

function StudioCanvas({ state, setState }: { state: StudioState; setState: Dispatch<SetStateAction<StudioState>> }) {
  const pieces = getStudioPieces(state);
  return <section className="studio-panel studio-canvas-panel">
    <div className="studio-panel-heading"><div><p className="eyebrow">03 / RECTANGLE WORKPIECES</p><h3>ประกอบผังจากสี่เหลี่ยม</h3></div><span>{pieces.length} / {STUDIO_MAX_PIECES} ชิ้นงาน</span></div>
    <p className="studio-helper">แต่ละชิ้นงานมีได้สูงสุด 6 แผ่น · ขอบที่ชนกันจะแสดงเส้นประและข้อความต้องได้ฉาก 90° · แผ่นซ้อนกันจะแจ้งเตือน</p>
    <div className="studio-piece-list">{pieces.map((piece) => <StudioPieceEditor key={piece.id} piece={piece} state={state} setState={setState} />)}</div>
    <button type="button" className="button button--outline" disabled={pieces.length >= STUDIO_MAX_PIECES} onClick={() => setState((current) => ({ ...current, pieces: [...getStudioPieces(current), makePiece(getStudioPieces(current).length)] }))} data-testid="button-add-studio-piece"><Plus size={15} /> เพิ่มชิ้นงาน</button>
  </section>;
}

function StudioStoneComparison({ state, setState }: { state: StudioState; setState: Dispatch<SetStateAction<StudioState>> }) {
  const comparisons = useMemo(() => state.stoneColors.map((code) => {
    const stone = stoneColorByName(code);
    const estimate = studioEstimate({ ...state, activeStone: code }, PRODUCTS);
    const priceLabel = estimate.sheetCutPriceWarning ? "คิดตามแผ่นตัด" : estimate.stoneUnitPriceTHB === null ? "ติดต่อฝ่ายขาย" : formatTHB(estimate.stoneUnitPriceTHB);
    const stoneTotalLabel = estimate.sheetCutPriceWarning ? "คิดตามแผ่นตัด" : formatTHB(estimate.stoneTotalTHB);
    return { code, stone, estimate, priceLabel, stoneTotalLabel };
  }), [state]);
  return <section className="studio-stone-comparison" data-testid="studio-stone-comparison">
    <div className="studio-stone-comparison-heading"><span>เปรียบเทียบสีหิน</span><small>กดการ์ดเพื่อใช้เป็นสีคำนวณหลัก</small></div>
    <div className="studio-stone-comparison-grid">
      {comparisons.map(({ code, stone, estimate, priceLabel, stoneTotalLabel }) => <button
        type="button"
        key={code}
        className={`studio-stone-comparison-card ${state.activeStone === code ? "is-active" : ""}`}
        onClick={() => setState((current) => ({ ...current, activeStone: code }))}
        aria-pressed={state.activeStone === code}
        data-testid={`button-stone-comparison-${code}`}
      >
        <span className="studio-stone-comparison-name"><i style={{ background: stone.tone }} /><strong>{code}</strong><small>{stone.name}</small></span>
        <span><small>ราคาหิน / ตร.ม.</small><strong>{priceLabel}</strong></span>
        <span><small>ราคารวมหิน</small><strong>{stoneTotalLabel}</strong></span>
        <span><small>ยอดรวมประมาณการสุทธิ</small><strong>{formatTHB(estimate.totalTHB)}</strong></span>
        {state.activeStone === code && <em>กำลังคำนวณ</em>}
      </button>)}
    </div>
  </section>;
}

function StudioPrintLayout({ state }: { state: StudioState }) {
  return <section className="studio-print-layout" data-testid="studio-print-layout">
    <div className="studio-print-heading"><div><p className="eyebrow">KNIGHT BASINS / RECTANGLE WORKPIECES</p><h2>ผังประกอบ {getStudioPieces(state).length} ชิ้นงาน</h2></div><div className="studio-print-dimensions">พื้นที่รวม {studioEstimate(state, PRODUCTS).counterAreaSqM.toFixed(4)} m²</div></div>
    {getStudioPieces(state).map((piece) => <div className="studio-print-piece" key={piece.id}><h3>{piece.name}</h3><StudioFootprint piece={piece} stoneTone={stoneColorByName(state.activeStone).tone} className="studio-print-canvas" testId={`studio-print-canvas-${piece.id}`} ariaLabel={`ผัง ${piece.name} สำหรับพิมพ์`}><span /></StudioFootprint></div>)}
    <p className="studio-print-warning">{STUDIO_PRINT_NOTE}</p>
    <p className="studio-print-footnote">หน่วยมิลลิเมตร · พื้นที่คิดจากผลรวมสี่เหลี่ยม · ตรวจสอบหน้างานก่อนผลิต</p>
  </section>;
}

export function StudioPage({ mode, leadKey, onSubmitStudio }: StudioPageProps) {
  const linkedDraft = useMemo(readLinkedDraft, []);
  const [state, setState] = useState<StudioState>(() => linkedDraft.state ?? createInitialStudioState(mode));
  const [draftNotice, setDraftNotice] = useState<StudioDraftRecord | null>(() => mode === "studio" && !linkedDraft.state ? readStoredStudioDraft() : null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(() => linkedDraft.state ? new Date().toISOString() : null);
  const [draftResult, setDraftResult] = useState(() => linkedDraft.token && !linkedDraft.state ? "ลิงก์แบบร่างไม่ถูกต้องหรือหมดอายุ กรุณาเริ่มออกแบบใหม่" : "");
  const skipNextDraftSave = useRef(false);
  const hasMountedDraftEffect = useRef(false);
  const [contact, setContact] = useState(emptyContact);
  const [sketchFile, setSketchFile] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const estimate = useMemo(() => studioEstimate(state, PRODUCTS), [state]);
  const activeStone = stoneColorByName(state.activeStone);
  const counterStoneTotal = Math.max(0, estimate.stoneTotalTHB - estimate.upstandTotalTHB);
  const exportReady = mode === "studio" && studioExportDimensionsValid(state);
  const exportName = contact.project || "studio-layout";
  useEffect(() => {
    if (mode !== "studio") return;
    if (!hasMountedDraftEffect.current) {
      hasMountedDraftEffect.current = true;
      return;
    }
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      const saved = writeStoredStudioDraft({ version: 1, savedAt, state });
      if (saved) setLastSavedAt(savedAt);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [mode, state]);
  const resumeDraft = () => {
    if (!draftNotice) return;
    setState(draftNotice.state);
    setLastSavedAt(draftNotice.savedAt);
    setDraftNotice(null);
    setDraftResult("ดึงแบบร่างเดิมแล้ว");
  };
  const startNewDraft = () => {
    clearStoredStudioDraft();
    skipNextDraftSave.current = true;
    setState(createInitialStudioState(mode));
    setLastSavedAt(null);
    setDraftNotice(null);
    setDraftResult("");
    if (window.location.search) window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
  };
  const copyDraftLink = async () => {
    const savedAt = new Date().toISOString();
    writeStoredStudioDraft({ version: 1, savedAt, state });
    setLastSavedAt(savedAt);
    const url = studioDraftUrl(state);
    try {
      await navigator.clipboard.writeText(url);
      setDraftResult("บันทึกและคัดลอกลิงก์แบบร่างแล้ว เปิดลิงก์นี้ใน Incognito เพื่อแก้ไขต่อได้");
    } catch {
      setDraftResult(`บันทึกแบบร่างแล้ว คัดลอกลิงก์นี้ด้วยตนเอง: ${url}`);
    }
  };
  const exportFiles = async (format: "dxf" | "pdf" | "png") => {
    if (!exportReady) {
      setResult("ขนาดหรือจำนวนแผ่นไม่ถูกต้อง จึงยังดาวน์โหลดแบบไม่ได้");
      return;
    }
    try {
      if (format === "dxf") await downloadStudioDxf(state, exportName);
      else if (format === "png") await downloadStudioPng(state, exportName, activeStone.tone);
      else {
        printStudioLayout(studioPrintTitle(exportName, getStudioPieces(state).length));
        setResult("เปิดหน้าพิมพ์แบบแล้ว เลือกเครื่องพิมพ์เป็น PDF ได้");
        return;
      }
      setResult(format === "png" ? "ดาวน์โหลดภาพ PNG แล้ว" : `ดาวน์โหลดแบบ ${format.toUpperCase()} แล้ว`);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "สร้างไฟล์แบบไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
  };
  const submitStudio = async () => {
    const validationMessage = studioSubmissionValidationMessage(state, estimate);
    if (validationMessage) {
      setResult(validationMessage);
      return;
    }
    if (!contact.name.trim() || !contact.phone.trim() || !contact.project.trim() || !contact.address.trim()) {
      setResult("กรุณากรอกชื่อผู้ติดต่อ โทรศัพท์ ชื่อโครงการ และสถานที่ติดตั้ง");
      return;
    }
    setSubmitting(true);
    setResult("");
    try {
      const basinCounts = new Map<string, number>();
      state.basinPlacements.forEach((placement) => basinCounts.set(placement.sku, (basinCounts.get(placement.sku) ?? 0) + 1));
      const notificationItems: StudioNotificationItem[] = Array.from(basinCounts.entries()).flatMap(([sku, quantity]) => {
        const product = productBySku(sku);
        return product ? [{ kind: "basin" as const, code: product.sku, description: product.colorName, quantity, unit: "ชุด", unitPriceTHB: product.priceTHB, totalTHB: Math.round(product.priceTHB * quantity) }] : [];
      });
      if (estimate.stoneUnitPriceTHB !== null && estimate.stoneAreaSqM > 0) notificationItems.push({ kind: "stone", code: activeStone.code, description: activeStone.name, quantity: estimate.counterAreaSqM, unit: "ตร.ม.", unitPriceTHB: estimate.stoneUnitPriceTHB, totalTHB: Math.max(0, estimate.stoneTotalTHB - estimate.upstandTotalTHB) });
      notificationItems.push({ kind: "service", code: "WORKPIECES", description: `${estimate.pieceCount} ชิ้นงาน · ${estimate.rectangleCount} แผ่น`, quantity: estimate.pieceCount, unit: "ชิ้นงาน", unitPriceTHB: 0, totalTHB: 0 });
      if (estimate.upstandLengthM > 0) notificationItems.push({ kind: "service", code: "UPSTAND", description: `บัวยาว ${estimate.upstandLengthM.toFixed(2)} ม. · สูง ${state.upstandHeightMm ?? "ไม่ระบุ"} มม.`, quantity: estimate.upstandLengthM, unit: "ม.", unitPriceTHB: estimate.upstandLengthM ? estimate.upstandTotalTHB / estimate.upstandLengthM : 0, totalTHB: estimate.upstandTotalTHB });
      if (estimate.openEdgeLengthM > 0) notificationItems.push({ kind: "service", code: "OPEN_EDGE", description: `ขอบเปิดยาว ${estimate.openEdgeLengthM.toFixed(2)} ม.`, quantity: estimate.openEdgeLengthM, unit: "ม.", unitPriceTHB: estimate.openEdgeUnitPriceTHB ?? 0, totalTHB: estimate.openEdgeTotalTHB });
      if (estimate.installationChargeTHB > 0) notificationItems.push({ kind: "service", code: "INSTALL", description: "ค่าติดตั้ง / ค่าแรงต่อชุด", quantity: state.basinPlacements.length, unit: "ชุด", unitPriceTHB: state.basinPlacements.length ? estimate.installationChargeTHB / state.basinPlacements.length : 0, totalTHB: estimate.installationChargeTHB });
      if (estimate.smallJobFeeTHB > 0) notificationItems.push({ kind: "service", code: "SMALL-JOB", description: "ค่าดำเนินการงานพื้นที่เล็ก", quantity: 1, unit: "งาน", unitPriceTHB: estimate.smallJobFeeTHB, totalTHB: estimate.smallJobFeeTHB });
      await onSubmitStudio({ state, estimate, contact, notification: { items: notificationItems, grossSubtotal: estimate.grossSubtotalTHB, discountAmount: estimate.grossSubtotalTHB - estimate.subtotalTHB, subtotal: estimate.subtotalTHB, vatAmount: estimate.vatAmountTHB, total: estimate.totalTHB, vat: state.vat } });
    } catch (error) {
      setResult(error instanceof Error ? error.message : "สร้างใบเสนอราคาไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };
  const submitSketch = async () => {
    if (!sketchFile || !contact.name || !contact.phone || !contact.project) {
      setResult("กรุณาแนบไฟล์ และกรอกชื่อผู้ติดต่อ โทรศัพท์ และชื่อโครงการ");
      return;
    }
    setSubmitting(true);
    setResult("");
    const form = new FormData();
    form.append("file", sketchFile);
    form.append("metadata", JSON.stringify({ leadKey, status: "new_lead", source: "hand_sketch", orderMode: "sketch", productSkus: state.basinSkus, name: contact.name, company: contact.company || null, phone: contact.phone, email: contact.email || null, project: contact.project, address: contact.address || null, studioData: { ...state, estimate } }));
    try {
      const response = await fetch("/api/leads/sketch", { method: "POST", body: form });
      const payload = await response.json() as { notificationStatus?: string; message?: string };
      if (!response.ok) throw new Error(payload.message || "ส่งไฟล์ไม่สำเร็จ");
      setResult(payload.message || (payload.notificationStatus === "notified" ? "ส่งแบบร่างเรียบร้อยแล้ว ทีมขายได้รับการแจ้งเตือน" : "บันทึกแบบร่างเรียบร้อยแล้ว"));
      setSketchFile(null);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "ส่งไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };
  return <div className="page-wrap studio-page">
    <section className="studio-hero"><div><p className="eyebrow accent">ORDER MODE / {mode === "studio" ? "LAYOUT STUDIO" : "HAND SKETCH"}</p><h1>{mode === "studio" ? <>ประกอบแผ่นจริง<br /><em>ให้เห็นภาพก่อนขอราคา</em></> : <>ส่งแบบร่าง<br /><em>ให้ทีมขายช่วยต่อยอด</em></>}</h1><p className="hero-copy">{mode === "studio" ? "เพิ่มชิ้นงานและสี่เหลี่ยม กำหนดทิศทาง จัดตำแหน่ง และตั้งสถานะรายด้านได้ตามแบบช่างจริง" : "แนบภาพสเก็ตช์ด้วยมือ พร้อมเลือกวัสดุและรุ่นอ่างที่สนใจ ทีมขายจะตรวจสอบแบบและติดต่อกลับ"}</p></div><div className="studio-hero-mark">{mode === "studio" ? "02" : "03"}</div></section>
    {mode === "studio" && draftNotice && <div className="studio-draft-banner" role="alert" data-testid="studio-draft-banner"><div><strong>พบแบบร่างที่ทำค้างไว้เมื่อ {formatDraftTimestamp(draftNotice.savedAt)}</strong><small>แบบร่างนี้อยู่ในเบราว์เซอร์เครื่องนี้</small></div><div className="studio-draft-banner-actions"><button type="button" className="button button--accent" onClick={resumeDraft} data-testid="button-resume-studio-draft">ดึงแบบร่างเดิม</button><button type="button" className="button button--outline" onClick={startNewDraft} data-testid="button-new-studio-draft">เริ่มออกแบบใหม่</button></div></div>}
    {mode === "studio" && <div className="studio-draft-toolbar"><div><p className="eyebrow">DRAFT WORKSPACE</p><span>{lastSavedAt ? `บันทึกอัตโนมัติล่าสุด ${formatDraftTimestamp(lastSavedAt)}` : "ยังไม่มีแบบร่างที่บันทึก"}</span></div><button type="button" className="button button--outline" onClick={() => void copyDraftLink()} data-testid="button-save-studio-draft-link"><Copy size={15} /> บันทึก / คัดลอกลิงก์แบบร่าง</button></div>}
    {draftResult && <p className="studio-result studio-draft-result" role="status" data-testid="status-studio-draft">{draftResult}</p>}
    <StudioShortlists state={state} setState={setState} />
    {mode === "studio" ? <StudioCanvas state={state} setState={setState} /> : <section className="studio-panel studio-sketch-panel"><div className="studio-panel-heading"><div><p className="eyebrow">03 / UPLOAD SKETCH</p><h3>แนบภาพแบบร่าง</h3></div><Upload size={20} /></div><label className="studio-file-drop"><Upload size={22} /><strong>{sketchFile ? sketchFile.name : "เลือกไฟล์แบบร่าง"}</strong><small>JPG, PNG, WEBP หรือ GIF · ไม่เกิน 10 MB</small><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setSketchFile(event.target.files?.[0] ?? null)} data-testid="input-studio-sketch" /></label></section>}
    <section className="studio-layout-bottom">
      <div className="studio-panel studio-contact-panel"><div className="studio-panel-heading"><div><p className="eyebrow">04 / PROJECT DETAILS</p><h3>ข้อมูลติดต่อและหน้างาน</h3></div></div><StudioContactFields contact={contact} setContact={setContact} /><label className="studio-select-label">พื้นที่ติดตั้ง<select value={state.location} onChange={(event) => setState((current) => ({ ...current, location: event.target.value as StudioLocation }))}><option value="bangkok-metro">กรุงเทพฯ / ปริมณฑล</option><option value="province">ต่างจังหวัด</option></select></label></div>
      <aside className="studio-panel studio-estimate-panel">
        <div className="studio-panel-heading"><div><p className="eyebrow">LIVE ESTIMATE</p><h3>ประมาณการเบื้องต้น</h3></div><span>{activeStone.code}</span></div>
        <div className="studio-estimate-lines">
          <div><span>จำนวนชิ้นงาน / แผ่น</span><strong>{estimate.pieceCount} / {estimate.rectangleCount}</strong></div>
          <div><span>พื้นที่แผ่นรวม</span><strong>{estimate.counterAreaSqM.toFixed(4)} m²</strong></div>
          <div><span>บัว <small>{estimate.upstandLengthM.toFixed(2)} ม. × {state.upstandHeightMm ?? "ว่าง"} มม.</small></span><strong>{formatTHB(estimate.upstandTotalTHB)}</strong></div>
          <div><span>ขอบเปิด <small>{estimate.openEdgeLengthM.toFixed(2)} ม.</small></span><strong>{estimate.openEdgeUnitPriceTHB === 0 ? "ฟรี" : formatTHB(estimate.openEdgeTotalTHB)}</strong></div>
          <div><span>หิน {formatTHB(estimate.stoneUnitPriceTHB ?? 0)} / m²</span><strong>{estimate.sheetCutPriceWarning ? "คิดตามแผ่นตัด" : formatTHB(counterStoneTotal)}</strong></div>
          <div><span>อ่าง + ติดตั้ง</span><strong>{formatTHB(estimate.basinSubtotalTHB + estimate.installationChargeTHB)}</strong></div>
          {estimate.smallJobFeeTHB > 0 && <div><span>ค่าดำเนินการงานพื้นที่เล็ก</span><strong>{formatTHB(estimate.smallJobFeeTHB)}</strong></div>}
          <div><span>รวมก่อนส่วนลด</span><strong>{formatTHB(estimate.grossSubtotalTHB)}</strong></div>
        </div>
         <StudioStoneComparison state={state} setState={setState} />
        <div className="studio-pricing-inputs">
          <label>ความสูงบัว (มม.)<input type="number" min="1" value={state.upstandHeightMm ?? ""} onChange={(event) => setState((current) => ({ ...current, upstandHeightMm: event.target.value.trim() ? numericValue(event.target.value) : null }))} data-testid="input-studio-upstand-height" /></label>
          <label>ราคาขอบเปิด / ม.<input type="number" min="0" step="0.01" value={state.openEdgePricePerMTHB ?? ""} onChange={(event) => setState((current) => ({ ...current, openEdgePricePerMTHB: event.target.value.trim() ? numericValue(event.target.value) : null }))} data-testid="input-studio-open-edge-price" /></label>
          <label>ส่วนลด (บาท)<input type="number" min="0" step="1" value={state.discountTHB ?? 0} onChange={(event) => setState((current) => ({ ...current, discountTHB: numericValue(event.target.value) }))} data-testid="input-studio-discount" /></label>
        </div>
        <label className="studio-checkbox"><input type="checkbox" checked={state.vat} onChange={(event) => setState((current) => ({ ...current, vat: event.target.checked }))} data-testid="input-studio-vat" /><span />คิด VAT 7% จากยอดหลังหักส่วนลด ({formatTHB(estimate.vatAmountTHB)})</label>
         <div className="studio-total"><span>รวมประมาณการ</span><strong data-testid="studio-total-value">{formatTHB(estimate.totalTHB)}</strong><small>{state.vat ? "รวม VAT 7% แล้ว" : "ยังไม่รวม VAT"} · ปัดเป็นบาทถ้วนทีละบรรทัด</small></div>
        {estimate.warnings.map((warning) => <p className="studio-warning studio-warning--amber" key={warning}><AlertTriangle size={16} /> {warning}</p>)}
        {estimate.standardSheetWarning && <p className="studio-warning studio-warning--amber"><AlertTriangle size={16} /> {estimate.standardSheetMessage}</p>}
         {mode === "studio" && <div className="studio-export-actions"><button type="button" className="button button--outline" disabled={!exportReady} onClick={() => void exportFiles("dxf")} data-testid="button-download-studio-dxf"><Download size={15} /> ดาวน์โหลดแบบ (DXF)</button><button type="button" className="button button--outline" disabled={!exportReady} onClick={() => void exportFiles("pdf")} data-testid="button-download-studio-pdf"><Download size={15} /> ดาวน์โหลดแบบ (PDF)</button><button type="button" className="button button--outline" disabled={!exportReady} onClick={() => void exportFiles("png")} data-testid="button-download-studio-png"><Download size={15} /> ดาวน์โหลดภาพ (PNG)</button></div>}
        <button type="button" className="button button--dark full-width" disabled={submitting} onClick={mode === "studio" ? submitStudio : submitSketch} data-testid={mode === "studio" ? "button-submit-studio" : "button-submit-sketch"}>{submitting ? "กำลังส่ง..." : mode === "studio" ? "ขอใบเสนอราคาจากแบบนี้" : "ส่งแบบร่างให้ทีมขาย"} <ArrowRight size={16} /></button>
        {result && <p className="studio-result" role="status">{result}</p>}
      </aside>
    </section>
    {mode === "studio" && <StudioPrintLayout state={state} />}
  </div>;
}