import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check, Link2, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { knightFurnichLogo } from "@/data/assets";

type UpdateToast = (options: { description: string; variant?: "destructive" }) => void;

export const UPDATE_RELEASES = [
  {
    version: "v2.2.0",
    badge: "Sequential Quote Numbers & Support Security — รุ่นล่าสุด",
    date: "3 ตุลาคม 2569",
    dateTime: "2026-10-03",
    title: "Release v2.2.0 — เลขที่ใบเสนอราคา QT-YYYYMM-TYPE-NNNN และการจำกัดความพยายามค้นหาที่ผิดพลาด",
    highlights: [
      {
        icon: "🔢",
        title: "Sequential Quote Number Format",
        description: "ระบบออกเลขใบเสนอราคาบนเซิร์ฟเวอร์เรียงตามเดือนในเวลาไทย แยกประเภท US/OF ในรูปแบบ QT-YYYYMM-TYPE-NNNN เช่น QT-202610-US-0001 และจำกัดความพยายามค้นหาที่ผิดพลาดในหน้าส่งสลิป (Failed-attempt Rate Limiting) 5 ครั้งต่อ IP ใน 10 นาที และ 5 ครั้งที่ผิดต่อเลขหรือเบอร์โทรใน 1 ชั่วโมง พร้อมตรวจอายุ 45 วันและตรวจราคาจริงจากเซิร์ฟเวอร์ก่อนรับสลิป",
      },
    ],
  },
  {
    version: "v2.1.0",
    badge: "Security, Price Guard & Studio Polish",
    date: "3 ตุลาคม 2569",
    dateTime: "2026-10-03",
    title: "Release v2.1.0 — Server Price Guard, สิทธิ์ส่วนลดพนักงาน และการปิดช่องโหว่รอบตรวจความปลอดภัย",
    highlights: [
      {
        icon: "🔒",
        title: "Server Price Guard",
        description: "ระบบคำนวณราคาจริงบนเซิร์ฟเวอร์จากฐานข้อมูลก่อนบันทึกใบเสนอราคาและก่อนออก Dynamic PromptPay QR หากยอดที่ส่งมาไม่ตรงจะถูกปฏิเสธด้วยรหัส PRICE_VERIFICATION_FAILED และบันทึก Audit Log ทันที (ลดความเสี่ยงการดัดแปลงราคาจากฝั่งลูกค้า)",
      },
      {
        icon: "🧾",
        title: "Staff Discount Authorization",
        description: "พนักงานที่มีสิทธิ์ (leads:edit) ให้ส่วนลดพิเศษหรือตั้งราคาขอบเปิดให้ลูกค้ารายบุคคลได้ ผ่านหลังบ้าน พร้อมบันทึกผู้ให้ส่วนลดไว้ใน Audit Log ทุกครั้ง ส่วนลูกค้าทั่วไปยังคงได้ส่วนลด 0 บาทเสมอ",
      },
      {
        icon: "🛡️",
        title: "Rate Limit & LINE Login Hardening",
        description: "ปิดช่องทางข้ามการจำกัดจำนวนครั้งด้วยการสลับ User-Agent และปิดช่องโหว่ Open Redirect ในขั้นตอน LINE Login พร้อมจัดคิวการ deploy อัตโนมัติให้ทำงานทีละงาน",
      },
      {
        icon: "🚫",
        title: "Lead Spam Guard",
        description: "คำขอใบเสนอราคาที่ไม่มีข้อมูลผังเคาน์เตอร์หรือรายการสินค้าจะถูกปฏิเสธก่อนแตะฐานข้อมูล ป้องกันการสร้างรายการขยะและเลขที่ใบเสนอราคาลอย",
      },
      {
        icon: "🧹",
        title: "Studio Draft Protection",
        description: "จำกัดการบันทึกแบบร่างจากหน้า 2D Studio และมีระบบกวาดล้างไฟล์แบบร่างที่หมดอายุเกิน 30 วันโดยอัตโนมัติ",
      },
      {
        icon: "📐",
        title: "Open-Edge Price Fix & Unique Quote Numbers",
        description: "แก้เงื่อนไขตรวจสอบราคาขอบเปิดที่ทำให้กรอกราคาไม่ได้ตั้งแต่ Studio v2 และเพิ่มการตรวจความซ้ำซ้อนของเลขที่ใบเสนอราคา",
      },
    ],
  },
  {
    version: "v2.0.0",
    badge: "Security, Smart Studio & DevOps",
    date: "3 ตุลาคม 2569",
    dateTime: "2026-10-03",
    title: "Release v2.0.0 — 2D Studio Smart Positioning, Asset Optimization และ DevOps Auto-Migration",
    highlights: [
      {
        icon: "📐",
        title: "Smart 7-Level Positioning",
        description: "ปุ่มตำแหน่งอ่าง 7 ระดับรองรับแผ่นขาแนวตั้งของเคาน์เตอร์ทรง L และ U พร้อมรักษาระยะปลอดภัย 100 มม. ทุกด้าน",
      },
      {
        icon: "🖼️",
        title: "Asset WebP Optimization",
        description: "แปลงไฟล์ภาพอ่าง 30 รุ่นเป็น WebP โปร่งใส ขนาดรวมลดลง 88.4% (13.71 MB → 1.60 MB) ลูกค้าโหลดเร็วขึ้นโดยเฉพาะบนมือถือ",
      },
      {
        icon: "🪨",
        title: "Freestanding Pillar Separation",
        description: "แยกเสาวางของตั้งพื้น (KF029/030) ออกจากผังเจาะเคาน์เตอร์ 2D พร้อมป้ายชุดสำเร็จรูป",
      },
      {
        icon: "⏳",
        title: "Quote Link Lifetime Enforcement",
        description: "บังคับใช้อายุลิงก์ใบเสนอราคา 45 วันครบทุกจุด รวมถึงขั้นตอนส่งสลิปและติดตามสถานะงาน",
      },
      {
        icon: "⚙️",
        title: "DevOps CI/CD",
        description: "ระบบ Auto-Migration อัตโนมัติบน VPS ผ่าน GitHub Actions deploy workflow",
      },
      {
        icon: "🚨",
        title: "Proactive Emergency Alert",
        description: "ระบบเฝ้าระวังข้อผิดพลาดสลิปยิงแจ้งเตือนด่วนเข้า Telegram ทันที พร้อม Knight UX Digest ประจำสัปดาห์",
      },
    ],
  },
  {
    version: "v1.2.0",
    badge: "Stone Visual Experience & AI Matcher Suite",
    date: "3 ตุลาคม 2569",
    dateTime: "2026-10-03",
    title: "ระบบภาพหิน 3 บทบาทเต็มรูปแบบ, Studio Slab Viewer และ AI Visual Matcher",
    highlights: [
      {
        icon: "🪨",
        title: "Full Slab & Studio Viewer",
        description: "ปุ่มดูภาพเต็มแผ่นบนหน้าร้าน /stone และปุ่ม “ดูลายแผ่นจริง” ใน 2D Studio (/studio)",
      },
      {
        icon: "🧾",
        title: "Formal Quotation Stone Thumbnails",
        description: "ภาพตัวอย่างหินสังเคราะห์แสดงคู่กับรายการสินค้าในใบเสนอราคาทางการ (PDF/A4) ทั้งแบบ US และ OF",
      },
      {
        icon: "📨",
        title: "Automated Studio Sales Alert",
        description: "แจ้งเตือนงานขายเข้า Telegram อัตโนมัติทันทีที่ยื่นแบบร่างจาก Studio พร้อมแนบลิงก์รูปหินให้ช่างเปิดดูหน้างานได้ทันที",
      },
      {
        icon: "🎨",
        title: "AI Visual Matcher (Gemini)",
        description: "ระบบคลังจับคู่สีหินจากภาพห้องน้ำลูกค้าด้วย Vertex AI Gemini วิเคราะห์เฉพาะหินในแคตตาล็อก",
      },
    ],
  },
  {
    version: "v1.1.0",
    badge: "Logistics & Financial Safety Suite",
    date: "30 กันยายน 2569",
    dateTime: "2026-09-30",
    title: "ระบบพิกัดหน้างานอัจฉริยะ และล็อกความปลอดภัยทางการเงิน",
    highlights: [
      {
        icon: "🧭",
        title: "Google Maps Smart Navigation",
        description: "ถอดรหัสพิกัดหน้างานอัตโนมัติจากทุกลิงก์ Maps พร้อมปุ่มนำทางแตะครั้งเดียวบนมือถือช่าง",
      },
      {
        icon: "👥",
        title: "Smart Duplicate Detection",
        description: "ระบบตรวจจับประวัติลูกค้าและเบอร์โทรซ้ำซ้อนอัตโนมัติ พร้อมแสดงประวัติงานเดิมทันที",
      },
      {
        icon: "📲",
        title: "Technician LINE Job Card",
        description: "ปุ่มสร้างการ์ดงานช่างส่งเข้า LINE คัดลอกสรุปงานพร้อมลิงก์แผนที่นำทางในคลิกเดียว",
      },
      {
        icon: "🔒",
        title: "Financial Safety Lock",
        description: "ถอดแบบกฎเหล็ก KRAKEN ล็อกความปลอดภัยปิดปุ่มลบงานที่มีสลิปการเงินผูกอยู่ 100%",
      },
    ],
  },
  {
    version: "v1.0.0",
    badge: "Official Launch",
    date: "27 ก.ย. 2569",
    dateTime: "2026-09-27",
    title: "ระบบออกแบบเคาน์เตอร์และจัดการภาพหน้างานสมบูรณ์แบบ",
    highlights: [
      {
        icon: "🎨",
        title: "2D Studio & Smart Blueprint",
        description: "ออกแบบทรง I/L/U, เจาะอ่าง 30 รุ่น, หมุนภาพสเก็ตช์ 90° ด้วย Canvas และบันทึกแบบร่างไว้ทำต่อ 30 วัน",
      },
      {
        icon: "🧠",
        title: "Enterprise AI",
        description: "Google Cloud Vertex AI Singapore วิเคราะห์แบบร่างด้วย Latency 0.68 วินาที",
      },
      {
        icon: "📸",
        title: "คลังภาพหน้างาน",
        description: "ค้นหาอัจฉริยะ, กรอง 30 วันและข้ามปี พ.ศ., ดาวน์โหลด ZIP และซ่อนภาพแบบ Soft Hide อย่างปลอดภัย",
      },
      {
        icon: "⚙️",
        title: "หลังบ้านผู้บริหาร",
        description: "แดชบอร์ดสถานะฐานข้อมูลเรียลไทม์, สำรองข้อมูล Backup Vault และสรุปต้นทุน AI 4 เสาหลัก",
      },
    ],
  },
  {
    version: "v0.9.0",
    badge: "Studio & Edge Revolution",
    date: "กลางเดือนกันยายน 2569",
    dateTime: "2026-09",
    title: "ปฏิวัติระบบขอบ 4 สถานะ และคลังภาพผลงานจริง",
    highlights: [
      {
        icon: "📐",
        title: "ขอบเคาน์เตอร์ 4 สถานะ",
        description: "ติดบัว ▲ · ชิดผนัง ║ · ขอบเปิด ⊗ · ขอบปิด ⊞ พร้อมระยะปลอดภัยรอบหลุม ≥ 100 มม.",
      },
      {
        icon: "🖼️",
        title: "Portfolio Gallery",
        description: "คลังภาพผลงานติดตั้งจริง 360 ภาพ แยก 17 หมวดหมู่",
      },
      {
        icon: "📋",
        title: "คู่มือเตรียมหน้างาน",
        description: "เช็คลิสต์ 5 ด้านพร้อมภาพหน้างานจริง 59 ภาพ",
        href: "/site-prep",
      },
    ],
  },
  {
    version: "v0.1.0",
    badge: "Foundation",
    date: "สิงหาคม 2569",
    dateTime: "2026-08",
    title: "กำเนิด Knight Basins Catalog & Pricing Calculator",
    highlights: [
      {
        icon: "💎",
        title: "แคตตาล็อกอ่างล้างหน้าสำเร็จรูป",
        description: "เลือกดูสินค้าได้ครบ 30 รุ่น",
      },
      {
        icon: "🏷️",
        title: "Pricing Calculator",
        description: "สูตรคำนวณราคาหินสังเคราะห์ตามตารางราคาจริง โดยไม่หักช่องเจาะ",
      },
    ],
  },
] as const;

export function buildUpdatesLineShareUrl(pageUrl: string): string {
  return `https://line.me/R/msg/text/?${encodeURIComponent(`Knight Basins — บันทึกการอัปเดตรุ่นระบบ\n${pageUrl}`)}`;
}

export async function copyUpdatesPageLink(
  pageUrl: string,
  writeText: (value: string) => Promise<void>,
  notify: UpdateToast,
): Promise<boolean> {
  try {
    await writeText(pageUrl);
    notify({ description: "คัดลอกลิงก์หน้าบันทึกการอัปเดตแล้ว" });
    return true;
  } catch {
    notify({
      description: "คัดลอกลิงก์หน้าบันทึกการอัปเดตไม่สำเร็จ",
      variant: "destructive",
    });
    return false;
  }
}

export function UpdatesPage() {
  const [linkCopied, setLinkCopied] = useState(false);
  const { toast } = useToast();
  const pageUrl = typeof window === "undefined"
    ? ""
    : `${window.location.origin}${window.location.pathname}`;
  const lineShareUrl = buildUpdatesLineShareUrl(pageUrl);

  const shareOnLine = () => {
    window.open(lineShareUrl, "_blank", "noopener,noreferrer");
    toast({ description: "เปิดหน้าส่งข้อความใน LINE แล้ว" });
  };

  const copyPageLink = async () => {
    const copied = await copyUpdatesPageLink(
      pageUrl,
      (value) => navigator.clipboard.writeText(value),
      toast,
    );
    if (!copied) return;
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div
      className="min-h-screen bg-[var(--paper)] text-[var(--ink)]"
      data-testid="page-updates"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-[rgba(255,255,255,0.92)] px-4 py-4 backdrop-blur-md dark:bg-[rgba(18,24,32,0.92)] sm:px-6">
        <img className="h-8 w-auto" src={knightFurnichLogo} alt="Knight Furnich" />
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
          data-testid="link-updates-back-to-store"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          กลับสู่หน้าร้าน
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-blue)]">
            <Sparkles size={14} aria-hidden="true" />
            What’s new at Knight Basins
          </p>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl" data-testid="heading-updates">
            บันทึกการอัปเดต
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--ink-soft)] sm:text-base">
            จากแคตตาล็อกและเครื่องคำนวณราคา สู่ระบบออกแบบเคาน์เตอร์และจัดการงานหน้างานครบวงจร
            นี่คือหมุดหมายสำคัญของ Knight Basins
          </p>
        </section>

        <section className="mb-10 flex flex-wrap justify-center gap-3" aria-label="แชร์หน้าบันทึกการอัปเดต">
          <Button
            type="button"
            variant="outline"
            className="rounded-none border-[var(--line)]"
            onClick={shareOnLine}
            data-testid="button-share-updates-line"
          >
            <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            แชร์หน้านี้ลง LINE
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-none border-[var(--line)]"
            onClick={() => void copyPageLink()}
            data-testid="button-copy-updates-link"
          >
            {linkCopied
              ? <Check className="mr-2 h-4 w-4" aria-hidden="true" />
              : <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />}
            {linkCopied ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์"}
          </Button>
        </section>

        <ol className="space-y-6" aria-label="ไทม์ไลน์อัปเดตรุ่นระบบ">
          {UPDATE_RELEASES.map((release, releaseIndex) => (
            <li
              key={release.version}
              className="relative border-l border-[var(--line)] pb-1 pl-7 last:border-l-transparent sm:pl-10"
              data-testid={`card-update-${release.version}`}
            >
              <span
                className={`absolute -left-[9px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                  releaseIndex === 0
                    ? "border-[var(--brand-blue)] bg-[var(--brand-blue)]"
                    : "border-[var(--line)] bg-[var(--paper)]"
                }`}
                aria-hidden="true"
              >
                {releaseIndex === 0 && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <article className="rounded-xl border border-[var(--line)] bg-white/75 p-5 shadow-sm dark:bg-white/[0.04] sm:p-7">
                <header className="mb-5 flex flex-col gap-3 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
                      <time dateTime={release.dateTime}>{release.date}</time>
                    </p>
                    <h2 className="mt-2 font-display text-xl leading-snug sm:text-2xl">
                      {release.title}
                    </h2>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--brand-blue)] px-3 py-1 text-sm font-semibold text-white">
                      {release.version}
                    </span>
                    <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-medium text-[var(--ink-soft)]">
                      {release.badge}
                    </span>
                  </div>
                </header>
                <ul className="space-y-4">
                  {release.highlights.map((highlight, highlightIndex) => (
                    <li
                      key={`${release.version}-${highlight.title}`}
                      className="flex gap-3 text-sm leading-6 text-[var(--ink-soft)] sm:text-base"
                      data-testid={`item-update-${releaseIndex}-${highlightIndex}`}
                    >
                      <span className="mt-0.5 shrink-0 text-lg" aria-hidden="true">{highlight.icon}</span>
                      <p>
                        <strong className="font-semibold text-[var(--ink)]">{highlight.title}</strong>
                        {" — "}
                        {highlight.description}
                        {"href" in highlight && (
                          <>
                            {" "}
                            <Link className="font-medium text-[var(--brand-blue)] underline underline-offset-4" href={highlight.href}>
                              เปิดคู่มือ
                            </Link>
                          </>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}

export default UpdatesPage;