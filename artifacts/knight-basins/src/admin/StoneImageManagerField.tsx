import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, ImagePlus, Loader2, Star, X } from "lucide-react";
import { uploadImageFile } from "./imageUploadClient";

type StoneImageManagerFieldProps = {
  images?: string[] | null;
  quoteImageUrl?: string | null;
  slabImageUrl?: string | null;
  onImagesChange: (images: string[]) => void;
  onQuoteImageChange: (url: string | null) => void;
  onSlabImageChange: (url: string | null) => void;
  max?: number;
};

type ImageRolePreviewProps = {
  label: string;
  description: string;
  imageUrl?: string | null;
  fallbackLabel: string;
  borderClassName: string;
  accentClassName: string;
  testId: string;
};

function ImageRolePreview({
  label,
  description,
  imageUrl,
  fallbackLabel,
  borderClassName,
  accentClassName,
  testId,
}: ImageRolePreviewProps) {
  return (
    <section
      aria-label={label}
      data-testid={testId}
      className={`min-w-0 overflow-hidden border-2 bg-[var(--card-paper)] ${borderClassName}`}
    >
      <div className="flex min-h-12 items-center gap-2 border-b border-[var(--line)] px-3 py-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${accentClassName}`} aria-hidden="true" />
        <h3 className="text-xs font-semibold leading-snug text-[var(--ink)]">{label}</h3>
      </div>
      <div className="flex h-32 items-center justify-center bg-[var(--paper)]">
        {imageUrl ? (
          <img src={imageUrl} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 px-3 text-center text-xs text-[var(--ink-soft)]">
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
            <span>{fallbackLabel}</span>
          </div>
        )}
      </div>
      <p className="min-h-14 px-3 py-2 text-xs leading-relaxed text-[var(--ink-soft)]">{description}</p>
    </section>
  );
}

export function StoneImageManagerField({
  images: imagesProp,
  quoteImageUrl,
  slabImageUrl,
  onImagesChange,
  onQuoteImageChange,
  onSlabImageChange,
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
  const primaryImageUrl = images[0];
  const effectiveQuoteImageUrl = quoteImageUrl ?? primaryImageUrl;

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
    onImagesChange(images.filter((_, imageIndex) => imageIndex !== index));
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
    onQuoteImageChange(effectiveQuoteImageUrl === url ? null : url);
  };

  const toggleSlabImage = (url: string) => {
    onSlabImageChange(slabImageUrl === url ? null : url);
  };

  const canAddMore = images.length < max;

  return (
    <div className="admin-upload-field space-y-3">
      <span className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">รูปภาพหิน</span>
      <p className="text-xs leading-relaxed text-[var(--ink-soft)]">
        ภาพแรกคือภาพหลักที่แสดงหน้าร้าน ใช้แถบ Gallery เพื่อจัดลำดับ เลือกภาพใบเสนอราคา และกำหนดภาพเต็มแผ่น
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ImageRolePreview
          label="1. ภาพแสดงหน้าร้าน (/stone)"
          description="ภาพหลักที่ลูกค้าเห็นบนหน้าร้านและใน Studio"
          imageUrl={primaryImageUrl}
          fallbackLabel="ยังไม่มีภาพหลัก"
          borderClassName="border-amber-500"
          accentClassName="bg-amber-500"
          testId="stone-image-role-storefront"
        />
        <ImageRolePreview
          label="2. ภาพใบเสนอราคา"
          description="ภาพที่จะพิมพ์ลงใบเสนอราคา หรือใช้ภาพหลักอัตโนมัติ"
          imageUrl={effectiveQuoteImageUrl}
          fallbackLabel="เลือกภาพจาก Gallery ด้านล่าง"
          borderClassName="border-emerald-600"
          accentClassName="bg-emerald-600"
          testId="stone-image-role-quote"
        />
        <ImageRolePreview
          label="3. ภาพแสดงเต็มแผ่น (Full Slab)"
          description="ภาพถ่ายลายหินเต็มแผ่นใหญ่ สำหรับประกอบการตัดสินใจและดูลายก่อนตัดชิ้นงาน"
          imageUrl={slabImageUrl}
          fallbackLabel="ยังไม่ได้กำหนดภาพเต็มแผ่น"
          borderClassName="border-blue-600"
          accentClassName="bg-blue-600"
          testId="stone-image-role-full-slab"
        />
      </div>

      <div className="space-y-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-soft)]">แถบ Gallery</h3>
          <p className="text-xs text-[var(--ink-soft)]">เลื่อนดูภาพ ตั้งภาพหลัก สลับบทบาทภาพ หรือลบภาพที่ไม่ต้องการ</p>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {images.map((url, index) => {
            const isPrimary = index === 0;
            const isQuoteImage = effectiveQuoteImageUrl === url;
            const isSlabImage = slabImageUrl === url;

            return (
              <div
                key={`${url}-${index}`}
                className="admin-gallery-upload-tile relative h-28 w-36 shrink-0 overflow-hidden border border-[var(--line)] bg-[var(--paper)]"
              >
                <img src={url} alt={`รูปหิน ${index + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  aria-label={`ลบภาพที่ ${index + 1}`}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                {isPrimary && (
                  <span
                    className="absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-amber-500 text-white"
                    title="ภาพหลัก"
                  >
                    <Star className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
                  </span>
                )}
                {isSlabImage && (
                  <span className="absolute left-1 top-8 rounded-sm bg-blue-600 px-1 py-0.5 text-[11px] font-medium text-white">
                    ภาพเต็มแผ่น
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-black/60 p-1">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => moveTo(index, -1)}
                      disabled={index === 0}
                      aria-label="เลื่อนไปทางซ้าย"
                      className="text-white disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {!isPrimary ? (
                      <button
                        type="button"
                        onClick={() => setAsPrimary(index)}
                        className="text-xs text-white underline decoration-dotted"
                        data-testid={`button-stone-image-primary-${index}`}
                      >
                        ตั้งเป็นภาพหลัก
                      </button>
                    ) : (
                      <span className="text-xs text-white">ภาพหลัก</span>
                    )}
                    <button
                      type="button"
                      onClick={() => moveTo(index, 1)}
                      disabled={index === images.length - 1}
                      aria-label="เลื่อนไปทางขวา"
                      className="text-white disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleQuoteImage(url)}
                    aria-pressed={isQuoteImage}
                    className={`flex items-center justify-center gap-1 rounded-sm px-1 py-0.5 text-xs ${
                      isQuoteImage ? "bg-emerald-600 text-white" : "text-white/80 hover:text-white"
                    }`}
                    data-testid={`button-stone-image-quote-${index}`}
                  >
                    <FileText className="h-3 w-3" aria-hidden="true" />
                    {isQuoteImage ? "ใช้ภาพนี้ในใบเสนอราคา" : "เลือกเป็นภาพใบเสนอราคา"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSlabImage(url)}
                    aria-pressed={isSlabImage}
                    className={`rounded-sm px-1 py-0.5 text-xs ${
                      isSlabImage ? "bg-blue-600 text-white" : "text-white/80 hover:text-white"
                    }`}
                    data-testid={`button-stone-image-full-slab-${index}`}
                  >
                    {isSlabImage ? "✓ ตั้งเป็นภาพเต็มแผ่น" : "ตั้งเป็นภาพเต็มแผ่น"}
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
              className="admin-gallery-upload-add flex h-28 w-36 shrink-0 flex-col items-center justify-center gap-1 border border-dashed border-[var(--line)] bg-[rgba(255,255,255,0.72)] text-[var(--ink-soft)]"
            >
              {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              <span className="text-xs">{isUploading ? "กำลังอัปโหลด..." : "+ เพิ่มภาพใหม่"}</span>
            </button>
          )}
          {images.length === 0 && !canAddMore && (
            <p className="text-xs text-[var(--ink-soft)]">ถึงจำนวนภาพสูงสุดแล้ว</p>
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
      {error && <p role="alert" className="text-xs text-[#a24439]">{error}</p>}
    </div>
  );
}