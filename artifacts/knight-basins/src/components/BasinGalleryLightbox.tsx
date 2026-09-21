import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ImageOff, Images, X } from "lucide-react";

type BasinGalleryTriggerProps = {
  images: string[];
  alt: string;
};

export function BasinGalleryTrigger({ images, alt }: BasinGalleryTriggerProps) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (images.length === 0) return null;

  const openAt = (event: MouseEvent, nextIndex: number) => {
    event.stopPropagation();
    setIndex(nextIndex);
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className="product-gallery-badge"
        onClick={(event) => openAt(event, 0)}
        data-testid="button-basin-gallery-open"
      >
        <Images size={13} /> {images.length} ภาพ
      </button>
      {open && (
        <BasinGalleryModal
          images={images}
          alt={alt}
          index={index}
          onIndexChange={setIndex}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function BasinGalleryModal({
  images,
  alt,
  index,
  onIndexChange,
  onClose,
}: {
  images: string[];
  alt: string;
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const showPrev = () => onIndexChange((index - 1 + images.length) % images.length);
  const showNext = () => onIndexChange((index + 1) % images.length);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const currentUrl = images[index];
  const currentFailed = failedUrls.has(currentUrl);

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
  }, [index, images.length]);

  const stop = (event: MouseEvent) => event.stopPropagation();

  // Rendered through a portal into document.body: this modal must escape the
  // product card's DOM subtree entirely, not just get a high z-index. A card
  // gets `transform` on hover (see .product-card:hover), and any ancestor
  // with a transform becomes the containing block for position:fixed
  // descendants — so an inline-rendered fixed overlay would size/position
  // itself against the small card instead of the viewport.
  return createPortal(
    <div
      className="basin-gallery-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} ภาพติดตั้งจริง`}
      onClick={(event) => { stop(event); onClose(); }}
    >
      <button type="button" className="basin-gallery-close" onClick={(event) => { stop(event); onClose(); }} aria-label="ปิด">
        <X size={20} />
      </button>
      <div className="basin-gallery-stage" onClick={stop}>
        {images.length > 1 && (
          <button type="button" className="basin-gallery-nav basin-gallery-nav--prev" onClick={(event) => { stop(event); showPrev(); }} aria-label="ภาพก่อนหน้า">
            <ChevronLeft size={22} />
          </button>
        )}
        {currentFailed ? (
          <div className="basin-gallery-image basin-gallery-image--broken" role="img" aria-label={`${alt} ${index + 1}/${images.length}`}>
            <ImageOff size={28} />
            <span>โหลดภาพนี้ไม่สำเร็จ</span>
          </div>
        ) : (
          <img
            src={currentUrl}
            alt={`${alt} ${index + 1}/${images.length}`}
            className="basin-gallery-image"
            onError={() => setFailedUrls((current) => new Set(current).add(currentUrl))}
          />
        )}
        {images.length > 1 && (
          <button type="button" className="basin-gallery-nav basin-gallery-nav--next" onClick={(event) => { stop(event); showNext(); }} aria-label="ภาพถัดไป">
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
              className={`basin-gallery-thumb ${thumbIndex === index ? "is-active" : ""}`}
              onClick={(event) => { stop(event); onIndexChange(thumbIndex); }}
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
