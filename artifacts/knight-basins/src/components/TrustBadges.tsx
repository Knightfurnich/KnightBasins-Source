import { ShieldCheck, Sparkles, Factory, Ruler } from "lucide-react";

export function TrustBadges() {
  const badges = [
    {
      icon: ShieldCheck,
      title: "รับประกันงานติดตั้ง 1 ปีเต็ม",
      desc: "ดูแลคุณภาพหลังการขายโดยทีมงาน Knight Furnich โดยตรง",
    },
    {
      icon: Sparkles,
      title: "หินสังเคราะห์แท้ ไร้รอยต่อ",
      desc: "กันน้ำ 100% ไม่บวม ไม่ซึมคราบฝังลึก ไม่เป็นแหล่งสะสมเชื้อรา",
    },
    {
      icon: Factory,
      title: "ผลิตจากโรงงานมาตรฐาน",
      desc: "ทีมช่างติดตั้งมืออาชีพ 10 ทีมของบริษัท ไม่ส่งต่อซับคอนแทร็กต์",
    },
    {
      icon: Ruler,
      title: "วัดหน้างานจริงก่อนผลิต",
      desc: "ออกแบบผัง 2 มิติเสมือนจริง เป๊ะตามขนาดพื้นที่ห้องน้ำของคุณ",
    },
  ];

  return (
    <section className="border-y border-[var(--line)] bg-[var(--paper)]/60 py-8 px-4 sm:px-6" aria-label="จุดเด่นและมาตรฐานบริการ">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {badges.map((b, idx) => {
            const Icon = b.icon;
            return (
              <div key={idx} className="flex items-start gap-3.5 p-3.5 border border-[var(--line)]/50 bg-[var(--card-paper)] shadow-xs rounded-none">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-none bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--ink)]">{b.title}</h3>
                  <p className="mt-1 text-xs text-[var(--ink-soft)] leading-relaxed">{b.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
