acement-visual">{product && <BasinVisual tone={product.imageTone} imageUrl={product.imageUrl} alt="" tall={product.category === "tall vertical washbasin"} />}</span><strong>{placement.sku}</strong><small>{inactive ? "ไม่เปิดใช้งานแล้ว · เปลี่ยนรุ่นหรือนำออก" : unknown ? "ขนาดหลุมไม่ระบุ" : `${placement.widthMm} × ${placement.depthMm} มม. · ลากเพื่อย้าย`}</small><button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setSelectedPlacementId((current) => current === placement.id ? null : placement.id); setState((current) => ({ ...current, basinPlacements: current.basinPlacements.filter((item) => item.id !== placement.id) })); }} aria-label={`นำ ${placement.sku} ออกจากผัง`}><X size={12} /></button></div>;
          })}
          {piece.rectangles.map((rectangle) => <div key={`drag-${rectangle.id}`} className={`studio-rectangle-drag-target ${rectangle.id === activeRectangle?.id ? "is-selected" : ""}`} draggable onClick={() => { setSelectedRectangleId(rectangle.id); setSelectedPlacementId(null); }} onPointerDown={(event) => beginPointerDrag(event, "rectangle", rectangle.id)} onPointerMove={movePointerDrag} onPointerUp={endPointerDrag} onPointerCancel={endPointerDrag} onDragStart={(event) => { setSelectedRectangleId(rectangle.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-studio-rectangle", rectangle.id); }} style={{ left: `${(rectangle.xMm / Math.max(1, bounds.widthMm)) * 100}%`, top: `${(rectangle.yMm / Math.max(1, bounds.heightMm)) * 100}%`, width: `${(studioRectangleSize(rectangle).widthMm / Math.max(1, bounds.widthMm)) * 100}%`, height: `${(studioRectangleSize(rectangle).heightMm / Math.max(1, bounds.heightMm)) * 100}%` }} aria-label={`ลากแผ่น ${rectangle.widthMm} × ${rectangle.lengthMm} มม.`} />)}
        </StudioFootprint>
        <p className="studio-canvas-hint"><GripVertical size={14} /> คลิกแผ่นหรืออ่างเพื่อเปิดตัวแก้ไข · ลากเพื่อจัดตำแหน่ง · ขอบที่ชนกันจะ snap ต่อกัน</p>
      </div>
      <aside className="studio-inspector" aria-label={`ตัวแก้ไขชิ้นงาน ${piece.name}`}>
        <div className="studio-inspector-heading"><div><p className="eyebrow">INSPECTOR</p><h4>{selectedPlacement ? `อ่าง ${selectedPlacement.sku}` : `แผ่น ${activeRectangle ? piece.rectangles.findIndex((item) => item.id === activeRectangle.id) + 1 : 1}`}</h4></div><span>{selectedPlacement ? "BASIN" : "PANEL"}</span></div>
        {placements.length > 0 && <div className="studio-placement-tools" data-testid={`studio-placement-tools-${piece.id}`}><div><strong>อ่างในชิ้นงาน</strong><small>เลือกอ่างบนผัง หรือเลือกจากรายการนี้</small></div><div className="studio-placement-selectors">{placements.map((placement) => <button type="button" key={placement.id} className={placement.id === selectedPlacementId ? "is-active" : ""} onClick={() => { setSelectedPlacementId(placement.id); setSelectedRectangleId(null); }} aria-pressed={placement.id === selectedPlacementId} data-testid={`button-select-studio-placement-${placement.id}`}>{placement.sku}</button>)}</div>{selectedPlacement && <div className="studio-placement-actions"><button type="button" className="button button--outline" onClick={centerSelectedBasin} disabled={selectedPlacement.widthMm === null || selectedPlacement.depthMm === null} data-testid="button-center-selected-basin">วางอ่างกึ่งกลางแผ่น</button>{placements.length === 2 && <button type="button" className="button button--outline" onClick={distributeBasins} disabled={placements.some((placement) => placement.widthMm === null || placement.depthMm === null)} data-testid="button-distribute-studio-basins">จัดระยะห่างอ่าง</button>}</div>}</div>}
        {selectedPlacement && <div className="studio-inspector-section studio-placement-inspector-section">
          <div className="studio-inspector-subheading"><strong>ตำแหน่งอ่าง {selectedPlacement.sku}</strong><small>{selectedPlacement.widthMm === null || selectedPlacement.depthMm === null ? "ขนาดหลุมไม่ระบุ" : `หลุม ${selectedPlacement.widthMm} × ${selectedPlacement.depthMm} มม.`}</small></div>
          <div className="studio-rectangle-inputs">
            <label>X (มม.)<input type="number" min="0" value={Math.round(selectedPlacement.xMm)} onChange={(event) => updatePlacement((placement) => ({ ...placement, xMm: numericValue(event.target.value) }))} data-testid={`input-placement-x-${selectedPlacement.id}`} /></label>
            <label>Y (มม.)<input type="number" min="0" value={Math.round(selectedPlacement.yMm)} onChange={(event) => updatePlacement((placement) => ({ ...placement, yMm: numericValue(event.target.value) }))} data-testid={`input-placement-y-${selectedPlacement.id}`} /></label>
          </div>
           <p className="studio-helper">X / Y คือระยะจากมุมซ้ายบนของผังถึงมุมซ้ายบนของหลุมอ่าง · หน่วยมิลลิเมตร · แก้ตรง ๆ หรือใช้การลากบนผัง</p>
        </div>}
         {activeRectangle && <div className="studio-inspector-section">
           <label className="studio-rectangle-select">เลือกแผ่น
             <select value={activeRectangle.id} onChange={(event) => { setSelectedRectangleId(event.target.value); setSelectedPlacementId(null); }} data-testid={`select-studio-rectangle-${piece.id}`}>
               {piece.rectangles.map((rectangle, index) => <option key={rectangle.id} value={rectangle.id}>{rectangle.label ?? `แผ่น ${index + 1}`} · {rectangle.widthMm} × {rectangle.lengthMm} มม.</option>)}
             </select>
           </label>
          <div className="studio-rectangle-editor">
           <div className="studio-rectangle-inputs">
            <label>กว้าง (มม.)<input type="number" min="1" value={activeRectangle.widthMm} onChange={(event) => updateRectangle((rectangle) => ({ ...rectangle, widthMm: numericValue(event.target.value) }))} data-testid={`input-rectangle-width-${activeRectangle.id}`} /></label>
            <label>ยาว (มม.)<input type="number" min="1" value={activeRectangle.lengthMm} onChange={(event) => updateRectangle((rectangle) => ({ ...rectangle, lengthMm: numericValue(event.target.value) }))} data-testid={`input-rectangle-length-${activeRectangle.id}`} /></label>
             <label>X (มม.)<input type="number" min="0" value={activeRectangle.xMm} onChange={(event) => updateRectangle((rectangle) => ({ ...rectangle, xMm: numericValue(event.target.value) }))} data-testid={`input-rectangle-x-${activeRectangle.id}`} /></label>
             <label>Y (มม.)<input type="number" min="0" value={activeRectangle.yMm} onChange={(event) => updateRectangle((rectangle) => ({ ...rectangle, yMm: numericValue(event.target.value) }))} data-testid={`input-rectangle-y-${activeRectangle.id}`} /></label>
           </div>
            <p className="studio-helper">X / Y คือระยะจากมุมซ้ายบนของกรอบผังถึงมุมซ้ายบนของแผ่น · หน่วยมิลลิเมตร · ขนาดแผ่นใช้หน่วย มิลลิเมตร (มม.) เช่น 600 มม. = 60 ซม. / 1800 มม. = 1.8 เมตร</p>
          {([activeRectangle.widthMm, activeRectangle.lengthMm].filter((value) => value < SMALL_RECTANGLE_STANDARD_MM).length > 0) && <div className="studio-warning studio-warning--small" data-testid={`status-small-rectangle-${activeRectangle.id}`} aria-live="polite"><AlertTriangle size={16} /><div>{[activeRectangle.widthMm, activeRectangle.lengthMm].filter((value) => value < SMALL_RECTANGLE_STANDARD_MM).map((value) => <p key={value}>{smallRectangleWarning(value)}</p>)}</div></div>}
          {activeRectangle.widthMm > 900 && <div className="studio-dimension-suggestion" aria-live="polite"><span>ความกว้างเกิน 900 มม. ตรวจสอบทิศทาง</span><button type="button" className="button button--outline" onClick={() => updateRectangle((rectangle) => ({ ...rectangle, widthMm: rectangle.lengthMm, lengthMm: rectangle.widthMm }))} data-testid={`button-swap-rectangle-dimensions-${activeRectangle.id}`}><RotateCw size={14} /> สลับ กว้าง ↔ ยาว</button></div>}
          <button type="button" className="button button--outline studio-rotate-button" onClick={() => updateRectangle((rectangle) => ({ ...rectangle, rotation: rectangle.rotation === 0 ? 90 : 0 }))}><RotateCw size={14} /> สลับแนวนอน / แนวตั้ง</button>
          <div className="studio-side-status-grid">{studioSideStatuses(piece, activeRectangle.id).map(({ side, label, status }) => <label key={side}>{label}<select value={status} onChange={(event) => changeStatus(activeRectangle.id, side, event.target.value as SideStatus)}><option value="normal">ปกติ</option><option value="upstand">ติดบัว ▲</option><option value="open-edge">ขอบเปิด ⊗</option><option value="wall-flush">ชิดผนัง ║</option></select></label>)}</div>
          <p className="studio-helper">ติดบัว = ชิดผนังปูน / ขอบเปิด = โชว์ลอยในอากาศ</p>
           <div className="studio-inspector-actions"><button type="button" className="button button--outline" disabled={piece.rectangles.length >= STUDIO_MAX_RECTANGLES} onClick={addRectangle} data-testid={`button-add-studio-rectangle-${piece.id}`}><Plus size={14} /> เพิ่มแผ่น / ขั้น</button><button type="button" className="icon-button" onClick={() => setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.filter((item) => item.id !== activeRectangle.id) }))} disabled={piece.rectangles.length <= 1} aria-label="ลบแผ่นที่เลือก"><Trash2 size={14} /></button></div>
          </div>
        </div>}
      </aside>
    </div>
    {overlaps.length > 0 && <p className="studio-warning"><AlertTriangle size={15} /> มีสี่เหลี่ยมซ้อนกัน ({overlaps.length} จุด) พื้นที่ไม่ถูกหักซ้ำ แต่ควรตรวจสอบการจัดวาง</p>}
  </section>;
}

function StudioCanvas({
  state,
  setState,
  zoom,
  setZoom,
  selectedPlacementId,
  setSelectedPlacementId,
  selectedRectangleId,
  setSelectedRectangleId,
  basinProducts,
}: {
  state: StudioState;
  setState: Dispatch<SetStateAction<StudioState>>;
  zoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
  selectedPlacementId: string | null;
  setSelectedPlacementId: Dispatch<SetStateAction<string | null>>;
  selectedRectangleId: string | null;
  setSelectedRectangleId: Dispatch<SetStateAction<string | null>>;
  basinProducts: ReadonlyArray<BasinProduct>;
}) {
  const pieces = getStudioPieces(state);
  const applyPreset = (preset: StudioPreset) => {
    setState((current) => studioStateWithPreset(current, preset));
    setSelectedPlacementId(null);
    setSelectedRectangleId(null);
  };
  const mirrorL = () => {
    setState((current) => mirrorStudioLState(current));
  };
  return <section className="studio-panel studio-canvas-panel">
    <div className="studio-panel-heading"><div><p className="eyebrow">03 / RECTANGLE WORKPIECES</p><h3>ประกอบผังจากสี่เหลี่ยม</h3></div><span>{pieces.length} / {STUDIO_MAX_PIECES} ชิ้นงาน</span></div>
    <p className="studio-helper">แต่ละชิ้นงานมีได้สูงสุด 6 แผ่น · ขอบที่ชนกันจะแสดงเส้นประและข้อความต้องได้ฉาก 90° · แผ่นซ้อนกันจะแจ้งเตือน</p>
    <div className="studio-canvas-toolbar">
      <div>
        <strong>เริ่มจากทรงสำเร็จรูป</strong>
        <small>กดครั้งเดียวเพื่อล้างผังเดิมและสร้างขนาดมาตรฐาน</small>
      </div>
      <div className="studio-preset-actions">
        {(Object.keys(studioPresetCopy) as StudioPreset[]).map((preset) => <button type="button" key={preset} className="button button--outline studio-preset-button" onClick={() => applyPreset(preset)} data-testid={`button-studio-preset-${preset}`}><span>{studioPresetCopy[preset].label}</span><small>{studioPresetCopy[preset].description}</small></button>)}
      </div>
      {state.shape === "L" && state.pieces && state.pieces.length > 0 && <button type="button" className="button button--outline studio-mirror-button" onClick={mirrorL} data-testid="button-studio-mirror-l"><RotateCw size={14} /> สลับข้าง L (ซ้าย ↔ ขวา)</button>}
    </div>
    <div className="studio-zoom-toolbar" aria-label="ควบคุมการซูมผัง 2D">
      <span>ขยายผัง 2D</span>
      <button type="button" className="icon-button" onClick={() => setZoom((current) => Math.max(.75, Math.round((current - .25) * 100) / 100))} aria-label="ซูมออก" data-testid="button-studio-zoom-out"><Minus size={15} /></button>
      <strong data-testid="studio-zoom-value">{Math.round(zoom * 100)}%</strong>
      <button type="button" className="icon-button" onClick={() => setZoom((current) => Math.min(2, Math.round((current + .25) * 100) / 100))} aria-label="ซูมเข้า" data-testid="button-studio-zoom-in"><Plus size={15} /></button>
      <button type="button" className="button button--outline" onClick={() => setZoom(1)} data-testid="button-studio-zoom-reset">100%</button>
    </div>
    <div className="studio-piece-list">{pieces.map((piece) => <StudioPieceEditor key={piece.id} piece={piece} state={state} setState={setState} zoom={zoom} selectedPlacementId={selectedPlacementId} setSelectedPlacementId={setSelectedPlacementId} selectedRectangleId={selectedRectangleId} setSelectedRectangleId={setSelectedRectangleId} basinProducts={basinProducts} />)}</div>
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
        {state.activeStone === code && <em><Check size={12} /> กำลังคำนวณ</em>}
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

function StudioDraftCard({ draft, onOpen, onCopy, onDelete }: { draft: NamedStudioDraftRecord; onOpen: () => void; onCopy: () => void; onDelete: () => void }) {
  const estimate = studioEstimate(draft.state, PRODUCTS);
  const piece = getStudioPieces(draft.state)[0];
  const bounds = piece ? pieceBounds(piece) : null;
  const placements = piece
    ? draft.state.basinPlacements.filter((placement) => (placement.pieceId ?? piece.id) === piece.id)
    : [];
  return <article className="studio-saved-draft-card" data-testid={`studio-saved-draft-${draft.id}`}>
    <div className="studio-saved-draft-preview">
      {piece && bounds ? <StudioFootprint piece={piece} stoneTone={stoneColorByName(draft.state.activeStone).tone} className="studio-saved-draft-canvas" testId={`studio-draft-preview-${draft.id}`} ariaLabel={`ตัวอย่างแบบร่าง ${draft.name}`}>
        {placements.map((placement) => {
          const unknown = placement.widthMm === null || placement.depthMm === null;
          return <div
            key={placement.id}
            className={`studio-placement studio-placement--draft-preview ${unknown ? "studio-placement--unknown" : ""}`}
            style={{
              left: `${(placement.xMm / Math.max(1, bounds.widthMm)) * 100}%`,
              top: `${(placement.yMm / Math.max(1, bounds.heightMm)) * 100}%`,
              width: unknown ? "18%" : `${((placement.widthMm ?? 0) / Math.max(1, bounds.widthMm)) * 100}%`,
              height: unknown ? "18%" : `${((placement.depthMm ?? 0) / Math.max(1, bounds.heightMm)) * 100}%`,
            }}
            data-testid={`studio-draft-placement-${draft.id}-${placement.id}`}
            aria-label={`ตำแหน่งอ่าง ${placement.sku}`}
          >
            <strong>{placement.sku}</strong>
          </div>;
        })}
      </StudioFootprint> : <span>ไม่มีผัง</span>}
    </div>
    <div className="studio-saved-draft-content">
      <div className="studio-saved-draft-heading"><div><strong>{draft.name}</strong><small>บันทึกล่าสุด {formatDraftTimestamp(draft.savedAt)}</small></div><span>{draft.state.activeStone}</span></div>
      <div className="studio-saved-draft-summary"><span>{estimate.counterAreaSqM.toFixed(4)} m² · อ่าง {placements.length} จุด</span><strong>{formatTHB(estimate.totalTHB)}</strong></div>
      <div className="studio-saved-draft-actions">
        <button type="button" className="button button--accent" onClick={onOpen} data-testid={`button-open-studio-draft-${draft.id}`}><Pencil size={14} /> เปิดทำต่อ</button>
        <button type="button" className="button button--outline" onClick={onCopy} data-testid={`button-copy-studio-draft-${draft.id}`}><Link2 size={14} /> คัดลอกลิงก์</button>
        <button type="button" className="icon-button studio-saved-draft-delete" onClick={onDelete} aria-label={`ลบแบบร่าง ${draft.name}`} data-testid={`button-delete-studio-draft-${draft.id}`}><Trash2 size={14} /></button>
      </div>
    </div>
  </article>;
}

function StudioDraftDrawer({ drafts, onClose, onOpen, onCopy, onDelete }: { drafts: NamedStudioDraftRecord[]; onClose: () => void; onOpen: (draft: NamedStudioDraftRecord) => void; onCopy: (draft: NamedStudioDraftRecord) => void; onDelete: (draft: NamedStudioDraftRecord) => void }) {
  return <div className="studio-drafts-layer">
    <button type="button" className="studio-drafts-backdrop" onClick={onClose} aria-label="ปิดแบบร่างของฉัน" />
    <aside className="studio-drafts-drawer" role="dialog" aria-modal="true" aria-labelledby="studio-drafts-title" data-testid="studio-drafts-drawer">
      <div className="studio-drafts-drawer-heading"><div><p className="eyebrow">SAVED WORKSPACE</p><h2 id="studio-drafts-title">แบบร่างของฉัน <span>({drafts.length})</span></h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="ปิดแบบร่างของฉัน" data-testid="button-close-studio-drafts"><X size={18} /></button></div>
      {drafts.length === 0 ? <div className="studio-drafts-empty"><FolderOpen size={28} /><strong>ยังไม่มีแบบร่างที่ตั้งชื่อ</strong><small>กด “บันทึกแบบร่าง” เพื่อเก็บแบบไว้กลับมาทำต่อ</small></div> : <div className="studio-drafts-list">{drafts.map((draft) => <StudioDraftCard key={draft.id} draft={draft} onOpen={() => onOpen(draft)} onCopy={() => onCopy(draft)} onDelete={() => onDelete(draft)} />)}</div>}
    </aside>
  </div>;
}

type StudioCatalogNotice = {
  savedAt: string;
  context: StudioCatalogContext;
  comparison: StudioCatalogComparison;
};

function studioCatalogNotice(context: StudioCatalogContext, basinProducts: ReadonlyArray<BasinProduct>): StudioCatalogNotice {
  return { savedAt: context.savedAt, context, comparison: compareStudioCatalog(context, basinProducts) };
}

function StudioCatalogChangeNotice({ notice }: { notice: StudioCatalogNotice }) {
  const fieldLabels: Record<StudioCatalogField, string> = {
    colorName: "สี",
    priceTHB: "ราคา",
    category: "ประเภท",
    dimensions: "ขนาดตัวอ่าง",
    basinDimensions: "ขนาดหลุม",
  };
  const formatFieldValue = (field: StudioCatalogField, value: string | number | undefined) => {
    if (field === "priceTHB") return typeof value === "number" ? formatTHB(value) : "ไม่ระบุ";
    return value ?? "ไม่ระบุ";
  };
  if (!notice.comparison.catalogUpdated && notice.comparison.resolvedChanges.length === 0) return null;
  return <div className="studio-catalog-change-banner" role="status" data-testid="studio-catalog-change-banner">
    <div>
      <strong>แคตตาล็อกอ่างเปลี่ยนแปลงตั้งแต่บันทึกแบบร่าง</strong>
      <small>แบบร่างนี้บันทึกเมื่อ {formatDraftTimestamp(notice.savedAt)}</small>
    </div>
    {notice.comparison.changes.length > 0
      ? <ul>{notice.comparison.changes.map((change) => <li key={change.sku}>
        <code>{change.sku}</code>
        {change.kind === "removed"
          ? <span>ไม่มีในแคตตาล็อกปัจจุบัน — เลือกรุ่นใหม่เพื่อแทนที่ หรือนำออกจากแบบ</span>
           : <div className="studio-catalog-change-details" data-testid={`studio-catalog-change-${change.sku}`}>
             {change.changedFields.includes("colorName") && <span>รายละเอียดแคตตาล็อกเปลี่ยนจาก {change.saved.colorName ?? "รุ่นเดิม"} เป็น {change.current?.colorName ?? "รุ่นปัจจุบัน"}</span>}
             {!change.changedFields.includes("colorName") && <span>รายละเอียดแคตตาล็อกมีการเปลี่ยนแปลง</span>}
             <ul data-testid={`studio-catalog-change-fields-${change.sku}`}>
               {change.changedFields.map((field) => <li key={field}><strong>{fieldLabels[field]}:</strong> {formatFieldValue(field, change.saved[field])} → {formatFieldValue(field, change.current?.[field])}</li>)}
             </ul>
           </div>}
      </li>)}</ul>
      : notice.comparison.resolvedChanges.length === 0 && <p>รุ่นอ่างที่เลือกยังตรงกับรายการปัจจุบัน แต่มีรายการอื่นในแคตตาล็อกอัปเดตแล้ว</p>}
    {notice.comparison.resolvedChanges.length > 0 && <div className="studio-catalog-resolved" data-testid="studio-catalog-resolved">
      <strong>จัดการแล้ว</strong>
      <ul>{notice.comparison.resolvedChanges.map((change) => <li key={change.sku} data-testid={`studio-catalog-resolved-${change.sku}`}>
        <code>{change.sku}</code>
        {change.kind === "removed"
          ? <span>นำออกจากแบบหรือแทนที่แล้ว — เก็บรายการเปลี่ยนแปลงไว้สำหรับตรวจสอบ</span>
          : <span>ตรวจสอบแล้ว — {change.changedFields.length > 0 ? "รายละเอียดแคตตาล็อกเดิมยังดูได้ในรายการนี้" : "รายการนี้ได้รับการยืนยันแล้ว"}</span>}
      </li>)}</ul>
    </div>}
    {notice.comparison.changes.length > 0 && <p>ตรวจสอบรายการอ่างด้านบนเพื่อใช้การแทนที่หรือนำรุ่นที่ไม่ใช้งานแล้วออกจากแบบ</p>}
  </div>;
}

export function StudioPage({
  mode,
  leadKey,
  onSubmitStudio,
  contactDefaults,
  initialBasinSkus = [],
  initialStoneColors = [],
  stoneColors = STONE_COLORS,
  sheetPriceColors = stoneColors,
  basinProducts = PRODUCTS,
}: StudioPageProps) {
  const linkedDraft = useMemo(readLinkedDraft, []);
  const [state, setState] = useState<StudioState>(() => linkedDraft.state ?? createInitialStudioState(mode, initialBasinSkus, initialStoneColors, basinProducts));
  const [draftNotice, setDraftNotice] = useState<StudioDraftRecord | null>(() => mode === "studio" && !linkedDraft.state ? readStoredStudioDraft() : null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(() => linkedDraft.state ? new Date().toISOString() : null);
  const [draftResult, setDraftResult] = useState(() => linkedDraft.token && !linkedDraft.state ? "ลิงก์แบบร่างไม่ถูกต้องหรือหมดอายุ กรุณาเริ่มออกแบบใหม่" : "");
  const [catalogNotice, setCatalogNotice] = useState<StudioCatalogNotice | null>(() => linkedDraft.catalogContext ? studioCatalogNotice(linkedDraft.catalogContext, basinProducts) : null);
  const [namedDrafts, setNamedDrafts] = useState<NamedStudioDraftRecord[]>(() => mode === "studio" ? readStoredStudioDrafts() : []);
  const [editingNamedDraftId, setEditingNamedDraftId] = useState<string | null>(null);
  const [draftDrawerOpen, setDraftDrawerOpen] = useState(false);
  const [saveDraftDialogOpen, setSaveDraftDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const skipNextDraftSave = useRef(false);
  const hasMountedDraftEffect = useRef(false);
  const [contact, setContact] = useState(() => ({ ...emptyContact, ...contactDefaults }));
  const [sketchFile, setSketchFile] = useState<File | null>(null);
  const [sketchPreviewUrl, setSketchPreviewUrl] = useState<string | null>(null);
  const sketchInputRef = useRef<HTMLInputElement | null>(null);
  const [result, setResult] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [selectedRectangleId, setSelectedRectangleId] = useState<string | null>(null);
  const estimate = useMemo(() => studioEstimate(state, basinProducts), [state, basinProducts]);
  const activeStone = stoneColorByName(state.activeStone);
  const counterStoneTotal = Math.max(0, estimate.stoneTotalTHB - estimate.upstandTotalTHB);
  const exportReady = mode === "studio" && studioExportDimensionsValid(state);
  const exportName = contact.project || "studio-layout";
  const today = thaiDateInputValue(new Date());
  const hasPastInstallationDate = Boolean(contact.expectedInstallationDate && contact.expectedInstallationDate < today);
  const missingTaxIdForVat = state.vat && !/^[0-9]{13}$/.test(contact.taxId);
  useEffect(() => {
    if (!sketchFile) {
      setSketchPreviewUrl(null);
      return;
    }
    const previewUrl = URL.createObjectURL(sketchFile);
    setSketchPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [sketchFile]);
  useEffect(() => {
    if (!contactDefaults) return;
    setContact((current) => ({
      ...current,
      name: contactDefaults.name || current.name,
      company: contactDefaults.company || current.company,
      phone: contactDefaults.phone || current.phone,
      email: contactDefaults.email || current.email,
      project: contactDefaults.project || current.project,
      address: contactDefaults.address || current.address,
    }));
  }, [contactDefaults?.name, contactDefaults?.company, contactDefaults?.phone, contactDefaults?.email, contactDefaults?.project, contactDefaults?.address]);
  useEffect(() => {
    if (!estimate.crossJointPlacements.length && result === "อ่างวางตรงรอยต่อแผ่น กรุณาขยับอ่างให้อยู่ภายในแผ่นเดียว") {
      setResult("");
    }
  }, [estimate.crossJointPlacements.length, result]);
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
      const catalogContext = catalogNotice?.context ?? createStudioCatalogContext(state, basinProducts, savedAt);
      const saved = writeStoredStudioDraft({ version: 1, savedAt, state, catalogContext });
      if (saved) setLastSavedAt(savedAt);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [mode, state, basinProducts, catalogNotice]);
  const acknowledgeCatalogChange = (sku: string) => {
    setCatalogNotice((current) => {
      if (!current) return current;
      const context = resolveStudioCatalogChange(current.context, sku);
      return context === current.context ? current : studioCatalogNotice(context, basinProducts);
    });
  };
  const resumeDraft = () => {
    if (!draftNotice) return;
    setEditingNamedDraftId(null);
    setState(draftNotice.state);
    setLastSavedAt(draftNotice.savedAt);
    setCatalogNotice(draftNotice.catalogContext ? studioCatalogNotice(draftNotice.catalogContext, basinProducts) : null);
    setDraftNotice(null);
    setDraftResult("ดึงแบบร่างเดิมแล้ว");
  };
  const startNewDraft = () => {
    clearStoredStudioDraft();
    setEditingNamedDraftId(null);
    skipNextDraftSave.current = true;
    setState(createInitialStudioState(mode, initialBasinSkus, initialStoneColors, basinProducts));
    setLastSavedAt(null);
    setDraftNotice(null);
    setCatalogNotice(null);
    setDraftResult("");
    setCanvasZoom(1);
    setSelectedPlacementId(null);
    setSelectedRectangleId(null);
    if (window.location.search) window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
  };
  const copyStateLink = async (draftState: StudioState, successMessage: string, createLink: typeof createStudioShareLink = createStudioShareLink, savedCatalogContext?: StudioCatalogContext) => {
    const catalogContext = savedCatalogContext ?? catalogNotice?.context ?? createStudioCatalogContext(draftState, basinProducts);
    const url = createLink(draftState, window.location.origin, catalogContext);
    try {
      await navigator.clipboard.writeText(url);
      setDraftResult(successMessage);
    } catch {
      setDraftResult(`คัดลอกลิงก์ไม่สำเร็จ คัดลอก URL นี้ด้วยตนเอง: ${url}`);
    }
  };
  const copyDraftLink = async () => {
    const savedAt = new Date().toISOString();
    const catalogContext = catalogNotice?.context ?? createStudioCatalogContext(state, basinProducts, savedAt);
    writeStoredStudioDraft({ version: 1, savedAt, state, catalogContext });
    setLastSavedAt(savedAt);
    await copyStateLink(state, "บันทึกและคัดลอกลิงก์แบบร่างแล้ว เปิดลิงก์นี้ใน Incognito เพื่อแก้ไขต่อได้", createStudioShareLink, catalogContext);
  };
  const openSaveDraftDialog = () => {
    const editingDraft = editingNamedDraftId ? namedDrafts.find((draft) => draft.id === editingNamedDraftId) : undefined;
    setDraftName(editingDraft?.name ?? defaultNamedDraft());
    setSaveDraftDialogOpen(true);
  };
  const saveNamedDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const existingDraft = editingNamedDraftId ? namedDrafts.find((draft) => draft.id === editingNamedDraftId) : undefined;
    const draft: NamedStudioDraftRecord = existingDraft
      ? {
        ...existingDraft,
        name,
        savedAt: now,
        state,
        catalogContext: catalogNotice?.context ?? createStudioCatalogContext(state, basinProducts, now),
      }
      : {
        version: 1,
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        createdAt: now,
        savedAt: now,
        state,
        catalogContext: catalogNotice?.context ?? createStudioCatalogContext(state, basinProducts, now),
      };
    if (!upsertStoredStudioDraft(draft)) {
      setDraftResult("บันทึกแบบร่างไม่สำเร็จ กรุณาตรวจสอบพื้นที่จัดเก็บของเบราว์เซอร์");
      return;
    }
    setNamedDrafts((current) => current.some((item) => item.id === draft.id)
      ? current.map((item) => item.id === draft.id ? draft : item)
      : [draft, ...current]);
    setEditingNamedDraftId(draft.id);
    setSaveDraftDialogOpen(false);
    setDraftDrawerOpen(true);
    setDraftResult(`${existingDraft ? "อัปเดต" : "บันทึก"}แบบร่าง “${name}” แล้ว`);
  };
  const openNamedDraft = (draft: NamedStudioDraftRecord) => {
    setEditingNamedDraftId(draft.id);
    setState(draft.state);
    setLastSavedAt(draft.savedAt);
    setCatalogNotice(draft.catalogContext ? studioCatalogNotice(draft.catalogContext, basinProducts) : null);
    setDraftDrawerOpen(false);
    setDraftResult(`เปิดแบบร่าง “${draft.name}” แล้ว`);
  };
  const copyNamedDraftLink = async (draft: NamedStudioDraftRecord) => {
    const catalogContext = draft.catalogContext ?? createStudioCatalogContext(draft.state, basinProducts, draft.savedAt);
    const url = createStudioDraftLink(draft.state, window.location.origin, undefined, catalogContext);
    try {
      await navigator.clipboard.writeText(url);
      setDraftResult(`คัดลอกลิงก์แบบร่าง “${draft.name}” แล้ว เปิดใน Incognito เพื่อแก้ไขต่อได้`);
    } catch {
      setDraftResult(`คัดลอกลิงก์ไม่สำเร็จ คัดลอก URL นี้ด้วยตนเอง: ${url}`);
    }
  };
  const deleteNamedDraft = (draft: NamedStudioDraftRecord) => {
    if (!window.confirm(`ลบแบบร่าง “${draft.name}” หรือไม่`)) return;
    if (!removeStoredStudioDraft(draft.id)) {
      setDraftResult("ลบแบบร่างไม่สำเร็จ กรุณาลองอีกครั้ง");
      return;
    }
    setNamedDrafts((current) => current.filter((item) => item.id !== draft.id));
    setEditingNamedDraftId((current) => current === draft.id ? null : current);
    setDraftResult(`ลบแบบร่าง “${draft.name}” แล้ว`);
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
    if (!isValidPhoneNumber(contact.phone)) {
      setResult("เบอร์โทรศัพท์ต้องเป็นตัวเลข 9–10 หลัก");
      return;
    }
    if (contact.taxId && !/^[0-9]{13}$/.test(contact.taxId)) {
      setResult("เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก");
      return;
    }
    if (hasPastInstallationDate) {
      setResult("วันที่เข้าติดตั้งต้องไม่เป็นวันที่ผ่านมา");
      return;
    }
    if (!isValidEmailAddress(contact.email)) {
      setResult("กรุณากรอกอีเมลให้ถูกต้อง (เช่น name@example.com)");
      return;
    }
    setSubmitting(true);
    setResult("");
    try {
      const basinCounts = new Map<string, number>();
      state.basinPlacements.forEach((placement) => basinCounts.set(placement.sku, (basinCounts.get(placement.sku) ?? 0) + 1));
      const notificationItems: StudioNotificationItem[] = Array.from(basinCounts.entries()).flatMap(([sku, quantity]) => {
        const product = basinProducts.find((item) => item.sku === sku);
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
    const name = contact.name.trim();
    const company = contact.company.trim();
    const phone = contact.phone.trim();
    const email = contact.email.trim();
    const project = contact.project.trim();
    const address = contact.address.trim();
    if (!sketchFile || !name || !phone || !project) {
      setResult("กรุณาแนบไฟล์ และกรอกชื่อผู้ติดต่อ โทรศัพท์ และชื่อโครงการ");
      return;
    }
    if (!isValidPhoneNumber(phone)) {
      setResult("เบอร์โทรศัพท์ต้องเป็นตัวเลข 9–10 หลัก");
      return;
    }
    if (!isValidEmailAddress(email)) {
      setResult("กรุณากรอกอีเมลให้ถูกต้อง (เช่น name@example.com)");
      return;
    }
    if (contact.taxId && !/^[0-9]{13}$/.test(contact.taxId)) {
      setResult("เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก");
      return;
    }
    if (hasPastInstallationDate) {
      setResult("วันที่เข้าติดตั้งต้องไม่เป็นวันที่ผ่านมา");
      return;
    }
    setSubmitting(true);
    setResult("");
    const form = new FormData();
    form.append("file", sketchFile);
    form.append("metadata", JSON.stringify({ leadKey, status: "new_lead", source: "hand_sketch", orderMode: "sketch", productSkus: state.basinSkus, name, company: company || null, phone, lineContact: contact.lineContact || null, email: email || null, project, address: address || null, taxName: contact.taxName || null, taxId: contact.taxId || null, taxBranch: contact.taxBranch || null, taxAddress: contact.taxAddress || null, preferredContact: contact.preferredContact || null, customerRole: contact.customerRole || null, propertyType: contact.propertyType || null, condoFloor: contact.condoFloor || null, expectedInstallationDate: contact.expectedInstallationDate || null, studioData: { ...state, estimate } }));
    try {
      const response = await fetch("/api/leads/sketch", { method: "POST", body: form });
      const payload = await response.json() as { notificationStatus?: string; message?: string };
      if (!response.ok) throw new Error(payload.message || "ส่งไฟล์ไม่สำเร็จ");
      setResult(payload.message || (payload.notificationStatus === "notified" ? "ส่งแบบร่างเรียบร้อยแล้ว ทีมขายได้รับการแจ้งเตือน" : "บันทึกแบบร่างเรียบร้อยแล้ว"));
      setSketchFile(null);
       if (sketchInputRef.current) sketchInputRef.current.value = "";
    } catch (error) {
      setResult(error instanceof Error ? error.message : "ส่งไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };
  const scrollToEstimate = () => document.querySelector(".studio-estimate-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  return <div className="page-wrap studio-page">
    <section className="studio-hero"><div><p className="eyebrow accent">ORDER MODE / {mode === "studio" ? "LAYOUT STUDIO" : "HAND SKETCH"}</p><h1>{mode === "studio" ? <>ประกอบแผ่นจริง<br /><em>ให้เห็นภาพก่อนขอราคา</em></> : <>ส่งแบบร่าง<br /><em>ให้ทีมขายช่วยต่อยอด</em></>}</h1><p className="hero-copy">{mode === "studio" ? "เพิ่มชิ้นงานและสี่เหลี่ยม กำหนดทิศทาง จัดตำแหน่ง และตั้งสถานะรายด้านได้ตามแบบช่างจริง" : "แนบภาพสเก็ตช์ด้วยมือ พร้อมเลือกวัสดุและรุ่นอ่างที่สนใจ ทีมขายจะตรวจสอบแบบและติดต่อกลับ"}</p></div><div className="studio-hero-mark">{mode === "studio" ? "02" : "03"}</div></section>
    {mode === "studio" && draftNotice && <div className="studio-draft-banner" role="alert" data-testid="studio-draft-banner"><div><strong>พบแบบร่างที่ทำค้างไว้เมื่อ {formatDraftTimestamp(draftNotice.savedAt)}</strong><small>แบบร่างนี้อยู่ในเบราว์เซอร์เครื่องนี้</small></div><div className="studio-draft-banner-actions"><button type="button" className="button button--accent" onClick={resumeDraft} data-testid="button-resume-studio-draft">ดึงแบบร่างเดิม</button><button type="button" className="button button--outline" onClick={startNewDraft} data-testid="button-new-studio-draft">เริ่มออกแบบใหม่</button></div></div>}
     {mode === "studio" && catalogNotice && <StudioCatalogChangeNotice notice={catalogNotice} />}
     {mode === "studio" && <div className="studio-draft-toolbar"><div><p className="eyebrow">DRAFT WORKSPACE</p><span>{editingNamedDraftId ? `กำลังแก้ไขแบบร่างที่ตั้งชื่อไว้` : lastSavedAt ? `บันทึกอัตโนมัติล่าสุด ${formatDraftTimestamp(lastSavedAt)}` : "ยังไม่มีแบบร่างที่บันทึก"}</span></div><div className="studio-draft-toolbar-actions"><button type="button" className="button button--accent" onClick={openSaveDraftDialog} data-testid="button-save-named-studio-draft"><Save size={15} /> {editingNamedDraftId ? "อัปเดตแบบร่าง" : "บันทึกแบบร่าง"}</button><button type="button" className="button button--outline" onClick={() => setDraftDrawerOpen(true)} data-testid="button-open-studio-drafts"><FolderOpen size={15} /> แบบร่างของฉัน ({namedDrafts.length})</button><button type="button" className="button button--outline" onClick={() => void copyDraftLink()} data-testid="button-save-studio-draft-link"><Link2 size={15} /> คัดลอกลิงก์ปัจจุบัน</button></div></div>}
    {draftResult && <p className="studio-result studio-draft-result" role="status" data-testid="status-studio-draft">{draftResult}</p>}
      <div className="studio-design-layout">
         <StudioShortlists state={state} setState={setState} stoneColors={stoneColors} sheetPriceColors={sheetPriceColors} basinProducts={basinProducts} onCatalogChangeResolved={acknowledgeCatalogChange} />
        {mode === "studio" ? <StudioCanvas state={state} setState={setState} zoom={canvasZoom} setZoom={setCanvasZoom} selectedPlacementId={selectedPlacementId} setSelectedPlacementId={setSelectedPlacementId} selectedRectangleId={selectedRectangleId} setSelectedRectangleId={setSelectedRectangleId} basinProducts={basinProducts} /> : <section className="studio-panel studio-sketch-panel"><div className="studio-panel-heading"><div><p className="eyebrow">03 / UPLOAD SKETCH</p><h3>แนบภาพแบบร่าง</h3></div><Upload size={20} /></div><label className={`studio-file-drop ${sketchPreviewUrl ? "studio-file-drop--preview" : ""}`}>{sketchPreviewUrl ? <img className="studio-file-preview" src={sketchPreviewUrl} alt={`ตัวอย่างไฟล์ ${sketchFile?.name ?? "แบบร่าง"}`} data-testid="img-studio-sketch-preview" /> : <Upload size={22} />}<span className="studio-file-drop-copy"><strong>{sketchFile ? sketchFile.name : "เลือกไฟล์แบบร่าง"}</strong><small>JPG, PNG, WEBP หรือ GIF · ไม่เกิน 10 MB</small></span><input ref={sketchInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setSketchFile(event.target.files?.[0] ?? null)} data-testid="input-studio-sketch" /></label></section>}
      </div>
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
           <label>ความสูงบัว (มม.)<input type="number" min="0" max="500" value={state.upstandHeightMm ?? ""} onChange={(event) => setState((current) => ({ ...current, upstandHeightMm: event.target.value.trim() ? numericValue(event.target.value) : null }))} data-testid="input-studio-upstand-height" /></label>
          <label>ราคาขอบเปิด / ม.<input type="number" min="0" step="0.01" value={state.openEdgePricePerMTHB ?? ""} onChange={(event) => setState((current) => ({ ...current, openEdgePricePerMTHB: event.target.value.trim() ? numericValue(event.target.value) : null }))} data-testid="input-studio-open-edge-price" /></label>
           <label>ส่วนลด (บาท)<input type="number" min="0" step="1" value={state.discountTHB ?? 0} onChange={(event) => setState((current) => ({ ...current, discountTHB: numericValue(event.target.value) }))} data-testid="input-studio-discount" /></label>
        </div>
        <label className="studio-checkbox"><input type="checkbox" checked={state.vat} onChange={(event) => setState((current) => ({ ...current, vat: event.target.checked }))} data-testid="input-studio-vat" /><span />คิด VAT 7% จากยอดหลังหักส่วนลด ({formatTHB(estimate.vatAmountTHB)})</label>
        {missingTaxIdForVat && <p className="studio-warning studio-warning--amber" role="status" data-testid="status-studio-vat-tax-id">💡 กรุณากรอกเลขประจำตัวผู้เสียภาษี 13 หลักในโปรไฟล์เพื่อให้ออกใบกำกับภาษีได้สมบูรณ์</p>}
         <div className="studio-total"><span>รวมประมาณการ</span><strong data-testid="studio-total-value">{formatTHB(estimate.totalTHB)}</strong><small>{state.vat ? "รวม VAT 7% แล้ว" : "ยังไม่รวม VAT"} · ปัดเป็นบาทถ้วนทีละบรรทัด</small></div>
        {estimate.warnings.map((warning) => <p className="studio-warning studio-warning--amber" key={warning}><AlertTriangle size={16} /> {warning}</p>)}
        {estimate.standardSheetWarning && <p className="studio-warning studio-warning--amber"><AlertTriangle size={16} /> {estimate.standardSheetMessage}</p>}
         {mode === "studio" && <div className="studio-export-actions"><button type="button" className="button button--outline" disabled={!exportReady} onClick={() => void exportFiles("dxf")} data-testid="button-download-studio-dxf"><Download size={15} /> ดาวน์โหลดแบบ (DXF)</button><button type="button" className="button button--outline" disabled={!exportReady} onClick={() => void exportFiles("pdf")} data-testid="button-download-studio-pdf"><Download size={15} /> ดาวน์โหลดแบบ (PDF)</button><button type="button" className="button button--outline" disabled={!exportReady} onClick={() => void exportFiles("png")} data-testid="button-download-studio-png"><Download size={15} /> ดาวน์โหลดภาพ (PNG)</button></div>}
        <button type="button" className="button button--dark full-width" disabled={submitting} onClick={mode === "studio" ? submitStudio : submitSketch} data-testid={mode === "studio" ? "button-submit-studio" : "button-submit-sketch"}>{submitting ? "กำลังส่ง..." : mode === "studio" ? "ขอใบเสนอราคาจากแบบนี้" : "ส่งแบบร่างให้ทีมขาย"} <ArrowRight size={16} /></button>
        {result && <p className="studio-result" role="status">{result}</p>}
      </aside>
    </section>
    {mode === "studio" && <StudioPrintLayout state={state} />}
     {mode === "studio" && <div className="studio-mobile-estimate-bar" data-testid="studio-mobile-estimate-bar"><div><span>ยอดประเมินรวม:</span><strong>{formatTHB(estimate.totalTHB)}</strong></div><div><button type="button" className="button button--outline" onClick={scrollToEstimate} data-testid="button-mobile-studio-details">ดูรายละเอียด</button><button type="button" className="button button--accent" disabled={submitting} onClick={() => void submitStudio()} data-testid="button-mobile-studio-submit">{submitting ? "กำลังส่ง..." : "ส่งขอราคา"}</button></div></div>}
     {mode === "studio" && draftDrawerOpen && <StudioDraftDrawer drafts={namedDrafts} onClose={() => setDraftDrawerOpen(false)} onOpen={openNamedDraft} onCopy={(draft) => void copyNamedDraftLink(draft)} onDelete={deleteNamedDraft} />}
     {mode === "studio" && saveDraftDialogOpen && <div className="studio-save-draft-layer" role="presentation"><div className="studio-save-draft-backdrop" onClick={() => setSaveDraftDialogOpen(false)} /><form className="studio-save-draft-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-save-draft-title" onSubmit={saveNamedDraft} data-testid="studio-save-draft-dialog"><div className="studio-save-draft-heading"><div><p className="eyebrow">SAVE WORKSPACE</p><h2 id="studio-save-draft-title">บันทึกแบบร่าง</h2></div><button type="button" className="icon-button" onClick={() => setSaveDraftDialogOpen(false)} aria-label="ปิดหน้าต่างบันทึกแบบร่าง"><X size={18} /></button></div><label>ชื่อแบบร่าง<input autoFocus value={draftName} onChange={(event) => setDraftName(event.target.value)} data-testid="input-studio-draft-name" /></label><p>เก็บผัง 2D สีหิน ขนาด อ่าง และค่ารายด้านไว้กลับมาทำต่อได้</p><div className="studio-save-draft-actions"><button type="button" className="button button--outline" onClick={() => setSaveDraftDialogOpen(false)} data-testid="button-cancel-save-studio-draft">ยกเลิก</button><button type="submit" className="button button--accent" data-testid="button-confirm-save-studio-draft">บันทึกแบบร่าง</button></div></form></div>}
  </div>;
}
