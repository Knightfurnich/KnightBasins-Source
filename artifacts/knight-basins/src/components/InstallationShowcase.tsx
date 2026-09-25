import { useQuery } from "@tanstack/react-query";
import { Camera, RefreshCw, X } from "lucide-react";
import { useState } from "react";

export interface ShowcasePhoto {
  id: number;
  imageUrl: string;
  caption: string | null;
}

const SHOWCASE_LIMIT = 6;

async function fetchShowcasePhotos(): Promise<ShowcasePhoto[]> {
  const res = await fetch(`/api/site-photos/showcase?limit=${SHOWCASE_LIMIT}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Real installation photos submitted by the crew from job sites, shown on the
 * public storefront. Server returns only a curated, anonymised payload (no
 * sender names or internal notes) so nothing internal leaks publicly.
 */
export function InstallationShowcase() {
  const { data: photos = [], isLoading } = useQuery<ShowcasePhoto[]>({
    queryKey: ["site-photos-showcase"],
    queryFn: fetchShowcasePhotos,
    staleTime: 1000 * 60 * 30,
  });
  const [zoomPhoto, setZoomPhoto] = useState<ShowcasePhoto | null>(null);

  if (isLoading || photos.length === 0) return null;

  return (
    <section className="installation-showcase" aria-label="ผลงานติดตั้งจริง" data-testid="installation-showcase">
      <div className="installation-showcase-heading">
        <div>
          <p className="eyebrow">REAL INSTALLATIONS</p>
          <h2>ผลงานติดตั้งจริงจากหน้างาน</h2>
          <p className="installation-showcase-sub">ภาพถ่ายจากทีมช่างของเราที่ส่งกลับจากบ้านและคอนโดของลูกค้าจริง</p>
        </div>
        <span className="installation-showcase-badge">
          <Camera size={14} aria-hidden="true" /> {photos.length} ภาพล่าสุด
        </span>
      </div>

      <div className="installation-showcase-grid">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            className="installation-showcase-card"
            onClick={() => setZoomPhoto(photo)}
            aria-label={`ดูภาพขยาย: ${photo.caption ?? "ผลงานติดตั้ง"}`}
            data-testid={`showcase-photo-${photo.id}`}
          >
            <img src={photo.imageUrl} alt={photo.caption ?? "ผลงานติดตั้งจริง"} loading="lazy" />
            {photo.caption && <span className="installation-showcase-caption">{photo.caption}</span>}
          </button>
        ))}
      </div>

      {zoomPhoto && (
        <div
          className="installation-showcase-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="ภาพผลงานติดตั้งขนาดใหญ่"
          onClick={() => setZoomPhoto(null)}
          data-testid="showcase-lightbox"
        >
          <button
            type="button"
            className="installation-showcase-lightbox-close"
            onClick={() => setZoomPhoto(null)}
            aria-label="ปิดภาพ"
          >
            <X size={20} />
          </button>
          <img
            src={zoomPhoto.imageUrl}
            alt={zoomPhoto.caption ?? "ผลงานติดตั้งจริง"}
            onClick={(event) => event.stopPropagation()}
          />
          {zoomPhoto.caption && <p className="installation-showcase-lightbox-caption">{zoomPhoto.caption}</p>}
        </div>
      )}

      <p className="installation-showcase-foot">
        <RefreshCw size={13} aria-hidden="true" /> ภาพอัปเดตอัตโนมัติจากทีมติดตั้งของบริษัท
      </p>
    </section>
  );
}
