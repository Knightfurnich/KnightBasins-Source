import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, CircleAlert, Loader2, MessageCircle, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PortfolioInquiryPhoto = {
  id: string;
  title: string;
  url: string;
  categoryName: string;
  captionTh?: string;
};

type PortfolioInquiryModalProps =
  | {
      source?: "portfolio";
      photo: PortfolioInquiryPhoto;
      onClose: () => void;
      contextNotes?: string;
    }
  | {
      source: "catalog";
      sku?: string;
      title?: string;
      imageUrl?: string;
      priceTHB?: number;
      onClose: () => void;
      contextNotes?: string;
    };

const inquirySchema = z.object({
  phone: z.string().trim().min(1, "กรุณากรอกเบอร์โทรศัพท์"),
  name: z.string().trim(),
  notes: z.string().trim(),
});

type InquiryFormValues = z.infer<typeof inquirySchema>;

/* ---------------------------------------------------------------------------
 * LINE contact paths (job 414-B / phase 1 + phase 2)
 *
 * Why two paths instead of one: `https://line.me/R/oaMessage/...` is a *mobile*
 * deep link. On a desktop browser it does not open a chat -- it bounces through
 * two redirects and lands on the public "add LINE" marketing page (measured:
 * line.me/R/oaMessage -> line.me/ti/p -> https://www.line.me/en/), i.e. the
 * customer is thrown out of the storefront into an ad page. So:
 *   - touch / narrow viewport      -> keep the deep link (it works, best UX)
 *   - desktop (wide + fine pointer) -> stay on-site and show an in-page dialog
 *     with the OA QR, a link to the correct desktop "add friend" page, and a
 *     copy-button carrying the same summary text.
 * Breakpoint = (width >= 1024px AND pointer: fine): a laptop/monitor is the only
 * place the deep link is broken; phones and tablets (a landscape tablet at
 * 1024px+ still has a coarse pointer) keep working exactly as before.
 * ------------------------------------------------------------------------- */
export const LINE_OA_MENTION = "@789gcnhq";
export const LINE_OA_DEEPLINK_BASE = "https://line.me/R/oaMessage/%40789gcnhq/?text=";
export const LINE_OA_QR_URL = "https://qr-official.line.me/sid/L/789gcnhq.png";
export const LINE_OA_ADD_FRIEND_URL = "https://line.me/R/ti/p/@789gcnhq";
export const LINE_LOGIN_PATH = "/api/auth/line/login";
export const LINE_STATUS_PATH = "/api/auth/line/status";
export const DESKTOP_LINE_BREAKPOINT_PX = 1024;
export const DESKTOP_LINE_MEDIA_QUERY = "(min-width: 1024px) and (pointer: fine)";
export const DESKTOP_LINE_HINT = "บนคอมพิวเตอร์ ให้สแกน QR ด้วยมือถือ LINE หรือคัดลอกข้อความไปส่งในแชท";

export type LineAccount = { userId?: string; displayName?: string | null; pictureUrl?: string | null };
export type LineStatus = { configured: boolean; authenticated: boolean; user?: LineAccount | null };

export function lineContactModeForViewport(width: number, hasFinePointer: boolean): "dialog" | "deeplink" {
  if (!Number.isFinite(width) || width <= 0) return "deeplink";
  return width >= DESKTOP_LINE_BREAKPOINT_PX && hasFinePointer ? "dialog" : "deeplink";
}

export function buildLineDeepLink(message: string): string {
  return `${LINE_OA_DEEPLINK_BASE}${encodeURIComponent(message)}`;
}

export function lineLoginHref(pathWithQuery: string): string {
  const path = pathWithQuery.trim() || "/";
  return `${LINE_LOGIN_PATH}?returnTo=${encodeURIComponent(path)}`;
}

export function lineButtonLabel(authenticated: boolean, isCatalog: boolean): string {
  if (authenticated) return "🟢 ส่งเข้าแชท LINE ของคุณ";
  return isCatalog ? "🟢 ทักคุยผ่าน LINE พร้อมส่งรุ่นนี้ทันที" : "🟢 ทักคุยผ่าน LINE พร้อมส่งรูปนี้ทันที";
}

export function lineIdentityName(status: LineStatus | null): string {
  const user = status?.user;
  if (!status?.authenticated || !user) return "";
  return (user.displayName ?? "").trim() || (user.userId ? `ลูกค้า LINE (${user.userId.slice(-6)})` : "บัญชี LINE ของคุณ");
}

export function shouldOfferLineLogin(status: LineStatus | null): boolean {
  // Never forced: the login affordance only appears when LINE Login is wired up
  // server-side and the visitor is not signed in yet.
  return Boolean(status?.configured) && status?.authenticated !== true;
}

export function PortfolioInquiryModal(props: PortfolioInquiryModalProps) {
  const { onClose } = props;
  const source = props.source ?? "portfolio";
  const isCatalogInquiry = source === "catalog";
  const photo = props.source === "catalog"
    ? {
        id: props.sku ? `catalog:${props.sku}` : "catalog",
        title: props.title ?? "สอบถามราคาอ่างล้างหน้า",
        url: props.imageUrl ?? "",
        categoryName: "แคตตาล็อกอ่างล้างหน้า",
      }
    : props.photo;
  const sku = props.source === "catalog" ? props.sku : undefined;
  const priceTHB = props.source === "catalog" ? props.priceTHB : undefined;
  const displayTitle = props.source === "catalog" ? photo.title : photo.captionTh?.trim() || photo.title;
  const formattedPrice = priceTHB === undefined
    ? ""
    : new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(priceTHB);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const form = useForm<InquiryFormValues>({
    resolver: zodResolver(inquirySchema),
    defaultValues: { phone: "", name: "", notes: props.contextNotes ?? "" },
  });
  // Device + identity state. Defaults are deliberately the *non-desktop* view and
  // "not signed in", so a browser without matchMedia, a blocked /status call or a
  // server without LINE Login configured all keep the deep link + phone paths.
  const [lineStatus, setLineStatus] = useState<LineStatus | null>(null);
  const [desktopMode, setDesktopMode] = useState(false);
  const [linePanelOpen, setLinePanelOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(DESKTOP_LINE_MEDIA_QUERY);
    const apply = () => setDesktopMode(media.matches);
    apply();
    media.addEventListener?.("change", apply);
    return () => media.removeEventListener?.("change", apply);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Optional identity read (cookie-backed server state -- never client-supplied).
    fetch(LINE_STATUS_PATH, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    })
      .then((response) => (response.ok ? (response.json() as Promise<LineStatus>) : null))
      .then((status) => {
        if (!cancelled && status && typeof status.authenticated === "boolean") setLineStatus(status);
      })
      .catch(() => {
        if (!cancelled) setLineStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isSubmitting) return;
      // Escape backs out of the desktop LINE panel before it closes the whole form.
      if (linePanelOpen) { setLinePanelOpen(false); return; }
      onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isSubmitting, linePanelOpen, onClose]);

  const submitInquiry = async (values: InquiryFormValues) => {
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/public/portfolio/inquiry", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId: photo.id,
          photoTitle: photo.title,
          photoUrl: photo.url,
          source: source,
          sku: sku ?? null,
          phone: values.phone,
          name: values.name,
          notes: values.notes,
        }),
      });
      if (response.status !== 200 && response.status !== 201) {
        throw new Error("ส่งข้อมูลไม่สำเร็จ กรุณาลองอีกครั้งหรือติดต่อเราทาง LINE");
      }
      setIsSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "ส่งข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  const lineMessage = isCatalogInquiry
    ? [
        "สวัสดีครับ สนใจขอราคาอ่างล้างหน้า",
        sku ? `รุ่น ${sku}` : "",
        photo.title,
        formattedPrice ? `ราคาแคตตาล็อก ${formattedPrice} บาท` : "",
        photo.url,
      ].filter(Boolean).join("\n")
    : `สวัสดีครับ สนใจสั่งผลิตหรือขอราคาจากผลงาน ${photo.title}\n${photo.url}`;
  const lineHref = buildLineDeepLink(lineMessage);
  const lineName = lineIdentityName(lineStatus);
  const lineLoggedIn = lineStatus?.authenticated === true;
  const loginHref = lineLoginHref(
    typeof window === "undefined" ? "/" : `${window.location.pathname ?? "/"}${window.location.search ?? ""}`,
  );
  const copyLineSummary = async () => {
    // Same text the mobile deep link would have pre-filled, so the two paths
    // cannot drift apart.
    try {
      await navigator.clipboard.writeText(lineMessage);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/65 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <section
        className="relative max-h-[min(92dvh,780px)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portfolio-inquiry-title"
        data-testid="modal-portfolio-inquiry"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-7">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#c48638]">
              {isCatalogInquiry ? "Catalog inquiry" : "Portfolio inquiry"}
            </p>
            <h2 id="portfolio-inquiry-title" className="text-xl font-bold text-[#003366] sm:text-2xl">
              {isCatalogInquiry ? "ให้ทีมโทรกลับ / ขอราคาเร็ว" : "สั่งผลิตแบบนี้ / ขอราคา"}
            </h2>
          </div>
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="ปิดหน้าต่าง"
            data-testid="button-close-portfolio-inquiry"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            {photo.url ? (
              <img
                src={photo.url}
                alt={displayTitle}
                className="h-20 w-24 shrink-0 rounded-lg object-cover sm:h-24 sm:w-32"
                data-testid="img-inquiry-portfolio-photo"
              />
            ) : (
              <div
                role="img"
                aria-label={displayTitle}
                className="grid h-20 w-24 shrink-0 place-items-center rounded-lg bg-[#e8f0f6] text-[#003366] sm:h-24 sm:w-32"
                data-testid="img-inquiry-portfolio-photo"
              >
                <MessageCircle size={24} aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#006b55]">{photo.categoryName}</p>
              <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-900" data-testid="text-inquiry-portfolio-title">
                {displayTitle}
              </p>
              {isCatalogInquiry && (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                  {sku && <p data-testid="text-inquiry-catalog-sku">รุ่น {sku}</p>}
                  {formattedPrice && (
                    <p data-testid="text-inquiry-catalog-price">ราคาแคตตาล็อก {formattedPrice} บาท</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {isSubmitted ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center" role="status" data-testid="status-portfolio-inquiry-success">
              <CheckCircle2 className="mx-auto mb-3 text-emerald-700" size={34} aria-hidden="true" />
              <h3 className="text-lg font-bold text-emerald-950">ได้รับข้อมูลแล้ว</h3>
              <p className="mt-2 text-sm leading-relaxed text-emerald-900">
                ทีมงาน Knight Furnich ได้รับข้อมูลแล้ว จะติดต่อกลับอย่างรวดเร็วที่สุดครับ
              </p>
              <button
                type="button"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#003366] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#002244]"
                onClick={onClose}
                data-testid="button-close-portfolio-inquiry-success"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          ) : (
            <>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(submitInquiry)} className="space-y-4" noValidate>
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="input-inquiry-phone" className="text-sm font-semibold text-slate-800">
                          เบอร์โทรศัพท์ <span className="text-rose-600">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            id="input-inquiry-phone"
                            type="tel"
                            autoComplete="tel"
                            inputMode="tel"
                            placeholder="เช่น 081-xxx-xxxx"
                            required
                            disabled={isSubmitting}
                            data-testid="input-inquiry-phone"
                            className="min-h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="input-inquiry-name" className="text-sm font-semibold text-slate-800">
                          ชื่อเล่น / ชื่อผู้ติดต่อ <span className="font-normal text-slate-500">(ไม่บังคับ)</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            id="input-inquiry-name"
                            autoComplete="name"
                            placeholder="ชื่อที่สะดวกให้เรียก"
                            disabled={isSubmitting}
                            data-testid="input-inquiry-name"
                            className="min-h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="input-inquiry-notes" className="text-sm font-semibold text-slate-800">
                          บันทึกเพิ่มเติม / สถานที่ติดตั้ง <span className="font-normal text-slate-500">(ไม่บังคับ)</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            id="input-inquiry-notes"
                            rows={3}
                            placeholder="เช่น คอนโดสุขุมวิท / ขนาดที่ต้องการ"
                            disabled={isSubmitting}
                            data-testid="input-inquiry-notes"
                            className="resize-y"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {submitError && (
                    <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-800" role="alert" data-testid="status-portfolio-inquiry-error">
                      <CircleAlert className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
                      {submitError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#003366] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#002244] disabled:cursor-wait disabled:opacity-70"
                    disabled={isSubmitting}
                    data-testid="button-submit-inquiry"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin" size={17} aria-hidden="true" />
                        กำลังส่งข้อมูล...
                      </>
                    ) : (
                      "🚀 ส่งข้อมูลให้ทีมประเมินราคา"
                    )}
                  </button>
                </form>
              </Form>

              <div className="relative flex items-center gap-3 text-xs text-slate-400" aria-hidden="true">
                <span className="h-px flex-1 bg-slate-200" />
                หรือสอบถามทาง LINE
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              {lineLoggedIn && (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5" data-testid="row-line-identity">
                  {lineStatus?.user?.pictureUrl ? (
                    <img
                      src={lineStatus.user.pictureUrl}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full bg-white object-cover"
                      data-testid="img-line-avatar"
                    />
                  ) : (
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-200 text-emerald-900" aria-hidden="true">
                      <MessageCircle size={15} />
                    </span>
                  )}
                  <p className="min-w-0 truncate text-xs font-semibold text-emerald-900" data-testid="text-line-display-name">
                    เข้าสู่ระบบด้วย LINE แล้ว: {lineName}
                  </p>
                </div>
              )}

              {!desktopMode && (
                <a
                  href={lineHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#06c755] px-5 py-3 text-sm font-bold text-[#07331b] transition hover:bg-[#08dc60]"
                  data-testid="button-inquiry-line"
                >
                  <MessageCircle size={17} aria-hidden="true" />
                  {lineButtonLabel(lineLoggedIn, isCatalogInquiry)}
                </a>
              )}

              {desktopMode && !linePanelOpen && (
                <button
                  type="button"
                  onClick={() => setLinePanelOpen(true)}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#06c755] px-5 py-3 text-sm font-bold text-[#07331b] transition hover:bg-[#08dc60]"
                  data-testid="button-inquiry-line"
                  data-testid-line-channel="desktop-panel"
                >
                  <MessageCircle size={17} aria-hidden="true" />
                  {lineButtonLabel(lineLoggedIn, isCatalogInquiry)}
                </button>
              )}

              {desktopMode && linePanelOpen && (
                <div
                  role="dialog"
                  aria-modal="false"
                  aria-label="ติดต่อ LINE บนคอมพิวเตอร์"
                  className="rounded-xl border border-[#06c755]/40 bg-[#f2fbf5] p-4"
                  data-testid="dialog-line-desktop"
                >
                  <p className="text-xs leading-relaxed text-slate-700" data-testid="text-line-desktop-hint">
                    {DESKTOP_LINE_HINT}
                  </p>
                  <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
                    <img
                      src={LINE_OA_QR_URL}
                      width={360}
                      height={360}
                      alt="QR code สำหรับเพิ่มเพื่อน LINE Official Account ของ Knight Furnich"
                      loading="lazy"
                      className="h-40 w-40 shrink-0 rounded-lg border border-white bg-white object-contain shadow-sm sm:h-44 sm:w-44"
                      data-testid="img-line-desktop-qr"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <a
                        href={LINE_OA_ADD_FRIEND_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#06c755] px-4 text-sm font-bold text-[#07331b] transition hover:bg-[#08dc60]"
                        data-testid="button-line-add-friend"
                      >
                        เปิดหน้าเพิ่มเพื่อน
                      </a>
                      <button
                        type="button"
                        onClick={copyLineSummary}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#06c755] bg-white px-4 text-sm font-bold text-[#07331b] transition hover:bg-emerald-50"
                        data-testid="button-line-copy-summary"
                      >
                        {copyState === "copied" ? "คัดลอกแล้ว ✓" : copyState === "failed" ? "คัดลอกไม่สำเร็จ — เลือกข้อความแล้วคัดลอกเองได้" : "คัดลอกข้อความสรุป"}
                      </button>
                      {lineLoggedIn && (
                        <a
                          href={lineHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#07331b] px-4 text-sm font-bold text-white transition hover:bg-[#05261a]"
                          data-testid="button-line-send-to-my-chat"
                        >
                          ส่งเข้าแชท LINE ของคุณ
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setLinePanelOpen(false)}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-xs font-semibold text-slate-500 transition hover:text-slate-800"
                        data-testid="button-line-desktop-close"
                      >
                        กลับไปกรอกฟอร์ม
                      </button>
                      <pre
                        className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white/70 p-2 text-[11px] leading-relaxed text-slate-600"
                        data-testid="text-line-summary-preview"
                      >
                        {lineMessage}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {shouldOfferLineLogin(lineStatus) && (
                <p className="text-center text-[11px] text-slate-500" data-testid="row-line-login-offer">
                  <a
                    href={loginHref}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#06c755]/60 bg-white px-3 text-[11px] font-bold text-[#07331b] transition hover:bg-emerald-50"
                    data-testid="button-line-login"
                  >
                    เข้าสู่ระบบด้วย LINE (ไม่บังคับ)
                  </a>
                  <span className="mt-1 block">เพื่อไม่ต้องพิมพ์ชื่อ/เบอร์ซ้ำ — ข้ามได้เสมอ ทุกทางออกยังใช้ได้โดยไม่ล็อกอิน</span>
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default PortfolioInquiryModal;