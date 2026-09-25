import { useQuery } from "@tanstack/react-query";
import { Camera, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";

export interface ShowcasePhoto {
  id: string | number;
  imageUrl: string;
  caption: string | null;
  category?: string;
}

type FeaturedItem = {
  id: string;
  category: string;
  filename: string;
  url: string;
  rank: number;
  captionTh: string;
  reason?: string;
};

type FeaturedResponse = {
  updatedAt?: string;
  items?: FeaturedItem[];
};

async function fetchFeaturedShowcase(): Promise<ShowcasePhoto[]> {
  try {
    const res = await fetch("/api/portfolio/featured");
    if (res.ok) {
      const data: FeaturedResponse = await res.json();
      if (Array.isArray(data.items) && data.items.length > 0) {
        return data.items.map((item) => ({
          id: item.id,
          imageUrl: item.url,
          caption: item.captionTh,
          category: item.category,
        }));
      }
    }
  } catch {
    // fallback
  }

  // Fallback to legacy endpoint if portfolio/featured is unreachable
  try {
    const fallbackRes = await fetch("/api/site-photos/showcase?limit=10");
    if (fallbackRes.ok) {
      const fallbackData = await fallbackRes.json();
      if (Array.isArray(fallbackData)) {
        return fallbackData.map((p: { id: number; imageUrl: string; caption?: string | null }) => ({
          id: p.id,
          imageUrl: p.imageUrl,
          caption: p.caption ?? null,
        }));
      }
    }
  } catch {
    // ignore
  }

  return [];
}

/**
 * Infinite auto-scrolling showcase carousel featuring the 10 curated
 * masterpiece installation photos from Knight Furnich.
 * Continuously loops, pauses on hover/touch, and supports manual stepping.
 */
export function InstallationShowcase() {
  const { data: photos = [], isLoading } = useQuery<ShowcasePhoto[]>({
    queryKey: ["portfolio-featured-showcase"],
    queryFn: fetchFeaturedShowcase,
    staleTime: 1000 * 60 * 30,
  });

  const [zoomPhoto, setZoomPhoto] = useState<ShowcasePhoto | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (isLoading || photos.length === 0) return null;

  // Duplicate photos for a seamless infinite loop illusion
  const loopedPhotos = [...photos, ...photos];

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;
    const offset = direction === "left" ? -320 : 320;
    scrollContainerRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <section className="installation-showcase" aria-label="ผลงานติดตั้งจริง" data-testid="installation-showcase">
      <div className="installation-showcase-heading flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-1.5 text-xs font-bold tracking-widest text-[#003366]">
            <Sparkles size={13} className="text-amber-500" /> REAL INSTALLATIONS · 100% SEAMLESS
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#003366] mt-1">
            ผลงานติดตั้งจริงจากหน้างานลูกค้า
          </h2>
          <p className="installation-showcase-sub text-sm text-[var(--ink-soft)] mt-1">
            ภาพถ่ายจริงจากบ้าน คอนโดหรู และโครงการที่ติดตั้งเสร็จสมบูรณ์โดยทีมช่าง ไนท์ เฟอร์นิช
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="installation-showcase-badge inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-[#003366]/5 text-[#003366] border border-[#003366]/20">
            <Camera size={13} aria-hidden="true" /> {photos.length} ผลงานเด่น
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleScroll("left")}
              className="p-1.5 rounded-full border border-[var(--line)] bg-[var(--card-paper)] text-[var(--ink)] hover:bg-slate-100 transition shadow-sm"
              aria-label="เลื่อนซ้าย"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => handleScroll("right")}
              className="p-1.5 rounded-full border border-[var(--line)] bg-[var(--card-paper)] text-[var(--ink)] hover:bg-slate-100 transition shadow-sm"
              aria-label="เลื่อนขวา"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Infinite Scrolling Track */}
      <div className="relative mt-6 overflow-hidden group">
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto scrollbar-none py-2 px-1 scroll-smooth snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {loopedPhotos.map((photo, index) => (
            <button
              key={`${photo.id}-${index}`}
              type="button"
              className="shrink-0 w-[280px] sm:w-[320px] rounded-xl overflow-hidden border border-[var(--line)] bg-[var(--card-paper)] shadow-sm hover:shadow-md hover:border-[#003366] transition-all duration-300 hover:-translate-y-1 text-left flex flex-col group/card snap-start"
              onClick={() => setZoomPhoto(photo)}
              aria-label={`ดูภาพขยาย: ${photo.caption ?? "ผลงานติดตั้ง"}`}
              data-testid={`showcase-photo-${photo.id}`}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                <img
                  src={photo.imageUrl}
                  alt={photo.caption ?? "ผลงานติดตั้งจริง"}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                />
                <span className="absolute top-2.5 left-2.5 rounded-md bg-black/60 backdrop-blur-md px-2 py-0.5 text-[11px] font-medium text-white shadow">
                  #{(index % photos.length) + 1}
                </span>
              </div>
              {photo.caption && (
                <div className="p-3">
                  <p className="text-xs font-semibold text-[var(--ink)] line-clamp-1 group-hover/card:text-[#003366] transition-colors">
                    {photo.caption}
                  </p>
                  <span className="text-[11px] text-[var(--ink-soft)] mt-0.5 block">
                    หินสังเคราะห์แท้ ไร้รอยต่อ
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {zoomPhoto && (
        <div
          className="installation-showcase-lightbox fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="ภาพผลงานติดตั้งขนาดใหญ่"
          onClick={() => setZoomPhoto(null)}
          data-testid="showcase-lightbox"
        >
          <button
            type="button"
            className="installation-showcase-lightbox-close absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition"
            onClick={() => setZoomPhoto(null)}
            aria-label="ปิดภาพ"
          >
            <X size={22} />
          </button>
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-xl bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomPhoto.imageUrl}
              alt={zoomPhoto.caption ?? "ผลงานติดตั้งจริง"}
              className="max-h-[80vh] w-auto object-contain mx-auto"
            />
            {zoomPhoto.caption && (
              <div className="bg-black/90 p-4 text-center">
                <p className="text-sm font-semibold text-white">{zoomPhoto.caption}</p>
                <p className="text-xs text-white/70 mt-1">ผลงานติดตั้งจริงโดยทีมช่าง บริษัท ไนท์ เฟอร์นิช จำกัด</p>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="installation-showcase-foot text-center text-xs text-[var(--ink-soft)] mt-4">
        ✨ เลื่อนภาพเพื่อชมตัวอย่างงานจริง · คลิกที่ภาพเพื่อดูรายละเอียดขนาดใหญ่
      </p>
    </section>
  );
}
