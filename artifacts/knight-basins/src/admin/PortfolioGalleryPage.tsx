import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Clipboard, Images, MessageCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export type PortfolioCategory = { slug: string; name: string; icon: string; count: number };
export type PortfolioItem = {
  id: string;
  category: string;
  categoryName: string;
  icon: string;
  url: string;
  width: number;
  height: number;
  title: string;
};
export type PortfolioResponse = {
  updatedAt: string;
  total: number;
  categories: PortfolioCategory[];
  count: number;
  items: PortfolioItem[];
};

/**
 * Turns the API's relative photo path (e.g. "/api/uploads/portfolio/...")
 * into an absolute URL using the given origin (window.location.origin in
 * the real page), so a copied link/message works from any device the
 * salesperson pastes it into -- not just this admin session.
 */
export function toAbsolutePhotoUrl(relativeUrl: string, origin: string): string {
  if (/^https?:\/\//.test(relativeUrl)) return relativeUrl;
  const trimmedOrigin = origin.replace(/\/+$/, "");
  const path = relativeUrl.startsWith("/") ? relativeUrl : `/${relativeUrl}`;
  return `${trimmedOrigin}${path}`;
}

/** The exact message format the work order specifies, ready to paste to a customer. */
export function portfolioCustomerMessage(categoryName: string, absoluteUrl: string): string {
  return `ภาพตัวอย่างผลงาน${categoryName}จริงจากโรงงาน Knight Furnich ครับ\n${absoluteUrl}`;
}

/** Client-side quick search over whatever category/tab is currently loaded --
 * matches the category name, the item's own title, or the category slug, so
 * both a Thai keyword ("ไอส์แลนด์") and an English slug typed by habit both work. */
export function filterPortfolioItems(items: PortfolioItem[], query: string): PortfolioItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) =>
    item.categoryName.toLowerCase().includes(needle)
    || item.title.toLowerCase().includes(needle)
    || item.category.toLowerCase().includes(needle),
  );
}

async function fetchPortfolio(category: string): Promise<PortfolioResponse> {
  const url = category === "all" ? "/api/portfolio?limit=200" : `/api/portfolio?category=${encodeURIComponent(category)}&limit=200`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("โหลดคลังภาพผลงานไม่สำเร็จ");
  return response.json() as Promise<PortfolioResponse>;
}

type CopiedFeedback = "link" | "message" | null;

function PortfolioLightbox({ item, onClose }: { item: PortfolioItem; onClose: () => void }) {
  const [copied, setCopied] = useState<CopiedFeedback>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyLink = async () => {
    const absoluteUrl = toAbsolutePhotoUrl(item.url, window.location.origin);
    await navigator.clipboard.writeText(absoluteUrl);
    setCopied("link");
  };

  const copyMessage = async () => {
    const absoluteUrl = toAbsolutePhotoUrl(item.url, window.location.origin);
    await navigator.clipboard.writeText(portfolioCustomerMessage(item.categoryName, absoluteUrl));
    setCopied("message");
  };

  return (
    <div>
      <DialogTitle className="sr-only">{item.title}</DialogTitle>
      <img src={item.url} alt={item.title} className="max-h-[65vh] w-full bg-black object-contain" />
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--ink-soft)]">
          <span>{item.icon} {item.categoryName}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-none" onClick={() => void copyLink()} data-testid="button-portfolio-copy-link">
            <Clipboard className="mr-2 h-4 w-4" /> คัดลอกลิงก์รูป
          </Button>
          <Button type="button" variant="outline" className="rounded-none" onClick={() => void copyMessage()} data-testid="button-portfolio-copy-message">
            <MessageCircle className="mr-2 h-4 w-4" /> คัดลอกข้อความส่งลูกค้า
          </Button>
          <Button type="button" variant="outline" className="rounded-none" onClick={onClose} data-testid="button-portfolio-lightbox-close">
            ปิด
          </Button>
        </div>
        {copied && (
          <p className="text-sm text-[var(--success)]" role="status" data-testid="status-portfolio-copied">
            <Check className="mr-1 inline h-4 w-4" /> คัดลอกแล้ว ✓
          </p>
        )}
      </div>
    </div>
  );
}

export function PortfolioGalleryPage() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);

  const portfolioQuery = useQuery({
    queryKey: ["/api/portfolio", selectedCategory],
    queryFn: () => fetchPortfolio(selectedCategory),
  });

  const categories = portfolioQuery.data?.categories ?? [];
  const allItems = portfolioQuery.data?.items ?? [];
  const visibleItems = useMemo(() => filterPortfolioItems(allItems, searchQuery), [allItems, searchQuery]);

  return (
    <div className="space-y-8" data-testid="admin-portfolio-gallery">
      <header className="border-b border-[var(--line)] pb-7">
        <p className="eyebrow accent">SALES PORTFOLIO</p>
        <h1 className="font-display tracking-tight">คลังภาพผลงานขาย</h1>
        <p className="mt-3 max-w-2xl text-[var(--ink-soft)]">
          ค้นหาและคัดลอกภาพผลงานจริงจากโรงงาน ส่งให้ลูกค้าได้ทันทีโดยไม่ต้องดาวน์โหลด
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-soft)]" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="ค้นหา เช่น ครัว, ไอส์แลนด์, เคาน์เตอร์, บันได"
            className="rounded-none pl-8"
            data-testid="input-portfolio-search"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="กรองตามหมวดหมู่">
          <Button
            type="button"
            variant={selectedCategory === "all" ? "default" : "outline"}
            className="rounded-none"
            onClick={() => setSelectedCategory("all")}
            data-testid="button-portfolio-category-all"
          >
            ทั้งหมด
          </Button>
          {categories.map((category) => (
            <Button
              key={category.slug}
              type="button"
              variant={selectedCategory === category.slug ? "default" : "outline"}
              className="rounded-none"
              onClick={() => setSelectedCategory(category.slug)}
              data-testid={`button-portfolio-category-${category.slug}`}
            >
              {category.icon} {category.name} ({category.count})
            </Button>
          ))}
        </div>
      </div>

      {portfolioQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="กำลังโหลดคลังภาพผลงาน" data-testid="status-portfolio-loading">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="aspect-square animate-pulse border border-[var(--line)] bg-[var(--card-paper)] rounded-none" />
          ))}
        </div>
      ) : portfolioQuery.isError ? (
        <div className="border border-[#a24439]/40 bg-[#a24439]/5 p-6 rounded-none" role="alert" data-testid="status-portfolio-load-error">
          <h3>โหลดคลังภาพผลงานไม่สำเร็จ</h3>
          <p className="mt-2 text-[#a24439]">ระบบไม่สามารถดึงข้อมูลคลังภาพผลงานได้ในขณะนี้</p>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border border-[var(--line)] bg-[var(--card-paper)] p-12 text-center text-[var(--ink-soft)] rounded-none" data-testid="status-portfolio-empty">
          <Images className="h-8 w-8" aria-hidden="true" />
          <p>ไม่พบภาพผลงานตามคำค้นหรือหมวดหมู่ที่เลือก</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="grid-portfolio-items">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedItem(item)}
              className="group aspect-square overflow-hidden border border-[var(--line)] bg-black/5"
              data-testid={`card-portfolio-item-${item.id}`}
            >
              <img
                src={item.url}
                alt={item.title}
                className="h-full w-full object-cover transition group-hover:scale-105"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      <Dialog open={selectedItem !== null} onOpenChange={(open) => { if (!open) setSelectedItem(null); }}>
        <DialogContent className="max-w-3xl gap-0 rounded-none p-0" data-testid="dialog-portfolio-lightbox">
          {selectedItem && <PortfolioLightbox item={selectedItem} onClose={() => setSelectedItem(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PortfolioGalleryPage;
