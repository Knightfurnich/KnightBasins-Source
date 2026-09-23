import { useState } from "react";
import { AlertTriangle, GripVertical, RotateCw, X } from "lucide-react";
import "./_group.css";

type Rectangle = { id: string; widthMm: number; lengthMm: number; xMm: number; yMm: number; rotation: 0 | 90 };
type Placement = { id: string; sku: string; xMm: number; yMm: number; widthMm: number; depthMm: number; tone: string };

const initialRectangle: Rectangle = { id: "rectangle-current", widthMm: 1800, lengthMm: 600, xMm: 0, yMm: 0, rotation: 0 };
const initialPlacements: Placement[] = [
  { id: "basin-current-1", sku: "KF001", xMm: 540, yMm: 50, widthMm: 500, depthMm: 500, tone: "#f2f4f1" },
  { id: "basin-current-2", sku: "KF002", xMm: 1190, yMm: 125, widthMm: 450, depthMm: 350, tone: "#d7dbda" },
];

function rectangleSize(rectangle: Rectangle) {
  return rectangle.rotation === 90
    ? { widthMm: rectangle.lengthMm, heightMm: rectangle.widthMm }
    : { widthMm: rectangle.widthMm, heightMm: rectangle.lengthMm };
}

function BasinVisual({ tone }: { tone: string }) {
  return <div className="basin-visual" style={{ "--basin-tone": tone } as React.CSSProperties}><div className="basin-shadow" /><div className="basin-body"><div className="basin-bowl"><div className="basin-drain" /></div></div></div>;
}

export function Current() {
  const [rectangle, setRectangle] = useState(initialRectangle);
  const [placements, setPlacements] = useState(initialPlacements);
  const [selectedId, setSelectedId] = useState(initialPlacements[0].id);
  const bounds = rectangleSize(rectangle);
  const selected = placements.find((placement) => placement.id === selectedId) ?? placements[0];
  const updateSelected = (patch: Partial<Placement>) => setPlacements((current) => current.map((placement) => placement.id === selected.id ? { ...placement, ...patch } : placement));

  return <main className="knight-studio">
    <div className="studio-shell">
      <div className="studio-title">
        <div><p className="studio-kicker">Studio / current source</p><h1>ออกแบบชิ้นงานบนผังจริง</h1></div>
        <div className="studio-badge">CURRENT · percentage bounds</div>
      </div>
      <section className="studio-piece-editor">
        <div className="studio-piece-heading"><label><span>ชื่อชิ้นงาน</span><input value="ชิ้นงาน 1" readOnly /></label><span>1 / 6 แผ่น · 1.0800 m²</span></div>
        <div className="studio-piece-workspace">
          <div className="studio-piece-canvas-column">
            <div className="studio-canvas" style={{ aspectRatio: `${bounds.widthMm} / ${bounds.heightMm}` }} aria-label="ผังชิ้นงานปัจจุบัน">
              <div className="studio-canvas-stage">
                <div className="studio-piece-rectangle" style={{ left: 0, top: 0, width: "100%", height: "100%" }}><span className="studio-piece-size">1800 × 600</span></div>
                {placements.map((placement) => <div key={placement.id} className={`studio-placement ${placement.id === selectedId ? "studio-placement--selected" : ""}`} style={{ left: `${placement.xMm / bounds.widthMm * 100}%`, top: `${placement.yMm / bounds.heightMm * 100}%`, width: `${placement.widthMm / bounds.widthMm * 100}%`, height: `${placement.depthMm / bounds.heightMm * 100}%` }} onClick={() => setSelectedId(placement.id)} role="button" tabIndex={0} aria-label={`อ่าง ${placement.sku}`}><span className="studio-placement-visual"><BasinVisual tone={placement.tone} /></span><strong>{placement.sku}</strong><small>{placement.widthMm} × {placement.depthMm} มม.</small><button type="button" onClick={(event) => { event.stopPropagation(); setPlacements((current) => current.filter((item) => item.id !== placement.id)); }} aria-label={`นำ ${placement.sku} ออก`}><X size={12} /></button></div>)}
                <span className="studio-canvas-label">ชิ้นงาน 1 · bounds 1800 × 600 mm</span><span className="studio-canvas-note">ต่อแผ่นแล้วต้องได้ฉาก 90°</span>
              </div>
            </div>
            <p className="studio-canvas-hint"><GripVertical size={14} /> คลิกแผ่นหรืออ่างเพื่อเปิดตัวแก้ไข · ภาพนี้ขยายแผ่นให้เต็มพื้นที่</p>
          </div>
          <aside className="studio-inspector">
            <div className="studio-inspector-heading"><div><p className="studio-kicker">INSPECTOR</p><h4>อ่าง {selected.sku}</h4></div><span>BASIN</span></div>
            <div className="studio-placement-tools"><div className="studio-inspector-subheading"><strong>อ่างในชิ้นงาน</strong><small>เลือกอ่างบนผัง หรือเลือกจากรายการนี้</small></div><div className="studio-placement-selectors">{placements.map((placement) => <button type="button" key={placement.id} className={placement.id === selected.id ? "is-active" : ""} onClick={() => setSelectedId(placement.id)}>{placement.sku}</button>)}</div></div>
            <div className="studio-inspector-section"><div className="studio-inspector-subheading"><strong>ตำแหน่งอ่าง {selected.sku}</strong><small>หลุม {selected.widthMm} × {selected.depthMm} มม.</small></div><div className="studio-rectangle-inputs"><label>X (มม.)<input type="number" value={selected.xMm} onChange={(event) => updateSelected({ xMm: Number(event.target.value) })} /></label><label>Y (มม.)<input type="number" value={selected.yMm} onChange={(event) => updateSelected({ yMm: Number(event.target.value) })} /></label></div><p className="studio-helper">X / Y คือระยะจากมุมซ้ายบนของผังถึงมุมซ้ายบนของหลุมอ่าง</p></div>
            <div className="studio-inspector-section"><div className="studio-inspector-subheading"><strong>แผ่นหลัก</strong><small>ขนาดจริงที่กำหนดใน state</small></div><div className="studio-rectangle-inputs"><label>กว้าง (มม.)<input type="number" value={rectangle.widthMm} onChange={(event) => setRectangle({ ...rectangle, widthMm: Number(event.target.value) })} /></label><label>ยาว (มม.)<input type="number" value={rectangle.lengthMm} onChange={(event) => setRectangle({ ...rectangle, lengthMm: Number(event.target.value) })} /></label></div><button type="button" className="studio-button" onClick={() => setRectangle({ ...rectangle, rotation: rectangle.rotation === 0 ? 90 : 0 })}><RotateCw size={14} /> สลับแนวนอน / แนวตั้ง</button><p className="studio-helper">ระบบใช้ pieceBounds ของแผ่นที่มีอยู่เป็นกรอบแสดงผล จึงไม่เห็นพื้นที่อ้างอิง 5,000 × 5,000 มม.</p></div>
            <div className="studio-callout"><AlertTriangle size={16} /><span>จุดที่ต้องแก้: แผ่น 1,800 × 600 มม. ถูกขยายให้เต็มผัง ทำให้สัดส่วนกับพื้นที่ทำงานจริงอ่านยาก</span></div>
          </aside>
        </div>
      </section>
    </div>
  </main>;
}