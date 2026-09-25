import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  /** @nullable absent on older cached responses -- treat as visible (true) */
  visible?: boolean;
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

export function isPortfolioItemVisible(item: PortfolioItem): boolean {
  return item.visible !== false;
}

export type PortfolioVisibilityFilter = "all" | "visible" | "hidden";

/** Powers the "ทั้งหมด / เผยแพร่แล้ว / ซ่อนอยู่" filter row. */
export function filterPortfolioItemsByVisibility(items: PortfolioItem[], filter: PortfolioVisibilityFilter): PortfolioItem[] {
  if (filter === "all") return items;
  return items.filter((item) => (filter === "visible" ? isPortfolioItemVisible(item) : !isPortfolioItemVisible(item)));
}

/** Plain toggle: what a photo's next visible value should be after one click. */
export function toggleVisibility(currentlyVisible: boolean): boolean {
  return !currentlyVisible;
}

async function fetchPortfolio(category: string): Promise<PortfolioResponse> {
  const url = category === "all"
    ? "/api/portfolio?limit=200&includeHidden=true"
    : `/api/portfolio?category=${encodeURIComponent(category)}&limit=200&includeHidden=true`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("โหลดคลังภาพผลงานไม่สำเร็จ");
  return response.json() as Promise<PortfolioResponse>;
}

async function patchPortfolioVisibility(id: string, visible: boolean): Promise<{ id: string; visible: boolean }> {
  const response = await fetch(`/api/admin/portfolio/${encodeURIComponent(id)}/visibility`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visible }),
  });
  if (!response.ok) throw new Error("อัปเดตสถานะการเผยแพร่ไม่สำเร็จ");
  return response.json() as Promise<{ id: string; visible: boolean }>;
}

const VISIBILITY_FILTER_OPTIONS: ReadonlyArray<{ value: PortfolioVisibilityFilter; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "visible", label: "🟢 เผยแพร่แล้ว" },
  { value: "hidden", label: "⚪️ ซ่อนอยู่" },
];

function VisibilityToggleButton({ item, onToggle, size = "default" }: { item: PortfolioItem; onToggle: (item: PortfolioItem) => void; size?: "default" | "sm" }) {
  const visible = isPortfolioItemVisible(item);
  const padding = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs";
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle(item);
      }}
      className={`rounded-sm font-medium ${padding} ${visible ? "bg-emerald-600 text-white" : "bg-gray-400 text-white"}`}
      data-testid={`button-toggle-visibility-${item.id}`}
    >
      {visible ? "🟢 เผยแพร่บนเว็บ" : "⚪️ ซ่อนเฉพาะภายใน"}
    </button>
  );
}

type CopiedFeedback = "link" | "message" | null;

function PortfolioLightbox({ item, onClose, onToggleVisibility }: { item: PortfolioItem; onClose: () => void; onToggleVisibility: (item: PortfolioItem) => void }) {
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
          <VisibilityToggleButton item={item} onToggle={onToggleVisibility} />
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
  const [visibilityFilter, setVisibilityFilter] = useState<PortfolioVisibilityFilter>("all");
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const queryClient = useQueryClient();

  const queryKey = ["/api/portfolio", selectedCategory];
  const portfolioQuery = useQuery({
    queryKey,
    queryFn: () => fetchPortfolio(selectedCategory),
  });

  const toggleMutation = useMutation({ mutationFn: (item: PortfolioItem) => patchPortfolioVisibility(item.id, toggleVisibility(isPortfolioItemVisible(item))) });

  const categories = portfolioQuery.data?.categories ?? [];
  const allItems = portfolioQuery.data?.items ?? [];
  const searchedItems = useMemo(() => filterPortfolioItems(allItems, searchQuery), [allItems, searchQuery]);
  const visibleItems = useMemo(() => filterPortfolioItemsByVisibility(searchedItems, visibilityFilter), [searchedItems, visibilityFilter]);

  const handleToggleVisibility = (item: PortfolioItem) => {
    const nextVisible = toggleVisibility(isPortfolioItemVisible(item));
    queryClient.setQueryData<PortfolioResponse>(queryKey, (old) =>
      old
        ? { ...old, items: old.items.map((candidate) => (candidate.id === item.id ? { ...candidate, visible: nextVisible } : candidate)) }
        : old,
    );
    setSelectedItem((current) => (current && current.id === item.id ? { ...current, visible: nextVisible } : current));
    toggleMutation.mutate(item);
  };

  return (
    <div className="space-y-8" data-testid="admin-portfolio-gallery">
      <header className="border-b border-[var(--line)] pb-7">
        <p className="eyebrow accent">SALES PORTFOLIO</p>
        <h1 className="font-display tracking-tight">คลังภาพผลงานขาย</h1>
        <p className="mt-3 max-w-2xl text-[var(--ink-soft)]">
          ค้นหาและคัดลอกภาพผลงานจริงจากโรงงาน ส่งให้ลูกค้าได้ทันทีโดยไม่ต้องดาวน์โหลด
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="กรองตามสถานะการเผยแพร่">
        {VISIBILITY_FILTER_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={visibilityFilter === option.value ? "default" : "outline"}
            className="rounded-none"
            onClick={() => setVisibilityFilter(option.value)}
            data-testid={`button-visibility-filter-${option.value}`}
          >
            {option.label}
          </Button>
        ))}
      </div>

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
            <div key={item.id} className="group relative aspect-square overflow-hidden border border-[var(--line)] bg-black/5" data-testid={`card-portfolio-item-${item.id}`}>
              <button
                type="button"
                onClick={() => setSelectedItem(item)}
                className="block h-full w-full"
                data-testid={`button-open-portfolio-item-${item.id}`}
              >
                <img
                  src={item.url}
                  alt={item.title}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                  loading="lazy"
                />
              </button>
              <div className="absolute bottom-1 right-1">
                <VisibilityToggleButton item={item} onToggle={handleToggleVisibility} size="sm" />
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={selectedItem !== null} onOpenChange={(open) => { if (!open) setSelectedItem(null); }}>
        <DialogContent className="max-w-3xl gap-0 rounded-none p-0" data-testid="dialog-portfolio-lightbox">
          {selectedItem && <PortfolioLightbox item={selectedItem} onClose={() => setSelectedItem(null)} onToggleVisibility={handleToggleVisibility} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PortfolioGalleryPage;
