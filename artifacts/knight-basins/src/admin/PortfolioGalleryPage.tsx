import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clipboard, Images, MessageCircle, Search, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type PortfolioCategory = { slug: string; name: string; icon: string; count: number };
export type PortfolioItem = {
  id: string;
  category: string;
  categoryName: string;
  icon: string;
  url: string;
  width: number;
  height: number;
  title: string;
  /** @nullable absent on older cached responses -- treat as visible (true) */
  visible?: boolean;
};
export type PortfolioResponse = {
  updatedAt: string;
  total: number;
  categories: PortfolioCategory[];
  count: number;
  hasMore?: boolean;
  nextOffset?: number | null;
  items: PortfolioItem[];
};

type PortfolioDuplicateGroup = { reason: "md5" | "dimensions"; itemIds: string[] };
type PortfolioDuplicatesResponse = { groups: PortfolioDuplicateGroup[] };
type UploadDraft = {
  id: number;
  /** File sent to the API; replaced with the optimized file when preprocessing completes. */
  file: File;
  originalFile: File;
  title: string;
  previewUrl: string;
  compressionStatus: "processing" | "ready";
};
type UploadFailure = { id: number; message: string };
type UploadBatchResult = { uploadedIds: number[]; failures: UploadFailure[] };
type PortfolioBatchDeleteResult = { deletedIds: string[]; notFoundIds: string[]; filesRemovedCount: number };
type PortfolioApiError = Error & { status: number; apiMessage: string };

const DUPLICATES_QUERY_KEY = ["/api/admin/portfolio/duplicates"] as const;
const DELETE_CONFIRMATION_TEXT = "ลบรูปนี้ออกจากคลังผลงานถาวร? รูปจะหายจากหน้าเว็บและลบไฟล์ออกจากเซิร์ฟเวอร์";
const PORTFOLIO_BATCH_DELETE_LIMIT = 50;
const PORTFOLIO_IMAGE_MAX_DIMENSION = 1920;
const PORTFOLIO_IMAGE_WEBP_QUALITY = 0.82;
const PORTFOLIO_IMAGE_SMALL_FILE_THRESHOLD = 256 * 1024;
let nextUploadDraftId = 0;

type PortfolioImageDimensions = { width: number; height: number };

export function getPortfolioImageDimensions(width: number, height: number): PortfolioImageDimensions {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }

  const scale = Math.min(1, PORTFOLIO_IMAGE_MAX_DIMENSION / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function shouldCompressPortfolioImage(file: Pick<File, "name" | "size" | "type">): boolean {
  const isWebp = file.type.toLowerCase() === "image/webp" || file.name.toLowerCase().endsWith(".webp");
  return !isWebp && file.size > PORTFOLIO_IMAGE_SMALL_FILE_THRESHOLD;
}

async function optimizePortfolioImage(file: File): Promise<File> {
  if (!shouldCompressPortfolioImage(file) || typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
    return file;
  }

  let imageUrl: string | null = null;
  try {
    imageUrl = URL.createObjectURL(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not decode image"));
      element.src = imageUrl as string;
    });

    const dimensions = getPortfolioImageDimensions(image.naturalWidth || image.width, image.naturalHeight || image.height);
    if (dimensions.width === 0 || dimensions.height === 0) return file;

    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", PORTFOLIO_IMAGE_WEBP_QUALITY);
    });
    if (!blob || blob.type.toLowerCase() !== "image/webp" || blob.size === 0 || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^/.]+$/, "") || "portfolio-image";
    return new File([blob], `${baseName}.webp`, { type: "image/webp", lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }
}

function formatPortfolioFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function createPortfolioApiError(status: number, apiMessage: string): PortfolioApiError {
  const error = new Error(apiMessage || "Request failed") as PortfolioApiError;
  error.status = status;
  error.apiMessage = apiMessage;
  return error;
}

async function readPortfolioApiMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json() as { message?: unknown };
    if (typeof body.message === "string" && body.message.trim()) return body.message.trim();
  } catch {
    // Some proxy and auth errors return an empty or non-JSON response.
  }
  return fallback;
}

function portfolioUploadErrorMessage(status: number, message: string): string {
  if (status === 401 || status === 403 || /permission|unauthori[sz]ed|forbidden/i.test(message)) {
    return "บัญชีนี้ไม่มีสิทธิ์เพิ่มรูปในคลัง กรุณาติดต่อผู้ดูแลระบบ";
  }
  if (status === 413 || /10\s?mb|too large|oversiz|exceed/i.test(message)) {
    return "ไฟล์มีขนาดเกิน 10 MB กรุณาเลือกไฟล์ที่เล็กลง";
  }
  if (/category/i.test(message)) {
    return "กรุณาเลือกหมวดหมู่ของรูปภาพให้ถูกต้องแล้วลองอีกครั้ง";
  }
  if (/image|file|type|content|magic|unsupported|choose|required/i.test(message)) {
    return "ไฟล์นี้ไม่ใช่รูปภาพที่รองรับ กรุณาเลือกไฟล์ภาพแล้วลองอีกครั้ง";
  }
  return message
    ? `เพิ่มรูปไม่สำเร็จ: ${message} กรุณาลองอีกครั้ง`
    : "เพิ่มรูปไม่สำเร็จ กรุณาลองอีกครั้ง";
}

function portfolioDeleteErrorMessage(error: unknown): string {
  const apiError = error as Partial<PortfolioApiError> | null;
  if (apiError?.status === 401 || apiError?.status === 403) {
    return "บัญชีนี้ไม่มีสิทธิ์ลบรูปในคลัง กรุณาติดต่อผู้ดูแลระบบ";
  }
  if (apiError?.status === 404) return "ไม่พบรูปนี้ในคลังแล้ว กรุณารีเฟรชข้อมูล";
  return "ลบรูปไม่สำเร็จ กรุณาลองอีกครั้ง";
}

/**
 * Turns the API's relative photo path (e.g. "/api/uploads/portfolio/...")
 * into an absolute URL using the given origin (window.location.origin in
 * the real page), so a copied link/message works from any device the
 * salesperson pastes it into -- not just this admin session.
 */
export function toAbsolutePhotoUrl(relativeUrl: string, origin: string): string {
  if (/^https?:\/\//.test(relativeUrl)) return relativeUrl;
  const trimmedOrigin = origin.replace(/\/+$/, "");
  const path = relativeUrl.startsWith("/") ? relativeUrl : `/${relativeUrl}`;
  return `${trimmedOrigin}${path}`;
}

/** The exact message format the work order specifies, ready to paste to a customer. */
export function portfolioCustomerMessage(categoryName: string, absoluteUrl: string): string {
  return `ภาพตัวอย่างผลงาน${categoryName}จริงจากโรงงาน Knight Furnich ครับ\n${absoluteUrl}`;
}

/** Client-side quick search over whatever category/tab is currently loaded --
 * matches the category name, the item's own title, or the category slug, so
 * both a Thai keyword ("ไอส์แลนด์") and an English slug typed by habit both work. */
export function filterPortfolioItems(items: PortfolioItem[], query: string): PortfolioItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) =>
    item.categoryName.toLowerCase().includes(needle)
    || item.title.toLowerCase().includes(needle)
    || item.category.toLowerCase().includes(needle),
  );
}

export function isPortfolioItemVisible(item: PortfolioItem): boolean {
  return item.visible !== false;
}

export type PortfolioVisibilityFilter = "all" | "visible" | "hidden";

/** Powers the "ทั้งหมด / เผยแพร่แล้ว / ซ่อนอยู่" filter row. */
export function filterPortfolioItemsByVisibility(items: PortfolioItem[], filter: PortfolioVisibilityFilter): PortfolioItem[] {
  if (filter === "all") return items;
  return items.filter((item) => (filter === "visible" ? isPortfolioItemVisible(item) : !isPortfolioItemVisible(item)));
}

/** Plain toggle: what a photo's next visible value should be after one click. */
export function toggleVisibility(currentlyVisible: boolean): boolean {
  return !currentlyVisible;
}

async function fetchPortfolio(
  category: string,
  offset = 0,
  limit: number | "all" = category === "all" ? "all" : 200,
): Promise<PortfolioResponse> {
  const params = new URLSearchParams({ limit: String(limit), includeHidden: "true" });
  if (category !== "all") params.set("category", category);
  if (offset > 0) params.set("offset", String(offset));

  const response = await fetch(`/api/portfolio?${params.toString()}`);
  if (!response.ok) throw new Error("โหลดคลังภาพผลงานไม่สำเร็จ");
  return response.json() as Promise<PortfolioResponse>;
}

async function fetchPortfolioDuplicates(): Promise<PortfolioDuplicatesResponse> {
  const response = await fetch("/api/admin/portfolio/duplicates");
  if (!response.ok) throw new Error("โหลดข้อมูลรูปซ้ำไม่สำเร็จ");
  return response.json() as Promise<PortfolioDuplicatesResponse>;
}

async function uploadPortfolioItem(category: string, draft: UploadDraft): Promise<void> {
  const formData = new FormData();
  formData.append("file", draft.file);
  formData.append("category", category);
  if (draft.title.trim()) formData.append("title", draft.title.trim());

  const response = await fetch("/api/admin/portfolio/upload", { method: "POST", body: formData });
  if (!response.ok) {
    const apiMessage = await readPortfolioApiMessage(response, "อัปโหลดรูปไม่สำเร็จ");
    throw createPortfolioApiError(response.status, apiMessage);
  }
}

async function deletePortfolioItem(id: string): Promise<{ id: string; deleted: boolean; fileRemoved: boolean }> {
  const response = await fetch(`/api/admin/portfolio/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) {
    const apiMessage = await readPortfolioApiMessage(response, "ลบรูปไม่สำเร็จ");
    throw createPortfolioApiError(response.status, apiMessage);
  }
  return response.json() as Promise<{ id: string; deleted: boolean; fileRemoved: boolean }>;
}

async function batchDeletePortfolioItems(ids: string[]): Promise<PortfolioBatchDeleteResult> {
  if (ids.length === 0 || ids.length > PORTFOLIO_BATCH_DELETE_LIMIT) {
    throw new Error(`เลือกรูปได้ตั้งแต่ 1 ถึง ${PORTFOLIO_BATCH_DELETE_LIMIT} รูปต่อครั้ง`);
  }
  const response = await fetch("/api/admin/portfolio/batch-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!response.ok) {
    const apiMessage = await readPortfolioApiMessage(response, "ลบรูปไม่สำเร็จ");
    throw createPortfolioApiError(response.status, apiMessage);
  }

  const result = await response.json() as Partial<PortfolioBatchDeleteResult>;
  if (
    !Array.isArray(result.deletedIds)
    || !Array.isArray(result.notFoundIds)
    || typeof result.filesRemovedCount !== "number"
  ) {
    throw new Error("ผลตอบกลับจาก API ลบรูปเป็นชุดไม่ถูกต้อง");
  }
  return result as PortfolioBatchDeleteResult;
}

async function patchPortfolioVisibility(id: string, visible: boolean): Promise<{ id: string; visible: boolean }> {
  const response = await fetch(`/api/admin/portfolio/${encodeURIComponent(id)}/visibility`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visible }),
  });
  if (!response.ok) throw new Error("อัปเดตสถานะการเผยแพร่ไม่สำเร็จ");
  return response.json() as Promise<{ id: string; visible: boolean }>;
}

export type PortfolioFilenamePrivacyReport = {
  action: "inspect" | "anonymize";
  flaggedCount: number;
  flagged?: Array<{ id: string; category: string; filename: string }>;
  renamed?: string[];
  missing?: string[];
  totalItems?: number;
  note?: string;
};

/**
 * Legacy LINE-album imports left customer words in the photo file names, and a photo URL is public and permanent.
 * The API reports the rows and renames them with its own generator; this page only ever asks, shows the list, and
 * repeats back the count it was given, so nobody renames the catalogue from memory.
 */
async function requestPortfolioFilenamePrivacy(action: "inspect" | "anonymize", confirmCount?: number): Promise<PortfolioFilenamePrivacyReport> {
  const response = await fetch("/api/admin/portfolio/filename-privacy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(confirmCount === undefined ? { action } : { action, confirmCount }),
  });
  const report = await response.json().catch(() => null) as PortfolioFilenamePrivacyReport | { message?: string } | null;
  const failure = (report ?? {}) as { message?: string };
  if (!response.ok) throw new Error(failure.message ?? "ตรวจชื่อไฟล์ไม่สำเร็จ");
  return report as PortfolioFilenamePrivacyReport;
}

const VISIBILITY_FILTER_OPTIONS: ReadonlyArray<{ value: PortfolioVisibilityFilter; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "visible", label: "🟢 เผยแพร่แล้ว" },
  { value: "hidden", label: "⚪️ ซ่อนอยู่" },
];

function VisibilityToggleButton({ item, onToggle, size = "default", disabled = false }: { item: PortfolioItem; onToggle: (item: PortfolioItem) => void; size?: "default" | "sm"; disabled?: boolean }) {
  const visible = isPortfolioItemVisible(item);
  const padding = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(item);
      }}
      className={`rounded-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${padding} ${visible ? "bg-emerald-600 text-white" : "bg-gray-400 text-white"}`}
      data-testid={`button-toggle-visibility-${item.id}`}
    >
      {visible ? "🟢 เผยแพร่บนเว็บ" : "⚪️ ซ่อนเฉพาะภายใน"}
    </button>
  );
}

type CopiedFeedback = "link" | "message" | null;

function PortfolioLightbox({
  item,
  onClose,
  onToggleVisibility,
  onDelete,
  isDuplicate,
  actionsDisabled,
  isDeleting,
}: {
  item: PortfolioItem;
  onClose: () => void;
  onToggleVisibility: (item: PortfolioItem) => void;
  onDelete: (item: PortfolioItem) => void;
  isDuplicate: boolean;
  actionsDisabled: boolean;
  isDeleting: boolean;
}) {
  const [copied, setCopied] = useState<CopiedFeedback>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyLink = async () => {
    const absoluteUrl = toAbsolutePhotoUrl(item.url, window.location.origin);
    await navigator.clipboard.writeText(absoluteUrl);
    setCopied("link");
  };

  const copyMessage = async () => {
    const absoluteUrl = toAbsolutePhotoUrl(item.url, window.location.origin);
    await navigator.clipboard.writeText(portfolioCustomerMessage(item.categoryName, absoluteUrl));
    setCopied("message");
  };

  return (
    <div>
      <DialogTitle className="sr-only">{item.title}</DialogTitle>
      <img src={item.url} alt={item.title} className="max-h-[65vh] w-full bg-black object-contain" />
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--ink-soft)]">
          <span>{item.icon} {item.categoryName}</span>
          {isDuplicate && <span className="rounded-sm border border-amber-500/40 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">🔁 รูปซ้ำ</span>}
          <VisibilityToggleButton item={item} onToggle={onToggleVisibility} disabled={actionsDisabled} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-none border-red-700/30 text-red-800 hover:bg-red-50"
            onClick={() => onDelete(item)}
            disabled={actionsDisabled}
            data-testid={`button-delete-portfolio-item-lightbox-${item.id}`}
          >
            <Trash2 className="mr-2 h-4 w-4" /> {isDeleting ? "กำลังลบ…" : "ลบรูปนี้"}
          </Button>
          <Button type="button" variant="outline" className="rounded-none" onClick={() => void copyLink()} data-testid="button-portfolio-copy-link">
            <Clipboard className="mr-2 h-4 w-4" /> คัดลอกลิงก์รูป
          </Button>
          <Button type="button" variant="outline" className="rounded-none" onClick={() => void copyMessage()} data-testid="button-portfolio-copy-message">
            <MessageCircle className="mr-2 h-4 w-4" /> คัดลอกข้อความส่งลูกค้า
          </Button>
          <Button type="button" variant="outline" className="rounded-none" onClick={onClose} data-testid="button-portfolio-lightbox-close">
            ปิด
          </Button>
        </div>
        {copied && (
          <p className="text-sm text-[var(--success)]" role="status" data-testid="status-portfolio-copied">
            <Check className="mr-1 inline h-4 w-4" /> คัดลอกแล้ว ✓
          </p>
        )}
      </div>
    </div>
  );
}

export function PortfolioGalleryPage() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<PortfolioVisibilityFilter>("all");
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedBatchDeleteIds, setSelectedBatchDeleteIds] = useState<string[]>([]);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadDrafts, setUploadDrafts] = useState<UploadDraft[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [pageFeedback, setPageFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [filenamePrivacy, setFilenamePrivacy] = useState<PortfolioFilenamePrivacyReport | null>(null);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadObjectUrls = useRef(new Set<string>());

  const queryKey = ["/api/portfolio", selectedCategory];
  const portfolioQuery = useQuery({
    queryKey,
    queryFn: () => fetchPortfolio(selectedCategory),
  });
  const loadMoreMutation = useMutation({
    mutationFn: ({ category, offset }: { category: string; offset: number }) => fetchPortfolio(category, offset, 200),
    onSuccess: (page, { category }) => {
      queryClient.setQueryData<PortfolioResponse>(["/api/portfolio", category], (current) => {
        if (!current) return page;
        const existingIds = new Set(current.items.map((item) => item.id));
        return {
          ...page,
          items: [...current.items, ...page.items.filter((item) => !existingIds.has(item.id))],
        };
      });
    },
    onError: () => setPageFeedback({ type: "error", message: "โหลดรูปเพิ่มเติมไม่สำเร็จ กรุณาลองอีกครั้ง" }),
  });
  const duplicatesQuery = useQuery({
    queryKey: DUPLICATES_QUERY_KEY,
    queryFn: fetchPortfolioDuplicates,
  });

  const toggleMutation = useMutation({ mutationFn: (item: PortfolioItem) => patchPortfolioVisibility(item.id, toggleVisibility(isPortfolioItemVisible(item))) });
  const uploadMutation = useMutation({
    mutationFn: async ({ category, drafts }: { category: string; drafts: UploadDraft[] }): Promise<UploadBatchResult> => {
      const uploadedIds: number[] = [];
      const failures: UploadFailure[] = [];
      for (let index = 0; index < drafts.length; index += 1) {
        const draft = drafts[index];
        setUploadProgress(index + 1);
        try {
          await uploadPortfolioItem(category, draft);
          uploadedIds.push(draft.id);
        } catch (error) {
          const apiError = error as { status?: unknown; apiMessage?: unknown };
          const status = typeof apiError.status === "number" ? apiError.status : 0;
          const message = typeof apiError.apiMessage === "string"
            ? apiError.apiMessage
            : error instanceof Error ? error.message : "";
          failures.push({ id: draft.id, message: portfolioUploadErrorMessage(status, message) });
          if (status === 401 || status === 403 || status >= 500) break;
        }
      }
      return { uploadedIds, failures };
    },
    onSuccess: (result) => {
      if (result.uploadedIds.length > 0) {
        const uploadedIds = new Set(result.uploadedIds);
        uploadDrafts.filter((draft) => uploadedIds.has(draft.id)).forEach((draft) => {
          URL.revokeObjectURL(draft.previewUrl);
          uploadObjectUrls.current.delete(draft.previewUrl);
        });
        setUploadDrafts((current) => current.filter((draft) => !uploadedIds.has(draft.id)));
        void queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
        void queryClient.invalidateQueries({ queryKey: DUPLICATES_QUERY_KEY });
        setPageFeedback({
          type: "success",
          message: result.failures.length > 0 ? `เพิ่มรูปสำเร็จ ${result.uploadedIds.length} รูป` : "เพิ่มรูปสำเร็จ",
        });
      }
      if (result.failures.length > 0) {
        const firstFailure = result.failures[0].message;
        setUploadError(result.failures.length > 1 ? `${firstFailure} (อีก ${result.failures.length - 1} รูปไม่สำเร็จ)` : firstFailure);
        if (result.uploadedIds.length === 0) setPageFeedback(null);
        return;
      }
      setUploadError("");
      setUploadProgress(0);
      setUploadDialogOpen(false);
    },
    onError: (error) => setUploadError(portfolioUploadErrorMessage(0, error.message)),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePortfolioItem(id),
    onSuccess: (_result, id) => {
      setSelectedBatchDeleteIds((current) => current.filter((selectedId) => selectedId !== id));
      queryClient.setQueriesData<PortfolioResponse>({ queryKey: ["/api/portfolio"] }, (old) => {
        if (!old) return old;
        const itemWasLoaded = old.items.some((item) => item.id === id);
        return {
          ...old,
          items: old.items.filter((item) => item.id !== id),
          count: Math.max(0, old.count - Number(itemWasLoaded)),
          total: Math.max(0, old.total - 1),
        };
      });
      setSelectedItem((current) => current?.id === id ? null : current);
      void queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      void queryClient.invalidateQueries({ queryKey: DUPLICATES_QUERY_KEY });
      setPageFeedback({ type: "success", message: "ลบรูปเรียบร้อย" });
    },
    onError: (error) => setPageFeedback({ type: "error", message: portfolioDeleteErrorMessage(error) }),
  });
  const batchDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => batchDeletePortfolioItems(ids),
    onSuccess: async (result) => {
      setSelectedBatchDeleteIds([]);
      setMultiSelectMode(false);
      setBatchDeleteDialogOpen(false);
      setPageFeedback({
        type: "success",
        message: result.notFoundIds.length > 0
          ? `ลบรูปภาพเรียบร้อยแล้ว ${result.deletedIds.length} รายการ (ไม่พบ ${result.notFoundIds.length} รายการ)`
          : `ลบรูปภาพเรียบร้อยแล้ว ${result.deletedIds.length} รายการ`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] }),
        queryClient.invalidateQueries({ queryKey: DUPLICATES_QUERY_KEY }),
      ]);
    },
    onError: (error) => {
      setBatchDeleteDialogOpen(false);
      setPageFeedback({ type: "error", message: portfolioDeleteErrorMessage(error) });
    },
  });

  const categories = portfolioQuery.data?.categories ?? [];
  const allItems = portfolioQuery.data?.items ?? [];
  const searchedItems = useMemo(() => filterPortfolioItems(allItems, searchQuery), [allItems, searchQuery]);
  const visibleItems = useMemo(() => filterPortfolioItemsByVisibility(searchedItems, visibilityFilter), [searchedItems, visibilityFilter]);
  const duplicateIds = useMemo(
    () => new Set((duplicatesQuery.data?.groups ?? []).flatMap((group) => group.itemIds)),
    [duplicatesQuery.data],
  );
  const filteredItems = useMemo(
    () => onlyDuplicates ? visibleItems.filter((item) => duplicateIds.has(item.id)) : visibleItems,
    [duplicateIds, onlyDuplicates, visibleItems],
  );
  const writesPending = uploadMutation.isPending || deleteMutation.isPending;
  const actionsDisabled = writesPending || batchDeleteMutation.isPending || toggleMutation.isPending || loadMoreMutation.isPending;
  const uploadCompressionPending = uploadDrafts.some((draft) => draft.compressionStatus === "processing");
  const allVisibleItemsSelected = filteredItems.length > 0
    && filteredItems.every((item) => selectedBatchDeleteIds.includes(item.id));

  useEffect(() => () => {
    uploadObjectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    uploadObjectUrls.current.clear();
  }, []);

  useEffect(() => {
    if (uploadDialogOpen && !categories.some((category) => category.slug === uploadCategory)) {
      setUploadCategory(categories[0]?.slug ?? "");
    }
  }, [categories, uploadCategory, uploadDialogOpen]);

  const revokeDraftPreview = (draft: UploadDraft) => {
    URL.revokeObjectURL(draft.previewUrl);
    uploadObjectUrls.current.delete(draft.previewUrl);
  };

  const clearUploadDrafts = () => {
    uploadDrafts.forEach(revokeDraftPreview);
    setUploadDrafts([]);
  };

  const queueUploadFiles = (files: FileList | readonly File[]) => {
    const incoming = Array.from(files);
    const invalidFiles = incoming.filter((file) => file.type && !file.type.startsWith("image/"));
    const validFiles = incoming.filter((file) => !file.type || file.type.startsWith("image/"));
    if (invalidFiles.length > 0) {
      setUploadError("เลือกได้เฉพาะไฟล์รูปภาพ กรุณาตรวจสอบไฟล์ที่เลือก");
    } else if (validFiles.length > 0) {
      setUploadError("");
    }
    if (validFiles.length === 0) return;
    const drafts: UploadDraft[] = validFiles.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      uploadObjectUrls.current.add(previewUrl);
      return {
        id: ++nextUploadDraftId,
        file,
        originalFile: file,
        title: "",
        previewUrl,
        compressionStatus: "processing",
      };
    });
    setUploadDrafts((current) => [...current, ...drafts]);
    drafts.forEach((draft) => {
      void optimizePortfolioImage(draft.originalFile)
        .catch(() => draft.originalFile)
        .then((optimizedFile) => {
          setUploadDrafts((current) => current.map((item) => item.id === draft.id
            ? { ...item, file: optimizedFile, compressionStatus: "ready" }
            : item));
        });
    });
  };

  const removeUploadDraft = (id: number) => {
    const draft = uploadDrafts.find((item) => item.id === id);
    if (draft) revokeDraftPreview(draft);
    setUploadDrafts((current) => current.filter((item) => item.id !== id));
  };

  const handleUploadDialogChange = (open: boolean) => {
    if (writesPending) return;
    setUploadDialogOpen(open);
    if (!open) {
      clearUploadDrafts();
      setUploadError("");
      setUploadProgress(0);
    }
  };

  const openUploadDialog = () => {
    setPageFeedback(null);
    setUploadError("");
    setUploadCategory(categories[0]?.slug ?? "");
    setUploadDialogOpen(true);
  };

  const handleUploadSubmit = () => {
    if (writesPending || uploadCompressionPending || uploadDrafts.length === 0 || !uploadCategory) return;
    setUploadError("");
    setUploadProgress(0);
    uploadMutation.mutate({ category: uploadCategory, drafts: uploadDrafts });
  };

  const handleDeletePortfolioItem = (item: PortfolioItem) => {
    if (actionsDisabled) return;
    if (!window.confirm(DELETE_CONFIRMATION_TEXT)) return;
    setPageFeedback(null);
    deleteMutation.mutate(item.id);
  };

  const handleInspectFilenamePrivacy = useCallback(async () => {
    try {
      const report = await requestPortfolioFilenamePrivacy("inspect");
      setFilenamePrivacy(report);
      if (!report.flaggedCount) {
        setPageFeedback({ type: "success", message: "ไม่พบชื่อไฟล์ที่มีข้อมูลลูกค้าหลงเหลืออยู่ในคลังรูป" });
      }
    } catch (error) {
      setPageFeedback({ type: "error", message: error instanceof Error ? error.message : "ตรวจชื่อไฟล์ไม่สำเร็จ" });
    }
  }, []);

  const handleAnonymizeFilenames = useCallback(async () => {
    const count = filenamePrivacy?.flaggedCount ?? 0;
    if (!count) return;
    if (!window.confirm(`จะเปลี่ยนชื่อไฟล์ ${count} รูปที่ผูกกับชื่อลูกค้า/หน้างานเป็นชื่อสุ่ม ลิงก์เดิมจะใช้ไม่ได้และต้องรีเซ็ตหน้า Featured ตามนั้นด้วย ยืนยันหรือไม่`)) return;
    try {
      const report = await requestPortfolioFilenamePrivacy("anonymize", count);
      setFilenamePrivacy({ ...report, flagged: [], flaggedCount: 0 });
      setPageFeedback({ type: "success", message: `เปลี่ยนชื่อไฟล์เรียบร้อย ${report.renamed?.length ?? 0} รูป${report.missing?.length ? ` (${report.missing.length} รูปไม่พบไฟล์บนดิสก์)` : ""}` });
    } catch (error) {
      setPageFeedback({ type: "error", message: error instanceof Error ? error.message : "เปลี่ยนชื่อไฟล์ไม่สำเร็จ" });
    }
  }, [filenamePrivacy]);

  const handleToggleMultiSelectMode = () => {
    if (actionsDisabled) return;
    if (multiSelectMode) {
      setMultiSelectMode(false);
      setSelectedBatchDeleteIds([]);
      setBatchDeleteDialogOpen(false);
      return;
    }
    setMultiSelectMode(true);
  };

  const toggleBatchDeleteSelection = (id: string) => {
    if (actionsDisabled) return;
    setSelectedBatchDeleteIds((current) => {
      if (current.includes(id)) return current.filter((selectedId) => selectedId !== id);
      if (current.length >= PORTFOLIO_BATCH_DELETE_LIMIT) return current;
      return [...current, id];
    });
  };

  const selectAllVisibleBatchItems = () => {
    if (actionsDisabled) return;
    setSelectedBatchDeleteIds((current) => {
      const next = [...current];
      for (const item of filteredItems) {
        if (next.length >= PORTFOLIO_BATCH_DELETE_LIMIT) break;
        if (!next.includes(item.id)) next.push(item.id);
      }
      return next;
    });
  };

  const openBatchDeleteConfirmation = () => {
    if (actionsDisabled || selectedBatchDeleteIds.length === 0) return;
    setPageFeedback(null);
    setBatchDeleteDialogOpen(true);
  };

  const confirmBatchDelete = () => {
    if (
      actionsDisabled
      || selectedBatchDeleteIds.length === 0
      || selectedBatchDeleteIds.length > PORTFOLIO_BATCH_DELETE_LIMIT
    ) return;
    batchDeleteMutation.mutate([...selectedBatchDeleteIds]);
  };

  const handleLoadMorePortfolioItems = () => {
    const nextOffset = portfolioQuery.data?.nextOffset;
    if (actionsDisabled || typeof nextOffset !== "number") return;
    setPageFeedback(null);
    loadMoreMutation.mutate({ category: selectedCategory, offset: nextOffset });
  };

  const handleToggleVisibility = (item: PortfolioItem) => {
    const nextVisible = toggleVisibility(isPortfolioItemVisible(item));
    queryClient.setQueryData<PortfolioResponse>(queryKey, (old) =>
      old
        ? { ...old, items: old.items.map((candidate) => (candidate.id === item.id ? { ...candidate, visible: nextVisible } : candidate)) }
        : old,
    );
    setSelectedItem((current) => (current && current.id === item.id ? { ...current, visible: nextVisible } : current));
    toggleMutation.mutate(item);
  };

  return (
    <div className="space-y-8" data-testid="admin-portfolio-gallery">
      <header className="border-b border-[var(--line)] pb-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow accent">SALES PORTFOLIO</p>
            <h1 className="font-display tracking-tight">คลังภาพผลงานขาย</h1>
            <p className="mt-3 max-w-2xl text-[var(--ink-soft)]">
              ค้นหาและคัดลอกภาพผลงานจริงจากโรงงาน ส่งให้ลูกค้าได้ทันทีโดยไม่ต้องดาวน์โหลด
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant={multiSelectMode ? "default" : "outline"}
              className="w-full rounded-none sm:w-auto"
              onClick={handleToggleMultiSelectMode}
              disabled={actionsDisabled}
              aria-pressed={multiSelectMode}
              data-testid="button-portfolio-toggle-multiselect"
            >
              ☑️ {multiSelectMode ? "เสร็จสิ้นการเลือก" : "เลือกหลายรูป"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-none sm:w-auto"
              onClick={() => void handleInspectFilenamePrivacy()}
              disabled={actionsDisabled}
              data-testid="button-portfolio-check-filename-privacy"
            >
              🔒 ตรวจชื่อไฟล์ที่มีชื่อลูกค้า{filenamePrivacy?.flaggedCount ? ` (${filenamePrivacy.flaggedCount})` : ""}
            </Button>
            {filenamePrivacy?.flaggedCount ? (
              <span className="flex flex-col gap-2 text-xs text-red-800 sm:flex-row sm:items-center" role="status" data-testid="status-portfolio-filename-privacy">
                <span>
                  พบ {filenamePrivacy.flaggedCount} รูปที่ URL ยังอ้างถึงหน้างาน/ลูกค้า เช่น{" "}
                  {filenamePrivacy.flagged?.[0]?.filename ?? "-"}
                </span>
                <Button type="button" size="sm" onClick={() => void handleAnonymizeFilenames()} data-testid="button-portfolio-anonymize-filenames">
                  ตั้งชื่อใหม่ให้ไม่ระบุตัวตน
                </Button>
              </span>
            ) : null}
            <Button
              type="button"
              className="w-full rounded-none sm:w-auto"
              onClick={openUploadDialog}
              disabled={actionsDisabled}
              data-testid="button-open-portfolio-upload"
            >
              <Upload className="mr-2 h-4 w-4" /> ➕ เพิ่มรูปเข้าคลัง
            </Button>
          </div>
        </div>
      </header>

      {pageFeedback && (
        <p
          className={pageFeedback.type === "success" ? "border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" : "border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"}
          role={pageFeedback.type === "success" ? "status" : "alert"}
          data-testid={`status-portfolio-${pageFeedback.type}`}
        >
          {pageFeedback.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="กรองตามสถานะการเผยแพร่">
          {VISIBILITY_FILTER_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={visibilityFilter === option.value ? "default" : "outline"}
              className="rounded-none"
              onClick={() => setVisibilityFilter(option.value)}
              data-testid={`button-visibility-filter-${option.value}`}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          variant={onlyDuplicates ? "default" : "outline"}
          className="rounded-none"
          onClick={() => setOnlyDuplicates((current) => !current)}
          aria-pressed={onlyDuplicates}
          data-testid="button-portfolio-filter-duplicates"
        >
          🔁 ดูเฉพาะรูปซ้ำ
        </Button>
        {duplicatesQuery.isError && (
          <span className="text-sm text-red-800" role="alert" data-testid="status-portfolio-duplicates-error">
            โหลดข้อมูลรูปซ้ำไม่สำเร็จ
          </span>
        )}
      </div>

      {multiSelectMode && (
        <div
          className="flex flex-col gap-3 border border-[var(--line)] bg-[var(--card-paper)] p-3 sm:flex-row sm:items-center sm:justify-between"
          role="group"
          aria-label="เครื่องมือเลือกหลายรูป"
          data-testid="portfolio-multiselect-toolbar"
        >
          <p className="text-sm font-medium" role="status" data-testid="status-portfolio-selected-count">
            เลือกแล้ว {selectedBatchDeleteIds.length} รายการ (สูงสุด {PORTFOLIO_BATCH_DELETE_LIMIT})
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              onClick={selectAllVisibleBatchItems}
              disabled={actionsDisabled || allVisibleItemsSelected || selectedBatchDeleteIds.length >= PORTFOLIO_BATCH_DELETE_LIMIT}
              data-testid="button-portfolio-select-all-visible"
            >
              เลือกทั้งหมดในหน้านี้
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              onClick={() => setSelectedBatchDeleteIds([])}
              disabled={actionsDisabled || selectedBatchDeleteIds.length === 0}
              data-testid="button-portfolio-clear-selection"
            >
              ยกเลิกการเลือก
            </Button>
            <Button
              type="button"
              className="rounded-none bg-red-800 text-white hover:bg-red-900"
              onClick={openBatchDeleteConfirmation}
              disabled={actionsDisabled || selectedBatchDeleteIds.length === 0}
              data-testid="button-portfolio-batch-delete"
            >
              {batchDeleteMutation.isPending ? "กำลังลบ…" : `🗑️ ลบที่เลือก (${selectedBatchDeleteIds.length})`}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-soft)]" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="ค้นหา เช่น ครัว, ไอส์แลนด์, เคาน์เตอร์, บันได"
            className="rounded-none pl-8"
            data-testid="input-portfolio-search"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="กรองตามหมวดหมู่">
          <Button
            type="button"
            variant={selectedCategory === "all" ? "default" : "outline"}
            className="rounded-none"
            onClick={() => setSelectedCategory("all")}
            data-testid="button-portfolio-category-all"
          >
            ทั้งหมด
          </Button>
          {categories.map((category) => (
            <Button
              key={category.slug}
              type="button"
              variant={selectedCategory === category.slug ? "default" : "outline"}
              className="rounded-none"
              onClick={() => setSelectedCategory(category.slug)}
              data-testid={`button-portfolio-category-${category.slug}`}
            >
              {category.icon} {category.name} ({category.count})
            </Button>
          ))}
        </div>
      </div>

      {portfolioQuery.data && !portfolioQuery.isError && (
        <div className="flex flex-wrap items-center justify-between gap-3" data-testid="portfolio-results-summary">
          <p className="text-sm text-[var(--ink-soft)]" role="status" data-testid="status-portfolio-count">
            แสดง {filteredItems.length} จาก {portfolioQuery.data.count} รายการ
          </p>
          {portfolioQuery.data.hasMore === true && (
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              onClick={handleLoadMorePortfolioItems}
              disabled={actionsDisabled || typeof portfolioQuery.data.nextOffset !== "number"}
              data-testid="button-portfolio-load-more"
            >
              {loadMoreMutation.isPending ? "กำลังโหลด…" : "⬇️ โหลดเพิ่ม"}
            </Button>
          )}
        </div>
      )}
      {loadMoreMutation.isError && (
        <p className="text-sm text-red-800" role="alert" data-testid="status-portfolio-load-more-error">
          โหลดรูปเพิ่มเติมไม่สำเร็จ กรุณาลองอีกครั้ง
        </p>
      )}

      {portfolioQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="กำลังโหลดคลังภาพผลงาน" data-testid="status-portfolio-loading">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="aspect-square animate-pulse border border-[var(--line)] bg-[var(--card-paper)] rounded-none" />
          ))}
        </div>
      ) : portfolioQuery.isError ? (
        <div className="border border-[#a24439]/40 bg-[#a24439]/5 p-6 rounded-none" role="alert" data-testid="status-portfolio-load-error">
          <h3>โหลดคลังภาพผลงานไม่สำเร็จ</h3>
          <p className="mt-2 text-[#a24439]">ระบบไม่สามารถดึงข้อมูลคลังภาพผลงานได้ในขณะนี้</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border border-[var(--line)] bg-[var(--card-paper)] p-12 text-center text-[var(--ink-soft)] rounded-none" data-testid="status-portfolio-empty">
          <Images className="h-8 w-8" aria-hidden="true" />
          <p>{onlyDuplicates ? "ไม่พบภาพซ้ำตามตัวกรองที่เลือก" : "ไม่พบภาพผลงานตามคำค้นหรือหมวดหมู่ที่เลือก"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="grid-portfolio-items">
          {filteredItems.map((item) => (
            <div key={item.id} className="group relative aspect-square overflow-hidden border border-[var(--line)] bg-black/5" data-testid={`card-portfolio-item-${item.id}`}>
              {multiSelectMode && (
                <label
                  className="absolute left-2 top-2 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm bg-white/95 shadow-sm"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[#003366]"
                    checked={selectedBatchDeleteIds.includes(item.id)}
                    onChange={() => toggleBatchDeleteSelection(item.id)}
                    disabled={actionsDisabled || (!selectedBatchDeleteIds.includes(item.id) && selectedBatchDeleteIds.length >= PORTFOLIO_BATCH_DELETE_LIMIT)}
                    aria-label={`เลือก ${item.title}`}
                    data-testid={`checkbox-portfolio-item-${item.id}`}
                  />
                </label>
              )}
              <button
                type="button"
                onClick={() => setSelectedItem(item)}
                className="block h-full w-full"
                data-testid={`button-open-portfolio-item-${item.id}`}
              >
                <img
                  src={item.url}
                  alt={item.title}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                  loading="lazy"
                />
              </button>
              {duplicateIds.has(item.id) && (
                <span
                  className={`absolute left-2 ${multiSelectMode ? "top-12" : "top-2"} z-10 rounded-sm border border-amber-500/40 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 shadow-sm`}
                  data-testid={`badge-portfolio-duplicate-${item.id}`}
                >
                  🔁 รูปซ้ำ
                </span>
              )}
              <button
                type="button"
                className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-sm bg-white/95 text-red-800 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={(event) => {
                  event.stopPropagation();
                  handleDeletePortfolioItem(item);
                }}
                disabled={actionsDisabled}
                aria-label={`ลบรูป ${item.title}`}
                data-testid={`button-delete-portfolio-item-${item.id}`}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
              <div className="absolute bottom-1 right-1 z-10">
                <VisibilityToggleButton item={item} onToggle={handleToggleVisibility} size="sm" disabled={actionsDisabled} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={selectedItem !== null} onOpenChange={(open) => { if (!open) setSelectedItem(null); }}>
        <DialogContent className="max-w-3xl gap-0 rounded-none p-0" data-testid="dialog-portfolio-lightbox">
          {selectedItem && (
            <PortfolioLightbox
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
              onToggleVisibility={handleToggleVisibility}
              onDelete={handleDeletePortfolioItem}
              isDuplicate={duplicateIds.has(selectedItem.id)}
              actionsDisabled={actionsDisabled}
              isDeleting={deleteMutation.isPending && deleteMutation.variables === selectedItem.id}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={batchDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!batchDeleteMutation.isPending) setBatchDeleteDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-lg rounded-none" data-testid="dialog-portfolio-batch-delete">
          <DialogTitle>ยืนยันการลบรูปภาพเป็นชุด</DialogTitle>
          <DialogDescription data-testid="description-portfolio-batch-delete-confirmation">
            คุณต้องการลบรูปภาพที่เลือกจำนวน {selectedBatchDeleteIds.length} รูปอย่างถาวรใช่หรือไม่? รูปภาพและไฟล์จริงบนเซิร์ฟเวอร์จะถูกลบทันที
          </DialogDescription>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              onClick={() => setBatchDeleteDialogOpen(false)}
              disabled={batchDeleteMutation.isPending}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              className="rounded-none bg-red-800 text-white hover:bg-red-900"
              onClick={confirmBatchDelete}
              disabled={actionsDisabled || selectedBatchDeleteIds.length === 0}
              data-testid="button-confirm-batch-delete"
            >
              {batchDeleteMutation.isPending ? "กำลังลบ…" : `ยืนยันลบ ${selectedBatchDeleteIds.length} รูป`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadDialogOpen} onOpenChange={handleUploadDialogChange}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-none" data-testid="dialog-portfolio-upload">
          <div className="space-y-5">
            <div>
              <DialogTitle className="text-xl">เพิ่มรูปเข้าคลัง</DialogTitle>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">เลือกหมวดหมู่งาน แล้วเพิ่มภาพได้หลายไฟล์พร้อมตั้งชื่อแต่ละภาพ</p>
            </div>

            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                handleUploadSubmit();
              }}
            >
              <label className="block space-y-1.5 text-sm font-medium">
                <span>หมวดหมู่งาน</span>
                <select
                  className="w-full rounded-none border border-[var(--line)] bg-white px-3 py-2.5 text-sm"
                  value={uploadCategory}
                  onChange={(event) => setUploadCategory(event.target.value)}
                  disabled={actionsDisabled}
                  data-testid="select-portfolio-upload-category"
                >
                  <option value="">เลือกหมวดหมู่</option>
                  {categories.map((category) => (
                    <option key={category.slug} value={category.slug}>{category.icon} {category.name}</option>
                  ))}
                </select>
              </label>

              <div
                className={`rounded-none border-2 border-dashed p-6 text-center transition ${dragOver ? "border-[#003366] bg-[#003366]/5" : "border-[var(--line)] bg-[var(--card-paper)]"}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!writesPending) setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  if (!writesPending) queueUploadFiles(event.dataTransfer.files);
                }}
                aria-label="พื้นที่ลากไฟล์ภาพมาวาง"
                data-testid="portfolio-upload-dropzone"
              >
                <input
                  ref={fileInputRef}
                  id="portfolio-upload-files"
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={actionsDisabled}
                  onChange={(event) => {
                    if (event.currentTarget.files) queueUploadFiles(event.currentTarget.files);
                    event.currentTarget.value = "";
                  }}
                  data-testid="input-portfolio-upload-files"
                />
                <label htmlFor="portfolio-upload-files" className="flex cursor-pointer flex-col items-center gap-2">
                  <Upload className="h-7 w-7 text-[#003366]" aria-hidden="true" />
                  <span className="font-semibold">คลิกเพื่อเลือกภาพ หรือลากไฟล์มาวางที่นี่</span>
                  <span className="text-xs text-[var(--ink-soft)]">เลือกได้หลายไฟล์ · รองรับไฟล์ภาพขนาดไม่เกิน 10 MB ต่อไฟล์</span>
                </label>
              </div>

              {uploadDrafts.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="list-portfolio-upload-files">
                  {uploadDrafts.map((draft) => (
                    <div key={draft.id} className="flex gap-3 border border-[var(--line)] bg-white p-3">
                      <img src={draft.previewUrl} alt={`ตัวอย่าง ${draft.originalFile.name}`} className="h-20 w-20 shrink-0 object-cover" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="truncate text-xs text-[var(--ink-soft)]" title={draft.originalFile.name}>{draft.originalFile.name}</p>
                        <p
                          className="text-xs text-[var(--ink-soft)]"
                          role="status"
                          data-testid={`status-portfolio-upload-compression-${draft.id}`}
                        >
                          {draft.compressionStatus === "processing"
                            ? "กำลังเตรียมรูปก่อนอัปโหลด…"
                            : `${formatPortfolioFileSize(draft.originalFile.size)} → ${formatPortfolioFileSize(draft.file.size)}${draft.file.size < draft.originalFile.size
                              ? ` (ลดลง ${Math.round(((draft.originalFile.size - draft.file.size) / draft.originalFile.size) * 100)}%)`
                              : " (ใช้ไฟล์ต้นฉบับ)"}`}
                        </p>
                        <label className="block text-xs font-medium">
                          <span className="sr-only">ชื่อเรื่องของ {draft.originalFile.name} (ไม่บังคับ)</span>
                          <Input
                            value={draft.title}
                            onChange={(event) => setUploadDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, title: event.target.value } : item))}
                            placeholder="ชื่อเรื่อง (ไม่บังคับ)"
                            disabled={actionsDisabled}
                            className="h-9 rounded-none text-sm"
                            data-testid={`input-portfolio-upload-title-${draft.id}`}
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-[var(--ink-soft)] hover:bg-red-50 hover:text-red-800 disabled:opacity-50"
                        onClick={() => removeUploadDraft(draft.id)}
                        disabled={actionsDisabled}
                        aria-label={`ลบไฟล์ ${draft.originalFile.name} ออกจากรายการ`}
                        data-testid={`button-remove-portfolio-upload-file-${draft.id}`}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {uploadError && <p className="text-sm text-red-800" role="alert" data-testid="status-portfolio-upload-error">{uploadError}</p>}
              {uploadMutation.isPending && (
                <p className="text-sm font-medium text-[#003366]" role="status" data-testid="status-portfolio-upload-progress">
                  กำลังอัปโหลด… ({uploadProgress}/{uploadMutation.variables?.drafts.length ?? uploadDrafts.length})
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--line)] pt-4">
                <Button type="button" variant="outline" className="rounded-none" onClick={() => handleUploadDialogChange(false)} disabled={writesPending}>
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  className="rounded-none"
                  disabled={writesPending || uploadCompressionPending || uploadDrafts.length === 0 || !uploadCategory}
                  data-testid="button-submit-portfolio-upload"
                >
                  {uploadMutation.isPending
                    ? "กำลังอัปโหลด…"
                    : uploadCompressionPending
                      ? "กำลังบีบอัด…"
                      : `อัปโหลด${uploadDrafts.length > 0 ? ` (${uploadDrafts.length})` : ""}`}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PortfolioGalleryPage;
