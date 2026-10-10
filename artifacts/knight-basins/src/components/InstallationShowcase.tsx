import { Camera, ChevronLeft, ChevronRight, Images, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
/**
 * job 431-B A: the catalogue count shown to customers must be the real one. The
 * storefront used to print three different claims (670-something in the
 * showcase, 180-something on /readme, 333 on /portfolio) at the same time. Every surface now reads `total` from GET /api/portfolio and only
 * falls back to PORTFOLIO_TOTAL_FALLBACK while that request is in flight.
 */
export const PORTFOLIO_TOTAL_FALLBACK = 333;
export function usePortfolioTotal(): string {
  const { data } = useQuery<{ total?: number }>({
    queryKey: ["portfolio-total-count"],
    queryFn: async () => (await fetch("/api/portfolio", { headers: { Accept: "application/json" } })).json(),
    staleTime: 5 * 60 * 1000,
  });
  return typeof data?.total === "number" && data.total > 0 ? String(data.total) : String(PORTFOLIO_TOTAL_FALLBACK);
}
import { Link } from "wouter";

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
  const portfolioTotal = usePortfolioTotal();
  const { data: photos = [], isLoading } = useQuery<ShowcasePhoto[]>({
    queryKey: ["portfolio-featured-showcase"],
    queryFn: fetchFeaturedShowcase,
    staleTime: 1000 * 60 * 30,
  });

  const [zoomPhoto, setZoomPhoto] = useState<ShowcasePhoto | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollFrame = useRef<number>(0);

  /**
   * Continuous auto-scroll marquee. A callback ref (rather than a
   * useEffect) is required here: the track only mounts after the query
   * resolves, so an effect keyed on photos.length can miss the moment the
   * node actually attaches. The track renders the photo list twice, so
   * wrapping scrollLeft back by half its scrollWidth loops seamlessly.
   * Pauses while the pointer/touch rests on the track, and honours
   * prefers-reduced-motion.
   */
  const attachMarquee = useCallback((node: HTMLDivElement | null) => {
    scrollContainerRef.current = node;
    if (autoScrollFrame.current) {
      window.cancelAnimationFrame(autoScrollFrame.current);
      autoScrollFrame.current = 0;
    }
    if (!node) return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let paused = false;
    const onEnter = () => { paused = true; };
    const onLeave = () => { paused = false; };
    node.addEventListener("pointerenter", onEnter);
    node.addEventListener("pointerleave", onLeave);
    node.addEventListener("touchstart", onEnter, { passive: true });
    node.addEventListener("touchend", onLeave);

    const tick = () => {
      if (!paused) {
        const half = node.scrollWidth / 2;
        if (half > 0) {
          node.scrollLeft += 0.6;
          if (node.scrollLeft >= half) node.scrollLeft -= half;
        }
      }
      autoScrollFrame.current = window.requestAnimationFrame(tick);
    };
    autoScrollFrame.current = window.requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => {
    if (autoScrollFrame.current) window.cancelAnimationFrame(autoScrollFrame.current);
  }, []);

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
          <button
            type="button"
            onClick={() => setZoomPhoto(photos[0])}
            className="installation-showcase-badge inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#003366] text-white hover:bg-[#002244] active:scale-95 transition shadow-sm cursor-pointer"
            title="คลิกเพื่อเปิดดูภาพผลงานเด่นแบบเต็มจอ"
            data-testid="button-showcase-open-all"
          >
            <Camera size={13} aria-hidden="true" /> {photos.length} ผลงานเด่น (คลิกดูภาพขยาย)
          </button>
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
          ref={attachMarquee}
          className="flex gap-4 overflow-x-auto scrollbar-none py-2 px-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none", scrollBehavior: "auto" }}
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

      {/* Lightbox Modal with Next/Prev Controls */}
      {zoomPhoto && (
        <div
          className="installation-showcase-lightbox fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="ภาพผลงานติดตั้งขนาดใหญ่"
          onClick={() => setZoomPhoto(null)}
          data-testid="showcase-lightbox"
        >
          <button
            type="button"
            className="installation-showcase-lightbox-close absolute top-4 right-4 z-10 rounded-full bg-white/20 p-2.5 text-white hover:bg-white/40 transition shadow"
            onClick={() => setZoomPhoto(null)}
            aria-label="ปิดภาพ"
          >
            <X size={24} />
          </button>

          {/* Previous Button */}
          <button
            type="button"
            className="absolute left-3 sm:left-6 z-10 p-3 rounded-full bg-black/60 text-white hover:bg-black/90 active:scale-95 transition shadow-lg"
            onClick={(e) => {
              e.stopPropagation();
              const currIdx = photos.findIndex((p) => p.id === zoomPhoto.id);
              const prevIdx = (currIdx - 1 + photos.length) % photos.length;
              setZoomPhoto(photos[prevIdx] || null);
            }}
            aria-label="ภาพก่อนหน้า"
          >
            <ChevronLeft size={28} />
          </button>

          {/* Next Button */}
          <button
            type="button"
            className="absolute right-3 sm:right-6 z-10 p-3 rounded-full bg-black/60 text-white hover:bg-black/90 active:scale-95 transition shadow-lg"
            onClick={(e) => {
              e.stopPropagation();
              const currIdx = photos.findIndex((p) => p.id === zoomPhoto.id);
              const nextIdx = (currIdx + 1) % photos.length;
              setZoomPhoto(photos[nextIdx] || null);
            }}
            aria-label="ภาพถัดไป"
          >
            <ChevronRight size={28} />
          </button>

          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-xl bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomPhoto.imageUrl}
              alt={zoomPhoto.caption ?? "ผลงานติดตั้งจริง"}
              className="max-h-[78vh] w-auto object-contain mx-auto"
            />
            {zoomPhoto.caption && (
              <div className="bg-black/90 p-4 text-center">
                <p className="text-sm sm:text-base font-semibold text-white">{zoomPhoto.caption}</p>
                <p className="text-xs text-amber-300 mt-1">ผลงานติดตั้งจริงโดยทีมช่าง บริษัท ไนท์ เฟอร์นิช จำกัด (ภาพที่ {(photos.findIndex((p) => p.id === zoomPhoto.id) + 1)} จาก {photos.length})</p>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="installation-showcase-foot text-center text-xs text-[var(--ink-soft)] mt-4">
        ✨ เลื่อนภาพเพื่อชมตัวอย่างงานจริง · คลิกที่ภาพเพื่อดูรายละเอียดขนาดใหญ่
      </p>

      <div className="flex justify-center mt-6">
        <Link
          href="/portfolio"
          className="installation-showcase-all-btn"
          data-testid="link-showcase-all-portfolio"
        >
          <Images size={16} aria-hidden="true" />
          <span>ดูคลังผลงานทั้งหมด ({portfolioTotal} ภาพ)</span>
        </Link>
      </div>
    </section>
  );
}
