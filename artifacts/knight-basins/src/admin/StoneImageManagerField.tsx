import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, ImagePlus, Loader2, Star, X } from "lucide-react";
import { uploadImageFile } from "./imageUploadClient";
// The full-slab photo, like Top View on basins, has no implicit fallback: no
// image is the "full slab" unless one is explicitly pinned, so it is the same
// plain toggle.
import { nextQuoteImageUrl, nextTopViewImageUrl as nextSlabImageUrl } from "./basinImageRoles";

type StoneImageManagerFieldProps = {
  images?: string[] | null;
  quoteImageUrl?: string | null;
  slabImageUrl?: string | null;
  onImagesChange: (images: string[]) => void;
  onQuoteImageChange: (url: string | null) => void;
  onSlabImageChange: (url: string | null) => void;
  max?: number;
};

export function StoneImageManagerField({
  images: imagesProp,
  quoteImageUrl,
  slabImageUrl,
  onImagesChange,
  onQuoteImageChange,
  onSlabImageChange,
  // One storefront image plus the four gallery slots the API accepts.
  max = 5,
}: StoneImageManagerFieldProps) {
  const images = imagesProp ?? [];
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setIsUploading(true);
    try {
      const uploadedUrl = await uploadImageFile(file);
      onImagesChange([...imagesRef.current, uploadedUrl]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "อัปโหลดรูปภาพไม่สำเร็จ");
    } finally {
      setIsUploading(false);
    }
  };

  const removeAt = (index: number) => {
    const removedUrl = images[index];
    const next = images.filter((_, i) => i !== index);
    onImagesChange(next);
    if (removedUrl && removedUrl === quoteImageUrl) onQuoteImageChange(null);
    if (removedUrl && removedUrl === slabImageUrl) onSlabImageChange(null);
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

  const toggleSlabImage = (url: string) => {
    onSlabImageChange(nextSlabImageUrl(slabImageUrl, url));
  };

  const canAddMore = images.length < max;

  // Active role images
  const primaryUrl = images[0] ?? null;
  const activeQuoteUrl = quoteImageUrl || primaryUrl;
  const activeSlabUrl = slabImageUrl || null;

  return (
    <div className="admin-upload-field space-y-4" data-testid="stone-image-manager">
      <div>
        <span className="text-xs uppercase tracking-wider text-[var(--ink-soft)] font-bold">การจัดการภาพสินค้า (3 บทบาทชัดเจน)</span>
        <p className="text-xs text-[var(--ink-soft)] mt-0.5">
          ระบบแยกหน้าที่ของภาพชัดเจน: ภาพแสดงหน้าร้าน (/stone), ภาพที่จะพิมพ์ลงใบเสนอราคา, และภาพแสดงเต็มแผ่น (Full Slab) สำหรับดูลายหิน
        </p>
      </div>

      {/* 3 Dedicated Role Slots */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg border border-[var(--line)] bg-[var(--card-paper)]">
        {/* Slot 1: Storefront image */}
        <div className="space-y-1.5 border border-amber-500/30 rounded-md p-2 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-current" /> 1. ภาพแสดงหน้าร้าน (/stone)
            </span>
            <span className="text-[10px] text-[var(--ink-soft)]">หน้าร้าน</span>
          </div>
          <div className="relative h-28 w-full overflow-hidden rounded border border-[var(--line)] bg-[var(--paper)]">
            {primaryUrl ? (
              <img src={primaryUrl} alt="ภาพแสดงหน้าร้าน" className="h-full w-full object-contain" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-[var(--ink-soft)]">ยังไม่มีภาพหลัก</div>
            )}
          </div>
          <p className="text-[10px] text-[var(--ink-soft)] leading-tight">
            ภาพแรกสุดที่ลูกค้าเห็นในหน้า /stone และใน 2D Studio (เลื่อนภาพอื่นมาอยู่ลำดับแรกเพื่อเปลี่ยน)
          </p>
        </div>

        {/* Slot 2: Quote image */}
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

        {/* Slot 3: Full slab image */}
        <div className="space-y-1.5 border border-blue-600/30 rounded-md p-2 bg-blue-600/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
              🔲 3. ภาพแสดงเต็มแผ่น (Full Slab)
            </span>
            <span className="text-[10px] text-[var(--ink-soft)]">ดูลายเต็มแผ่น</span>
          </div>
          <div className="relative h-28 w-full overflow-hidden rounded border border-[var(--line)] bg-[var(--paper)]">
            {activeSlabUrl ? (
              <img src={activeSlabUrl} alt="ภาพแสดงเต็มแผ่น" className="h-full w-full object-contain" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-[var(--ink-soft)]">ยังไม่ได้เลือกภาพเต็มแผ่น</div>
            )}
          </div>
          <p className="text-[10px] text-[var(--ink-soft)] leading-tight">
            ภาพถ่ายลายหินเต็มแผ่นใหญ่ สำหรับประกอบการตัดสินใจและดูลายก่อนตัดชิ้นงาน
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
            const isSlabImage = slabImageUrl === url;
            return (
              <div
                key={`${url}-${index}`}
                className="admin-gallery-upload-tile flex w-40 shrink-0 flex-col overflow-hidden border border-[var(--line)] bg-[var(--paper)] rounded shadow-sm"
                data-testid={`stone-image-tile-${index}`}
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
                  {isSlabImage && (
                    <span className="absolute bottom-1 left-1 rounded-sm bg-blue-600 px-1 py-0.5 text-[10px] font-medium leading-none text-white" title="ภาพแสดงเต็มแผ่น">
                      ✓ เต็มแผ่น
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
                        data-testid={`button-stone-image-primary-${index}`}
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
                    data-testid={`button-stone-image-quote-${index}`}
                  >
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{isQuoteImage ? "✓ ภาพใบเสนอราคา" : "ตั้งเป็นภาพใบเสนอราคา"}</span>
                  </button>

                  {/* Assign to Full Slab Button */}
                  <button
                    type="button"
                    onClick={() => toggleSlabImage(url)}
                    className={`flex items-center justify-center gap-1 rounded-sm border px-1 py-1 text-[10px] leading-tight transition ${
                      isSlabImage
                        ? "border-blue-600 bg-blue-600 text-white font-medium shadow-sm"
                        : "border-[var(--line)] text-[var(--ink-soft)] hover:border-blue-600 hover:text-blue-700"
                    }`}
                    data-testid={`button-stone-image-full-slab-${index}`}
                  >
                    <span className="truncate">{isSlabImage ? "✓ ตั้งเป็นภาพเต็มแผ่น" : "ตั้งเป็นภาพเต็มแผ่น"}</span>
                  </button>
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
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />
      {error && <p className="text-xs text-[#a24439]">{error}</p>}
    </div>
  );
}
