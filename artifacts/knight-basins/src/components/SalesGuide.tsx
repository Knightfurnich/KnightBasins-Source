import { Link } from "wouter";
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
  Bell,
  CheckCircle2,
  Calendar,
  Award,
  HelpCircle,
  Clock,
  Building2,
  Phone,
  MessageSquare,
  Globe
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { knightFurnichLogo } from "@/data/assets";

export default function SalesGuide() {
  return (
    <div className="sales-guide min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      {/* Header */}
      <header className="border-b border-[var(--line)] bg-[rgba(255,255,255,0.92)] backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img className="h-8 w-auto" src={knightFurnichLogo} alt="Knight Furnich" />
          <div>
            <strong className="block text-sm tracking-widest leading-none text-[#003366]">KNIGHT BASINS</strong>
            <small className="block text-[var(--ink-soft)] font-mono text-[9px] tracking-widest mt-1">
              คู่มือการใช้งาน & ข้อมูลระบบบริการ · SYSTEM GUIDE
            </small>
          </div>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-soft)] hover:text-[#003366]"
          data-testid="link-guide-back-to-store"
        >
          <ArrowLeft size={15} /> กลับสู่หน้าร้าน
        </Link>
      </header>

      <main className="max-w-[880px] mx-auto px-6 py-10 space-y-8">
        {/* Section 1: Welcome & Overview */}
        <section className="space-y-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#003366]/10 text-2xl">
              🏢
            </div>
            <div>
              <Badge variant="outline" className="bg-[#003366]/5 text-[#003366] border-[#003366]/30 mb-1 text-[11px]">
                Knight Furnich Co., Ltd.
              </Badge>
              <h1 className="text-lg md:text-xl font-bold text-[#003366] leading-snug">
                ยินดีต้อนรับสู่ระบบบริการการขายอ่างล้างหน้า ล้างมืออัตโนมัติ โดย ไนท์ เฟอร์นิช
              </h1>
            </div>
          </div>
          <p className="text-sm text-[var(--ink-soft)] leading-relaxed">
            แพลตฟอร์มศูนย์รวมบริการอ่างล้างหน้าและเคาน์เตอร์หินสังเคราะห์แบบครบวงจร พัฒนาขึ้นเพื่ออำนวยความสะดวกให้แก่ลูกค้าทั่วไป 
            สถาปนิก อินทีเรียดีไซเนอร์ และผู้รับเหมา สามารถเลือกชมรุ่นอ่าง ออกแบบขนาดเคาน์เตอร์สั่งตัดตามพื้นที่จริง 
            พร้อมขอรับใบเสนอราคาได้อย่างสะดวกรวดเร็ว
          </p>
        </section>

        {/* Section 1: 3 Ordering Channels */}
        <section className="space-y-4 pt-2">
          <h2 className="text-xl md:text-2xl font-semibold text-[#003366] flex items-center gap-2.5">
            <span>🛍️</span> 1. 3 ช่องทางการเลือกชมและสั่งผลิต
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/?mode=quick-purchase" className="group block focus:outline-none" data-testid="link-guide-channel-catalog">
              <Card className="h-full border border-[var(--line)] bg-[var(--card-paper)] shadow-sm transition-all duration-200 hover:border-[#003366] hover:shadow-md hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <ShoppingBag className="text-[#003366] mb-1" size={22} />
                    <span className="text-xs font-medium text-[#003366] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      เข้าชม <ArrowRight size={13} />
                    </span>
                  </div>
                  <CardTitle className="text-base group-hover:text-[#003366] transition-colors">ซื้อด่วนจากแคตตาล็อก</CardTitle>
                  <CardDescription className="text-xs text-[var(--ink-soft)]">Catalog Quick Order</CardDescription>
                </CardHeader>
                <CardContent className="text-xs leading-relaxed text-[var(--ink-soft)] space-y-3">
                  <p>สำหรับอ่างล้างหน้าสำเร็จรูป 30 รุ่นมาตรฐาน พร้อมภาพตัวอย่างและมุมมอง 360 องศา</p>
                  <div className="pt-2 text-xs font-semibold text-[#003366] flex items-center gap-1 group-hover:underline">
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
                    <span className="text-xs font-medium text-[#003366] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      เข้าใช้ <ArrowRight size={13} />
                    </span>
                  </div>
                  <CardTitle className="text-base group-hover:text-[#003366] transition-colors">ออกแบบใน 2D Studio</CardTitle>
                  <CardDescription className="text-xs text-[var(--ink-soft)]">Custom Countertop</CardDescription>
                </CardHeader>
                <CardContent className="text-xs leading-relaxed text-[var(--ink-soft)] space-y-3">
                  <p>สำหรับงานเคาน์เตอร์หินสั่งตัดเฉพาะพื้นที่ ระบุความกว้าง ความยาว รูปทรง (ทรงตรง I, ทรงฉาก L, ทรงตัว U) และเลือกตำแหน่งเจาะอ่างล้างหน้า พร้อมระบบ Live Estimate คำนวณราคาประเมินทันที</p>
                  <div className="pt-2 text-xs font-semibold text-[#003366] flex items-center gap-1 group-hover:underline">
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
                    <span className="text-xs font-medium text-[#003366] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      ส่งแบบ <ArrowRight size={13} />
                    </span>
                  </div>
                  <CardTitle className="text-base group-hover:text-[#003366] transition-colors">ส่งภาพถ่ายหรือแบบร่าง</CardTitle>
                  <CardDescription className="text-xs text-[var(--ink-soft)]">Custom Sketch</CardDescription>
                </CardHeader>
                <CardContent className="text-xs leading-relaxed text-[var(--ink-soft)] space-y-3">
                  <p>แนบไฟล์ภาพแปลนจากสถาปนิกหรือแบบวาดมือ เพื่อให้ทีมงานช่วยประเมินราคาและสเปกงานให้โดยตรง</p>
                  <div className="pt-2 text-xs font-semibold text-[#003366] flex items-center gap-1 group-hover:underline">
                    คลิกเพื่อส่งแบบร่าง <ArrowRight size={13} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        {/* Section 2: Engineering Standards */}
        <section className="space-y-3 pt-2">
          <h2 className="text-xl md:text-2xl font-semibold text-[#003366] flex items-center gap-2.5">
            <span>📐</span> 2. มาตรฐานวิศวกรรมและการผลิตของโรงงาน
          </h2>
          <div className="p-5 rounded-lg border border-[var(--line)] bg-[var(--card-paper)] space-y-3 text-sm text-[var(--ink-soft)] leading-relaxed">
            <div className="flex gap-3 items-start">
              <span className="font-semibold text-[#003366] shrink-0">•</span>
              <p>
                <strong className="text-[var(--ink)]">ระยะปลอดภัยขอบเจาะอ่าง (Safety Margin):</strong> ระบบออกแบบจะช่วยตรวจสอบระยะขอบปลอดภัยอย่างน้อย 100 มม. จากขอบแผ่นหิน เพื่อความแข็งแรงทนทาน ป้องกันการแตกร้าวจากการใช้งาน
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="font-semibold text-[#003366] shrink-0">•</span>
              <p>
                <strong className="text-[var(--ink)]">การสั่งผลิตตามแบบจริง:</strong> รองรับงานสั่งตัดเคาน์เตอร์หินสังเคราะห์ไร้รอยต่อตามขนาดหน้างานจริง
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: Formal Quotation & Payment */}
        <section className="space-y-3 pt-2">
          <h2 className="text-xl md:text-2xl font-semibold text-[#003366] flex items-center gap-2.5">
            <span>📄</span> 3. ใบเสนอราคาทางการและการยืนยันคำสั่งซื้อ
          </h2>
          <div className="p-5 rounded-lg border border-[var(--line)] bg-[var(--card-paper)] space-y-3 text-sm text-[var(--ink-soft)] leading-relaxed">
            <div className="flex gap-3 items-start">
              <FileSpreadsheet className="text-[#003366] shrink-0 mt-0.5" size={18} />
              <p>
                <strong className="text-[var(--ink)]">ใบเสนอราคามาตรฐาน A4:</strong> ออกเอกสารชัดเจน ระบุรายการสินค้า ขนาด และราคาอย่างโปร่งใส พร้อมสั่งพิมพ์หรือแชร์ลิงก์ได้ทันที
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <ShieldCheck className="text-[#17816d] shrink-0 mt-0.5" size={18} />
              <p>
                <strong className="text-[var(--ink)]">ระบบยืนยันการชำระเงิน:</strong> รองรับการตรวจสอบหลักฐานการโอนเงินผ่านระบบตรวจสอบอัตโนมัติ เพื่อความถูกต้อง รวดเร็ว และความปลอดภัยของข้อมูล
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Dispatch & After-Sales Service */}
        <section className="space-y-3 pt-2">
          <h2 className="text-xl md:text-2xl font-semibold text-[#003366] flex items-center gap-2.5">
            <span>🚚</span> 4. การนัดหมายติดตั้งและบริการหลังการขาย
          </h2>
          <div className="p-5 rounded-lg border border-[var(--line)] bg-[var(--card-paper)] space-y-3 text-sm text-[var(--ink-soft)] leading-relaxed">
            <div className="flex gap-3 items-start">
              <Truck className="text-[#003366] shrink-0 mt-0.5" size={18} />
              <p>
                <strong className="text-[var(--ink)]">ทีมติดตั้งมาตรฐานโรงงาน:</strong> ดำเนินการติดตั้งโดยทีมงานผู้ชำนาญการตามวันนัดหมาย
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <Award className="text-[#003366] shrink-0 mt-0.5" size={18} />
              <p>
                <strong className="text-[var(--ink)]">บริการให้คำปรึกษา:</strong> ให้คำแนะนำการดูแลรักษาพื้นผิวหินสังเคราะห์เพื่อให้คงความสวยงามตลอดอายุการใช้งาน
              </p>
            </div>
          </div>
        </section>

        {/* Section 5: Notifications (Roadmap) */}
        <section className="space-y-3 pt-2">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl md:text-2xl font-semibold text-[#003366] flex items-center gap-2.5">
              <span>🔔</span> 5. ระบบการแจ้งเตือนสถานะคำสั่งซื้ออัตโนมัติ
            </h2>
            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[11px] py-0.5 font-normal">
              อยู่ระหว่างการพัฒนา · Coming Soon
            </Badge>
          </div>
          <div className="p-5 rounded-lg border border-[var(--line)] bg-[var(--card-paper)] space-y-3 text-sm text-[var(--ink-soft)] leading-relaxed">
            <p>
              เพื่อเพิ่มความสะดวกและโปร่งใสในการติดตามสถานะงาน ระบบกำลังพัฒนาระบบการแจ้งเตือนอัตโนมัติในทุกขั้นตอนสำคัญ:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 border rounded bg-[var(--paper)]">
                <strong className="text-xs text-[#003366] block mb-1">✓ แจ้งเตือนยืนยันคำสั่งซื้อ</strong>
                <p className="text-xs">ส่งข้อความยืนยันเมื่อใบเสนอราคาและการชำระเงินมัดจำได้รับการตรวจสอบเรียบร้อย</p>
              </div>
              <div className="p-3 border rounded bg-[var(--paper)]">
                <strong className="text-xs text-[#003366] block mb-1">✓ อัปเดตสถานะงานผลิต</strong>
                <p className="text-xs">แจ้งความคืบหน้าเมื่อเคาน์เตอร์และอ่างเข้าสู่กระบวนการผลิตและการตรวจเช็กคุณภาพ</p>
              </div>
              <div className="p-3 border rounded bg-[var(--paper)]">
                <strong className="text-xs text-[#003366] block mb-1">✓ เตือนนัดหมายคิวติดตั้ง</strong>
                <p className="text-xs">แจ้งเตือนยืนยันวันนัดหมายและช่วงเวลาเข้าหน้างานล่วงหน้า 1–2 วัน</p>
              </div>
              <div className="p-3 border rounded bg-[var(--paper)]">
                <strong className="text-xs text-[#003366] block mb-1">✓ สรุปการส่งมอบและเอกสารรับประกัน</strong>
                <p className="text-xs">ส่งสรุปการตรวจรับงานพร้อมคำแนะนำการดูแลรักษาหลังติดตั้งเสร็จสมบูรณ์</p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Footer */}
        <Card className="bg-[#003366] text-white border-0 shadow-md mt-6">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-2 text-amber-300">
              <Building2 size={22} className="shrink-0" />
              <CardTitle className="text-base sm:text-lg text-white font-semibold">
                บริษัท ไนท์ เฟอร์นิช จำกัด (สำนักงานใหญ่และโรงงานผลิต)
              </CardTitle>
            </div>
            <p className="text-white/90 text-xs sm:text-sm leading-relaxed">
              35/170, 35/267 หมู่ที่ 1 ซอยร่วมสุข 8/13 ถนนติวานนท์-แจ้งวัฒนะ ตำบลบ้านใหม่ อำเภอเมืองปทุมธานี จังหวัดปทุมธานี 12000
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs sm:text-sm text-white/95">
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
                <span><strong>เวลาทำการ :</strong> จันทร์ – ศุกร์ 08:30 – 16:30 น. | เสาร์ 08:30 – 11:30 น. (หยุดวันอาทิตย์)</span>
              </div>
            </div>
          </CardHeader>
        </Card>
      </main>
    </div>
  );
}
