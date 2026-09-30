import { useMemo, useState } from "react";
import type { CustomerLead } from "@workspace/api-client-react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { STONE_COLORS } from "@/data/catalog";
import {
  basinDimensionsForProduct,
  placementCutSize,
  studioAreaSqM,
  studioPieces,
  studioRectangleSize,
  studioSideStatusLabel,
  STUDIO_BASIN_SAFETY_MARGIN_MM,
  type BasinPlacement,
  type SideStatus,
  type StudioPiece,
  type StudioRectangle,
  type StudioState,
} from "@/data/studio-model";
import { productBySku } from "@/data/catalog";

type FactoryCutListLead = Pick<CustomerLead, "id" | "name" | "project" | "site" | "studioData">;
type FactoryCutListSide = "top" | "right" | "bottom" | "left";
type CutListBasin = {
  placement: BasinPlacement;
  panel: StudioRectangle | null;
  cutWidthMm: number | null;
  cutHeightMm: number | null;
  estimatedDimensions: boolean;
  clearances: Record<FactoryCutListSide, number> | null;
};

const SIDES: FactoryCutListSide[] = ["top", "right", "bottom", "left"];
const SIDE_LABELS: Record<FactoryCutListSide, string> = {
  top: "ด้านบน",
  right: "ด้านขวา",
  bottom: "ด้านล่าง",
  left: "ด้านซ้าย",
};
const VALID_SIDE_STATUSES: SideStatus[] = [
  "upstand",
  "open-edge",
  "wall-flush",
  "wall-flush+upstand",
  "closed-edge",
  "normal",
];
const TECHNICIAN_CHECKLIST = [
  "ยืนยันสีหินและตรวจสภาพแผ่นก่อนเริ่มตัด",
  "ตรวจขนาดและทิศทางของทุกแผ่นเทียบกับหน้างาน",
  "ยืนยันสถานะขอบทั้ง 4 ด้านของแต่ละแผ่น",
  "ตรวจรุ่นอ่าง ขนาดหลุม และทิศทางการวาง",
  `วัดระยะรอบหลุมทุกด้านให้ไม่น้อยกว่า ${STUDIO_BASIN_SAFETY_MARGIN_MM} มม.`,
  "ตรวจแบบและวัดซ้ำก่อนตัดจริง",
];

function objectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sideStatus(value: unknown): value is SideStatus {
  return typeof value === "string" && VALID_SIDE_STATUSES.includes(value as SideStatus);
}

function readRectangle(value: unknown): StudioRectangle | null {
  const record = objectRecord(value);
  if (!record) return null;
  const id = typeof record?.id === "string" ? record.id : "";
  const widthMm = finiteNumber(record?.widthMm);
  const lengthMm = finiteNumber(record?.lengthMm);
  const xMm = finiteNumber(record?.xMm);
  const yMm = finiteNumber(record?.yMm);
  if (!id || widthMm === null || lengthMm === null || xMm === null || yMm === null) return null;
  return {
    id,
    widthMm,
    lengthMm,
    xMm,
    yMm,
    rotation: record.rotation === 90 ? 90 : 0,
    ...(typeof record.label === "string" ? { label: record.label } : {}),
  };
}

function readPiece(value: unknown, index: number, state: Record<string, unknown>): StudioPiece | null {
  const record = objectRecord(value);
  if (!record || !Array.isArray(record.rectangles)) return null;
  const id = typeof record.id === "string" && record.id ? record.id : `piece-${index + 1}`;
  const rectangles = record.rectangles.map(readRectangle).filter((item): item is StudioRectangle => item !== null);
  if (!rectangles.length) return null;

  const inheritedStatuses = objectRecord(objectRecord(state.sideStatusesByPiece)?.[id]) ?? {};
  const pieceStatuses = objectRecord(record.sideStatuses) ?? {};
  const keyedStatuses = { ...inheritedStatuses, ...pieceStatuses };
  const sideStatuses = Object.fromEntries(
    Object.entries(keyedStatuses).filter((entry): entry is [string, SideStatus] => sideStatus(entry[1])),
  );
  return {
    id,
    name: typeof record.name === "string" && record.name ? record.name : `ชิ้นงาน ${index + 1}`,
    rectangles,
    sideStatuses,
    ...(record.preset === "i" || record.preset === "l-left" || record.preset === "l-right" || record.preset === "u"
      ? { preset: record.preset }
      : {}),
  };
}

function readPlacement(value: unknown, index: number): BasinPlacement | null {
  const record = objectRecord(value);
  const sku = typeof record?.sku === "string" ? record.sku.trim() : "";
  const xMm = finiteNumber(record?.xMm);
  const yMm = finiteNumber(record?.yMm);
  if (!record || !sku || xMm === null || yMm === null) return null;
  const nullableDimension = (candidate: unknown) => {
    const number = finiteNumber(candidate);
    return number !== null && number > 0 ? number : null;
  };
  return {
    id: typeof record.id === "string" && record.id ? record.id : `basin-${index + 1}`,
    sku,
    xMm,
    yMm,
    widthMm: nullableDimension(record.widthMm),
    depthMm: nullableDimension(record.depthMm),
    ...(typeof record.pieceId === "string" ? { pieceId: record.pieceId } : {}),
    ...(typeof record.sheetId === "string" ? { sheetId: record.sheetId } : {}),
    ...(record.rotation === 90 ? { rotation: 90 as const } : record.rotation === 0 ? { rotation: 0 as const } : {}),
    ...(record.orientation === "horizontal" || record.orientation === "vertical"
      ? { orientation: record.orientation }
      : {}),
  };
}

function factoryCutListData(studioData: unknown) {
  const root = objectRecord(studioData);
  if (!root) return null;
  const state = objectRecord(root.state) ?? root;
  const sourceDimensions = objectRecord(state.dimensions);
  const dimensions = {
    depthMm: finiteNumber(sourceDimensions?.depthMm) ?? 0,
    runAMm: finiteNumber(sourceDimensions?.runAMm) ?? 0,
    runBMm: finiteNumber(sourceDimensions?.runBMm) ?? 0,
    runCMm: finiteNumber(sourceDimensions?.runCMm) ?? 0,
  };
  const shape = state.shape === "L" || state.shape === "U" ? state.shape : "I";
  const pieces = Array.isArray(state.pieces)
    ? state.pieces.map((piece, index) => readPiece(piece, index, state))
      .filter((piece): piece is StudioPiece => piece !== null)
    : undefined;
  const safeState = {
    shape,
    dimensions,
    ...(pieces?.length ? { pieces } : {}),
  } as Pick<StudioState, "shape" | "dimensions" | "pieces">;
  const resolvedPieces = studioPieces(safeState);
  if (!resolvedPieces.some((piece) => piece.rectangles.length > 0)) return null;

  const placements = Array.isArray(state.basinPlacements)
    ? state.basinPlacements.map(readPlacement)
      .filter((placement): placement is BasinPlacement => placement !== null)
    : [];
  const rawStone = [state.activeStone, state.stoneColor, root.stoneColor]
    .find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0)?.trim() ?? "";
  const normalizedStone = rawStone.toLocaleLowerCase();
  const matchedStone = STONE_COLORS.find((color) =>
    [color.name, color.code, ...color.documentCodes]
      .some((identifier) => identifier.toLocaleLowerCase() === normalizedStone),
  );

  return {
    pieces: resolvedPieces,
    placements,
    stoneColor: rawStone ? matchedStone?.name ?? rawStone : "ไม่ระบุในแบบ",
    totalAreaSqM: studioAreaSqM(resolvedPieces),
  };
}

function basinCutList(
  placement: BasinPlacement,
  pieces: StudioPiece[],
): CutListBasin {
  const product = productBySku(placement.sku);
  const catalogSize = basinDimensionsForProduct(product);
  const estimatedDimensions = placement.widthMm === null || placement.depthMm === null;
  const effectivePlacement: BasinPlacement = {
    ...placement,
    widthMm: placement.widthMm ?? catalogSize.widthMm,
    depthMm: placement.depthMm ?? catalogSize.depthMm,
  };
  const cutSize = placementCutSize(effectivePlacement);
  const candidatePieces = placement.pieceId
    ? pieces.filter((piece) => piece.id === placement.pieceId)
    : pieces;
  const allPieces = candidatePieces.length ? candidatePieces : pieces;
  const namedPanel = placement.sheetId
    ? allPieces.flatMap((piece) => piece.rectangles).find((rectangle) => rectangle.id === placement.sheetId)
    : undefined;
  const containingPanel = allPieces.flatMap((piece) => piece.rectangles).find((rectangle) => {
    if (cutSize.widthMm === null || cutSize.heightMm === null) return false;
    const size = studioRectangleSize(rectangle);
    return placement.xMm >= rectangle.xMm &&
      placement.yMm >= rectangle.yMm &&
      placement.xMm + cutSize.widthMm <= rectangle.xMm + size.widthMm &&
      placement.yMm + cutSize.heightMm <= rectangle.yMm + size.heightMm;
  });
  const panel = namedPanel ?? containingPanel ?? (allPieces.length === 1 ? allPieces[0]?.rectangles[0] : null) ?? null;
  if (!panel || cutSize.widthMm === null || cutSize.heightMm === null) {
    return {
      placement,
      panel,
      cutWidthMm: cutSize.widthMm,
      cutHeightMm: cutSize.heightMm,
      estimatedDimensions,
      clearances: null,
    };
  }

  const panelSize = studioRectangleSize(panel);
  return {
    placement,
    panel,
    cutWidthMm: cutSize.widthMm,
    cutHeightMm: cutSize.heightMm,
    estimatedDimensions,
    clearances: {
      left: placement.xMm - panel.xMm,
      right: panel.xMm + panelSize.widthMm - (placement.xMm + cutSize.widthMm),
      top: placement.yMm - panel.yMm,
      bottom: panel.yMm + panelSize.heightMm - (placement.yMm + cutSize.heightMm),
    },
  };
}

function mm(value: number | null | undefined) {
  return value === null || value === undefined ? "ไม่ระบุ" : `${Math.round(value)} มม.`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function printSheetHtml(
  lead: FactoryCutListLead,
  data: NonNullable<ReturnType<typeof factoryCutListData>>,
  basins: CutListBasin[],
  checks: boolean[],
) {
  const panelRows = data.pieces.flatMap((piece) => piece.rectangles.map((rectangle) => {
    const size = studioRectangleSize(rectangle);
    const edgeRows = SIDES.map((side) => {
      const status = piece.sideStatuses[`${rectangle.id}:${side}`] ?? "normal";
      return `<li>${SIDE_LABELS[side]}: ${studioSideStatusLabel(status)}</li>`;
    }).join("");
    return `<tr><td>${escapeHtml(piece.name)}</td><td>${escapeHtml(rectangle.label || rectangle.id)}</td><td>${mm(size.widthMm)} × ${mm(size.heightMm)}</td><td><ul>${edgeRows}</ul></td></tr>`;
  })).join("");
  const basinRows = basins.length
    ? basins.map((basin) => {
      const clearance = basin.clearances
        ? SIDES.map((side) => `${SIDE_LABELS[side]} ${mm(basin.clearances?.[side])}`).join(" · ")
        : "ระยะรอบหลุมตรวจสอบไม่ได้จากข้อมูลแบบ";
      const estimateNote = basin.estimatedDimensions ? " (ขนาดอ่างประมาณจากแคตตาล็อก)" : "";
      return `<tr><td>${escapeHtml(basin.placement.sku)}${escapeHtml(estimateNote)}</td><td>${mm(basin.cutWidthMm)} × ${mm(basin.cutHeightMm)}</td><td>${escapeHtml(basin.panel?.label || basin.panel?.id || "ไม่ระบุแผ่น")}</td><td>${escapeHtml(clearance)}</td></tr>`;
    }).join("")
    : `<tr><td colspan="4">ไม่มีข้อมูลตำแหน่งอ่างในแบบ</td></tr>`;
  const checklistRows = TECHNICIAN_CHECKLIST.map((item, index) =>
    `<li>${checks[index] ? "☑" : "☐"} ${escapeHtml(item)}</li>`,
  ).join("");
  const customerName = lead.name?.trim() || "ไม่ระบุชื่อ";
  const project = lead.project?.trim() || "ไม่ระบุโครงการ";
  const site = lead.site?.trim() || "ไม่ระบุหน้างาน";

  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ใบตัดหิน - Lead #${lead.id}</title>
<style>
  *{box-sizing:border-box}body{font:14px/1.45 Arial,sans-serif;color:#18232c;margin:24px}
  h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:18px 0 8px;border-bottom:1px solid #b6c1c7;padding-bottom:4px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:5px 18px;margin:12px 0 18px}
  table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #b6c1c7;padding:6px;text-align:left;vertical-align:top}
  th{background:#edf2f4}ul{margin:0;padding-left:16px}.checklist{list-style:none;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .notice{border:1px solid #d68a36;background:#fff7e9;padding:8px;margin-top:12px;font-size:12px}
  @page{size:A4;margin:12mm}@media print{body{margin:0}.notice{break-inside:avoid}tr{break-inside:avoid}}
</style></head><body>
<h1>ใบตัดหินสำหรับโรงงาน</h1><div>Lead #${lead.id} · พิมพ์ ${escapeHtml(new Date().toLocaleString("th-TH"))}</div>
<div class="meta"><div><b>ลูกค้า:</b> ${escapeHtml(customerName)}</div><div><b>โครงการ:</b> ${escapeHtml(project)}</div><div><b>หน้างาน:</b> ${escapeHtml(site)}</div><div><b>สีหิน:</b> ${escapeHtml(data.stoneColor)}</div><div><b>พื้นที่รวม:</b> ${data.totalAreaSqM.toFixed(3)} ตร.ม.</div><div><b>ระยะปลอดภัยรอบหลุม:</b> อย่างน้อย ${STUDIO_BASIN_SAFETY_MARGIN_MM} มม. ทุกด้าน</div></div>
<h2>แผ่นและขอบงาน</h2><table><thead><tr><th>ชิ้นงาน</th><th>แผ่น</th><th>ขนาดตัด (กว้าง × ยาว)</th><th>สถานะขอบทั้ง 4 ด้าน</th></tr></thead><tbody>${panelRows}</tbody></table>
<h2>ตำแหน่งและขนาดหลุมอ่าง</h2><table><thead><tr><th>รุ่นอ่าง</th><th>ขนาดหลุมตัด</th><th>แผ่นหิน</th><th>ระยะขอบรอบหลุม</th></tr></thead><tbody>${basinRows}</tbody></table>
<div class="notice">ตรวจยืนยันขนาดหน้างาน รุ่นอ่าง และระยะขอบก่อนตัดจริง หากข้อมูลระบุว่าเป็นค่าประมาณหรือไม่สามารถตรวจสอบได้ ต้องวัดยืนยันกับชิ้นงานจริง</div>
<h2>รายการตรวจสอบช่าง</h2><ul class="checklist">${checklistRows}</ul>
</body></html>`;
}

export function FactoryCutListModal({ lead }: { lead: FactoryCutListLead }) {
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState<boolean[]>(() => TECHNICIAN_CHECKLIST.map(() => false));
  const [printError, setPrintError] = useState("");
  const data = useMemo(() => factoryCutListData(lead.studioData), [lead.studioData]);
  const basins = useMemo(
    () => data?.placements.map((placement) => basinCutList(placement, data.pieces)) ?? [],
    [data],
  );

  if (!data) return null;

  const printSheet = () => {
    setPrintError("");
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setPrintError("เปิดใบพิมพ์ไม่ได้ กรุณาอนุญาตป๊อปอัปแล้วลองอีกครั้ง");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(printSheetHtml(lead, data, basins, checks));
    printWindow.document.close();
    printWindow.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-none"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        data-testid={`button-open-factory-cutlist-${lead.id}`}
      >
        ดูใบตัดโรงงาน
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto rounded-none" data-testid={`dialog-factory-cutlist-${lead.id}`}>
          <div className="flex flex-wrap items-start justify-between gap-3 pr-7">
            <div>
              <DialogTitle>ใบตัดหินสำหรับโรงงาน</DialogTitle>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">Lead #{lead.id} · {lead.name || "ไม่ระบุชื่อ"} · {lead.project || "ไม่ระบุโครงการ"}</p>
            </div>
            <Button type="button" size="sm" variant="outline" className="rounded-none" onClick={printSheet} data-testid={`button-print-factory-cutlist-${lead.id}`}>
              <Printer className="mr-1 h-4 w-4" /> พิมพ์ใบตัด
            </Button>
          </div>
          {printError && <p className="text-sm text-[#a24439]" role="alert">{printError}</p>}

          <section className="mt-4 grid gap-3 border border-[var(--line)] bg-[var(--paper)] p-3 sm:grid-cols-2" data-testid="factory-cutlist-summary">
            <p><strong>หน้างาน:</strong> {lead.site || "ไม่ระบุ"}</p>
            <p><strong>สีหิน:</strong> {data.stoneColor}</p>
            <p><strong>พื้นที่ตัดรวม:</strong> {data.totalAreaSqM.toFixed(3)} ตร.ม.</p>
            <p><strong>ระยะขั้นต่ำรอบหลุม:</strong> ≥ {STUDIO_BASIN_SAFETY_MARGIN_MM} มม. ทุกด้าน</p>
          </section>

          <section className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold">ขนาดแผ่นและสถานะขอบ</h3>
            {data.pieces.flatMap((piece) => piece.rectangles.map((rectangle) => {
              const size = studioRectangleSize(rectangle);
              return (
                <article key={`${piece.id}:${rectangle.id}`} className="border border-[var(--line)] p-3" data-testid={`factory-cutlist-panel-${rectangle.id}`}>
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>{piece.name} · {rectangle.label || rectangle.id}</strong>
                    <span>{mm(size.widthMm)} × {mm(size.heightMm)}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    {SIDES.map((side) => {
                      const status = piece.sideStatuses[`${rectangle.id}:${side}`] ?? "normal";
                      return (
                        <p key={side} className="border border-[var(--line)] bg-[var(--paper)] px-2 py-1">
                          <span className="text-[var(--ink-soft)]">{SIDE_LABELS[side]}:</span> {studioSideStatusLabel(status)}
                        </p>
                      );
                    })}
                  </div>
                </article>
              );
            }))}
          </section>

          <section className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold">หลุมอ่างและระยะขอบ</h3>
            {basins.length === 0 ? (
              <p className="border border-dashed border-[var(--line)] p-3 text-sm text-[var(--ink-soft)]">แบบนี้ไม่มีตำแหน่งหลุมอ่างที่บันทึกไว้</p>
            ) : basins.map((basin) => {
              const clearanceValues = basin.clearances ? SIDES.map((side) => basin.clearances?.[side] ?? -1) : [];
              const passesMargin = clearanceValues.length === 4 && clearanceValues.every((value) => value >= STUDIO_BASIN_SAFETY_MARGIN_MM);
              const verifiedClearance = Boolean(basin.clearances) && !basin.estimatedDimensions;
              return (
                <article key={basin.placement.id} className={`border p-3 ${verifiedClearance && passesMargin ? "border-[#17816d]/40 bg-[#17816d]/5" : "border-[#e5a354] bg-[#fff4e3]"}`} data-testid={`factory-cutlist-basin-${basin.placement.id}`}>
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>รุ่น {basin.placement.sku} · หลุม {mm(basin.cutWidthMm)} × {mm(basin.cutHeightMm)}</strong>
                    <span className="text-xs">{basin.panel?.label || basin.panel?.id || "ไม่ระบุแผ่น"}</span>
                  </div>
                  {basin.estimatedDimensions && (
                    <p className="mt-1 text-xs text-[#8a421d]">ขนาดหลุมประมาณจากแคตตาล็อก ต้องยืนยันรุ่นอ่างและขนาดก่อนตัด</p>
                  )}
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4" data-testid={`factory-cutlist-clearances-${basin.placement.id}`}>
                    {SIDES.map((side) => (
                      <p key={side} className="border border-[var(--line)] bg-white px-2 py-1">
                        {SIDE_LABELS[side]}: {basin.clearances ? mm(basin.clearances[side]) : "ตรวจสอบไม่ได้"}
                      </p>
                    ))}
                  </div>
                  <p className={`mt-2 text-xs font-semibold ${verifiedClearance && passesMargin ? "text-[#116654]" : "text-[#8a421d]"}`}>
                    {!basin.clearances
                      ? "ยังยืนยันระยะขอบไม่ได้ — ตรวจแผ่นและตำแหน่งก่อนตัด"
                      : basin.estimatedDimensions
                        ? passesMargin
                          ? `ค่าประมาณผ่านเกณฑ์ ≥ ${STUDIO_BASIN_SAFETY_MARGIN_MM} มม. แต่ต้องยืนยันขนาดจริงก่อนตัด`
                          : `ค่าประมาณมีระยะต่ำกว่า ${STUDIO_BASIN_SAFETY_MARGIN_MM} มม. — ห้ามตัดจนกว่าจะตรวจแบบ`
                      : passesMargin
                        ? `ผ่านเกณฑ์ ≥ ${STUDIO_BASIN_SAFETY_MARGIN_MM} มม. ทุกด้าน`
                        : `มีระยะต่ำกว่า ${STUDIO_BASIN_SAFETY_MARGIN_MM} มม. — ห้ามตัดจนกว่าจะตรวจแบบ`}
                  </p>
                </article>
              );
            })}
          </section>

          <section className="mt-4 space-y-2" data-testid="factory-cutlist-technician-checklist">
            <h3 className="text-sm font-semibold">รายการตรวจสอบช่าง</h3>
            {TECHNICIAN_CHECKLIST.map((item, index) => (
              <label key={item} className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checks[index] ?? false}
                  onChange={(event) => setChecks((current) => current.map((checked, itemIndex) => itemIndex === index ? event.target.checked : checked))}
                  className="mt-0.5 accent-[var(--brand-blue)]"
                  data-testid={`checkbox-factory-cutlist-check-${index}`}
                />
                <span>{item}</span>
              </label>
            ))}
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}