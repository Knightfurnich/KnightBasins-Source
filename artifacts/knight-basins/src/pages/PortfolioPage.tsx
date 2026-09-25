import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, Images, Loader2, Search, X } from "lucide-react";
import { knightFurnichLogo } from "@/data/assets";
import { RouteStructuredData } from "@/components/RouteStructuredData";
import { buildPortfolioStructuredData } from "@/data/structured-data";

export type PortfolioPhoto = {
  id: string;
  category: string;
  categoryName: string;
  icon: string;
  url: string;
  width: number;
  height: number;
  title: string;
  captionTh?: string;
};

export type PortfolioCategory = { slug: string; name: string; icon: string; count: number };

type PortfolioResponse = {
  updatedAt: string;
  total: number;
  categories: PortfolioCategory[];
  count: number;
  items: PortfolioPhoto[];
};

export const PAGE_SIZE = 60;
export const ALL_CATEGORIES = "all";

export function filterPortfolioPhotos(photos: readonly PortfolioPhoto[], search: string): PortfolioPhoto[] {
  const query = search.trim().toLocaleLowerCase("th");
  if (!query) return [...photos];

  return photos.filter((photo) => {
    const caption = photo.captionTh?.trim() || photo.title;
    const searchableText = `${caption} ${photo.category} ${photo.categoryName}`.toLocaleLowerCase("th");
    return searchableText.includes(query);
  });
}

export function portfolioInquiryUrl(): string {
  return "https://line.me/R/ti/p/@789gcnhq";
}

/**
 * Public gallery API URL for a given tab + page + search term.
 *
 * The search term is sent to the server rather than filtered in the browser:
 * the gallery pages 60 at a time, so a client-side filter can only ever match
 * photos already loaded (the first 60 are all bathroom work), and a customer
 * typing "ครัว" would wrongly see "no results" while the kitchen photos sit
 * unloaded. The API matches `title`, `category` and `id`, and every Thai
 * category name is present in `title`, so Thai keywords resolve server-side.
 */
export function portfolioQueryUrl(category: string, offset: number, search = "", limit = PAGE_SIZE): string {
  const params = new URLSearchParams();
  if (category !== ALL_CATEGORIES) params.set("category", category);
  const query = search.trim();
  if (query) params.set("q", query);
  params.set("limit", String(limit));
  if (offset > 0) params.set("offset", String(offset));
  return `/api/portfolio?${params.toString()}`;
}

async function fetchPortfolioPage(category: string, offset: number, search: string): Promise<PortfolioResponse> {
  const response = await fetch(portfolioQueryUrl(category, offset, search));
  if (!response.ok) throw new Error("โหลดคลังภาพผลงานไม่สำเร็จ");
  return await response.json() as PortfolioResponse;
}

/** Waits for typing to settle before a server round-trip is issued. */
function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Public portfolio gallery: every real installation photo, browsable by work
 * category. Bathroom work leads (basins are the hero product); the API never
 * exposes customer names or job codes.
 */
export function PortfolioPage() {
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES);
  const [zoomId, setZoomId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery);

  const query = useInfiniteQuery({
    queryKey: ["/api/portfolio", activeCategory, debouncedSearch.trim()],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchPortfolioPage(activeCategory, pageParam as number, debouncedSearch),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < lastPage.count ? loaded : undefined;
    },
  });

  const pages = query.data?.pages ?? [];
  const firstPage = pages[0];
  const categories = firstPage?.categories ?? [];
  // The server already applied the search term, so the loaded pages *are* the
  // result set -- no second client-side pass.
  const photos = useMemo(() => pages.flatMap((page) => page.items), [pages]);
  const hasSearchQuery = Boolean(debouncedSearch.trim());
  const searchIsSettling = searchQuery.trim() !== debouncedSearch.trim();
  const totalForTab = firstPage
    ? (activeCategory === ALL_CATEGORIES
        ? firstPage.total
        : categories.find((c) => c.slug === activeCategory)?.count ?? 0)
    : 0;

  const zoomIndex = useMemo(
    () => (zoomId ? photos.findIndex((p) => p.id === zoomId) : -1),
    [zoomId, photos],
  );
  const zoomItem = zoomIndex >= 0 ? photos[zoomIndex] : null;

  const step = (delta: number) => {
    if (zoomIndex < 0 || photos.length === 0) return;
    const next = (zoomIndex + delta + photos.length) % photos.length;
    setZoomId(photos[next].id);
  };

  const structuredData = useMemo(
    () => buildPortfolioStructuredData(categories, categories.reduce((sum, c) => sum + c.count, 0)),
    [categories],
  );

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <RouteStructuredData id="portfolio" data={structuredData} />
      <header className="border-b border-[var(--line)] bg-[rgba(255,255,255,0.94)] backdrop-blur-md sticky top-0 z-20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img className="h-8 w-auto" src={knightFurnichLogo} alt="Knight Furnich" />
          <div>
            <strong className="block text-sm tracking-widest leading-none text-[#003366]">KNIGHT BASINS</strong>
            <small className="block text-[var(--ink-soft)] font-mono text-[12px] tracking-widest mt-1">
              คลังผลงานติดตั้งจริง · PORTFOLIO
            </small>
          </div>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-soft)] hover:text-[#003366]"
          data-testid="link-portfolio-back-to-store"
        >
          <ArrowLeft size={15} /> กลับสู่หน้าร้าน
        </Link>
      </header>

      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 space-y-7">
        <section className="space-y-3">
          <p className="text-xs font-bold tracking-widest text-[#003366]">REAL INSTALLATIONS · 100% SEAMLESS</p>
          <h1 className="text-2xl sm:text-4xl font-bold text-[#003366]" data-testid="portfolio-heading">
            คลังผลงานติดตั้งจริงทั้งหมด
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[var(--ink-soft)]">
            รวมภาพถ่ายผลงานจริงจากบ้าน คอนโด และโครงการที่ติดตั้งเสร็จสมบูรณ์โดยทีมช่าง บริษัท ไนท์ เฟอร์นิช จำกัด
            เลือกดูตามประเภทงานได้เลย — งานอ่างล้างหน้าและเคาน์เตอร์ห้องน้ำ ครัว เคาน์เตอร์ธุรกิจ งานดีไซน์ และอื่น ๆ
          </p>
          {firstPage && (
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#003366] bg-[#003366]/5 border border-[#003366]/20 rounded-full px-3 py-1.5">
              <Images size={14} aria-hidden="true" /> {firstPage.total} ภาพในคลัง · อัปเดตล่าสุด{" "}
              {new Date(firstPage.updatedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
            </span>
          )}
        </section>

        <div className="portfolio-search-bar" role="search">
          <Search className="portfolio-search-icon" size={18} aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="ค้นหาผลงาน เช่น อ่างคู่, ครัว, ผนัง, เคาน์เตอร์..."
            aria-label="ค้นหาผลงาน"
            data-testid="input-portfolio-search"
          />
          {searchQuery && (
            <button
              type="button"
              className="portfolio-search-clear"
              onClick={() => setSearchQuery("")}
              aria-label="ล้างคำค้นหา"
              data-testid="button-clear-portfolio-search"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1" data-testid="portfolio-category-tabs">
          <button
            type="button"
            onClick={() => setActiveCategory(ALL_CATEGORIES)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              activeCategory === ALL_CATEGORIES
                ? "border-[#003366] bg-[#003366] text-white"
                : "border-[var(--line)] bg-white text-[var(--ink)] hover:border-[#003366]"
            }`}
          >
            ทั้งหมด {firstPage ? `(${firstPage.total})` : ""}
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setActiveCategory(c.slug)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                activeCategory === c.slug
                  ? "border-[#003366] bg-[#003366] text-white"
                  : "border-[var(--line)] bg-white text-[var(--ink)] hover:border-[#003366]"
              }`}
              data-testid={`portfolio-tab-${c.slug}`}
            >
              {c.icon} {c.name} <span className="opacity-70">({c.count})</span>
            </button>
          ))}
        </div>

        {/* Grid */}
        {query.isPending && (
          <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)] py-12 justify-center">
            <Loader2 className="animate-spin" size={16} /> กำลังโหลดคลังภาพผลงาน...
          </div>
        )}

        {query.isError && (
          <p className="text-sm text-[#a24439] py-12 text-center">โหลดคลังภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>
        )}

        {!query.isPending && !query.isError && photos.length === 0 && (
          <p className="text-sm text-[var(--ink-soft)] py-12 text-center">ยังไม่มีภาพในหมวดนี้</p>
        )}

        {!query.isPending && !query.isError && photos.length > 0 && photos.length === 0 && (
          <p className="text-sm text-[var(--ink-soft)] py-12 text-center" role="status" data-testid="portfolio-search-empty">
            ไม่พบผลงานที่ตรงกับคำค้นหา
          </p>
        )}

        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="portfolio-grid">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setZoomId(photo.id)}
                className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-[var(--line)] bg-slate-100 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003366]"
                aria-label={`ดูภาพขยาย: ${photo.categoryName}`}
                data-testid={`portfolio-photo-${photo.id}`}
              >
                <img
                  src={photo.url}
                  alt={photo.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 py-2 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {photo.icon} {photo.categoryName}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Load more */}
        {photos.length > 0 && (
          <div className="flex flex-col items-center gap-2 pt-2">
            <p className="text-xs text-[var(--ink-soft)]">
              {hasSearchQuery
                ? `พบ ${photos.length} จาก ${photos.length} ภาพที่โหลด`
                : `แสดง ${photos.length} จาก ${totalForTab} ภาพ`}
            </p>
            {query.hasNextPage && (
              <button
                type="button"
                onClick={() => void query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                className="inline-flex items-center gap-2 rounded-lg border border-[#003366] bg-[#003366] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#002244] disabled:opacity-60"
                data-testid="button-portfolio-load-more"
              >
                {query.isFetchingNextPage ? <Loader2 className="animate-spin" size={15} /> : null}
                โหลดภาพเพิ่มเติม
              </button>
            )}
          </div>
        )}

        <p className="text-center text-xs text-[var(--ink-soft)] border-t border-[var(--line)] pt-5">
          ภาพทั้งหมดเป็นผลงานติดตั้งจริงของ บริษัท ไนท์ เฟอร์นิช จำกัด · สอบถามงานสั่งผลิต โทร 094-496-1949, 089-762-2209
        </p>
      </main>

      {/* Lightbox */}
      {zoomItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/88 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
          aria-label="ภาพผลงานขนาดใหญ่"
          onClick={() => setZoomId(null)}
          data-testid="portfolio-lightbox"
        >
          <button
            type="button"
            className="absolute top-4 right-4 z-10 rounded-full bg-white/20 p-2.5 text-white hover:bg-white/40 transition"
            onClick={() => setZoomId(null)}
            aria-label="ปิดภาพ"
          >
            <X size={24} />
          </button>
          <button
            type="button"
            className="absolute left-2 sm:left-6 z-10 rounded-full bg-black/60 p-3 text-white hover:bg-black/90 transition"
            onClick={(e) => { e.stopPropagation(); step(-1); }}
            aria-label="ภาพก่อนหน้า"
          >
            <ChevronLeft size={26} />
          </button>
          <button
            type="button"
            className="absolute right-2 sm:right-6 z-10 rounded-full bg-black/60 p-3 text-white hover:bg-black/90 transition"
            onClick={(e) => { e.stopPropagation(); step(1); }}
            aria-label="ภาพถัดไป"
          >
            <ChevronRight size={26} />
          </button>
          <div
            className="portfolio-lightbox-card relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={zoomItem.url} alt={zoomItem.captionTh?.trim() || zoomItem.title} className="portfolio-lightbox-image" />
            <div className="portfolio-lightbox-caption bg-black/90 p-4 text-center">
              <p className="text-sm sm:text-base font-semibold text-white" data-testid="portfolio-lightbox-category">
                {zoomItem.icon} {zoomItem.categoryName}
              </p>
              <p className="mt-1 text-sm text-white" data-testid="portfolio-lightbox-caption-text">
                {zoomItem.captionTh?.trim() || zoomItem.title}
              </p>
              <p className="text-xs text-amber-300 mt-1">
                ผลงานติดตั้งจริงโดยทีมช่าง บริษัท ไนท์ เฟอร์นิช จำกัด (ภาพที่ {zoomIndex + 1} จาก {photos.length})
              </p>
            </div>
            <div className="portfolio-lightbox-actionbar" data-testid="portfolio-lightbox-actions">
              <a
                className="portfolio-line-action"
                href={portfolioInquiryUrl()}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-portfolio-line-inquiry"
              >
                💬 สอบถามสเปกงานชิ้นนี้ทาง LINE
              </a>
              <Link
                href="/studio"
                className="portfolio-studio-action"
                data-testid="link-portfolio-studio"
              >
                🎨 ลองวางผังใน 2D Studio
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PortfolioPage;
