import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { AlertTriangle, ArrowRight, Check, GripVertical, Upload, X } from "lucide-react";
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
  counterBounds,
  createBasinPlacement,
  snapBasinPlacementPosition,
  studioEstimate,
  studioSubmissionValidationMessage,
  studioStoneName,
  STUDIO_EDGE_CLEARANCE_MM,
  STUDIO_MAX_BASINS,
  STUDIO_MAX_STONE_COLORS,
  STUDIO_MIN_BASINS,
  STUDIO_MIN_STONE_COLORS,
  unsafeBasinPlacements,
  unknownBasinPlacements,
  type BasinPlacement,
  type CounterShape,
  type StudioEstimate,
  type StudioLocation,
  type StudioOrderMode,
  type StudioState,
} from "@/data/studio-model";
import { StudioFootprint } from "./StudioFootprint";

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
  kind: "basin" | "stone";
  code: string;
  description: string;
  quantity: number;
  unit: string;
};

export type StudioNotificationSnapshot = {
  items: StudioNotificationItem[];
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

const initialState: StudioState = {
  mode: "studio",
  shape: "I",
  dimensions: { depthMm: 600, runAMm: 1800, runBMm: 1200, runCMm: 1200 },
  backsplash: { enabled: false, heightMm: 100 },
  location: "bangkok-metro",
  vat: false,
  quoteFormat: "US",
  stoneColors: ["BW010", "MU010"],
  activeStone: "BW010",
  basinSkus: ["KF001"],
  basinPlacements: [],
};

function numericValue(value: string, fallback = 0) {
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
  const toggleStone = (code: string) => {
    setState((current) => {
      if (current.stoneColors.includes(code)) {
        if (current.stoneColors.length <= STUDIO_MIN_STONE_COLORS) return current;
        const next = current.stoneColors.filter((item) => item !== code);
        return { ...current, stoneColors: next, activeStone: current.activeStone === code ? next[0] : current.activeStone };
      }
      if (current.stoneColors.length >= STUDIO_MAX_STONE_COLORS) return current;
      return { ...current, stoneColors: [...current.stoneColors, code] };
    });
  };
  const toggleBasin = (sku: string) => {
    setState((current) => {
      if (current.basinSkus.includes(sku)) {
        if (current.basinSkus.length <= STUDIO_MIN_BASINS) return current;
        return { ...current, basinSkus: current.basinSkus.filter((item) => item !== sku), basinPlacements: current.basinPlacements.filter((item) => item.sku !== sku) };
      }
      if (current.basinSkus.length >= STUDIO_MAX_BASINS) return current;
      return { ...current, basinSkus: [...current.basinSkus, sku] };
    });
  };
  return <div className="studio-shortlists">
    <section className="studio-panel">
      <div className="studio-panel-heading"><div><p className="eyebrow">01 / MATERIAL SHORTLIST</p><h3>เลือกสีหิน 2–3 สี</h3></div><span>{state.stoneColors.length} / 3</span></div>
      <p className="studio-helper">เลือกสีเพื่อเปรียบเทียบ แล้วเลือกสีที่ใช้คำนวณจากรายการด้านล่าง</p>
      <div className="studio-stone-list">{STONE_COLORS.slice(0, 24).map((stone) => {
        const selected = state.stoneColors.includes(stone.code);
        return <button type="button" key={stone.code} className={`studio-stone-choice ${selected ? "is-selected" : ""} ${state.activeStone === stone.code ? "is-active" : ""}`} onClick={() => toggleStone(stone.code)} aria-pressed={selected} data-testid={`button-studio-stone-${stone.code}`}><span style={{ background: stone.tone }} /> <strong>{stone.code}</strong><small>{stone.name}</small>{selected && <Check size={14} />}</button>;
      })}</div>
      <div className="studio-active-stone"><span>กำลังคำนวณด้วย</span>{state.stoneColors.map((code) => <button type="button" key={code} className={state.activeStone === code ? "is-active" : ""} onClick={() => setState((current) => ({ ...current, activeStone: code }))}>{studioStoneName(code)} · {formatTHB(stoneColorByName(code).installedPriceTHB ?? 0)} / m²</button>)}</div>
    </section>
    <section className="studio-panel">
       <div className="studio-panel-heading"><div><p className="eyebrow">02 / BASIN SHORTLIST</p><h3>เลือกแบบอ่าง 1–2 รุ่น</h3></div><span>{state.basinSkus.length} / 2</span></div>
      <p className="studio-helper">ลากรุ่นที่เลือกไปวางบนผัง หรือกดเลือกเพื่อเพิ่ม / นำออก</p>
       <label className="studio-basin-search">ค้นหา SKU หรือสี
         <input type="search" value={basinQuery} onChange={(event) => setBasinQuery(event.target.value)} placeholder="เช่น KF029 หรือ White" aria-label="ค้นหา SKU หรือสีของอ่าง" data-testid="input-studio-basin-search" />
       </label>
       <p className="studio-basin-result-count">แสดง {visibleBasins.length} จาก {PRODUCTS.length} รุ่น</p>
       <div className="studio-basin-list">{visibleBasins.map((product) => {
        const selected = state.basinSkus.includes(product.sku);
        return <button type="button" key={product.sku} draggable={selected} onDragStart={(event) => { event.dataTransfer.setData("application/x-studio-basin", product.sku); }} className={`studio-basin-choice ${selected ? "is-selected" : ""}`} onClick={() => toggleBasin(product.sku)} aria-pressed={selected} data-testid={`button-studio-basin-${product.sku}`}><span>{product.sku}</span><strong>{product.colorName}</strong><small>{formatTHB(product.priceTHB)}</small>{selected && <GripVertical size={14} />}</button>;
       })}{visibleBasins.length === 0 && <p className="studio-basin-empty">ไม่พบรุ่นที่ตรงกับการค้นหา</p>}</div>
    </section>
  </div>;
}

function StudioCanvas({ state, setState }: { state: StudioState; setState: Dispatch<SetStateAction<StudioState>> }) {
  const bounds = counterBounds(state.shape, state.dimensions);
  const maxRun = Math.max(1, bounds.widthMm);
  const maxDepth = Math.max(1, bounds.heightMm);
  const unsafeIds = new Set(unsafeBasinPlacements(state));
  const unknownDimensionIds = new Set(unknownBasinPlacements(state));
  const movePlacement = (id: string, xMm: number, yMm: number) => setState((current) => ({
    ...current,
    basinPlacements: current.basinPlacements.map((placement) => placement.id === id
      ? { ...placement, ...snapBasinPlacementPosition(placement, xMm, yMm, current.dimensions, current.shape) }
      : placement),
  }));
  const drop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const sku = event.dataTransfer.getData("application/x-studio-basin");
    const product = productBySku(sku);
    if (product && state.basinSkus.includes(sku)) {
      const placement = createBasinPlacement(product, state.basinPlacements.length);
      const xMm = ((event.clientX - rect.left) / rect.width) * maxRun - (placement.widthMm ?? 0) / 2;
      const yMm = ((event.clientY - rect.top) / rect.height) * maxDepth - (placement.depthMm ?? 0) / 2;
      setState((current) => ({
        ...current,
        basinPlacements: [
          ...current.basinPlacements,
            { ...placement, ...snapBasinPlacementPosition(placement, xMm, yMm, current.dimensions, current.shape) },
        ],
      }));
      return;
    }
    const placementId = event.dataTransfer.getData("application/x-studio-placement");
    const existingPlacement = state.basinPlacements.find((placement) => placement.id === placementId);
    if (placementId) {
      movePlacement(
        placementId,
        ((event.clientX - rect.left) / rect.width) * maxRun - (existingPlacement?.widthMm ?? 0) / 2,
        ((event.clientY - rect.top) / rect.height) * maxDepth - (existingPlacement?.depthMm ?? 0) / 2,
      );
    }
  };
  return <section className="studio-panel studio-canvas-panel">
    <div className="studio-panel-heading"><div><p className="eyebrow">03 / 2D COUNTER LAYOUT</p><h3>วางอ่างบนผังเคาน์เตอร์</h3></div><span>หน่วย mm</span></div>
    <div className="studio-shape-tabs" role="tablist">{(["I", "L", "U"] as CounterShape[]).map((shape) => <button type="button" key={shape} className={state.shape === shape ? "is-active" : ""} onClick={() => setState((current) => ({ ...current, shape }))} data-testid={`button-studio-shape-${shape}`}>{shape}-shape</button>)}</div>
    <div className="studio-dimension-grid">
      <label>ความลึก<input type="number" min="1" value={state.dimensions.depthMm} onChange={(event) => setState((current) => ({ ...current, dimensions: { ...current.dimensions, depthMm: numericValue(event.target.value) } }))} data-testid="input-studio-depth" /></label>
      <label>ด้าน A<input type="number" min="1" value={state.dimensions.runAMm} onChange={(event) => setState((current) => ({ ...current, dimensions: { ...current.dimensions, runAMm: numericValue(event.target.value) } }))} data-testid="input-studio-run-a" /></label>
      {state.shape !== "I" && <label>ด้าน B<input type="number" min="1" value={state.dimensions.runBMm} onChange={(event) => setState((current) => ({ ...current, dimensions: { ...current.dimensions, runBMm: numericValue(event.target.value) } }))} data-testid="input-studio-run-b" /></label>}
      {state.shape === "U" && <label>ด้าน C<input type="number" min="1" value={state.dimensions.runCMm} onChange={(event) => setState((current) => ({ ...current, dimensions: { ...current.dimensions, runCMm: numericValue(event.target.value) } }))} data-testid="input-studio-run-c" /></label>}
    </div>
    <label className="studio-checkbox"><input type="checkbox" checked={state.backsplash.enabled} onChange={(event) => setState((current) => ({ ...current, backsplash: { ...current.backsplash, enabled: event.target.checked } }))} /> เพิ่ม backsplash ด้านหลัง</label>
    {state.backsplash.enabled && <label className="studio-inline-field">ความสูง backsplash (mm)<input type="number" min="1" value={state.backsplash.heightMm} onChange={(event) => setState((current) => ({ ...current, backsplash: { enabled: true, heightMm: numericValue(event.target.value) } }))} data-testid="input-studio-backsplash-height" /></label>}
     <StudioFootprint state={state} unsafe={unsafeIds.size > 0} onDragOver={(event) => event.preventDefault()} onDrop={drop} testId="studio-canvas" ariaLabel="ผังเคาน์เตอร์ 2D">
       {state.basinPlacements.map((placement) => <div key={placement.id} draggable className={`studio-placement ${unsafeIds.has(placement.id) ? "studio-placement--unsafe" : ""} ${unknownDimensionIds.has(placement.id) ? "studio-placement--unknown" : ""}`} style={{ left: `${(placement.xMm / maxRun) * 100}%`, top: `${(placement.yMm / maxDepth) * 100}%`, width: placement.widthMm === null ? "22%" : `${(placement.widthMm / maxRun) * 100}%`, height: placement.depthMm === null ? "22%" : `${(placement.depthMm / maxDepth) * 100}%` }} onDragStart={(event) => event.dataTransfer.setData("application/x-studio-placement", placement.id)}><strong>{placement.sku}</strong><small>{unknownDimensionIds.has(placement.id) ? "แคตตาล็อกไม่ระบุขนาดหลุม" : "ลากเพื่อย้าย"}</small><button type="button" onClick={() => setState((current) => ({ ...current, basinPlacements: current.basinPlacements.filter((item) => item.id !== placement.id) }))} aria-label={`นำ ${placement.sku} ออกจากผัง`}><X size={12} /></button></div>)}
      {!state.basinPlacements.length && <span className="studio-canvas-empty">ลากอ่างที่เลือกมาวางที่นี่</span>}
     </StudioFootprint>
     <p className="studio-canvas-hint"><GripVertical size={14} /> ระยะขอบเคาน์เตอร์ต้องเหลืออย่างน้อย {STUDIO_EDGE_CLEARANCE_MM} mm รอบอ่างทุกด้าน · เมื่อวางใกล้เส้น ระบบจะจัดให้พอดีอัตโนมัติ</p>
  </section>;
}

export function StudioPage({ mode, leadKey, onSubmitStudio }: StudioPageProps) {
  const [state, setState] = useState<StudioState>({ ...initialState, mode });
  const [contact, setContact] = useState(emptyContact);
  const [sketchFile, setSketchFile] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const estimate = useMemo(() => studioEstimate(state, PRODUCTS), [state]);
  const activeStone = stoneColorByName(state.activeStone);
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
        return product ? [{ kind: "basin", code: product.sku, description: product.colorName, quantity, unit: "ชุด" }] : [];
      });
      if (estimate.stoneUnitPriceTHB !== null && estimate.stoneAreaSqM > 0) {
        notificationItems.push({
          kind: "stone",
          code: activeStone.code,
          description: activeStone.name,
          quantity: estimate.stoneAreaSqM,
          unit: "ตร.ม.",
        });
      }
      await onSubmitStudio({
        state,
        estimate,
        contact,
        notification: {
          items: notificationItems,
          subtotal: estimate.subtotalTHB,
          vatAmount: estimate.vatAmountTHB,
          total: estimate.totalTHB,
          vat: state.vat,
        },
      });
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
      setResult(payload.message || (payload.notificationStatus === "notified" ? "ส่งแบบร่างเรียบร้อยแล้ว ทีมขายได้รับการแจ้งเตือน" : "บันทึกแบบร่างเรียบร้อยแล้ว แต่ยังไม่ได้แจ้งเตือน ทีมขายจะติดตามจากระบบ"));
      setSketchFile(null);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "ส่งไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };
  return <div className="page-wrap studio-page">
    <section className="studio-hero"><div><p className="eyebrow accent">ORDER MODE / {mode === "studio" ? "LAYOUT STUDIO" : "HAND SKETCH"}</p><h1>{mode === "studio" ? <>ออกแบบเคาน์เตอร์<br /><em>ให้เห็นภาพก่อนขอราคา</em></> : <>ส่งแบบร่าง<br /><em>ให้ทีมขายช่วยต่อยอด</em></>}</h1><p className="hero-copy">{mode === "studio" ? "เลือกสีหินและอ่าง กำหนดขนาดเคาน์เตอร์ แล้วลากวางองค์ประกอบบนผัง 2D ได้ทันที" : "แนบภาพสเก็ตช์ด้วยมือ พร้อมเลือกวัสดุและรุ่นอ่างที่สนใจ ทีมขายจะตรวจสอบแบบและติดต่อกลับ"}</p></div><div className="studio-hero-mark">{mode === "studio" ? "02" : "03"}</div></section>
    <StudioShortlists state={state} setState={setState} />
    {mode === "studio" ? <StudioCanvas state={state} setState={setState} /> : <section className="studio-panel studio-sketch-panel"><div className="studio-panel-heading"><div><p className="eyebrow">03 / UPLOAD SKETCH</p><h3>แนบภาพแบบร่าง</h3></div><Upload size={20} /></div><label className="studio-file-drop"><Upload size={22} /><strong>{sketchFile ? sketchFile.name : "เลือกไฟล์แบบร่าง"}</strong><small>JPG, PNG, WEBP หรือ GIF · ไม่เกิน 10 MB</small><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setSketchFile(event.target.files?.[0] ?? null)} data-testid="input-studio-sketch" /></label></section>}
    <section className="studio-layout-bottom">
      <div className="studio-panel studio-contact-panel"><div className="studio-panel-heading"><div><p className="eyebrow">04 / PROJECT DETAILS</p><h3>ข้อมูลติดต่อและหน้างาน</h3></div></div><StudioContactFields contact={contact} setContact={setContact} /><label className="studio-select-label">พื้นที่ติดตั้ง<select value={state.location} onChange={(event) => setState((current) => ({ ...current, location: event.target.value as StudioLocation }))}><option value="bangkok-metro">กรุงเทพฯ / ปริมณฑล</option><option value="province">ต่างจังหวัด</option></select></label></div>
      <aside className="studio-panel studio-estimate-panel">
        <div className="studio-panel-heading"><div><p className="eyebrow">LIVE ESTIMATE</p><h3>ประมาณการเบื้องต้น</h3></div><span>{activeStone.code}</span></div>
        <div className="studio-estimate-lines">
          <div><span>พื้นที่เคาน์เตอร์</span><strong>{estimate.counterAreaSqM.toFixed(2)} m²</strong></div>
          <div><span>พื้นที่ backsplash</span><strong>{estimate.backsplashAreaSqM.toFixed(2)} m²</strong></div>
          <div><span>พื้นที่หินรวม</span><strong>{estimate.stoneAreaSqM.toFixed(2)} m²</strong></div>
          <div><span>หิน {formatTHB(estimate.stoneUnitPriceTHB ?? 0)} / m²</span><strong>{formatTHB(estimate.stoneTotalTHB)}</strong></div>
          <div><span>อ่าง + ติดตั้ง</span><strong>{formatTHB(estimate.basinSubtotalTHB + estimate.installationChargeTHB)}</strong></div>
          {estimate.smallJobFeeTHB > 0 && <div><span>ค่าดำเนินการงานพื้นที่เล็ก</span><strong>{formatTHB(estimate.smallJobFeeTHB)}</strong></div>}
        </div>
        <label className="studio-checkbox"><input type="checkbox" checked={state.vat} onChange={(event) => setState((current) => ({ ...current, vat: event.target.checked }))} data-testid="input-studio-vat" /><span />คิด VAT 7% ({formatTHB(estimate.vatAmountTHB)})</label>
        <div className="studio-total"><span>รวมประมาณการ</span><strong>{formatTHB(estimate.totalTHB)}</strong><small>{state.vat ? "รวม VAT 7% แล้ว" : "ยังไม่รวม VAT"} · ไม่หักพื้นที่หลุมอ่าง</small></div>
        {estimate.standardSheetWarning && <p className="studio-warning studio-warning--amber"><AlertTriangle size={16} /> {estimate.standardSheetMessage}</p>}
         {estimate.unsafePlacements.length > 0 && <p className="studio-warning"><AlertTriangle size={16} /> วางขอบอ่างบนเส้น 50 mm ได้พอดี หากพื้นที่ไม่พอให้เพิ่มความลึกเคาน์เตอร์ เช่น 700 mm จึงจะส่งคำขอได้</p>}
        {estimate.unknownDimensionPlacements.length > 0 && <p className="studio-warning studio-warning--amber"><AlertTriangle size={16} /> แคตตาล็อกไม่ระบุขนาดหลุม ต้องยืนยันขนาดกับทีมขายก่อนส่งคำขอ</p>}
        <button type="button" className="button button--dark full-width" disabled={submitting} onClick={mode === "studio" ? submitStudio : submitSketch} data-testid={mode === "studio" ? "button-submit-studio" : "button-submit-sketch"}>{submitting ? "กำลังส่ง..." : mode === "studio" ? "ขอใบเสนอราคาจากแบบนี้" : "ส่งแบบร่างให้ทีมขาย"} <ArrowRight size={16} /></button>
        {result && <p className="studio-result" role="status">{result}</p>}
      </aside>
    </section>
  </div>;
}