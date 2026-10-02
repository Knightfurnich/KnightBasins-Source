// SCAFFOLD (job-189): placeholder so the work order's SCOPE paths resolve.
// Replit replaces this file with the real implementation. Do not ship as-is.
import { useState } from "react";

type StoneSlabViewerProps = {
  images: string[];
  alt: string;
};

export function StoneSlabViewer({ images, alt }: StoneSlabViewerProps) {
  const [open, setOpen] = useState(false);
  if (images.length === 0) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="button-stone-slab-open" aria-label={alt}>
        ดูภาพเต็มแผ่น
      </button>
      {open ? <div role="dialog" aria-modal="true" aria-label={alt} data-testid="stone-slab-overlay" /> : null}
    </>
  );
}
