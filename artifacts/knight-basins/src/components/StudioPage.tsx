import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type DragEvent, type FormEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { customFetch, useListAdminLeads, useUpsertLead } from "@workspace/api-client-react";
import { AlertTriangle, ArrowRight, Bath, Camera, Check, ChevronDown, Copy, Download, FolderOpen, GripVertical, Image as ImageIcon, Link2, Loader2, MapPin, Minus, Palette, Pencil, Plus, Redo2, RotateCw, Save, Trash2, Undo2, Upload, X } from "lucide-react";
import { adminQuoteUrl } from "@/admin/leads-utils";
import StudioCheckoutModal from "./StudioCheckoutModal";
import {
  INSTALLATION_PRICE,
  PRODUCTS,
  STONE_COLORS,
  CUSTOMER_CONTACT_OPTIONS,
  CUSTOMER_ROLE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  filterBasinProducts,
  formatTHB,
  productBySku,
  stoneColorByName,
  type CustomerDetails,
  type BasinProduct,
  type StoneColor,
} from "@/data/catalog";
import {
  basinDimensionsForProduct,
  basinPlacementsViolatingEdgeClearance,
  basinPlacementOverlapWarnings,
  calculateBasinCoordinates,
  calculateBasinOffsets,
  applyCustomShapeToState,
  carryCustomShapeDimensions,
  clampPlacementToSheet,
  fitPlacementOrientationToSheet,
  isBasinPositionLevel,
  positionPlacementAtLevel,
  STUDIO_BASIN_POSITION_LEVELS,
  type BasinPositionLevel,
  type PlacementReanchorNotice,
  centerBasinPlacementPosition,
  compareStudioCatalog,
  createBasinPlacement,
  createStudioCatalogContext,
  distributeBasinPlacementPositions,
  disconnectedRectangleIds,
  pieceBounds,
  pieceOverlapWarnings,
  placementCrossesPanelJoint,
  placementCutSize,
  basinPlacementOrientation,
  placementFitsStudioPiece,
  placementSheetWarnings,
  placementTargetWarnings,
  rotatePlacement,
  sideStatusKey,
  setStudioEdgeStatus,
  clearStudioEdgeStatus,
  preserveCustomEdgesOnShapeChange,
  snapStudioRectanglePosition,
  studioEdgeTotals,
  studioEstimate,
  buildCustomShapePiece,
  applyStudioSizePreset,
  studioDefaultStoneCode,
  studioBasinCatalogEntries,
  resolveStudioCatalogChange,
  replaceStudioBasin,
  removeStudioBasin,
  studioPieceById,
  studioPieceEdges,
  studioPieceJoints,
  studioPieceAreaSqM,
  studioPieces,
  studioRectangleSize,
  studioSideStatuses,
  studioSideStatusLabel,
  studioSubmissionValidationMessage,
  studioSubmissionValidationMessages,
  studioStoneName,
  studioStateDimensionsValid,
  STUDIO_BASIN_SAFETY_MARGIN_MM,
  STUDIO_ADDITIONAL_RECTANGLE_LENGTH_MM,
  STUDIO_ADDITIONAL_RECTANGLE_WIDTH_MM,
  STUDIO_INITIAL_BOARD_LENGTH_MM,
  STUDIO_INITIAL_BOARD_WIDTH_MM,
  mirrorStudioLState,
  normalizePlacements,
  mirrorStudioPiece,
  reflowStudioRectangles,
  studioPieces as getStudioPieces,
  STUDIO_MAX_PIECES,
  STUDIO_MAX_RECTANGLES,
  type BasinPlacement,
  type BasinAnchor,
  type SideStatus,
  type StudioEstimate,
  type StudioCatalogComparison,
  type StudioCatalogContext,
  type StudioCatalogField,
  type StudioLocation,
  type StudioOrderMode,
  type StudioPiece,
  type StudioRectangle,
  type StudioAttachmentAlign,
  type StudioAttachmentEdge,
  type StudioState,
} from "@/data/studio-model";
import { StudioFootprint } from "./StudioFootprint";
import { BasinVisual } from "./BasinVisual";
import { StoneSlabViewer } from "./StoneSlabViewer";
import { downloadStudioDxf, downloadStudioPng, printStudioLayout, studioExportDimensionsValid, studioPrintTitle, STUDIO_PRINT_NOTE } from "@/data/studio-export";
import { clearStoredStudioDraft, createStudioDraftLink, createStudioShareLink, decodeStudioDraftRecord, readStoredShortStudioDraft, readStoredStudioDraft, readStoredStudioDrafts, removeStoredStudioDraft, upsertStoredStudioDraft, writeStoredStudioDraft, type NamedStudioDraftRecord, type StudioDraftRecord } from "@/data/studio-draft";
import { formatThaiDateTime, thaiDateInputValue } from "@/data/date-time";
import { isValidEmailAddress, isValidPhoneNumber } from "@/data/validation";
import { cleanPhoneInput, normalizeDimensionInput, sanitizeIntegerRange, sanitizeTextInput } from "@/data/input-sanitizers";
import { WorksiteAddressAutocomplete } from "./WorksiteAddressAutocomplete";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

const emptyContact: Pick<CustomerDetails, "name" | "company" | "phone" | "lineContact" | "email" | "project" | "address" | "site" | "purchasingDepartment" | "notes" | "taxName" | "taxId" | "taxBranch" | "taxAddress" | "preferredContact" | "customerRole" | "propertyType" | "condoFloor" | "expectedInstallationDate"> = {
  name: "",
  company: "",
  phone: "",
  lineContact: "",
  email: "",
  project: "",
  address: "",
  site: "",
  purchasingDepartment: "",
  notes: "",
  taxName: "",
  taxId: "",
  taxBranch: "",
  taxAddress: "",
  preferredContact: "",
  customerRole: "",
  propertyType: "",
  condoFloor: "",
  expectedInstallationDate: "",
};

const MAX_STUDIO_SUBMISSION_DIMENSION_MM = 10_000;
const MAX_STUDIO_SUBMISSION_POSITION_MM = 100_000;
const MAX_STUDIO_SUBMISSION_PRICE_THB = 1_000_000_000;
const MAX_STUDIO_SUBMISSION_RATE_THB = 1_000_000;
const MIN_BASIN_CLEARANCE_MM = STUDIO_BASIN_SAFETY_MARGIN_MM;
const STUDIO_BASIN_CLEARANCE_WARNING = "⚠️ ระยะขอบหินรอบอ่างต้องไม่น้อยกว่า 100 มม. (ปัจจุบันเหลือน้อยเกินไป) เพื่อป้องกันหินแตกระหว่างเจาะ";
const STUDIO_BASIN_JOINT_WARNING = "⚠️ ตำแหน่งอ่างวางทับแนวรอยต่อแผ่นหิน กรุณาขยับอ่างให้อยู่ภายในแผ่นเดียวกัน";
const STUDIO_BASIN_MODEL_JOINT_WARNING = "อ่างวางตรงรอยต่อแผ่น กรุณาขยับอ่างให้อยู่ภายในแผ่นเดียว";

export type StudioSubmission = {
  state: StudioState;
  estimate: StudioEstimate;
  contact: typeof emptyContact;
  worksitePlaceId: string | null;
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
  areaSqM?: number | null;
  productUnitPriceTHB?: number | null;
  laborUnitPriceTHB?: number | null;
  workQuantity?: number | null;
  workUnit?: string;
  dimensions?: string;
  cutoutDimensions?: string;
  /** Stone rows only: the photo the sales team opens from the LINE/Telegram alert. */
  imageUrl?: string;
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

const MAX_SKETCH_FILES = 3;
const MAX_SKETCH_IMAGE_EDGE = 1920;

/**
 * The photo of the active stone for the plan (job-211): its slabImageUrl (the small ~42 KB slab picture - never
 * quoteImageUrl, which is 1-2 MB), fetched only once the stone is the active one. It is handed on only after it
 * has loaded, so a slow or broken image leaves the flat tone in place instead of an empty plan.
 */
function useLoadedStoneTexture(url: string | undefined): string | undefined {
  const [loaded, setLoaded] = useState<string | undefined>(undefined);
  useEffect(() => {
    setLoaded(undefined);
    if (!url || typeof Image === "undefined") return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => { if (!cancelled) setLoaded(url); };
    image.onerror = () => { if (!cancelled) setLoaded(undefined); };
    image.src = url;
    return () => { cancelled = true; image.onload = null; image.onerror = null; };
  }, [url]);
  return loaded === url ? loaded : undefined;
}

function stoneSlabViewerImages(stone: Pick<StoneColor, "slabImageUrl" | "galleryImageUrls">): string[] {
  const slabImageUrl = stone.slabImageUrl?.trim();
  if (!slabImageUrl) return [];
  return Array.from(new Set([
    slabImageUrl,
    ...(stone.galleryImageUrls ?? []).map((url) => url.trim()).filter(Boolean),
  ]));
}

export function getRotatedSketchDimensions(width: number, height: number, maxEdge = MAX_SKETCH_IMAGE_EDGE) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError("Sketch image dimensions must be positive numbers");
  }
  if (!Number.isFinite(maxEdge) || maxEdge <= 0) {
    throw new RangeError("Maximum sketch image edge must be a positive number");
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(height * scale)),
    height: Math.max(1, Math.round(width * scale)),
  };
}

export async function rotateSketchFile(file: File): Promise<File> {
  const image = await createImageBitmap(file);
  try {
    const outputDimensions = getRotatedSketchDimensions(image.width, image.height);
    const scale = Math.min(1, MAX_SKETCH_IMAGE_EDGE / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = outputDimensions.width;
    canvas.height = outputDimensions.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable");

    const outputType = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
    if (outputType === "image/jpeg") {
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
    context.scale(scale, scale);
    context.drawImage(image, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error("Canvas could not encode the rotated sketch")),
        outputType,
        outputType === "image/jpeg" ? 0.92 : undefined,
      );
    });

    return new File([blob], file.name, {
      type: blob.type || outputType,
      lastModified: file.lastModified,
    });
  } finally {
    image.close();
  }
}

type SketchAnalysisShape = "I" | "L" | "L-left" | "L-right" | "U" | "unknown";
type SketchAnalysisCardPhase = "queued" | "uploading" | "analyzing" | "complete" | "unknown";
type SketchWorkpiecePanel = {
  panelIndex: number;
  label: string;
  lengthMm: number | null;
  depthMm: number | null;
};
type SketchWorkpieceEdge = {
  side: "top" | "front" | "left" | "right";
  status: "upstand" | "wall-flush" | "open-edge" | "closed-edge" | "joint" | "unknown";
  note: string;
};
type SketchWorkpieceCutout = {
  type: "basin" | "hob" | "other";
  description: string;
  count: number | null;
};
type SketchAnalysisWorkpiece = {
  id: string;
  label: string;
  shape: SketchAnalysisShape;
  dimensionsSummary: string;
  panels: SketchWorkpiecePanel[];
  edges: SketchWorkpieceEdge[];
  cutouts: SketchWorkpieceCutout[];
  notes: string;
};
type SketchAnalysisCardState = {
  shape: SketchAnalysisShape;
  confidence: number | null;
  notes: string;
  runAMm: number | null;
  depthMm: number | null;
  workpieceCount: number;
  workpieces: SketchAnalysisWorkpiece[];
  phase: SketchAnalysisCardPhase;
};
type SketchProcessingPhase = "uploading" | "analyzing" | "calculating" | "success" | "error";
type SketchProcessingStatus = {
  phase: SketchProcessingPhase;
  message: string;
  busy: boolean;
};

const SKETCH_ANALYSIS_FALLBACK_MESSAGE = "ไม่สามารถอ่านขนาดจากภาพได้ กรุณากรอกด้วยตนเอง";
const SKETCH_ANALYSIS_RATE_LIMIT_MESSAGE = "ส่งวิเคราะห์บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่ หรือกรอกขนาดด้วยตนเอง";

function sketchAnalysisRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function positiveSketchDimension(value: unknown): number | null {
  const number = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
      ? Number(value)
      : Number.NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseSketchShape(value: unknown): SketchAnalysisShape {
  const rawShape = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (rawShape === "I" || rawShape === "L" || rawShape === "U") return rawShape;
  if (rawShape === "L-LEFT") return "L-left";
  if (rawShape === "L-RIGHT") return "L-right";
  return "unknown";
}

function parseSketchWorkpiece(value: unknown, index: number): SketchAnalysisWorkpiece | null {
  const workpiece = sketchAnalysisRecord(value);
  if (!workpiece) return null;
  const panels = Array.isArray(workpiece.panels)
    ? workpiece.panels.flatMap((panelValue, panelIndex) => {
        const panel = sketchAnalysisRecord(panelValue);
        if (!panel) return [];
        const parsedPanelIndex = typeof panel.panelIndex === "number" && Number.isSafeInteger(panel.panelIndex) && panel.panelIndex > 0
          ? panel.panelIndex
          : panelIndex + 1;
        return [{
          panelIndex: parsedPanelIndex,
          label: typeof panel.label === "string" && panel.label.trim() ? panel.label.trim() : `แผ่น ${parsedPanelIndex}`,
          lengthMm: positiveSketchDimension(panel.lengthMm),
          depthMm: positiveSketchDimension(panel.depthMm),
        }];
      })
    : [];
  const edges = Array.isArray(workpiece.edges)
    ? workpiece.edges.flatMap((edgeValue) => {
        const edge = sketchAnalysisRecord(edgeValue);
        if (!edge || !["top", "front", "left", "right"].includes(String(edge.side))) return [];
        const status = ["upstand", "wall-flush", "open-edge", "closed-edge", "joint", "unknown"].includes(String(edge.status))
          ? edge.status as SketchWorkpieceEdge["status"]
          : "unknown";
        return [{
          side: edge.side as SketchWorkpieceEdge["side"],
          status,
          note: typeof edge.note === "string" ? edge.note.trim() : "",
        }];
      })
    : [];
  const cutouts = Array.isArray(workpiece.cutouts)
    ? workpiece.cutouts.flatMap((cutoutValue) => {
        const cutout = sketchAnalysisRecord(cutoutValue);
        if (!cutout) return [];
        const type: SketchWorkpieceCutout["type"] = cutout.type === "basin"
          ? "basin"
          : cutout.type === "hob"
            ? "hob"
            : "other";
        const count = typeof cutout.count === "number" && Number.isSafeInteger(cutout.count) && cutout.count >= 0
          ? cutout.count
          : null;
        return [{
          type,
          description: typeof cutout.description === "string" ? cutout.description.trim() : "",
          count,
        }];
      })
    : [];
  return {
    id: typeof workpiece.id === "string" && workpiece.id.trim() ? workpiece.id.trim() : `workpiece-${index + 1}`,
    label: typeof workpiece.label === "string" && workpiece.label.trim() ? workpiece.label.trim() : `ชิ้นงาน ${index + 1}`,
    shape: parseSketchShape(workpiece.shape),
    dimensionsSummary: typeof workpiece.dimensionsSummary === "string" ? workpiece.dimensionsSummary.trim() : "",
    panels,
    edges,
    cutouts,
    notes: typeof workpiece.notes === "string" ? workpiece.notes.trim() : "",
  };
}

function parseSketchAnalysis(payload: unknown): Omit<SketchAnalysisCardState, "phase"> {
  const root = sketchAnalysisRecord(payload) ?? {};
  const firstItem = Array.isArray(root.items) && root.items.length > 0
    ? sketchAnalysisRecord(root.items[0])
    : null;
  const result = firstItem
    ?? sketchAnalysisRecord(root.analysis)
    ?? sketchAnalysisRecord(root.result)
    ?? sketchAnalysisRecord(root.data)
    ?? root;
  const workpieces = Array.isArray(result.workpieces)
    ? result.workpieces.flatMap((workpiece, index) => {
        const parsedWorkpiece = parseSketchWorkpiece(workpiece, index);
        return parsedWorkpiece ? [parsedWorkpiece] : [];
      })
    : [];
  const firstWorkpiece = workpieces[0];
  const firstPanel = firstWorkpiece?.panels[0];
  const shape = parseSketchShape(result.shape ?? result.shapeType ?? firstWorkpiece?.shape);
  const rawConfidence = result.confidence;
  const confidence = typeof rawConfidence === "number" && Number.isFinite(rawConfidence)
    ? rawConfidence
    : typeof rawConfidence === "string" && rawConfidence.trim() && Number.isFinite(Number(rawConfidence))
      ? Number(rawConfidence)
      : null;
  const rawNotes = result.notes;
  const notes = typeof rawNotes === "string"
    ? rawNotes
    : Array.isArray(rawNotes)
      ? rawNotes.filter((note): note is string => typeof note === "string").join(" · ")
      : "";
  return {
    shape,
    confidence,
    notes,
    runAMm: positiveSketchDimension(result.runAMm) ?? firstPanel?.lengthMm ?? null,
    depthMm: positiveSketchDimension(result.depthMm) ?? firstPanel?.depthMm ?? null,
    workpieceCount: typeof result.workpieceCount === "number" && Number.isSafeInteger(result.workpieceCount) && result.workpieceCount >= 0
      ? Math.max(result.workpieceCount, workpieces.length)
      : workpieces.length,
    workpieces,
  };
}

function sketchShapeLabel(shape: SketchAnalysisShape): string {
  if (shape === "I") return "🟦 ทรงตรง (I)";
  if (shape === "L" || shape === "L-left") return "🟨 ทรงแอลซ้าย (L-Left)";
  if (shape === "L-right") return "🟨 ทรงแอลขวา (L-Right)";
  if (shape === "U") return "🟪 ทรงตัวยู (U)";
  return "shape: unknown · ยังไม่ทราบรูปทรง";
}

function sketchWorkpieceEdgeStatusLabel(status: SketchWorkpieceEdge["status"]): string {
  if (status === "upstand") return "ติดบัว ▲";
  if (status === "wall-flush") return "ชิดผนัง ║";
  if (status === "open-edge") return "ขอบเปิด ⊗";
  if (status === "closed-edge") return "ขอบปิด ⊞";
  if (status === "joint") return "รอยต่อแผ่น";
  return "ไม่ระบุ";
}

function sketchWorkpieceEdgeSideLabel(side: SketchWorkpieceEdge["side"]): string {
  if (side === "top") return "บน";
  if (side === "front") return "หน้า";
  return side === "left" ? "ซ้าย" : "ขวา";
}

function sketchCutoutTypeLabel(type: SketchWorkpieceCutout["type"]): string {
  if (type === "basin") return "อ่าง";
  if (type === "hob") return "เตา";
  return "จุดเจาะ";
}

type StudioPageProps = {
  mode: Extract<StudioOrderMode, "studio" | "sketch">;
  leadKey: string;
  onSubmitStudio: (submission: StudioSubmission) => Promise<void> | void;
  onContactChange?: (contact: typeof emptyContact) => void;
  contactDefaults?: Partial<typeof emptyContact>;
  initialBasinSkus?: string[];
  initialStoneColors?: string[];
  stoneColors?: ReadonlyArray<StoneColor>;
  basinProducts?: ReadonlyArray<BasinProduct>;
};

const makeRectangle = (index: number, overrides: Partial<StudioRectangle> = {}): StudioRectangle => ({
  id: `rectangle-${Date.now()}-${index}`,
  widthMm: index === 0 ? STUDIO_INITIAL_BOARD_WIDTH_MM : STUDIO_ADDITIONAL_RECTANGLE_WIDTH_MM,
  lengthMm: index === 0 ? STUDIO_INITIAL_BOARD_LENGTH_MM : STUDIO_ADDITIONAL_RECTANGLE_LENGTH_MM,
  xMm: index ? STUDIO_ADDITIONAL_RECTANGLE_WIDTH_MM : 0,
  yMm: 0,
  rotation: 0,
  label: index ? "แผ่นต่อ" : "แผ่นหลัก",
  ...overrides,
});

const makePiece = (index: number): StudioPiece => {
  const rectangle = makeRectangle(index);
  return { id: `piece-${Date.now()}-${index}`, name: `ชิ้นงาน ${index + 1}`, rectangles: [rectangle], sideStatuses: {} };
};

function isRoundBasinProduct(product?: BasinProduct) {
  const dimensions = `${product?.basinDimensions ?? ""} ${product?.dimensions ?? ""} ${product?.category ?? ""}`;
  return /(?:[Øø]|\bD\s*\d|round|circle|กลม)/i.test(dimensions);
}

function createStudioBasinPlacement(
  product: BasinProduct,
  index: number,
  pieceId: string,
  sheetId?: string,
  sheet?: StudioRectangle,
): BasinPlacement {
  const placement = createBasinPlacement(product, index, pieceId, sheetId ?? sheet?.id);
  // A diameter followed by bowl depth describes a circular plan-view cutout;
  // use the diameter on both axes so its canvas footprint remains circular.
  const sized = isRoundBasinProduct(product) && placement.widthMm !== null
    ? { ...placement, depthMm: placement.widthMm }
    : placement;
  // A cut-out deeper than wide (KF003 350 x 500) starts turned 90 degrees on a sheet too shallow to keep
  // STUDIO_BASIN_SAFETY_MARGIN_MM at the back and front otherwise. Callers that know the sheet pass it.
  return sheet ? fitPlacementOrientationToSheet(sized, sheet, STUDIO_BASIN_SAFETY_MARGIN_MM) : sized;
}

function addQueryBasinToStudioState(state: StudioState, product: BasinProduct): StudioState {
  const basinSkus = state.basinSkus.includes(product.sku)
    ? state.basinSkus
    : [...state.basinSkus, product.sku];
  const pieces = getStudioPieces(state);
  const piece = pieces[0];
  const sheet = piece?.rectangles[0];
  const alreadyPlaced = state.basinPlacements.some((placement) => placement.sku === product.sku);
  if (alreadyPlaced || !piece || !sheet) {
    return basinSkus === state.basinSkus ? state : { ...state, basinSkus };
  }

  const placement = createStudioBasinPlacement(product, state.basinPlacements.length, piece.id, sheet.id, sheet);
  const sheetSize = studioRectangleSize(sheet);
  const cutSize = placementCutSize(placement);
  const xMm = sheet.xMm + Math.max(0, (sheetSize.widthMm - (cutSize.widthMm ?? 0)) / 2);
  const yMm = sheet.yMm + Math.max(0, (sheetSize.heightMm - (cutSize.heightMm ?? 0)) / 2);
  return {
    ...state,
    basinSkus,
    basinPlacements: [...state.basinPlacements, placementAtCoordinates(placement, piece, sheet, xMm, yMm)],
  };
}

const initialState: StudioState = {
  mode: "studio",
  shape: "I",
  dimensions: { depthMm: STUDIO_INITIAL_BOARD_LENGTH_MM, runAMm: STUDIO_INITIAL_BOARD_WIDTH_MM, runBMm: 0, runCMm: 0 },
  pieces: [makePiece(0)],
  activePieceId: "",
  backsplash: { enabled: false, heightMm: 120 },
  upstandHeightMm: 120,
  openEdgePricePerMTHB: null,
  discountTHB: 0,
  location: "bangkok-metro",
  vat: false,
  quoteFormat: "US",
  stoneColors: [],
  activeStone: "",
  stoneSelectionSource: "default",
  basinSkus: [],
  basinPlacements: [],
};

function createInitialStudioState(
  mode: Extract<StudioOrderMode, "studio" | "sketch">,
  initialBasinSkus: string[] = [],
  initialStoneColors: string[] = [],
  basinProducts: ReadonlyArray<BasinProduct> = PRODUCTS,
  availableStoneColors: ReadonlyArray<StoneColor> = STONE_COLORS,
  requestedBasinSku?: string,
): StudioState {
  const piece = makePiece(0);
  const requestedBasinProduct = requestedBasinSku
    ? basinProducts.find((product) => product.sku.toLowerCase() === requestedBasinSku.toLowerCase())
    : undefined;
  const basinSkus = [...new Set([...initialBasinSkus, ...(requestedBasinProduct ? [requestedBasinProduct.sku] : [])])]
    .filter((sku) => basinProducts.some((product) => product.sku === sku));
  const selectedBasinSkus = basinSkus;
  const stoneColors = [...new Set(initialStoneColors)]
    .map((code) => stoneColorByName(code, availableStoneColors).code);
  const selectedStoneColors = stoneColors.length
    ? stoneColors
    : [studioDefaultStoneCode(selectedBasinSkus, basinProducts, availableStoneColors)];
  const initialStudioState: StudioState = {
    ...initialState,
    mode,
    dimensions: { ...initialState.dimensions },
    pieces: [piece],
    activePieceId: piece.id,
    backsplash: { ...initialState.backsplash },
    stoneColors: selectedStoneColors,
    activeStone: selectedStoneColors[0] ?? "",
    stoneSelectionSource: stoneColors.length ? "user" : "default",
    basinSkus: selectedBasinSkus,
    basinPlacements: [],
  };
  return mode === "studio" && requestedBasinProduct
    ? addQueryBasinToStudioState(initialStudioState, requestedBasinProduct)
    : initialStudioState;
}

function readLinkedDraft() {
  if (typeof window === "undefined") return { token: "", state: null as StudioState | null };
  const token = new URLSearchParams(window.location.search).get("draft") ?? "";
  if (!token) return { token, state: null as StudioState | null, catalogContext: undefined as StudioCatalogContext | undefined };
  const linked = decodeStudioDraftRecord(token);
  const shortDraft = linked ? null : readStoredShortStudioDraft(token);
  return {
    token,
    state: linked?.state ?? shortDraft?.state ?? null,
    catalogContext: linked?.catalogContext ?? shortDraft?.catalogContext,
  };
}

function studioDataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

const STUDIO_API_DRAFT_KEY_PATTERN = /^dft_[a-f0-9]{24}$/i;
const STUDIO_SIDE_STATUSES: SideStatus[] = ["upstand", "open-edge", "wall-flush", "wall-flush+upstand", "closed-edge", "normal"];

type StudioDraftApiPayload = {
  shape: string;
  dimensions: StudioState["dimensions"];
  stoneColor?: string;
  basinSku?: string;
  basinPlacements: BasinPlacement[];
  edges: {
    activePieceId?: string;
    pieces: StudioPiece[];
    sideStatusesByPiece: Record<string, Record<string, SideStatus>>;
  };
};

type StudioDraftApiResponse = {
  draftKey: string;
  resumeUrl: string;
  expiresAt?: string;
};

function isStudioApiDraftKey(value: string): boolean {
  return STUDIO_API_DRAFT_KEY_PATTERN.test(value);
}

function isStudioSideStatus(value: unknown): value is SideStatus {
  return typeof value === "string" && STUDIO_SIDE_STATUSES.includes(value as SideStatus);
}

function studioDraftDimensions(state: StudioState, pieces: StudioPiece[]): StudioState["dimensions"] {
  const firstPiece = pieces[0];
  const firstRectangle = firstPiece?.rectangles[0];
  const secondRectangle = firstPiece?.rectangles[1];
  const thirdRectangle = firstPiece?.rectangles[2];
  const depthMm = state.dimensions.depthMm > 0 ? state.dimensions.depthMm : firstRectangle?.lengthMm ?? 600;
  return {
    depthMm,
    runAMm: state.dimensions.runAMm > 0 ? state.dimensions.runAMm : firstRectangle?.widthMm ?? 1500,
    runBMm: state.dimensions.runBMm > 0 ? state.dimensions.runBMm : secondRectangle ? secondRectangle.lengthMm + depthMm : 0,
    runCMm: state.dimensions.runCMm > 0 ? state.dimensions.runCMm : thirdRectangle ? thirdRectangle.lengthMm + depthMm : 0,
  };
}

function createStudioDraftPayload(state: StudioState): StudioDraftApiPayload {
  const pieces = getStudioPieces(state);
  const basinSku = state.basinPlacements[0]?.sku ?? state.basinSkus[0];
  return {
    shape: studioPresetForShare(state, pieces[0]),
    dimensions: studioDraftDimensions(state, pieces),
    ...(state.activeStone ? { stoneColor: state.activeStone } : {}),
    ...(basinSku ? { basinSku } : {}),
    basinPlacements: state.basinPlacements.map((placement) => ({ ...placement })),
    edges: {
      activePieceId: state.activePieceId ?? pieces[0]?.id,
      pieces: pieces.map((piece) => ({
        ...piece,
        rectangles: piece.rectangles.map((rectangle) => ({ ...rectangle })),
        sideStatuses: { ...piece.sideStatuses },
      })),
      sideStatusesByPiece: Object.fromEntries(pieces.map((piece) => [piece.id, { ...piece.sideStatuses }])),
    },
  };
}

function studioDraftPiecesFromEdges(edges: Record<string, unknown>): StudioPiece[] | null {
  if (!Array.isArray(edges.pieces) || !edges.pieces.length) return null;
  const pieces: StudioPiece[] = [];
  for (const value of edges.pieces) {
    const candidate = studioDataRecord(value);
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.name !== "string" ||
      !Array.isArray(candidate.rectangles) ||
      candidate.rectangles.length === 0 ||
      candidate.rectangles.some((rectangle) => {
        const item = studioDataRecord(rectangle);
        return typeof item.id !== "string" ||
          typeof item.widthMm !== "number" ||
          typeof item.lengthMm !== "number" ||
          typeof item.xMm !== "number" ||
          typeof item.yMm !== "number" ||
          (item.rotation !== 0 && item.rotation !== 90);
      }) ||
      !candidate.sideStatuses ||
      typeof candidate.sideStatuses !== "object" ||
      Array.isArray(candidate.sideStatuses)
    ) return null;
    const sideStatuses = Object.fromEntries(
      Object.entries(studioDataRecord(candidate.sideStatuses)).filter(([, status]) => isStudioSideStatus(status)),
    ) as Record<string, SideStatus>;
    pieces.push({
      ...candidate,
      rectangles: candidate.rectangles as StudioPiece["rectangles"],
      sideStatuses,
    } as StudioPiece);
  }
  return pieces;
}

function restoreStudioDraftState(
  current: StudioState,
  value: unknown,
  basinProducts: ReadonlyArray<BasinProduct>,
  availableStoneColors: ReadonlyArray<StoneColor>,
): StudioState {
  const response = studioDataRecord(value);
  const draft = studioDataRecord(response.draft ?? response.data ?? value);
  const dimensionsRecord = studioDataRecord(draft.dimensions);
  const positiveDimension = (key: keyof StudioState["dimensions"], fallback: number) => {
    const candidate = dimensionsRecord[key];
    return typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0
      ? Math.round(candidate)
      : fallback;
  };
  const preset = studioPresetFromQuery(typeof draft.shape === "string" ? draft.shape : null);
  const defaults = preset ? presetLegDefaults(preset) : [];
  const dimensions = {
    depthMm: positiveDimension("depthMm", current.dimensions.depthMm),
    runAMm: positiveDimension("runAMm", current.dimensions.runAMm),
    runBMm: positiveDimension("runBMm", defaults[1] ?? current.dimensions.runBMm),
    runCMm: positiveDimension("runCMm", defaults[2] ?? current.dimensions.runCMm),
  };
  const placements = Array.isArray(draft.basinPlacements)
    ? draft.basinPlacements.filter((placement): placement is BasinPlacement => {
        const item = studioDataRecord(placement);
        return typeof item.id === "string" &&
          typeof item.sku === "string" &&
          typeof item.xMm === "number" &&
          typeof item.yMm === "number";
      })
    : [];
  const edges = studioDataRecord(draft.edges);
  const savedPieces = studioDraftPiecesFromEdges(edges);
  const existingPieces = getStudioPieces(current);
  const shape = preset === "u" ? "U" : preset === "i" ? "I" : preset ? "L" : current.shape;
  let pieces = savedPieces;
  if (!pieces && preset) {
    const savedPieceId = placements.find((placement) => placement.pieceId)?.pieceId;
    const pieceId = savedPieceId ?? existingPieces[0]?.id ?? WIZARD_PIECE_ID;
    const extension = (runMm: number, fallbackOverallMm: number) =>
      Math.max(1, (runMm > 0 ? runMm : fallbackOverallMm) - dimensions.depthMm);
    const legs = preset === "i"
      ? [dimensions.runAMm]
      : preset === "u"
        ? [dimensions.runAMm, extension(dimensions.runBMm, defaults[1] ?? dimensions.depthMm + 600), extension(dimensions.runCMm, defaults[2] ?? dimensions.depthMm + 600)]
        : [dimensions.runAMm, extension(dimensions.runBMm, defaults[1] ?? dimensions.depthMm + 600)];
    pieces = [buildWizardPiece(pieceId, preset, legs, dimensions.depthMm)];
  }

  if (pieces) {
    const sideStatusesByPiece = studioDataRecord(edges.sideStatusesByPiece);
    const legacyStatuses = studioDataRecord(edges.sideStatuses ?? edges);
    pieces = pieces.map((piece, index) => {
      const matchingStatuses = studioDataRecord(
        sideStatusesByPiece[piece.id] ?? Object.values(sideStatusesByPiece)[index] ?? legacyStatuses,
      );
      const sideStatuses = { ...piece.sideStatuses };
      for (const rectangle of piece.rectangles) {
        for (const side of ["top", "right", "bottom", "left"] as const) {
          const key = `${rectangle.id}:${side}`;
          const status = matchingStatuses[key] ?? matchingStatuses[side];
          if (isStudioSideStatus(status)) sideStatuses[key] = status;
        }
      }
      return { ...piece, sideStatuses };
    });
  }

  const edgeActivePieceId = typeof edges.activePieceId === "string" ? edges.activePieceId : undefined;
  const activePieceId = pieces?.some((piece) => piece.id === edgeActivePieceId)
    ? edgeActivePieceId
    : pieces?.[0]?.id ?? current.activePieceId;
  const savedStone = typeof draft.stoneColor === "string" ? draft.stoneColor.trim() : "";
  const stoneColor = savedStone
    ? availableStoneColors.find((stone) => stone.code.toLowerCase() === savedStone.toLowerCase())?.code ?? savedStone
    : current.activeStone;
  const savedBasinSku = typeof draft.basinSku === "string" ? draft.basinSku.trim() : "";
  const basinSkus = [...new Set([savedBasinSku, ...placements.map((placement) => placement.sku)].filter(Boolean))];
  const next: StudioState = {
    ...current,
    shape,
    dimensions,
    ...(pieces ? { pieces, activePieceId } : {}),
    stoneColors: stoneColor ? [stoneColor] : current.stoneColors,
    activeStone: stoneColor,
    stoneSelectionSource: savedStone ? "user" : current.stoneSelectionSource,
    basinSkus,
    basinPlacements: placements,
  };
  return normalizeStudioState(next, basinProducts, availableStoneColors);
}

function linkedLeadStudioState(value: unknown): StudioState | null {
  const studioData = studioDataRecord(value);
  const nestedState = studioDataRecord(studioData.state);
  const candidate = Object.keys(nestedState).length ? nestedState : studioData;
  const dimensions = studioDataRecord(candidate.dimensions);
  if (!Object.keys(dimensions).length || !Array.isArray(candidate.pieces)) return null;
  return candidate as unknown as StudioState;
}

function linkedLeadSketchUrls(lead: { sketchUrl?: string | null; studioData?: unknown } | null | undefined): string[] {
  if (!lead) return [];
  const studioData = studioDataRecord(lead.studioData);
  const urls = Array.isArray(studioData.sketchUrls)
    ? studioData.sketchUrls.filter((url): url is string => typeof url === "string" && url.trim().length > 0)
    : [];
  return urls.length ? urls : lead.sketchUrl ? [lead.sketchUrl] : [];
}

function formatDraftTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "ไม่ทราบเวลา";
  return formatThaiDateTime(date);
}

function defaultNamedDraft() {
  return `แบบร่าง ${formatThaiDateTime()}`;
}

function numericValue(value: string, fallback = 0) {
  if (value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

type StudioPreset = "i" | "l-left" | "l-right" | "u";

const WIZARD_PIECE_ID = "wizard-piece-main";

const studioPresetLabels: Record<StudioPreset, string> = {
  i: "📐 ทรงตรง (I)",
  "l-left": "📐 ทรงฉาก L ซ้าย",
  "l-right": "📐 ทรงฉาก L ขวา",
  u: "📐 ทรงตัวยู (U)",
};

// Common real-world counter depths/run lengths, offered as one-tap fills next
// to the wizard's numeric inputs so typing exact mm values isn't the only way
// in — especially fiddly on a phone keyboard.
const STUDIO_PRESET_DEFAULT_DEPTH_MM = 600;

function presetLegDefaults(preset: StudioPreset): number[] {
  if (preset === "i") return [1500];
  if (preset === "u") return [1500, 1200, 1200];
  return [1500, 1200];
}

/** Builds the wizard's single piece from a shape preset + per-leg lengths + shared depth.
 * Geometry matches the original fixed-size preset buttons: the back run sits at
 * the top, side legs hang down starting right where the back run ends (no overlap).
 * Takes the target piece's id explicitly so callers can keep the id the piece already
 * had (preserving any basin placements already tied to it) instead of resetting it. */
function buildWizardPiece(pieceId: string, preset: StudioPreset, legs: number[], depthMm: number): StudioPiece {
  const depth = Math.max(1, depthMm);
  const runA = Math.max(1, legs[0] ?? 1500);
  let rectangles: StudioRectangle[];
  if (preset === "i") {
    rectangles = [{ id: "wizard-leg-0", widthMm: runA, lengthMm: depth, xMm: 0, yMm: 0, rotation: 0, label: "แผ่นที่ 1" }];
  } else if (preset === "u") {
    const runB = Math.max(1, legs[1] ?? 1200);
    const runC = Math.max(1, legs[2] ?? 1200);
    rectangles = [
      { id: "wizard-leg-0", widthMm: runA, lengthMm: depth, xMm: 0, yMm: 0, rotation: 0, label: "แผ่นที่ 1" },
      { id: "wizard-leg-1", widthMm: depth, lengthMm: runB, xMm: 0, yMm: depth, rotation: 0, label: "แผ่นที่ 2" },
      { id: "wizard-leg-2", widthMm: depth, lengthMm: runC, xMm: Math.max(0, runA - depth), yMm: depth, rotation: 0, label: "แผ่นที่ 3" },
    ];
  } else {
    const runB = Math.max(1, legs[1] ?? 1200);
    rectangles = [
      { id: "wizard-leg-0", widthMm: runA, lengthMm: depth, xMm: 0, yMm: 0, rotation: 0, label: "แผ่นที่ 1" },
      { id: "wizard-leg-1", widthMm: depth, lengthMm: runB, xMm: 0, yMm: depth, rotation: 0, label: "แผ่นที่ 2" },
    ];
  }
  const piece: StudioPiece = { id: pieceId, name: "ชิ้นงานหลัก", rectangles, sideStatuses: {} };
  return preset === "l-right" ? mirrorStudioPiece(piece) : piece;
}

function applySimpleShapeEdgeDefaults(previousPiece: StudioPiece, nextPiece: StudioPiece): StudioPiece {
  const preservedPiece = preserveCustomEdgesOnShapeChange(previousPiece, nextPiece);
  if (previousPiece.hasCustomEdges) return preservedPiece;

  const previousEdges = studioPieceEdges(previousPiece);
  const previousEdgesAreNormal = previousEdges.length > 0 && previousEdges.every((edge) => edge.status === "normal");
  const previousEdgesAreAutoMapped = previousEdges.length > 0 && previousEdges.every((edge) => {
    const expectedStatus: SideStatus = edge.exposedLengthMm <= 0
      ? "normal"
      : edge.side === "top" ? "upstand" : "open-edge";
    return edge.status === expectedStatus;
  });

  if (!previousEdgesAreNormal && !previousEdgesAreAutoMapped) {
    const sideStatuses = { ...preservedPiece.sideStatuses };
    previousPiece.rectangles.forEach((previousRectangle, index) => {
      const nextRectangle = preservedPiece.rectangles[index];
      if (!nextRectangle) return;
      studioSideStatuses(previousPiece, previousRectangle.id).forEach(({ side, status }) => {
        if (status !== "normal") sideStatuses[sideStatusKey(nextRectangle.id, side)] = status;
      });
    });
    return { ...preservedPiece, sideStatuses };
  }

  const sideStatuses = { ...preservedPiece.sideStatuses };
  studioPieceEdges(preservedPiece).forEach((edge) => {
    if (edge.exposedLengthMm <= 0) return;
    sideStatuses[edge.key] = edge.side === "top" ? "upstand" : "open-edge";
  });
  return { ...preservedPiece, sideStatuses };
}

function studioPresetFromQuery(value: string | null): StudioPreset | null {
  switch (value?.trim().toLowerCase()) {
    case "i": return "i";
    case "l":
    case "l-left": return "l-left";
    case "l-right": return "l-right";
    case "u": return "u";
    default: return null;
  }
}

function studioPresetForShare(state: StudioState, piece = getStudioPieces(state)[0]): StudioPreset {
  if (piece?.preset) return piece.preset;
  if (piece?.rectangles.length === 3) return "u";
  if (piece?.rectangles.length === 2) {
    const secondRectangle = piece.rectangles.find((rectangle) => rectangle.id === "wizard-leg-1") ?? piece.rectangles[1];
    return (secondRectangle?.xMm ?? 0) > 0 ? "l-right" : "l-left";
  }
  return state.shape === "U" ? "u" : state.shape === "L" ? "l-left" : "i";
}

function applyStudioShareParameters(
  state: StudioState,
  requestedPreset: StudioPreset | null,
  requestedWidthMm: number | null,
  requestedDepthMm: number | null = null,
): StudioState {
  if (!requestedPreset && requestedWidthMm === null && requestedDepthMm === null) return state;
  const firstPiece = getStudioPieces(state)[0];
  const firstRectangle = firstPiece?.rectangles[0];
  if (!firstPiece || !firstRectangle) return state;

  const widthMm = requestedWidthMm ?? firstRectangle.widthMm;
  const isFreshBoard = firstPiece.rectangles.length === 1 &&
    firstRectangle.widthMm === STUDIO_INITIAL_BOARD_WIDTH_MM &&
    firstRectangle.lengthMm === STUDIO_INITIAL_BOARD_LENGTH_MM;
  const depthMm = requestedDepthMm ?? Math.max(
    1,
    requestedPreset && isFreshBoard ? STUDIO_PRESET_DEFAULT_DEPTH_MM : firstRectangle.lengthMm,
  );
  if (!requestedPreset) {
    const resizedState = applyStudioSizePreset(state, widthMm, depthMm);
    return {
      ...resizedState,
      dimensions: { ...resizedState.dimensions, runAMm: widthMm, depthMm },
    };
  }

  const defaultLegs = presetLegDefaults(requestedPreset);
  const legs = defaultLegs.map((length, index) => index === 0 ? widthMm : Math.max(1, length - depthMm));
  const nextPiece = applySimpleShapeEdgeDefaults(
    firstPiece,
    {
      ...buildWizardPiece(firstPiece.id, requestedPreset, legs, depthMm),
      name: firstPiece.name,
      preset: requestedPreset,
    },
  );
  return {
    ...state,
    shape: requestedPreset === "i" ? "I" : requestedPreset === "u" ? "U" : "L",
    dimensions: { ...state.dimensions, runAMm: widthMm, depthMm },
    pieces: getStudioPieces(state).map((piece) => piece.id === firstPiece.id ? nextPiece : piece),
    activePieceId: firstPiece.id,
  };
}

function StudioShapeWizard({
  state,
  setState,
  targetPieceId,
  simpleMode = false,
  draftPreset,
  onDraftPresetChange,
}: {
  state: StudioState;
  setState: Dispatch<SetStateAction<StudioState>>;
  targetPieceId?: string;
  simpleMode?: boolean;
  draftPreset?: StudioPreset;
  onDraftPresetChange?: (preset: StudioPreset) => void;
}) {
  const pieces = getStudioPieces(state);
  const targetPiece = pieces.find((piece) => piece.id === targetPieceId) ?? pieces[0];

  const detectPreset = (p: StudioPiece): StudioPreset => {
    if (p.preset) return p.preset;
    if (p.rectangles.length === 3) return "u";
    if (p.rectangles.length === 2) {
      const leg1 = p.rectangles.find((r) => r.id === "wizard-leg-1") ?? p.rectangles[1];
      return (leg1?.xMm ?? 0) > 0 ? "l-right" : "l-left";
    }
    return "i";
  };

  const [preset, setPreset] = useState<StudioPreset>(() => detectPreset(targetPiece));
  const selectedPreset = onDraftPresetChange ? (draftPreset ?? preset) : preset;

  useEffect(() => {
    setPreset(detectPreset(targetPiece));
  }, [targetPiece.id, targetPiece.preset, targetPiece.rectangles]);

  const applyGeometry = (nextPreset: StudioPreset, nextLegs: number[], nextDepth: number, resetBasins: boolean) => {
    setState((current) => {
      const existingPieces = getStudioPieces(current);
      const pieceId = targetPiece.id;
      const currentPiece = existingPieces.find((item) => item.id === pieceId) ?? targetPiece;
      let piece = buildWizardPiece(pieceId, nextPreset, nextLegs, nextDepth);
      if (simpleMode) piece = applySimpleShapeEdgeDefaults(currentPiece, piece);
      piece.name = targetPiece.name;
      piece.preset = nextPreset;
      return {
        ...current,
        shape: nextPreset === "i" ? "I" : nextPreset === "u" ? "U" : "L",
        pieces: existingPieces.map((p) => (p.id === pieceId ? piece : p)),
        activePieceId: piece.id,
        basinPlacements: resetBasins
          ? current.basinPlacements.filter((placement) => (placement.pieceId ?? pieceId) !== pieceId)
          : current.basinPlacements,
      };
    });
  };

  const selectPreset = (next: StudioPreset) => {
    if (onDraftPresetChange) {
      setPreset(next);
      onDraftPresetChange(next);
      return;
    }
    const defaults = presetLegDefaults(next);
    const firstRectangle = targetPiece?.rectangles[0];
    const isFreshBoard =
      targetPiece?.rectangles.length === 1 &&
      firstRectangle?.widthMm === STUDIO_INITIAL_BOARD_WIDTH_MM &&
      firstRectangle?.lengthMm === STUDIO_INITIAL_BOARD_LENGTH_MM;
    const nextDepth = isFreshBoard ? STUDIO_PRESET_DEFAULT_DEPTH_MM : Math.min(600, firstRectangle?.lengthMm || 600);
    const shapeLegs = simpleMode
      ? defaults.map((length, index) => index === 0 ? length : Math.max(1, length - nextDepth))
      : defaults;
    setPreset(next);
    applyGeometry(next, shapeLegs, nextDepth, true);
  };

  return (
    <div className="studio-shape-wizard">
      <div className="studio-preset-actions">
        {(["i", "l-left", "l-right", "u"] as StudioPreset[]).map((option) => (
          <button
            type="button"
            key={option}
            className={`button button--outline studio-preset-button ${selectedPreset === option ? "is-active" : ""}`}
            onClick={() => selectPreset(option)}
            aria-pressed={selectedPreset === option}
            data-testid={`${simpleMode ? "button-studio-shape" : "button-studio-preset"}-${option}`}
          >
            <span>{studioPresetLabels[option]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

type StudioCustomShapePanelDraft = {
  lengthMm: string;
  depthMm: string;
  edges: Record<"top" | "right" | "bottom" | "left", SideStatus>;
};

type StudioCustomShapePanelData = {
  widthMm: number;
  depthMm: number;
  edges: Record<"top" | "right" | "bottom" | "left", SideStatus>;
};

const STUDIO_CUSTOM_SHAPE_EDGE_SIDES = [
  { side: "top", testSide: "top", label: "ด้านชนผนัง" },
  { side: "bottom", testSide: "front", label: "ด้านหน้า (คนยืน)" },
  { side: "left", testSide: "left", label: "ด้านข้างซ้าย" },
  { side: "right", testSide: "right", label: "ด้านข้างขวา" },
] as const;

const STUDIO_CUSTOM_SHAPE_EDGE_OPTIONS: ReadonlyArray<{ value: SideStatus; label: string }> = [
  { value: "upstand", label: "ติดบัว ▲" },
  { value: "wall-flush", label: "ชิดผนัง ║" },
  { value: "wall-flush+upstand", label: "ชิดผนัง + ติดบัว ║▲" },
  { value: "open-edge", label: "ขอบเปิด ⊗" },
  { value: "closed-edge", label: "ขอบปิด ⊞" },
];

function parseBoundedIntegerInput(value: string, min: number, max: number, step = 1): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  if (!Number.isSafeInteger(step) || step <= 0) return null;
  const parsed = sanitizeIntegerRange(Number(trimmed), min, max);
  return parsed !== null && (parsed - min) % step === 0 ? parsed : null;
}

function sanitizeStudioContactForPayload(contact: typeof emptyContact): typeof emptyContact {
  const cleanText = (value: string) => sanitizeTextInput(value).trim();
  return {
    ...contact,
    name: cleanText(contact.name),
    company: cleanText(contact.company),
    phone: cleanPhoneInput(contact.phone),
    lineContact: cleanText(contact.lineContact),
    email: cleanText(contact.email),
    project: cleanText(contact.project),
    address: cleanText(contact.address),
    site: cleanText(contact.site),
    purchasingDepartment: cleanText(contact.purchasingDepartment),
    notes: cleanText(contact.notes),
    taxName: cleanText(contact.taxName),
    taxId: contact.taxId.replace(/\D/g, "").slice(0, 13),
    taxBranch: cleanText(contact.taxBranch),
    taxAddress: cleanText(contact.taxAddress),
    preferredContact: CUSTOMER_CONTACT_OPTIONS.find((option) => option.value === contact.preferredContact)?.value ?? "",
    customerRole: CUSTOMER_ROLE_OPTIONS.find((option) => option.value === contact.customerRole)?.value ?? "",
    propertyType: PROPERTY_TYPE_OPTIONS.find((option) => option.value === contact.propertyType)?.value ?? "",
    condoFloor: cleanText(contact.condoFloor),
    expectedInstallationDate: cleanText(contact.expectedInstallationDate),
  };
}

function buildStudioNotificationSnapshot(
  state: StudioState,
  estimate: StudioEstimate,
  basinProducts: ReadonlyArray<BasinProduct>,
  stoneColors: ReadonlyArray<StoneColor>,
): StudioNotificationSnapshot {
  const basinCounts = new Map<string, number>();
  state.basinPlacements.forEach((placement) => basinCounts.set(placement.sku, (basinCounts.get(placement.sku) ?? 0) + 1));
  const items: StudioNotificationItem[] = Array.from(basinCounts.entries()).flatMap(([sku, quantity]) => {
    const product = basinProducts.find((item) => item.sku === sku);
    return product ? [{
      kind: "basin" as const,
      code: product.sku,
      description: product.colorName,
      quantity,
      unit: "ชุด",
      unitPriceTHB: product.priceTHB,
      totalTHB: Math.round(product.priceTHB * quantity),
      workQuantity: quantity,
      workUnit: "ชุด",
      dimensions: product.dimensions,
      cutoutDimensions: product.basinDimensions,
    }] : [];
  });
  const activeStone = stoneColorByName(state.activeStone, stoneColors);
  const stoneMaterialPrice = activeStone.sheetPriceTHB;
  const stoneLaborPrice = estimate.stoneUnitPriceTHB !== null && stoneMaterialPrice !== null
    ? Math.max(0, estimate.stoneUnitPriceTHB - stoneMaterialPrice)
    : null;
  if (estimate.stoneUnitPriceTHB !== null && estimate.stoneAreaSqM > 0) items.push({
    kind: "stone",
    code: activeStone.code,
    description: activeStone.name,
    quantity: estimate.counterAreaSqM,
    unit: "ตร.ม.",
    unitPriceTHB: estimate.stoneUnitPriceTHB,
    totalTHB: Math.max(0, estimate.stoneTotalTHB - estimate.upstandTotalTHB),
    areaSqM: estimate.counterAreaSqM,
    productUnitPriceTHB: stoneMaterialPrice,
    laborUnitPriceTHB: stoneLaborPrice,
    workQuantity: estimate.counterAreaSqM,
    workUnit: "ตร.ม.",
  });
  items.push({
    kind: "service",
    code: "WORKPIECES",
    description: `${estimate.pieceCount} ชิ้นงาน · ${estimate.rectangleCount} แผ่น`,
    quantity: estimate.pieceCount,
    unit: "ชิ้นงาน",
    unitPriceTHB: 0,
    totalTHB: 0,
    workQuantity: estimate.pieceCount,
    workUnit: "ชิ้นงาน",
  });
  if (estimate.upstandLengthM > 0) items.push({
    kind: "service",
    code: "UPSTAND",
    description: `บัวยาว ${estimate.upstandLengthM.toFixed(2)} ม. · สูง ${state.upstandHeightMm ?? "ไม่ระบุ"} มม.`,
    quantity: estimate.upstandLengthM,
    unit: "ม.",
    unitPriceTHB: estimate.upstandLengthM ? estimate.upstandTotalTHB / estimate.upstandLengthM : 0,
    totalTHB: estimate.upstandTotalTHB,
    workQuantity: estimate.upstandLengthM,
    workUnit: "ม.",
  });
  if (estimate.openEdgeLengthM > 0) items.push({
    kind: "service",
    code: "OPEN_EDGE",
    description: `ขอบเปิดยาว ${estimate.openEdgeLengthM.toFixed(2)} ม.`,
    quantity: estimate.openEdgeLengthM,
    unit: "ม.",
    unitPriceTHB: estimate.openEdgeUnitPriceTHB ?? 0,
    totalTHB: estimate.openEdgeTotalTHB,
    workQuantity: estimate.openEdgeLengthM,
    workUnit: "ม.",
  });
  if (estimate.installationChargeTHB > 0) items.push({
    kind: "service",
    code: "INSTALL",
    description: "ค่าติดตั้ง / ค่าแรงต่อชุด",
    quantity: state.basinPlacements.length,
    unit: "ชุด",
    unitPriceTHB: state.basinPlacements.length ? estimate.installationChargeTHB / state.basinPlacements.length : 0,
    totalTHB: estimate.installationChargeTHB,
    laborUnitPriceTHB: state.basinPlacements.length ? estimate.installationChargeTHB / state.basinPlacements.length : 0,
    workQuantity: state.basinPlacements.length,
    workUnit: "ชุด",
  });
  if (estimate.smallJobFeeTHB > 0) items.push({
    kind: "service",
    code: "SMALL-JOB",
    description: "ค่าดำเนินการงานพื้นที่เล็ก",
    quantity: 1,
    unit: "งาน",
    unitPriceTHB: estimate.smallJobFeeTHB,
    totalTHB: estimate.smallJobFeeTHB,
    workQuantity: 1,
    workUnit: "งาน",
  });
  return {
    items,
    grossSubtotal: estimate.grossSubtotalTHB,
    discountAmount: estimate.grossSubtotalTHB - estimate.subtotalTHB,
    subtotal: estimate.subtotalTHB,
    vatAmount: estimate.vatAmountTHB,
    total: estimate.totalTHB,
    vat: state.vat,
  };
}

function isSafeStudioSubmissionAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_STUDIO_SUBMISSION_PRICE_THB;
}

function sanitizeStudioSubmissionRate(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_STUDIO_SUBMISSION_RATE_THB) return null;
  const roundedRate = Math.round(value * 100) / 100;
  return Math.abs(value - roundedRate) < 1e-9 ? roundedRate : null;
}

function prepareStudioSubmissionPayload(state: StudioState, basinProducts: ReadonlyArray<BasinProduct>) {
  try {
    if (!state || typeof state !== "object" || !state.dimensions || !state.backsplash ||
      !Array.isArray(state.basinSkus) || !Array.isArray(state.basinPlacements) ||
      !Array.isArray(state.stoneColors) ||
      !["quick-purchase", "studio", "sketch"].includes(state.mode) ||
      !["I", "L", "U"].includes(state.shape) ||
      !["bangkok-metro", "province"].includes(state.location) ||
      !["US", "OF"].includes(state.quoteFormat) ||
      typeof state.backsplash.enabled !== "boolean" ||
      typeof state.vat !== "boolean" ||
      !Number.isSafeInteger(state.backsplash.heightMm)) return null;

    const discount = sanitizeIntegerRange(state.discountTHB ?? 0, 0, MAX_STUDIO_SUBMISSION_PRICE_THB);
    const openEdgeRate = state.openEdgePricePerMTHB == null
      ? null
      : sanitizeStudioSubmissionRate(state.openEdgePricePerMTHB);
    const upstandHeight = state.upstandHeightMm == null
      ? state.upstandHeightMm
      : sanitizeIntegerRange(state.upstandHeightMm, 0, 500);
    if (discount === null || (state.openEdgePricePerMTHB != null && openEdgeRate === null) ||
      (state.upstandHeightMm != null && upstandHeight === null) ||
      sanitizeIntegerRange(state.backsplash.heightMm, 0, 500) === null) return null;

    const allowedSkus = new Set(basinProducts.map((product) => product.sku));
    if (state.basinSkus.length > 100 || state.basinSkus.some((sku) => typeof sku !== "string" || !allowedSkus.has(sku))) return null;
    const allowedStoneCodes = new Set(STONE_COLORS.map((stone) => stone.code));
    if (state.stoneColors.length > allowedStoneCodes.size ||
      state.stoneColors.some((code) => typeof code !== "string" || !allowedStoneCodes.has(code)) ||
      (state.activeStone !== "" && !allowedStoneCodes.has(state.activeStone))) return null;
    if (state.basinPlacements.length > 100 || state.basinPlacements.some((placement) =>
      !placement || typeof placement.sku !== "string" || !allowedSkus.has(placement.sku) ||
      !Number.isFinite(placement.xMm) || placement.xMm < 0 || placement.xMm > MAX_STUDIO_SUBMISSION_POSITION_MM ||
      !Number.isFinite(placement.yMm) || placement.yMm < 0 || placement.yMm > MAX_STUDIO_SUBMISSION_POSITION_MM ||
      (placement.offsetXMm !== undefined && (!Number.isFinite(placement.offsetXMm) || Math.abs(placement.offsetXMm) > MAX_STUDIO_SUBMISSION_DIMENSION_MM)) ||
      (placement.offsetYMm !== undefined && (!Number.isFinite(placement.offsetYMm) || Math.abs(placement.offsetYMm) > MAX_STUDIO_SUBMISSION_DIMENSION_MM)) ||
      (placement.widthMm !== null && sanitizeIntegerRange(placement.widthMm, 1, MAX_STUDIO_SUBMISSION_DIMENSION_MM) === null) ||
      (placement.depthMm !== null && sanitizeIntegerRange(placement.depthMm, 1, MAX_STUDIO_SUBMISSION_DIMENSION_MM) === null) ||
      (placement.rotation !== undefined && placement.rotation !== 0 && placement.rotation !== 90) ||
      (placement.orientation !== undefined && placement.orientation !== "horizontal" && placement.orientation !== "vertical") ||
      (placement.anchor !== undefined && !["top-left", "top-right", "bottom-left", "bottom-right", "center"].includes(placement.anchor)) ||
      (placement.pieceId !== undefined && typeof placement.pieceId !== "string") ||
      (placement.sheetId !== undefined && typeof placement.sheetId !== "string")
    )) return null;

    const safeState: StudioState = {
      ...state,
      discountTHB: discount,
      openEdgePricePerMTHB: openEdgeRate,
      upstandHeightMm: upstandHeight,
    };
    const legacyDimensions = [
      safeState.dimensions.depthMm,
      safeState.dimensions.runAMm,
      safeState.dimensions.runBMm,
      safeState.dimensions.runCMm,
    ];
    if (legacyDimensions.some((value) => sanitizeIntegerRange(value, 0, MAX_STUDIO_SUBMISSION_DIMENSION_MM) === null)) return null;

    const pieces = getStudioPieces(safeState);
    if (!studioStateDimensionsValid(safeState) || pieces.length > STUDIO_MAX_PIECES ||
      pieces.some((piece) => piece.rectangles.length > STUDIO_MAX_RECTANGLES ||
        piece.rectangles.some((rectangle) =>
          sanitizeIntegerRange(rectangle.widthMm, 1, MAX_STUDIO_SUBMISSION_DIMENSION_MM) === null ||
          sanitizeIntegerRange(rectangle.lengthMm, 1, MAX_STUDIO_SUBMISSION_DIMENSION_MM) === null ||
          !Number.isFinite(rectangle.xMm) || rectangle.xMm < 0 || rectangle.xMm > MAX_STUDIO_SUBMISSION_POSITION_MM ||
          !Number.isFinite(rectangle.yMm) || rectangle.yMm < 0 || rectangle.yMm > MAX_STUDIO_SUBMISSION_POSITION_MM ||
          (rectangle.rotation !== 0 && rectangle.rotation !== 90)
        ))) return null;

    const estimate = studioEstimate(safeState, basinProducts);
    const moneyValues = [
      estimate.stoneTotalTHB,
      estimate.upstandTotalTHB,
      estimate.openEdgeTotalTHB,
      estimate.basinSubtotalTHB,
      estimate.installationChargeTHB,
      estimate.installationDiscountTHB,
      estimate.discountTHB,
      estimate.smallJobFeeTHB,
      estimate.grossSubtotalTHB,
      estimate.subtotalTHB,
      estimate.vatAmountTHB,
      estimate.totalTHB,
    ];
    const rateValues = [estimate.stoneUnitPriceTHB, estimate.openEdgeUnitPriceTHB];
    const quantityValues = [
      estimate.counterAreaSqM,
      estimate.backsplashAreaSqM,
      estimate.upstandAreaSqM,
      estimate.upstandLengthM,
      estimate.openEdgeLengthM,
      estimate.stoneAreaSqM,
    ];
    if (moneyValues.some((value) => !isSafeStudioSubmissionAmount(value)) ||
      rateValues.some((value) => value !== null && !isSafeStudioSubmissionAmount(value)) ||
      quantityValues.some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1_000_000) ||
      sanitizeIntegerRange(estimate.pieceCount, 0, STUDIO_MAX_PIECES) === null ||
      sanitizeIntegerRange(estimate.rectangleCount, 0, STUDIO_MAX_PIECES * STUDIO_MAX_RECTANGLES) === null) return null;
    if ((safeState.discountTHB ?? 0) > Math.max(0, estimate.grossSubtotalTHB - estimate.installationDiscountTHB)) return null;

    return { state: safeState, estimate };
  } catch {
    return null;
  }
}

const studioCustomShapeEdgeLabel = (status: SideStatus) =>
  status === "normal"
    ? "ปกติ"
    : STUDIO_CUSTOM_SHAPE_EDGE_OPTIONS.find((option) => option.value === status)?.label ?? studioSideStatusLabel(status);

function studioCustomShapePresetForPiece(piece: StudioPiece): StudioPreset {
  if (piece.preset) return piece.preset;
  if (piece.rectangles.length === 3) return "u";
  if (piece.rectangles.length === 2) return (piece.rectangles[1]?.xMm ?? 0) > 0 ? "l-right" : "l-left";
  return "i";
}

function studioCustomShapeDefaults(preset: StudioPreset): StudioCustomShapePanelDraft[] {
  const dimensions = preset === "u"
    ? [{ lengthMm: 1500, depthMm: 600 }, { lengthMm: 600, depthMm: 1200 }, { lengthMm: 600, depthMm: 1200 }]
    : preset === "i"
      ? [{ lengthMm: 1800, depthMm: 600 }]
      : [{ lengthMm: 1800, depthMm: 600 }, { lengthMm: 600, depthMm: 1200 }];

  return dimensions.map(({ lengthMm, depthMm }) => ({
    lengthMm: String(lengthMm),
    depthMm: String(depthMm),
    edges: { top: "normal", right: "normal", bottom: "normal", left: "normal" },
  }));
}

function studioCustomShapeDraftsForPiece(piece: StudioPiece, preset: StudioPreset): StudioCustomShapePanelDraft[] {
  const defaults = studioCustomShapeDefaults(preset);
  if (studioCustomShapePresetForPiece(piece) !== preset || piece.rectangles.length !== defaults.length) return defaults;

  // The sheets' real sizes always come through (the customer may have resized the board with the size
  // chips without touching an edge); the per-side finishes only when they customised them.
  return piece.rectangles.map((rectangle, index) => piece.hasCustomEdges ? {
    lengthMm: String(rectangle.widthMm),
    depthMm: String(rectangle.lengthMm),
    edges: {
      top: piece.sideStatuses[`${rectangle.id}:top`] ?? "normal",
      right: piece.sideStatuses[`${rectangle.id}:right`] ?? "normal",
      bottom: piece.sideStatuses[`${rectangle.id}:bottom`] ?? "normal",
      left: piece.sideStatuses[`${rectangle.id}:left`] ?? "normal",
    },
  } : {
    ...defaults[index]!,
    lengthMm: String(rectangle.widthMm),
    depthMm: String(rectangle.lengthMm),
  });
}

function studioCustomShapePanelLabel(preset: StudioPreset, index: number) {
  if (index === 0) return preset === "i" ? "แผ่นหลัก" : "แผ่นแนวผนัง";
  if (preset === "l-left") return "แผ่นขาซ้าย";
  if (preset === "l-right") return "แผ่นขาขวา";
  return index === 1 ? "แผ่นขาซ้าย" : "แผ่นขาขวา";
}

const STUDIO_UNDO_TOAST_MS = 10_000;

type StudioShapeApplied = { before: StudioState; after: StudioState; notices: PlacementReanchorNotice[] };

function shapeChangeNoticeText(notice: PlacementReanchorNotice): string {
  if (notice.kind === "no-fit") return `อ่าง ${notice.sku} ใหญ่เกินผังใหม่ — ปรับขนาดผัง เปลี่ยนรุ่นอ่าง หรือนำอ่างออกก่อนส่งคำขอ`;
  if (notice.kind === "overlap") return `อ่าง ${notice.sku} ซ้อนกับอ่างอื่นในผังใหม่ — กรุณาลากย้ายตำแหน่ง`;
  return `ย้ายอ่าง ${notice.sku} ให้อยู่ในผังใหม่แล้ว — กรุณาตรวจตำแหน่ง`;
}

/** Takes a basin off the plan and offers a short "undo" instead of a confirmation dialog. */
function removeBasinPlacementWithUndo(placement: BasinPlacement, setState: Dispatch<SetStateAction<StudioState>>) {
  setState((current) => ({ ...current, basinPlacements: current.basinPlacements.filter((item) => item.id !== placement.id) }));
  toast({
    title: `นำอ่าง ${placement.sku} ออกจากผังแล้ว`,
    duration: STUDIO_UNDO_TOAST_MS,
    action: <ToastAction
      altText={`เลิกทำการนำอ่าง ${placement.sku} ออก`}
      data-testid="button-studio-basin-remove-undo"
      onClick={() => setState((current) => current.basinPlacements.some((item) => item.id === placement.id)
        ? current
        : { ...current, basinPlacements: [...current.basinPlacements, placement] })}
    >เลิกทำ</ToastAction>,
  });
}

function StudioCustomShapePanel({
  state,
  setState,
  targetPiece,
  simpleMode = false,
  onApplied,
}: {
  state: StudioState;
  setState: Dispatch<SetStateAction<StudioState>>;
  targetPiece: StudioPiece;
  simpleMode?: boolean;
  onApplied: (result: StudioShapeApplied) => void;
}) {
  const [preset, setPreset] = useState<StudioPreset>(() => studioCustomShapePresetForPiece(targetPiece));
  const [panelDrafts, setPanelDrafts] = useState<StudioCustomShapePanelDraft[]>(
    () => studioCustomShapeDraftsForPiece(targetPiece, preset),
  );
  const [openEdgeSelector, setOpenEdgeSelector] = useState<string | null>(null);
  // The last valid length / depth typed for each panel position, kept across shape switches so that
  // I -> L -> I -> L does not lose a leg's run length either.
  const rememberedPanels = useRef<Array<{ widthMm: number | null; depthMm: number | null }>>([]);

  useEffect(() => {
    const nextPreset = studioCustomShapePresetForPiece(targetPiece);
    rememberedPanels.current = [];
    setPreset(nextPreset);
    setPanelDrafts(studioCustomShapeDraftsForPiece(targetPiece, nextPreset));
    setOpenEdgeSelector(null);
  }, [targetPiece.id]);

  const selectDraftPreset = (nextPreset: StudioPreset) => {
    if (nextPreset === preset) return;
    const validMm = (value: string) => {
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
    };
    panelDrafts.forEach((panel, index) => {
      const earlier = rememberedPanels.current[index];
      rememberedPanels.current[index] = {
        widthMm: validMm(panel.lengthMm) ?? earlier?.widthMm ?? null,
        depthMm: validMm(panel.depthMm) ?? earlier?.depthMm ?? null,
      };
    });
    // The stock sizes only fill in what was never entered; the main panel keeps its length and depth and
    // every leg takes the main panel's depth (see carryCustomShapeDimensions).
    const stock = studioCustomShapeDefaults(nextPreset);
    const carried = carryCustomShapeDimensions(
      rememberedPanels.current,
      stock.map((panel) => ({ widthMm: Number(panel.lengthMm), depthMm: Number(panel.depthMm) })),
    );
    setPreset(nextPreset);
    setPanelDrafts(stock.map((panel, index) => ({
      ...panel,
      lengthMm: String(carried[index]?.widthMm ?? panel.lengthMm),
      depthMm: String(carried[index]?.depthMm ?? panel.depthMm),
    })));
    setOpenEdgeSelector(null);
  };

  const defaultDimensions = studioCustomShapeDefaults(preset);
  const modelPanels: StudioCustomShapePanelData[] = panelDrafts.map((panel) => ({
    widthMm: Number(panel.lengthMm),
    depthMm: Number(panel.depthMm),
    edges: panel.edges,
  }));
  const dimensionsValid = modelPanels.length > 0 && modelPanels.every((panel) =>
    Number.isSafeInteger(panel.widthMm) && panel.widthMm > 0 &&
    Number.isSafeInteger(panel.depthMm) && panel.depthMm > 0,
  );
  const previewPanels = panelDrafts.map((panel, index) => {
    const defaults = defaultDimensions[index] ?? defaultDimensions[0]!;
    const length = Number(panel.lengthMm);
    const depth = Number(panel.depthMm);
    return {
      widthMm: Number.isInteger(length) && length > 0 ? length : Number(defaults.lengthMm),
      depthMm: Number.isInteger(depth) && depth > 0 ? depth : Number(defaults.depthMm),
      edges: panel.edges,
    };
  });
  const previewPiece = buildCustomShapePiece(`${targetPiece.id}-draft`, preset, previewPanels);
  const lockedJointEdges = new Set(
    studioPieceEdges(previewPiece)
      .filter((edge) => edge.exposedLengthMm <= 0)
      .map((edge) => `${edge.rectangleId}:${edge.side}`),
  );

  const updatePanelDimension = (index: number, key: "lengthMm" | "depthMm", value: string) => {
    setPanelDrafts((current) => current.map((panel, panelIndex) =>
      panelIndex === index ? { ...panel, [key]: value } : panel,
    ));
  };
  const updatePanelEdge = (index: number, side: keyof StudioCustomShapePanelDraft["edges"], status: SideStatus) => {
    setPanelDrafts((current) => current.map((panel, panelIndex) =>
      panelIndex === index ? { ...panel, edges: { ...panel.edges, [side]: status } } : panel,
    ));
  };
  const mirrorDraftShape = () => {
    if (preset !== "l-left" && preset !== "l-right") return;
    setPreset(preset === "l-left" ? "l-right" : "l-left");
    setPanelDrafts((current) => current.map((panel) => ({
      ...panel,
      edges: { ...panel.edges, left: panel.edges.right, right: panel.edges.left },
    })));
    setOpenEdgeSelector(null);
  };

  const applyCustomShape = () => {
    if (!dimensionsValid) return;
    const shapePanels: StudioCustomShapePanelData[] = panelDrafts.map((panel) => ({
      widthMm: Number(panel.lengthMm),
      depthMm: Number(panel.depthMm),
      edges: panel.edges,
    }));
    // The basins are carried over by applyCustomShapeToState (never dropped, kept clear of the
    // edges, reported when they had to move) -- see reanchorPlacementsToPiece in studio-model.ts.
    const result = applyCustomShapeToState(state, targetPiece.id, preset, shapePanels);
    if (result.state === state) return;
    setState(result.state);
    setOpenEdgeSelector(null);
    onApplied({ before: state, after: result.state, notices: result.notices });
  };

  return (
    <div className="studio-custom-shape-panel">
      <StudioShapeWizard
        state={state}
        setState={setState}
        targetPieceId={targetPiece.id}
        simpleMode={simpleMode}
        draftPreset={preset}
        onDraftPresetChange={selectDraftPreset}
      />
      {(preset === "l-left" || preset === "l-right") && (
        <button
          type="button"
          className="button button--outline studio-mirror-button"
          onClick={mirrorDraftShape}
          data-testid="button-studio-mirror-l"
        >
          <RotateCw size={14} /> สลับข้าง L (ซ้าย ↔ ขวา)
        </button>
      )}
      <div className="studio-custom-shape-pieces">
        {panelDrafts.map((panel, index) => (
          <section className="studio-piece-card" key={`${preset}-${index}`} aria-label={studioCustomShapePanelLabel(preset, index)}>
            <h4>{studioCustomShapePanelLabel(preset, index)}</h4>
            <div className="studio-piece-dimension-inputs">
              <label>
                <span>ความยาว (มม.)</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={panel.lengthMm}
                  aria-invalid={!Number.isSafeInteger(Number(panel.lengthMm)) || Number(panel.lengthMm) <= 0}
                  onChange={(event) => updatePanelDimension(index, "lengthMm", event.target.value)}
                  data-testid={`input-piece-${index}-length`}
                />
              </label>
              <label>
                <span>ความลึก (มม.)</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={panel.depthMm}
                  aria-invalid={!Number.isSafeInteger(Number(panel.depthMm)) || Number(panel.depthMm) <= 0}
                  onChange={(event) => updatePanelDimension(index, "depthMm", event.target.value)}
                  data-testid={`input-piece-${index}-depth`}
                />
              </label>
            </div>
            <div className="studio-piece-edge-row" role="group" aria-label={`กำหนดสถานะขอบของ${studioCustomShapePanelLabel(preset, index)}`}>
              {STUDIO_CUSTOM_SHAPE_EDGE_SIDES.map(({ side, testSide, label }) => {
                const rectangle = previewPiece.rectangles[index];
                const isLocked = Boolean(rectangle && lockedJointEdges.has(`${rectangle.id}:${side}`));
                const selectorId = `${index}-${testSide}`;
                const isOpen = openEdgeSelector === selectorId;
                const status = panel.edges[side];
                return (
                  <div className="studio-piece-edge-control" key={side}>
                    <span>{label}</span>
                    <button
                      type="button"
                      className={`studio-edge-select ${isLocked ? "is-locked" : ""}`}
                      disabled={isLocked}
                      aria-expanded={isLocked ? undefined : isOpen}
                      aria-label={isLocked ? `${label}: รอยต่อชนแผ่น` : `${label}: ${studioCustomShapeEdgeLabel(status)}`}
                      title={isLocked ? "รอยต่อชนแผ่นเลือกสถานะขอบไม่ได้" : `สถานะปัจจุบัน: ${studioCustomShapeEdgeLabel(status)}`}
                      onClick={() => setOpenEdgeSelector(isOpen ? null : selectorId)}
                      data-testid={`select-edge-${index}-${testSide}`}
                    >
                      {isLocked ? "🔗 รอยต่อชนแผ่น" : <>{studioCustomShapeEdgeLabel(status)} <ChevronDown size={13} /></>}
                    </button>
                    {!isLocked && isOpen && (
                      <div className="studio-edge-options" role="group" aria-label={`ตัวเลือกสถานะ ${label}`}>
                        <button
                          type="button"
                          className={status === "normal" ? "is-active" : ""}
                          aria-pressed={status === "normal"}
                          onClick={() => {
                            updatePanelEdge(index, side, "normal");
                            setOpenEdgeSelector(null);
                          }}
                        >
                          ปกติ
                        </button>
                        {STUDIO_CUSTOM_SHAPE_EDGE_OPTIONS.map((option) => (
                          <button
                            type="button"
                            key={option.value}
                            className={status === option.value ? "is-active" : ""}
                            aria-pressed={status === option.value}
                            onClick={() => {
                              updatePanelEdge(index, side, option.value);
                              setOpenEdgeSelector(null);
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <div className="studio-custom-shape-actions">
        {!dimensionsValid && <p className="studio-warning" role="alert" data-testid="status-studio-shape-invalid-dimensions">กรุณากรอกขนาดทุกช่องเป็นจำนวนเต็มที่มากกว่า 0 มม.</p>}
        <small>พื้นที่และราคาจะคำนวณหลังจากประกอบผังเท่านั้น</small>
        <button
          type="button"
          className="button button--primary"
          onClick={applyCustomShape}
          disabled={!dimensionsValid}
          data-testid="button-apply-custom-shape"
        >
          🎨 ประกอบผังลงกระดาน
        </button>
      </div>
    </div>
  );
}

const SMALL_RECTANGLE_STANDARD_MM = 400;
const smallRectangleWarning = (value: number) => `⚠️ ขนาด ${value} มม. เล็กกว่ามาตรฐานท็อปเคาน์เตอร์ทั่วไป (400 มม.) กรุณาตรวจสอบหน่วยมิลลิเมตร (เช่น 600 มม. = 60 ซม. / 1800 มม. = 1.8 เมตร)`;

type StudioContactFieldsProps = {
  contact: typeof emptyContact;
  setContact: Dispatch<SetStateAction<typeof emptyContact>>;
  worksitePlaceId: string | null;
  setWorksitePlaceId: Dispatch<SetStateAction<string | null>>;
};

 function StudioContactFields({ contact, setContact, worksitePlaceId, setWorksitePlaceId }: StudioContactFieldsProps) {
   const update = (key: keyof typeof emptyContact, value: string) => setContact((current) => ({ ...current, [key]: value }));
   return <div className="studio-contact-grid">
     {([
       ["name", "ชื่อผู้ติดต่อ", true],
       ["company", "บริษัท", false],
       ["phone", "โทรศัพท์", true],
       ["email", "อีเมล", false],
       ["project", "ชื่อโครงการ", true],
       ["address", "ที่อยู่ / สถานที่ติดตั้ง", true],
     ] as const).map(([key, label, required]) => {
       const emailField = key === "email";
       const phoneField = key === "phone";
       if (key === "address") {
         return <WorksiteAddressAutocomplete
           key={key}
           value={contact.address}
           selectedPlaceId={worksitePlaceId}
           required={required}
           onValueChange={(value) => {
             update("address", value);
             setWorksitePlaceId(null);
           }}
           onPlaceSelect={setWorksitePlaceId}
           onClearPlace={() => setWorksitePlaceId(null)}
         />;
       }
       return <label key={key}>{label}{required && <span> *</span>}<input required={required} type={phoneField ? "tel" : emailField ? "email" : undefined} inputMode={phoneField ? "numeric" : undefined} pattern={phoneField ? "[0-9]{9,10}" : undefined} minLength={phoneField ? 9 : undefined} maxLength={phoneField ? 10 : undefined} placeholder={phoneField ? "0812345678 (10 หลัก)" : emailField ? "name@example.com" : undefined} value={contact[key]} onChange={(event) => update(key, phoneField ? cleanPhoneInput(event.target.value) : event.target.value)} data-testid={`input-studio-${key}`} aria-invalid={emailField && !isValidEmailAddress(contact.email)} /></label>;
      })}
      <label>LINE สำหรับติดต่อ<input value={contact.lineContact} onChange={(event) => update("lineContact", event.target.value)} maxLength={120} placeholder="@ไอดี หรือชื่อบัญชี" data-testid="input-studio-line-contact" /></label>
      <label>ช่องทางติดต่อที่สะดวก<select value={contact.preferredContact} onChange={(event) => update("preferredContact", event.target.value)} data-testid="input-studio-preferred-contact"><option value="">ยังไม่ระบุ</option>{CUSTOMER_CONTACT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label>บทบาทลูกค้า<select value={contact.customerRole} onChange={(event) => update("customerRole", event.target.value)} data-testid="input-studio-customer-role"><option value="">ยังไม่ระบุ</option>{CUSTOMER_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label>ประเภทสถานที่<select value={contact.propertyType} onChange={(event) => update("propertyType", event.target.value)} data-testid="input-studio-property-type"><option value="">ยังไม่ระบุ</option>{PROPERTY_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      {contact.propertyType === "condo" && <label>ชั้นคอนโด<input value={contact.condoFloor} onChange={(event) => update("condoFloor", event.target.value)} maxLength={32} data-testid="input-studio-condo-floor" /></label>}
       <label>วันที่คาดว่าจะติดตั้ง<input type="date" min={thaiDateInputValue(new Date())} value={contact.expectedInstallationDate} onChange={(event) => update("expectedInstallationDate", event.target.value)} data-testid="input-studio-installation-date" /></label>
      <label>ชื่อสำหรับใบกำกับภาษี<input value={contact.taxName} onChange={(event) => update("taxName", event.target.value)} maxLength={240} data-testid="input-studio-tax-name" /></label>
      <label>เลขประจำตัวผู้เสียภาษี 13 หลัก<input value={contact.taxId} onChange={(event) => update("taxId", event.target.value.replace(/\D/g, "").slice(0, 13))} inputMode="numeric" maxLength={13} data-testid="input-studio-tax-id" /></label>
      <label>สาขา<input value={contact.taxBranch} onChange={(event) => update("taxBranch", event.target.value)} maxLength={120} data-testid="input-studio-tax-branch" /></label>
      <label className="studio-contact-wide">ที่อยู่สำหรับใบกำกับภาษี<textarea value={contact.taxAddress} onChange={(event) => update("taxAddress", event.target.value)} maxLength={4000} data-testid="input-studio-tax-address" /></label>
   </div>;
 }

const studioBasinFilterOptions = [
  { value: "all", label: "ทั้งหมด" },
  { value: "selected", label: "แบบที่เลือก" },
  { value: "fits", label: "พอดีกับแผ่น" },
  { value: "counter basin", label: "เคาน์เตอร์" },
  { value: "tall vertical washbasin", label: "ทรงสูง" },
] as const;

type StudioBasinFilter = typeof studioBasinFilterOptions[number]["value"];

/** A basin "fits" when its own front-to-back footprint (the depth parsed
 * from basinDimensions, e.g. "350 × 500 × 130 mm" -> 500) is no deeper than
 * the counter depth set in the wizard — a plain physical-fit check against
 * real catalog numbers, not a recommendation/ranking. Basins with unknown
 * dimensions are excluded rather than guessed into either bucket. */
function basinFitsCounterDepth(product: BasinProduct, counterDepthMm: number): boolean {
  const { depthMm } = basinDimensionsForProduct(product);
  return depthMm !== null && depthMm <= counterDepthMm;
}

/** Finds the piece the user was most recently interacting with (via a
 * selected basin placement or rectangle), falling back to the first piece.
 * Lets tap-to-place land on the piece someone is actually working on instead
 * of always the first one, for layouts with more than one piece. */
type StudioBasinTarget = {
  piece: StudioPiece;
  sheet: StudioRectangle;
};

function attachmentWouldCreateCycle(rectangles: StudioRectangle[], childId: string, parentId: string) {
  const byId = new Map(rectangles.map((rectangle) => [rectangle.id, rectangle]));
  const visited = new Set<string>();
  let currentId: string | undefined = parentId;

  while (currentId) {
    if (currentId === childId || visited.has(currentId)) return true;
    visited.add(currentId);
    currentId = byId.get(currentId)?.attachTo?.rectangleId;
  }

  return false;
}

function attachmentParentsFor(rectangles: StudioRectangle[], childId: string | undefined) {
  if (!childId) return [];
  return rectangles.filter((rectangle) =>
    rectangle.id !== childId && !attachmentWouldCreateCycle(rectangles, childId, rectangle.id),
  );
}

function resolveActiveBasinTarget(
  state: StudioState,
  selectedRectangleId: string | null,
  selectedPlacementId: string | null,
): StudioBasinTarget | undefined {
  const pieces = getStudioPieces(state);
  if (selectedPlacementId) {
    const placement = state.basinPlacements.find((item) => item.id === selectedPlacementId);
    const piece = pieces.find((item) => item.id === placement?.pieceId) ?? pieces[0];
    if (piece) {
      const sheet = piece.rectangles.find((item) => item.id === placement?.sheetId)
        ?? piece.rectangles.find((item) => item.id === selectedRectangleId)
        ?? piece.rectangles[0];
      if (sheet) return { piece, sheet };
    }
  }
  const piece = pieces.find((item) => item.rectangles.some((rectangle) => rectangle.id === selectedRectangleId))
    ?? pieces[0];
  const sheet = piece?.rectangles.find((item) => item.id === selectedRectangleId) ?? piece?.rectangles[0];
  return piece && sheet ? { piece, sheet } : undefined;
}

function resolveBasinSheet(
  piece: StudioPiece,
  selectedRectangleId: string | null,
  point?: { xMm: number; yMm: number },
): StudioRectangle | undefined {
  const selected = piece.rectangles.find((rectangle) => rectangle.id === selectedRectangleId);
  if (selected) return selected;
  if (point) {
    const containing = piece.rectangles.find((rectangle) => {
      const size = studioRectangleSize(rectangle);
      return point.xMm >= rectangle.xMm &&
        point.yMm >= rectangle.yMm &&
        point.xMm <= rectangle.xMm + size.widthMm &&
        point.yMm <= rectangle.yMm + size.heightMm;
    });
    if (containing) return containing;
  }
  return piece.rectangles[0];
}

function placementAtCoordinates(
  placement: BasinPlacement,
  piece: StudioPiece,
  sheet: StudioRectangle,
  xMm: number,
  yMm: number,
  anchor: BasinAnchor = placement.anchor ?? "top-left",
): BasinPlacement {
  // Moving a basin any way other than the 1-7 picker means it no longer sits at the level that was picked.
  const { positionLevel: _movedOffItsLevel, ...unsnapped } = placement;
  const targeted = { ...unsnapped, pieceId: piece.id, sheetId: sheet.id, anchor };
  const clamped = clampPlacementToSheet(targeted, piece, xMm, yMm);
  const offsets = calculateBasinOffsets(sheet, targeted, clamped, anchor);
  return { ...targeted, ...clamped, ...offsets };
}

function placementAtAnchorOffset(
  placement: BasinPlacement,
  piece: StudioPiece,
  sheet: StudioRectangle,
  anchor: BasinAnchor,
  offsetXMm: number,
  offsetYMm: number,
): BasinPlacement {
  const targeted = { ...placement, pieceId: piece.id, sheetId: sheet.id, anchor, offsetXMm, offsetYMm };
  const coordinates = calculateBasinCoordinates(sheet, targeted);
  return placementAtCoordinates(targeted, piece, sheet, coordinates.xMm, coordinates.yMm, anchor);
}

function normalizeStudioState(
  state: StudioState,
  basinProducts: ReadonlyArray<BasinProduct> = PRODUCTS,
  availableStoneColors: ReadonlyArray<StoneColor> = STONE_COLORS,
): StudioState {
  const hasExplicitStoneSelection = state.stoneSelectionSource === "user";
  const defaultStone = hasExplicitStoneSelection ? "" : studioDefaultStoneCode(state.basinSkus, basinProducts, availableStoneColors);
  const activeStone = state.activeStone || state.stoneColors[0] || defaultStone;
  const stoneColors = state.stoneColors.length
    ? state.stoneColors
    : hasExplicitStoneSelection ? [] : [activeStone];
  return {
    ...state,
    stoneColors,
    activeStone,
    stoneSelectionSource: state.stoneSelectionSource ?? (state.activeStone || state.stoneColors.length ? "user" : "default"),
    basinPlacements: normalizePlacements(state),
  };
}

/** Places a basin on the target piece's canvas (defaulting to the first
 * piece) at a tiled default position, as a tap-friendly alternative to
 * dragging the shortlist card onto the canvas — native HTML5 drag-and-drop
 * (used for that drag) doesn't fire from touch on iOS/most mobile browsers,
 * so this is the only way basins can reach the canvas at all on a phone.
 * Shared by the shortlist card's "วางบนผัง" button and the canvas quick-access
 * bar. */
function placeBasinOnCanvas(
  state: StudioState,
  setState: Dispatch<SetStateAction<StudioState>>,
  product: BasinProduct,
  target?: StudioBasinTarget,
) {
  const pieces = getStudioPieces(state);
  const resolvedTarget = target ?? (pieces[0] && pieces[0].rectangles[0] ? { piece: pieces[0], sheet: pieces[0].rectangles[0] } : undefined);
  if (!resolvedTarget) return;
  const targetIds = { pieceId: resolvedTarget.piece.id, sheetId: resolvedTarget.sheet.id };
  setState((current) => {
    const currentPiece = getStudioPieces(current).find((piece) => piece.id === targetIds.pieceId) ?? getStudioPieces(current)[0];
    const piece = currentPiece;
    const sheet = piece?.rectangles.find((rectangle) => rectangle.id === targetIds.sheetId) ?? piece?.rectangles[0];
    if (!piece || !sheet) return current;
    const sheetSize = studioRectangleSize(sheet);
    const placement = createStudioBasinPlacement(product, current.basinPlacements.length, piece.id, sheet.id, sheet);
    const cutSize = placementCutSize(placement);
    const widthMm = cutSize.widthMm ?? 0;
    const heightMm = cutSize.heightMm ?? 0;
    const existingOnSheet = current.basinPlacements.filter((item) => item.pieceId === piece.id && item.sheetId === sheet.id).length;
    // Tile across a 4x4 grid of offsets (16 slots) before a position repeats,
    // spaced by the basin's own footprint (+ a small gap) so consecutive
    // tap-placed basins land next to each other instead of overlapping.
    const stepX = Math.max(widthMm, 300) + 20;
    const stepY = Math.max(heightMm, 300) + 20;
    const xOffset = (existingOnSheet % 4) * stepX;
    const yOffset = (Math.floor(existingOnSheet / 4) % 4) * stepY;
    const xMm = sheet.xMm + Math.max(0, (sheetSize.widthMm - widthMm) / 2 + xOffset);
    const yMm = sheet.yMm + Math.max(0, (sheetSize.heightMm - heightMm) / 2 + yOffset);
    const nextPlacement = placementAtCoordinates(placement, piece, sheet, xMm, yMm);
    return { ...current, basinPlacements: [...current.basinPlacements, nextPlacement] };
  });
}

function StudioShortlists({ mode, state, setState, stoneColors, basinProducts, selectedRectangleId, selectedPlacementId, onCatalogChangeResolved, onTouchBasinDrop }: { mode: Extract<StudioOrderMode, "studio" | "sketch">; state: StudioState; setState: Dispatch<SetStateAction<StudioState>>; stoneColors: ReadonlyArray<StoneColor>; basinProducts: ReadonlyArray<BasinProduct>; selectedRectangleId: string | null; selectedPlacementId: string | null; onCatalogChangeResolved: (sku: string) => void; onTouchBasinDrop: (sku: string, clientX: number, clientY: number) => boolean }) {
  const [basinQuery, setBasinQuery] = useState("");
  const [basinFilter, setBasinFilter] = useState<StudioBasinFilter>("all");
  const [stonePriceFilter, setStonePriceFilter] = useState("all");
  const [openCatalog, setOpenCatalog] = useState<"stone" | "basin" | null>(null);
  const catalogToolbarRef = useRef<HTMLDivElement | null>(null);
  const touchBasinDrag = useRef<{ sku: string; pointerId: number; startX: number; startY: number; moved: boolean } | null>(null);
  const suppressBasinClick = useRef(false);
  const [touchDraggingSku, setTouchDraggingSku] = useState<string | null>(null);
  useEffect(() => {
    if (!openCatalog) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !catalogToolbarRef.current?.contains(event.target)) setOpenCatalog(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenCatalog(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openCatalog]);
  const selectedStoneCodes = useMemo(() => new Set(state.stoneColors), [state.stoneColors]);
  // The Studio only ever quotes cut-and-install work (studioEstimate prices
  // every layout with stoneInstalledUnitPrice), so these budget filters must
  // group by the installed price per m² the customer will actually be
  // charged — grouping by the whole-sheet price put stones in buckets that
  // did not match their quoted rate.
  const stonePriceForFilter = (stone: StoneColor) => stone.installedPriceTHB;
  const stonePriceFilterOptions = useMemo(() => {
    const counts = new Map<number, number>();
    stoneColors.forEach((stone) => {
      const price = stonePriceForFilter(stone);
      if (price !== null) counts.set(price, (counts.get(price) ?? 0) + 1);
    });
    return [
      { value: "all", label: "ทั้งหมด", count: stoneColors.length },
      { value: "selected", label: "สีที่เลือก", count: stoneColors.filter((stone) => selectedStoneCodes.has(stone.code)).length },
      ...[...counts.entries()]
        .sort(([left], [right]) => left - right)
        .map(([price, count]) => ({ value: String(price), label: formatTHB(price), count })),
    ];
  }, [selectedStoneCodes, stoneColors]);
  const activeStonePriceFilter = stonePriceFilterOptions.some((option) => option.value === stonePriceFilter) ? stonePriceFilter : "all";
  const visibleStoneColors = useMemo(
    () => stoneColors.filter((stone) =>
      activeStonePriceFilter === "all"
        || (activeStonePriceFilter === "selected" && selectedStoneCodes.has(stone.code))
        || (activeStonePriceFilter !== "selected" && String(stonePriceForFilter(stone)) === activeStonePriceFilter),
    ),
    [activeStonePriceFilter, selectedStoneCodes, stoneColors],
  );
  const categoryBasins = useMemo(
    () => basinFilter === "all"
      ? basinProducts
      : basinFilter === "selected"
        ? basinProducts.filter((product) => state.basinSkus.includes(product.sku))
        : basinFilter === "fits"
          ? basinProducts.filter((product) => basinFitsCounterDepth(product, state.dimensions.depthMm))
          : basinProducts.filter((product) => product.category === basinFilter),
    [basinFilter, basinProducts, state.basinSkus, state.dimensions.depthMm],
  );
  const visibleBasins = useMemo(() => filterBasinProducts(categoryBasins, basinQuery), [basinQuery, categoryBasins]);
  const basinFilterCounts = useMemo(() => new Map(
    studioBasinFilterOptions.map((option) => [
      option.value,
      option.value === "all"
        ? basinProducts.length
        : option.value === "selected"
          ? basinProducts.filter((product) => state.basinSkus.includes(product.sku)).length
          : option.value === "fits"
            ? basinProducts.filter((product) => basinFitsCounterDepth(product, state.dimensions.depthMm)).length
            : basinProducts.filter((product) => product.category === option.value).length,
    ]),
  ), [basinProducts, state.basinSkus, state.dimensions.depthMm]);
  const basinEntries = studioBasinCatalogEntries(state, basinProducts);
  const hiddenBasins = basinEntries.filter((entry) => !entry.product);
  const toggleStone = (code: string) => setState((current) => {
    if (current.stoneColors.includes(code)) {
      // Already on the shortlist but not the one showing: clicking it brings it onto the plan.
      if (current.activeStone !== code) return { ...current, activeStone: code, stoneSelectionSource: "user" };
      const next = current.stoneColors.filter((item) => item !== code);
      return { ...current, stoneColors: next, activeStone: next[0] ?? "", stoneSelectionSource: "user" };
    }
    // A colour the customer just clicked is the one they want to see: it becomes the active stone at
    // once (plan colour, estimate and the "สีที่แสดงบนผัง" label follow), and the previous one stays on the
    // shortlist for comparison.
    return { ...current, stoneColors: [...current.stoneColors, code], activeStone: code, stoneSelectionSource: "user" };
  });
  const toggleBasin = (sku: string) => setState((current) => {
    if (current.basinSkus.includes(sku)) {
      const next = removeStudioBasin(current, sku);
      if (current.stoneSelectionSource === "default") {
        const defaultStone = studioDefaultStoneCode(next.basinSkus, basinProducts, stoneColors);
        return { ...next, stoneColors: [defaultStone], activeStone: defaultStone };
      }
      return next;
    }
    const nextBasinSkus = [...current.basinSkus, sku];
    if (current.stoneSelectionSource === "default") {
      const defaultStone = studioDefaultStoneCode(nextBasinSkus, basinProducts, stoneColors);
      return { ...current, basinSkus: nextBasinSkus, stoneColors: [defaultStone], activeStone: defaultStone };
    }
    return { ...current, basinSkus: nextBasinSkus };
  });
  const activeStone = stoneColorByName(state.activeStone, stoneColors);
  const selectedBasin = basinProducts.find((product) => product.sku === state.basinSkus[0]);
  const selectBasin = (sku: string) => {
    toggleBasin(sku);
    if (mode === "studio") setOpenCatalog(null);
  };
  const placeSelectedBasin = (product: BasinProduct) => {
    placeBasinOnCanvas(state, setState, product, resolveActiveBasinTarget(state, selectedRectangleId, selectedPlacementId));
    if (mode === "studio") setOpenCatalog(null);
  };
  const replaceBasin = (previousSku: string, nextSku: string) => {
    const product = basinProducts.find((item) => item.sku === nextSku);
    if (!product) return;
    setState((current) => {
      const next = replaceStudioBasin(current, previousSku, product);
      if (current.stoneSelectionSource === "default") {
        const defaultStone = studioDefaultStoneCode(next.basinSkus, basinProducts, stoneColors);
        return { ...next, stoneColors: [defaultStone], activeStone: defaultStone };
      }
      return next;
    });
    onCatalogChangeResolved(previousSku);
  };
  const removeHiddenBasin = (sku: string) => {
    setState((current) => removeStudioBasin(current, sku));
    onCatalogChangeResolved(sku);
  };
  const beginTouchBasinDrag = (event: ReactPointerEvent<HTMLDivElement>, sku: string, selected: boolean) => {
    if (mode !== "studio" || !selected || event.pointerType === "mouse") return;
    touchBasinDrag.current = { sku, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
    setTouchDraggingSku(sku);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events and browsers without active capture can still bubble.
    }
  };
  const moveTouchBasinDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = touchBasinDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 8) drag.moved = true;
  };
  const endTouchBasinDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = touchBasinDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    touchBasinDrag.current = null;
    setTouchDraggingSku(null);
    if (drag.moved) {
      event.preventDefault();
      suppressBasinClick.current = true;
      onTouchBasinDrop(drag.sku, event.clientX, event.clientY);
    }
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already have been released or never captured.
    }
  };
  const cancelTouchBasinDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (touchBasinDrag.current?.pointerId !== event.pointerId) return;
    touchBasinDrag.current = null;
    setTouchDraggingSku(null);
  };
  const suppressClickAfterTouchDrag = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressBasinClick.current) return;
    suppressBasinClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };
  const activeStoneSlabImages = stoneSlabViewerImages(activeStone);
  const stoneSelector = <section className={`studio-panel studio-selector-panel ${mode === "studio" ? "studio-stone-popover-panel" : ""}`}>
    <div className="studio-panel-heading"><div><p className="eyebrow">01 / MATERIAL SHORTLIST</p><h3>เลือกสีหิน</h3></div><span>{state.stoneColors.length} สี</span></div>
    <p className="studio-helper">เลือกสีเพื่อเปรียบเทียบ แล้วเลือกสีที่ใช้คำนวณจากรายการด้านล่าง</p>
    <div className="studio-stone-price-filters" role="tablist" aria-label="กรองราคาต่อตารางเมตร รวมติดตั้ง">
      {stonePriceFilterOptions.map((option) => <button type="button" role="tab" aria-selected={activeStonePriceFilter === option.value} className={activeStonePriceFilter === option.value ? "is-active" : ""} onClick={() => setStonePriceFilter(option.value)} key={option.value} data-testid={`button-studio-stone-price-filter-${option.value}`}>{option.label} <small>{option.count}</small></button>)}
    </div>
    <div className="studio-stone-list">{visibleStoneColors.map((stone) => {
      const selected = state.stoneColors.includes(stone.code);
      const slabImages = stoneSlabViewerImages(stone);
      return <div key={stone.code} style={{ display: "grid", gap: 4, minWidth: 0 }}>
        <button type="button" className={`studio-stone-choice ${selected ? "is-selected" : ""} ${state.activeStone === stone.code ? "is-active" : ""}`} onClick={() => { toggleStone(stone.code); if (mode === "studio") setOpenCatalog(null); }} aria-pressed={selected} data-testid={`button-studio-stone-${stone.code}`}><span className="studio-stone-swatch" style={{ background: stone.tone }} /> <strong>{stone.code}</strong><small>{stone.name}</small>{selected && <span className="studio-selection-check" aria-hidden="true"><Check size={12} /></span>}</button>
        {mode === "studio" && stone.slabImageUrl && slabImages.length > 0 && <div onClick={(event) => event.stopPropagation()} style={{ display: "grid", minWidth: 0 }}>
          <StoneSlabViewer
            images={slabImages}
            alt={`${stone.name} (${stone.code})`}
            buttonLabel="ดูลายแผ่นจริง"
            buttonTestId={`button-studio-stone-slab-${stone.code}`}
            buttonClassName="button button--outline"
            buttonIcon={<ImageIcon size={14} />}
          />
        </div>}
      </div>;
    })}</div>
    <div className="studio-active-stone"><span>กำลังคำนวณด้วย</span>{state.stoneColors.map((code) => <button type="button" key={code} className={state.activeStone === code ? "is-active" : ""} onClick={() => { setState((current) => ({ ...current, activeStone: code })); if (mode === "studio") setOpenCatalog(null); }} data-testid={`button-studio-active-stone-${code}`}>{state.activeStone === code && <Check size={12} />}{studioStoneName(code)} · {formatTHB(stoneColorByName(code, stoneColors).installedPriceTHB ?? 0)} / m²</button>)}</div>
  </section>;
  const basinSelector = <section className={`studio-panel studio-selector-panel ${mode === "studio" ? "studio-basin-popover-panel" : ""}`}>
    <div className="studio-panel-heading"><div><p className="eyebrow">02 / BASIN SHORTLIST</p><h3>เลือกแบบอ่าง</h3></div><span>{state.basinSkus.length} รุ่น</span></div>
    <p className="studio-helper">{mode === "sketch" ? "เลือกรุ่นอ่างที่สนใจเพิ่มเติมได้ตามต้องการ" : 'กดเลือกเพื่อเพิ่ม / นำออกจากรายการ · กด "วางบนผัง" หรือลากรุ่นที่เลือกไปวางบนแผ่นใดก็ได้'}</p>
    {hiddenBasins.length > 0 && <div className="studio-basin-stale" role="status" data-testid="studio-hidden-basins">
      <strong>มีอ่างในแบบร่างที่ปิดการขายแล้ว</strong>
      <p>ตำแหน่งและขนาดบนผังเดิมยังคงอยู่ เลือกรุ่นใหม่เพื่อแทนที่ หรือเอารุ่นนี้ออกจากแบบ</p>
      {hiddenBasins.map((entry) => {
        const replacementOptions = basinProducts.filter((product) => product.sku === entry.sku || !state.basinSkus.includes(product.sku));
        return <div className="studio-basin-stale-row" key={entry.sku}>
          <div><code>{entry.sku}</code><small>{entry.placementCount} จุดบนผัง · ไม่เปิดใช้งาน</small></div>
          <label>แทนที่ด้วย<select value="" onChange={(event) => replaceBasin(entry.sku, event.target.value)} aria-label={`แทนที่อ่าง ${entry.sku}`} data-testid={`select-replace-studio-basin-${entry.sku}`}><option value="" disabled>เลือกรุ่นที่เปิดใช้งาน</option>{replacementOptions.map((product) => <option value={product.sku} key={product.sku}>{product.sku} · {product.colorName}</option>)}</select></label>
          <button type="button" className="button button--outline" onClick={() => removeHiddenBasin(entry.sku)} data-testid={`button-remove-hidden-studio-basin-${entry.sku}`}>นำออก</button>
        </div>;
      })}
    </div>}
    <div className="studio-basin-toolbar">
      <label className="studio-basin-search">ค้นหา SKU หรือสี<input type="search" value={basinQuery} onChange={(event) => setBasinQuery(event.target.value)} placeholder="เช่น KF029 หรือ White" aria-label="ค้นหา SKU หรือสีของอ่าง" data-testid="input-studio-basin-search" /></label>
      <div className="studio-basin-filters" role="tablist" aria-label="กรองประเภทอ่าง">
        {studioBasinFilterOptions.map((option) => <button type="button" role="tab" aria-selected={basinFilter === option.value} className={basinFilter === option.value ? "is-active" : ""} onClick={() => setBasinFilter(option.value)} key={option.value} data-testid={`button-studio-basin-filter-${option.value === "all" ? "all" : option.value === "selected" ? "selected" : option.value === "fits" ? "fits" : option.value === "counter basin" ? "counter" : "tall"}`}>{option.label} {basinFilterCounts.get(option.value) ?? 0}</button>)}
      </div>
    </div>
    <p className="studio-basin-result-count">แสดง {visibleBasins.length} จาก {categoryBasins.length} รุ่น</p>
    <div className="studio-basin-list" data-testid="studio-basin-list">{visibleBasins.map((product) => {
      const selected = state.basinSkus.includes(product.sku);
      return <div key={product.sku} className={`studio-basin-choice ${selected ? "is-selected" : ""} ${touchDraggingSku === product.sku ? "is-touch-dragging" : ""}`} draggable={mode === "studio" && selected} onPointerDown={(event) => beginTouchBasinDrag(event, product.sku, selected)} onPointerMove={moveTouchBasinDrag} onPointerUp={endTouchBasinDrag} onPointerCancel={cancelTouchBasinDrag} onClickCapture={suppressClickAfterTouchDrag} onDragStart={(event) => { if (mode !== "studio") { event.preventDefault(); return; } event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("application/x-studio-basin", product.sku); }}>
        <button type="button" className="studio-basin-choice-main" onClick={() => selectBasin(product.sku)} aria-pressed={selected} data-testid={`button-studio-basin-${product.sku}`}><span className="studio-basin-choice-art"><BasinVisual tone={product.imageTone} imageUrl={product.imageUrl} alt="" tall={product.category === "tall vertical washbasin"} /></span><span>{product.sku}</span><strong>{product.colorName}</strong><small>{product.basinDimensions ? `หลุม ${product.basinDimensions}` : "รุ่นทรงสูง"} · {formatTHB(product.priceTHB)}</small></button>
        {selected && <span className="studio-selection-check" aria-hidden="true"><Check size={12} /></span>}
        {mode === "studio" && selected && <button type="button" className="studio-basin-place-button" onPointerDown={(event) => event.stopPropagation()} onClick={() => placeSelectedBasin(product)} data-testid={`button-studio-basin-place-${product.sku}`}><MapPin size={13} /> วางบนผัง</button>}
      </div>;
    })}{visibleBasins.length === 0 && <p className="studio-basin-empty">ไม่พบรุ่นที่ตรงกับการค้นหา</p>}</div>
  </section>;
  if (mode === "sketch") return <div className="studio-shortlists">{stoneSelector}{basinSelector}</div>;
  return <div className="studio-shortlists studio-selector-toolbar" ref={catalogToolbarRef} data-testid="studio-selector-toolbar">
    <div className="studio-selector-actions">
      <div className="studio-selector-anchor" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 8 }}>
        <button type="button" className="studio-selector-trigger" style={{ width: "auto", minWidth: 0 }} aria-expanded={openCatalog === "stone"} aria-controls="studio-stone-popover" onClick={() => setOpenCatalog((current) => current === "stone" ? null : "stone")} data-testid="button-open-studio-stone-popover">
          <Palette size={17} /><span><small>สีหิน</small><strong>{activeStone.name} ({activeStone.code})</strong><span>{formatTHB(activeStone.installedPriceTHB ?? 0)} บ./ตร.ม.</span></span><ChevronDown size={16} />
        </button>
        {activeStone.slabImageUrl && activeStoneSlabImages.length > 0 && <div onClick={(event) => event.stopPropagation()} style={{ display: "grid", minWidth: 0 }}>
          <StoneSlabViewer
            images={activeStoneSlabImages}
            alt={`${activeStone.name} (${activeStone.code})`}
            buttonLabel="ดูลายแผ่นจริง"
            buttonTestId="button-studio-active-stone-slab-open"
            buttonClassName="button button--outline"
            buttonIcon={<ImageIcon size={14} />}
          />
        </div>}
        <div className="studio-selector-popover" id="studio-stone-popover" role="dialog" aria-label="เลือกสีหิน" data-testid="studio-stone-popover" hidden={openCatalog !== "stone"}>{stoneSelector}</div>
      </div>
      <div className="studio-selector-anchor">
        <button type="button" className="studio-selector-trigger" aria-expanded={openCatalog === "basin"} aria-controls="studio-basin-popover" onClick={() => setOpenCatalog((current) => current === "basin" ? null : "basin")} data-testid="button-open-studio-basin-popover">
          <Bath size={17} /><span><small>อ่างล้างหน้า</small><strong>{selectedBasin ? selectedBasin.sku : "เพิ่มอ่าง"}</strong>{selectedBasin && <span>{selectedBasin.colorName}</span>}</span><ChevronDown size={16} />
        </button>
        <div className="studio-selector-popover studio-selector-popover--basins" id="studio-basin-popover" role="dialog" aria-label="เลือกอ่างล้างหน้า" data-testid="studio-basin-popover" hidden={openCatalog !== "basin"}>{basinSelector}</div>
      </div>
    </div>
  </div>;
}

/** Where the active stone's real installed price sits among every color
 * actually in the catalog, in plain terms — a genuine, computed comparison
 * (not a fabricated "most customers choose" claim, since we don't track
 * real order stats to back that up). Bottom/middle/top third of the actual
 * price distribution. Returns null when there isn't enough priced catalog
 * data to make the comparison meaningful. */
function stonePriceTier(price: number | null, colors: ReadonlyArray<StoneColor>): { label: string; total: number } | null {
  if (price === null) return null;
  const prices = colors.map((color) => color.installedPriceTHB).filter((value): value is number => value !== null).sort((a, b) => a - b);
  if (prices.length < 6) return null;
  const percentile = prices.filter((value) => value <= price).length / prices.length;
  const label = percentile <= 0.34 ? "ประหยัด" : percentile <= 0.67 ? "ระดับกลาง" : "พรีเมียม";
  return { label, total: prices.length };
}

function setPieceState(setState: Dispatch<SetStateAction<StudioState>>, pieceId: string, updater: (piece: StudioPiece) => StudioPiece) {
  setState((current) => ({ ...current, pieces: getStudioPieces(current).map((piece) => piece.id === pieceId ? updater(piece) : piece) }));
}

function StudioEdgeFinishToolbar({ pieceId, selectedStatus, onSelect }: {
  pieceId: string;
  selectedStatus: SideStatus;
  onSelect: (status: SideStatus) => void;
}) {
  return <div className="studio-edge-finish-toolbar" role="toolbar" aria-label="กำหนดงานขอบ" data-testid={`studio-edge-toolbar-${pieceId}`}>
    <div className="studio-edge-finish-options">
      {([
        { status: "upstand", label: "🟧 ติดบัว ▲" },
        { status: "wall-flush", label: "🟦 ชิดผนัง ║" },
        { status: "wall-flush+upstand" as SideStatus, label: "🟦🟧 ชิดผนัง + ติดบัว ║▲" },
        { status: "open-edge", label: "🟩 ขอบเปิด ⊗" },
        { status: "normal", label: "⚪ เอาออก (ล้างขอบ)" },
      ] as const).map(({ status, label }) => (
        <button
          key={status}
          type="button"
          className={`studio-edge-finish-option studio-edge-finish-option--${status} ${selectedStatus === status ? "is-active" : ""}`}
          aria-pressed={selectedStatus === status}
          draggable
          onClick={() => onSelect(status)}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "copy";
            event.dataTransfer.setData("application/x-studio-edge-status", status);
          }}
          data-testid={`button-studio-edge-status-${status}`}
        >
          {label}
        </button>
      ))}
    </div>
    <p>คลิกขอบบนผังเพื่อเปลี่ยน/เอาออก หรือลากก้อนด้านบนมาวางที่ขอบแผ่น</p>
  </div>;
}

function StudioPieceEditorLegacy({
  piece,
  state,
  setState,
  stoneColors,
  zoom,
  selectedPlacementId,
  setSelectedPlacementId,
}: {
  piece: StudioPiece;
  state: StudioState;
  setState: Dispatch<SetStateAction<StudioState>>;
  stoneColors: ReadonlyArray<StoneColor>;
  zoom: number;
  selectedPlacementId: string | null;
  setSelectedPlacementId: Dispatch<SetStateAction<string | null>>;
}) {
  const overlaps = pieceOverlapWarnings(piece);
  const disconnectedRectangles = disconnectedRectangleIds(piece);
  const bounds = pieceBounds(piece);
  const placements = state.basinPlacements.filter((placement) => (placement.pieceId ?? state.pieces?.[0]?.id) === piece.id);
  const selectedPlacement = placements.find((placement) => placement.id === selectedPlacementId);
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
    const placementId = event.dataTransfer.getData("application/x-studio-placement");
    if (placementId) {
      const moving = state.basinPlacements.find((placement) => placement.id === placementId);
      if (!moving) return;
      const xMm = ((event.clientX - rect.left) / rect.width) * bounds.widthMm - (moving.widthMm ?? 0) / 2;
      const yMm = ((event.clientY - rect.top) / rect.height) * bounds.heightMm - (moving.depthMm ?? 0) / 2;
      setState((current) => ({
        ...current,
        basinPlacements: current.basinPlacements.map((placement) => placement.id === placementId
          ? { ...placement, pieceId: piece.id, xMm: Math.round(xMm), yMm: Math.round(yMm) }
          : placement),
      }));
      return;
    }
    const sku = event.dataTransfer.getData("application/x-studio-basin");
    const product = productBySku(sku);
    if (!product || !state.basinSkus.includes(sku)) return;
    const placement = createStudioBasinPlacement(product, state.basinPlacements.length, piece.id);
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
    return [...keys].reduce((updatedPiece, key) => {
      const separator = key.lastIndexOf(":");
      if (separator < 0) return updatedPiece;
      const targetRectangleId = key.slice(0, separator);
      const targetSide = key.slice(separator + 1) as typeof side;
      return status === "normal"
        ? clearStudioEdgeStatus(updatedPiece, targetRectangleId, targetSide)
        : setStudioEdgeStatus(updatedPiece, targetRectangleId, targetSide, status);
    }, current);
  });
  const centerSelectedBasin = () => {
    if (!selectedPlacement) return;
    const position = centerBasinPlacementPosition(piece, selectedPlacement);
    setState((current) => ({ ...current, basinPlacements: current.basinPlacements.map((placement) => placement.id === selectedPlacement.id ? { ...placement, pieceId: piece.id, ...position } : placement) }));
  };
  const distributeBasins = () => {
    const positions = distributeBasinPlacementPositions(piece, placements);
    setState((current) => ({ ...current, basinPlacements: current.basinPlacements.map((placement) => {
      const position = positions.find((candidate) => candidate.id === placement.id);
      return position ? { ...placement, pieceId: piece.id, xMm: position.xMm, yMm: position.yMm } : placement;
    }) }));
  };
  return <section className="studio-piece-editor">
    <div className="studio-piece-heading">
      <label><span>ชื่อชิ้นงาน</span><input value={piece.name} onChange={(event) => setPieceState(setState, piece.id, (current) => ({ ...current, name: event.target.value }))} data-testid={`input-piece-name-${piece.id}`} /></label>
      <span>{piece.rectangles.length} / {STUDIO_MAX_RECTANGLES} แผ่น · {studioPieceAreaSqM(piece).toFixed(4)} m²</span>
    </div>
    <div className="studio-piece-rectangle-list">
      {piece.rectangles.map((rectangle, index) => {
        const statuses = studioSideStatuses(piece, rectangle.id);
        const smallDimensions = [rectangle.widthMm, rectangle.lengthMm].filter((value) => value < SMALL_RECTANGLE_STANDARD_MM);
        return <div className="studio-rectangle-editor" key={rectangle.id}>
          <div className="studio-rectangle-editor-heading"><strong>แผ่น {index + 1}</strong></div>
          <div className="studio-rectangle-inputs">
             <label>กว้าง (มม.)<input type="number" min="1" value={rectangle.widthMm} onChange={(event) => {
               const widthMm = parseBoundedIntegerInput(event.target.value, 1, MAX_STUDIO_SUBMISSION_DIMENSION_MM);
               if (widthMm === null) return;
               setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.map((item) => item.id === rectangle.id ? { ...item, widthMm } : item) }));
             }} data-testid={`input-rectangle-width-${rectangle.id}`} /></label>
             <label>ยาว (มม.)<input type="number" min="1" value={rectangle.lengthMm} onChange={(event) => {
               const lengthMm = parseBoundedIntegerInput(event.target.value, 1, MAX_STUDIO_SUBMISSION_DIMENSION_MM);
               if (lengthMm === null) return;
               setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.map((item) => item.id === rectangle.id ? { ...item, lengthMm } : item) }));
             }} data-testid={`input-rectangle-length-${rectangle.id}`} /></label>
             <label>X<input type="number" min="0" value={rectangle.xMm} onChange={(event) => {
               const xMm = parseBoundedIntegerInput(event.target.value, 0, MAX_STUDIO_SUBMISSION_POSITION_MM);
               if (xMm === null) return;
               setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.map((item) => item.id === rectangle.id ? { ...item, xMm } : item) }));
             }} data-testid={`input-rectangle-x-${rectangle.id}`} /></label>
             <label>Y<input type="number" min="0" value={rectangle.yMm} onChange={(event) => {
               const yMm = parseBoundedIntegerInput(event.target.value, 0, MAX_STUDIO_SUBMISSION_POSITION_MM);
               if (yMm === null) return;
               setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.map((item) => item.id === rectangle.id ? { ...item, yMm } : item) }));
             }} data-testid={`input-rectangle-y-${rectangle.id}`} /></label>
          </div>
            {smallDimensions.length > 0 && <div className="studio-warning studio-warning--small" data-testid={`status-small-rectangle-${rectangle.id}`} aria-live="polite"><AlertTriangle size={16} /><div>{smallDimensions.map((value) => <p key={value}>{smallRectangleWarning(value)}</p>)}</div></div>}
           <p className="studio-helper">หน่วย มิลลิเมตร (มม.) เช่น 600 มม. = 60 ซม. / 1800 มม. = 1.8 เมตร</p>
           {rectangle.widthMm > 900 && <div className="studio-dimension-suggestion" aria-live="polite"><span>ความกว้าง (แนวลึก) เกิน 900 มม. ตรวจสอบทิศทางอีกครั้ง</span><button type="button" className="button button--outline" onClick={() => setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.map((item) => item.id === rectangle.id ? { ...item, widthMm: item.lengthMm, lengthMm: item.widthMm } : item) }))} data-testid={`button-swap-rectangle-dimensions-${rectangle.id}`}><RotateCw size={14} /> สลับ กว้าง ↔ ยาว</button></div>}
           <button type="button" className="button button--outline studio-rotate-button" onClick={() => setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.map((item) => item.id === rectangle.id ? { ...item, rotation: item.rotation === 0 ? 90 : 0 } : item) }))}><RotateCw size={14} /> สลับแนวนอน / แนวตั้ง</button>
           <div className="studio-side-status-grid">{statuses.map(({ side, label, status }) => <label key={side}>{label}<select value={status} onChange={(event) => changeStatus(rectangle.id, side, event.target.value as SideStatus)}><option value="normal">ปกติ</option><option value="upstand">ติดบัว ▲</option><option value="open-edge">ขอบเปิด ⊗</option><option value="wall-flush">ชิดผนัง ║</option><option value="wall-flush+upstand">ชิดผนัง + ติดบัว ║▲</option><option value="closed-edge">ขอบปิด ⊞</option></select></label>)}</div>
           <p className="studio-helper">ติดบัว = ชิดผนังปูน / ขอบเปิด = โชว์ลอยในอากาศ</p>
        </div>;
      })}
    </div>
    {overlaps.length > 0 && <p className="studio-warning"><AlertTriangle size={15} /> มีสี่เหลี่ยมซ้อนกัน ({overlaps.length} จุด) พื้นที่ไม่ถูกหักซ้ำ แต่ควรตรวจสอบการจัดวาง</p>}
    {disconnectedRectangles.length > 0 && <p className="studio-warning" data-testid={`status-disconnected-rectangles-${piece.id}`}><AlertTriangle size={15} /> สี่เหลี่ยมในชิ้นงานเดียวกันต้องวางต่อกัน</p>}
     {placements.length > 0 && <div className="studio-placement-tools" data-testid={`studio-placement-tools-${piece.id}`}>
       <div><strong>จัดวางอ่าง</strong><small>แตะอ่างบนผังเพื่อเลือก แล้วใช้คำสั่งอัตโนมัติ</small></div>
       <div className="studio-placement-selectors">
         {placements.map((placement) => <button type="button" key={placement.id} className={placement.id === selectedPlacementId ? "is-active" : ""} onClick={() => setSelectedPlacementId(placement.id)} aria-pressed={placement.id === selectedPlacementId} data-testid={`button-select-studio-placement-${placement.id}`}>{placement.sku}</button>)}
       </div>
       {selectedPlacement && <div className="studio-placement-actions">
         <button type="button" className="button button--outline" onClick={centerSelectedBasin} disabled={selectedPlacement.widthMm === null || selectedPlacement.depthMm === null} data-testid="button-center-selected-basin">🎯 วางอ่างกึ่งกลางแผ่น</button>
         {placements.length === 2 && <button type="button" className="button button--outline" onClick={distributeBasins} disabled={placements.some((placement) => placement.widthMm === null || placement.depthMm === null)} data-testid="button-distribute-studio-basins">↔️ จัดระยะห่างอ่างเท่ากัน</button>}
       </div>}
     </div>}
     <StudioFootprint piece={piece} stoneTone={stoneColorByName(state.activeStone, stoneColors).tone} zoom={zoom} canvasPieceId={piece.id} testId={piece.id === state.pieces?.[0]?.id ? "studio-canvas" : `studio-canvas-${piece.id}`} ariaLabel={`ผังชิ้นงาน ${piece.name}`} onDragOver={(event) => event.preventDefault()} onDrop={drop}>
       {placements.map((placement) => {
        const unknown = placement.widthMm === null || placement.depthMm === null;
         const crossesJoint = !unknown && placementCrossesPanelJoint(piece, placement);
          return <div key={placement.id} draggable className={`studio-placement ${unknown ? "studio-placement--unknown" : ""} ${crossesJoint ? "studio-placement--invalid" : ""} ${placement.id === selectedPlacementId ? "studio-placement--selected" : ""}`} style={{ left: `${(placement.xMm / Math.max(1, bounds.widthMm)) * 100}%`, top: `${(placement.yMm / Math.max(1, bounds.heightMm)) * 100}%`, width: unknown ? "18%" : `${((placement.widthMm ?? 0) / Math.max(1, bounds.widthMm)) * 100}%`, height: unknown ? "18%" : `${((placement.depthMm ?? 0) / Math.max(1, bounds.heightMm)) * 100}%` }} onClick={() => setSelectedPlacementId(placement.id)} onDragStart={(event) => { setSelectedPlacementId(placement.id); event.dataTransfer.setData("application/x-studio-placement", placement.id); }} role="button" tabIndex={0} aria-pressed={placement.id === selectedPlacementId} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedPlacementId(placement.id); } }}><strong>{placement.sku}</strong><small>{unknown ? "ขนาดหลุมไม่ระบุ" : crossesJoint ? "อ่างคร่อมรอยต่อแผ่น" : "แตะเพื่อเลือก · ลากเพื่อย้าย"}</small><button type="button" onClick={(event) => { event.stopPropagation(); setSelectedPlacementId((current) => current === placement.id ? null : current); removeBasinPlacementWithUndo(placement, setState); }} aria-label={`นำ ${placement.sku} ออกจากผัง`}><X size={12} /></button></div>;
      })}
      {piece.rectangles.map((rectangle) => <div key={`drag-${rectangle.id}`} className="studio-rectangle-drag-target" draggable onDragStart={(event) => event.dataTransfer.setData("application/x-studio-rectangle", rectangle.id)} style={{ left: `${(rectangle.xMm / Math.max(1, bounds.widthMm)) * 100}%`, top: `${(rectangle.yMm / Math.max(1, bounds.heightMm)) * 100}%`, width: `${(studioRectangleSize(rectangle).widthMm / Math.max(1, bounds.widthMm)) * 100}%`, height: `${(studioRectangleSize(rectangle).heightMm / Math.max(1, bounds.heightMm)) * 100}%` }} aria-label={`ลากแผ่น ${rectangle.widthMm} × ${rectangle.lengthMm} มม.`} />)}
    </StudioFootprint>
     <p className="studio-canvas-hint"><GripVertical size={14} /> ลากแผ่นเพื่อจัดเรียง · แตะอ่างเพื่อเลือก · ขอบที่ชนกันจะ snap ต่อกัน</p>
  </section>;
}

/** .studio-canvas-stage fills the same box as .studio-canvas (inset: 0) and is
 * scaled by `zoom` from its own center (transform-origin: center), so a screen
 * point must be measured from the canvas rect's center and un-scaled by `zoom`
 * before it maps onto the unscaled mm coordinate system. Shared by every
 * pointer/drag handler that converts a screen coordinate into piece-space mm. */
function zoomAwareCanvasPoint(rect: DOMRect, clientX: number, clientY: number, zoom: number, bounds: { widthMm: number; heightMm: number }) {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const localX = rect.width / 2 + (clientX - centerX) / zoom;
  const localY = rect.height / 2 + (clientY - centerY) / zoom;
  return {
    xMm: (localX / Math.max(1, rect.width)) * bounds.widthMm,
    yMm: (localY / Math.max(1, rect.height)) * bounds.heightMm,
  };
}

function StudioPieceEditor({
  piece,
  state,
  setState,
  stoneTone,
  stoneTexture,
  zoom,
  selectedPlacementId,
  setSelectedPlacementId,
  selectedRectangleId,
  setSelectedRectangleId,
  basinProducts,
  simpleMode = false,
  showAddPiece = false,
  onAddPiece,
  highlightRectangleId = null,
}: {
  piece: StudioPiece;
  state: StudioState;
  setState: Dispatch<SetStateAction<StudioState>>;
  stoneTone: string;
  /** Loaded photo of the active stone, or undefined (flat tone only). */
  stoneTexture?: string;
  zoom: number;
  selectedPlacementId: string | null;
  setSelectedPlacementId: Dispatch<SetStateAction<string | null>>;
  selectedRectangleId: string | null;
  setSelectedRectangleId: Dispatch<SetStateAction<string | null>>;
  basinProducts: ReadonlyArray<BasinProduct>;
  simpleMode?: boolean;
  showAddPiece?: boolean;
  onAddPiece?: () => void;
  highlightRectangleId?: string | null;
}) {
  const overlaps = pieceOverlapWarnings(piece);
  const bounds = pieceBounds(piece);
  const placements = state.basinPlacements.filter((placement) => (placement.pieceId ?? state.pieces?.[0]?.id) === piece.id);
  const selectedPlacement = placements.find((placement) => placement.id === selectedPlacementId);
  const pointerDrag = useRef<{ kind: "rectangle" | "placement"; id: string; offsetX: number; offsetY: number } | null>(null);
  const [selectedEdgeStatus, setSelectedEdgeStatus] = useState<SideStatus>("upstand");
  const canvasPoint = (event: ReactPointerEvent<HTMLElement>) => {
    const canvas = event.currentTarget.closest(".studio-canvas");
    if (!(canvas instanceof HTMLElement)) return null;
    return zoomAwareCanvasPoint(canvas.getBoundingClientRect(), event.clientX, event.clientY, zoom, bounds);
  };
  const beginPointerDrag = (event: ReactPointerEvent<HTMLElement>, kind: "rectangle" | "placement", id: string) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const point = canvasPoint(event);
    if (!point) return;
    const item = kind === "rectangle"
      ? piece.rectangles.find((rectangle) => rectangle.id === id)
      : state.basinPlacements.find((placement) => placement.id === id);
    if (!item) return;
    pointerDrag.current = { kind, id, offsetX: point.xMm - item.xMm, offsetY: point.yMm - item.yMm };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events and browsers without active capture can still drag via bubbling events.
    }
    if (kind === "rectangle") {
      setSelectedRectangleId(id);
      setSelectedPlacementId(null);
    } else {
      setSelectedPlacementId(id);
      setSelectedRectangleId(null);
    }
  };
  const movePointerDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = pointerDrag.current;
    if (!drag) return;
    const point = canvasPoint(event);
    if (!point) return;
    const xMm = point.xMm - drag.offsetX;
    const yMm = point.yMm - drag.offsetY;
    if (drag.kind === "rectangle") {
      moveRectangle(drag.id, xMm, yMm);
    } else {
      setState((current) => ({
        ...current,
        basinPlacements: current.basinPlacements.map((placement) => placement.id === drag.id
          ? (() => {
            const sheet = piece.rectangles.find((rectangle) => rectangle.id === placement.sheetId) ?? piece.rectangles[0];
            return sheet ? placementAtCoordinates(placement, piece, sheet, xMm, yMm) : placement;
          })()
          : placement),
      }));
    }
  };
  const endPointerDrag = () => {
    pointerDrag.current = null;
  };
  const activeRectangle = piece.rectangles.find((rectangle) => rectangle.id === selectedRectangleId) ?? piece.rectangles[0];
  const simpleShapeLegDepthMm = simpleMode &&
    activeRectangle?.rotation === 0 &&
    activeRectangle.id.startsWith("wizard-leg-") &&
    activeRectangle.id !== "wizard-leg-0"
    ? piece.rectangles.find((rectangle) => rectangle.id === "wizard-leg-0")?.lengthMm ?? 0
    : 0;
  const attachmentParentOptions = attachmentParentsFor(piece.rectangles, activeRectangle?.id);
  const [attachmentParentId, setAttachmentParentId] = useState(() =>
    activeRectangle?.attachTo?.rectangleId ?? attachmentParentOptions[0]?.id ?? "",
  );
  const [attachmentAlign, setAttachmentAlign] = useState<StudioAttachmentAlign>(() =>
    activeRectangle?.attachTo?.align ?? "start",
  );

  useEffect(() => {
    const currentParentId = activeRectangle?.attachTo?.rectangleId;
    setAttachmentParentId(
      currentParentId && attachmentParentOptions.some((rectangle) => rectangle.id === currentParentId)
        ? currentParentId
        : attachmentParentOptions[0]?.id ?? "",
    );
    setAttachmentAlign(activeRectangle?.attachTo?.align ?? "start");
  }, [activeRectangle?.id, activeRectangle?.attachTo?.rectangleId, activeRectangle?.attachTo?.align, piece.rectangles.length]);

  const selectedAttachmentParentId =
    activeRectangle?.attachTo?.rectangleId && attachmentParentOptions.some((rectangle) => rectangle.id === activeRectangle.attachTo?.rectangleId)
      ? activeRectangle.attachTo.rectangleId
      : attachmentParentOptions.some((rectangle) => rectangle.id === attachmentParentId)
        ? attachmentParentId
        : attachmentParentOptions[0]?.id ?? "";
  const selectedAttachmentAlign = activeRectangle?.attachTo
    ? activeRectangle.attachTo.align ?? "start"
    : attachmentAlign;

  const applyAttachment = (
    edge: StudioAttachmentEdge,
    align: StudioAttachmentAlign,
    parentId = selectedAttachmentParentId,
  ) => {
    if (!activeRectangle || !parentId) return;
    setPieceState(setState, piece.id, (current) => {
      const child = current.rectangles.find((rectangle) => rectangle.id === activeRectangle.id);
      const parent = current.rectangles.find((rectangle) => rectangle.id === parentId);
      if (!child || !parent || attachmentWouldCreateCycle(current.rectangles, child.id, parent.id)) return current;
      const rectangles = current.rectangles.map((rectangle) => rectangle.id === child.id
        ? { ...rectangle, attachTo: { rectangleId: parent.id, edge, align } }
        : rectangle);
      return { ...current, rectangles: reflowStudioRectangles(current.rectangles, rectangles, current.preset) };
    });
  };

  const selectAttachmentParent = (parentId: string) => {
    setAttachmentParentId(parentId);
    if (activeRectangle?.attachTo) {
      applyAttachment(activeRectangle.attachTo.edge, selectedAttachmentAlign, parentId);
    }
  };

  const selectAttachmentAlign = (align: StudioAttachmentAlign) => {
    setAttachmentAlign(align);
    if (activeRectangle?.attachTo) {
      applyAttachment(activeRectangle.attachTo.edge, align, selectedAttachmentParentId);
    }
  };

  const updateRectangleById = (rectangleId: string, updater: (rectangle: StudioRectangle) => StudioRectangle) => {
    setPieceState(setState, piece.id, (current) => {
      let rectangles = current.rectangles.map((rectangle) => rectangle.id === rectangleId ? updater(rectangle) : rectangle);
      const before = current.rectangles.find((rectangle) => rectangle.id === rectangleId);
      const after = rectangles.find((rectangle) => rectangle.id === rectangleId);
      // Size / rotation changes reflow attached neighbours. A manual position
      // edit is an explicit placement, so detach this rectangle before reflow.
      const geometryChanged = Boolean(before && after) && (
        before!.widthMm !== after!.widthMm ||
        before!.lengthMm !== after!.lengthMm ||
        before!.rotation !== after!.rotation
      );
      const moved = Boolean(before && after) && (before!.xMm !== after!.xMm || before!.yMm !== after!.yMm);
      if (moved) {
        rectangles = rectangles.map((rectangle) => rectangle.id === rectangleId
          ? { ...rectangle, attachTo: undefined }
          : rectangle);
      }
      const hasAttachments = rectangles.some((rectangle) => rectangle.attachTo);
      const manualLayout = current.manualLayout || moved;
      const shouldReflow = hasAttachments
        ? geometryChanged || moved
        : geometryChanged && !manualLayout;
      return {
        ...current,
        manualLayout: manualLayout || undefined,
        rectangles: shouldReflow ? reflowStudioRectangles(current.rectangles, rectangles, current.preset) : rectangles,
      };
    });
  };
  const updateRectangle = (updater: (rectangle: StudioRectangle) => StudioRectangle) => {
    if (!activeRectangle) return;
    updateRectangleById(activeRectangle.id, updater);
  };
  const moveRectangle = (rectangleId: string, xMm: number, yMm: number) => setPieceState(setState, piece.id, (current) => {
    const snapped = snapStudioRectanglePosition(current, rectangleId, xMm, yMm);
    const rectangles = current.rectangles.map((rectangle) => rectangle.id === rectangleId
      ? { ...rectangle, ...snapped, attachTo: undefined }
      : rectangle);
    return {
      ...current,
      manualLayout: true,
      rectangles: rectangles.some((rectangle) => rectangle.attachTo)
        ? reflowStudioRectangles(current.rectangles, rectangles, current.preset)
        : rectangles,
    };
  });
  const dropPoint = (event: DragEvent<HTMLDivElement>) =>
    zoomAwareCanvasPoint(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY, zoom, bounds);
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rectangleId = event.dataTransfer.getData("application/x-studio-rectangle");
    if (rectangleId) {
      const { xMm: canvasX, yMm: canvasY } = dropPoint(event);
      const moving = piece.rectangles.find((rectangle) => rectangle.id === rectangleId);
      if (moving) {
        setSelectedRectangleId(rectangleId);
        setSelectedPlacementId(null);
        moveRectangle(rectangleId, canvasX - studioRectangleSize(moving).widthMm / 2, canvasY - studioRectangleSize(moving).heightMm / 2);
      }
      return;
    }
    const placementId = event.dataTransfer.getData("application/x-studio-placement");
    if (placementId) {
      const moving = state.basinPlacements.find((placement) => placement.id === placementId);
      if (!moving) return;
      const { xMm: dropX, yMm: dropY } = dropPoint(event);
      const sheet = resolveBasinSheet(piece, selectedRectangleId, { xMm: dropX, yMm: dropY });
      if (!sheet) return;
      const cutSize = placementCutSize(moving);
      const xMm = dropX - (cutSize.widthMm ?? 0) / 2;
      const yMm = dropY - (cutSize.heightMm ?? 0) / 2;
      setSelectedPlacementId(placementId);
      setState((current) => ({
        ...current,
        basinPlacements: current.basinPlacements.map((placement) => placement.id === placementId
          ? placementAtCoordinates(placement, piece, sheet, xMm, yMm)
          : placement),
      }));
      return;
    }
    const sku = event.dataTransfer.getData("application/x-studio-basin");
    const product = basinProducts.find((item) => item.sku === sku);
    if (!product || !state.basinSkus.includes(sku)) return;
    const { xMm: dropX, yMm: dropY } = dropPoint(event);
    const sheet = resolveBasinSheet(piece, selectedRectangleId, { xMm: dropX, yMm: dropY });
    if (!sheet) return;
    const placement = createStudioBasinPlacement(product, state.basinPlacements.length, piece.id, sheet.id, sheet);
    const cutSize = placementCutSize(placement);
    const xMm = dropX - (cutSize.widthMm ?? 0) / 2;
    const yMm = dropY - (cutSize.heightMm ?? 0) / 2;
    setSelectedPlacementId(placement.id);
    setState((current) => ({ ...current, basinPlacements: [...current.basinPlacements, placementAtCoordinates(placement, piece, sheet, xMm, yMm)] }));
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
    return [...keys].reduce((updatedPiece, key) => {
      const separator = key.lastIndexOf(":");
      if (separator < 0) return updatedPiece;
      const targetRectangleId = key.slice(0, separator);
      const targetSide = key.slice(separator + 1) as typeof side;
      return status === "normal"
        ? clearStudioEdgeStatus(updatedPiece, targetRectangleId, targetSide)
        : setStudioEdgeStatus(updatedPiece, targetRectangleId, targetSide, status);
    }, current);
  });
  const centerSelectedBasin = () => {
    if (!selectedPlacement) return;
    const sheet = piece.rectangles.find((rectangle) => rectangle.id === selectedPlacement.sheetId) ?? activeRectangle;
    if (!sheet) return;
    const position = centerBasinPlacementPosition(sheet ? { ...piece, rectangles: [sheet] } : piece, selectedPlacement);
    setState((current) => ({
      ...current,
      basinPlacements: current.basinPlacements.map((placement) => placement.id === selectedPlacement.id
        ? placementAtCoordinates(placement, piece, sheet, position.xMm, position.yMm)
        : placement),
    }));
  };
  const distributeBasins = () => {
    const positions = distributeBasinPlacementPositions(piece, placements);
    setState((current) => ({ ...current, basinPlacements: current.basinPlacements.map((placement) => {
      const position = positions.find((candidate) => candidate.id === placement.id);
      const sheet = piece.rectangles.find((rectangle) => rectangle.id === placement.sheetId) ?? activeRectangle;
      return position && sheet ? placementAtCoordinates(placement, piece, sheet, position.xMm, position.yMm) : placement;
    }) }));
  };
  const updatePlacement = (updater: (placement: BasinPlacement) => BasinPlacement) => {
    if (!selectedPlacement) return;
    setState((current) => ({
      ...current,
      basinPlacements: current.basinPlacements.map((placement) => placement.id === selectedPlacement.id ? updater(placement) : placement),
    }));
  };
  const changeBasinAnchor = (anchor: BasinAnchor) => {
    if (!selectedPlacement) return;
    const sheet = piece.rectangles.find((rectangle) => rectangle.id === selectedPlacement.sheetId) ?? activeRectangle;
    if (!sheet) return;
    updatePlacement((placement) => placementAtAnchorOffset(
      placement,
      piece,
      sheet,
      anchor,
      placement.offsetXMm ?? 0,
      placement.offsetYMm ?? 0,
    ));
  };
  const changeBasinOffset = (axis: "x" | "y", value: number) => {
    if (!selectedPlacement) return;
    const sheet = piece.rectangles.find((rectangle) => rectangle.id === selectedPlacement.sheetId) ?? activeRectangle;
    if (!sheet) return;
    updatePlacement((placement) => placementAtAnchorOffset(
      placement,
      piece,
      sheet,
      placement.anchor ?? "top-left",
      axis === "x" ? value : placement.offsetXMm ?? 0,
      axis === "y" ? value : placement.offsetYMm ?? 0,
    ));
  };
  const changeBasinSheet = (sheetId: string) => {
    if (!selectedPlacement) return;
    const sheet = piece.rectangles.find((rectangle) => rectangle.id === sheetId);
    if (!sheet) return;
    updatePlacement((placement) => placementAtCoordinates(placement, piece, sheet, placement.xMm, placement.yMm));
  };
  const rotateSelectedBasin = () => {
    if (!selectedPlacement) return;
    const sheet = piece.rectangles.find((rectangle) => rectangle.id === selectedPlacement.sheetId) ?? activeRectangle;
    if (!sheet) return;
    updatePlacement((placement) => {
      const rotated = rotatePlacement(placement, piece);
      const next = placementAtCoordinates(rotated, piece, sheet, rotated.xMm, rotated.yMm, rotated.anchor ?? placement.anchor ?? "top-left");
      // The turned basin has another width, so a snapped level is worked out again for it.
      return isBasinPositionLevel(placement.positionLevel) ? positionPlacementAtLevel(next, piece, placement.positionLevel) : next;
    });
  };
  const snapSelectedBasinToLevel = (level: BasinPositionLevel) => {
    if (!selectedPlacement) return;
    updatePlacement((placement) => positionPlacementAtLevel(placement, piece, level, STUDIO_BASIN_SAFETY_MARGIN_MM));
  };
  const addRectangle = () => {
    const rectangle = makeRectangle(piece.rectangles.length);
    setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: [...current.rectangles, rectangle] }));
    setSelectedRectangleId(rectangle.id);
    setSelectedPlacementId(null);
  };
  const removePiece = () => {
    if (getStudioPieces(state).length <= 1) return;
    if (typeof window !== "undefined" && !window.confirm(`ลบชิ้นงาน “${piece.name}” พร้อมแผ่นและอ่างที่อยู่ในชิ้นงานนี้หรือไม่`)) return;
    setState((current) => {
      const currentPieces = getStudioPieces(current);
      const firstPieceId = currentPieces[0]?.id;
      const remainingPieces = currentPieces.filter((item) => item.id !== piece.id);
      return {
        ...current,
        pieces: remainingPieces,
        activePieceId: current.activePieceId === piece.id ? (remainingPieces[0]?.id ?? "") : current.activePieceId,
        basinPlacements: current.basinPlacements.filter((placement) => (placement.pieceId ?? firstPieceId) !== piece.id),
      };
    });
    setSelectedRectangleId(null);
    setSelectedPlacementId(null);
  };
  return <section className="studio-piece-editor studio-piece-editor--canvas-first">
    <div className="studio-piece-heading">
      <label><span>ชื่อชิ้นงาน</span><input value={piece.name} onChange={(event) => setPieceState(setState, piece.id, (current) => ({ ...current, name: event.target.value }))} data-testid={`input-piece-name-${piece.id}`} /></label>
      <div className="studio-piece-heading-meta">
        <span>{piece.rectangles.length} / {STUDIO_MAX_RECTANGLES} แผ่น · {studioPieceAreaSqM(piece).toFixed(4)} m²</span>
        {showAddPiece && onAddPiece && <button type="button" className="button button--outline studio-piece-add" onClick={onAddPiece} data-testid="button-add-studio-piece"><Plus size={14} /> เพิ่มชิ้นงาน</button>}
        <button type="button" className="button button--outline studio-piece-delete" disabled={getStudioPieces(state).length <= 1} onClick={removePiece} data-testid={`button-delete-studio-piece-${piece.id}`}><Trash2 size={14} /> ลบชิ้นงาน</button>
      </div>
    </div>
    <div className="studio-piece-workspace">
      <div className="studio-piece-canvas-column">
        <StudioEdgeFinishToolbar pieceId={piece.id} selectedStatus={selectedEdgeStatus} onSelect={setSelectedEdgeStatus} />
        <StudioFootprint piece={piece} stoneTone={stoneTone} stoneTexture={stoneTexture} zoom={zoom} edgeStatus={selectedEdgeStatus} onEdgeStatusChange={changeStatus} canvasPieceId={piece.id} highlightRectangleId={highlightRectangleId} testId={piece.id === state.pieces?.[0]?.id ? "studio-canvas" : `studio-canvas-${piece.id}`} ariaLabel={`ผังชิ้นงาน ${piece.name}`} onDragOver={(event) => event.preventDefault()} onDrop={drop}>
          {placements.map((placement) => {
            const unknown = placement.widthMm === null || placement.depthMm === null;
            const crossesJoint = !unknown && placementCrossesPanelJoint(piece, placement);
            const product = basinProducts.find((item) => item.sku === placement.sku);
            const inactive = !product;
            const cutSize = placementCutSize(placement);
            const targetWarnings = placementTargetWarnings(placement, getStudioPieces(state));
            const sheetWarnings = placementSheetWarnings(placement, piece);
            const placementWarnings = [...targetWarnings, ...sheetWarnings];
            return <div key={placement.id} draggable className={`studio-placement ${unknown ? "studio-placement--unknown" : ""} ${inactive ? "studio-placement--inactive" : ""} ${crossesJoint || placementWarnings.length > 0 ? "studio-placement--invalid" : ""} ${placement.id === selectedPlacementId ? "studio-placement--selected" : ""}`} style={{ left: `${(placement.xMm / Math.max(1, bounds.widthMm)) * 100}%`, top: `${(placement.yMm / Math.max(1, bounds.heightMm)) * 100}%`, width: unknown ? "18%" : `${((cutSize.widthMm ?? 0) / Math.max(1, bounds.widthMm)) * 100}%`, height: unknown ? "18%" : `${((cutSize.heightMm ?? 0) / Math.max(1, bounds.heightMm)) * 100}%` }} onClick={() => { setSelectedPlacementId(placement.id); setSelectedRectangleId(null); }} onPointerDown={(event) => beginPointerDrag(event, "placement", placement.id)} onPointerMove={movePointerDrag} onPointerUp={endPointerDrag} onPointerCancel={endPointerDrag} onDragStart={(event) => { setSelectedPlacementId(placement.id); event.dataTransfer.setData("application/x-studio-placement", placement.id); }} role="button" tabIndex={0} aria-pressed={placement.id === selectedPlacementId} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedPlacementId(placement.id); setSelectedRectangleId(null); } }}><span className="studio-placement-visual">{product && <BasinTopView product={product} testId={`studio-placement-top-view-${placement.id}`} />}</span><strong>{placement.sku}</strong><small>{inactive ? "ไม่เปิดใช้งานแล้ว · เปลี่ยนรุ่นหรือนำออก" : placementWarnings[0] ?? (unknown ? "ขนาดหลุมไม่ระบุ" : `${cutSize.widthMm} × ${cutSize.heightMm} มม. · ลากเพื่อย้าย`)}</small><button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setSelectedPlacementId((current) => current === placement.id ? null : current); removeBasinPlacementWithUndo(placement, setState); }} aria-label={`นำ ${placement.sku} ออกจากผัง`}><X size={12} /></button></div>;
          })}
          {piece.rectangles.map((rectangle) => <div key={`drag-${rectangle.id}`} className={`studio-rectangle-drag-target ${rectangle.id === activeRectangle?.id ? "is-selected" : ""}`} draggable onClick={() => { setSelectedRectangleId(rectangle.id); setSelectedPlacementId(null); }} onPointerDown={(event) => beginPointerDrag(event, "rectangle", rectangle.id)} onPointerMove={movePointerDrag} onPointerUp={endPointerDrag} onPointerCancel={endPointerDrag} onDragStart={(event) => { setSelectedRectangleId(rectangle.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-studio-rectangle", rectangle.id); }} style={{ left: `${(rectangle.xMm / Math.max(1, bounds.widthMm)) * 100}%`, top: `${(rectangle.yMm / Math.max(1, bounds.heightMm)) * 100}%`, width: `${(studioRectangleSize(rectangle).widthMm / Math.max(1, bounds.widthMm)) * 100}%`, height: `${(studioRectangleSize(rectangle).heightMm / Math.max(1, bounds.heightMm)) * 100}%` }} aria-label={`ลากแผ่น ${rectangle.widthMm} × ${rectangle.lengthMm} มม.`} />)}
          {stoneTexture && <span className="pointer-events-none absolute bottom-1 right-2 z-10 max-w-[42%] rounded bg-black/35 px-2 py-0.5 text-right text-[11px] leading-tight text-white" data-testid="text-studio-stone-texture-note">ลายหินตัวอย่างเพื่อการแสดงผล · หน้างานจริงขึ้นกับลายแร่ธรรมชาติ</span>}
        </StudioFootprint>
        <p className="studio-canvas-hint"><GripVertical size={14} /> คลิกแผ่นหรืออ่างเพื่อเปิดตัวแก้ไข · ลากเพื่อจัดตำแหน่ง · ขอบที่ชนกันจะ snap ต่อกัน</p>
      </div>
      <aside className="studio-inspector" aria-label={`ตัวแก้ไขชิ้นงาน ${piece.name}`}>
        <div className="studio-inspector-heading"><div><p className="eyebrow">INSPECTOR</p><h4>{selectedPlacement ? `อ่าง ${selectedPlacement.sku}` : `แผ่น ${activeRectangle ? piece.rectangles.findIndex((item) => item.id === activeRectangle.id) + 1 : 1}`}</h4></div><span>{selectedPlacement ? "BASIN" : "PANEL"}</span></div>
        {placements.length > 0 && <div className="studio-placement-tools" data-testid={`studio-placement-tools-${piece.id}`}><div><strong>อ่างในชิ้นงาน</strong><small>เลือกอ่างบนผัง หรือเลือกจากรายการนี้</small></div><div className="studio-placement-selectors">{placements.map((placement) => <button type="button" key={placement.id} className={placement.id === selectedPlacementId ? "is-active" : ""} onClick={() => { setSelectedPlacementId(placement.id); setSelectedRectangleId(null); }} aria-pressed={placement.id === selectedPlacementId} data-testid={`button-select-studio-placement-${placement.id}`}>{placement.sku}</button>)}</div>{selectedPlacement && <div className="studio-placement-actions"><button type="button" className="button button--outline" onClick={centerSelectedBasin} disabled={selectedPlacement.widthMm === null || selectedPlacement.depthMm === null} data-testid="button-center-selected-basin">วางอ่างกึ่งกลางแผ่น</button>{placements.length === 2 && <button type="button" className="button button--outline" onClick={distributeBasins} disabled={placements.some((placement) => placement.widthMm === null || placement.depthMm === null)} data-testid="button-distribute-studio-basins">จัดระยะห่างอ่าง</button>}</div>}</div>}
        {selectedPlacement && <div className="studio-inspector-section studio-placement-inspector-section">
           <div className="studio-inspector-subheading"><strong>ตำแหน่งอ่าง {selectedPlacement.sku}</strong><small>{selectedPlacement.widthMm === null || selectedPlacement.depthMm === null ? "ขนาดหลุมไม่ระบุ" : `หลุม ${selectedPlacement.widthMm} × ${selectedPlacement.depthMm} มม.`}</small></div>
          <label className="studio-rectangle-select">แผ่นเป้าหมาย
            <select value={selectedPlacement.sheetId ?? ""} onChange={(event) => changeBasinSheet(event.target.value)} data-testid={`select-placement-sheet-${selectedPlacement.id}`}>
              {piece.rectangles.map((rectangle, index) => <option key={rectangle.id} value={rectangle.id}>{rectangle.label ?? `แผ่น ${index + 1}`} · {rectangle.widthMm} × {rectangle.lengthMm} มม.</option>)}
            </select>
          </label>
          <label className="studio-rectangle-select">จุดยึด
            <select value={selectedPlacement.anchor ?? "top-left"} onChange={(event) => changeBasinAnchor(event.target.value as BasinAnchor)} data-testid={`select-placement-anchor-${selectedPlacement.id}`}>
              <option value="top-left">มุมบนซ้าย</option>
              <option value="top-right">มุมบนขวา</option>
              <option value="bottom-left">มุมล่างซ้าย</option>
              <option value="bottom-right">มุมล่างขวา</option>
              <option value="center">กึ่งกลาง</option>
            </select>
          </label>
          <div className="studio-rectangle-inputs">
            <label>ระยะ X (มม.)<input type="number" step="1" value={Math.round(selectedPlacement.offsetXMm ?? 0)} onChange={(event) => changeBasinOffset("x", numericValue(event.target.value))} data-testid={`input-placement-offset-x-${selectedPlacement.id}`} /></label>
            <label>ระยะ Y (มม.)<input type="number" step="1" value={Math.round(selectedPlacement.offsetYMm ?? 0)} onChange={(event) => changeBasinOffset("y", numericValue(event.target.value))} data-testid={`input-placement-offset-y-${selectedPlacement.id}`} /></label>
          </div>
          <button type="button" className="button button--outline studio-rotate-button" onClick={rotateSelectedBasin} data-testid={`button-rotate-studio-basin-${selectedPlacement.id}`}><RotateCw size={14} /> หมุนอ่าง 90°</button>
          <div className="mt-2 grid gap-1.5" role="group" aria-label="ตำแหน่งอ่างซ้าย–ขวา 7 ระดับ" data-testid={`group-placement-level-${selectedPlacement.id}`}>
            <strong className="text-sm">ตำแหน่งอ่าง 7 ระดับ (ซ้าย → ขวา)</strong>
            <div className="grid grid-cols-7 gap-1">
              {STUDIO_BASIN_POSITION_LEVELS.map((level) => {
                const active = selectedPlacement.positionLevel === level;
                return <button
                  type="button"
                  key={level}
                  className={`rounded-md border px-0 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}
                  aria-pressed={active}
                  aria-label={`ตำแหน่งระดับ ${level}${level === 1 ? " ชิดซ้ายสุด" : level === 4 ? " กึ่งกลาง" : level === 7 ? " ชิดขวาสุด" : ""}`}
                  disabled={selectedPlacement.widthMm === null || selectedPlacement.depthMm === null}
                  onClick={() => snapSelectedBasinToLevel(level)}
                  data-testid={`button-placement-level-${selectedPlacement.id}-${level}`}
                >{level}</button>;
              })}
            </div>
            <small className="text-muted-foreground">1 = ชิดซ้าย · 4 = กึ่งกลาง · 7 = ชิดขวา · เว้นขอบแผ่น {STUDIO_BASIN_SAFETY_MARGIN_MM} มม. ทุกระดับ</small>
          </div>
          <p className="studio-helper">ระยะ X / Y วัดจากขอบของแผ่นเป้าหมายตามจุดยึด · กึ่งกลางรองรับค่าติดลบ · ลากบนผังจะอัปเดตระยะให้อัตโนมัติ</p>
          {placementTargetWarnings(selectedPlacement, getStudioPieces(state)).concat(placementSheetWarnings(selectedPlacement, piece)).map((warning) => <p className="studio-warning" key={warning} data-testid={`status-placement-warning-${selectedPlacement.id}`}><AlertTriangle size={15} /> {warning}</p>)}
        </div>}
         {activeRectangle && <div className="studio-inspector-section">
           <label className="studio-rectangle-select">เลือกแผ่น
             <select value={activeRectangle.id} onChange={(event) => { setSelectedRectangleId(event.target.value); setSelectedPlacementId(null); }} data-testid={`select-studio-rectangle-${piece.id}`}>
               {piece.rectangles.map((rectangle, index) => <option key={rectangle.id} value={rectangle.id}>{rectangle.label ?? `แผ่น ${index + 1}`} · {rectangle.widthMm} × {rectangle.lengthMm} มม.</option>)}
             </select>
           </label>
          <div className="studio-rectangle-editor">
           <div className="studio-rectangle-inputs">
            <label>กว้าง (มม.)<input type="number" min="1" value={activeRectangle.widthMm} onChange={(event) => {
              const widthMm = parseBoundedIntegerInput(event.target.value, 1, MAX_STUDIO_SUBMISSION_DIMENSION_MM);
              if (widthMm === null) return;
              updateRectangle((rectangle) => ({ ...rectangle, widthMm }));
            }} data-testid={`input-rectangle-width-${activeRectangle.id}`} /></label>
              <label>{simpleShapeLegDepthMm > 0 ? "ยาวรวม (มม.)" : "ยาว (มม.)"}<input type="number" min={simpleShapeLegDepthMm > 0 ? simpleShapeLegDepthMm + 1 : 1} value={activeRectangle.lengthMm + simpleShapeLegDepthMm} onChange={(event) => {
                const totalLengthMm = parseBoundedIntegerInput(
                  event.target.value,
                  simpleShapeLegDepthMm > 0 ? simpleShapeLegDepthMm + 1 : 1,
                  MAX_STUDIO_SUBMISSION_DIMENSION_MM,
                );
                if (totalLengthMm === null) return;
                updateRectangle((rectangle) => ({ ...rectangle, lengthMm: totalLengthMm - simpleShapeLegDepthMm }));
              }} data-testid={`input-rectangle-length-${activeRectangle.id}`} /></label>
           </div>
            <div className="studio-join-controls" data-testid={`studio-join-controls-${activeRectangle.id}`}>
              <div className="studio-join-controls-heading">
                <strong>ต่อขอบแผ่น</strong>
                 <small>เลือกแผ่นหลัก ทิศทาง และแนวจัดแนว</small>
              </div>
               <label className="studio-rectangle-select">ต่อกับแผ่น
                 <select
                   value={selectedAttachmentParentId}
                   onChange={(event) => selectAttachmentParent(event.target.value)}
                   disabled={attachmentParentOptions.length === 0}
                   data-testid={`select-studio-attachment-parent-${activeRectangle.id}`}
                 >
                   {attachmentParentOptions.length === 0
                     ? <option value="">เพิ่มแผ่นอื่นก่อน</option>
                     : attachmentParentOptions.map((rectangle) => {
                       const index = piece.rectangles.findIndex((item) => item.id === rectangle.id);
                       return <option key={rectangle.id} value={rectangle.id}>{rectangle.label ?? `แผ่น ${index + 1}`} · {rectangle.widthMm} × {rectangle.lengthMm} มม.</option>;
                     })}
                 </select>
               </label>
              <div className="studio-join-direction-grid" role="group" aria-label="เลือกทิศทางการต่อแผ่น">
                 <button type="button" className="studio-join-control-button studio-join-direction-button" disabled={!selectedAttachmentParentId} aria-pressed={activeRectangle.attachTo?.rectangleId === selectedAttachmentParentId && activeRectangle.attachTo.edge === "left"} onClick={() => applyAttachment("left", selectedAttachmentAlign)} data-testid={`button-studio-join-left-${activeRectangle.id}`}>← ต่อซ้าย</button>
                 <button type="button" className="studio-join-control-button studio-join-direction-button" disabled={!selectedAttachmentParentId} aria-pressed={activeRectangle.attachTo?.rectangleId === selectedAttachmentParentId && activeRectangle.attachTo.edge === "right"} onClick={() => applyAttachment("right", selectedAttachmentAlign)} data-testid={`button-studio-join-right-${activeRectangle.id}`}>ต่อขวา →</button>
                 <button type="button" className="studio-join-control-button studio-join-direction-button" disabled={!selectedAttachmentParentId} aria-pressed={activeRectangle.attachTo?.rectangleId === selectedAttachmentParentId && activeRectangle.attachTo.edge === "top"} onClick={() => applyAttachment("top", selectedAttachmentAlign)} data-testid={`button-studio-join-top-${activeRectangle.id}`}>↑ ต่อบน</button>
                 <button type="button" className="studio-join-control-button studio-join-direction-button" disabled={!selectedAttachmentParentId} aria-pressed={activeRectangle.attachTo?.rectangleId === selectedAttachmentParentId && activeRectangle.attachTo.edge === "bottom"} onClick={() => applyAttachment("bottom", selectedAttachmentAlign)} data-testid={`button-studio-join-bottom-${activeRectangle.id}`}>↓ ต่อล่าง</button>
              </div>
              <div className="studio-join-alignment">
                <span className="studio-join-alignment-label">แนวจัดแนว</span>
                <div className="studio-join-alignment-grid" role="group" aria-label="เลือกแนวจัดแนว">
                  <button type="button" className="studio-join-control-button studio-join-alignment-button" aria-pressed={selectedAttachmentAlign === "start"} onClick={() => selectAttachmentAlign("start")} data-testid={`button-studio-align-start-${activeRectangle.id}`}>ชิดต้น</button>
                  <button type="button" className="studio-join-control-button studio-join-alignment-button" aria-pressed={selectedAttachmentAlign === "center"} onClick={() => selectAttachmentAlign("center")} data-testid={`button-studio-align-center-${activeRectangle.id}`}>กึ่งกลาง</button>
                  <button type="button" className="studio-join-control-button studio-join-alignment-button" aria-pressed={selectedAttachmentAlign === "end"} onClick={() => selectAttachmentAlign("end")} data-testid={`button-studio-align-end-${activeRectangle.id}`}>ชิดปลาย</button>
                </div>
              </div>
               <p className="studio-join-controls-note" aria-live="polite">
                 {selectedAttachmentParentId
                   ? activeRectangle.attachTo?.rectangleId === selectedAttachmentParentId
                     ? "ตำแหน่งจะคำนวณตามแผ่นหลัก · แก้ X/Y เพื่อวางแผ่นนี้เอง"
                     : "เลือกทิศทางเพื่อจัดแผ่นนี้ให้ชิดแผ่นหลัก"
                   : "เพิ่มแผ่นอื่นก่อน แล้วเลือกแผ่นหลักที่ต้องการต่อ"}
               </p>
            </div>
            {piece.rectangles.length > 1 && (
              <>
                <div className="studio-rectangle-inputs studio-rectangle-position-inputs">
                  <label>X (มม.)<input type="number" min="0" value={activeRectangle.xMm} onChange={(event) => {
                    const xMm = parseBoundedIntegerInput(event.target.value, 0, MAX_STUDIO_SUBMISSION_POSITION_MM);
                    if (xMm === null) return;
                    updateRectangle((rectangle) => ({ ...rectangle, xMm }));
                  }} data-testid={`input-rectangle-x-${activeRectangle.id}`} /></label>
                  <label>Y (มม.)<input type="number" min="0" value={activeRectangle.yMm} onChange={(event) => {
                    const yMm = parseBoundedIntegerInput(event.target.value, 0, MAX_STUDIO_SUBMISSION_POSITION_MM);
                    if (yMm === null) return;
                    updateRectangle((rectangle) => ({ ...rectangle, yMm }));
                  }} data-testid={`input-rectangle-y-${activeRectangle.id}`} /></label>
                </div>
                <p className="studio-helper">X / Y คือระยะจากมุมซ้ายบนของกรอบผังถึงมุมซ้ายบนของแผ่น · หน่วยมิลลิเมตร · ขนาดแผ่นใช้หน่วย มิลลิเมตร (มม.) เช่น 600 มม. = 60 ซม. / 1800 มม. = 1.8 เมตร</p>
              </>
            )}
          {([activeRectangle.widthMm, activeRectangle.lengthMm].filter((value) => value < SMALL_RECTANGLE_STANDARD_MM).length > 0) && <div className="studio-warning studio-warning--small" data-testid={`status-small-rectangle-${activeRectangle.id}`} aria-live="polite"><AlertTriangle size={16} /><div>{[activeRectangle.widthMm, activeRectangle.lengthMm].filter((value) => value < SMALL_RECTANGLE_STANDARD_MM).map((value) => <p key={value}>{smallRectangleWarning(value)}</p>)}</div></div>}
           <button type="button" className="button button--outline studio-rotate-button studio-rectangle-rotate-button" onClick={() => updateRectangle((rectangle) => ({ ...rectangle, rotation: rectangle.rotation === 0 ? 90 : 0 }))}><RotateCw size={14} /> สลับแนวนอน / แนวตั้ง</button>
          <div className="studio-side-status-grid">{(() => {
            const statuses = studioSideStatuses(piece, activeRectangle.id);
            const bySide = (side: "top" | "right" | "bottom" | "left") => statuses.find((item) => item.side === side)!;
            // Paired by opposite edges (top+bottom, then left+right) instead of the
            // natural top/right/bottom/left order, so each row groups the two sides
            // a person naturally compares against each other.
            return [bySide("top"), bySide("bottom"), bySide("left"), bySide("right")].map(({ side, label, status }) => <label key={side}>{label}<select value={status} onChange={(event) => changeStatus(activeRectangle.id, side, event.target.value as SideStatus)}><option value="normal">ปกติ</option><option value="upstand">ติดบัว ▲</option><option value="open-edge">ขอบเปิด ⊗</option><option value="wall-flush">ชิดผนัง ║</option><option value="wall-flush+upstand">ชิดผนัง + ติดบัว ║▲</option><option value="closed-edge">ขอบปิด ⊞</option></select></label>);
          })()}</div>
          <p className="studio-helper">ติดบัว = ชิดผนังปูน / ขอบเปิด = โชว์ลอยในอากาศ</p>
            <div className="studio-inspector-actions"><button type="button" className="button button--outline" disabled={piece.rectangles.length >= STUDIO_MAX_RECTANGLES} onClick={addRectangle} data-testid={`button-add-studio-rectangle-${piece.id}`}><Plus size={14} /> เพิ่มแผ่น</button><button type="button" className="button button--outline studio-panel-delete" onClick={() => setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.filter((item) => item.id !== activeRectangle.id) }))} disabled={piece.rectangles.length <= 1} data-testid={`button-delete-studio-rectangle-${piece.id}`}><Trash2 size={14} /> ลบแผ่น</button></div>
          </div>
        </div>}
      </aside>
    </div>
    {overlaps.length > 0 && <p className="studio-warning"><AlertTriangle size={15} /> มีสี่เหลี่ยมซ้อนกัน ({overlaps.length} จุด) พื้นที่ไม่ถูกหักซ้ำ แต่ควรตรวจสอบการจัดวาง</p>}
  </section>;
}

/** Simple CSS-3D "tilted slab" rendering of a piece's footprint, reusing the
 * exact same rectangle/basin percentage math as the 2D top-down canvas — a
 * fast, illustrative "what will this actually look like" preview without a
 * real 3D engine. Approximate: a single flat front edge along the bottom
 * of the bounding box, which is exactly right for an I-shape and a
 * reasonable simplification for L/U shapes. */
function StudioPerspectivePreview({ piece, stoneTone, basinPlacements }: { piece: StudioPiece; stoneTone: string; basinPlacements: ReadonlyArray<BasinPlacement>; }) {
  const bounds = pieceBounds(piece);
  return <div className="studio-perspective">
    <div className="studio-perspective-scene">
      <div className="studio-perspective-stage" style={{ aspectRatio: `${Math.max(1, bounds.widthMm)} / ${Math.max(1, bounds.heightMm)}` }}>
        <div className="studio-perspective-top">
          {piece.rectangles.map((rectangle) => {
            const size = studioRectangleSize(rectangle);
            return <div key={rectangle.id} className="studio-perspective-slab" style={{
              left: `${(rectangle.xMm / Math.max(1, bounds.widthMm)) * 100}%`,
              top: `${(rectangle.yMm / Math.max(1, bounds.heightMm)) * 100}%`,
              width: `${(size.widthMm / Math.max(1, bounds.widthMm)) * 100}%`,
              height: `${(size.heightMm / Math.max(1, bounds.heightMm)) * 100}%`,
              background: stoneTone,
            }} />;
          })}
          {basinPlacements.filter((placement) => placementCutSize(placement).widthMm !== null && placementCutSize(placement).heightMm !== null).map((placement) => {
            const cutSize = placementCutSize(placement);
            return <div key={placement.id} className="studio-perspective-basin" style={{
              left: `${(placement.xMm / Math.max(1, bounds.widthMm)) * 100}%`,
              top: `${(placement.yMm / Math.max(1, bounds.heightMm)) * 100}%`,
              width: `${((cutSize.widthMm ?? 0) / Math.max(1, bounds.widthMm)) * 100}%`,
              height: `${((cutSize.heightMm ?? 0) / Math.max(1, bounds.heightMm)) * 100}%`,
            }} />;
          })}
        </div>
        <div className="studio-perspective-front" style={{ background: stoneTone }} />
      </div>
    </div>
    <p className="studio-perspective-caption">มุมมองเปอร์สเปคทีฟโดยประมาณ · ไม่ใช่ขนาดหรือสัดส่วนจริง</p>
  </div>;
}

function StudioCanvas({
  state,
  setState,
  onLayoutApplied,
  pieceZoom,
  setPieceZoom,
  selectedPlacementId,
  setSelectedPlacementId,
  selectedRectangleId,
  setSelectedRectangleId,
  basinProducts,
  stoneColors,
  simpleMode = false,
}: {
  state: StudioState;
  setState: Dispatch<SetStateAction<StudioState>>;
  onLayoutApplied: () => void;
  pieceZoom: Record<string, number>;
  setPieceZoom: Dispatch<SetStateAction<Record<string, number>>>;
  selectedPlacementId: string | null;
  setSelectedPlacementId: Dispatch<SetStateAction<string | null>>;
  selectedRectangleId: string | null;
  setSelectedRectangleId: Dispatch<SetStateAction<string | null>>;
  basinProducts: ReadonlyArray<BasinProduct>;
  stoneColors: ReadonlyArray<StoneColor>;
  simpleMode?: boolean;
}) {
  const pieces = getStudioPieces(state);
  const activeStoneColor = stoneColorByName(state.activeStone, stoneColors);
  const activeStoneTone = activeStoneColor.tone;
  // Only the stone on the plan has its photo fetched, and only when one was actually chosen.
  const activeStoneTexture = useLoadedStoneTexture(state.activeStone ? activeStoneColor.slabImageUrl : undefined);
  const activePieceId = state.activePieceId && pieces.some((p) => p.id === state.activePieceId)
    ? state.activePieceId
    : (pieces[0]?.id ?? "");
  const activePiece = pieces.find((p) => p.id === activePieceId) ?? pieces[0];
  const activePieceZoom = activePiece ? (pieceZoom[activePiece.id] ?? 1) : 1;
  const setActivePieceZoom = (updater: number | ((prev: number) => number)) => {
    if (!activePiece) return;
    setPieceZoom((prev) => {
      const current = prev[activePiece.id] ?? 1;
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [activePiece.id]: next };
    });
  };

  // After a shape change: the basin notices (shown until the layout is edited again) and a short "undo".
  const [shapeChange, setShapeChange] = useState<{ after: StudioState; notices: PlacementReanchorNotice[] } | null>(null);
  const shapeToastDismissRef = useRef<(() => void) | null>(null);
  // Bumped by "undo" so the shape panel remounts and shows the restored shape instead of the abandoned draft.
  const [shapePanelVersion, setShapePanelVersion] = useState(0);
  const announceShapeApplied = ({ before, after, notices }: StudioShapeApplied) => {
    shapeToastDismissRef.current?.();
    setShapeChange({ after, notices });
    const handle = toast({
      title: "เปลี่ยนทรงแล้ว",
      duration: STUDIO_UNDO_TOAST_MS,
      action: <ToastAction
        altText="ย้อนกลับทรงเดิม"
        data-testid="button-studio-shape-undo"
        onClick={() => {
          setState((current) => ({
            ...current,
            shape: before.shape,
            pieces: before.pieces,
            activePieceId: before.activePieceId,
            basinPlacements: before.basinPlacements,
          }));
          setSelectedRectangleId(null);
          setSelectedPlacementId(null);
          setShapePanelVersion((version) => version + 1);
        }}
      >ย้อนกลับ</ToastAction>,
    });
    shapeToastDismissRef.current = handle.dismiss;
  };
  useEffect(() => {
    if (!shapeChange) return;
    if (state.pieces === shapeChange.after.pieces && state.basinPlacements === shapeChange.after.basinPlacements) return;
    shapeToastDismissRef.current?.();
    shapeToastDismissRef.current = null;
    setShapeChange(null);
  }, [state, shapeChange]);

  const addPiece = () => {
    setState((current) => {
      const currentPieces = getStudioPieces(current);
      if (currentPieces.length >= STUDIO_MAX_PIECES) return current;
      const nextIndex = currentPieces.length;
      const newPiece = makePiece(nextIndex);
      newPiece.preset = "i";
      return {
        ...current,
        pieces: [...currentPieces, newPiece],
        activePieceId: newPiece.id,
      };
    });
    setSelectedRectangleId(null);
    setSelectedPlacementId(null);
  };

  const removePiece = (pieceId: string) => {
    const currentPieces = getStudioPieces(state);
    if (currentPieces.length <= 1) return;
    const target = currentPieces.find((p) => p.id === pieceId);
    if (!target) return;
    if (typeof window !== "undefined" && !window.confirm(`ลบชิ้นงาน “${target.name}” พร้อมแผ่นและอ่างที่อยู่ในชิ้นงานนี้หรือไม่`)) return;
    setState((current) => {
      const remaining = getStudioPieces(current).filter((p) => p.id !== pieceId);
      const nextActiveId = remaining[0]?.id ?? "";
      return {
        ...current,
        pieces: remaining,
        activePieceId: nextActiveId,
        basinPlacements: current.basinPlacements.filter((placement) => (placement.pieceId ?? pieceId) !== pieceId),
      };
    });
    setSelectedRectangleId(null);
    setSelectedPlacementId(null);
  };

  return <section className="studio-panel studio-canvas-panel">
    <div className="studio-panel-heading">
      <div><p className="eyebrow">03 / RECTANGLE WORKPIECES</p><h3>ประกอบผังจากสี่เหลี่ยม</h3></div>
      <span>{pieces.length} / {STUDIO_MAX_PIECES} ชิ้นงาน</span>
    </div>

    {(state.stoneColors.length > 0 || state.basinSkus.length > 0) && <div className="studio-canvas-quickbar" aria-label="เข้าถึงสีและอ่างที่เลือกไว้อย่างรวดเร็ว">
      {state.stoneColors.length > 0 && <div className="studio-canvas-quickbar-group">
        <span>สี</span>
        {state.stoneColors.map((code) => <button type="button" key={code} className={state.activeStone === code ? "is-active" : ""} onClick={() => setState((current) => ({ ...current, activeStone: code }))} data-testid={`button-studio-quickbar-stone-${code}`}><span className="studio-canvas-quickbar-swatch" style={{ background: stoneColorByName(code, stoneColors).tone }} />{code}</button>)}
      </div>}
      {state.basinSkus.length > 0 && <div className="studio-canvas-quickbar-group">
        <span>อ่าง</span>
        {state.basinSkus.map((sku) => {
          const product = basinProducts.find((item) => item.sku === sku);
          if (!product) return null;
          return <button type="button" key={sku} onClick={() => placeBasinOnCanvas(state, setState, product, resolveActiveBasinTarget(state, selectedRectangleId, selectedPlacementId))} data-testid={`button-studio-quickbar-basin-${sku}`}><MapPin size={11} /> {sku}</button>;
        })}
      </div>}
    </div>}

    {state.activeStone && <p className="mb-2 flex items-center gap-2 text-sm" data-testid="text-studio-active-stone-label">
      <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-border" style={{ background: activeStoneColor.tone }} aria-hidden="true" />
      <span>สีที่แสดงบนผัง: <strong>{activeStoneColor.name} ({activeStoneColor.code})</strong></span>
    </p>}

    {/* Workpiece Tabs */}
    <div className="studio-piece-tabs-bar">
      <div className="studio-piece-tabs" role="tablist" aria-label="รายการชิ้นงาน">
        {pieces.map((p, index) => {
          const isActive = p.id === activePiece.id;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`studio-piece-tab ${isActive ? "is-active" : ""}`}
              onClick={() => {
                setState((current) => ({ ...current, activePieceId: p.id }));
                setSelectedRectangleId(null);
                setSelectedPlacementId(null);
              }}
              data-testid={`tab-studio-piece-${p.id}`}
            >
              <span className="studio-piece-tab-title">{p.name || `ชิ้นงาน ${index + 1}`}</span>
              <span className="studio-piece-tab-badge">
                {p.rectangles.length} แผ่น · {studioPieceAreaSqM(p).toFixed(2)} m²
              </span>
              {pieces.length > 1 && (
                <span
                  role="button"
                  className="studio-piece-tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePiece(p.id);
                  }}
                  title={`ลบ ${p.name}`}
                  aria-label={`ลบ ${p.name}`}
                >
                  <X size={12} />
                </span>
              )}
            </button>
          );
        })}
        {pieces.length < STUDIO_MAX_PIECES && (
          <button
            type="button"
            className="button button--outline studio-piece-tab-add"
            onClick={addPiece}
            data-testid="button-add-studio-piece"
            title="เพิ่มชิ้นงานใหม่"
          >
            <Plus size={14} /> เพิ่มชิ้นงาน ({pieces.length}/{STUDIO_MAX_PIECES})
          </button>
        )}
      </div>
    </div>

    {/* Active Piece Shape Controls & Zoom */}
    <div className="studio-active-piece-controls">
      <div className="studio-piece-shape-section" id="studio-piece-shape-section">
        <p className="studio-helper">เลือกรูปทรงและกำหนดขนาดกับขอบของแต่ละแผ่น ก่อนประกอบผังลงกระดาน</p>
        <StudioCustomShapePanel
          key={shapePanelVersion}
          state={state}
          setState={setState}
          targetPiece={activePiece}
          simpleMode={simpleMode}
          onApplied={(result) => {
            setSelectedRectangleId(null);
            setSelectedPlacementId(null);
            onLayoutApplied();
            announceShapeApplied(result);
          }}
        />
        {shapeChange && shapeChange.notices.length > 0 && <div role="status" data-testid="status-studio-shape-change-notice">
          {shapeChange.notices.map((notice) => <p className="studio-warning" key={notice.placementId} data-testid={`status-studio-shape-change-${notice.kind}-${notice.placementId}`}><AlertTriangle size={15} /> {shapeChangeNoticeText(notice)}</p>)}
        </div>}
      </div>

      <div className="studio-zoom-toolbar" aria-label="ควบคุมการซูมผัง 2D">
        <span>ขยายผัง 2D</span>
        <button type="button" className="icon-button" onClick={() => setActivePieceZoom((current) => Math.max(.75, Math.round((current - .25) * 100) / 100))} aria-label="ซูมออก" data-testid="button-studio-zoom-out"><Minus size={15} /></button>
        <strong data-testid="studio-zoom-value">{Math.round(activePieceZoom * 100)}%</strong>
        <button type="button" className="icon-button" onClick={() => setActivePieceZoom((current) => Math.min(2, Math.round((current + .25) * 100) / 100))} aria-label="ซูมเข้า" data-testid="button-studio-zoom-in"><Plus size={15} /></button>
        <button type="button" className="button button--outline" onClick={() => setActivePieceZoom(1)} data-testid="button-studio-zoom-reset">100%</button>
      </div>
    </div>

    {/* Single Active Piece Editor */}
    <div className="studio-piece-workspace-container">
      {activePiece && (
        <StudioPieceEditor
          key={activePiece.id}
          piece={activePiece}
          state={state}
          setState={setState}
          zoom={activePieceZoom}
          selectedPlacementId={selectedPlacementId}
          setSelectedPlacementId={setSelectedPlacementId}
          selectedRectangleId={selectedRectangleId}
          setSelectedRectangleId={setSelectedRectangleId}
          basinProducts={basinProducts}
          stoneTone={activeStoneTone}
          stoneTexture={activeStoneTexture}
          simpleMode={simpleMode}
          showAddPiece={false}
        />
      )}
    </div>

    {/* Single Perspective Preview for the Active Workpiece */}
    {activePiece && (
      <StudioPerspectivePreview
        piece={activePiece}
        stoneTone={activeStoneTone}
        basinPlacements={state.basinPlacements.filter((placement) => (placement.pieceId ?? activePiece.id) === activePiece.id)}
      />
    )}
  </section>;
}

function StudioStoneComparison({ state, setState, stoneColors }: { state: StudioState; setState: Dispatch<SetStateAction<StudioState>>; stoneColors: ReadonlyArray<StoneColor> }) {
  const comparisons = useMemo(() => state.stoneColors.map((code) => {
    const stone = stoneColorByName(code, stoneColors);
    const estimate = studioEstimate({ ...state, activeStone: code }, PRODUCTS);
    const priceLabel = estimate.sheetCutPriceWarning ? "คิดตามแผ่นตัด" : estimate.stoneUnitPriceTHB === null ? "ติดต่อฝ่ายขาย" : formatTHB(estimate.stoneUnitPriceTHB);
    const stoneTotalLabel = estimate.sheetCutPriceWarning ? "คิดตามแผ่นตัด" : formatTHB(estimate.stoneTotalTHB);
    return { code, stone, estimate, priceLabel, stoneTotalLabel };
  }), [state, stoneColors]);
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

function BasinTopView({ product, testId }: { product?: BasinProduct; testId?: string }) {
  const shapeClass = isRoundBasinProduct(product) ? "is-round" : "is-rectangular";
  const realTopViewUrl = product?.topViewImageUrl || (product?.galleryImageUrls && product.galleryImageUrls.length > 0
    ? product.galleryImageUrls[product.galleryImageUrls.length - 1]
    : undefined);

  if (realTopViewUrl) {
    return (
      <span className={`studio-basin-top-view studio-basin-top-view--real ${shapeClass}`} data-testid={testId} aria-hidden="true">
        <img
          src={realTopViewUrl}
          alt={product?.sku ?? "อ่าง Top View"}
          className={`studio-basin-real-topview-img ${shapeClass}`}
          loading="eager"
        />
      </span>
    );
  }

  return <span className={`studio-basin-top-view ${shapeClass}`} data-testid={testId} aria-hidden="true">
    <span className="studio-basin-top-view-rim">
      <span className="studio-basin-top-view-bowl">
        <span className="studio-basin-top-view-drain" />
      </span>
    </span>
  </span>;
}

function StudioPlacementPreview({
  piece,
  placement,
  className = "",
  testId,
  basinProducts = PRODUCTS,
}: {
  piece: StudioPiece;
  placement: BasinPlacement;
  className?: string;
  testId?: string;
  basinProducts?: ReadonlyArray<BasinProduct>;
}) {
  const bounds = pieceBounds(piece);
  const sheet = piece.rectangles.find((rectangle) => rectangle.id === placement.sheetId);
  const coordinates = sheet && placement.offsetXMm !== undefined && placement.offsetYMm !== undefined
    ? calculateBasinCoordinates(sheet, placement)
    : { xMm: placement.xMm, yMm: placement.yMm };
  const cutSize = placementCutSize(placement);
  const unknown = cutSize.widthMm === null || cutSize.heightMm === null;
  const product = basinProducts.find((item) => item.sku === placement.sku);
  return <div
    className={`studio-placement studio-placement--top-view ${className} ${unknown ? "studio-placement--unknown" : ""}`}
    style={{
      left: `${(coordinates.xMm / Math.max(1, bounds.widthMm)) * 100}%`,
      top: `${(coordinates.yMm / Math.max(1, bounds.heightMm)) * 100}%`,
      width: unknown ? "18%" : `${((cutSize.widthMm ?? 0) / Math.max(1, bounds.widthMm)) * 100}%`,
      height: unknown ? "18%" : `${((cutSize.heightMm ?? 0) / Math.max(1, bounds.heightMm)) * 100}%`,
    }}
    data-testid={testId}
    aria-label={`ตำแหน่งอ่าง ${placement.sku}`}
  >
    <span className="studio-placement-visual">
      <BasinTopView product={product} testId={testId ? `${testId}-top-view` : undefined} />
    </span>
    <strong>{placement.sku}</strong>
    <small>{unknown
      ? "ขนาดหลุมไม่ระบุ"
      : `${Math.round(cutSize.widthMm ?? 0).toLocaleString("th-TH")}×${Math.round(cutSize.heightMm ?? 0).toLocaleString("th-TH")} มม. · ${basinPlacementOrientation(placement) === "vertical" ? "แนวตั้ง" : "แนวนอน"}`}</small>
  </div>;
}

function StudioPrintLayout({
  state,
  basinProducts,
  stoneColors,
}: {
  state: StudioState;
  basinProducts: ReadonlyArray<BasinProduct>;
  stoneColors: ReadonlyArray<StoneColor>;
}) {
  const pieces = getStudioPieces(state);
  return <section className="studio-print-layout" data-testid="studio-print-layout">
    <div className="studio-print-heading"><div><p className="eyebrow">KNIGHT BASINS / RECTANGLE WORKPIECES</p><h2>ผังประกอบ {pieces.length} ชิ้นงาน</h2></div><div className="studio-print-dimensions">พื้นที่รวม {studioEstimate(state, PRODUCTS).counterAreaSqM.toFixed(4)} m²</div></div>
    {pieces.map((piece) => {
      const placements = state.basinPlacements.filter((placement) => (placement.pieceId ?? pieces[0]?.id) === piece.id);
      return <div className="studio-print-piece" key={piece.id}>
        <h3>{piece.name}</h3>
        <StudioFootprint piece={piece} stoneTone={stoneColorByName(state.activeStone, stoneColors).tone} className="studio-print-canvas" testId={`studio-print-canvas-${piece.id}`} ariaLabel={`ผัง ${piece.name} สำหรับพิมพ์`}>
          {placements.map((placement) => <StudioPlacementPreview key={placement.id} piece={piece} placement={placement} basinProducts={basinProducts} className="studio-placement--print-preview" testId={`studio-print-placement-${piece.id}-${placement.id}`} />)}
        </StudioFootprint>
      </div>;
    })}
    <p className="studio-print-warning">{STUDIO_PRINT_NOTE}</p>
    <p className="studio-print-footnote">หน่วยมิลลิเมตร · พื้นที่คิดจากผลรวมสี่เหลี่ยม · ตรวจสอบหน้างานก่อนผลิต</p>
  </section>;
}

function StudioDraftCard({
  draft,
  onOpen,
  onCopy,
  onDelete,
  basinProducts,
  stoneColors,
}: {
  draft: NamedStudioDraftRecord;
  onOpen: () => void;
  onCopy: () => void;
  onDelete: () => void;
  basinProducts: ReadonlyArray<BasinProduct>;
  stoneColors: ReadonlyArray<StoneColor>;
}) {
  const estimate = studioEstimate(draft.state, PRODUCTS);
  const pieces = getStudioPieces(draft.state);
  return <article className="studio-saved-draft-card" data-testid={`studio-saved-draft-${draft.id}`}>
    <div className="studio-saved-draft-preview">
      {pieces.length > 0
        ? <div className="studio-saved-draft-piece-list">
          {pieces.map((piece) => {
            const placements = draft.state.basinPlacements.filter((placement) => (placement.pieceId ?? pieces[0]?.id) === piece.id);
            return <div className="studio-saved-draft-piece" key={piece.id}>
              <small>{piece.name}</small>
              <StudioFootprint piece={piece} stoneTone={stoneColorByName(draft.state.activeStone, stoneColors).tone} className="studio-saved-draft-canvas" testId={`studio-draft-preview-${draft.id}-${piece.id}`} ariaLabel={`ตัวอย่างแบบร่าง ${draft.name} ${piece.name}`}>
                {placements.map((placement) => <StudioPlacementPreview key={placement.id} piece={piece} placement={placement} basinProducts={basinProducts} className="studio-placement--draft-preview" testId={`studio-draft-placement-${draft.id}-${placement.id}`} />)}
              </StudioFootprint>
            </div>;
          })}
        </div>
        : <span>ไม่มีผัง</span>}
    </div>
    <div className="studio-saved-draft-content">
      <div className="studio-saved-draft-heading"><div><strong>{draft.name}</strong><small>บันทึกล่าสุด {formatDraftTimestamp(draft.savedAt)}</small></div><span>{draft.state.activeStone}</span></div>
      <div className="studio-saved-draft-summary"><span>{estimate.counterAreaSqM.toFixed(4)} m² · อ่าง {draft.state.basinPlacements.length} จุด</span><strong>{formatTHB(estimate.totalTHB)}</strong></div>
      <div className="studio-saved-draft-actions">
        <button type="button" className="button button--accent" onClick={onOpen} data-testid={`button-open-studio-draft-${draft.id}`}><Pencil size={14} /> เปิดทำต่อ</button>
        <button type="button" className="button button--outline" onClick={onCopy} data-testid={`button-copy-studio-draft-${draft.id}`}><Link2 size={14} /> คัดลอกลิงก์</button>
        <button type="button" className="icon-button studio-saved-draft-delete" onClick={onDelete} aria-label={`ลบแบบร่าง ${draft.name}`} data-testid={`button-delete-studio-draft-${draft.id}`}><Trash2 size={14} /></button>
      </div>
    </div>
  </article>;
}

function StudioDraftDrawer({
  drafts,
  onClose,
  onOpen,
  onCopy,
  onDelete,
  basinProducts,
  stoneColors,
}: {
  drafts: NamedStudioDraftRecord[];
  onClose: () => void;
  onOpen: (draft: NamedStudioDraftRecord) => void;
  onCopy: (draft: NamedStudioDraftRecord) => void;
  onDelete: (draft: NamedStudioDraftRecord) => void;
  basinProducts: ReadonlyArray<BasinProduct>;
  stoneColors: ReadonlyArray<StoneColor>;
}) {
  return <div className="studio-drafts-layer">
    <button type="button" className="studio-drafts-backdrop" onClick={onClose} aria-label="ปิดแบบร่างของฉัน" />
    <aside className="studio-drafts-drawer" role="dialog" aria-modal="true" aria-labelledby="studio-drafts-title" data-testid="studio-drafts-drawer">
      <div className="studio-drafts-drawer-heading"><div><p className="eyebrow">SAVED WORKSPACE</p><h2 id="studio-drafts-title">แบบร่างของฉัน <span>({drafts.length})</span></h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="ปิดแบบร่างของฉัน" data-testid="button-close-studio-drafts"><X size={18} /></button></div>
      {drafts.length === 0 ? <div className="studio-drafts-empty"><FolderOpen size={28} /><strong>ยังไม่มีแบบร่างที่ตั้งชื่อ</strong><small>กด “บันทึกแบบร่าง” เพื่อเก็บแบบไว้กลับมาทำต่อ</small></div> : <div className="studio-drafts-list">{drafts.map((draft) => <StudioDraftCard key={draft.id} draft={draft} basinProducts={basinProducts} stoneColors={stoneColors} onOpen={() => onOpen(draft)} onCopy={() => onCopy(draft)} onDelete={() => onDelete(draft)} />)}</div>}
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

/** Lightweight orientation cue so a customer can see at a glance how far
 * through the studio flow they are and what's left — reduces the "how much
 * more is there" drop-off risk on a long single-page flow. Purely a display
 * of existing state; doesn't gate navigation (nothing here is required in a
 * fixed order). */
function StudioProgressChecklist({ state, contact, estimate }: { state: StudioState; contact: typeof emptyContact; estimate: Pick<StudioEstimate, "counterAreaSqM">; }) {
  const steps: { label: string; done: boolean; optional?: boolean }[] = [
    { label: "เลือกสีหิน", done: state.stoneColors.length > 0 },
    { label: "เลือกอ่าง", done: state.basinSkus.length > 0, optional: true },
    { label: "จัดผังเคาน์เตอร์", done: estimate.counterAreaSqM > 0 },
    { label: "ข้อมูลติดต่อ", done: Boolean(contact.name.trim() && contact.phone.trim() && contact.project.trim() && contact.address.trim()) },
  ];
  return <ol className="studio-progress" aria-label="ความคืบหน้าการออกแบบ">
    {steps.map((step, index) => <li key={step.label} className={`studio-progress-step ${step.done ? "is-done" : ""}`}>
      <span className="studio-progress-step-icon" aria-hidden="true">{step.done ? <Check size={12} /> : index + 1}</span>
      <span>{step.label}{step.optional && <small> (ไม่บังคับ)</small>}</span>
    </li>)}
  </ol>;
}

const STUDIO_HISTORY_DEBOUNCE_MS = 500;
const STUDIO_HISTORY_LIMIT = 50;
const UNASSEMBLED_STUDIO_ESTIMATE: StudioEstimate = {
  pieceCount: 0,
  rectangleCount: 0,
  counterAreaSqM: 0,
  backsplashAreaSqM: 0,
  upstandAreaSqM: 0,
  upstandLengthM: 0,
  openEdgeLengthM: 0,
  stoneAreaSqM: 0,
  stoneUnitPriceTHB: null,
  stoneTotalTHB: 0,
  upstandTotalTHB: 0,
  openEdgeUnitPriceTHB: null,
  openEdgeTotalTHB: 0,
  basinSubtotalTHB: 0,
  installationChargeTHB: 0,
  installationDiscountTHB: 0,
  discountTHB: 0,
  smallJobFeeTHB: 0,
  grossSubtotalTHB: 0,
  subtotalTHB: 0,
  vatAmountTHB: 0,
  totalTHB: 0,
  standardSheetWarning: false,
  standardSheetMessage: "",
  sheetCutPriceWarning: false,
  upstandHeightMissing: false,
  openEdgePriceMissing: false,
  openEdgePriceInvalid: false,
  upstandHeightInvalid: false,
  basinOverlapWarnings: [],
  inactiveBasinSkus: [],
  overlapWarnings: [],
  unsafePlacements: [],
  crossJointPlacements: [],
  unknownDimensionPlacements: [],
  disconnectedRectangles: [],
  discountInvalid: false,
  warnings: [],
  isValid: false,
};

/** Debounced undo/redo history for the main Studio state. Coalesces rapid
 * successive edits (typing digits into a field, several drags in a row)
 * into one history entry once they settle for STUDIO_HISTORY_DEBOUNCE_MS,
 * so one Undo reverses a whole action instead of a single keystroke.
 *
 * This only changes how `state`/`setState` are declared — every one of the
 * ~30 existing `setState(...)` call sites elsewhere in this file keeps
 * calling the exact same function with the exact same signature, so none of
 * them needed to change. */
function useUndoableStudioState(initial: () => StudioState): [StudioState, Dispatch<SetStateAction<StudioState>>, { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean }] {
  const [state, setStateRaw] = useState<StudioState>(initial);
  const historyRef = useRef<StudioState[]>([]);
  const indexRef = useRef(0);
  const mountedRef = useRef(false);
  const skipSnapshotRef = useRef(false);
  const [, bumpHistoryVersion] = useState(0);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      historyRef.current = [state];
      indexRef.current = 0;
      return;
    }
    if (skipSnapshotRef.current) {
      skipSnapshotRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      // Dropping any "future" redo entries once a new edit branches off,
      // same as any standard undo stack.
      const truncated = historyRef.current.slice(0, indexRef.current + 1);
      historyRef.current = [...truncated, state].slice(-STUDIO_HISTORY_LIMIT);
      indexRef.current = historyRef.current.length - 1;
      bumpHistoryVersion((version) => version + 1);
    }, STUDIO_HISTORY_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  const undo = useCallback(() => {
    if (indexRef.current <= 0) return;
    indexRef.current -= 1;
    skipSnapshotRef.current = true;
    setStateRaw(historyRef.current[indexRef.current]);
    bumpHistoryVersion((version) => version + 1);
  }, []);
  const redo = useCallback(() => {
    if (indexRef.current >= historyRef.current.length - 1) return;
    indexRef.current += 1;
    skipSnapshotRef.current = true;
    setStateRaw(historyRef.current[indexRef.current]);
    bumpHistoryVersion((version) => version + 1);
  }, []);

  return [state, setStateRaw, { undo, redo, canUndo: indexRef.current > 0, canRedo: indexRef.current < historyRef.current.length - 1 }];
}

export function StudioPage({
  mode,
  leadKey,
  onSubmitStudio,
  onContactChange,
  contactDefaults,
  initialBasinSkus = [],
  initialStoneColors = [],
  stoneColors = STONE_COLORS,
  basinProducts = PRODUCTS,
}: StudioPageProps) {
  const [, setLocation] = useLocation();
  const studioRouteKey = mode === "studio" && typeof window !== "undefined"
    ? `${window.location.pathname}${window.location.search}`
    : "";
  const [assembledStudioRoute, setAssembledStudioRoute] = useState<string | null>(null);
  const studioLayoutApplied = mode !== "studio" || assembledStudioRoute === studioRouteKey;
  const studioSearchParams = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const leadIdParam = studioSearchParams.get("leadId");
  const isLeadLinkedMode = leadIdParam !== null;
  const linkedLeadId = leadIdParam?.trim() || null;
  const queryClient = useQueryClient();
  const leadsQuery = useListAdminLeads(undefined, { query: { enabled: linkedLeadId !== null } });
  const upsertLead = useUpsertLead();
  const linkedLead = linkedLeadId
    ? leadsQuery.data?.find((lead) => String(lead.id) === linkedLeadId) ?? null
    : null;
  const linkedSketchUrls = useMemo(() => linkedLeadSketchUrls(linkedLead), [linkedLead]);
  const linkedDraft = useMemo(
    () => isLeadLinkedMode
      ? { token: "", state: null as StudioState | null, catalogContext: undefined as StudioCatalogContext | undefined }
      : readLinkedDraft(),
    [isLeadLinkedMode, studioRouteKey],
  );
  const remoteDraftKey = mode === "studio" && !isLeadLinkedMode && isStudioApiDraftKey(linkedDraft.token)
    ? linkedDraft.token
    : "";
  const requestedBasinSku = (studioSearchParams.get("basinSku") ?? studioSearchParams.get("basin") ?? "").trim();
  const requestedBasinProduct = requestedBasinSku
    ? basinProducts.find((product) => product.sku.toLowerCase() === requestedBasinSku.toLowerCase())
    : undefined;
  const requestedStoneCode = (studioSearchParams.get("stoneColor") ?? studioSearchParams.get("stone") ?? "").trim();
  const requestedStoneColor = requestedStoneCode
    ? stoneColors.find((stone) => stone.code.toLowerCase() === requestedStoneCode.toLowerCase())
    : undefined;
  const requestedStudioPreset = studioPresetFromQuery(studioSearchParams.get("shape"));
  const requestedStudioWidthValue = Number(studioSearchParams.get("runAMm") ?? studioSearchParams.get("width"));
  const requestedStudioWidthMm = Number.isSafeInteger(requestedStudioWidthValue) && requestedStudioWidthValue > 0
    ? requestedStudioWidthValue
    : null;
  const requestedStudioDepthValue = Number(studioSearchParams.get("depthMm") ?? studioSearchParams.get("depth"));
  const requestedStudioDepthMm = Number.isSafeInteger(requestedStudioDepthValue) && requestedStudioDepthValue > 0
    ? requestedStudioDepthValue
    : null;
  const [state, setState, studioHistory] = useUndoableStudioState(() => {
    const initialStudioState = linkedDraft.state ?? createInitialStudioState(
      mode,
      initialBasinSkus,
      initialStoneColors,
      basinProducts,
      stoneColors,
      requestedBasinProduct?.sku,
    );
    const withRequestedStone = requestedStoneColor
      ? {
          ...initialStudioState,
          stoneColors: [...new Set([requestedStoneColor.code, ...initialStudioState.stoneColors])],
          activeStone: requestedStoneColor.code,
          stoneSelectionSource: "user" as const,
        }
      : initialStudioState;
    const withRequestedBasin = mode === "studio" && requestedBasinProduct
      ? addQueryBasinToStudioState(withRequestedStone, requestedBasinProduct)
      : withRequestedStone;
    const withRequestedStudioParameters = mode === "studio"
      ? applyStudioShareParameters(withRequestedBasin, requestedStudioPreset, requestedStudioWidthMm, requestedStudioDepthMm)
      : withRequestedBasin;
    return normalizeStudioState(withRequestedStudioParameters, basinProducts, stoneColors);
  });
  const [studioUiMode, setStudioUiMode] = useState<"simple" | "detailed">("simple");
  const isSimpleStudioMode = mode === "studio" && studioUiMode === "simple";
  const [studioShareFeedback, setStudioShareFeedback] = useState<"copied" | "failed" | null>(null);
  const studioShareFeedbackTimeoutRef = useRef<number | null>(null);
  const [draftNotice, setDraftNotice] = useState<StudioDraftRecord | null>(() => mode === "studio" && !isLeadLinkedMode && !linkedDraft.state && !remoteDraftKey ? readStoredStudioDraft() : null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(() => linkedDraft.state ? new Date().toISOString() : null);
  const [draftResult, setDraftResult] = useState(() => remoteDraftKey
    ? "กำลังโหลดแบบร่างจากลิงก์…"
    : linkedDraft.token && !linkedDraft.state
      ? "ลิงก์แบบร่างไม่ถูกต้องหรือหมดอายุ กรุณาเริ่มออกแบบใหม่"
      : "");
  const [catalogNotice, setCatalogNotice] = useState<StudioCatalogNotice | null>(() => linkedDraft.catalogContext ? studioCatalogNotice(linkedDraft.catalogContext, basinProducts) : null);
  const [namedDrafts, setNamedDrafts] = useState<NamedStudioDraftRecord[]>(() => mode === "studio" ? readStoredStudioDrafts() : []);
  const [editingNamedDraftId, setEditingNamedDraftId] = useState<string | null>(null);
  const [draftDrawerOpen, setDraftDrawerOpen] = useState(false);
  const [saveDraftDialogOpen, setSaveDraftDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [isLoadingShareableDraft, setIsLoadingShareableDraft] = useState(() => Boolean(remoteDraftKey));
  const [isSavingShareableDraft, setIsSavingShareableDraft] = useState(false);
  const [shareableDraftDialogOpen, setShareableDraftDialogOpen] = useState(false);
  const [shareableDraftUrl, setShareableDraftUrl] = useState("");
  const [shareableDraftCopied, setShareableDraftCopied] = useState(false);
  const skipNextDraftSave = useRef(false);
  const hasMountedDraftEffect = useRef(false);
  const linkedLeadHydratedRef = useRef<string | null>(null);
  const appliedQueryBasinSkuRef = useRef<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [contact, setContact] = useState(() => ({ ...emptyContact, ...contactDefaults }));
  const [worksitePlaceId, setWorksitePlaceId] = useState<string | null>(null);
  const [expandedSketchUrl, setExpandedSketchUrl] = useState<string | null>(null);
  const [sketchImageZoomed, setSketchImageZoomed] = useState(false);
  const [savedLeadStateFingerprint, setSavedLeadStateFingerprint] = useState<string | null>(null);
  const [sketchFiles, setSketchFiles] = useState<File[]>([]);
  const [sketchPreviewUrls, setSketchPreviewUrls] = useState<string[]>([]);
  const [sketchDropActive, setSketchDropActive] = useState(false);
  const [rotatingSketchFile, setRotatingSketchFile] = useState<File | null>(null);
  const [sketchAnalysisByFile, setSketchAnalysisByFile] = useState<Map<File, SketchAnalysisCardState>>(() => new Map());
  const [sketchStatus, setSketchStatus] = useState<SketchProcessingStatus | null>(null);
  const sketchPreviewUrlCache = useRef<Map<File, string>>(new Map());
  const sketchInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const sketchFilesRef = useRef<File[]>([]);
  const rotatingSketchFileRef = useRef<File | null>(null);
  const sketchAnalysisQueueRef = useRef<Promise<void>>(Promise.resolve());
  const sketchDimensionEditVersionRef = useRef(0);
  const activeSketchAnalysisFileRef = useRef<File | null>(null);
  const sketchLengthMm = state.pieces?.[0]?.rectangles[0]?.widthMm ?? state.dimensions.runAMm;
  const sketchDepthMm = state.pieces?.[0]?.rectangles[0]?.lengthMm ?? state.dimensions.depthMm;
  const [sketchDimensionDrafts, setSketchDimensionDrafts] = useState(() => ({
    length: String(sketchLengthMm),
    depth: String(sketchDepthMm),
  }));
  const previousSketchDimensionsRef = useRef({ length: sketchLengthMm, depth: sketchDepthMm });
  const sketchDimensionsValid =
    parseBoundedIntegerInput(sketchDimensionDrafts.length, 100, 10_000, 10) !== null &&
    parseBoundedIntegerInput(sketchDimensionDrafts.depth, 100, 3_000, 10) !== null;
  useEffect(() => {
    const previous = previousSketchDimensionsRef.current;
    if (previous.length === sketchLengthMm && previous.depth === sketchDepthMm) return;
    setSketchDimensionDrafts((current) => ({
      length: previous.length === sketchLengthMm ? current.length : String(sketchLengthMm),
      depth: previous.depth === sketchDepthMm ? current.depth : String(sketchDepthMm),
    }));
    previousSketchDimensionsRef.current = { length: sketchLengthMm, depth: sketchDepthMm };
  }, [sketchLengthMm, sketchDepthMm]);
  const updateSketchDimension = (field: "length" | "depth", value: string) => {
    setSketchDimensionDrafts((current) => ({ ...current, [field]: value }));
    sketchDimensionEditVersionRef.current += 1;
    const parsed = field === "length"
      ? parseBoundedIntegerInput(value, 100, 10_000, 10)
      : parseBoundedIntegerInput(value, 100, 3_000, 10);
    if (parsed === null) return;
    setState((current) => field === "length"
      ? {
          ...current,
          dimensions: { ...current.dimensions, runAMm: parsed },
          pieces: current.pieces ? current.pieces.map((piece, pieceIndex) => pieceIndex === 0 ? {
            ...piece,
            rectangles: piece.rectangles.map((rectangle, rectangleIndex) => rectangleIndex === 0 ? { ...rectangle, widthMm: parsed } : rectangle),
          } : piece) : current.pieces,
        }
      : {
          ...current,
          dimensions: { ...current.dimensions, depthMm: parsed },
          pieces: current.pieces ? current.pieces.map((piece, pieceIndex) => pieceIndex === 0 ? {
            ...piece,
            rectangles: piece.rectangles.map((rectangle, rectangleIndex) => rectangleIndex === 0 ? { ...rectangle, lengthMm: parsed } : rectangle),
          } : piece) : current.pieces,
        });
  };
  useEffect(() => {
    if (mode !== "studio" || !requestedBasinSku) return;
    const product = basinProducts.find((item) => item.sku.toLowerCase() === requestedBasinSku.toLowerCase());
    if (!product || appliedQueryBasinSkuRef.current === product.sku) return;
    appliedQueryBasinSkuRef.current = product.sku;
    setState((current) => addQueryBasinToStudioState(current, product));
  }, [mode, requestedBasinSku, basinProducts, setState]);
  useEffect(() => () => {
    if (studioShareFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(studioShareFeedbackTimeoutRef.current);
    }
  }, []);
  const [result, setResult] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkout, setCheckout] = useState<{ token: string; quoteNumber: string; quoteTotalTHB: number } | null>(null);
  const submissionInFlightRef = useRef(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [pieceZoom, setPieceZoom] = useState<Record<string, number>>({});
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [selectedRectangleId, setSelectedRectangleId] = useState<string | null>(null);
  useEffect(() => {
    linkedLeadHydratedRef.current = null;
    setSavedLeadStateFingerprint(null);
    setExpandedSketchUrl(null);
    setSketchImageZoomed(false);
  }, [linkedLeadId]);
  useEffect(() => {
    if (!isLeadLinkedMode || !linkedLeadId || !linkedLead) return;
    if (linkedLeadHydratedRef.current === linkedLeadId) return;
    const savedStudioData = studioDataRecord(linkedLead.studioData);
    const restoredState = linkedLeadStudioState(linkedLead.studioData);
    const savedBasinSkus = Array.isArray(savedStudioData.basinSkus)
      ? savedStudioData.basinSkus.filter((sku): sku is string => typeof sku === "string")
      : linkedLead.productSkus;
    const savedStoneColors = Array.isArray(savedStudioData.stoneColors)
      ? savedStudioData.stoneColors.filter((color): color is string => typeof color === "string")
      : initialStoneColors;
    const nextState = restoredState ?? createInitialStudioState("studio", savedBasinSkus, savedStoneColors, basinProducts, stoneColors);
    linkedLeadHydratedRef.current = linkedLeadId;
    setState(normalizeStudioState(nextState, basinProducts, stoneColors));
    setContact({
      ...emptyContact,
      name: linkedLead.name ?? "",
      company: linkedLead.company ?? "",
      phone: linkedLead.phone ?? "",
      email: linkedLead.email ?? "",
      project: linkedLead.project ?? "",
      address: linkedLead.address ?? "",
      site: linkedLead.site ?? "",
      purchasingDepartment: linkedLead.purchasingDepartment ?? "",
      notes: linkedLead.notes ?? "",
      lineContact: linkedLead.lineContact ?? "",
    });
    setWorksitePlaceId(typeof savedStudioData.worksitePlaceId === "string" ? savedStudioData.worksitePlaceId : null);
    setDraftNotice(null);
    setCatalogNotice(null);
    setDraftResult("");
    setLastSavedAt(null);
    setResult("");
    setPieceZoom({});
    setSelectedPlacementId(null);
    setSelectedRectangleId(null);
  }, [basinProducts, initialStoneColors, isLeadLinkedMode, linkedLead, linkedLeadId, setState, stoneColors]);
  useEffect(() => {
    if (mode !== "studio" || (state.upstandHeightMm !== null && state.upstandHeightMm !== undefined)) return;
    if (document.activeElement?.getAttribute("data-testid") === "input-studio-upstand-height") return;
    setState((current) => current.upstandHeightMm === null || current.upstandHeightMm === undefined
      ? { ...current, upstandHeightMm: 120 }
      : current);
  }, [mode, setState, state.upstandHeightMm]);
  useEffect(() => {
    if (!isSimpleStudioMode) return;
    const currentPieces = getStudioPieces(state);
    const activePiece = currentPieces.find((piece) => piece.id === state.activePieceId) ?? currentPieces[0];
    if (!activePiece) return;
    const nextPiece = applySimpleShapeEdgeDefaults(activePiece, activePiece);
    if (JSON.stringify(nextPiece.sideStatuses) === JSON.stringify(activePiece.sideStatuses)) return;
    setState((current) => {
      const pieces = getStudioPieces(current);
      const currentPiece = pieces.find((piece) => piece.id === activePiece.id);
      if (!currentPiece) return current;
      const mappedPiece = applySimpleShapeEdgeDefaults(currentPiece, currentPiece);
      if (JSON.stringify(mappedPiece.sideStatuses) === JSON.stringify(currentPiece.sideStatuses)) return current;
      return { ...current, pieces: pieces.map((piece) => piece.id === currentPiece.id ? mappedPiece : piece) };
    });
  }, [isSimpleStudioMode, setState, state.activePieceId, state.pieces]);
  const handleTouchBasinDrop = useCallback((sku: string, clientX: number, clientY: number) => {
    const target = document.elementFromPoint(clientX, clientY);
    const canvas = target?.closest<HTMLElement>(".studio-canvas[data-studio-piece-id]");
    const pieceId = canvas?.dataset.studioPieceId;
    const product = basinProducts.find((item) => item.sku === sku);
    const piece = getStudioPieces(state).find((item) => item.id === pieceId);
    if (!canvas || !piece || !product) return false;
    const zoomForPiece = pieceZoom[piece.id] ?? 1;
    const point = zoomAwareCanvasPoint(canvas.getBoundingClientRect(), clientX, clientY, zoomForPiece, pieceBounds(piece));
    const sheet = resolveBasinSheet(piece, selectedRectangleId, point);
    if (!sheet) return false;
    const placement = createStudioBasinPlacement(product, state.basinPlacements.length, piece.id, sheet.id, sheet);
    const cutSize = placementCutSize(placement);
    const xMm = point.xMm - (cutSize.widthMm ?? 0) / 2;
    const yMm = point.yMm - (cutSize.heightMm ?? 0) / 2;
    setSelectedPlacementId(placement.id);
    setSelectedRectangleId(null);
    setState((current) => ({
      ...current,
      basinPlacements: [...current.basinPlacements, placementAtCoordinates(placement, piece, sheet, xMm, yMm)],
    }));
    return true;
  }, [basinProducts, pieceZoom, selectedRectangleId, setState, state]);
  const estimate = useMemo(
    () => mode === "studio" && !studioLayoutApplied
      ? UNASSEMBLED_STUDIO_ESTIMATE
      : studioEstimate(state, basinProducts),
    [mode, state, basinProducts, studioLayoutApplied],
  );
  const basinClearanceViolationIds = useMemo(
    () => mode === "studio" && studioLayoutApplied
      ? basinPlacementsViolatingEdgeClearance(state, MIN_BASIN_CLEARANCE_MM)
      : [],
    [mode, state, studioLayoutApplied],
  );
  const basinJointViolationIds = mode === "studio" && studioLayoutApplied
    ? estimate.crossJointPlacements
    : [];
  const hasBasinClash = mode === "studio" && studioLayoutApplied &&
    (basinClearanceViolationIds.length > 0 || basinJointViolationIds.length > 0);
  const activeStone = stoneColorByName(state.activeStone, stoneColors);
  const counterStoneTotal = Math.max(0, estimate.stoneTotalTHB - estimate.upstandTotalTHB);
  const exportReady = mode === "studio" && studioLayoutApplied && studioExportDimensionsValid(state);
  const exportName = contact.project || "studio-layout";
  const today = thaiDateInputValue(new Date());
  const hasPastInstallationDate = Boolean(contact.expectedInstallationDate && contact.expectedInstallationDate < today);
  const missingTaxIdForVat = state.vat && !/^[0-9]{13}$/.test(contact.taxId);
  // Every currently-outstanding issue, studio-layout ones always live and
  // contact-field ones only once the customer has tried submitting at least
  // once — showing "required" errors on fields nobody's reached yet would be
  // premature nagging, but once they've tried, a full checklist beats
  // discovering one blocker per submit attempt.
  const studioIssues = useMemo(() => {
    const issues = studioSubmissionValidationMessages(state, estimate).map((issue) =>
      issue === STUDIO_BASIN_MODEL_JOINT_WARNING ? STUDIO_BASIN_JOINT_WARNING : issue,
    );
    if (basinClearanceViolationIds.length > 0) issues.unshift(STUDIO_BASIN_CLEARANCE_WARNING);
    if (!hasAttemptedSubmit) return issues;
    const contactIssues: string[] = [];
    if (!contact.name.trim() || !contact.phone.trim() || !contact.project.trim() || !contact.address.trim()) contactIssues.push("กรุณากรอกชื่อผู้ติดต่อ โทรศัพท์ ชื่อโครงการ และสถานที่ติดตั้ง");
    if (contact.phone.trim() && !isValidPhoneNumber(contact.phone)) contactIssues.push("เบอร์โทรศัพท์ต้องเป็นตัวเลข 9–10 หลัก");
    if (contact.taxId && !/^[0-9]{13}$/.test(contact.taxId)) contactIssues.push("เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก");
    if (hasPastInstallationDate) contactIssues.push("วันที่เข้าติดตั้งต้องไม่เป็นวันที่ผ่านมา");
    if (contact.email.trim() && !isValidEmailAddress(contact.email)) contactIssues.push("กรุณากรอกอีเมลให้ถูกต้อง (เช่น name@example.com)");
    return [...issues, ...contactIssues];
  }, [state, estimate, basinClearanceViolationIds, hasAttemptedSubmit, contact.name, contact.phone, contact.project, contact.address, contact.taxId, contact.email, hasPastInstallationDate]);
  useEffect(() => {
    if (mode !== "studio") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target as HTMLElement | null;
      // Leave native per-field undo alone while typing in a text field.
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        studioHistory.undo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        studioHistory.redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, studioHistory.undo, studioHistory.redo]);
  useEffect(() => {
    // Keep each file's preview URL stable across renders instead of
    // revoking and recreating every slot whenever one file is added or
    // removed elsewhere in the list.
    const cache = sketchPreviewUrlCache.current;
    const activeFiles = new Set(sketchFiles);
    for (const [file, url] of cache) {
      if (!activeFiles.has(file)) {
        URL.revokeObjectURL(url);
        cache.delete(file);
      }
    }
    setSketchPreviewUrls(sketchFiles.map((file) => {
      let url = cache.get(file);
      if (!url) {
        url = URL.createObjectURL(file);
        cache.set(file, url);
      }
      return url;
    }));
  }, [sketchFiles]);
  useEffect(() => () => {
    sketchPreviewUrlCache.current.forEach((url) => URL.revokeObjectURL(url));
    sketchPreviewUrlCache.current.clear();
  }, []);
  useEffect(() => {
    if (!expandedSketchUrl) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpandedSketchUrl(null);
        setSketchImageZoomed(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [expandedSketchUrl]);
  const updateSketchAnalysisCard = (file: File, patch: Partial<SketchAnalysisCardState>) => {
    setSketchAnalysisByFile((current) => {
      const next = new Map(current);
      const previous = next.get(file) ?? {
        shape: "unknown" as const,
        confidence: null,
        notes: "",
        runAMm: null,
        depthMm: null,
        workpieceCount: 0,
        workpieces: [],
        phase: "queued" as const,
      };
      next.set(file, { ...previous, ...patch });
      return next;
    });
  };
  const analyzeSketch = async (files: File[]) => {
    for (const file of files) {
      if (!sketchFilesRef.current.includes(file)) continue;
      const dimensionEditVersion = sketchDimensionEditVersionRef.current;
      activeSketchAnalysisFileRef.current = file;
      updateSketchAnalysisCard(file, { phase: "uploading" });
      setSketchStatus({
        phase: "uploading",
        message: "[1/3] 📤 กำลังอัปโหลดภาพเข้าสู่ระบบ…",
        busy: true,
      });
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      if (!sketchFilesRef.current.includes(file)) continue;

      updateSketchAnalysisCard(file, { phase: "analyzing" });
      setSketchStatus({
        phase: "analyzing",
        message: "[2/3] 🧠 AI กำลังวิเคราะห์ลายมือและรูปทรงเคาน์เตอร์…",
        busy: true,
      });
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/sketch/analyze", { method: "POST", body: formData });
        if (!response.ok) {
          if (response.status === 429) {
            throw new Error("RATE_LIMIT");
          }
          throw new Error(`Sketch analysis request failed: HTTP ${response.status}`);
        }
        const analysis = parseSketchAnalysis(await response.json() as unknown);
        if (!sketchFilesRef.current.includes(file)) continue;

        const dimensionsAvailable = analysis.runAMm !== null && analysis.depthMm !== null;
        const recognized = analysis.shape !== "unknown" && dimensionsAvailable;
        if (recognized) {
          setSketchStatus({
            phase: "calculating",
            message: "[3/3] 📐 AI ถอดขนาดสำเร็จ กำลังคำนวณราคา…",
            busy: true,
          });
          await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
          if (!sketchFilesRef.current.includes(file)) continue;
        }
        if (recognized && dimensionEditVersion === sketchDimensionEditVersionRef.current) {
          const requestedPreset: StudioPreset = analysis.shape === "U"
            ? "u"
            : analysis.shape === "L-right"
              ? "l-right"
              : analysis.shape === "L" || analysis.shape === "L-left"
                ? "l-left"
                : "i";
          setState((current) => {
            const resizedState = applyStudioShareParameters(
              current,
              requestedPreset,
              analysis.runAMm!,
              analysis.depthMm!,
            );
            return {
              ...resizedState,
              dimensions: {
                ...resizedState.dimensions,
                runAMm: analysis.runAMm!,
                depthMm: analysis.depthMm!,
              },
            };
          });
        }
        updateSketchAnalysisCard(file, {
          ...analysis,
          notes: analysis.notes || (recognized ? "กรุณาตรวจสอบขนาดที่อ่านได้" : SKETCH_ANALYSIS_FALLBACK_MESSAGE),
          phase: recognized ? "complete" : "unknown",
        });
        setSketchStatus(recognized
          ? {
              phase: "success",
              message: "✅ ตรวจสอบตัวเลขที่ AI อ่านได้ แล้วแก้ไขได้ทันที",
              busy: false,
            }
          : {
              phase: "error",
              message: SKETCH_ANALYSIS_FALLBACK_MESSAGE,
              busy: false,
            });
      } catch (err: unknown) {
        if (!sketchFilesRef.current.includes(file)) continue;
        const isRateLimit = err instanceof Error && err.message === "RATE_LIMIT";
        const message = isRateLimit ? SKETCH_ANALYSIS_RATE_LIMIT_MESSAGE : SKETCH_ANALYSIS_FALLBACK_MESSAGE;
        updateSketchAnalysisCard(file, {
          shape: "unknown",
          confidence: null,
          notes: message,
          runAMm: null,
          depthMm: null,
          workpieceCount: 0,
          workpieces: [],
          phase: "unknown",
        });
        setSketchStatus({
          phase: "error",
          message,
          busy: false,
        });
      } finally {
        if (activeSketchAnalysisFileRef.current === file) activeSketchAnalysisFileRef.current = null;
      }
    }
  };
  const rotateSketchAtIndex = async (index: number) => {
    if (
      submissionInFlightRef.current ||
      sketchStatus?.busy ||
      rotatingSketchFileRef.current
    ) return;

    const file = sketchFilesRef.current[index];
    if (!file) return;
    const analysisPhase = sketchAnalysisByFile.get(file)?.phase;
    if (analysisPhase === "queued" || analysisPhase === "uploading" || analysisPhase === "analyzing") return;

    rotatingSketchFileRef.current = file;
    setRotatingSketchFile(file);
    setSketchStatus({
      phase: "analyzing",
      message: "กำลังหมุนภาพแบบร่าง…",
      busy: true,
    });

    try {
      const rotatedFile = await rotateSketchFile(file);
      const currentIndex = sketchFilesRef.current.indexOf(file);
      if (currentIndex === -1) return;

      const nextFiles = [...sketchFilesRef.current];
      nextFiles[currentIndex] = rotatedFile;
      sketchFilesRef.current = nextFiles;
      setSketchFiles(nextFiles);
      setSketchAnalysisByFile((current) => {
        const next = new Map(current);
        next.delete(file);
        next.set(rotatedFile, {
          shape: "unknown",
          confidence: null,
          notes: "กำลังรอผลวิเคราะห์",
          runAMm: null,
          depthMm: null,
          workpieceCount: 0,
          workpieces: [],
          phase: "queued",
        });
        return next;
      });
      setResult("");
      setSketchStatus({
        phase: "uploading",
        message: "หมุนภาพแล้ว กำลังส่งวิเคราะห์ใหม่…",
        busy: true,
      });

      sketchAnalysisQueueRef.current = sketchAnalysisQueueRef.current.then(() => analyzeSketch([rotatedFile]));
      await sketchAnalysisQueueRef.current;
    } catch {
      setSketchStatus({
        phase: "error",
        message: "หมุนภาพไม่สำเร็จ กรุณาลองอีกครั้ง",
        busy: false,
      });
    } finally {
      rotatingSketchFileRef.current = null;
      setRotatingSketchFile(null);
    }
  };
  const addSketchFiles = (files: File[]) => {
    if (submissionInFlightRef.current) return;
    if (!files.length) return;
    const currentFiles = sketchFilesRef.current;
    const remaining = Math.max(0, MAX_SKETCH_FILES - currentFiles.length);
    const accepted = files
      .filter((file) => file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file.name))
      .slice(0, remaining);
    if (!accepted.length) {
      if (remaining > 0) {
        setSketchStatus({
          phase: "error",
          message: "กรุณาเลือกไฟล์ภาพ JPG, PNG, WEBP หรือ GIF",
          busy: false,
        });
      }
      return;
    }
    const nextFiles = [...currentFiles, ...accepted];
    sketchFilesRef.current = nextFiles;
    setSketchFiles(nextFiles);
    setSketchAnalysisByFile((current) => {
      const next = new Map(current);
      accepted.forEach((file) => next.set(file, {
        shape: "unknown",
        confidence: null,
        notes: "กำลังรอผลวิเคราะห์",
        runAMm: null,
        depthMm: null,
        workpieceCount: 0,
        workpieces: [],
        phase: "queued",
      }));
      return next;
    });
    setResult("");
    sketchAnalysisQueueRef.current = sketchAnalysisQueueRef.current.then(() => analyzeSketch(accepted));
  };
  const removeSketchFile = (index: number) => {
    if (submissionInFlightRef.current) return;
    const file = sketchFilesRef.current[index];
    if (!file) return;
    const nextFiles = sketchFilesRef.current.filter((_, fileIndex) => fileIndex !== index);
    sketchFilesRef.current = nextFiles;
    setSketchFiles(nextFiles);
    setSketchAnalysisByFile((current) => {
      const next = new Map(current);
      next.delete(file);
      return next;
    });
    if (activeSketchAnalysisFileRef.current === file) {
      activeSketchAnalysisFileRef.current = null;
      setSketchStatus(nextFiles.length
        ? { phase: "success", message: "ตรวจสอบตัวเลขที่ AI อ่านได้ แล้วแก้ไขได้ทันที", busy: false }
        : null);
    } else if (!nextFiles.length) {
      setSketchStatus(null);
    }
  };
  useEffect(() => {
    if (!contactDefaults || isLeadLinkedMode) return;
    setContact((current) => ({
      ...current,
      name: contactDefaults.name || current.name,
      company: contactDefaults.company || current.company,
      phone: contactDefaults.phone || current.phone,
      email: contactDefaults.email || current.email,
      project: contactDefaults.project || current.project,
      address: contactDefaults.address || current.address,
      site: contactDefaults.site || current.site,
      purchasingDepartment: contactDefaults.purchasingDepartment || current.purchasingDepartment,
      notes: contactDefaults.notes || current.notes,
      lineContact: contactDefaults.lineContact || current.lineContact,
      taxName: contactDefaults.taxName || current.taxName,
      taxId: contactDefaults.taxId || current.taxId,
      taxBranch: contactDefaults.taxBranch || current.taxBranch,
      taxAddress: contactDefaults.taxAddress || current.taxAddress,
      preferredContact: contactDefaults.preferredContact || current.preferredContact,
      customerRole: contactDefaults.customerRole || current.customerRole,
      propertyType: contactDefaults.propertyType || current.propertyType,
      condoFloor: contactDefaults.condoFloor || current.condoFloor,
      expectedInstallationDate: contactDefaults.expectedInstallationDate || current.expectedInstallationDate,
    }));
  }, [contactDefaults?.name, contactDefaults?.company, contactDefaults?.phone, contactDefaults?.email, contactDefaults?.project, contactDefaults?.address, contactDefaults?.site, contactDefaults?.purchasingDepartment, contactDefaults?.notes, contactDefaults?.lineContact, contactDefaults?.taxName, contactDefaults?.taxId, contactDefaults?.taxBranch, contactDefaults?.taxAddress, contactDefaults?.preferredContact, contactDefaults?.customerRole, contactDefaults?.propertyType, contactDefaults?.condoFloor, contactDefaults?.expectedInstallationDate, isLeadLinkedMode]);
  useEffect(() => {
    if (!isLeadLinkedMode) onContactChange?.(contact);
  }, [contact, isLeadLinkedMode, onContactChange]);
  useEffect(() => {
    if (!estimate.crossJointPlacements.length && result === "อ่างวางตรงรอยต่อแผ่น กรุณาขยับอ่างให้อยู่ภายในแผ่นเดียว") {
      setResult("");
    }
  }, [estimate.crossJointPlacements.length, result]);
  useEffect(() => {
    if (!remoteDraftKey) {
      setIsLoadingShareableDraft(false);
      return;
    }
    let isCurrent = true;
    setIsLoadingShareableDraft(true);
    void customFetch<unknown>(`/api/studio/draft/${encodeURIComponent(remoteDraftKey)}`, { responseType: "json" })
      .then((remoteDraft) => {
        if (!isCurrent) return;
        setState((current) => restoreStudioDraftState(current, remoteDraft, basinProducts, stoneColors));
        const response = studioDataRecord(remoteDraft);
        const savedDraft = studioDataRecord(response.draft ?? response.data ?? remoteDraft);
        const savedAt = typeof savedDraft.savedAt === "string" && !Number.isNaN(Date.parse(savedDraft.savedAt))
          ? savedDraft.savedAt
          : new Date().toISOString();
        setLastSavedAt(savedAt);
        setDraftNotice(null);
        setEditingNamedDraftId(null);
        setCatalogNotice(null);
        setPieceZoom({});
        setSelectedPlacementId(null);
        setSelectedRectangleId(null);
        setDraftResult("เปิดแบบร่างจากลิงก์แล้ว");
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        const status = studioDataRecord(error).status;
        setDraftResult(status === 404
          ? "ไม่พบแบบร่างหรือลิงก์หมดอายุแล้ว"
          : "โหลดแบบร่างไม่สำเร็จ กรุณาลองเปิดลิงก์อีกครั้ง");
      })
      .finally(() => {
        if (isCurrent) setIsLoadingShareableDraft(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [remoteDraftKey, basinProducts, stoneColors, setState]);
  useEffect(() => {
    if (mode !== "studio" || isLeadLinkedMode || isLoadingShareableDraft) return;
    if (!hasMountedDraftEffect.current) {
      hasMountedDraftEffect.current = true;
      return;
    }
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false;
      return;
    }
    setIsSavingDraft(true);
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      const catalogContext = catalogNotice?.context ?? createStudioCatalogContext(state, basinProducts, savedAt);
      const saved = writeStoredStudioDraft({ version: 1, savedAt, state, catalogContext });
      if (saved) setLastSavedAt(savedAt);
      setIsSavingDraft(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [mode, isLeadLinkedMode, isLoadingShareableDraft, state, basinProducts, catalogNotice]);
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
    setState(normalizeStudioState(draftNotice.state, basinProducts, stoneColors));
    setLastSavedAt(draftNotice.savedAt);
    setCatalogNotice(draftNotice.catalogContext ? studioCatalogNotice(draftNotice.catalogContext, basinProducts) : null);
    setDraftNotice(null);
    setDraftResult("ดึงแบบร่างเดิมแล้ว");
  };
  const startNewDraft = () => {
    clearStoredStudioDraft();
    setEditingNamedDraftId(null);
    skipNextDraftSave.current = true;
    setState(createInitialStudioState(mode, initialBasinSkus, initialStoneColors, basinProducts, stoneColors));
    setLastSavedAt(null);
    setDraftNotice(null);
    setCatalogNotice(null);
    setDraftResult("");
    setPieceZoom({});
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
    const normalizedState = normalizeStudioState(state, basinProducts, stoneColors);
    const catalogContext = catalogNotice?.context ?? createStudioCatalogContext(normalizedState, basinProducts, savedAt);
    writeStoredStudioDraft({ version: 1, savedAt, state: normalizedState, catalogContext });
    setLastSavedAt(savedAt);
    await copyStateLink(normalizedState, "บันทึกและคัดลอกลิงก์แบบร่างแล้ว เปิดลิงก์นี้ใน Incognito เพื่อแก้ไขต่อได้", createStudioShareLink, catalogContext);
  };
  const saveStudioDraftForResume = async () => {
    if (isSavingShareableDraft) return;
    setIsSavingShareableDraft(true);
    setShareableDraftUrl("");
    setShareableDraftCopied(false);
    try {
      const normalizedState = normalizeStudioState(state, basinProducts, stoneColors);
      const saved = await customFetch<StudioDraftApiResponse>("/api/studio/draft", {
        method: "POST",
        body: JSON.stringify(createStudioDraftPayload(normalizedState)),
        responseType: "json",
      });
      if (!isStudioApiDraftKey(saved.draftKey) || typeof saved.resumeUrl !== "string" || !saved.resumeUrl.trim()) {
        throw new Error("The draft API returned an invalid resume link.");
      }
      setShareableDraftUrl(new URL(saved.resumeUrl, window.location.origin).toString());
      setShareableDraftDialogOpen(true);
      setDraftResult("บันทึกแบบร่างสำหรับเปิดต่อแล้ว");
    } catch {
      setDraftResult("บันทึกแบบร่างไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setIsSavingShareableDraft(false);
    }
  };
  const copyShareableDraftUrl = async () => {
    if (!shareableDraftUrl) return;
    try {
      await navigator.clipboard.writeText(shareableDraftUrl);
      setShareableDraftCopied(true);
      setDraftResult("คัดลอกลิงก์แบบร่างแล้ว");
    } catch {
      setShareableDraftCopied(false);
      setDraftResult("คัดลอกไม่สำเร็จ เลือก URL ในช่องแล้วคัดลอกด้วยตนเอง");
    }
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
    setState(normalizeStudioState(draft.state, basinProducts, stoneColors));
    setLastSavedAt(draft.savedAt);
    setCatalogNotice(draft.catalogContext ? studioCatalogNotice(draft.catalogContext, basinProducts) : null);
    setDraftDrawerOpen(false);
    setDraftResult(`เปิดแบบร่าง “${draft.name}” แล้ว`);
  };
  const copyNamedDraftLink = async (draft: NamedStudioDraftRecord) => {
    const normalizedState = normalizeStudioState(draft.state, basinProducts, stoneColors);
    const catalogContext = draft.catalogContext ?? createStudioCatalogContext(normalizedState, basinProducts, draft.savedAt);
    const url = createStudioDraftLink(normalizedState, window.location.origin, undefined, catalogContext);
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
  const copyStudioShareLinkToClipboard = async () => {
    const url = new URL(window.location.pathname, window.location.origin);
    const basinSku = state.basinPlacements[0]?.sku ?? state.basinSkus[0];
    const firstPiece = getStudioPieces(state)[0];
    const firstRectangle = firstPiece?.rectangles[0];
    if (basinSku) url.searchParams.set("basin", basinSku);
    if (state.activeStone) url.searchParams.set("stone", state.activeStone);
    if (firstRectangle) url.searchParams.set("width", String(Math.round(firstRectangle.widthMm)));
    url.searchParams.set("shape", studioPresetForShare(state, firstPiece));

    let feedback: "copied" | "failed" = "copied";
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      feedback = "failed";
    }
    setStudioShareFeedback(feedback);
    if (studioShareFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(studioShareFeedbackTimeoutRef.current);
    }
    studioShareFeedbackTimeoutRef.current = window.setTimeout(() => {
      setStudioShareFeedback(null);
      studioShareFeedbackTimeoutRef.current = null;
    }, 2000);
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
      setResult(format === "png" ? "บันทึกภาพผังแล้ว — ส่งต่อให้ทีมงานหรือครอบครัวดูได้เลย" : `ดาวน์โหลดแบบ ${format.toUpperCase()} แล้ว`);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "สร้างไฟล์แบบไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
  };
  const submitStudio = async () => {
    if (submissionInFlightRef.current) return;
    if (!studioLayoutApplied) {
      setResult("กรุณากดปุ่มประกอบผังก่อนส่งขอราคา");
      return;
    }
    setHasAttemptedSubmit(true);
    const prepared = prepareStudioSubmissionPayload(state, basinProducts);
    if (!prepared) {
      setResult("ข้อมูลขนาดหรือราคาไม่ถูกต้อง กรุณาตรวจสอบก่อนส่ง");
      return;
    }
    const safeState = prepared.state;
    const safeEstimate = prepared.estimate;
    const safeContact = sanitizeStudioContactForPayload(contact);
    const validationMessage = studioSubmissionValidationMessage(safeState, safeEstimate);
    if (validationMessage) {
      setResult(validationMessage);
      return;
    }
    if (!safeContact.name || !safeContact.phone || !safeContact.project || !safeContact.address) {
      setResult("กรุณากรอกชื่อผู้ติดต่อ โทรศัพท์ ชื่อโครงการ และสถานที่ติดตั้ง");
      return;
    }
    if (!isValidPhoneNumber(safeContact.phone)) {
      setResult("เบอร์โทรศัพท์ต้องเป็นตัวเลข 9–10 หลัก");
      return;
    }
    if (safeContact.taxId && !/^[0-9]{13}$/.test(safeContact.taxId)) {
      setResult("เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก");
      return;
    }
    if (hasPastInstallationDate) {
      setResult("วันที่เข้าติดตั้งต้องไม่เป็นวันที่ผ่านมา");
      return;
    }
    if (!isValidEmailAddress(safeContact.email)) {
      setResult("กรุณากรอกอีเมลให้ถูกต้อง (เช่น name@example.com)");
      return;
    }
    submissionInFlightRef.current = true;
    setSubmitting(true);
    setResult("");
    try {
      const basinCounts = new Map<string, number>();
      safeState.basinPlacements.forEach((placement) => basinCounts.set(placement.sku, (basinCounts.get(placement.sku) ?? 0) + 1));
      const notificationItems: StudioNotificationItem[] = Array.from(basinCounts.entries()).flatMap(([sku, quantity]) => {
        const product = basinProducts.find((item) => item.sku === sku);
        return product ? [{
          kind: "basin" as const,
          code: product.sku,
          description: product.colorName,
          quantity,
          unit: "ชุด",
          unitPriceTHB: product.priceTHB,
          totalTHB: Math.round(product.priceTHB * quantity),
          workQuantity: quantity,
          workUnit: "ชุด",
          dimensions: product.dimensions,
          cutoutDimensions: product.basinDimensions,
        }] : [];
      });
      const safeActiveStone = stoneColorByName(safeState.activeStone, stoneColors);
      const stoneMaterialPrice = safeActiveStone.sheetPriceTHB;
      const stoneLaborPrice = safeEstimate.stoneUnitPriceTHB !== null && stoneMaterialPrice !== null
        ? Math.max(0, safeEstimate.stoneUnitPriceTHB - stoneMaterialPrice)
        : null;
      if (safeEstimate.stoneUnitPriceTHB !== null && safeEstimate.stoneAreaSqM > 0) notificationItems.push({
        kind: "stone",
        code: safeActiveStone.code,
        description: safeActiveStone.name,
        quantity: safeEstimate.counterAreaSqM,
        unit: "ตร.ม.",
        unitPriceTHB: safeEstimate.stoneUnitPriceTHB,
        totalTHB: Math.max(0, safeEstimate.stoneTotalTHB - safeEstimate.upstandTotalTHB),
        areaSqM: safeEstimate.counterAreaSqM,
        productUnitPriceTHB: stoneMaterialPrice,
        laborUnitPriceTHB: stoneLaborPrice,
        workQuantity: safeEstimate.counterAreaSqM,
        workUnit: "ตร.ม.",
        imageUrl: safeActiveStone.quoteImageUrl ?? safeActiveStone.imageUrl,
      });
      notificationItems.push({ kind: "service", code: "WORKPIECES", description: `${safeEstimate.pieceCount} ชิ้นงาน · ${safeEstimate.rectangleCount} แผ่น`, quantity: safeEstimate.pieceCount, unit: "ชิ้นงาน", unitPriceTHB: 0, totalTHB: 0, workQuantity: safeEstimate.pieceCount, workUnit: "ชิ้นงาน" });
      if (safeEstimate.upstandLengthM > 0) notificationItems.push({ kind: "service", code: "UPSTAND", description: `บัวยาว ${safeEstimate.upstandLengthM.toFixed(2)} ม. · สูง ${safeState.upstandHeightMm ?? "ไม่ระบุ"} มม.`, quantity: safeEstimate.upstandLengthM, unit: "ม.", unitPriceTHB: safeEstimate.upstandLengthM ? safeEstimate.upstandTotalTHB / safeEstimate.upstandLengthM : 0, totalTHB: safeEstimate.upstandTotalTHB, workQuantity: safeEstimate.upstandLengthM, workUnit: "ม." });
      if (safeEstimate.openEdgeLengthM > 0) notificationItems.push({ kind: "service", code: "OPEN_EDGE", description: `ขอบเปิดยาว ${safeEstimate.openEdgeLengthM.toFixed(2)} ม.`, quantity: safeEstimate.openEdgeLengthM, unit: "ม.", unitPriceTHB: safeEstimate.openEdgeUnitPriceTHB ?? 0, totalTHB: safeEstimate.openEdgeTotalTHB, workQuantity: safeEstimate.openEdgeLengthM, workUnit: "ม." });
      if (safeEstimate.installationChargeTHB > 0) notificationItems.push({ kind: "service", code: "INSTALL", description: "ค่าติดตั้ง / ค่าแรงต่อชุด", quantity: safeState.basinPlacements.length, unit: "ชุด", unitPriceTHB: safeState.basinPlacements.length ? safeEstimate.installationChargeTHB / safeState.basinPlacements.length : 0, totalTHB: safeEstimate.installationChargeTHB, laborUnitPriceTHB: safeState.basinPlacements.length ? safeEstimate.installationChargeTHB / safeState.basinPlacements.length : 0, workQuantity: safeState.basinPlacements.length, workUnit: "ชุด" });
      if (safeEstimate.smallJobFeeTHB > 0) notificationItems.push({ kind: "service", code: "SMALL-JOB", description: "ค่าดำเนินการงานพื้นที่เล็ก", quantity: 1, unit: "งาน", unitPriceTHB: safeEstimate.smallJobFeeTHB, totalTHB: safeEstimate.smallJobFeeTHB, workQuantity: 1, workUnit: "งาน" });
      await onSubmitStudio({ state: safeState, estimate: safeEstimate, contact: safeContact, worksitePlaceId, notification: { items: notificationItems, grossSubtotal: safeEstimate.grossSubtotalTHB, discountAmount: safeEstimate.grossSubtotalTHB - safeEstimate.subtotalTHB, subtotal: safeEstimate.subtotalTHB, vatAmount: safeEstimate.vatAmountTHB, total: safeEstimate.totalTHB, vat: safeState.vat } });
    } catch (error) {
      // onSubmitStudio only fails via the API client, whose error.message is a
      // technical "HTTP {status} {statusText}" string meant for logs, not
      // customers — log it for diagnostics but always show a plain-language
      // message here.
      console.error("Studio submission failed:", error);
      setResult("ส่งใบเสนอราคาไม่สำเร็จ กรุณาลองอีกครั้ง หรือติดต่อทีมขายโดยตรงหากยังพบปัญหา");
    } finally {
      submissionInFlightRef.current = false;
      setSubmitting(false);
    }
  };
  const openPromptPayCheckout = async () => {
    if (mode !== "studio" || isLeadLinkedMode || submissionInFlightRef.current) return;
    if (!studioLayoutApplied) {
      setResult("กรุณากดปุ่มประกอบผังก่อนชำระเงิน");
      return;
    }
    setHasAttemptedSubmit(true);
    const prepared = prepareStudioSubmissionPayload(state, basinProducts);
    if (!prepared) {
      setResult("ข้อมูลขนาดหรือราคาไม่ถูกต้อง กรุณาตรวจสอบก่อนชำระเงิน");
      return;
    }
    const safeState = prepared.state;
    const safeEstimate = prepared.estimate;
    const safeContact = sanitizeStudioContactForPayload(contact);
    const validationMessage = studioSubmissionValidationMessage(safeState, safeEstimate);
    if (validationMessage) {
      setResult(validationMessage);
      return;
    }
    if (!safeContact.name || !safeContact.phone || !safeContact.project || !safeContact.address) {
      setResult("กรุณากรอกชื่อผู้ติดต่อ โทรศัพท์ ชื่อโครงการ และสถานที่ติดตั้ง");
      return;
    }
    if (!isValidPhoneNumber(safeContact.phone)) {
      setResult("เบอร์โทรศัพท์ต้องเป็นตัวเลข 9–10 หลัก");
      return;
    }
    if (safeContact.taxId && !/^[0-9]{13}$/.test(safeContact.taxId)) {
      setResult("เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก");
      return;
    }
    if (hasPastInstallationDate) {
      setResult("วันที่เข้าติดตั้งต้องไม่เป็นวันที่ผ่านมา");
      return;
    }
    if (!isValidEmailAddress(safeContact.email)) {
      setResult("กรุณากรอกอีเมลให้ถูกต้อง (เช่น name@example.com)");
      return;
    }
    submissionInFlightRef.current = true;
    setSubmitting(true);
    setResult("");
    try {
      const notification = buildStudioNotificationSnapshot(safeState, safeEstimate, basinProducts, stoneColors);
      const lead = await upsertLead.mutateAsync({
        data: {
          leadKey,
          status: "quote_requested",
          source: "studio",
          productSkus: [...new Set(safeState.basinSkus)],
          name: safeContact.name,
          company: safeContact.company || null,
          phone: safeContact.phone,
          lineContact: safeContact.lineContact || null,
          email: safeContact.email || null,
          project: safeContact.project,
          address: safeContact.address,
          site: safeContact.site || safeContact.address || null,
          purchasingDepartment: safeContact.purchasingDepartment || null,
          notes: safeContact.notes || null,
          taxName: safeContact.taxName || null,
          taxId: safeContact.taxId || null,
          taxBranch: safeContact.taxBranch || null,
          taxAddress: safeContact.taxAddress || null,
          preferredContact: safeContact.preferredContact || null,
          customerRole: safeContact.customerRole || null,
          propertyType: safeContact.propertyType || null,
          condoFloor: safeContact.condoFloor || null,
          expectedInstallationDate: safeContact.expectedInstallationDate || null,
          orderMode: "studio",
          studioData: { state: safeState, estimate: safeEstimate, notification, worksitePlaceId },
        },
      });
      if (!lead.quoteNumber || !lead.publicQuoteToken) {
        throw new Error("Quote access details were not returned");
      }
      setCheckout({
        token: lead.publicQuoteToken,
        quoteNumber: lead.quoteNumber,
        quoteTotalTHB: safeEstimate.totalTHB,
      });
    } catch (error) {
      console.error("Studio PromptPay checkout setup failed:", error);
      setResult("สร้างใบเสนอราคาเพื่อชำระเงินไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      submissionInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const saveStudioToLinkedLead = async () => {
    if (submissionInFlightRef.current) return;
    if (!studioLayoutApplied) {
      setResult("กรุณากดปุ่มประกอบผังก่อนบันทึกเข้า Lead");
      return;
    }
    if (!linkedLeadId || !linkedLead) {
      setResult("ไม่พบ Lead ที่ต้องการบันทึก กรุณากลับไปเลือก Lead อีกครั้ง");
      return;
    }
    const prepared = prepareStudioSubmissionPayload(state, basinProducts);
    if (!prepared) {
      setResult("ข้อมูลขนาดหรือราคาไม่ถูกต้อง กรุณาตรวจสอบก่อนบันทึก");
      return;
    }
    const safeState = prepared.state;
    const safeEstimate = prepared.estimate;
    const validationMessage = studioSubmissionValidationMessage(safeState, safeEstimate);
    if (validationMessage) {
      setResult(validationMessage);
      return;
    }
    submissionInFlightRef.current = true;
    setSubmitting(true);
    setResult("");
    setSavedLeadStateFingerprint(null);
    try {
      const studioData = {
        ...studioDataRecord(linkedLead.studioData),
        ...safeState,
        state: safeState,
        estimate: safeEstimate,
        worksitePlaceId,
      };
      const response = await fetch(`/api/admin/leads/${encodeURIComponent(linkedLeadId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: linkedLead.status,
          notes: linkedLead.notes == null ? null : sanitizeTextInput(linkedLead.notes),
          studioData,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setSavedLeadStateFingerprint(JSON.stringify(state));
      setResult(`บันทึกผังและประมาณการเข้า Lead #${linkedLeadId} แล้ว`);
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] });
    } catch (error) {
      console.error("Studio lead save failed:", error);
      setResult("บันทึกผังและประมาณการไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      submissionInFlightRef.current = false;
      setSubmitting(false);
    }
  };
  const submitSketch = async () => {
    if (submissionInFlightRef.current) return;
    if (sketchStatus?.busy) {
      setResult("กรุณารอให้วิเคราะห์ภาพแบบร่างเสร็จก่อนส่ง");
      return;
    }
    if (!sketchDimensionsValid) {
      setResult("กรุณากรอกขนาดเป็นจำนวนเต็มในช่วงที่กำหนด");
      return;
    }
    const prepared = prepareStudioSubmissionPayload(state, basinProducts);
    if (!prepared) {
      setResult("ข้อมูลขนาดหรือราคาไม่ถูกต้อง กรุณาตรวจสอบก่อนส่ง");
      return;
    }
    const safeState = prepared.state;
    const safeEstimate = prepared.estimate;
    const safeContact = sanitizeStudioContactForPayload(contact);
    const name = safeContact.name;
    const company = safeContact.company;
    const phone = safeContact.phone;
    const email = safeContact.email;
    const project = safeContact.project;
    const address = safeContact.address;
    if (!sketchFiles.length || !name || !phone || !project) {
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
    if (safeContact.taxId && !/^[0-9]{13}$/.test(safeContact.taxId)) {
      setResult("เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก");
      return;
    }
    if (hasPastInstallationDate) {
      setResult("วันที่เข้าติดตั้งต้องไม่เป็นวันที่ผ่านมา");
      return;
    }
    submissionInFlightRef.current = true;
    setSubmitting(true);
    setResult("");
    const sketchNotificationItems: StudioNotificationItem[] = [];
    if (activeStone?.code && safeEstimate.counterAreaSqM > 0) {
      const stoneUnitPrice = safeEstimate.stoneUnitPriceTHB ?? 0;
      sketchNotificationItems.push({
        kind: "stone" as const,
        code: activeStone.code,
        description: `ท็อปเคาน์เตอร์หินสังเคราะห์ ${activeStone.name || activeStone.code}`,
        quantity: Number(safeEstimate.counterAreaSqM.toFixed(4)),
        unit: "ตร.ม.",
        unitPriceTHB: stoneUnitPrice,
        totalTHB: Math.round(safeEstimate.counterAreaSqM * stoneUnitPrice),
        workQuantity: Number(safeEstimate.counterAreaSqM.toFixed(4)),
        workUnit: "ตร.ม.",
      });
    }
    safeState.basinSkus.forEach((sku) => {
      const product = basinProducts.find((item) => item.sku === sku);
      if (product) {
        sketchNotificationItems.push({
          kind: "basin" as const,
          code: product.sku,
          description: product.colorName,
          quantity: 1,
          unit: "ชุด",
          unitPriceTHB: product.priceTHB,
          totalTHB: product.priceTHB,
          workQuantity: 1,
          workUnit: "ชุด",
          dimensions: product.dimensions,
          cutoutDimensions: product.basinDimensions,
        });
      }
    });
    if (safeEstimate.installationChargeTHB > 0) {
      sketchNotificationItems.push({
        kind: "service" as const,
        code: "INSTALL-BASIN",
        description: `ค่าบริการติดตั้งอ่างล้างหน้า (${safeState.basinSkus.length} จุด)`,
        quantity: safeState.basinSkus.length,
        unit: "จุด",
        unitPriceTHB: INSTALLATION_PRICE,
        totalTHB: safeEstimate.installationChargeTHB,
        workQuantity: safeState.basinSkus.length,
        workUnit: "จุด",
      });
    }
    if (safeEstimate.smallJobFeeTHB > 0) {
      sketchNotificationItems.push({
        kind: "service" as const,
        code: "SMALL-JOB-FEE",
        description: "ค่าดำเนินการงานพื้นที่เล็ก",
        quantity: 1,
        unit: "งาน",
        unitPriceTHB: safeEstimate.smallJobFeeTHB,
        totalTHB: safeEstimate.smallJobFeeTHB,
        workQuantity: 1,
        workUnit: "งาน",
      });
    }

    const form = new FormData();
    sketchFiles.forEach((file) => form.append("file", file));
    form.append("metadata", JSON.stringify({
      leadKey,
      status: "new_lead",
      source: "hand_sketch",
      orderMode: "sketch",
      productSkus: safeState.basinSkus,
      name,
      company: company || null,
      phone,
      lineContact: safeContact.lineContact || null,
      email: email || null,
      project,
      address: address || null,
      site: safeContact.site || address || null,
      purchasingDepartment: safeContact.purchasingDepartment || null,
      notes: safeContact.notes || null,
      taxName: safeContact.taxName || null,
      taxId: safeContact.taxId || null,
      taxBranch: safeContact.taxBranch || null,
      taxAddress: safeContact.taxAddress || null,
      preferredContact: safeContact.preferredContact || null,
      customerRole: safeContact.customerRole || null,
      propertyType: safeContact.propertyType || null,
      condoFloor: safeContact.condoFloor || null,
      expectedInstallationDate: safeContact.expectedInstallationDate || null,
      studioData: {
        ...safeState,
        state: safeState,
        estimate: safeEstimate,
        worksitePlaceId,
        items: sketchNotificationItems,
        notification: {
          items: sketchNotificationItems,
          vat: safeState.vat,
          subtotalTHB: safeEstimate.subtotalTHB,
          vatTHB: safeEstimate.vatAmountTHB,
          totalTHB: safeEstimate.totalTHB
        }
      }
    }));
    try {
      const response = await fetch("/api/leads/sketch", { method: "POST", body: form });
      const payload = await response.json() as { notificationStatus?: string; message?: string };
      if (!response.ok) throw new Error(payload.message || "ส่งไฟล์ไม่สำเร็จ");
      setResult(payload.message || (payload.notificationStatus === "notified" ? "ส่งแบบร่างเรียบร้อยแล้ว ทีมขายได้รับการแจ้งเตือน" : "บันทึกแบบร่างเรียบร้อยแล้ว"));
      setSketchFiles([]);
      sketchFilesRef.current = [];
      setSketchAnalysisByFile(new Map());
      setSketchStatus(null);
      if (sketchInputRef.current) sketchInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    } catch (error) {
      setResult(error instanceof Error ? error.message : "ส่งไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      submissionInFlightRef.current = false;
      setSubmitting(false);
    }
  };
  const currentLeadStateFingerprint = JSON.stringify(state);
  const linkedLeadLayoutIsSaved = savedLeadStateFingerprint === currentLeadStateFingerprint;
  const hasUnsavedLinkedLeadChanges = isLeadLinkedMode && savedLeadStateFingerprint !== null && !linkedLeadLayoutIsSaved;
  const linkedLeadUnavailable = isLeadLinkedMode && (!linkedLeadId || !linkedLead || leadsQuery.isLoading);
  const primarySubmit = isLeadLinkedMode ? saveStudioToLinkedLead : mode === "studio" ? submitStudio : submitSketch;
  const sketchBridgeAnalysis = sketchFiles
    .map((file) => sketchAnalysisByFile.get(file))
    .find((analysis) => analysis && analysis.shape !== "unknown");
  const sketchBridgeShape: StudioPreset = sketchBridgeAnalysis
    ? sketchBridgeAnalysis.shape === "U"
      ? "u"
      : sketchBridgeAnalysis.shape === "L-right"
        ? "l-right"
        : sketchBridgeAnalysis.shape === "L" || sketchBridgeAnalysis.shape === "L-left"
          ? "l-left"
          : "i"
    : studioPresetForShare(state);
  const sketchBridgeRectangle = getStudioPieces(state)[0]?.rectangles[0];
  const sketchBridgeRunAMm = Math.round(sketchBridgeRectangle?.widthMm ?? state.dimensions.runAMm);
  const sketchBridgeDepthMm = Math.round(sketchBridgeRectangle?.lengthMm ?? state.dimensions.depthMm);
  const bridgeToStudio = () => {
    if (submissionInFlightRef.current || sketchStatus?.busy) return;
    if (!sketchDimensionsValid) {
      setResult("กรุณากรอกขนาดเป็นจำนวนเต็มในช่วงที่กำหนด");
      return;
    }
    const params = new URLSearchParams();
    params.set("shape", sketchBridgeShape);
    params.set("runAMm", String(sketchBridgeRunAMm));
    params.set("depthMm", String(sketchBridgeDepthMm));
    const basinSku = state.basinSkus.find((sku) => basinProducts.some((product) => product.sku === sku));
    const stoneColor = state.activeStone || state.stoneColors[0];
    if (stoneColor) params.set("stoneColor", stoneColor);
    if (basinSku) params.set("basinSku", basinSku);
    setLocation(`/studio?${params.toString()}`);
  };
  const scrollToEstimate = () => document.querySelector(".studio-estimate-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const estimatePanel = mode === "studio" && !studioLayoutApplied
    ? <aside className="studio-panel studio-estimate-panel studio-estimate-panel--dock" data-testid="studio-estimate-not-ready">
      <div className="studio-panel-heading"><div><p className="eyebrow">LIVE ESTIMATE</p><h3>ประมาณการเบื้องต้น</h3></div></div>
      <p className="studio-helper" role="status" data-testid="status-studio-estimate-locked">กด “ประกอบผังลงกระดาน” เพื่อคำนวณพื้นที่และราคา</p>
    </aside>
    : (
    <aside className={`studio-panel studio-estimate-panel ${mode === "studio" ? "studio-estimate-panel--dock" : ""}`}>
      <div className="studio-panel-heading"><div><p className="eyebrow">LIVE ESTIMATE</p><h3>ประมาณการเบื้องต้น</h3></div><span>{activeStone.code}</span></div>
      <div className="studio-estimate-lines">
        {mode !== "sketch" && <div><span>จำนวนชิ้นงาน / แผ่น</span><strong>{estimate.pieceCount} / {estimate.rectangleCount}</strong></div>}
        {mode !== "sketch" && <div><span>พื้นที่แผ่นรวม</span><strong>{estimate.counterAreaSqM.toFixed(4)} m²</strong></div>}
        {!(mode === "sketch" && estimate.upstandLengthM <= 0) && <div><span>บัว <small>{estimate.upstandLengthM.toFixed(2)} ม. × {state.upstandHeightMm ?? "ว่าง"} มม.</small></span><strong>{formatTHB(estimate.upstandTotalTHB)}</strong></div>}
        {!(mode === "sketch" && estimate.openEdgeLengthM <= 0) && <div><span>ขอบเปิด <small>{estimate.openEdgeLengthM.toFixed(2)} ม.</small></span><strong>{estimate.openEdgeUnitPriceTHB === 0 ? "ฟรี" : formatTHB(estimate.openEdgeTotalTHB)}</strong></div>}
        <div><span>หิน {formatTHB(estimate.stoneUnitPriceTHB ?? 0)} / m²</span><strong>{estimate.sheetCutPriceWarning ? "คิดตามแผ่นตัด" : formatTHB(counterStoneTotal)}</strong></div>
        {(() => {
          const tier = stonePriceTier(stoneColorByName(state.activeStone, stoneColors).installedPriceTHB, stoneColors);
          return mode !== "sketch" && tier && <p className="studio-price-tier" data-testid="text-studio-price-tier">สี {activeStone.code} อยู่ในระดับราคา <strong>{tier.label}</strong> เทียบกับหินทั้งหมด {tier.total} สีในแคตตาล็อก</p>;
        })()}
        {mode === "sketch" ? <>
          <div><span>อ่าง</span><strong>{formatTHB(estimate.basinSubtotalTHB)}</strong></div>
          <div><span>ค่าติดตั้ง</span><strong>{formatTHB(estimate.installationChargeTHB)}</strong></div>
        </> : <div><span>อ่าง + ติดตั้ง</span><strong>{formatTHB(estimate.basinSubtotalTHB + estimate.installationChargeTHB)}</strong></div>}
        {estimate.smallJobFeeTHB > 0 && <div><span>ค่าดำเนินการงานพื้นที่เล็ก</span><strong>{formatTHB(estimate.smallJobFeeTHB)}</strong></div>}
        {mode !== "sketch" && <div><span>รวมก่อนส่วนลด</span><strong>{formatTHB(estimate.grossSubtotalTHB)}</strong></div>}
      </div>
      {mode !== "sketch" && <StudioStoneComparison state={state} setState={setState} stoneColors={stoneColors} />}
      {mode !== "sketch" && <div className="studio-pricing-inputs">
        <label>ความสูงบัว (มม.)<input type="number" min="0" max="500" value={state.upstandHeightMm ?? ""} onChange={(event) => setState((current) => ({ ...current, upstandHeightMm: event.target.value.trim() ? numericValue(event.target.value) : null }))} onBlur={(event) => {
          if (event.currentTarget.value.trim()) return;
          setState((current) => current.upstandHeightMm === null || current.upstandHeightMm === undefined
            ? { ...current, upstandHeightMm: 120 }
            : current);
        }} data-testid="input-studio-upstand-height" /></label>
        <label>ราคาขอบเปิด / ม.<input type="number" min="0" step="0.01" value={state.openEdgePricePerMTHB ?? ""} onChange={(event) => setState((current) => ({ ...current, openEdgePricePerMTHB: event.target.value.trim() ? numericValue(event.target.value) : null }))} data-testid="input-studio-open-edge-price" /></label>
        <label data-testid="studio-discount-field">ส่วนลด (บาท)<input type="number" min="0" step="1" value={state.discountTHB ?? 0} onChange={(event) => setState((current) => ({ ...current, discountTHB: numericValue(event.target.value) }))} data-testid="input-studio-discount" /></label>
      </div>}
      <label className="studio-checkbox"><input type="checkbox" checked={state.vat} onChange={(event) => setState((current) => ({ ...current, vat: event.target.checked }))} data-testid="input-studio-vat" /><span />คิด VAT 7% จากยอดหลังหักส่วนลด ({formatTHB(estimate.vatAmountTHB)})</label>
      {missingTaxIdForVat && <p className="studio-warning studio-warning--amber" role="status" data-testid="status-studio-vat-tax-id">💡 กรุณากรอกเลขประจำตัวผู้เสียภาษี 13 หลักในโปรไฟล์เพื่อให้ออกใบกำกับภาษีได้สมบูรณ์</p>}
      <div className="studio-total"><span>รวมประมาณการ</span><strong data-testid="studio-total-value">{formatTHB(estimate.totalTHB)}</strong><small>{state.vat ? "รวม VAT 7% แล้ว" : "ยังไม่รวม VAT"} · ปัดเป็นบาทถ้วนทีละบรรทัด</small></div>
      {estimate.warnings.map((warning) => <p className="studio-warning studio-warning--amber" key={warning}><AlertTriangle size={16} /> {warning}</p>)}
      {estimate.standardSheetWarning && <p className="studio-warning studio-warning--amber"><AlertTriangle size={16} /> {estimate.standardSheetMessage}</p>}
      {mode === "studio" && studioIssues.length > 0 && <div id="status-studio-issues-summary" className="studio-issues-summary" role="status" data-testid="status-studio-issues-summary">
        <strong>{studioIssues.length === 1 ? "มี 1 จุดที่ต้องแก้ไขก่อนส่งคำขอ" : `มี ${studioIssues.length} จุดที่ต้องแก้ไขก่อนส่งคำขอ`}</strong>
        <ul>{studioIssues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>
      </div>}
      {mode === "studio" && <div className="studio-export-actions"><button type="button" className="button button--outline" disabled={!exportReady} onClick={() => void exportFiles("dxf")} data-testid="button-download-studio-dxf"><Download size={15} /> ดาวน์โหลดแบบ (DXF)</button><button type="button" className="button button--outline" disabled={!exportReady} onClick={() => void exportFiles("pdf")} data-testid="button-download-studio-pdf"><Download size={15} /> ดาวน์โหลดแบบ (PDF)</button><button type="button" className="button button--outline" disabled={!exportReady} onClick={() => void exportFiles("png")} data-testid="button-download-studio-png"><Download size={15} /> ดาวน์โหลดภาพ (PNG)</button></div>}
      {mode === "sketch" && !isLeadLinkedMode
        ? <div className="studio-sketch-button-pair">
          <button type="button" className="button button--dark" disabled={submitting || sketchStatus?.busy || !sketchDimensionsValid} onClick={() => void primarySubmit()} data-testid="button-submit-sketch-lead">
            <span data-testid="button-submit-sketch">{submitting ? "กำลังส่ง..." : sketchStatus?.busy ? "กำลังวิเคราะห์ภาพแบบร่าง…" : "🚀 ส่งภาพแบบร่างให้ทีมขายประเมินราคา ➔"}</span>
          </button>
          <button type="button" className="button button--accent" disabled={submitting || sketchStatus?.busy || !sketchDimensionsValid} onClick={bridgeToStudio} data-testid="button-bridge-to-studio">
            {sketchStatus?.busy ? "กำลังวิเคราะห์ภาพแบบร่าง…" : "🎨 นำขนาดเข้าสู่ 2D Studio ➔"}
          </button>
        </div>
        : <button type="button" className="button button--dark full-width" disabled={submitting || linkedLeadUnavailable || hasBasinClash} aria-describedby={hasBasinClash ? "status-studio-issues-summary" : undefined} onClick={() => void primarySubmit()} data-testid={isLeadLinkedMode ? "button-save-studio-to-lead" : mode === "studio" ? "button-submit-studio" : "button-submit-sketch"}>
          {submitting ? isLeadLinkedMode ? "กำลังบันทึก..." : "กำลังส่ง..." : isLeadLinkedMode ? "บันทึกผังลง Lead" : "ขอใบเสนอราคาจากแบบนี้"} <ArrowRight size={16} />
        </button>}
      {mode === "studio" && !isLeadLinkedMode && <button
        type="button"
        className="button button--accent full-width"
        disabled={submitting || linkedLeadUnavailable || hasBasinClash || !studioLayoutApplied}
        aria-describedby={hasBasinClash ? "status-studio-issues-summary" : undefined}
        onClick={() => void openPromptPayCheckout()}
        data-testid="button-open-promptpay-checkout"
      >
        {submitting ? "กำลังเตรียมใบเสนอราคา…" : "💳 ชำระเงินด้วย PromptPay"}
      </button>}
      {result && <p className="studio-result" role="status">{result}</p>}
      {hasUnsavedLinkedLeadChanges && <p className="studio-lead-unsaved" role="status">มีการแก้ไขผังที่ยังไม่ได้บันทึก</p>}
      {isLeadLinkedMode && linkedLeadLayoutIsSaved && linkedLead?.publicQuoteToken && <p className="studio-lead-quote-link" data-testid="link-existing-lead-quote"><a href={adminQuoteUrl(linkedLead.publicQuoteToken)} target="_blank" rel="noreferrer">เปิดใบเสนอราคา{linkedLead.quoteNumber ? ` ${linkedLead.quoteNumber}` : ""}</a></p>}
      {isLeadLinkedMode && linkedLeadLayoutIsSaved && linkedLead && !linkedLead.publicQuoteToken && <p className="studio-lead-no-quote">Lead นี้ยังไม่มีใบเสนอราคาให้เปิด</p>}
    </aside>
  );
  const studioSketchUploadPanel = (
    <section className="studio-panel studio-sketch-panel">
      <div
        className={`studio-sketch-dropzone ${sketchDropActive ? "is-dragging" : ""}`}
        aria-label="พื้นที่วางภาพแบบร่าง"
        data-testid="dropzone-studio-sketch"
        onDragEnter={(event) => {
          if (!Array.from(event.dataTransfer.types).includes("Files")) return;
          event.preventDefault();
          setSketchDropActive(true);
        }}
        onDragOver={(event) => {
          if (!Array.from(event.dataTransfer.types).includes("Files")) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setSketchDropActive(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSketchDropActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setSketchDropActive(false);
          addSketchFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <div className="studio-sketch-dropzone-intro">
          <span className="studio-sketch-dropzone-icon"><Upload size={22} /></span>
          <div className="studio-sketch-dropzone-copy">
            <strong>ลากภาพแบบร่างหรือรูปถ่ายหน้างานมาวางที่นี่</strong>
            <span>หรือเลือกไฟล์จากอุปกรณ์ · รองรับ JPG, PNG, WEBP และ GIF</span>
            <small data-testid="text-sketch-file-count">แนบแล้ว {sketchFiles.length} / {MAX_SKETCH_FILES} รูป</small>
          </div>
        </div>
        <small data-testid="text-sketch-rotate-hint">ภาพเอียง? กดปุ่ม 'หมุน 90°' ที่การ์ดภาพก่อนให้ AI อ่าน</small>
        {sketchFiles.length < MAX_SKETCH_FILES && <div className="studio-sketch-actions">
          <button
            type="button"
            className="button button--outline"
            onClick={() => cameraInputRef.current?.click()}
            disabled={submitting || sketchStatus?.busy}
            data-testid="button-sketch-camera"
          >
            <Camera size={17} /> {submitting ? "กำลังส่ง..." : sketchStatus?.busy ? "กำลังประมวลผล…" : "ถ่ายรูปจากกล้องทันที"}
          </button>
          <button
            type="button"
            className="button button--outline"
            onClick={() => sketchInputRef.current?.click()}
            disabled={submitting || sketchStatus?.busy}
            data-testid="button-sketch-file"
          >
            <FolderOpen size={17} /> {submitting ? "กำลังส่ง..." : sketchStatus?.busy ? "กำลังประมวลผล…" : "เลือกภาพจากเครื่อง"}
          </button>
        </div>}
        <div className="studio-sketch-slots" data-testid="grid-studio-sketch-slots">
          {Array.from({ length: MAX_SKETCH_FILES }).map((_, index) => {
            const file = sketchFiles[index];
            const previewUrl = sketchPreviewUrls[index];
            if (file && previewUrl) {
              return (
                <div key={index} className="studio-sketch-slot studio-sketch-slot--filled" data-testid={`slot-studio-sketch-${index}`}>
                  <img className="studio-sketch-slot-preview" src={previewUrl} alt={`ตัวอย่างไฟล์ ${file.name}`} data-testid={`img-studio-sketch-preview-${index}`} />
                  <button type="button" className="studio-sketch-slot-remove" disabled={submitting} onClick={() => removeSketchFile(index)} aria-label={`ลบไฟล์ ${file.name}`} data-testid={`button-remove-studio-sketch-${index}`}><X size={14} /></button>
                </div>
              );
            }
            if (index === sketchFiles.length && sketchFiles.length < MAX_SKETCH_FILES) {
              return (
                <button key={index} type="button" className="studio-sketch-slot studio-sketch-slot--add" disabled={submitting} onClick={() => sketchInputRef.current?.click()} data-testid={`button-add-studio-sketch-${index}`}>
                  <span className="studio-sketch-add-plus" aria-hidden="true">+</span>
                  <small>เพิ่มรูป</small>
                </button>
              );
            }
            return <div key={index} className="studio-sketch-slot studio-sketch-slot--empty" aria-hidden="true" />;
          })}
        </div>
        {sketchStatus && <div
          className={`studio-sketch-status ${sketchStatus.busy ? "is-busy" : ""} studio-sketch-status--${sketchStatus.phase}`}
          role="status"
          aria-live="polite"
          data-testid="status-sketch-analysis"
          data-phase={sketchStatus.phase}
        >
          {sketchStatus.busy && <Loader2 className="studio-sketch-status-spinner" size={17} aria-hidden="true" />}
          <span>{sketchStatus.message}</span>
        </div>}
        {sketchFiles.length > 0 && <div className="studio-sketch-analysis-list">
          {sketchFiles.map((file, index) => {
            const analysis = sketchAnalysisByFile.get(file) ?? {
              shape: "unknown" as const,
              confidence: null,
              notes: SKETCH_ANALYSIS_FALLBACK_MESSAGE,
              runAMm: null,
              depthMm: null,
              workpieceCount: 0,
              workpieces: [],
              phase: "queued" as const,
            };
            const isRotating = rotatingSketchFile === file;
            const isBusy = isRotating || analysis.phase === "queued" || analysis.phase === "uploading" || analysis.phase === "analyzing";
            const confidence = analysis.confidence === null
              ? "ยังไม่ระบุ"
              : `${Math.round(analysis.confidence <= 1 ? analysis.confidence * 100 : analysis.confidence)}%`;
            const shapeClass = analysis.shape.startsWith("L") ? "L" : analysis.shape;
            return <article className="studio-sketch-analysis-card" key={`${file.name}-${file.lastModified}-${index}`} data-testid={`card-sketch-analysis-${index}`}>
              {sketchPreviewUrls[index] && <img className="studio-sketch-analysis-preview" src={sketchPreviewUrls[index]} alt={`ภาพที่วิเคราะห์: ${file.name}`} />}
              <div className="studio-sketch-analysis-copy">
                <button
                  type="button"
                  className="button button--outline"
                  style={{ minHeight: 40, alignSelf: "flex-start" }}
                  aria-label="หมุนภาพแบบร่าง 90 องศา"
                  disabled={submissionInFlightRef.current || submitting || sketchStatus?.busy || isBusy}
                  onClick={() => void rotateSketchAtIndex(index)}
                  data-testid={`button-rotate-sketch-${index}`}
                >
                  {isRotating ? <Loader2 size={16} aria-hidden="true" /> : <RotateCw size={16} aria-hidden="true" />}
                  หมุน 90°
                </button>
                <strong className="studio-sketch-analysis-title">{file.name}</strong>
                <span className={`studio-sketch-shape studio-sketch-shape--${shapeClass}`}>{sketchShapeLabel(analysis.shape)}</span>
                <span>ความมั่นใจ: {confidence}</span>
                <span>{analysis.runAMm !== null && analysis.depthMm !== null
                  ? `ขนาดที่อ่านได้: ${analysis.runAMm} × ${analysis.depthMm} มม.`
                  : "ยังไม่มีขนาดจาก AI — กรอกขนาดด้วยตนเองได้"}</span>
                <p>{analysis.notes || SKETCH_ANALYSIS_FALLBACK_MESSAGE}</p>
                {analysis.workpieces.length > 0 && <div className="studio-sketch-workpieces" data-testid={`list-sketch-workpieces-${index}`}>
                  <strong className="studio-sketch-workpieces-summary">พบ {analysis.workpieceCount || analysis.workpieces.length} ชิ้นงานในภาพนี้</strong>
                  {analysis.workpieces.map((workpiece, workpieceIndex) => <section className="studio-sketch-workpiece-card" key={`${workpiece.id}-${workpieceIndex}`} data-testid={`card-sketch-workpiece-${index}-${workpieceIndex}`}>
                    <div className="studio-sketch-workpiece-heading">
                      <strong>{workpiece.label}</strong>
                      <span className="studio-sketch-workpiece-shape">{sketchShapeLabel(workpiece.shape)}</span>
                    </div>
                    <p className="studio-sketch-workpiece-dimensions">{workpiece.dimensionsSummary || "ขนาดรวมยังไม่ระบุ"}</p>
                    {workpiece.panels.length > 0 && <div className="studio-sketch-workpiece-section">
                      <strong>แผ่นหิน (Panels)</strong>
                      <div className="studio-sketch-workpiece-badges">
                        {workpiece.panels.map((panel, panelIndex) => <span
                          className="studio-sketch-panel-badge"
                          key={`${panel.panelIndex}-${panelIndex}`}
                          data-testid={`badge-sketch-panel-${index}-${workpieceIndex}-${panel.panelIndex}`}
                        >
                          {panel.label} · {panel.lengthMm ?? "—"} × {panel.depthMm ?? "—"} มม.
                        </span>)}
                      </div>
                    </div>}
                    {workpiece.edges.length > 0 && <div className="studio-sketch-workpiece-section">
                      <strong>ขอบที่ถอดได้</strong>
                      <div className="studio-sketch-workpiece-badges">
                        {workpiece.edges.map((edge, edgeIndex) => <span
                          className={`studio-sketch-edge-badge studio-sketch-edge-badge--${edge.status}`}
                          key={`${edge.side}-${edgeIndex}`}
                          data-testid={`badge-sketch-edge-${index}-${workpieceIndex}-${edgeIndex}`}
                        >
                          {sketchWorkpieceEdgeSideLabel(edge.side)} · {sketchWorkpieceEdgeStatusLabel(edge.status)}{edge.note ? ` · ${edge.note}` : ""}
                        </span>)}
                      </div>
                    </div>}
                    <div className="studio-sketch-workpiece-section" data-testid={`section-sketch-cutouts-${index}-${workpieceIndex}`}>
                      <strong>งานเจาะ (Cutouts)</strong>
                      {workpiece.cutouts.length > 0
                        ? <ul className="studio-sketch-cutout-list">
                          {workpiece.cutouts.map((cutout, cutoutIndex) => <li key={`${cutout.type}-${cutoutIndex}`} data-testid={`item-sketch-cutout-${index}-${workpieceIndex}-${cutoutIndex}`}>
                            {sketchCutoutTypeLabel(cutout.type)}{cutout.count !== null ? ` × ${cutout.count}` : ""}{cutout.description ? ` · ${cutout.description}` : ""}
                          </li>)}
                        </ul>
                        : <span className="studio-sketch-no-cutouts">ไม่พบจุดเจาะที่ระบุ</span>}
                      <p className="studio-sketch-cutout-note">คิดราคาเต็มผืน ไม่หักช่องเจาะ</p>
                    </div>
                    {workpiece.notes && <p className="studio-sketch-workpiece-notes">{workpiece.notes}</p>}
                  </section>)}
                </div>}
                {isBusy && <span className="studio-sketch-analysis-pending"><Loader2 className="studio-sketch-status-spinner" size={14} aria-hidden="true" /> {isRotating ? "กำลังหมุนภาพนี้" : "กำลังวิเคราะห์ภาพนี้"}</span>}
              </div>
            </article>;
          })}
        </div>}
      </div>
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="studio-sketch-file-input" onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; addSketchFiles(files); }} data-testid="input-sketch-camera" />
      <input ref={sketchInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="studio-sketch-file-input" onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; addSketchFiles(files); }} data-testid="input-studio-sketch" />
      <small className="studio-sketch-hint">ไม่เกิน 10 MB ต่อไฟล์ · สูงสุด {MAX_SKETCH_FILES} รูป · สามารถเพิ่มหรือลบรูปได้ก่อนส่ง</small>
    </section>
  );
  const studioShortlistsProps = {
    mode,
    state,
    setState,
    stoneColors,
    basinProducts,
    selectedRectangleId,
    selectedPlacementId,
    onCatalogChangeResolved: acknowledgeCatalogChange,
    onTouchBasinDrop: handleTouchBasinDrop,
  };
  const studioDesignLayout = mode === "sketch" ? (
    <div className="studio-design-layout studio-design-layout--sketch" data-testid="studio-sketch-flow">
      <section className="studio-sketch-step studio-sketch-step--upload" data-testid="step-studio-sketch-upload">
        <div className="studio-sketch-step-heading">
          <span className="studio-sketch-step-number" aria-label="STEP 1">01</span>
          <div><p className="eyebrow">UPLOAD YOUR REFERENCE</p><h2>แนบภาพแบบร่าง / รูปถ่ายหน้างาน</h2></div>
        </div>
        {studioSketchUploadPanel}
      </section>
      <section className="studio-sketch-step studio-sketch-step--shortlists" data-testid="step-studio-sketch-shortlists">
        <div className="studio-sketch-step-heading">
          <span className="studio-sketch-step-number" aria-label="STEP 2">02</span>
          <div><p className="eyebrow">OPTIONAL SPECIFICATIONS</p><h2>สเปกที่สนใจ</h2></div>
        </div>
        <p className="studio-helper studio-sketch-optional-copy">เลือกสเปกที่สนใจเบื้องต้น (ไม่บังคับ) เพื่อให้ทีมงานช่วยวางผังให้ตรงรุ่น หรือปล่อยว่างเพื่อให้ทีมงานช่วยแนะนำ</p>
        <div className="studio-sketch-dimension-card" data-testid="card-sketch-dimensions">
          <div className="studio-sketch-dim-header">
            <strong>📐 ขนาดเคาน์เตอร์ตามแบบร่าง (โดยประมาณ)</strong>
            <span>พื้นที่คำนวณได้: <strong>{estimate.counterAreaSqM.toFixed(3)} ตร.ม.</strong></span>
          </div>
          <div className="studio-sketch-dim-row">
            <label className="studio-sketch-dim-field">
              <span>ความยาวเคาน์เตอร์ (มม.)</span>
              <input
                type="number"
                min="100"
                max="10000"
                step="10"
                value={sketchDimensionDrafts.length}
                aria-invalid={parseBoundedIntegerInput(sketchDimensionDrafts.length, 100, 10_000, 10) === null}
                onChange={(event) => updateSketchDimension("length", event.target.value)}
                onBlur={() => {
                  if (parseBoundedIntegerInput(sketchDimensionDrafts.length, 100, 10_000, 10) !== null) return;
                  setSketchDimensionDrafts((current) => ({ ...current, length: String(sketchLengthMm) }));
                }}
                placeholder="เช่น 1980"
                data-testid="input-sketch-length"
              />
              <small>เช่น 1980 มม. (1.98 เมตร)</small>
            </label>
            <label className="studio-sketch-dim-field">
              <span>ความลึก / หน้ากว้าง (มม.)</span>
              <input
                type="number"
                min="100"
                max="3000"
                step="10"
                value={sketchDimensionDrafts.depth}
                aria-invalid={parseBoundedIntegerInput(sketchDimensionDrafts.depth, 100, 3_000, 10) === null}
                onChange={(event) => updateSketchDimension("depth", event.target.value)}
                onBlur={() => {
                  if (parseBoundedIntegerInput(sketchDimensionDrafts.depth, 100, 3_000, 10) !== null) return;
                  setSketchDimensionDrafts((current) => ({ ...current, depth: String(sketchDepthMm) }));
                }}
                placeholder="เช่น 450"
                data-testid="input-sketch-depth"
              />
              <small>เช่น 450 มม. (0.45 เมตร)</small>
            </label>
          </div>
          {!sketchDimensionsValid && <p className="studio-warning" role="alert" data-testid="status-sketch-invalid-dimensions">ขนาดต้องเป็นจำนวนเต็มตั้งแต่ 100 มม. และอยู่ในช่วงที่กำหนด</p>}
        </div>
        <StudioShortlists {...studioShortlistsProps} />
      </section>
    </div>
  ) : (
    <div className={`studio-design-layout ${isSimpleStudioMode ? "studio-design-layout--simple" : ""} ${mode === "studio" ? "studio-design-layout--canvas-first" : ""}`}>
      <StudioShortlists {...studioShortlistsProps} />
      {mode === "studio" ? (
        <div className="studio-canvas-column">
          <div className="studio-share-actions">
            <button type="button" className="button button--accent" onClick={() => void exportFiles("png")} data-testid="button-share-studio-png">📷 บันทึกผังเป็นรูปภาพ (PNG)</button>
            <button
              type="button"
              className="button button--accent studio-share-button"
              onClick={() => void copyStudioShareLinkToClipboard()}
              aria-live="polite"
              data-testid="button-share-studio-link"
            >
              {studioShareFeedback === "copied"
                ? "✓ คัดลอกลิงก์แล้ว"
                : studioShareFeedback === "failed"
                  ? "คัดลอกลิงก์ไม่สำเร็จ"
                  : "🔗 คัดลอกลิงก์ผังนี้"}
            </button>
            <Link href="/studio-guide" className="button button--outline" data-testid="link-studio-open-guide">📖 วิธีใช้งาน 3 ขั้นตอน</Link>
          </div>
          <StudioCanvas state={state} setState={setState} onLayoutApplied={() => setAssembledStudioRoute(studioRouteKey)} pieceZoom={pieceZoom} setPieceZoom={setPieceZoom} selectedPlacementId={selectedPlacementId} setSelectedPlacementId={setSelectedPlacementId} selectedRectangleId={selectedRectangleId} setSelectedRectangleId={setSelectedRectangleId} basinProducts={basinProducts} stoneColors={stoneColors} simpleMode={isSimpleStudioMode} />
        </div>
      ) : studioSketchUploadPanel}
      {mode === "studio" && estimatePanel}
    </div>
  );
  const linkedSketchViewer = isLeadLinkedMode && linkedLead ? <section className="studio-lead-sketch-viewer" aria-label="ภาพแบบร่างต้นฉบับ" data-testid="studio-lead-sketch-viewer">
    <div className="studio-lead-sketch-heading">
      <div><span>ภาพต้นฉบับ</span><strong>แบบร่างจากลูกค้า</strong></div>
      <span className="studio-lead-sketch-count">{linkedSketchUrls.length} ภาพ</span>
    </div>
    {linkedSketchUrls.length > 0 ? <>
      <button type="button" className="studio-lead-sketch-preview-button" onClick={() => { setExpandedSketchUrl(linkedSketchUrls[0]); setSketchImageZoomed(false); }} aria-label="ขยายภาพแบบร่างต้นฉบับ">
        <img src={linkedSketchUrls[0]} alt={`แบบร่างต้นฉบับของ ${linkedLead.name || "ลูกค้า"}`} />
      </button>
      <a className="studio-lead-sketch-original-link" href={linkedSketchUrls[0]} target="_blank" rel="noreferrer">เปิดภาพต้นฉบับในแท็บใหม่</a>
      {linkedSketchUrls.length > 1 && <div className="studio-lead-sketch-thumbnails">
        {linkedSketchUrls.map((url, index) => <button key={`${url}-${index}`} type="button" onClick={() => { setExpandedSketchUrl(url); setSketchImageZoomed(false); }} aria-label={`ขยายแบบร่างรูปที่ ${index + 1}`} data-testid={`button-zoom-lead-sketch-${index}`}>
          <img src={url} alt="" />
        </button>)}
      </div>}
    </> : <p className="studio-lead-sketch-empty">Lead นี้ไม่มีภาพแบบร่างแนบไว้</p>}
  </section> : null;
  const sketchBridgeParams = new URLSearchParams();
  const bridgeBasinSku = state.basinSkus.find((sku) => basinProducts.some((product) => product.sku === sku));
  const bridgeStoneCode = state.activeStone || state.stoneColors[0] || "";
  if (bridgeBasinSku) sketchBridgeParams.set("basin", bridgeBasinSku);
  if (bridgeStoneCode) sketchBridgeParams.set("stone", bridgeStoneCode);
  const sketchBridgeQuery = sketchBridgeParams.toString();
  const sketchBridgeHref = `/sketch${sketchBridgeQuery ? `?${sketchBridgeQuery}` : ""}`;
  return <div className={`page-wrap studio-page ${mode === "sketch" ? "studio-page--sketch" : ""} ${isSimpleStudioMode ? "studio-page--simple" : ""}`}>
    {isLeadLinkedMode && <section className="studio-linked-lead-banner" data-testid="studio-linked-lead-banner">
      <div>
        <span className="studio-linked-lead-kicker">กำลังแก้ไข Lead</span>
        <strong>{linkedLead ? `#${linkedLead.id} · ${linkedLead.project || linkedLead.name || "ไม่ระบุโครงการ"}` : `#${linkedLeadId ?? "?"}`}</strong>
        <span className="studio-linked-lead-detail">{linkedLead ? "การบันทึกจะอัปเดตผัง 2D ใน Lead นี้ โดยคงสถานะเดิมไว้" : leadsQuery.isLoading ? "กำลังโหลดข้อมูล Lead…" : "ไม่พบ Lead นี้ หรือไม่มีสิทธิ์เข้าถึง"}</span>
      </div>
      {linkedLead && <span className="studio-linked-lead-status">{linkedLead.status}</span>}
    </section>}
    <section className="studio-hero"><div><p className="eyebrow accent">ORDER MODE / {mode === "studio" ? "LAYOUT STUDIO" : "HAND SKETCH"}</p><h1>{mode === "studio" ? <>ประกอบแผ่นจริง<br /><em>ให้เห็นภาพก่อนขอราคา</em></> : <>ส่งแบบร่าง<br /><em>ให้ทีมขายช่วยต่อยอด</em></>}</h1><p className="hero-copy">{mode === "studio" ? "เพิ่มชิ้นงานและสี่เหลี่ยม กำหนดทิศทาง จัดตำแหน่ง และตั้งสถานะรายด้านได้ตามแบบช่างจริง" : "แนบภาพสเก็ตช์ด้วยมือ พร้อมเลือกวัสดุและรุ่นอ่างที่สนใจ ทีมขายจะตรวจสอบแบบและติดต่อกลับ"}</p></div><div className="studio-hero-mark">{mode === "studio" ? "02" : "03"}</div></section>
    {mode === "studio" && <section className="studio-sketch-bridge-banner" aria-label="ส่งภาพแบบร่างด้วยมือ" data-testid="studio-sketch-bridge-banner">
      <p>✍️ ออกแบบเองไม่ถนัด? ส่งภาพแบบร่างด้วยมือ ให้ทีมงาน Knight Furnich ช่วยต่อยอดแบบและคิดราคาให้ฟรี</p>
      <a className="studio-sketch-bridge-cta" href={sketchBridgeHref} data-testid="link-studio-to-sketch">📤 ส่งภาพแบบร่างมือ <ArrowRight size={16} /></a>
    </section>}
    {mode === "sketch" && <section className="sketch-studio-bridge-banner" aria-label="เข้าสู่ 2D Studio" data-testid="sketch-studio-bridge-banner">
      <p>💡 ต้องการลองประกอบแผ่นจริงและคำนวณราคาด้วยตนเอง?</p>
      <a className="sketch-studio-bridge-cta" href="/studio" data-testid="link-sketch-to-studio">✨ เข้าสู่ 2D Studio <ArrowRight size={16} /></a>
    </section>}
    {mode === "studio" && <div className="studio-mode-switch" role="group" aria-label="โหมดการออกแบบ" data-testid="studio-mode-switch">
      <button type="button" className={studioUiMode === "simple" ? "is-active" : ""} aria-pressed={studioUiMode === "simple"} onClick={() => setStudioUiMode("simple")} data-testid="button-studio-mode-simple">โหมดง่าย</button>
      <button type="button" className={studioUiMode === "detailed" ? "is-active" : ""} aria-pressed={studioUiMode === "detailed"} onClick={() => setStudioUiMode("detailed")} data-testid="button-studio-mode-detailed">โหมดละเอียด</button>
    </div>}
    {mode === "studio" && <StudioProgressChecklist state={state} contact={contact} estimate={estimate} />}
    {mode === "studio" && draftNotice && <div className="studio-draft-banner" role="alert" data-testid="studio-draft-banner"><div><strong>พบแบบร่างที่ทำค้างไว้เมื่อ {formatDraftTimestamp(draftNotice.savedAt)}</strong><small>แบบร่างนี้อยู่ในเบราว์เซอร์เครื่องนี้</small></div><div className="studio-draft-banner-actions"><button type="button" className="button button--accent" onClick={resumeDraft} data-testid="button-resume-studio-draft">ดึงแบบร่างเดิม</button><button type="button" className="button button--outline" onClick={startNewDraft} data-testid="button-new-studio-draft">เริ่มออกแบบใหม่</button></div></div>}
     {mode === "studio" && catalogNotice && <StudioCatalogChangeNotice notice={catalogNotice} />}
    {mode === "studio" && <div className="studio-draft-toolbar"><div><p className="eyebrow">DRAFT WORKSPACE</p><span className={`studio-draft-status ${isSavingDraft ? "is-saving" : ""}`} data-testid="status-studio-draft-autosave">{isSavingDraft ? "กำลังบันทึก…" : editingNamedDraftId ? `กำลังแก้ไขแบบร่างที่ตั้งชื่อไว้` : lastSavedAt ? `บันทึกอัตโนมัติล่าสุด ${formatDraftTimestamp(lastSavedAt)}` : "ยังไม่มีแบบร่างที่บันทึก"}</span></div><div className="studio-draft-toolbar-actions"><button type="button" className="icon-button" disabled={!studioHistory.canUndo} onClick={studioHistory.undo} title="ย้อนกลับ (Ctrl+Z)" aria-label="ย้อนกลับ" data-testid="button-studio-undo"><Undo2 size={15} /></button><button type="button" className="icon-button" disabled={!studioHistory.canRedo} onClick={studioHistory.redo} title="ทำซ้ำ (Ctrl+Y)" aria-label="ทำซ้ำ" data-testid="button-studio-redo"><Redo2 size={15} /></button><button type="button" className="button button--outline" disabled={isSavingShareableDraft || isLoadingShareableDraft} onClick={() => void saveStudioDraftForResume()} data-testid="button-studio-save-draft"><Save size={15} /> {isSavingShareableDraft ? "กำลังบันทึก…" : "บันทึกแบบร่างไว้ทำต่อ"}</button><button type="button" className="button button--accent" onClick={openSaveDraftDialog} data-testid="button-save-named-studio-draft"><Save size={15} /> {editingNamedDraftId ? "อัปเดตแบบร่าง" : "บันทึกแบบร่าง"}</button><button type="button" className="button button--outline" onClick={() => setDraftDrawerOpen(true)} data-testid="button-open-studio-drafts"><FolderOpen size={15} /> แบบร่างของฉัน ({namedDrafts.length})</button><button type="button" className="button button--outline" onClick={() => void copyDraftLink()} data-testid="button-save-studio-draft-link"><Link2 size={15} /> คัดลอกลิงก์ปัจจุบัน</button></div></div>}
    {draftResult && <p className="studio-result studio-draft-result" role="status" data-testid="status-studio-draft">{draftResult}</p>}
      {isLeadLinkedMode && linkedLead
        ? <div className="studio-lead-workspace">{linkedSketchViewer}{studioDesignLayout}</div>
        : studioDesignLayout}
    <section className={`studio-layout-bottom ${mode === "studio" ? "studio-layout-bottom--contact" : mode === "sketch" ? "studio-layout-bottom--sketch" : ""}`} data-testid={mode === "sketch" ? "step-studio-sketch-details" : undefined}>
        {mode === "sketch" && <div className="studio-sketch-step-heading studio-sketch-step-heading--wide">
          <span className="studio-sketch-step-number" aria-label="STEP 3">03</span>
          <div><p className="eyebrow">CONTACT &amp; LIVE ESTIMATE</p><h2>ข้อมูลติดต่อและสรุปส่งแบบร่าง</h2></div>
        </div>}
       <div className="studio-panel studio-contact-panel"><div className="studio-panel-heading"><div><p className="eyebrow">04 / PROJECT DETAILS</p><h3>{isLeadLinkedMode ? "ข้อมูลลูกค้าใน Lead" : "ข้อมูลติดต่อและหน้างาน"}</h3></div></div>
         {isLeadLinkedMode && linkedLead ? <div className="studio-lead-contact-summary" data-testid="studio-lead-contact-summary">
           <div><strong>ผู้ติดต่อ</strong><span>{linkedLead.name || "ยังไม่ระบุ"}</span></div>
           <div><strong>โทรศัพท์</strong><span>{linkedLead.phone || "ยังไม่ระบุ"}</span></div>
           <div><strong>อีเมล</strong><span>{linkedLead.email || "ยังไม่ระบุ"}</span></div>
           <div><strong>โครงการ</strong><span>{linkedLead.project || "ยังไม่ระบุ"}</span></div>
           <div><strong>ที่อยู่</strong><span>{linkedLead.address || linkedLead.site || "ยังไม่ระบุ"}</span></div>
         </div> : isLeadLinkedMode ? <p className="studio-lead-contact-loading">{leadsQuery.isLoading ? "กำลังโหลดข้อมูลลูกค้า…" : "ไม่พบข้อมูล Lead"}</p> : <StudioContactFields contact={contact} setContact={setContact} worksitePlaceId={worksitePlaceId} setWorksitePlaceId={setWorksitePlaceId} />}
         <label className="studio-select-label">พื้นที่ติดตั้ง<select value={state.location} onChange={(event) => setState((current) => ({ ...current, location: event.target.value as StudioLocation }))}><option value="bangkok-metro">กรุงเทพฯ / ปริมณฑล</option><option value="province">ต่างจังหวัด</option></select></label>
       </div>
      {mode !== "studio" && !isSimpleStudioMode && estimatePanel}
    </section>
      {mode === "studio" && studioLayoutApplied && <StudioPrintLayout state={state} basinProducts={basinProducts} stoneColors={stoneColors} />}
       {mode === "studio" && studioLayoutApplied && <div className="studio-mobile-estimate-bar" data-testid="studio-mobile-estimate-bar"><div><span>ยอดประเมินรวม:</span><strong>{formatTHB(estimate.totalTHB)}</strong></div><div><button type="button" className="button button--outline" onClick={scrollToEstimate} data-testid="button-mobile-studio-details">ดูรายละเอียด</button><button type="button" className="button button--accent" disabled={submitting || linkedLeadUnavailable || hasBasinClash} aria-describedby={hasBasinClash ? "status-studio-issues-summary" : undefined} onClick={() => void primarySubmit()} data-testid={isLeadLinkedMode ? "button-mobile-studio-save-lead" : "button-mobile-studio-submit"}>{submitting ? isLeadLinkedMode ? "กำลังบันทึก..." : "กำลังส่ง..." : isLeadLinkedMode ? "บันทึก Lead" : "ส่งขอราคา"}</button></div></div>}
      {expandedSketchUrl && <div className="studio-lead-sketch-lightbox" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) { setExpandedSketchUrl(null); setSketchImageZoomed(false); } }}>
        <section className="studio-lead-sketch-dialog" role="dialog" aria-modal="true" aria-label="ดูภาพแบบร่างต้นฉบับ" onClick={(event) => event.stopPropagation()}>
          <header><strong>แบบร่างต้นฉบับ</strong><div><a href={expandedSketchUrl} target="_blank" rel="noreferrer">เปิดไฟล์ต้นฉบับ</a><button type="button" onClick={() => { setExpandedSketchUrl(null); setSketchImageZoomed(false); }} aria-label="ปิดภาพแบบร่าง"><X size={18} /></button></div></header>
          <button type="button" className="studio-lead-sketch-zoom-toggle" onClick={() => setSketchImageZoomed((current) => !current)}>{sketchImageZoomed ? "ย่อภาพ" : "ขยายภาพ"}</button>
          <div className={`studio-lead-sketch-image-stage ${sketchImageZoomed ? "is-zoomed" : ""}`}>
            <img src={expandedSketchUrl} alt={`แบบร่างต้นฉบับของ ${linkedLead?.name || "ลูกค้า"}`} onClick={() => setSketchImageZoomed((current) => !current)} />
          </div>
        </section>
      </div>}
     {mode === "studio" && draftDrawerOpen && <StudioDraftDrawer drafts={namedDrafts} basinProducts={basinProducts} stoneColors={stoneColors} onClose={() => setDraftDrawerOpen(false)} onOpen={openNamedDraft} onCopy={(draft) => void copyNamedDraftLink(draft)} onDelete={deleteNamedDraft} />}
     {mode === "studio" && saveDraftDialogOpen && <div className="studio-save-draft-layer" role="presentation"><div className="studio-save-draft-backdrop" onClick={() => setSaveDraftDialogOpen(false)} /><form className="studio-save-draft-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-save-draft-title" onSubmit={saveNamedDraft} data-testid="studio-save-draft-dialog"><div className="studio-save-draft-heading"><div><p className="eyebrow">SAVE WORKSPACE</p><h2 id="studio-save-draft-title">บันทึกแบบร่าง</h2></div><button type="button" className="icon-button" onClick={() => setSaveDraftDialogOpen(false)} aria-label="ปิดหน้าต่างบันทึกแบบร่าง"><X size={18} /></button></div><label>ชื่อแบบร่าง<input autoFocus value={draftName} onChange={(event) => setDraftName(event.target.value)} data-testid="input-studio-draft-name" /></label><p>เก็บผัง 2D สีหิน ขนาด อ่าง และค่ารายด้านไว้กลับมาทำต่อได้</p><div className="studio-save-draft-actions"><button type="button" className="button button--outline" onClick={() => setSaveDraftDialogOpen(false)} data-testid="button-cancel-save-studio-draft">ยกเลิก</button><button type="submit" className="button button--accent" data-testid="button-confirm-save-studio-draft">บันทึกแบบร่าง</button></div></form></div>}
     {mode === "studio" && shareableDraftDialogOpen && <div className="studio-save-draft-layer" role="presentation"><div className="studio-save-draft-backdrop" onClick={() => setShareableDraftDialogOpen(false)} /><section className="studio-save-draft-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-draft-resume-title" data-testid="studio-draft-resume-dialog"><div className="studio-save-draft-heading"><div><p className="eyebrow">STUDIO DRAFT LINK</p><h2 id="studio-draft-resume-title">บันทึกแบบร่างแล้ว</h2></div><button type="button" className="icon-button" onClick={() => setShareableDraftDialogOpen(false)} aria-label="ปิดหน้าต่างลิงก์แบบร่าง"><X size={18} /></button></div><label>ลิงก์สำหรับเปิดแบบร่างต่อ<input readOnly value={shareableDraftUrl} onFocus={(event) => event.currentTarget.select()} data-testid="input-studio-draft-resume-url" /></label><p>ลิงก์นี้ใช้เปิดผังเดิมเพื่อกลับมาทำต่อได้ภายใน 30 วัน</p><div className="studio-save-draft-actions"><button type="button" className="button button--outline" onClick={() => setShareableDraftDialogOpen(false)}>ปิด</button><button type="button" className="button button--accent" onClick={() => void copyShareableDraftUrl()} data-testid="button-studio-copy-draft-link"><Copy size={15} /> {shareableDraftCopied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}</button></div></section></div>}
      {mode === "studio" && checkout && <StudioCheckoutModal
        token={checkout.token}
        quoteNumber={checkout.quoteNumber}
        quoteTotalTHB={checkout.quoteTotalTHB}
        onClose={() => setCheckout(null)}
      />}
  </div>;
}
