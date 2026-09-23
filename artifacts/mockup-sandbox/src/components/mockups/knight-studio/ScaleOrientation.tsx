import { useState } from "react";
import { Check, Compass, GripVertical, RotateCw } from "lucide-react";
import "./_group.css";

type Orientation = "horizontal" | "vertical";
type Placement = { id: string; sku: string; xMm: number; yMm: number; widthMm: number; depthMm: number; tone: string; orientation: Orientation };

const board = { widthMm: 5000, heightMm: 5000 };
const sheet = { xMm: 520, yMm: 430, widthMm: 1800, heightMm: 600 };
const basinSeeds: Placement[] = [
  { id: "basin-scale-1", sku: "KF001", xMm: 710, yMm: 480, widthMm: 500, depthMm: 500, tone: "#f2f4f1", orientation: "horizontal" },
  { id: "basin-scale-2", sku: "KF002", xMm: 1450, yMm: 520, widthMm: 450, depthMm: 350, tone: "#d7dbda", orientation: "horizontal" },
];

function BasinVisual({ tone }: { tone: string }) {
  return <div className="basin-visual" style={{ "--basin-tone": tone } as React.CSSProperties}><div className="basin-shadow" /><div className="basin-body"><div className="basin-bowl"><div className="basin-drain" /></div></div></div>;
}

export function ScaleOrientation() {
  const [placements, setPlacements] = useState(basinSeeds);
  const [selectedId, setSelectedId] = useState(basinSeeds[1].id);
  const selected = placements.find((placement) => placement.id === selectedId) ?? placements[0];
  const updateSelected = (patch: Partial<Placement>) => setPlacements((current) => current.map((placement) => placement.id === selected.id ? { ...placement, ...patch } : placement));
  const setOrientation = (orientation: Orientation) => {
    const next = orientation === selected.orientation ? selected : { ...selected, orientation, widthMm: selected.depthMm, depthMm: selected.widthMm };
    updateSelected(next);
  };
  const percent = (value: number, total: number) => `${value / total * 100}%`;

  return <main className="knight-studio">
    <div className="studio-shell">
      <div className="studio-title">
        <div><p className="studio-kicker">Studio / proposed direction</p><h1>อ่านสเกลจริงก่อนวางอ่าง</h1></div>
        <div className="studio-badge"><Check size={13} /> SCALE + ORIENTATION</div>
      </div>
      <section className="studio-piece-editor">
        <div className="studio-piece-heading"><label><span>ชื่อชิ้นงาน</span><input value="ชิ้นงาน 1 · พื้นที่อ้างอิง" readOnly /></label><span>1,800 × 600 mm sheet · 5,000 × 5,000 mm board</span></div>
        <div className="studio-piece-workspace">
          <div className="studio-piece-canvas-column">
            <div className="studio-canvas" style={{ aspectRatio: `${board.widthMm} / ${board.heightMm}` }} aria-label="ผังชิ้นงานที่มีสเกลจริง">
              <div className="studio-canvas-stage">
                <div className="studio-scale-board" />
                <span className="studio-scale-board-label">BOARD REFERENCE · 5,000 × 5,000 mm</span>
                <div className="studio-sheet-frame" style={{ left: percent(sheet.xMm, board.widthMm), top: percent(sheet.yMm, board.heightMm), width: percent(sheet.widthMm, board.widthMm), height: percent(sheet.heightMm, board.heightMm) }}>
                  <strong>แผ่นหลัก<br />1,800 × 600</strong>
                  <span className="studio-dimension-line studio-dimension-line--x">1,800 mm</span><span className="studio-dimension-line studio-dimension-line--y">600 mm</span>
                </div>
                {placements.map((placement) => <div key={placement.id} className={`studio-placement ${placement.id === selectedId ? "studio-placement--selected" : ""}`} style={{ left: percent(placement.xMm, board.widthMm), top: percent(placement.yMm, board.heightMm), width: percent(placement.widthMm, board.widthMm), height: percent(placement.depthMm, board.heightMm) }} onClick={() => setSelectedId(placement.id)} role="button" tabIndex={0} aria-label={`อ่าง ${placement.sku}`}><span className="studio-placement-visual"><BasinVisual tone={placement.tone} /></span><strong>{placement.sku}</strong><small>{placement.widthMm} × {placement.depthMm} มม. · {placement.orientation === "vertical" ? "ตั้ง" : "นอน"}</small></div>)}
              </div>
            </div>
            <p className="studio-canvas-hint"><GripVertical size={14} /> ผังไม่ถูกขยายตามแผ่น · เส้นกริดทุก 1,000 มม. · แผ่นเล็กจึงเห็นตำแหน่งจริง</p>
            <div className="studio-legend"><span><i className="board" /> พื้นที่อ้างอิง 5,000 × 5,000</span><span><i className="sheet" /> แผ่นหินจริง 1,800 × 600</span><span><i className="basin" /> หลุมอ่าง</span></div>
          </div>
          <aside className="studio-inspector">
            <div className="studio-inspector-heading"><div><p className="studio-kicker">INSPECTOR</p><h4>อ่าง {selected.sku}</h4></div><span>BASIN</span></div>
            <div className="studio-placement-tools"><div className="studio-inspector-subheading"><strong>อ่างในชิ้นงาน</strong><small>เลือกอ่างเพื่อแก้ทิศทางและตำแหน่ง</small></div><div className="studio-placement-selectors">{placements.map((placement) => <button type="button" key={placement.id} className={placement.id === selected.id ? "is-active" : ""} onClick={() => setSelectedId(placement.id)}>{placement.sku}</button>)}</div></div>
            <div className="studio-inspector-section"><div className="studio-inspector-subheading"><strong>ทิศทางหลุมอ่าง</strong><small>สลับขนาดกว้าง × ลึกตามการหมุนจริง</small></div><div className="studio-orientation-control"><span>Orientation</span><div className="studio-segments"><button type="button" className={`studio-segment ${selected.orientation === "horizontal" ? "is-active" : ""}`} onClick={() => setOrientation("horizontal")}>แนวนอน · นอน</button><button type="button" className={`studio-segment ${selected.orientation === "vertical" ? "is-active" : ""}`} onClick={() => setOrientation("vertical")}>แนวตั้ง · ตั้ง</button></div></div><div className="studio-orientation-note"><Compass size={14} /> ตอนนี้ {selected.widthMm} × {selected.depthMm} มม. · {selected.orientation === "vertical" ? "หมุน 90°" : "ทิศทางมาตรฐาน"}</div></div>
            <div className="studio-inspector-section"><div className="studio-inspector-subheading"><strong>ตำแหน่งอ่าง {selected.sku}</strong><small>ระยะจากมุมซ้ายบนของแผ่นจริง</small></div><div className="studio-rectangle-inputs"><label>X (มม.)<input type="number" value={selected.xMm} onChange={(event) => updateSelected({ xMm: Number(event.target.value) })} /></label><label>Y (มม.)<input type="number" value={selected.yMm} onChange={(event) => updateSelected({ yMm: Number(event.target.value) })} /></label></div><p className="studio-helper">ตำแหน่งยังใช้หน่วยมิลลิเมตรเดียวกับแผ่น และตรวจสอบได้จากกรอบ 5 เมตร</p></div>
            <div className="studio-inspector-section"><div className="studio-inspector-subheading"><strong>แผ่นหลัก</strong><small>มุมมองสเกลจริงของผัง</small></div><button type="button" className="studio-button" onClick={() => setOrientation(selected.orientation === "horizontal" ? "vertical" : "horizontal")}><RotateCw size={14} /> หมุนอ่างที่เลือก 90°</button><p className="studio-helper">การหมุนอ่างสลับ width / depth และปรับกรอบบนผังทันที ไม่ใช่แค่หมุนไอคอน</p></div>
          </aside>
        </div>
      </section>
    </div>
  </main>;
}