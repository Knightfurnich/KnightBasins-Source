import { Link } from "wouter";
import { InstallationShowcase } from "@/components/InstallationShowcase";
import {
  ArrowLeft,
  ArrowRight,
  ShoppingBag,
  Ruler,
  PenLine,
  ShieldCheck,
  FileSpreadsheet,
  Truck,
  Sparkles,
  Award,
  Clock,
  Building2,
  Phone,
  MessageSquare,
  Globe,
  MapPin,
  CheckCircle2,
  Layers,
  Wrench,
  Camera,
  BookOpen,
  Images,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { knightFurnichLogo } from "@/data/assets";

export default function SalesGuide() {
  return (
    <div className="sales-guide sales-guide-page min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      {/* Header */}
      <header className="border-b border-[var(--line)] bg-[rgba(255,255,255,0.92)] backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img className="h-8 w-auto" src={knightFurnichLogo} alt="Knight Furnich" />
          <div>
            <strong className="block text-sm tracking-widest leading-none text-[#003366]">KNIGHT BASINS</strong>
            <small className="block text-[var(--ink-soft)] font-mono text-[12px] tracking-widest mt-1">
              คู่มือมาตรฐานระบบบริการและสเปกวัสดุ · SYSTEM & MATERIAL GUIDE
            </small>
          </div>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-soft)] hover:text-[#003366]"
          data-testid="link-guide-back-to-store"
        >
          <ArrowLeft size={15} /> กลับสู่หน้าร้าน
        </Link>
      </header>

      <main className="max-w-[880px] mx-auto px-6 py-10 space-y-10">
        {/* Section 1: Welcome & Brand Authority */}
        <section className="space-y-5">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#003366]/10 text-2xl">
              🏢
            </div>
            <div className="max-[720px]:min-w-0">
              <Badge variant="outline" className="bg-[#003366]/5 text-[#003366] border-[#003366]/30 mb-1 text-[12px] max-[720px]:max-w-full max-[720px]:whitespace-normal">
                บริษัท ไนท์ เฟอร์นิช จำกัด (KNIGHT FURNICH Co., Ltd.)
              </Badge>
              <h1 className="font-bold text-[#003366]" style={{ fontSize: "clamp(26px, calc(20px + 1.5vw), 40px)", lineHeight: 1.15 }}>
                ผู้เชี่ยวชาญอ่างล้างหน้าและเคาน์เตอร์หินสังเคราะห์แท้ ไร้รอยต่อ
              </h1>
            </div>
          </div>
          <p className="text-sm text-[var(--ink-soft)] leading-relaxed">
            ไนท์ เฟอร์นิช (Knight Furnich) มุ่งมั่นยกระดับมาตรฐานพื้นที่ห้องน้ำและงานสถาปัตยกรรมภายใน ด้วยวัสดุหินสังเคราะห์แท้ 
            (100% Acrylic Solid Surface) ที่หล่อเชื่อมชิ้นงานเป็นเนื้อเดียวกันแบบไร้รอยต่อ (Seamless Joint) 
            เราให้บริการแบบครบวงจรตั้งแต่การจำหน่ายอ่างล้างหน้าสำเร็จรูป 30 รุ่นมาตรฐาน, ระบบออกแบบเคาน์เตอร์สั่งตัดเฉพาะพื้นที่ (Custom Countertops), 
            บริการทีมช่างเข้าวัดระยะหน้างานจริง ตลอดจนการผลิตและติดตั้งโดยทีมช่างผู้ชำนาญการของบริษัทโดยตรง
          </p>

          {/* 4 Core Material Advantages */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--card-paper)] p-3.5 space-y-1.5 shadow-sm">
              <Sparkles className="h-5 w-5 text-[#003366]" />
              <strong className="block text-xs font-semibold text-[var(--ink)]">ไร้รอยต่อ 100%</strong>
              <p className="text-[11px] leading-relaxed text-[var(--ink-soft)]">Seamless Joint ผิวเนียนสนิท ผ่านมาตรฐาน UBC CLASS 1 ไม่ลามไฟ</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--card-paper)] p-3.5 space-y-1.5 shadow-sm">
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
              <strong className="block text-xs font-semibold text-[var(--ink)]">กันน้ำ ไม่บวม</strong>
              <p className="text-[11px] leading-relaxed text-[var(--ink-soft)]">เนื้อหินตัน ผ่านมาตรฐาน ASTM G22 ป้องกันน้ำซึมและเชื้อโรค 100%</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--card-paper)] p-3.5 space-y-1.5 shadow-sm">
              <Award className="h-5 w-5 text-amber-700" />
              <strong className="block text-xs font-semibold text-[var(--ink)]">ไร้เชื้อรา ปลอดภัย</strong>
              <p className="text-[11px] leading-relaxed text-[var(--ink-soft)]">ผ่านมาตรฐาน LC 50 ปลอดภัยต่ออาหาร และ NEMA LD3 สีไม่เปลี่ยนแปลง</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--card-paper)] p-3.5 space-y-1.5 shadow-sm">
              <Wrench className="h-5 w-5 text-[#003366]" />
              <strong className="block text-xs font-semibold text-[var(--ink)]">ขัดฟื้นฟูผิวได้</strong>
              <p className="text-[11px] leading-relaxed text-[var(--ink-soft)]">หากเกิดรอยขีดข่วน สามารถขัดลบรอยให้กลับมาเหมือนใหม่ได้ตลอด</p>
            </div>
          </div>
        </section>

        {/* Section 2: 3 Ordering Channels */}
        <section className="space-y-4 pt-2">
          <h2 className="font-semibold text-[#003366] flex items-center gap-2.5" style={{ fontSize: "var(--type-size-heading-lg)", lineHeight: "var(--type-line-heading-lg)" }}>
            <span>🛍️</span> 1. 3 ช่องทางการเลือกชมและสั่งผลิต
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/?mode=quick-purchase" className="group block focus:outline-none" data-testid="link-guide-channel-catalog">
              <Card className="h-full border border-[var(--line)] bg-[var(--card-paper)] shadow-sm transition-all duration-200 hover:border-[#003366] hover:shadow-md hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <ShoppingBag className="text-[#003366] mb-1" size={22} />
                    <span className="text-sm font-medium text-[#003366] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      เข้าชม <ArrowRight size={13} />
                    </span>
                  </div>
                  <CardTitle className="text-base group-hover:text-[#003366] transition-colors">ซื้อด่วนเฉพาะอ่าง</CardTitle>
                  <CardDescription className="text-xs text-[var(--ink-soft)]" data-type="caption">Catalog Quick Order</CardDescription>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed text-[var(--ink-soft)] space-y-3">
                  <p>สำหรับอ่างล้างหน้าสำเร็จรูป 30 รุ่นมาตรฐาน (KF001–KF030) เหมาะสำหรับลูกค้าหรือช่างที่มีเคาน์เตอร์เดิมอยู่แล้วและต้องการสั่งเฉพาะตัวอ่าง</p>
                  <div className="pt-2 text-sm font-semibold text-[#003366] flex items-center gap-1 group-hover:underline">
                    คลิกเพื่อเลือกซื้อ <ArrowRight size={13} />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/studio" className="group block focus:outline-none" data-testid="link-guide-channel-studio">
              <Card className="h-full border border-[var(--line)] bg-[var(--card-paper)] shadow-sm transition-all duration-200 hover:border-[#003366] hover:shadow-md hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Ruler className="text-[#003366] mb-1" size={22} />
                    <span className="text-sm font-medium text-[#003366] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      เข้าใช้ <ArrowRight size={13} />
                    </span>
                  </div>
                  <CardTitle className="text-base group-hover:text-[#003366] transition-colors">ออกแบบใน 2D Studio</CardTitle>
                  <CardDescription className="text-xs text-[var(--ink-soft)]" data-type="caption">Custom Countertop</CardDescription>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed text-[var(--ink-soft)] space-y-3">
                  <p>สำหรับเคาน์เตอร์หินสั่งตัดพร้อมอ่าง ระบุความกว้าง ความยาว รูปทรง (ทรงตรง I, ทรงฉาก L, ทรงตัว U) พร้อมระบบ Live Estimate คำนวณราคาประเมินตาม ตร.ม. ทันที</p>
                  <div className="pt-2 text-sm font-semibold text-[#003366] flex items-center gap-1 group-hover:underline">
                    คลิกเพื่อเริ่มออกแบบ <ArrowRight size={13} />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/sketch" className="group block focus:outline-none" data-testid="link-guide-channel-sketch">
              <Card className="h-full border border-[var(--line)] bg-[var(--card-paper)] shadow-sm transition-all duration-200 hover:border-[#003366] hover:shadow-md hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <PenLine className="text-[#003366] mb-1" size={22} />
                    <span className="text-sm font-medium text-[#003366] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      ส่งแบบ <ArrowRight size={13} />
                    </span>
                  </div>
                  <CardTitle className="text-base group-hover:text-[#003366] transition-colors">ส่งภาพถ่ายหรือแบบร่าง</CardTitle>
                  <CardDescription className="text-xs text-[var(--ink-soft)]" data-type="caption">Custom Sketch</CardDescription>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed text-[var(--ink-soft)] space-y-3">
                  <p>ถ่ายรูปสดจากกล้องหน้างาน หรือแนบภาพสเก็ตช์/แปลนสถาปนิก พร้อมระบบ AI ช่วยอ่านลายมือ ถอดรูปทรงเคาน์เตอร์ และประเมินราคาให้อัตโนมัติ</p>
                  <div className="pt-2 text-sm font-semibold text-[#003366] flex items-center gap-1 group-hover:underline">
                    คลิกเพื่อส่งแบบร่าง <ArrowRight size={13} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        {/* Section 3: Engineering Standards & Site Prep */}
        <section className="space-y-4 pt-2">
          <h2 className="font-semibold text-[#003366] flex items-center gap-2.5" style={{ fontSize: "var(--type-size-heading-lg)", lineHeight: "var(--type-line-heading-lg)" }}>
            <span>📐</span> 2. มาตรฐานวิศวกรรมและการผลิตของโรงงาน
          </h2>
          <div className="p-5 rounded-lg border border-[var(--line)] bg-[var(--card-paper)] space-y-4 text-sm text-[var(--ink-soft)] leading-relaxed shadow-sm">
            <div className="flex gap-3 items-start">
              <CheckCircle2 className="text-[#003366] shrink-0 mt-0.5" size={18} />
              <p>
                <strong className="text-[var(--ink)]">ระยะปลอดภัยขอบเจาะอ่าง (Safety Margin ≥ 100 มม.):</strong> ระบบออกแบบจะช่วยตรวจสอบระยะขอบปลอดภัยอย่างน้อย 100 มม. จากขอบแผ่นหินถึงขอบหลุมเจาะ เพื่อรักษาความแข็งแรงของโครงสร้างหิน ป้องกันการแตกร้าวจากการกดทับและแรงดันน้ำ
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <CheckCircle2 className="text-[#003366] shrink-0 mt-0.5" size={18} />
              <p>
                <strong className="text-[var(--ink)]">การวัดระยะหน้างานจริง (Laser On-Site Survey):</strong> หลังลูกค้ายืนยันคำสั่งซื้อ ทีมช่างจะนัดหมายเข้าวัดระยะหน้างานจริงด้วยเครื่องมือเลเซอร์ เพื่อตรวจสอบฉาก ระดับพื้น ระนาบผนัง และตำแหน่งท่อน้ำก่อนตัดแผ่นหินจริงที่โรงงาน
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <CheckCircle2 className="text-[#003366] shrink-0 mt-0.5" size={18} />
              <p>
                <strong className="text-[var(--ink)]">ความหนาและโครงสร้างมาตรฐาน:</strong> แผ่นหินสังเคราะห์แท้หนา 12 มม. พร้อมเสริมโครงสร้างรับน้ำหนักใต้ท็อปหิน เพื่อรองรับน้ำหนักเคาน์เตอร์และสุขภัณฑ์ได้อย่างมั่นคง
              </p>
            </div>

            {/* Link to Site Prep Guide */}
            <div className="pt-2 border-t border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs text-[var(--ink)] font-medium">
                ต้องการตรวจสอบระยะท่อน้ำและโครงสร้างก่อนช่างเข้าติดตั้ง?
              </span>
              <Link
                href="/site-prep"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#003366] hover:underline"
              >
                <span>📐 เปิดดูคู่มือการเตรียมหน้างานและการติดตั้ง</span> <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </section>

        {/* Section 4: Formal Quotation & Transparent Payment */}
        <section className="space-y-4 pt-2">
          <h2 className="font-semibold text-[#003366] flex items-center gap-2.5" style={{ fontSize: "var(--type-size-heading-lg)", lineHeight: "var(--type-line-heading-lg)" }}>
            <span>📄</span> 3. ขั้นตอนใบเสนอราคาและการชำระเงินที่โปร่งใส
          </h2>
          <div className="p-5 rounded-lg border border-[var(--line)] bg-[var(--card-paper)] space-y-4 text-sm text-[var(--ink-soft)] leading-relaxed shadow-sm">
            <div className="flex gap-3 items-start">
              <FileSpreadsheet className="text-[#003366] shrink-0 mt-0.5" size={18} />
              <p>
                <strong className="text-[var(--ink)]">ใบเสนอราคามาตรฐาน A4 (กำหนดยืนราคา 30 วัน):</strong> เอกสารออกอย่างโปร่งใส ระบุรายการสินค้า ขนาดพื้นที่จริง รหัสสีหินสังเคราะห์ และค่าบริการติดตั้งอย่างชัดเจน พร้อมพิมพ์หรือแชร์ลิงก์ให้ทีมงานและลูกค้าได้ทันที
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <ShieldCheck className="text-emerald-700 shrink-0 mt-0.5" size={18} />
              <div className="space-y-1">
                <strong className="text-[var(--ink)]">เงื่อนไขการชำระเงินตามมาตรฐานบริษัท:</strong>
                <ul className="list-disc list-inside text-xs space-y-1 text-[var(--ink-soft)]">
                  <li>ชำระมัดจำ <strong>50%</strong> เมื่อเซ็นอนุมัติสั่งซื้อ เพื่อเริ่มคิวดราฟต์แบบ ผลิต และนัดหมายเข้าวัดพื้นที่จริง</li>
                  <li>ชำระส่วนที่เหลือ <strong>50%</strong> ก่อนวันเข้าติดตั้งอย่างน้อย 2 วันทำการ</li>
                  <li>กรณียอดสั่งซื้อไม่เกิน 40,000 บาท ชำระ 100% เต็มจำนวน</li>
                  <li>รองรับการออกใบกำกับภาษี (VAT 7%) ถูกต้องตามกฎหมาย</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Delivery, Installation & Warranty */}
        <section className="space-y-4 pt-2">
          <h2 className="font-semibold text-[#003366] flex items-center gap-2.5" style={{ fontSize: "var(--type-size-heading-lg)", lineHeight: "var(--type-line-heading-lg)" }}>
            <span>🚚</span> 4. บริการจัดส่ง ติดตั้ง และการรับประกันคุณภาพ
          </h2>
          <div className="p-5 rounded-lg border border-[var(--line)] bg-[var(--card-paper)] space-y-4 text-sm text-[var(--ink-soft)] leading-relaxed shadow-sm">
            <div className="flex gap-3 items-start">
              <Truck className="text-[#003366] shrink-0 mt-0.5" size={18} />
              <p>
                <strong className="text-[var(--ink)]">ทีมช่างติดตั้งของบริษัทโดยตรง (10 ทีม):</strong> ดำเนินการติดตั้งโดยทีมช่างผู้ชำนาญการของไนท์ เฟอร์นิช ไม่ส่งต่อผู้รับเหมาช่วง (Subcontract) จึงมั่นใจได้ในมาตรฐานการต่อแผ่นไร้รอยต่อและการเก็บงานที่ประณีต
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <Award className="text-amber-700 shrink-0 mt-0.5" size={18} />
              <p>
                <strong className="text-[var(--ink)]">รับประกันงานติดตั้ง 1 ปีเต็ม:</strong> ดูแลความเรียบร้อยของโครงสร้าง รอยต่อ และการยึดเกาะตลอดระยะเวลา 1 ปี พร้อมทีมบริการหลังการขายคอยให้คำปรึกษาตลอดอายุการใช้งาน
              </p>
            </div>
          </div>
        </section>

        {/* Section 5: Real Installation Showcase Marquee */}
        <section className="space-y-4 pt-2" data-testid="guide-section-showcase">
          <InstallationShowcase />
        </section>

        {/* Section 6: Knowledge & Design Hubs */}
        <section className="space-y-4 pt-2">
          <h2 className="font-semibold text-[#003366] flex items-center gap-2.5" style={{ fontSize: "var(--type-size-heading-lg)", lineHeight: "var(--type-line-heading-lg)" }}>
            <span>📚</span> 5. ศูนย์ข้อมูลและการออกแบบเฉพาะทาง
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/portfolio" className="group block focus:outline-none" data-testid="link-guide-hub-portfolio">
              <div className="p-4 rounded-lg border border-[var(--line)] bg-[var(--card-paper)] hover:border-[#003366] hover:shadow-sm transition space-y-2 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[#003366] font-semibold text-sm">
                    <Images size={16} /> คลังผลงานจริง
                  </div>
                  <p className="text-xs text-[var(--ink-soft)] mt-1.5 leading-relaxed">
                    ชมภาพถ่ายงานติดตั้งจริง 180+ ภาพคัดสรร แยกหมวดห้องน้ำ ครัว และเคาน์เตอร์
                  </p>
                </div>
                <span className="text-xs font-bold text-[#003366] flex items-center gap-1 group-hover:underline">
                  เปิดคลังภาพ <ArrowRight size={12} />
                </span>
              </div>
            </Link>
            <Link href="/site-prep" className="group block focus:outline-none" data-testid="link-guide-hub-site-prep">
              <div className="p-4 rounded-lg border border-[var(--line)] bg-[var(--card-paper)] hover:border-[#003366] hover:shadow-sm transition space-y-2 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[#003366] font-semibold text-sm">
                    <Ruler size={16} /> เตรียมหน้างาน
                  </div>
                  <p className="text-xs text-[var(--ink-soft)] mt-1.5 leading-relaxed">
                    สเปกท่อน้ำดี-น้ำทิ้ง ระยะบล็อกปูน และการเตรียมโครงสร้างก่อนติดตั้ง
                  </p>
                </div>
                <span className="text-xs font-bold text-[#003366] flex items-center gap-1 group-hover:underline">
                  เปิดดูคู่มือ <ArrowRight size={12} />
                </span>
              </div>
            </Link>
            <Link href="/studio-guide" className="group block focus:outline-none" data-testid="link-guide-hub-studio-guide">
              <div className="p-4 rounded-lg border border-[var(--line)] bg-[var(--card-paper)] hover:border-[#003366] hover:shadow-sm transition space-y-2 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[#003366] font-semibold text-sm">
                    <BookOpen size={16} /> วิธีใช้ 2D Studio
                  </div>
                  <p className="text-xs text-[var(--ink-soft)] mt-1.5 leading-relaxed">
                    3 ขั้นตอนการออกแบบผังเคาน์เตอร์ เลือกลายหิน และคำนวณราคาด้วยตนเอง
                  </p>
                </div>
                <span className="text-xs font-bold text-[#003366] flex items-center gap-1 group-hover:underline">
                  เปิดดูขั้นตอน <ArrowRight size={12} />
                </span>
              </div>
            </Link>
            <Link href="/updates" className="group block focus:outline-none" data-testid="link-guide-hub-updates">
              <div className="p-4 rounded-lg border border-[var(--line)] bg-[var(--card-paper)] hover:border-[#003366] hover:shadow-sm transition space-y-2 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[#003366] font-semibold text-sm">
                    <Sparkles size={16} /> อัปเดตระบบ
                  </div>
                  <p className="text-xs text-[var(--ink-soft)] mt-1.5 leading-relaxed">
                    ประวัติเวอร์ชันและฟีเจอร์ใหม่ ติดตามความเคลื่อนไหวระบบ Knight Basins
                  </p>
                </div>
                <span className="text-xs font-bold text-[#003366] flex items-center gap-1 group-hover:underline">
                  ดูประวัติรุ่น <ArrowRight size={12} />
                </span>
              </div>
            </Link>
          </div>
        </section>

        {/* Section 6: Official Contact, Factory Location & Maps */}
        <Card className="bg-[#003366] text-white border-0 shadow-lg mt-6 overflow-hidden">
          <CardHeader className="space-y-4 p-6 sm:p-8">
            <div className="flex items-center gap-2.5 text-amber-300">
              <Building2 size={24} className="shrink-0" />
              <CardTitle className="text-lg text-white font-bold">
                บริษัท ไนท์ เฟอร์นิช จำกัด (สำนักงานใหญ่และโรงงานผลิต)
              </CardTitle>
            </div>
            <p className="text-white/90 text-sm leading-relaxed">
              35/170, 35/267 หมู่ที่ 1 ซอยร่วมสุข 8/13 ถนนติวานนท์-แจ้งวัฒนะ ตำบลบ้านใหม่ อำเภอเมืองปทุมธานี จังหวัดปทุมธานี 12000
            </p>

            {/* Google Maps Button */}
            <div>
              <a
                href="https://maps.google.com/?q=13.9575,100.5485"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-amber-400 px-4 py-2.5 text-xs font-bold text-slate-900 shadow transition hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                data-testid="link-google-maps-factory"
              >
                <MapPin size={16} /> นำทาง Google Maps มายังโรงงาน ไนท์ เฟอร์นิช
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-sm text-white/95 border-t border-white/15">
              <div className="flex items-center gap-2">
                <Phone size={15} className="text-amber-300 shrink-0" />
                <span><strong>สายด่วนปรึกษาทีมงาน :</strong> 094-496-1949, 089-762-2209</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare size={15} className="text-amber-300 shrink-0" />
                <span><strong>LINE Official :</strong> @789gcnhq (KnightBot)</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe size={15} className="text-amber-300 shrink-0" />
                <span><strong>เว็บไซต์หลัก :</strong> <a href="https://www.knightfurnich.com" target="_blank" rel="noreferrer" className="underline hover:text-amber-200">www.knightfurnich.com</a></span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-amber-300 shrink-0" />
                <span><strong>เวลาทำการ :</strong> จันทร์ – ศุกร์ 08:30 – 16:30 น. | เสาร์ 08:30 – 11:30 น.</span>
              </div>
            </div>
          </CardHeader>
        </Card>
      </main>
    </div>
  );
}
