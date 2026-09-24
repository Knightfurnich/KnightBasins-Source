import { Link } from "wouter";
import {
  ArrowLeft,
  ShoppingBag,
  Ruler,
  PenLine,
  User,
  Send,
  Lightbulb,
  Upload,
  LayoutDashboard,
  Truck,
  ShieldCheck,
  FileSpreadsheet,
  Calendar,
  Sparkles,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Flame,
  MessageSquare
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
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--paper)] text-xs font-semibold">
            {index + 1}
          </span>
          <span className="text-sm leading-relaxed pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function FieldTable({ rows }: { rows: Array<[string, string, boolean]> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[var(--line)] text-left text-[var(--ink-soft)] text-xs uppercase tracking-wide">
            <th className="py-2 pr-4">ช่องข้อมูล</th>
            <th className="py-2">คำอธิบาย / วิธีกรอก</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([field, description, required]) => (
            <tr key={field} className="border-b border-[var(--line)]/60">
              <td className="py-2.5 pr-4 font-medium whitespace-nowrap align-top">
                {field}
                {required && <span className="text-[#a24439] ml-1">*</span>}
              </td>
              <td className="py-2.5 text-[var(--ink-soft)] align-top">{description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SalesGuide() {
  return (
    <div className="sales-guide min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[rgba(255,255,255,0.92)] backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img className="h-8 w-auto" src={knightFurnichLogo} alt="Knight Furnich" />
          <div>
            <strong className="block text-sm tracking-widest leading-none">KNIGHT BASINS PLATFORM</strong>
            <small className="block text-[var(--ink-soft)] font-mono text-[8px] tracking-widest mt-1">ภาพรวมระบบ & คู่มือการปฏิบัติงาน · SYSTEM OVERVIEW & USER MANUAL</small>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--brand-blue,#2a9bd0)] hover:underline">
            <LayoutDashboard size={14} /> ห้องบัญชาการ Admin
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]" data-testid="link-guide-back-to-store">
            <ArrowLeft size={14} /> กลับไปหน้าร้าน
          </Link>
        </div>
      </header>

      <main className="max-w-[960px] mx-auto px-6 py-10 space-y-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-[#003366]/5 text-[#003366] border-[#003366]/30">
              Enterprise Version 2026
            </Badge>
            <span className="text-xs text-[var(--ink-soft)] font-mono">อัปเดตล่าสุด: กันยายน 2569 (ICT GMT+7)</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold font-display tracking-tight text-[#003366]">
            ระบบศูนย์รวมบริหารจัดการ Knight Basins & เคาน์เตอร์หินสั่งตัด
          </h1>
          <p className="text-sm md:text-base text-[var(--ink-soft)] mt-3 leading-relaxed">
            คู่มือและภาพรวมการทำงานของระบบ Knight Basins ครบวงจร ตั้งแต่ขั้นตอนการเลือกรุ่นอ่าง ออกแบบเคาน์เตอร์หินสั่งตัด 
            การออกใบเสนอราคาทางการ การตรวจสอบเงินมัดจำ จนถึงการออกใบสั่งผลิตโรงงาน และเรดาร์คุมคิวช่าง 10 ทีมของผู้บริหาร
          </p>
        </div>

        {/* Executive 4 Core Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border border-[var(--line)] bg-[var(--card-paper)] shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <ShoppingBag className="text-[#003366]" size={24} />
              <CardTitle className="text-base mt-2">1. เลือกรุ่น & สั่งตัด</CardTitle>
              <CardDescription className="text-xs">
                อ่าง 30 รุ่น 3D 360° พร้อมระบบ 2D Studio คุมระยะปลอดภัย 100 มม.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border border-[var(--line)] bg-[var(--card-paper)] shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <FileSpreadsheet className="text-[#003366]" size={24} />
              <CardTitle className="text-base mt-2">2. เสนอราคา & สั่งผลิต</CardTitle>
              <CardDescription className="text-xs">
                ใบเสนอราคาทางการ A4 พร้อมใบสั่งผลิตโรงงาน (Workshop Sheet) แม่นยำ
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border border-[var(--line)] bg-[var(--card-paper)] shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <ShieldCheck className="text-[#17816d]" size={24} />
              <CardTitle className="text-base mt-2">3. ตรวจเงินมัดจำ</CardTitle>
              <CardDescription className="text-xs">
                SlipOK ตรวจ QR Code ธนาคารจริงทันที + ดึงสลิปจาก LINE ไร้รอยต่อ
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border border-[var(--line)] bg-[var(--card-paper)] shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <LayoutDashboard className="text-[#2a9bd0]" size={24} />
              <CardTitle className="text-base mt-2">4. Cockpit & คิวช่าง</CardTitle>
              <CardDescription className="text-xs">
                สรุปไตรมาส พยากรณ์เงินสด เรดาร์ 10 ทีมช่าง และส่งสรุป LINE ผู้บริหาร
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Detailed Accordion */}
        <Accordion type="multiple" defaultValue={["channels", "cockpit", "dispatch"]} className="space-y-4">
          {/* Section 1: Ordering Channels */}
          <AccordionItem value="channels" className="border border-[var(--line)] rounded-lg px-5 bg-[var(--card-paper)]">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2.5 text-left">
                <ShoppingBag size={18} className="text-[#003366]" /> 
                <span className="font-semibold text-base">1. 3 ช่องทางสั่งสินค้าและขอใบเสนอราคา</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-5 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-md border border-[var(--line)] bg-[var(--paper)]">
                  <span className="font-semibold text-sm flex items-center gap-1.5 mb-1 text-[#003366]">
                    <ShoppingBag size={15} /> ซื้อด่วนจากแคตตาล็อก
                  </span>
                  <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                    เหมาะสำหรับลูกค้าที่ต้องการอ่างสำเร็จรูปรุ่นมาตรฐาน (KF001 - KF030) เลือกรุ่น สี ดูโมเดล 3D 360° แล้วกดขอใบเสนอราคาได้ทันที
                  </p>
                </div>
                <div className="p-3.5 rounded-md border border-[var(--line)] bg-[var(--paper)]">
                  <span className="font-semibold text-sm flex items-center gap-1.5 mb-1 text-[#003366]">
                    <Ruler size={15} /> ออกแบบใน 2D Studio
                  </span>
                  <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                    สำหรับเคาน์เตอร์หินสังเคราะห์สั่งตัด ทรงตรง (I), ทรงฉาก (L) และทรงตัวยู (U) มีระบบ Shape Wizard ตรวจจับระยะขอบหลุมเจาะปลอดภัย 100 มม.
                  </p>
                </div>
                <div className="p-3.5 rounded-md border border-[var(--line)] bg-[var(--paper)]">
                  <span className="font-semibold text-sm flex items-center gap-1.5 mb-1 text-[#003366]">
                    <PenLine size={15} /> ส่งภาพถ่าย / แบบร่างมือ
                  </span>
                  <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                    ลูกค้าที่มีแบบวาดมือหรือภาพถ่ายหน้างานจริง สามารถแนบภาพได้สูงสุด 5 ภาพ เพื่อให้ทีมขายและช่างประเมินราคาให้โดยตรง
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 2: Executive Cockpit */}
          <AccordionItem value="cockpit" className="border border-[var(--line)] rounded-lg px-5 bg-[var(--card-paper)]">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2.5 text-left">
                <LayoutDashboard size={18} className="text-[#003366]" /> 
                <span className="font-semibold text-base">2. ห้องบัญชาการผู้บริหาร (Executive Cockpit)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-1">
              <p className="text-sm text-[var(--ink-soft)] leading-relaxed">
                หน้าแรกของระบบ Admin (<Link href="/admin" className="underline font-medium text-[#003366]">/admin</Link>) 
                ได้รับการอัปเกรดเป็นห้องบัญชาการอัจฉริยะที่สรุปข้อมูลสำคัญให้ผู้บริหารตัดสินใจได้ในหน้าเดียว:
              </p>
              <div className="space-y-3">
                <div className="flex gap-3 items-start">
                  <Badge className="bg-[#003366] text-white shrink-0 mt-0.5">ตัวกรองช่วงเวลา</Badge>
                  <p className="text-sm text-[var(--ink-soft)]">
                    สลับดูตัวเลขได้ 5 ช่วงเวลา: <strong>7 วัน, 30 วัน, ราย 3 เดือน (ไตรมาส), ทั้งปี (1 ม.ค.–31 ธ.ค.), และทั้งหมด</strong>
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <Badge className="bg-[#003366] text-white shrink-0 mt-0.5">สรุป 3 เดือนล่าสุด</Badge>
                  <p className="text-sm text-[var(--ink-soft)]">
                    เปรียบเทียบยอดเงินและจำนวน Lead ย้อนหลัง 3 เดือนปฏิทินแบบเรียงลำดับ ช่วยตรวจจับแนวโน้มการเติบโตของยอดขายทันที
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <Badge className="bg-[#2a9bd0] text-white shrink-0 mt-0.5">Top 5 ยอดนิยม</Badge>
                  <p className="text-sm text-[var(--ink-soft)]">
                    สลับแท็บดู <strong>สีหินสังเคราะห์ยอดนิยม</strong> (เช่น KZ802, BW010) เทียบกับ <strong>รุ่นอ่างขายดี</strong> (เช่น KF001, KF004) พร้อมสัดส่วนหลอดเปอร์เซ็นต์
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <Badge className="bg-[#17816d] text-white shrink-0 mt-0.5">1-Click LINE Briefing</Badge>
                  <p className="text-sm text-[var(--ink-soft)]">
                    ปุ่มสีเขียว <strong>[ 📲 ส่งสรุปเข้า LINE ]</strong> บนหัวแดชบอร์ด กดปุ่มเดียวส่งสรุปยอดขายและคิวช่างเข้าห้องแชท LINE ผู้บริหารทันที
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 3: Technician Dispatch */}
          <AccordionItem value="dispatch" className="border border-[var(--line)] rounded-lg px-5 bg-[var(--card-paper)]">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2.5 text-left">
                <Truck size={18} className="text-[#003366]" /> 
                <span className="font-semibold text-base">3. ระบบบริหารคิวช่าง 10 ทีม (Technician Fleet & Dispatch)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-1">
              <p className="text-sm text-[var(--ink-soft)] leading-relaxed">
                ระบบจัดการทีมช่างติดตั้ง 10 ทีมหลัก เพื่อป้องกันงานชน งานซ้อน และคุมพื้นที่วิ่งงานให้มีประสิทธิภาพสูงสุด:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                <div className="p-2 border rounded bg-[var(--paper)] text-center"><strong>TP</strong> : ช่างยี่</div>
                <div className="p-2 border rounded bg-[var(--paper)] text-center"><strong>PP</strong> : ช่างเนตร</div>
                <div className="p-2 border rounded bg-[var(--paper)] text-center"><strong>ST</strong> : ช่างทู</div>
                <div className="p-2 border rounded bg-[var(--paper)] text-center"><strong>CM</strong> : ช่างมิตร</div>
                <div className="p-2 border rounded bg-[var(--paper)] text-center"><strong>KF</strong> : ช่างชัยยา</div>
                <div className="p-2 border rounded bg-[var(--paper)] text-center"><strong>PA</strong> : ช่างเปา</div>
                <div className="p-2 border rounded bg-[var(--paper)] text-center"><strong>PM</strong> : ช่างเอก</div>
                <div className="p-2 border rounded bg-[var(--paper)] text-center"><strong>TJ</strong> : ช่างเจมส์</div>
                <div className="p-2 border rounded bg-[var(--paper)] text-center"><strong>AM</strong> : ช่างอ้น</div>
                <div className="p-2 border rounded bg-[var(--paper)] text-center"><strong>CL</strong> : ช่างชล</div>
              </div>
              <div className="space-y-2 mt-3 text-xs text-[var(--ink-soft)]">
                <p>• <strong>Pre-Dispatch Matrix:</strong> แสดงสถานะของทีมช่างแยกรายวัน (🟢 คิวว่าง / 🟡 มีงาน / 🔴 คิวเต็ม) ก่อนจ่ายงาน</p>
                <p>• <strong>Google Maps Worksite Pin:</strong> ทุกใบงานที่ระบุสถานที่ติดตั้ง จะมีปุ่มเปิดหมุดแผนที่และระบบนำทาง Google Maps อัตโนมัติ</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 4: Slip & Deposit Verification */}
          <AccordionItem value="payment" className="border border-[var(--line)] rounded-lg px-5 bg-[var(--card-paper)]">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2.5 text-left">
                <ShieldCheck size={18} className="text-[#17816d]" /> 
                <span className="font-semibold text-base">4. การตรวจสอบเงินมัดจำ & สลิปโอนเงิน (Slip Verification)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-1">
              <p className="text-sm text-[var(--ink-soft)]">
                ระบบจัดการเงินมัดจำ 50% ด้วยมาตรฐานความปลอดภัย 2 ชั้น:
              </p>
              <div className="space-y-2.5">
                <div className="flex gap-3 items-start">
                  <Badge className="bg-[#17816d] text-white shrink-0 mt-0.5">SlipOK Real-time</Badge>
                  <p className="text-sm text-[var(--ink-soft)]">
                    เมื่อลูกค้าอัปโหลดสลิปที่มี QR Code ระบบเชื่อมต่อตรวจสอบกับธนาคารจริงทันที หากยอดเงินและบัญชีปลายทางถูกต้อง จะขึ้นสถานะ <strong>verified</strong> อัตโนมัติ
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <Badge className="bg-[#003366] text-white shrink-0 mt-0.5">LINE Group Archive</Badge>
                  <p className="text-sm text-[var(--ink-soft)]">
                    สลิปที่ส่งเข้ามาในกลุ่มทีมงาน LINE จะถูกดึงเข้าระบบอัตโนมัติ และบันทึกเป็นสถานะ <strong>team_reported_paid</strong> เพื่อให้ฝ่ายขายและบัญชีกดจับคู่กับ Lead ได้ทันที
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <Badge className="bg-[#a24439] text-white shrink-0 mt-0.5">Anti-Duplication</Badge>
                  <p className="text-sm text-[var(--ink-soft)]">
                    สลิปแต่ละใบจะมีระบบตรวจจับเลขอ้างอิงและ Hash ป้องกันการนำสลิปใบเดิมมาอัปโหลดซ้ำข้ามงาน 100%
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 5: Factory & Production Safety Standards */}
          <AccordionItem value="standards" className="border border-[var(--line)] rounded-lg px-5 bg-[var(--card-paper)]">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2.5 text-left">
                <Sparkles size={18} className="text-[#a9791f]" /> 
                <span className="font-semibold text-base">5. มาตรฐานโรงงาน & สเปกทางเทคนิค (Production Standards)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1 text-sm text-[var(--ink-soft)]">
              <div className="p-4 rounded-md border border-[var(--line)] bg-[var(--paper)] space-y-2">
                <p>• <strong>ระยะขอบปลอดภัยหลุมเจาะอ่าง (Basin Safety Margin):</strong> กำหนดตายตัวอย่างน้อย <strong>100 มม.</strong> จากขอบแผ่นหินถึงขอบเจาะทุกทิศทาง เพื่อป้องกันปัญหาหินสังเคราะห์แตกร้าวขณะขนส่งและติดตั้ง</p>
                <p>• <strong>บัวกันเปื้อนมาตรฐาน:</strong> ตั้งค่าเริ่มต้นที่ความสูง <strong>120 มม.</strong></p>
                <p>• <strong>สเปกหลุมอ่างทรงกลม:</strong> ระบุขนาดด้วยสัญลักษณ์ <strong>Ø</strong> (เช่น Ø350x150) เพื่อให้ระบบเรขาคณิต 2D ประมวลผลเป็นทรงกลมที่แม่นยำ</p>
                <p>• <strong>เวลามาตรฐานระบบ:</strong> การคำนวณวันติดตั้ง การสรุปยอดขาย และการตัดรอบปฏิทิน ยึดถือเวลาประเทศไทย (<strong>Asia/Bangkok, GMT+7</strong>) ในทุกจุด</p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Sales Tip Footer */}
        <Card className="bg-[#003366] text-white border-0 shadow-md">
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <Lightbulb size={22} className="shrink-0 text-amber-300 mt-0.5" />
            <div>
              <CardTitle className="text-base text-white">หัวใจสำคัญในการบริการลูกค้าของ Knight Furnich</CardTitle>
              <CardDescription className="text-white/80 mt-2 space-y-1.5 text-xs md:text-sm">
                <p>• ลูกค้าคือคนสำคัญที่สุด — งานสั่งตัดทุกชุดสะท้อนถึงความประณีตและมาตรฐานระดับพรีเมียมของ Knight</p>
                <p>• ก่อนส่งใบเสนอราคาทางการ ตรวจสอบระยะหลุมเจาะและเบอร์ติดต่อหน้างานให้ครบถ้วนเสมอ</p>
                <p>• เมื่อลูกค้าโอนเงินมัดจำ ตรวจสอบสถานะการจ่ายเงิน และรีบจ่ายงานให้ทีมช่างเพื่อจองคิวติดตั้งล่วงหน้า</p>
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </main>
    </div>
  );
}
