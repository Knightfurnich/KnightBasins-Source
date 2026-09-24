import { Link } from "wouter";
import {
  ArrowLeft,
  ShoppingBag,
  Ruler,
  PenLine,
  Send,
  Upload,
  ShieldCheck,
  FileSpreadsheet,
  Calendar,
  Sparkles,
  MapPin,
  CheckCircle2,
  Layers,
  Award,
  Clock,
  HelpCircle,
  Bell
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { knightFurnichLogo } from "@/data/assets";

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#003366] text-white text-xs font-semibold">
            {index + 1}
          </span>
          <span className="text-sm leading-relaxed pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  );
}

export default function SalesGuide() {
  return (
    <div className="sales-guide min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[rgba(255,255,255,0.92)] backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img className="h-8 w-auto" src={knightFurnichLogo} alt="Knight Furnich" />
          <div>
            <strong className="block text-sm tracking-widest leading-none text-[#003366]">KNIGHT BASINS PLATFORM</strong>
            <small className="block text-[var(--ink-soft)] font-mono text-[9px] tracking-widest mt-1">คู่มือการใช้งาน & ภาพรวมระบบบริการ · USER MANUAL & SYSTEM GUIDE</small>
          </div>
        </div>
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-soft)] hover:text-[#003366]" data-testid="link-guide-back-to-store">
          <ArrowLeft size={15} /> กลับสู่หน้าร้าน
        </Link>
      </header>

      <main className="max-w-[920px] mx-auto px-6 py-10 space-y-10">
        {/* Title & Introduction */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-[#003366]/5 text-[#003366] border-[#003366]/30">
              Knight Furnich Co., Ltd.
            </Badge>
            <span className="text-xs text-[var(--ink-soft)]">มาตรฐานบริการผลิตและติดตั้งเคาน์เตอร์หินสังเคราะห์</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold font-display tracking-tight text-[#003366]">
            ระบบบริการอ่างล้างหน้า & เคาน์เตอร์หินสังเคราะห์สั่งตัด
          </h1>
          <p className="text-sm md:text-base text-[var(--ink-soft)] mt-3 leading-relaxed">
            ยินดีต้อนรับสู่ระบบบริการออนไลน์ของ <strong>Knight Basins</strong> แพลตฟอร์มที่ออกแบบมาเพื่ออำนวยความสะดวกให้ลูกค้า สถาปนิก อินทีเรียดีไซเนอร์ และผู้รับเหมา 
            สามารถเลือกชมรุ่นอ่าง ออกแบบขนาดเคาน์เตอร์สั่งตัดได้ตามพื้นที่จริง พร้อมประเมินราคาและออกใบเสนอราคาอย่างรวดเร็วและแม่นยำ
          </p>
        </div>

        {/* 4 Service Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border border-[var(--line)] bg-[var(--card-paper)] shadow-sm">
            <CardHeader className="pb-3">
              <ShoppingBag className="text-[#003366]" size={22} />
              <CardTitle className="text-base mt-2">แคตตาล็อกอ่างมาตรฐาน</CardTitle>
              <CardDescription className="text-xs">
                อ่างล้างหน้าสำเร็จรูป 30 รุ่นยอดนิยม ชมภาพมุมมอง 360 องศา
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border border-[var(--line)] bg-[var(--card-paper)] shadow-sm">
            <CardHeader className="pb-3">
              <Ruler className="text-[#003366]" size={22} />
              <CardTitle className="text-base mt-2">2D Studio สั่งตัด</CardTitle>
              <CardDescription className="text-xs">
                กำหนดขนาด ทรงเคาน์เตอร์ และตำแหน่งเจาะอ่างได้ตามพื้นที่หน้างานจริง
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border border-[var(--line)] bg-[var(--card-paper)] shadow-sm">
            <CardHeader className="pb-3">
              <FileSpreadsheet className="text-[#003366]" size={22} />
              <CardTitle className="text-base mt-2">ใบเสนอราคาทางการ</CardTitle>
              <CardDescription className="text-xs">
                ระบบคำนวณราคาโปร่งใส พร้อมพิมพ์เอกสารและแชร์ลิงก์ได้ทันที
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border border-[var(--line)] bg-[var(--card-paper)] shadow-sm">
            <CardHeader className="pb-3">
              <Award className="text-[#003366]" size={22} />
              <CardTitle className="text-base mt-2">มาตรฐานติดตั้งโรงงาน</CardTitle>
              <CardDescription className="text-xs">
                ผลิตด้วยช่างผู้ชำนาญการ พร้อมนัดหมายติดตั้งตามกำหนดเวลา
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Accordion Guide Sections */}
        <Accordion type="multiple" defaultValue={["channels", "studio", "quotation"]} className="space-y-4">
          {/* Section 1: Ordering Channels */}
          <AccordionItem value="channels" className="border border-[var(--line)] rounded-lg px-5 bg-[var(--card-paper)]">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2.5 text-left">
                <ShoppingBag size={18} className="text-[#003366]" /> 
                <span className="font-semibold text-base">1. ช่องทางการเลือกชมสินค้าและสั่งผลิต</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-md border border-[var(--line)] bg-[var(--paper)]">
                  <h4 className="font-semibold text-sm text-[#003366] mb-1.5 flex items-center gap-1.5">
                    <ShoppingBag size={16} /> ซื้อด่วนจากแคตตาล็อก
                  </h4>
                  <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                    เหมาะสำหรับผู้ที่ต้องการอ่างสำเร็จรูปขนาดมาตรฐาน สามารถค้นหารุ่นตามรหัส SKU หรือชื่อโทนสี พร้อมดูภาพตัวอย่างและมุมมอง 360 องศาได้อย่างชัดเจน
                  </p>
                </div>

                <div className="p-4 rounded-md border border-[var(--line)] bg-[var(--paper)]">
                  <h4 className="font-semibold text-sm text-[#003366] mb-1.5 flex items-center gap-1.5">
                    <Ruler size={16} /> ออกแบบใน 2D Studio
                  </h4>
                  <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                    เหมาะสำหรับงานเคาน์เตอร์หินสั่งตัดเฉพาะพื้นที่ ระบุความกว้าง ความยาว รูปทรง (ทรงตรง I, ทรงฉาก L, ทรงตัว U) และเลือกรุ่นอ่างที่ต้องการเจาะติดตั้ง
                  </p>
                </div>

                <div className="p-4 rounded-md border border-[var(--line)] bg-[var(--paper)]">
                  <h4 className="font-semibold text-sm text-[#003366] mb-1.5 flex items-center gap-1.5">
                    <PenLine size={16} /> ส่งแบบร่างหรือภาพหน้างาน
                  </h4>
                  <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                    หากมีแบบแปลนจากสถาปนิก ภาพถ่ายหน้างาน หรือแบบร่างมือ สามารถแนบไฟล์รูปภาพผ่านระบบ เพื่อให้ทีมงานช่วยประเมินขนาดและจัดทำใบเสนอราคาให้โดยตรง
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 2: 2D Studio Guide */}
          <AccordionItem value="studio" className="border border-[var(--line)] rounded-lg px-5 bg-[var(--card-paper)]">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2.5 text-left">
                <Ruler size={18} className="text-[#003366]" /> 
                <span className="font-semibold text-base">2. วิธีใช้งาน 2D Studio สำหรับเคาน์เตอร์สั่งตัด</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-1">
              <StepList
                steps={[
                  "เลือกโทนสีหินสังเคราะห์ที่ต้องการ: สามารถเลือกเปรียบเทียบโทนสีและลวดลายหินสังเคราะห์ตามความชอบ",
                  "กำหนดรูปทรงและขนาด: เลือกรูปทรงเคาน์เตอร์ (I-Shape, L-Shape, U-Shape) พร้อมกรอกขนาดความยาวและความลึกตามพื้นที่จริงของห้องน้ำ",
                  "จัดวางตำแหน่งอ่างล้างหน้า: เลือกรุ่นอ่างและลากวางลงบนตำแหน่งที่ต้องการ ระบบจะช่วยตรวจสอบระยะกึ่งกลางและระยะขอบที่เหมาะสมให้อัตโนมัติ",
                  "ตรวจสอบระยะความปลอดภัยมาตรฐานโรงงาน: ระบบมีเซนเซอร์แจ้งเตือนระยะขอบปลอดภัยไม่น้อยกว่า 100 มม. เพื่อความแข็งแรงทนทานสูงสุดของเนื้อหิน",
                  "ตรวจสอบราคาประมาณการสด (Live Estimate): ระบบประมวลผลราคาหินและงานผลิตให้เห็นทันทีในขณะที่ท่านกำลังปรับแต่งแบบ",
                ]}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Section 3: Quotation & Ordering */}
          <AccordionItem value="quotation" className="border border-[var(--line)] rounded-lg px-5 bg-[var(--card-paper)]">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2.5 text-left">
                <FileSpreadsheet size={18} className="text-[#003366]" /> 
                <span className="font-semibold text-base">3. ขั้นตอนการออกใบเสนอราคาและการสั่งผลิต</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-1">
              <StepList
                steps={[
                  "กรอกข้อมูลสถานที่ติดตั้ง: ระบุชื่อผู้ติดต่อ โครงการ สถานที่ติดตั้ง และเบอร์โทรศัพท์ เพื่อใช้อ้างอิงในเอกสารและการประสานงาน",
                  "เลือกบริการเสริม: สามารถเลือกเพิ่มบริการติดตั้งโดยทีมช่างผู้ชำนาญการ และเลือกรูปแบบภาษีมูลค่าเพิ่ม (VAT 7%) ได้ตามต้องการ",
                  "รับเอกสารใบเสนอราคาทางการ: ระบบสร้างลิงก์ใบเสนอราคามาตรฐาน สามารถดาวน์โหลด สั่งพิมพ์เอกสารขนาด A4 หรือส่งต่อทาง LINE ได้ทันที",
                  "ยืนยันการสั่งผลิต: เมื่อตรวจสอบแบบและรายการเรียบร้อย ชำระเงินมัดจำตามช่องทางที่ระบุในใบเสนอราคาเพื่อเปิดงานเข้าสู่กระบวนการผลิตของโรงงาน",
                ]}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Section 4: Payment Verification */}
          <AccordionItem value="payment" className="border border-[var(--line)] rounded-lg px-5 bg-[var(--card-paper)]">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2.5 text-left">
                <ShieldCheck size={18} className="text-[#17816d]" /> 
                <span className="font-semibold text-base">4. การชำระเงินและตรวจสอบสลิปอัตโนมัติ</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-1 text-sm text-[var(--ink-soft)] leading-relaxed">
              <p>
                เพื่อความถูกต้อง รวดเร็ว และความปลอดภัยสูงสุดของข้อมูลการเงิน ระบบมีระบบตรวจสอบสลิปโอนเงินอัตโนมัติ:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 border rounded-md bg-[var(--paper)]">
                  <div className="flex items-center gap-2 font-medium text-xs text-[#17816d] mb-1">
                    <CheckCircle2 size={16} /> ตรวจสอบผ่าน QR Code ธนาคาร
                  </div>
                  <p className="text-xs">
                    เมื่อแนบหลักฐานการโอนที่มี QR Code ข้อมูลจะได้รับการยืนยันความถูกต้องกับระบบธนาคารแบบเรียลไทม์ ทำให้งานของท่านได้รับการอนุมัติผลิตอย่างรวดเร็ว
                  </p>
                </div>
                <div className="p-3.5 border rounded-md bg-[var(--paper)]">
                  <div className="flex items-center gap-2 font-medium text-xs text-[#003366] mb-1">
                    <ShieldCheck size={16} /> ระบบความปลอดภัยและป้องกันข้อมูลซ้ำ
                  </div>
                  <p className="text-xs">
                    ทุกรายการชำระเงินจะถูกผูกกับใบเสนอราคาเฉพาะของท่านอย่างปลอดภัย เพื่อให้มั่นใจว่าคำสั่งซื้อทุกชุดได้รับการบันทึกและส่งมอบงานอย่างถูกต้อง
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 5: Production & Installation Standards */}
          <AccordionItem value="standards" className="border border-[var(--line)] rounded-lg px-5 bg-[var(--card-paper)]">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2.5 text-left">
                <Sparkles size={18} className="text-[#003366]" /> 
                <span className="font-semibold text-base">5. มาตรฐานการผลิตและการติดตั้งของ Knight</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1 text-sm text-[var(--ink-soft)] leading-relaxed">
              <p>
                ผลิตภัณฑ์ทุกชิ้นของ Knight ผลิตขึ้นตามมาตรฐานวิศวกรรมงานหินสังเคราะห์:
              </p>
              <ul className="space-y-2 list-disc pl-5 text-xs md:text-sm">
                <li><strong>มาตรฐานความหนาและระยะขอบ:</strong> ชิ้นงานถูกควบคุมระยะขอบเจาะอย่างประณีต เพื่อความคงทน ไม่บิดงอ และรองรับน้ำหนักการใช้งานได้อย่างมั่นคง</li>
                <li><strong>ทีมช่างติดตั้งผู้เชี่ยวชาญ:</strong> ทีมงานติดตั้งมีประสบการณ์เฉพาะทาง พร้อมเครื่องมือนำทางและตรวจสอบหน้างาน เพื่อให้งานเสร็จตรงตามกำหนดเวลา</li>
                <li><strong>บริการหลังการขาย:</strong> ให้คำปรึกษาและคำแนะนำในการดูแลรักษาพื้นผิวหินสังเคราะห์ เพื่อคงความสวยงามไร้รอยต่อยาวนานตลอดอายุการใช้งาน</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* Section 6: Automated Notifications (Roadmap / In Development) */}
          <AccordionItem value="notifications" className="border border-[var(--line)] rounded-lg px-5 bg-[var(--card-paper)]">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2.5 text-left">
                <Bell size={18} className="text-[#003366]" /> 
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-base">6. ระบบการแจ้งเตือนสถานะคำสั่งซื้ออัตโนมัติ</span>
                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] py-0 px-2 font-normal">
                    เร็วๆ นี้ · Coming Soon
                  </Badge>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-1 text-sm text-[var(--ink-soft)] leading-relaxed">
              <p>
                เพื่อเพิ่มความสะดวกและโปร่งใสในการติดตามสถานะงาน ระบบกำลังพัฒนาระบบการแจ้งเตือนอัตโนมัติ (Automated Order Notifications) 
                ที่จะช่วยรายงานความคืบหน้าให้แก่ลูกค้าและผู้ประสานงานในทุกขั้นตอนสำคัญ:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 border rounded-md bg-[var(--paper)]">
                  <div className="flex items-center gap-2 font-medium text-xs text-[#003366] mb-1">
                    <CheckCircle2 size={16} className="text-[#17816d]" /> ยืนยันคำสั่งซื้อและการชำระเงิน
                  </div>
                  <p className="text-xs">
                    แจ้งเตือนทันทีเมื่อใบเสนอราคาได้รับการอนุมัติ และสลิปโอนเงินมัดจำผ่านการยืนยัน พร้อมระบุรหัสคำสั่งซื้อสำหรับติดตามงาน
                  </p>
                </div>
                <div className="p-3.5 border rounded-md bg-[var(--paper)]">
                  <div className="flex items-center gap-2 font-medium text-xs text-[#003366] mb-1">
                    <Sparkles size={16} className="text-[#a9791f]" /> อัปเดตความคืบหน้างานผลิต
                  </div>
                  <p className="text-xs">
                    แจ้งสถานะเมื่อเคาน์เตอร์หินสั่งตัดและอ่างเข้าสู่กระบวนการตัด ขึ้นรูป และผ่านการตรวจเช็กคุณภาพมาตรฐานโรงงาน
                  </p>
                </div>
                <div className="p-3.5 border rounded-md bg-[var(--paper)]">
                  <div className="flex items-center gap-2 font-medium text-xs text-[#003366] mb-1">
                    <Calendar size={16} className="text-[#003366]" /> เตือนนัดหมายคิวติดตั้งล่วงหน้า
                  </div>
                  <p className="text-xs">
                    แจ้งเตือนยืนยันวันนัดหมายและช่วงเวลาติดตั้งล่วงหน้า 1–2 วัน พร้อมข้อมูลการเตรียมพื้นที่หน้างาน เพื่อให้การประสานงานราบรื่น
                  </p>
                </div>
                <div className="p-3.5 border rounded-md bg-[var(--paper)]">
                  <div className="flex items-center gap-2 font-medium text-xs text-[#003366] mb-1">
                    <Award size={16} className="text-[#003366]" /> สรุปการส่งมอบและเอกสารรับประกัน
                  </div>
                  <p className="text-xs">
                    ส่งสรุปผลการส่งมอบงานหลังติดตั้งเสร็จสมบูรณ์ พร้อมคู่มือแนะนำการดูแลรักษาพื้นผิวหินสังเคราะห์และการรับประกัน
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* General Knowledge & Help Card */}
        <Card className="bg-[#003366] text-white border-0 shadow-md">
          <CardHeader className="flex-row items-start gap-3.5 space-y-0">
            <HelpCircle size={24} className="shrink-0 text-amber-300 mt-0.5" />
            <div>
              <CardTitle className="text-base text-white">ต้องการคำปรึกษาหรือข้อมูลเพิ่มเติม?</CardTitle>
              <CardDescription className="text-white/80 mt-2 space-y-1 text-xs md:text-sm leading-relaxed">
                <p>หากท่านมีข้อสงสัยเกี่ยวกับการเลือกวัสดุ การวัดระยะหน้างาน หรือต้องการให้ทีมงานเข้าประเมินพื้นที่</p>
                <p>สามารถติดต่อทีมงาน Knight Furnich ผ่านช่องทาง LINE หรือโทรศัพท์ เพื่อรับคำแนะนำจากผู้เชี่ยวชาญได้โดยตรง</p>
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </main>
    </div>
  );
}
