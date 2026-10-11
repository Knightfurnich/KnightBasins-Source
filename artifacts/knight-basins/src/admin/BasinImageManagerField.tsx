import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, ImagePlus, Loader2, Star, X } from "lucide-react";
import { uploadImageFile } from "./imageUploadClient";
import {
  isBelowStandard,
  loadImageSize,
  pendingImageSummary,
  probeStandardHdImage,
  sizeWarningText,
  standardHdImageUrl,
  type ImageSize,
} from "./uploadSafety";
import { nextQuoteImageUrl, nextTopViewImageUrl } from "./basinImageRoles";

type BasinImageManagerFieldProps = {
  images?: string[] | null;
  quoteImageUrl?: string | null;
  topViewImageUrl?: string | null;
  onImagesChange: (images: string[]) => void;
  onQuoteImageChange: (url: string | null) => void;
  onTopViewImageChange?: (url: string | null) => void;
  max?: number;
  /** job 443-B: the model these photos belong to — shown next to every pending image. */
  sku?: string | null;
};

export function BasinImageManagerField({
  images: imagesProp,
  quoteImageUrl,
  topViewImageUrl,
  onImagesChange,
  onQuoteImageChange,
  onTopViewImageChange,
  max = 5,
  sku,
}: BasinImageManagerFieldProps) {
  // A picked file is held here, previewed beside the SKU and only sent when the
  // editor confirms it (job 443-B) — the missing step behind the KF003 kitchen photo.
  const [pending, setPending] = useState<{ src: string; label: string; size: ImageSize | null; kind: "file" | "standard"; file?: File } | null>(null);
  const [standardHdState, setStandardHdState] = useState<"idle" | "checking" | "missing">("idle");
  const images = imagesProp ?? [];
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dropPending = (current?: typeof pending) => {
    if (current?.src.startsWith("blob:")) URL.revokeObjectURL(current.src);
  };

  useEffect(() => () => dropPending(pending), [pending]);

  const stageFile = async (file: File) => {
    setError(null);
    setStandardHdState("idle");
    const src = URL.createObjectURL(file);
    const size = await loadImageSize(src);
    setPending((previous) => {
      dropPending(previous ?? undefined);
      return { src, label: file.name, size, kind: "file", file };
    });
  };

  const useStandardHd = async () => {
    const url = standardHdImageUrl(sku);
    if (!url) {
      setError("ยังระบุ SKU ของรุ่นนี้ไม่ได้ จึงไม่สามารถเลือกภาพ HD มาตรฐานให้เองได้ (เราไม่ใส่ภาพของรุ่นอื่นแทน)");
      return;
    }
    setError(null);
    setStandardHdState("checking");
    const found = await probeStandardHdImage(url);
    if (!found) {
      setStandardHdState("missing");
      return;
    }
    const size = await loadImageSize(url);
    setStandardHdState("idle");
    setPending((previous) => {
      dropPending(previous ?? undefined);
      return { src: url, label: `ภาพ HD มาตรฐานของ ${String(sku).toUpperCase()}`, size, kind: "standard" };
    });
  };

  const commitPending = async () => {
    if (!pending) return;
    const chosen = pending;
    setPending(null);
    setStandardHdState("idle");
    if (chosen.kind === "standard") {
      if (!imagesRef.current.includes(chosen.src)) onImagesChange([...imagesRef.current, chosen.src]);
      return;
    }
    if (!chosen.file) return;
    setIsUploading(true);
    try {
      const uploadedUrl = await uploadImageFile(chosen.file);
      onImagesChange([...imagesRef.current, uploadedUrl]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "อัปโหลดรูปภาพไม่สำเร็จ");
    } finally {
      dropPending(chosen);
      setIsUploading(false);
    }
  };

  const cancelPending = () => {
    setPending((current) => {
      dropPending(current ?? undefined);
      return null;
    });
    setStandardHdState("idle");
  };

  const removeAt = (index: number) => {
    const removedUrl = images[index];
    const next = images.filter((_, i) => i !== index);
    onImagesChange(next);
    if (removedUrl && removedUrl === quoteImageUrl) onQuoteImageChange(null);
    if (removedUrl && removedUrl === topViewImageUrl) onTopViewImageChange?.(null);
  };

  const moveTo = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onImagesChange(next);
  };

  const setAsPrimary = (index: number) => {
    if (index === 0) return;
    const next = [...images];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    onImagesChange(next);
  };

  const toggleQuoteImage = (url: string) => {
    onQuoteImageChange(nextQuoteImageUrl(quoteImageUrl, images[0], url));
  };

  const toggleTopViewImage = (url: string) => {
    onTopViewImageChange?.(nextTopViewImageUrl(topViewImageUrl, url));
  };

  const canAddMore = images.length < max;

  // Active role images
  const primaryUrl = images[0] ?? null;
  const activeQuoteUrl = quoteImageUrl || primaryUrl;
  const activeTopViewUrl = topViewImageUrl || null;

  return (
    <div className="admin-upload-field space-y-4" data-testid="basin-image-manager">
      <div>
        <span className="text-xs uppercase tracking-wider text-[var(--ink-soft)] font-bold">การจัดการภาพสินค้า (3 บทบาทชัดเจน)</span>
        <p className="text-xs text-[var(--ink-soft)] mt-0.5">
          ระบบแยกหน้าที่ของภาพชัดเจน: ภาพแคตตาล็อกหน้าร้าน, ภาพที่จะพิมพ์ลงใบเสนอราคา, และภาพมุมบน (Top View) ใน 2D Studio
        </p>
      </div>

      {/* 3 Dedicated Role Slots */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg border border-[var(--line)] bg-[var(--card-paper)]">
        {/* Slot 1: Primary Catalog */}
        <div className="space-y-1.5 border border-amber-500/30 rounded-md p-2 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-current" /> 1. ภาพหลักแคตตาล็อก
            </span>
            <span className="text-[10px] text-[var(--ink-soft)]">หน้าแรก</span>
          </div>
          <div className="relative h-28 w-full overflow-hidden rounded border border-[var(--line)] bg-[var(--paper)]">
            {primaryUrl ? (
              <img src={primaryUrl} alt="ภาพหลักแคตตาล็อก" className="h-full w-full object-contain" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-[var(--ink-soft)]">ยังไม่มีภาพหลัก</div>
            )}
          </div>
          <p className="text-[10px] text-[var(--ink-soft)] leading-tight">
            ภาพแรกสุดที่ลูกค้าเห็นในรายการสินค้า (เลื่อนภาพอื่นมาอยู่ลำดับแรกเพื่อเปลี่ยน)
          </p>
        </div>

        {/* Slot 2: Quote Image */}
        <div className="space-y-1.5 border border-emerald-600/30 rounded-md p-2 bg-emerald-600/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> 2. ภาพใบเสนอราคา
            </span>
            <span className="text-[10px] text-[var(--ink-soft)]">ใบ A4/PDF</span>
          </div>
          <div className="relative h-28 w-full overflow-hidden rounded border border-[var(--line)] bg-[var(--paper)]">
            {activeQuoteUrl ? (
              <img src={activeQuoteUrl} alt="ภาพใบเสนอราคา" className="h-full w-full object-contain" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-[var(--ink-soft)]">ใช้ภาพหลักอัตโนมัติ</div>
            )}
          </div>
          <p className="text-[10px] text-[var(--ink-soft)] leading-tight">
            {quoteImageUrl ? "กำหนดภาพเฉพาะแล้ว" : "ค่าเริ่มต้น: ใช้ภาพหลักโดยอัตโนมัติ"}
          </p>
        </div>

        {/* Slot 3: Top View Image */}
        <div className="space-y-1.5 border border-blue-600/30 rounded-md p-2 bg-blue-600/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
              🔝 3. ภาพ Top View
            </span>
            <span className="text-[10px] text-[var(--ink-soft)]">2D Studio</span>
          </div>
          <div className="relative h-28 w-full overflow-hidden rounded border border-[var(--line)] bg-[var(--paper)]">
            {activeTopViewUrl ? (
              <img src={activeTopViewUrl} alt="ภาพ Top View" className="h-full w-full object-contain" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-[var(--ink-soft)]">ใช้ภาพสามมิติจำลอง</div>
            )}
          </div>
          <p className="text-[10px] text-[var(--ink-soft)] leading-tight">
            {topViewImageUrl ? "มีภาพมุมบนคมชัดแล้ว" : "ยังไม่ได้เลือก (จะใช้โมเดลวาดอัตโนมัติ)"}
          </p>
        </div>
      </div>

      {/* Gallery Tiles Section */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-[var(--ink)]">คลังภาพของสินค้ารุ่นนี้ (อัปโหลดได้สูงสุด {max} ภาพ)</span>
        <div className="admin-gallery-upload-grid flex flex-wrap gap-3">
          {images.map((url, index) => {
            const isPrimary = index === 0;
            const isQuoteImage = quoteImageUrl ? quoteImageUrl === url : isPrimary;
            const isTopViewImage = topViewImageUrl === url;
            return (
              <div
                key={`${url}-${index}`}
                className="admin-gallery-upload-tile flex w-40 shrink-0 flex-col overflow-hidden border border-[var(--line)] bg-[var(--paper)] rounded shadow-sm"
                data-testid={`basin-image-tile-${index}`}
              >
                <div className="relative h-28 w-full overflow-hidden bg-[rgba(0,0,0,0.04)]">
                  <img
                    src={url}
                    alt={`รูปสินค้า ${index + 1}`}
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    aria-label={`ลบภาพที่ ${index + 1}`}
                    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white hover:bg-red-600 transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {isPrimary && (
                    <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-amber-500 text-white" title="ภาพหลัก">
                      <Star className="h-3 w-3" fill="currentColor" />
                    </span>
                  )}
                  {isTopViewImage && (
                    <span className="absolute bottom-1 left-1 rounded-sm bg-blue-600 px-1 py-0.5 text-[10px] font-medium leading-none text-white" title="ภาพ Top View">
                      ✓ Top View
                    </span>
                  )}
                  <span className="absolute bottom-1 right-1 rounded-sm bg-black/65 px-1 py-0.5 text-[10px] font-medium leading-none text-white">
                    {isPrimary ? "ภาพหลัก" : `ภาพที่ ${index + 1}`}
                  </span>
                </div>

                {/* Controls Strip Below Image */}
                <div className="flex flex-col gap-1 border-t border-[var(--line)] p-1.5 bg-[var(--card-paper)]">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveTo(index, -1)}
                      disabled={index === 0}
                      aria-label="เลื่อนไปทางซ้าย"
                      title="เลื่อนภาพไปทางซ้าย"
                      className="grid h-6 w-6 shrink-0 place-items-center border border-[var(--line)] text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-30 rounded-sm"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                    {isPrimary ? (
                      <span className="flex-1 truncate text-center text-[10px] font-semibold text-amber-700 dark:text-amber-400">★ ภาพหลัก</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAsPrimary(index)}
                        className="flex-1 truncate rounded-sm border border-[var(--line)] px-1 py-1 text-[10px] leading-tight text-[var(--ink)] hover:border-amber-500 hover:text-amber-700 transition"
                        data-testid={`button-basin-image-primary-${index}`}
                      >
                        ตั้งเป็นภาพหลัก
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => moveTo(index, 1)}
                      disabled={index === images.length - 1}
                      aria-label="เลื่อนไปทางขวา"
                      title="เลื่อนภาพไปทางขวา"
                      className="grid h-6 w-6 shrink-0 place-items-center border border-[var(--line)] text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-30 rounded-sm"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Assign to Quote Button */}
                  <button
                    type="button"
                    onClick={() => toggleQuoteImage(url)}
                    className={`flex items-center justify-center gap-1 rounded-sm border px-1 py-1 text-[10px] leading-tight transition ${
                      isQuoteImage
                        ? "border-emerald-600 bg-emerald-600 text-white font-medium shadow-sm"
                        : "border-[var(--line)] text-[var(--ink-soft)] hover:border-emerald-600 hover:text-emerald-700"
                    }`}
                    data-testid={`button-basin-image-quote-${index}`}
                  >
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{isQuoteImage ? "✓ ภาพใบเสนอราคา" : "ตั้งเป็นภาพใบเสนอราคา"}</span>
                  </button>

                  {/* Assign to TopView Button */}
                  {onTopViewImageChange && (
                    <button
                      type="button"
                      onClick={() => toggleTopViewImage(url)}
                      className={`flex items-center justify-center gap-1 rounded-sm border px-1 py-1 text-[10px] leading-tight transition ${
                        isTopViewImage
                          ? "border-blue-600 bg-blue-600 text-white font-medium shadow-sm"
                          : "border-[var(--line)] text-[var(--ink-soft)] hover:border-blue-600 hover:text-blue-700"
                      }`}
                      data-testid={`button-basin-image-topview-${index}`}
                    >
                      <span className="truncate">{isTopViewImage ? "✓ ภาพ Top View" : "ตั้งเป็น Top View"}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {canAddMore && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              className="admin-gallery-upload-add flex h-[10.5rem] w-40 shrink-0 flex-col items-center justify-center gap-1.5 border border-dashed border-[var(--line)] bg-[rgba(255,255,255,0.72)] dark:bg-[rgba(255,255,255,0.03)] text-[var(--ink-soft)] hover:border-[var(--brand-blue)] hover:text-[var(--ink)] transition rounded"
            >
              {isUploading ? <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-blue)]" /> : <ImagePlus className="h-6 w-6" />}
              <span className="text-[11px] font-medium">{isUploading ? "กำลังอัปโหลด..." : "+ เพิ่มภาพใหม่"}</span>
            </button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        data-testid="input-basin-image-file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void stageFile(file);
          event.target.value = "";
        }}
      />

      {pending && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="ยืนยันภาพก่อนบันทึก"
          className="admin-basin-image-confirm flex flex-wrap items-center gap-3 rounded-md border border-[var(--brand-blue)] bg-[var(--card-paper)] p-3"
          data-testid="dialog-confirm-basin-image"
        >
          <img
            src={pending.src}
            alt={`${sku || "รุ่นนี้"} ภาพกำลังจะบันทึก`}
            className="h-20 w-28 shrink-0 rounded border border-[var(--line)] bg-[var(--paper)] object-contain"
            data-testid="img-basin-pending-thumbnail"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold" data-testid="text-basin-pending-summary">
              {pendingImageSummary({ sku, label: pending.label, size: pending.size })}
            </p>
            {isBelowStandard(pending.size) || !pending.size ? (
              <p className="mt-1 text-[11px] leading-snug text-[#a24439]" data-testid="text-basin-image-size-warning">
                {sizeWarningText(pending.size)}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-[var(--ink-soft)]">ขนาดภาพผ่านเกณฑ์ขั้นต่ำ {`600`} px ขึ้นไป</p>
            )}
            <p className="mt-1 text-[11px] leading-snug text-[var(--ink-soft)]">
              ตรวจให้ตรงกับรหัส <strong className="font-mono">{sku || "—"}</strong> ก่อนบันทึก — ระบบยังไม่เขียนทับจนกว่าคุณจะกดยืนยัน
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void commitPending()}
              disabled={isUploading}
              className="rounded-sm border border-[var(--brand-blue)] bg-[var(--brand-blue)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              data-testid="button-confirm-basin-image"
            >
              {isUploading ? "กำลังอัปโหลด..." : "ยืนยันบันทึกภาพนี้"}
            </button>
            <button
              type="button"
              onClick={cancelPending}
              className="rounded-sm border border-[var(--line)] px-3 py-2 text-xs hover:bg-[var(--paper)]"
              data-testid="button-cancel-basin-image"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void useStandardHd()}
          disabled={standardHdState === "checking"}
          className="admin-basin-standard-hd inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-[var(--line)] px-3 py-2 text-xs font-semibold hover:border-[var(--brand-blue)] disabled:opacity-60"
          data-testid="button-basin-standard-hd"
        >
          {standardHdState === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
          ใช้ภาพ HD มาตรฐานของรุ่นนี้{sku ? ` (${String(sku).toUpperCase()})` : ""}
        </button>
        {standardHdState === "missing" && (
          <p className="text-[11px] text-[var(--ink-soft)]" data-testid="text-basin-standard-hd-missing">
            ไม่พบภาพ HD มาตรฐานของรุ่นนี้ ({`/kb/images/basin-hd/${String(sku ?? "").toUpperCase()}.jpg`}) — ดาวน์โหลดไฟล์มาอัปโหลดเองได้
          </p>
        )}
      </div>
      {error && <p className="text-xs text-[#a24439]">{error}</p>}
    </div>
  );
}
