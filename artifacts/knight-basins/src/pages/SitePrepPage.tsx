import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Link2, MessageCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { knightFurnichLogo } from "@/data/assets";
import { RouteStructuredData } from "@/components/RouteStructuredData";
import { buildSitePrepStructuredData } from "@/data/structured-data";

export type SitePrepPortfolioItem = {
  id: string;
  category: string;
  categoryName: string;
  icon: string;
  url: string;
  width: number;
  height: number;
  title: string;
};

type PortfolioResponse = {
  updatedAt: string;
  total: number;
  categories: unknown[];
  count: number;
  items: SitePrepPortfolioItem[];
};

export type SitePrepChecklistItem = { icon: string; title: string; description: string };

/** The 5 checklist cards, in the exact order and wording the work order specifies. */
export const SITE_PREP_CHECKLIST: ReadonlyArray<SitePrepChecklistItem> = [
  { icon: "💧", title: "ระบบน้ำดี-น้ำเสีย", description: "ตำแหน่งท่อต้องได้ระดับกึ่งกลางอ่างและระยะท่อระบายน้ำ" },
  { icon: "🧱", title: "โครงสร้างรับน้ำหนัก", description: "โครงเหล็กหรือตู้ต้องรับน้ำหนักท็อปหินได้ ไม่แอ่น ไม่ยวบ" },
  { icon: "📏", title: "ระยะเผื่อขอบและผนัง", description: "เผื่อระยะขอบและฉากผนังตามที่ตกลง" },
  { icon: "⚡️", title: "ระบบไฟฟ้าและปลั๊ก", description: "ตำแหน่งปลั๊กและสวิตช์ต้องพ้นแนวน้ำและไม่ถูกท็อปหินปิดทับ" },
  { icon: "🚚", title: "ทางเข้าหน้างานและลิฟต์", description: "ทางเดินและลิฟต์ต้องมีขนาดกว้างพอให้ยกแผ่นหินยาวเข้าได้" },
];

/** Opens LINE's share-a-message intent with the page's title + URL. */
export function buildLineShareUrl(pageUrl: string, title: string): string {
  return `https://line.me/R/msg/text/?${encodeURIComponent(`${title}\n${pageUrl}`)}`;
}

async function fetchSitePrepPhotos(): Promise<SitePrepPortfolioItem[]> {
  const response = await fetch("/api/portfolio?category=site_prep&limit=60");
  if (!response.ok) throw new Error("โหลดภาพตัวอย่างหน้างานไม่สำเร็จ");
  const data = await response.json() as PortfolioResponse;
  return data.items;
}

export function SitePrepPage() {
  const [selectedItem, setSelectedItem] = useState<SitePrepPortfolioItem | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const photosQuery = useQuery({ queryKey: ["/api/portfolio", "site_prep"], queryFn: fetchSitePrepPhotos });
  const photos = photosQuery.data ?? [];
  const sitePrepStructuredData = useMemo(() => buildSitePrepStructuredData(), []);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  const lineShareUrl = useMemo(
    () => buildLineShareUrl(pageUrl, "คู่มือเตรียมหน้างานก่อนติดตั้งหินสังเคราะห์ Knight Basins"),
    [pageUrl],
  );

  const copyPageLink = async () => {
    await navigator.clipboard.writeText(pageUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="site-prep-page min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <RouteStructuredData id="site-prep" data={sitePrepStructuredData} />
      <header className="border-b border-[var(--line)] bg-[rgba(255,255,255,0.92)] backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <img className="h-8 w-auto" src={knightFurnichLogo} alt="Knight Furnich" />
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-soft)] hover:text-[#003366]"
          data-testid="link-site-prep-back-to-store"
        >
          <ArrowLeft size={15} /> กลับสู่หน้าร้าน
        </Link>
      </header>

      <main className="max-w-[880px] mx-auto px-6 py-10 space-y-10">
        <section className="space-y-3 text-center" data-testid="section-site-prep-hero">
          <h1 className="font-display text-2xl sm:text-3xl tracking-tight">คู่มือเตรียมหน้างานก่อนติดตั้งหินสังเคราะห์</h1>
          <p className="text-[var(--ink-soft)]">ส่งลิงก์นี้ให้ผู้รับเหมาหรือช่างโครงการเปิดดูได้เลย ก่อนวันเข้าติดตั้งจริง</p>
        </section>

        <section className="flex flex-wrap items-center justify-center gap-3">
          <Button type="button" variant="outline" className="rounded-none" onClick={() => void copyPageLink()} data-testid="button-site-prep-copy-link">
            <Link2 className="mr-2 h-4 w-4" /> คัดลอกลิงก์ส่งให้ช่าง
          </Button>
          <a href={lineShareUrl} target="_blank" rel="noreferrer" data-testid="link-site-prep-line-share">
            <Button type="button" variant="outline" className="rounded-none">
              <MessageCircle className="mr-2 h-4 w-4" /> ส่งใน LINE
            </Button>
          </a>
          {linkCopied && (
            <span className="inline-flex items-center text-sm text-[var(--success)]" role="status" data-testid="status-site-prep-copied">
              <Check className="mr-1 h-4 w-4" /> คัดลอกแล้ว ✓
            </span>
          )}
        </section>

        <section data-testid="section-site-prep-checklist">
          <h2 className="font-display text-xl mb-4">รายการตรวจก่อนวันติดตั้ง</h2>
          <Accordion type="multiple" className="space-y-2">
            {SITE_PREP_CHECKLIST.map((item, index) => (
              <AccordionItem
                key={item.title}
                value={`item-${index}`}
                className="border border-[var(--line)] px-4 rounded-none"
                data-testid={`accordion-site-prep-${index}`}
              >
                <AccordionTrigger data-testid={`trigger-site-prep-${index}`}>
                  <span className="mr-2 text-lg">{item.icon}</span> {item.title}
                </AccordionTrigger>
                <AccordionContent data-testid={`content-site-prep-${index}`}>{item.description}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section data-testid="section-site-prep-gallery">
          <h2 className="font-display text-xl mb-4">ภาพตัวอย่างหน้างานจริง</h2>
          {photosQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="กำลังโหลดภาพตัวอย่างหน้างาน" data-testid="status-site-prep-gallery-loading">
              {[0, 1, 2].map((item) => (
                <div key={item} className="aspect-square animate-pulse border border-[var(--line)] bg-black/5" />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]" data-testid="status-site-prep-gallery-empty">ยังไม่มีภาพตัวอย่างหน้างาน</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="grid-site-prep-photos">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setSelectedItem(photo)}
                  className="aspect-square overflow-hidden border border-[var(--line)]"
                  data-testid={`card-site-prep-photo-${photo.id}`}
                >
                  <img src={photo.url} alt={photo.title} className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      <Dialog open={selectedItem !== null} onOpenChange={(open) => { if (!open) setSelectedItem(null); }}>
        <DialogContent className="max-w-3xl gap-0 rounded-none p-0" data-testid="dialog-site-prep-lightbox">
          {selectedItem && (
            <div>
              <DialogTitle className="sr-only">{selectedItem.title}</DialogTitle>
              <img src={selectedItem.url} alt={selectedItem.title} className="max-h-[75vh] w-full bg-black object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SitePrepPage;
