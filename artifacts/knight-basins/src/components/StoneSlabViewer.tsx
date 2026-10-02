import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";

type StoneSlabViewerProps = {
  images: string[];
  alt: string;
};

export function StoneSlabViewer({ images, alt }: StoneSlabViewerProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  if (images.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="button-stone-slab-open"
      >
        ดูภาพเต็มแผ่น
      </button>
      {open && <StoneSlabModal images={images} alt={alt} onClose={close} />}
    </>
  );
}

function StoneSlabModal({
  images,
  alt,
  onClose,
}: {
  images: string[];
  alt: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const safeIndex = index % images.length;
  const currentUrl = images[safeIndex];
  const currentFailed = failedUrls.has(currentUrl);
  const showPrev = useCallback(
    () => setIndex((current) => (current - 1 + images.length) % images.length),
    [images.length],
  );
  const showNext = useCallback(
    () => setIndex((current) => (current + 1) % images.length),
    [images.length],
  );

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") showPrev();
      if (event.key === "ArrowRight") showNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose, showNext, showPrev]);

  const stop = (event: MouseEvent) => event.stopPropagation();

  return createPortal(
    <div
      className="basin-gallery-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} ภาพเต็มแผ่น`}
      data-testid="stone-slab-overlay"
      onClick={onClose}
    >
      <button type="button" className="basin-gallery-close" onClick={onClose} aria-label="ปิด">
        <X size={20} />
      </button>
      <div className="basin-gallery-stage" onClick={stop}>
        {images.length > 1 && (
          <button type="button" className="basin-gallery-nav basin-gallery-nav--prev" onClick={showPrev} aria-label="ภาพก่อนหน้า">
            <ChevronLeft size={22} />
          </button>
        )}
        {currentFailed ? (
          <div className="basin-gallery-image basin-gallery-image--broken" role="img" aria-label={`${alt} ${safeIndex + 1}/${images.length}`}>
            <ImageOff size={28} />
            <span>โหลดภาพนี้ไม่สำเร็จ</span>
          </div>
        ) : (
          <img
            src={currentUrl}
            alt={`${alt} ${safeIndex + 1}/${images.length}`}
            className="basin-gallery-image"
            onError={() => setFailedUrls((current) => new Set(current).add(currentUrl))}
          />
        )}
        {images.length > 1 && (
          <button type="button" className="basin-gallery-nav basin-gallery-nav--next" onClick={showNext} aria-label="ภาพถัดไป">
            <ChevronRight size={22} />
          </button>
        )}
      </div>
      {images.length > 1 && (
        <div className="basin-gallery-thumbs" onClick={stop}>
          {images.map((url, thumbIndex) => (
            <button
              key={`${url}-${thumbIndex}`}
              type="button"
              className={`basin-gallery-thumb ${thumbIndex === safeIndex ? "is-active" : ""}`}
              onClick={() => setIndex(thumbIndex)}
              aria-label={`ดูภาพที่ ${thumbIndex + 1}`}
            >
              <img src={url} alt="" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}