import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, ImagePlus, Loader2, Star, X } from "lucide-react";
import { uploadImageFile } from "./imageUploadClient";
import { nextQuoteImageUrl } from "./basinImageRoles";

type BasinImageManagerFieldProps = {
  images?: string[] | null;
  quoteImageUrl?: string | null;
  onImagesChange: (images: string[]) => void;
  onQuoteImageChange: (url: string | null) => void;
  max?: number;
};

export function BasinImageManagerField({
  images: imagesProp,
  quoteImageUrl,
  onImagesChange,
  onQuoteImageChange,
  max = 5,
}: BasinImageManagerFieldProps) {
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

  const canAddMore = images.length < max;

  return (
    <div className="admin-upload-field space-y-2">
      <span className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">รูปสินค้า</span>
      <p className="text-xs text-[var(--ink-soft)]">อัปโหลดได้สูงสุด {max} ภาพ ภาพแรก (มีดาว) คือภาพหลักที่ลูกค้าเห็นในแคตตาล็อก กดตั้งเป็นภาพหลักเพื่อสลับ และเลือกภาพที่จะใช้พิมพ์ในใบเสนอราคา (ถ้าไม่เลือกจะใช้ภาพหลักโดยอัตโนมัติ)</p>
      <div className="admin-gallery-upload-grid flex flex-wrap gap-3">
        {images.map((url, index) => {
          const isPrimary = index === 0;
          const isQuoteImage = quoteImageUrl ? quoteImageUrl === url : isPrimary;
          return (
            <div key={`${url}-${index}`} className="admin-gallery-upload-tile relative h-24 w-32 shrink-0 overflow-hidden border border-[var(--line)] bg-[var(--paper)]">
              <img src={url} alt={`รูปสินค้า ${index + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label={`ลบภาพที่ ${index + 1}`}
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"
              >
                <X className="h-3 w-3" />
              </button>
              {isPrimary && (
                <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-amber-500 text-white" title="ภาพหลัก">
                  <Star className="h-3 w-3" fill="currentColor" />
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-black/50 p-1">
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => moveTo(index, -1)} disabled={index === 0} aria-label="เลื่อนไปทางซ้าย" className="text-white disabled:opacity-30">
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  {!isPrimary && (
                    <button type="button" onClick={() => setAsPrimary(index)} className="text-[12px] text-white underline decoration-dotted" data-testid={`button-basin-image-primary-${index}`}>
                      ตั้งเป็นภาพหลัก
                    </button>
                  )}
                  <button type="button" onClick={() => moveTo(index, 1)} disabled={index === images.length - 1} aria-label="เลื่อนไปทางขวา" className="text-white disabled:opacity-30">
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => toggleQuoteImage(url)}
                  className={`flex items-center justify-center gap-1 rounded-sm px-1 py-0.5 text-[12px] ${isQuoteImage ? "bg-emerald-600 text-white" : "text-white/80 hover:text-white"}`}
                  data-testid={`button-basin-image-quote-${index}`}
                >
                  <FileText className="h-3 w-3" /> {isQuoteImage ? "ใช้ในใบเสนอราคา" : "ใช้ภาพนี้ในใบเสนอราคา"}
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
            className="admin-gallery-upload-add flex h-24 w-32 shrink-0 flex-col items-center justify-center gap-1 border border-dashed border-[var(--line)] bg-[rgba(255,255,255,0.72)] text-[var(--ink-soft)]"
          >
            {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <span className="text-[12px]">{isUploading ? "กำลังอัปโหลด..." : "เพิ่มภาพ"}</span>
          </button>
        )}
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
