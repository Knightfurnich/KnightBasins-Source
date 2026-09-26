import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Check, Layers, MessageCircle, Palette, PencilRuler, Ruler, Sparkles } from "lucide-react";
import { knightFurnichLogo } from "@/data/assets";
import { RouteStructuredData } from "@/components/RouteStructuredData";
import { buildStudioGuideStructuredData } from "@/data/structured-data";

const LINE_OA_URL = "https://line.me/R/ti/p/@789gcnhq";
const PHONE_PRIMARY = "094-496-1949";
const PHONE_SECONDARY = "089-762-2209";

/**
 * Customer-facing how-to for the 2D Studio.
 *
 * Written for the person sitting with a customer (sales team) or a homeowner
 * browsing alone — deliberately three steps, one idea per step, no CAD
 * vocabulary. Every claim here matches behaviour that actually ships: the
 * three steps map to the real order of the Studio page (choose color → draw
 * the counter → mark the edges), and the edge finishes listed are exactly the
 * five `SideStatus` values the configurator accepts.
 */

type Step = {
  index: number;
  icon: typeof Palette;
  title: string;
  lead: string;
  points: string[];
  tip?: string;
};

const STEPS: Step[] = [
  {
    index: 1,
    icon: Palette,
    title: "เลือกสีหินก่อน",
    lead: "กดปุ่ม “สีหิน” บนแถบด้านบน แล้วเลือกสีที่ต้องการจากถาดที่เลื่อนลงมา",
    points: [
      "กรองตามเรตราคาได้ทันที: ฿7,500 / ฿8,500 / ฿9,500 ต่อตารางเมตร",
      "พิมพ์ค้นหาได้ทั้งชื่อสีและรหัสสี เช่น “White” หรือ “BW010”",
      "เลือกเสร็จถาดจะพับเก็บเอง และผังบนกระดานจะเปลี่ยนสีตามทันที",
    ],
    tip: "สีที่แสดงทั้งหมดคือสีที่มีในแคตตาล็อกของ ไนท์ เฟอร์นิช เท่านั้น",
  },
  {
    index: 2,
    icon: Ruler,
    title: "เลือกทรงและกรอกขนาดแผ่นจริง",
    lead: "เลือกทรงเคาน์เตอร์ (ทรงตรง I / ฉาก L-ซ้าย / ฉาก L-ขวา / ตัว U) และกรอกขนาดแยกตามจำนวนแผ่นจริง",
    points: [
      "ทรง I มี 1 แผ่น · ทรง L มี 2 แผ่น · ทรง U มี 3 แผ่น",
      "กรอกความยาวและหน้ากว้าง/ความลึก (มม.) แยกอิสระตามขนาดหน้างาน",
      "วางอ่างล้างหน้าลงบนผังได้เลย ระบบเว้นระยะขอบปลอดภัยให้อัตโนมัติ",
    ],
    tip: "ระยะขอบหลุมเจาะปลอดภัยขั้นต่ำ 100 มม. ระบบจะเตือนถ้าวางอ่างชิดขอบเกินไป",
  },
  {
    index: 3,
    icon: PencilRuler,
    title: "ระบุขอบ 4 สถานะ แล้วประกอบผัง",
    lead: "กำหนดสถานะขอบของแต่ละแผ่น (ด้านชนผนัง / ด้านหน้าคนยืน / ด้านข้าง) ให้ตรงตามหน้างานจริง",
    points: [
      "ติดบัว ▲ — ด้านที่ชนผนังปูนและต้องมีบัวกันน้ำ",
      "ชิดผนัง ║ — ด้านที่แนบผนัง แต่ไม่ต้องมีบัว",
      "ขอบเปิด ⊗ — ด้านที่โชว์ลอย ต้องขัดขอบให้เนียน",
      "ขอบปิด ⊞ — ด้านที่โชว์ปิดขอบให้เนียน (บังหน้า/ขอบปิด)",
      "ด้านที่เป็นรอยต่อระหว่างแผ่น ระบบจะล็อกอัตโนมัติ (🔗 รอยต่อชนแผ่น)",
      "เมื่อตั้งค่าครบแล้ว กดปุ่ม [ 🎨 ประกอบผังลงกระดาน ] เพื่อวาดผังและคำนวณราคา",
    ],
    tip: "ระบบจะไม่คำนวณราคาสดระหว่างพิมพ์ขนาด ต้องกดปุ่ม Action ประกอบผังลงกระดานเท่านั้น",
  },
];

const FAQS = [
  {
    q: "เปลี่ยนรูปทรงแล้ว ขอบที่ตั้งไว้จะหายไหม?",
    a: "ไม่หายครับ เมื่อคุณตั้งค่าขอบด้วยตัวเองแล้ว ระบบจะจำค่าไว้และไม่เขียนทับให้ แม้จะสลับรูปทรงระหว่าง ตรง / ฉาก L / ตัว U",
  },
  {
    q: "ราคาที่เห็นบนผังเป็นราคาจริงไหม?",
    a: "เป็นราคาประมาณการที่คำนวณจากพื้นที่จริง บวกค่าบัวและค่าขอบเปิดตามที่ระบุไว้ ยังไม่รวม VAT 7% และยังไม่รวมค่าขนส่งนอกพื้นที่ ให้ทีมขายยืนยันอีกครั้งก่อนออกใบเสนอราคา",
  },
  {
    q: "ต้องเลือกสีหรืออ่างให้ครบไหมก่อนขอใบเสนอราคา?",
    a: "เลือกสีหินก่อนครับ เพราะราคาคิดตามเรตของสีที่เลือก ส่วนอ่างเป็นตัวเลือกเสริม — ถ้ายังไม่แน่ใจ สามารถส่งแบบร่างให้ทีมงานช่วยวางผังให้ได้",
  },
  {
    q: "ส่งแบบให้ช่างได้ไหม?",
    a: "ได้ครับ กด “บันทึกผังเป็นรูปภาพ (PNG)” เพื่อส่งใน LINE หรือดาวน์โหลดเป็นไฟล์ DXF / PDF สำหรับงานผลิตได้เลย",
  },
];

export function StudioGuidePage() {
  const structuredData = buildStudioGuideStructuredData();
  return (
    <div className="studio-guide-page min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <RouteStructuredData id="studio-guide" data={structuredData} />
      <header className="border-b border-[var(--line)] bg-[rgba(255,255,255,0.92)] backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <img className="h-8 w-auto" src={knightFurnichLogo} alt="Knight Furnich" />
        <Link
          href="/studio"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-soft)] hover:text-[#003366]"
          data-testid="link-studio-guide-open-studio"
        >
          เปิด 2D Studio <ArrowRight size={15} />
        </Link>
      </header>

      <main className="max-w-[900px] mx-auto px-6 py-10 space-y-10">
        <section className="space-y-4 text-center" data-testid="section-studio-guide-hero">
          <p className="text-xs font-bold tracking-widest text-[#003366]">LAYOUT STUDIO · วิธีใช้งาน</p>
          <h1 className="font-display text-2xl sm:text-3xl tracking-tight" data-testid="studio-guide-heading">
            ออกแบบเคาน์เตอร์หินสังเคราะห์ด้วยตัวเอง ใน 3 ขั้นตอน
          </h1>
          <p className="text-[var(--ink-soft)] max-w-[640px] mx-auto">
            ไม่ต้องมีพื้นฐานเขียนแบบ ไม่ต้องติดตั้งโปรแกรมอะไร — เปิดหน้าเว็บ เลือกสี วาดขนาด แล้วระบุขอบแต่ละด้าน
            ก็เห็นผังและราคาประมาณการได้ทันที
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/studio">
              <span className="button button--dark inline-flex items-center gap-2" data-testid="button-studio-guide-start">
                <Sparkles size={15} /> เริ่มออกแบบเลย
              </span>
            </Link>
            <a
              href={LINE_OA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="button button--outline inline-flex items-center gap-2"
              data-testid="link-studio-guide-line"
            >
              <MessageCircle size={15} /> ให้ทีมงานช่วยวางผัง
            </a>
          </div>
        </section>

        <section className="space-y-5" data-testid="section-studio-guide-steps">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <article
                key={step.index}
                className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm"
                data-testid={`card-studio-guide-step-${step.index}`}
              >
                <div className="flex items-start gap-4">
                  <span className="shrink-0 grid place-items-center w-11 h-11 rounded-xl bg-[#003366] text-white" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <p className="text-xs font-bold tracking-widest text-[#003366]">ขั้นตอนที่ {step.index}</p>
                      <h2 className="text-lg font-bold text-[#003366]">{step.title}</h2>
                    </div>
                    <p className="text-sm leading-relaxed">{step.lead}</p>
                    <ul className="space-y-1.5">
                      {step.points.map((point) => (
                        <li key={point} className="flex items-start gap-2 text-sm leading-relaxed text-[var(--ink-soft)]">
                          <Check size={15} className="mt-0.5 shrink-0 text-[#0f7a52]" aria-hidden="true" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                    {step.tip && (
                      <p className="text-sm leading-relaxed rounded-lg bg-[#e5f3fa] px-3.5 py-2.5 text-[#1268B3]">
                        💡 {step.tip}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="space-y-4" data-testid="section-studio-guide-edge-legend">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-[#003366]" aria-hidden="true" />
            <h2 className="text-lg font-bold text-[#003366]">ความหมายของป้ายขอบทั้ง 4 สถานะ</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" data-testid="table-studio-guide-edge-legend">
              <thead>
                <tr className="text-left border-b border-[var(--line)]">
                  <th className="py-2 pr-4 font-semibold">ป้ายสถานะขอบ</th>
                  <th className="py-2 pr-4 font-semibold">ความหมายเชิงกายภาพ</th>
                  <th className="py-2 font-semibold">ผลต่อราคาและการผลิต</th>
                </tr>
              </thead>
              <tbody className="text-[var(--ink-soft)]">
                <tr className="border-b border-[var(--line)]/60">
                  <td className="py-2.5 pr-4 font-semibold text-[#8a5a00]">ติดบัว ▲</td>
                  <td className="py-2.5 pr-4">ด้านที่ชนผนังปูน และต้องมีบัวกันน้ำยกขึ้นตามแนวผนัง</td>
                  <td className="py-2.5">คิดค่าบัวตามความยาวของด้านนั้น</td>
                </tr>
                <tr className="border-b border-[var(--line)]/60">
                  <td className="py-2.5 pr-4 font-semibold text-[#1268B3]">ชิดผนัง ║</td>
                  <td className="py-2.5 pr-4">ด้านที่แนบผนัง แต่ไม่ต้องมีบัวกันน้ำ</td>
                  <td className="py-2.5">ไม่คิดเพิ่ม (รวมในเรต ตร.ม. แล้ว)</td>
                </tr>
                <tr className="border-b border-[var(--line)]/60">
                  <td className="py-2.5 pr-4 font-semibold text-[#0f7a52]">ขอบเปิด ⊗</td>
                  <td className="py-2.5 pr-4">ด้านที่โชว์ลอย ไม่มีผนังบัง ต้องขัดขอบให้เนียน</td>
                  <td className="py-2.5">ไม่คิดเพิ่ม (รวมในเรต ตร.ม. แล้ว)</td>
                </tr>
                <tr className="border-b border-[var(--line)]/60">
                  <td className="py-2.5 pr-4 font-semibold text-[#1e40af]">ขอบปิด ⊞</td>
                  <td className="py-2.5 pr-4">ด้านที่โชว์ปิดขอบให้เนียน เช่น งานบังหน้า หรือปิดข้างโชว์</td>
                  <td className="py-2.5">โรงงานปิดขอบเนียนตามแบบ</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-semibold text-[#64748b]">🔗 รอยต่อชนแผ่น</td>
                  <td className="py-2.5 pr-4">ด้านที่แผ่นหินชนกัน (รอยต่อของทรง L หรือ U) ระบบล็อกอัตโนมัติ</td>
                  <td className="py-2.5">ไม่คิดค่าขอบ/บัวซ้ำซ้อน</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3" data-testid="section-studio-guide-faq">
          <h2 className="text-lg font-bold text-[#003366]">คำถามที่พบบ่อย</h2>
          <div className="space-y-2">
            {FAQS.map((faq) => (
              <details key={faq.q} className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold">{faq.q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-[#003366] text-white p-6 space-y-4" data-testid="section-studio-guide-contact">
          <h2 className="text-lg font-bold">ให้ทีมงานช่วยเหลือ</h2>
          <p className="text-sm leading-relaxed text-white/85">
            ถ้าติดตรงไหน หรืออยากให้ทีมงานช่วยวางผังและประเมินราคาให้ ส่งแบบร่างเข้ามาได้เลยครับ
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={LINE_OA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-white text-[#003366] px-4 py-2.5 text-sm font-semibold hover:bg-white/90"
              data-testid="link-studio-guide-contact-line"
            >
              <MessageCircle size={15} /> LINE: @789gcnhq
            </a>
            <a
              href={`tel:${PHONE_PRIMARY.replace(/-/g, "")}`}
              className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
              data-testid="link-studio-guide-contact-phone-primary"
            >
              โทร {PHONE_PRIMARY}
            </a>
            <a
              href={`tel:${PHONE_SECONDARY.replace(/-/g, "")}`}
              className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
              data-testid="link-studio-guide-contact-phone-secondary"
            >
              โทร {PHONE_SECONDARY}
            </a>
          </div>
        </section>

        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-soft)] hover:text-[#003366]"
            data-testid="link-studio-guide-back-home"
          >
            <ArrowLeft size={15} /> กลับสู่หน้าร้าน
          </Link>
        </div>
      </main>
    </div>
  );
}

export default StudioGuidePage;