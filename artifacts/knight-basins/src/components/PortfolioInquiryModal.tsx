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

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isSubmitting, onClose]);

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
  const lineHref = `https://line.me/R/oaMessage/%40789gcnhq/?text=${encodeURIComponent(lineMessage)}`;

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
              <a
                href={lineHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#06c755] px-5 py-3 text-sm font-bold text-[#07331b] transition hover:bg-[#08dc60]"
                data-testid="button-inquiry-line"
              >
                <MessageCircle size={17} aria-hidden="true" />
                {isCatalogInquiry ? "🟢 ทักคุยผ่าน LINE พร้อมส่งรุ่นนี้ทันที" : "🟢 ทักคุยผ่าน LINE พร้อมส่งรูปนี้ทันที"}
              </a>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default PortfolioInquiryModal;