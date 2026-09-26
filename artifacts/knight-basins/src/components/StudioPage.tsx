import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type DragEvent, type FormEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useListAdminLeads } from "@workspace/api-client-react";
import { AlertTriangle, ArrowRight, Bath, Camera, Check, ChevronDown, Copy, Download, FolderOpen, GripVertical, Link2, Loader2, MapPin, Minus, Palette, Pencil, Plus, Redo2, RotateCw, Save, Trash2, Undo2, Upload, X } from "lucide-react";
import { adminQuoteUrl } from "@/admin/leads-utils";
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
  basinPlacementOverlapWarnings,
  calculateBasinCoordinates,
  calculateBasinOffsets,
  clampPlacementToSheet,
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
import { downloadStudioDxf, downloadStudioPng, printStudioLayout, studioExportDimensionsValid, studioPrintTitle, STUDIO_PRINT_NOTE } from "@/data/studio-export";
import { clearStoredStudioDraft, createStudioDraftLink, createStudioShareLink, decodeStudioDraftRecord, readStoredShortStudioDraft, readStoredStudioDraft, readStoredStudioDrafts, removeStoredStudioDraft, upsertStoredStudioDraft, writeStoredStudioDraft, type NamedStudioDraftRecord, type StudioDraftRecord } from "@/data/studio-draft";
import { formatThaiDateTime, thaiDateInputValue } from "@/data/date-time";
import { isValidEmailAddress, isValidPhoneNumber } from "@/data/validation";
import { cleanPhoneInput, normalizeDimensionInput } from "@/data/input-sanitizers";
import { WorksiteAddressAutocomplete } from "./WorksiteAddressAutocomplete";

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

type SketchAnalysisShape = "I" | "L" | "U" | "unknown";
type SketchAnalysisCardPhase = "queued" | "uploading" | "analyzing" | "complete" | "unknown";
type SketchAnalysisCardState = {
  shape: SketchAnalysisShape;
  confidence: number | null;
  notes: string;
  runAMm: number | null;
  depthMm: number | null;
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
  const rawShape = String(result.shape ?? result.shapeType ?? "").trim().toUpperCase();
  const shape: SketchAnalysisShape = rawShape === "I" || rawShape === "L" || rawShape === "U" ? rawShape : "unknown";
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
    runAMm: positiveSketchDimension(result.runAMm),
    depthMm: positiveSketchDimension(result.depthMm),
  };
}

function sketchShapeLabel(shape: SketchAnalysisShape): string {
  if (shape === "I") return "🟦 ทรงตรง (I)";
  if (shape === "L") return "🟨 ทรงแอลซ้าย (L)";
  if (shape === "U") return "🟪 ทรงตัวยู (U)";
  return "shape: unknown · ยังไม่ทราบรูปทรง";
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
): BasinPlacement {
  const placement = createBasinPlacement(product, index, pieceId, sheetId);
  // A diameter followed by bowl depth describes a circular plan-view cutout;
  // use the diameter on both axes so its canvas footprint remains circular.
  return isRoundBasinProduct(product) && placement.widthMm !== null
    ? { ...placement, depthMm: placement.widthMm }
    : placement;
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

  const placement = createStudioBasinPlacement(product, state.basinPlacements.length, piece.id, sheet.id);
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
): StudioState {
  if (!requestedPreset && requestedWidthMm === null) return state;
  const firstPiece = getStudioPieces(state)[0];
  const firstRectangle = firstPiece?.rectangles[0];
  if (!firstPiece || !firstRectangle) return state;

  const widthMm = requestedWidthMm ?? firstRectangle.widthMm;
  const isFreshBoard = firstPiece.rectangles.length === 1 &&
    firstRectangle.widthMm === STUDIO_INITIAL_BOARD_WIDTH_MM &&
    firstRectangle.lengthMm === STUDIO_INITIAL_BOARD_LENGTH_MM;
  const depthMm = Math.max(
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
];

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
  if (!piece.hasCustomEdges || piece.preset !== preset || piece.rectangles.length !== defaults.length) return defaults;

  return piece.rectangles.map((rectangle) => ({
    lengthMm: String(rectangle.widthMm),
    depthMm: String(rectangle.lengthMm),
    edges: {
      top: piece.sideStatuses[`${rectangle.id}:top`] ?? "normal",
      right: piece.sideStatuses[`${rectangle.id}:right`] ?? "normal",
      bottom: piece.sideStatuses[`${rectangle.id}:bottom`] ?? "normal",
      left: piece.sideStatuses[`${rectangle.id}:left`] ?? "normal",
    },
  }));
}

function studioCustomShapePanelLabel(preset: StudioPreset, index: number) {
  if (index === 0) return preset === "i" ? "แผ่นหลัก" : "แผ่นแนวผนัง";
  if (preset === "l-left") return "แผ่นขาซ้าย";
  if (preset === "l-right") return "แผ่นขาขวา";
  return index === 1 ? "แผ่นขาซ้าย" : "แผ่นขาขวา";
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
  onApplied: () => void;
}) {
  const [preset, setPreset] = useState<StudioPreset>(() => studioCustomShapePresetForPiece(targetPiece));
  const [panelDrafts, setPanelDrafts] = useState<StudioCustomShapePanelDraft[]>(
    () => studioCustomShapeDraftsForPiece(targetPiece, preset),
  );
  const [openEdgeSelector, setOpenEdgeSelector] = useState<string | null>(null);

  useEffect(() => {
    const nextPreset = studioCustomShapePresetForPiece(targetPiece);
    setPreset(nextPreset);
    setPanelDrafts(studioCustomShapeDraftsForPiece(targetPiece, nextPreset));
    setOpenEdgeSelector(null);
  }, [targetPiece.id]);

  const selectDraftPreset = (nextPreset: StudioPreset) => {
    if (nextPreset === preset) return;
    setPreset(nextPreset);
    setPanelDrafts(studioCustomShapeDefaults(nextPreset));
    setOpenEdgeSelector(null);
  };

  const defaultDimensions = studioCustomShapeDefaults(preset);
  const modelPanels: StudioCustomShapePanelData[] = panelDrafts.map((panel) => ({
    widthMm: Number(panel.lengthMm),
    depthMm: Number(panel.depthMm),
    edges: panel.edges,
  }));
  const dimensionsValid = modelPanels.length > 0 && modelPanels.every((panel) =>
    Number.isInteger(panel.widthMm) && panel.widthMm > 0 &&
    Number.isInteger(panel.depthMm) && panel.depthMm > 0,
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
    setState((current) => {
      const currentPieces = getStudioPieces(current);
      const currentPiece = currentPieces.find((piece) => piece.id === targetPiece.id);
      if (!currentPiece) return current;

      const builtPiece = {
        ...buildCustomShapePiece(currentPiece.id, preset, shapePanels),
        name: currentPiece.name,
      };
      const geometryChanged = currentPiece.preset !== preset ||
        currentPiece.rectangles.length !== builtPiece.rectangles.length ||
        builtPiece.rectangles.some((rectangle, index) => {
          const previous = currentPiece.rectangles[index];
          return !previous ||
            previous.widthMm !== rectangle.widthMm ||
            previous.lengthMm !== rectangle.lengthMm ||
            previous.xMm !== rectangle.xMm ||
            previous.yMm !== rectangle.yMm ||
            previous.rotation !== rectangle.rotation;
        });

      return {
        ...current,
        shape: preset === "i" ? "I" : preset === "u" ? "U" : "L",
        pieces: currentPieces.map((piece) => piece.id === currentPiece.id ? builtPiece : piece),
        activePieceId: builtPiece.id,
        basinPlacements: geometryChanged
          ? current.basinPlacements.filter((placement) => (placement.pieceId ?? currentPiece.id) !== currentPiece.id)
          : current.basinPlacements,
      };
    });
    setOpenEdgeSelector(null);
    onApplied();
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
  const targeted = { ...placement, pieceId: piece.id, sheetId: sheet.id, anchor };
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
    const placement = createStudioBasinPlacement(product, current.basinPlacements.length, piece.id, sheet.id);
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
      const next = current.stoneColors.filter((item) => item !== code);
      return { ...current, stoneColors: next, activeStone: current.activeStone === code ? (next[0] ?? "") : current.activeStone, stoneSelectionSource: "user" };
    }
    // Auto-apply the newly shortlisted color to the canvas/estimate only when
    // nothing is active yet (first pick, or the active color was just removed).
    // Adding a second/third color to compare must not steal the active slot
    // from whichever one the customer is already looking at.
    return { ...current, stoneColors: [...current.stoneColors, code], activeStone: current.activeStone || code, stoneSelectionSource: "user" };
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
  const stoneSelector = <section className={`studio-panel studio-selector-panel ${mode === "studio" ? "studio-stone-popover-panel" : ""}`}>
    <div className="studio-panel-heading"><div><p className="eyebrow">01 / MATERIAL SHORTLIST</p><h3>เลือกสีหิน</h3></div><span>{state.stoneColors.length} สี</span></div>
    <p className="studio-helper">เลือกสีเพื่อเปรียบเทียบ แล้วเลือกสีที่ใช้คำนวณจากรายการด้านล่าง</p>
    <div className="studio-stone-price-filters" role="tablist" aria-label="กรองราคาต่อตารางเมตร รวมติดตั้ง">
      {stonePriceFilterOptions.map((option) => <button type="button" role="tab" aria-selected={activeStonePriceFilter === option.value} className={activeStonePriceFilter === option.value ? "is-active" : ""} onClick={() => setStonePriceFilter(option.value)} key={option.value} data-testid={`button-studio-stone-price-filter-${option.value}`}>{option.label} <small>{option.count}</small></button>)}
    </div>
    <div className="studio-stone-list">{visibleStoneColors.map((stone) => {
      const selected = state.stoneColors.includes(stone.code);
      return <button type="button" key={stone.code} className={`studio-stone-choice ${selected ? "is-selected" : ""} ${state.activeStone === stone.code ? "is-active" : ""}`} onClick={() => { toggleStone(stone.code); if (mode === "studio") setOpenCatalog(null); }} aria-pressed={selected} data-testid={`button-studio-stone-${stone.code}`}><span className="studio-stone-swatch" style={{ background: stone.tone }} /> <strong>{stone.code}</strong><small>{stone.name}</small>{selected && <span className="studio-selection-check" aria-hidden="true"><Check size={12} /></span>}</button>;
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
      <div className="studio-selector-anchor">
        <button type="button" className="studio-selector-trigger" aria-expanded={openCatalog === "stone"} aria-controls="studio-stone-popover" onClick={() => setOpenCatalog((current) => current === "stone" ? null : "stone")} data-testid="button-open-studio-stone-popover">
          <Palette size={17} /><span><small>สีหิน</small><strong>{activeStone.name} ({activeStone.code})</strong><span>{formatTHB(activeStone.installedPriceTHB ?? 0)} บ./ตร.ม.</span></span><ChevronDown size={16} />
        </button>
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
  zoom,
  selectedPlacementId,
  setSelectedPlacementId,
}: {
  piece: StudioPiece;
  state: StudioState;
  setState: Dispatch<SetStateAction<StudioState>>;
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
             <label>กว้าง (มม.)<input type="number" min="1" value={rectangle.widthMm} onChange={(event) => setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.map((item) => item.id === rectangle.id ? { ...item, widthMm: numericValue(event.target.value) } : item) }))} data-testid={`input-rectangle-width-${rectangle.id}`} /></label>
             <label>ยาว (มม.)<input type="number" min="1" value={rectangle.lengthMm} onChange={(event) => setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.map((item) => item.id === rectangle.id ? { ...item, lengthMm: numericValue(event.target.value) } : item) }))} data-testid={`input-rectangle-length-${rectangle.id}`} /></label>
             <label>X<input type="number" min="0" value={rectangle.xMm} onChange={(event) => setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.map((item) => item.id === rectangle.id ? { ...item, xMm: numericValue(event.target.value) } : item) }))} data-testid={`input-rectangle-x-${rectangle.id}`} /></label>
             <label>Y<input type="number" min="0" value={rectangle.yMm} onChange={(event) => setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.map((item) => item.id === rectangle.id ? { ...item, yMm: numericValue(event.target.value) } : item) }))} data-testid={`input-rectangle-y-${rectangle.id}`} /></label>
          </div>
            {smallDimensions.length > 0 && <div className="studio-warning studio-warning--small" data-testid={`status-small-rectangle-${rectangle.id}`} aria-live="polite"><AlertTriangle size={16} /><div>{smallDimensions.map((value) => <p key={value}>{smallRectangleWarning(value)}</p>)}</div></div>}
           <p className="studio-helper">หน่วย มิลลิเมตร (มม.) เช่น 600 มม. = 60 ซม. / 1800 มม. = 1.8 เมตร</p>
           {rectangle.widthMm > 900 && <div className="studio-dimension-suggestion" aria-live="polite"><span>ความกว้าง (แนวลึก) เกิน 900 มม. ตรวจสอบทิศทางอีกครั้ง</span><button type="button" className="button button--outline" onClick={() => setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.map((item) => item.id === rectangle.id ? { ...item, widthMm: item.lengthMm, lengthMm: item.widthMm } : item) }))} data-testid={`button-swap-rectangle-dimensions-${rectangle.id}`}><RotateCw size={14} /> สลับ กว้าง ↔ ยาว</button></div>}
           <button type="button" className="button button--outline studio-rotate-button" onClick={() => setPieceState(setState, piece.id, (current) => ({ ...current, rectangles: current.rectangles.map((item) => item.id === rectangle.id ? { ...item, rotation: item.rotation === 0 ? 90 : 0 } : item) }))}><RotateCw size={14} /> สลับแนวนอน / แนวตั้ง</button>
           <div className="studio-side-status-grid">{statuses.map(({ side, label, status }) => <label key={side}>{label}<select value={status} onChange={(event) => changeStatus(rectangle.id, side, event.target.value as SideStatus)}><option value="normal">ปกติ</option><option value="upstand">ติดบัว ▲</option><option value="open-edge">ขอบเปิด ⊗</option><option value="wall-flush">ชิดผนัง ║</option></select></label>)}</div>
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
     <StudioFootprint piece={piece} stoneTone={stoneColorByName(state.activeStone).tone} zoom={zoom} canvasPieceId={piece.id} testId={piece.id === state.pieces?.[0]?.id ? "studio-canvas" : `studio-canvas-${piece.id}`} ariaLabel={`ผังชิ้นงาน ${piece.name}`} onDragOver={(event) => event.preventDefault()} onDrop={drop}>
       {placements.map((placement) => {
        const unknown = placement.widthMm === null || placement.depthMm === null;
         const crossesJoint = !unknown && placementCrossesPanelJoint(piece, placement);
          return <div key={placement.id} draggable className={`studio-placement ${unknown ? "studio-placement--unknown" : ""} ${crossesJoint ? "studio-placement--invalid" : ""} ${placement.id === selectedPlacementId ? "studio-placement--selected" : ""}`} style={{ left: `${(placement.xMm / Math.max(1, bounds.widthMm)) * 100}%`, top: `${(placement.yMm / Math.max(1, bounds.heightMm)) * 100}%`, width: unknown ? "18%" : `${((placement.widthMm ?? 0) / Math.max(1, bounds.widthMm)) * 100}%`, height: unknown ? "18%" : `${((placement.depthMm ?? 0) / Math.max(1, bounds.heightMm)) * 100}%` }} onClick={() => setSelectedPlacementId(placement.id)} onDragStart={(event) => { setSelectedPlacementId(placement.id); event.dataTransfer.setData("application/x-studio-placement", placement.id); }} role="button" tabIndex={0} aria-pressed={placement.id === selectedPlacementId} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedPlacementId(placement.id); } }}><strong>{placement.sku}</strong><small>{unknown ? "ขนาดหลุมไม่ระบุ" : crossesJoint ? "อ่างคร่อมรอยต่อแผ่น" : "แตะเพื่อเลือก · ลากเพื่อย้าย"}</small><button type="button" onClick={(event) => { event.stopPropagation(); setSelectedPlacementId((current) => current === placement.id ? null : current); setState((current) => ({ ...current, basinPlacements: current.basinPlacements.filter((item) => item.id !== placement.id) })); }} aria-label={`นำ ${placement.sku} ออกจากผัง`}><X size={12} /></button></div>;
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
    const placement = createStudioBasinPlacement(product, state.basinPlacements.length, piece.id, sheet.id);
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
      return placementAtCoordinates(rotated, piece, sheet, rotated.xMm, rotated.yMm, rotated.anchor ?? placement.anchor ?? "top-left");
    });
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
        <StudioFootprint piece={piece} stoneTone={stoneTone} zoom={zoom} edgeStatus={selectedEdgeStatus} onEdgeStatusChange={changeStatus} canvasPieceId={piece.id} highlightRectangleId={highlightRectangleId} testId={piece.id === state.pieces?.[0]?.id ? "studio-canvas" : `studio-canvas-${piece.id}`} ariaLabel={`ผังชิ้นงาน ${piece.name}`} onDragOver={(event) => event.preventDefault()} onDrop={drop}>
          {placements.map((placement) => {
            const unknown = placement.widthMm === null || placement.depthMm === null;
            const crossesJoint = !unknown && placementCrossesPanelJoint(piece, placement);
            const product = basinProducts.find((item) => item.sku === placement.sku);
            const inactive = !product;
            const cutSize = placementCutSize(placement);
            const targetWarnings = placementTargetWarnings(placement, getStudioPieces(state));
            const sheetWarnings = placementSheetWarnings(placement, piece);
            const placementWarnings = [...targetWarnings, ...sheetWarnings];
            return <div key={placement.id} draggable className={`studio-placement ${unknown ? "studio-placement--unknown" : ""} ${inactive ? "studio-placement--inactive" : ""} ${crossesJoint || placementWarnings.length > 0 ? "studio-placement--invalid" : ""} ${placement.id === selectedPlacementId ? "studio-placement--selected" : ""}`} style={{ left: `${(placement.xMm / Math.max(1, bounds.widthMm)) * 100}%`, top: `${(placement.yMm / Math.max(1, bounds.heightMm)) * 100}%`, width: unknown ? "18%" : `${((cutSize.widthMm ?? 0) / Math.max(1, bounds.widthMm)) * 100}%`, height: unknown ? "18%" : `${((cutSize.heightMm ?? 0) / Math.max(1, bounds.heightMm)) * 100}%` }} onClick={() => { setSelectedPlacementId(placement.id); setSelectedRectangleId(null); }} onPointerDown={(event) => beginPointerDrag(event, "placement", placement.id)} onPointerMove={movePointerDrag} onPointerUp={endPointerDrag} onPointerCancel={endPointerDrag} onDragStart={(event) => { setSelectedPlacementId(placement.id); event.dataTransfer.setData("application/x-studio-placement", placement.id); }} role="button" tabIndex={0} aria-pressed={placement.id === selectedPlacementId} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedPlacementId(placement.id); setSelectedRectangleId(null); } }}><span className="studio-placement-visual">{product && <BasinTopView product={product} testId={`studio-placement-top-view-${placement.id}`} />}</span><strong>{placement.sku}</strong><small>{inactive ? "ไม่เปิดใช้งานแล้ว · เปลี่ยนรุ่นหรือนำออก" : placementWarnings[0] ?? (unknown ? "ขนาดหลุมไม่ระบุ" : `${cutSize.widthMm} × ${cutSize.heightMm} มม. · ลากเพื่อย้าย`)}</small><button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setSelectedPlacementId((current) => current === placement.id ? null : current); setState((current) => ({ ...current, basinPlacements: current.basinPlacements.filter((item) => item.id !== placement.id) })); }} aria-label={`นำ ${placement.sku} ออกจากผัง`}><X size={12} /></button></div>;
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
            <label>กว้าง (มม.)<input type="number" min="1" value={activeRectangle.widthMm} onChange={(event) => updateRectangle((rectangle) => ({ ...rectangle, widthMm: numericValue(event.target.value) }))} data-testid={`input-rectangle-width-${activeRectangle.id}`} /></label>
              <label>{simpleShapeLegDepthMm > 0 ? "ยาวรวม (มม.)" : "ยาว (มม.)"}<input type="number" min={simpleShapeLegDepthMm > 0 ? simpleShapeLegDepthMm + 1 : 1} value={activeRectangle.lengthMm + simpleShapeLegDepthMm} onChange={(event) => updateRectangle((rectangle) => ({ ...rectangle, lengthMm: Math.max(1, numericValue(event.target.value) - simpleShapeLegDepthMm) }))} data-testid={`input-rectangle-length-${activeRectangle.id}`} /></label>
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
                  <label>X (มม.)<input type="number" min="0" value={activeRectangle.xMm} onChange={(event) => updateRectangle((rectangle) => ({ ...rectangle, xMm: numericValue(event.target.value) }))} data-testid={`input-rectangle-x-${activeRectangle.id}`} /></label>
                  <label>Y (มม.)<input type="number" min="0" value={activeRectangle.yMm} onChange={(event) => updateRectangle((rectangle) => ({ ...rectangle, yMm: numericValue(event.target.value) }))} data-testid={`input-rectangle-y-${activeRectangle.id}`} /></label>
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
            return [bySide("top"), bySide("bottom"), bySide("left"), bySide("right")].map(({ side, label, status }) => <label key={side}>{label}<select value={status} onChange={(event) => changeStatus(activeRectangle.id, side, event.target.value as SideStatus)}><option value="normal">ปกติ</option><option value="upstand">ติดบัว ▲</option><option value="open-edge">ขอบเปิด ⊗</option><option value="wall-flush">ชิดผนัง ║</option></select></label>);
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
  const activeStoneTone = stoneColorByName(state.activeStone, stoneColors).tone;
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
        {state.stoneColors.map((code) => <button type="button" key={code} className={state.activeStone === code ? "is-active" : ""} onClick={() => setState((current) => ({ ...current, activeStone: code }))} data-testid={`button-studio-quickbar-stone-${code}`}><span className="studio-canvas-quickbar-swatch" style={{ background: stoneColorByName(code).tone }} />{code}</button>)}
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
          state={state}
          setState={setState}
          targetPiece={activePiece}
          simpleMode={simpleMode}
          onApplied={() => {
            setSelectedRectangleId(null);
            setSelectedPlacementId(null);
          }}
        />
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
  const studioSearchParams = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const leadIdParam = studioSearchParams.get("leadId");
  const isLeadLinkedMode = leadIdParam !== null;
  const linkedLeadId = leadIdParam?.trim() || null;
  const queryClient = useQueryClient();
  const leadsQuery = useListAdminLeads(undefined, { query: { enabled: linkedLeadId !== null } });
  const linkedLead = linkedLeadId
    ? leadsQuery.data?.find((lead) => String(lead.id) === linkedLeadId) ?? null
    : null;
  const linkedSketchUrls = useMemo(() => linkedLeadSketchUrls(linkedLead), [linkedLead]);
  const linkedDraft = useMemo(
    () => isLeadLinkedMode
      ? { token: "", state: null as StudioState | null, catalogContext: undefined as StudioCatalogContext | undefined }
      : readLinkedDraft(),
    [isLeadLinkedMode],
  );
  const requestedBasinSku = studioSearchParams.get("basin")?.trim() ?? "";
  const requestedBasinProduct = requestedBasinSku
    ? basinProducts.find((product) => product.sku.toLowerCase() === requestedBasinSku.toLowerCase())
    : undefined;
  const requestedStoneCode = studioSearchParams.get("stone")?.trim() ?? "";
  const requestedStoneColor = requestedStoneCode
    ? stoneColors.find((stone) => stone.code.toLowerCase() === requestedStoneCode.toLowerCase())
    : undefined;
  const requestedStudioPreset = studioPresetFromQuery(studioSearchParams.get("shape"));
  const requestedStudioWidthValue = Number(studioSearchParams.get("width"));
  const requestedStudioWidthMm = Number.isSafeInteger(requestedStudioWidthValue) && requestedStudioWidthValue > 0
    ? requestedStudioWidthValue
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
      ? applyStudioShareParameters(withRequestedBasin, requestedStudioPreset, requestedStudioWidthMm)
      : withRequestedBasin;
    return normalizeStudioState(withRequestedStudioParameters, basinProducts, stoneColors);
  });
  const [studioUiMode, setStudioUiMode] = useState<"simple" | "detailed">("simple");
  const isSimpleStudioMode = mode === "studio" && studioUiMode === "simple";
  const [studioShareFeedback, setStudioShareFeedback] = useState<"copied" | "failed" | null>(null);
  const studioShareFeedbackTimeoutRef = useRef<number | null>(null);
  const [draftNotice, setDraftNotice] = useState<StudioDraftRecord | null>(() => mode === "studio" && !isLeadLinkedMode && !linkedDraft.state ? readStoredStudioDraft() : null);
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
  const [sketchAnalysisByFile, setSketchAnalysisByFile] = useState<Map<File, SketchAnalysisCardState>>(() => new Map());
  const [sketchStatus, setSketchStatus] = useState<SketchProcessingStatus | null>(null);
  const sketchPreviewUrlCache = useRef<Map<File, string>>(new Map());
  const sketchInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const sketchFilesRef = useRef<File[]>([]);
  const sketchAnalysisQueueRef = useRef<Promise<void>>(Promise.resolve());
  const sketchDimensionEditVersionRef = useRef(0);
  const activeSketchAnalysisFileRef = useRef<File | null>(null);
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
    const placement = createStudioBasinPlacement(product, state.basinPlacements.length, piece.id, sheet.id);
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
  const estimate = useMemo(() => studioEstimate(state, basinProducts), [state, basinProducts]);
  const activeStone = stoneColorByName(state.activeStone, stoneColors);
  const counterStoneTotal = Math.max(0, estimate.stoneTotalTHB - estimate.upstandTotalTHB);
  const exportReady = mode === "studio" && studioExportDimensionsValid(state);
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
    const issues = studioSubmissionValidationMessages(state, estimate);
    if (!hasAttemptedSubmit) return issues;
    const contactIssues: string[] = [];
    if (!contact.name.trim() || !contact.phone.trim() || !contact.project.trim() || !contact.address.trim()) contactIssues.push("กรุณากรอกชื่อผู้ติดต่อ โทรศัพท์ ชื่อโครงการ และสถานที่ติดตั้ง");
    if (contact.phone.trim() && !isValidPhoneNumber(contact.phone)) contactIssues.push("เบอร์โทรศัพท์ต้องเป็นตัวเลข 9–10 หลัก");
    if (contact.taxId && !/^[0-9]{13}$/.test(contact.taxId)) contactIssues.push("เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก");
    if (hasPastInstallationDate) contactIssues.push("วันที่เข้าติดตั้งต้องไม่เป็นวันที่ผ่านมา");
    if (contact.email.trim() && !isValidEmailAddress(contact.email)) contactIssues.push("กรุณากรอกอีเมลให้ถูกต้อง (เช่น name@example.com)");
    return [...issues, ...contactIssues];
  }, [state, estimate, hasAttemptedSubmit, contact.name, contact.phone, contact.project, contact.address, contact.taxId, contact.email, hasPastInstallationDate]);
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
          setState((current) => ({
            ...current,
            dimensions: {
              ...current.dimensions,
              runAMm: analysis.runAMm!,
              depthMm: analysis.depthMm!,
            },
            pieces: current.pieces?.map((piece, pieceIndex) => pieceIndex === 0 ? {
              ...piece,
              rectangles: piece.rectangles.map((rectangle, rectangleIndex) => rectangleIndex === 0
                ? { ...rectangle, widthMm: analysis.runAMm!, lengthMm: analysis.depthMm! }
                : rectangle),
            } : piece),
          }));
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
  const addSketchFiles = (files: File[]) => {
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
        phase: "queued",
      }));
      return next;
    });
    setResult("");
    sketchAnalysisQueueRef.current = sketchAnalysisQueueRef.current.then(() => analyzeSketch(accepted));
  };
  const removeSketchFile = (index: number) => {
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
    if (mode !== "studio" || isLeadLinkedMode) return;
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
  }, [mode, isLeadLinkedMode, state, basinProducts, catalogNotice]);
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
    setHasAttemptedSubmit(true);
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
      const stoneMaterialPrice = stoneColorByName(activeStone.code, stoneColors).sheetPriceTHB;
      const stoneLaborPrice = estimate.stoneUnitPriceTHB !== null && stoneMaterialPrice !== null
        ? Math.max(0, estimate.stoneUnitPriceTHB - stoneMaterialPrice)
        : null;
      if (estimate.stoneUnitPriceTHB !== null && estimate.stoneAreaSqM > 0) notificationItems.push({
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
      notificationItems.push({ kind: "service", code: "WORKPIECES", description: `${estimate.pieceCount} ชิ้นงาน · ${estimate.rectangleCount} แผ่น`, quantity: estimate.pieceCount, unit: "ชิ้นงาน", unitPriceTHB: 0, totalTHB: 0, workQuantity: estimate.pieceCount, workUnit: "ชิ้นงาน" });
      if (estimate.upstandLengthM > 0) notificationItems.push({ kind: "service", code: "UPSTAND", description: `บัวยาว ${estimate.upstandLengthM.toFixed(2)} ม. · สูง ${state.upstandHeightMm ?? "ไม่ระบุ"} มม.`, quantity: estimate.upstandLengthM, unit: "ม.", unitPriceTHB: estimate.upstandLengthM ? estimate.upstandTotalTHB / estimate.upstandLengthM : 0, totalTHB: estimate.upstandTotalTHB, workQuantity: estimate.upstandLengthM, workUnit: "ม." });
      if (estimate.openEdgeLengthM > 0) notificationItems.push({ kind: "service", code: "OPEN_EDGE", description: `ขอบเปิดยาว ${estimate.openEdgeLengthM.toFixed(2)} ม.`, quantity: estimate.openEdgeLengthM, unit: "ม.", unitPriceTHB: estimate.openEdgeUnitPriceTHB ?? 0, totalTHB: estimate.openEdgeTotalTHB, workQuantity: estimate.openEdgeLengthM, workUnit: "ม." });
      if (estimate.installationChargeTHB > 0) notificationItems.push({ kind: "service", code: "INSTALL", description: "ค่าติดตั้ง / ค่าแรงต่อชุด", quantity: state.basinPlacements.length, unit: "ชุด", unitPriceTHB: state.basinPlacements.length ? estimate.installationChargeTHB / state.basinPlacements.length : 0, totalTHB: estimate.installationChargeTHB, laborUnitPriceTHB: state.basinPlacements.length ? estimate.installationChargeTHB / state.basinPlacements.length : 0, workQuantity: state.basinPlacements.length, workUnit: "ชุด" });
      if (estimate.smallJobFeeTHB > 0) notificationItems.push({ kind: "service", code: "SMALL-JOB", description: "ค่าดำเนินการงานพื้นที่เล็ก", quantity: 1, unit: "งาน", unitPriceTHB: estimate.smallJobFeeTHB, totalTHB: estimate.smallJobFeeTHB, workQuantity: 1, workUnit: "งาน" });
      await onSubmitStudio({ state, estimate, contact, worksitePlaceId, notification: { items: notificationItems, grossSubtotal: estimate.grossSubtotalTHB, discountAmount: estimate.grossSubtotalTHB - estimate.subtotalTHB, subtotal: estimate.subtotalTHB, vatAmount: estimate.vatAmountTHB, total: estimate.totalTHB, vat: state.vat } });
    } catch (error) {
      // onSubmitStudio only fails via the API client, whose error.message is a
      // technical "HTTP {status} {statusText}" string meant for logs, not
      // customers — log it for diagnostics but always show a plain-language
      // message here.
      console.error("Studio submission failed:", error);
      setResult("ส่งใบเสนอราคาไม่สำเร็จ กรุณาลองอีกครั้ง หรือติดต่อทีมขายโดยตรงหากยังพบปัญหา");
    } finally {
      setSubmitting(false);
    }
  };
  const saveStudioToLinkedLead = async () => {
    if (!linkedLeadId || !linkedLead) {
      setResult("ไม่พบ Lead ที่ต้องการบันทึก กรุณากลับไปเลือก Lead อีกครั้ง");
      return;
    }
    const validationMessage = studioSubmissionValidationMessage(state, estimate);
    if (validationMessage) {
      setResult(validationMessage);
      return;
    }
    setSubmitting(true);
    setResult("");
    setSavedLeadStateFingerprint(null);
    try {
      const studioData = {
        ...studioDataRecord(linkedLead.studioData),
        ...state,
        state,
        estimate,
        worksitePlaceId,
      };
      const response = await fetch(`/api/admin/leads/${encodeURIComponent(linkedLeadId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: linkedLead.status,
          notes: linkedLead.notes ?? null,
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
    const sketchNotificationItems: StudioNotificationItem[] = [];
    if (activeStone?.code && estimate.counterAreaSqM > 0) {
      const stoneUnitPrice = estimate.stoneUnitPriceTHB ?? 0;
      sketchNotificationItems.push({
        kind: "stone" as const,
        code: activeStone.code,
        description: `ท็อปเคาน์เตอร์หินสังเคราะห์ ${activeStone.name || activeStone.code}`,
        quantity: Number(estimate.counterAreaSqM.toFixed(4)),
        unit: "ตร.ม.",
        unitPriceTHB: stoneUnitPrice,
        totalTHB: Math.round(estimate.counterAreaSqM * stoneUnitPrice),
        workQuantity: Number(estimate.counterAreaSqM.toFixed(4)),
        workUnit: "ตร.ม.",
      });
    }
    state.basinSkus.forEach((sku) => {
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
    if (estimate.installationChargeTHB > 0) {
      sketchNotificationItems.push({
        kind: "service" as const,
        code: "INSTALL-BASIN",
        description: `ค่าบริการติดตั้งอ่างล้างหน้า (${state.basinSkus.length} จุด)`,
        quantity: state.basinSkus.length,
        unit: "จุด",
        unitPriceTHB: INSTALLATION_PRICE,
        totalTHB: estimate.installationChargeTHB,
        workQuantity: state.basinSkus.length,
        workUnit: "จุด",
      });
    }
    if (estimate.smallJobFeeTHB > 0) {
      sketchNotificationItems.push({
        kind: "service" as const,
        code: "SMALL-JOB-FEE",
        description: "ค่าดำเนินการงานพื้นที่เล็ก",
        quantity: 1,
        unit: "งาน",
        unitPriceTHB: estimate.smallJobFeeTHB,
        totalTHB: estimate.smallJobFeeTHB,
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
      productSkus: state.basinSkus,
      name,
      company: company || null,
      phone,
      lineContact: contact.lineContact || null,
      email: email || null,
      project,
      address: address || null,
      site: contact.site || address || null,
      purchasingDepartment: contact.purchasingDepartment || null,
      notes: contact.notes || null,
      taxName: contact.taxName || null,
      taxId: contact.taxId || null,
      taxBranch: contact.taxBranch || null,
      taxAddress: contact.taxAddress || null,
      preferredContact: contact.preferredContact || null,
      customerRole: contact.customerRole || null,
      propertyType: contact.propertyType || null,
      condoFloor: contact.condoFloor || null,
      expectedInstallationDate: contact.expectedInstallationDate || null,
      studioData: {
        ...state,
        estimate,
        worksitePlaceId,
        items: sketchNotificationItems,
        notification: {
          items: sketchNotificationItems,
          vat: state.vat,
          subtotalTHB: estimate.subtotalTHB,
          vatTHB: estimate.vatAmountTHB,
          totalTHB: estimate.totalTHB
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
      setSubmitting(false);
    }
  };
  const currentLeadStateFingerprint = JSON.stringify(state);
  const linkedLeadLayoutIsSaved = savedLeadStateFingerprint === currentLeadStateFingerprint;
  const hasUnsavedLinkedLeadChanges = isLeadLinkedMode && savedLeadStateFingerprint !== null && !linkedLeadLayoutIsSaved;
  const linkedLeadUnavailable = isLeadLinkedMode && (!linkedLeadId || !linkedLead || leadsQuery.isLoading);
  const primarySubmit = isLeadLinkedMode ? saveStudioToLinkedLead : mode === "studio" ? submitStudio : submitSketch;
  const scrollToEstimate = () => document.querySelector(".studio-estimate-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const estimatePanel = (
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
      {mode !== "sketch" && <StudioStoneComparison state={state} setState={setState} />}
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
      {mode === "studio" && studioIssues.length > 0 && <div className="studio-issues-summary" role="status" data-testid="status-studio-issues-summary">
        <strong>{studioIssues.length === 1 ? "มี 1 จุดที่ต้องแก้ไขก่อนส่งคำขอ" : `มี ${studioIssues.length} จุดที่ต้องแก้ไขก่อนส่งคำขอ`}</strong>
        <ul>{studioIssues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>
      </div>}
      {mode === "studio" && <div className="studio-export-actions"><button type="button" className="button button--outline" disabled={!exportReady} onClick={() => void exportFiles("dxf")} data-testid="button-download-studio-dxf"><Download size={15} /> ดาวน์โหลดแบบ (DXF)</button><button type="button" className="button button--outline" disabled={!exportReady} onClick={() => void exportFiles("pdf")} data-testid="button-download-studio-pdf"><Download size={15} /> ดาวน์โหลดแบบ (PDF)</button><button type="button" className="button button--outline" disabled={!exportReady} onClick={() => void exportFiles("png")} data-testid="button-download-studio-png"><Download size={15} /> ดาวน์โหลดภาพ (PNG)</button></div>}
      <button type="button" className="button button--dark full-width" disabled={submitting || linkedLeadUnavailable} onClick={() => void primarySubmit()} data-testid={isLeadLinkedMode ? "button-save-studio-to-lead" : mode === "studio" ? "button-submit-studio" : "button-submit-sketch"}>{submitting ? isLeadLinkedMode ? "กำลังบันทึก..." : "กำลังส่ง..." : isLeadLinkedMode ? "บันทึกผังลง Lead" : mode === "studio" ? "ขอใบเสนอราคาจากแบบนี้" : "🚀 ส่งภาพแบบร่างให้ทีมขายประเมินราคา"} <ArrowRight size={16} /></button>
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
        {sketchFiles.length < MAX_SKETCH_FILES && <div className="studio-sketch-actions">
          <button
            type="button"
            className="button button--outline"
            onClick={() => cameraInputRef.current?.click()}
            disabled={sketchStatus?.busy}
            data-testid="button-sketch-camera"
          >
            <Camera size={17} /> {sketchStatus?.busy ? "กำลังประมวลผล…" : "ถ่ายรูปจากกล้องทันที"}
          </button>
          <button
            type="button"
            className="button button--outline"
            onClick={() => sketchInputRef.current?.click()}
            disabled={sketchStatus?.busy}
            data-testid="button-sketch-file"
          >
            <FolderOpen size={17} /> {sketchStatus?.busy ? "กำลังประมวลผล…" : "เลือกภาพจากเครื่อง"}
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
                  <button type="button" className="studio-sketch-slot-remove" onClick={() => removeSketchFile(index)} aria-label={`ลบไฟล์ ${file.name}`} data-testid={`button-remove-studio-sketch-${index}`}><X size={14} /></button>
                </div>
              );
            }
            if (index === sketchFiles.length && sketchFiles.length < MAX_SKETCH_FILES) {
              return (
                <button key={index} type="button" className="studio-sketch-slot studio-sketch-slot--add" onClick={() => sketchInputRef.current?.click()} data-testid={`button-add-studio-sketch-${index}`}>
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
              phase: "queued" as const,
            };
            const isBusy = analysis.phase === "queued" || analysis.phase === "uploading" || analysis.phase === "analyzing";
            const confidence = analysis.confidence === null
              ? "ยังไม่ระบุ"
              : `${Math.round(analysis.confidence <= 1 ? analysis.confidence * 100 : analysis.confidence)}%`;
            return <article className="studio-sketch-analysis-card" key={`${file.name}-${file.lastModified}-${index}`} data-testid={`card-sketch-analysis-${index}`}>
              {sketchPreviewUrls[index] && <img className="studio-sketch-analysis-preview" src={sketchPreviewUrls[index]} alt={`ภาพที่วิเคราะห์: ${file.name}`} />}
              <div className="studio-sketch-analysis-copy">
                <strong className="studio-sketch-analysis-title">{file.name}</strong>
                <span className={`studio-sketch-shape studio-sketch-shape--${analysis.shape}`}>{sketchShapeLabel(analysis.shape)}</span>
                <span>ความมั่นใจ: {confidence}</span>
                <span>{analysis.runAMm !== null && analysis.depthMm !== null
                  ? `ขนาดที่อ่านได้: ${analysis.runAMm} × ${analysis.depthMm} มม.`
                  : "ยังไม่มีขนาดจาก AI — กรอกขนาดด้วยตนเองได้"}</span>
                <p>{analysis.notes || SKETCH_ANALYSIS_FALLBACK_MESSAGE}</p>
                {isBusy && <span className="studio-sketch-analysis-pending"><Loader2 className="studio-sketch-status-spinner" size={14} aria-hidden="true" /> กำลังวิเคราะห์ภาพนี้</span>}
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
                value={state.pieces?.[0]?.rectangles[0]?.widthMm ?? state.dimensions.runAMm}
                onChange={(e) => {
                  sketchDimensionEditVersionRef.current += 1;
                  const val = Math.max(1, Number(e.target.value) || 0);
                  setState((curr) => ({
                    ...curr,
                    dimensions: { ...curr.dimensions, runAMm: val },
                    pieces: curr.pieces ? curr.pieces.map((p, idx) => idx === 0 ? {
                      ...p,
                      rectangles: p.rectangles.map((r, rIdx) => rIdx === 0 ? { ...r, widthMm: val } : r)
                    } : p) : curr.pieces
                  }));
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
                value={state.pieces?.[0]?.rectangles[0]?.lengthMm ?? state.dimensions.depthMm}
                onChange={(e) => {
                  sketchDimensionEditVersionRef.current += 1;
                  const val = Math.max(1, Number(e.target.value) || 0);
                  setState((curr) => ({
                    ...curr,
                    dimensions: { ...curr.dimensions, depthMm: val },
                    pieces: curr.pieces ? curr.pieces.map((p, idx) => idx === 0 ? {
                      ...p,
                      rectangles: p.rectangles.map((r, rIdx) => rIdx === 0 ? { ...r, lengthMm: val } : r)
                    } : p) : curr.pieces
                  }));
                }}
                placeholder="เช่น 450"
                data-testid="input-sketch-depth"
              />
              <small>เช่น 450 มม. (0.45 เมตร)</small>
            </label>
          </div>
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
          <StudioCanvas state={state} setState={setState} pieceZoom={pieceZoom} setPieceZoom={setPieceZoom} selectedPlacementId={selectedPlacementId} setSelectedPlacementId={setSelectedPlacementId} selectedRectangleId={selectedRectangleId} setSelectedRectangleId={setSelectedRectangleId} basinProducts={basinProducts} stoneColors={stoneColors} simpleMode={isSimpleStudioMode} />
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
     {mode === "studio" && <div className="studio-draft-toolbar"><div><p className="eyebrow">DRAFT WORKSPACE</p><span className={`studio-draft-status ${isSavingDraft ? "is-saving" : ""}`} data-testid="status-studio-draft-autosave">{isSavingDraft ? "กำลังบันทึก…" : editingNamedDraftId ? `กำลังแก้ไขแบบร่างที่ตั้งชื่อไว้` : lastSavedAt ? `บันทึกอัตโนมัติล่าสุด ${formatDraftTimestamp(lastSavedAt)}` : "ยังไม่มีแบบร่างที่บันทึก"}</span></div><div className="studio-draft-toolbar-actions"><button type="button" className="icon-button" disabled={!studioHistory.canUndo} onClick={studioHistory.undo} title="ย้อนกลับ (Ctrl+Z)" aria-label="ย้อนกลับ" data-testid="button-studio-undo"><Undo2 size={15} /></button><button type="button" className="icon-button" disabled={!studioHistory.canRedo} onClick={studioHistory.redo} title="ทำซ้ำ (Ctrl+Y)" aria-label="ทำซ้ำ" data-testid="button-studio-redo"><Redo2 size={15} /></button><button type="button" className="button button--accent" onClick={openSaveDraftDialog} data-testid="button-save-named-studio-draft"><Save size={15} /> {editingNamedDraftId ? "อัปเดตแบบร่าง" : "บันทึกแบบร่าง"}</button><button type="button" className="button button--outline" onClick={() => setDraftDrawerOpen(true)} data-testid="button-open-studio-drafts"><FolderOpen size={15} /> แบบร่างของฉัน ({namedDrafts.length})</button><button type="button" className="button button--outline" onClick={() => void copyDraftLink()} data-testid="button-save-studio-draft-link"><Link2 size={15} /> คัดลอกลิงก์ปัจจุบัน</button></div></div>}
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
    {mode === "studio" && <StudioPrintLayout state={state} basinProducts={basinProducts} stoneColors={stoneColors} />}
      {mode === "studio" && <div className="studio-mobile-estimate-bar" data-testid="studio-mobile-estimate-bar"><div><span>ยอดประเมินรวม:</span><strong>{formatTHB(estimate.totalTHB)}</strong></div><div><button type="button" className="button button--outline" onClick={scrollToEstimate} data-testid="button-mobile-studio-details">ดูรายละเอียด</button><button type="button" className="button button--accent" disabled={submitting || linkedLeadUnavailable} onClick={() => void primarySubmit()} data-testid={isLeadLinkedMode ? "button-mobile-studio-save-lead" : "button-mobile-studio-submit"}>{submitting ? isLeadLinkedMode ? "กำลังบันทึก..." : "กำลังส่ง..." : isLeadLinkedMode ? "บันทึก Lead" : "ส่งขอราคา"}</button></div></div>}
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
  </div>;
}
