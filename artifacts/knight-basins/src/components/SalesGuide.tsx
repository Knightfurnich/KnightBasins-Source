import { Link } from "wouter";
import { ArrowLeft, ShoppingBag, Ruler, PenLine, User, Send, Lightbulb, Upload } from "lucide-react";
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
            <strong className="block text-sm tracking-widest leading-none">KNIGHT BASINS</strong>
            <small className="block text-[var(--ink-soft)] font-mono text-[8px] tracking-widest mt-1">คู่มือทีมขาย · SALES GUIDE</small>
          </div>
        </div>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]" data-testid="link-guide-back-to-store">
          <ArrowLeft size={15} /> กลับไปหน้าร้าน
        </Link>
      </header>

      <main className="max-w-[880px] mx-auto px-6 py-10 space-y-10">
        <div>
          <p className="text-xs tracking-widest text-[var(--ink-soft)] uppercase mb-2">คู่มือสำหรับทีมขาย</p>
          <h1 className="text-3xl font-semibold font-display tracking-tight">วิธีเลือกซื้อสินค้า จนถึงการออกใบเสนอราคา</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-3 leading-relaxed">
            ใช้หน้านี้เป็นคู่มือช่วยลูกค้ากรอกข้อมูลตอนอยู่หน้าร้าน หรือตอนคุยผ่านโทรศัพท์ / LINE — ระบบมี 3 ทางในการขอใบเสนอราคา
            เลือกทางที่เหมาะกับลูกค้าแต่ละราย แล้วไล่ตามขั้นตอนด้านล่างได้เลย
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <ShoppingBag className="text-[var(--brand-blue,#2a9bd0)]" size={22} />
              <CardTitle className="text-base mt-2">ซื้อด่วนจากแคตตาล็อก</CardTitle>
              <CardDescription>เหมาะกับลูกค้าที่รู้รุ่นอ่างที่ต้องการอยู่แล้ว ไม่ต้องออกแบบเอง</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <Ruler className="text-[var(--brand-blue,#2a9bd0)]" size={22} />
              <CardTitle className="text-base mt-2">ออกแบบใน 2D Studio</CardTitle>
              <CardDescription>เหมาะกับงานเคาน์เตอร์หินสั่งตัด ต้องระบุขนาด/ทรง/ตำแหน่งอ่างเอง</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <PenLine className="text-[var(--brand-blue,#2a9bd0)]" size={22} />
              <CardTitle className="text-base mt-2">แบบร่างด้วยมือ</CardTitle>
              <CardDescription>ลูกค้ามีแบบร่าง/ภาพถ่ายหน้างานอยู่แล้ว ให้แนบส่งทีมขายดูแบบแทน</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Accordion type="multiple" defaultValue={["quick-purchase"]} className="space-y-4">
          <AccordionItem value="quick-purchase" className="border border-[var(--line)] rounded-lg px-5 bg-[var(--card-paper)]">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2.5">
                <ShoppingBag size={18} /> <span className="font-semibold">1. ซื้อด่วนจากแคตตาล็อก (Quick Purchase)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-1">
              <StepList
                steps={[
                  "เปิดหน้าแรกของเว็บ (แท็บ \"ซื้อด่วนจากแคตตาล็อก\" จะถูกเลือกไว้เป็นค่าเริ่มต้น)",
                  "ใช้ช่องค้นหา (SKU หรือชื่อสี) หรือปุ่มกรองหมวดหมู่ (เคาน์เตอร์ / ทรงสูง) เพื่อหารุ่นที่ลูกค้าต้องการ — เรียงลำดับได้ตามชื่อสี/ราคา/รหัส SKU จากเมนูด้านขวา",
                  "แต่ละการ์ดมีป้าย \"N ภาพ\" และ \"3D 360°\" ให้กดดูรูปเพิ่มเติมหรือวิดีโอหมุนสินค้าก่อนตัดสินใจ ใช้ช่วยลูกค้าที่ยังไม่แน่ใจหน้าตาอ่างได้ดี",
                  "กดที่การ์ดสินค้าเพื่อ \"เลือก\" เข้าไปในใบเสนอราคา (เลือกได้หลายรุ่น กดซ้ำเพื่อยกเลิกการเลือก) — ดูจำนวนที่เลือกไว้ได้จากแท็บ \"อ่างที่เลือก\"",
                  "เมื่อเลือกครบแล้ว กดปุ่ม \"ขอใบเสนอราคา\" (หรือไปหน้า \"ใบเสนอราคา\" จากเมนูบนสุด)",
                  "ในหน้าใบเสนอราคา: ปรับจำนวนแต่ละรุ่นได้ (+/-), ติ๊กเลือก \"ติดตั้ง\" ต่อรายการถ้าลูกค้าต้องการให้ทีมช่างติดตั้งให้ (คิดเพิ่ม 5,000 บาท/ชุด — ฟรีค่าดำเนินการเมื่อสั่งตั้งแต่ 3 ชุดขึ้นไป)",
                  "กรอกข้อมูลลูกค้าให้ครบ (ดูรายละเอียดฟิลด์ในหัวข้อที่ 4 ด้านล่าง) แล้วเลือกว่าต้องการคิด VAT 7% หรือไม่",
                  "กดปุ่ม \"ส่งขอใบเสนอราคา\" — ระบบจะสร้างลิงก์ใบเสนอราคาให้ทันที และแจ้งเตือนเข้า Telegram ทีมขายอัตโนมัติ",
                ]}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="studio" className="border border-[var(--line)] rounded-lg px-5 bg-[var(--card-paper)]">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2.5">
                <Ruler size={18} /> <span className="font-semibold">2. ออกแบบใน 2D Studio (สำหรับงานหินสั่งตัด)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-5 pt-1">
              <p className="text-sm text-[var(--ink-soft)]">
                ใช้โหมดนี้เมื่อลูกค้าต้องการเคาน์เตอร์หินสังเคราะห์แบบสั่งตัดขนาด (ไม่ใช่อ่างสำเร็จรูป) — เข้าจากเมนู &quot;ออกแบบใน 2D Studio&quot; หรือ URL <code className="bg-[var(--line)]/40 px-1 py-0.5 rounded text-xs">/studio</code> โดยตรง
              </p>
              <div>
                <p className="font-medium text-sm mb-2">ขั้นที่ 1 — เลือกสีหินและแบบอ่าง</p>
                <StepList
                  steps={[
                    "เลือกสีหิน 2–3 สี เพื่อเปรียบเทียบราคา (กรองตามช่วงราคาได้) แล้วกด \"เลือก\" สีที่จะใช้คำนวณจริงจากแถบ \"กำลังคำนวณด้วย\"",
                    "เลือกแบบอ่างที่จะฝังลงเคาน์เตอร์ 1–2 รุ่น (ลากจากรายการไปวางบนผังได้เลย หรือกดเลือกก่อนแล้วค่อยจัดตำแหน่งทีหลัง)",
                  ]}
                />
              </div>
              <div>
                <p className="font-medium text-sm mb-2">ขั้นที่ 2 — วางผังเคาน์เตอร์ด้วย Shape Wizard</p>
                <StepList
                  steps={[
                    "เลือกทรงเคาน์เตอร์: ทรงตรง (I) / ทรงฉาก L ซ้าย / ทรงฉาก L ขวา / ทรงตัวยู (U) — เลือกให้ตรงกับผังหน้างานจริง",
                    "กรอกความลึกเคาน์เตอร์ (ปกติ 600 มม.) และความยาวแต่ละแผ่นตามทรงที่เลือก — มีปุ่มไซซ์มาตรฐานให้กดเร็วได้ ไม่ต้องพิมพ์เอง",
                    "ภาพผังจะไฮไลต์แผ่นที่กำลังกรอกอยู่ ช่วยให้เทียบกับหน้างานจริงได้ง่าย",
                    "ถ้ากรอกผิดหรืออยากย้อนดูค่าก่อนหน้า ใช้ปุ่ม ↺ ย้อนกลับ / ↻ ทำซ้ำ ที่แถบด้านบน (หรือคีย์ลัด Ctrl+Z / Ctrl+Y) ได้",
                  ]}
                />
              </div>
              <div>
                <p className="font-medium text-sm mb-2">ขั้นที่ 3 — วางอ่างลงบนผัง</p>
                <StepList
                  steps={[
                    "ลาก (หรือแตะบนมือถือ) อ่างที่เลือกไว้จากรายการลงบนภาพผัง — ระบบจะเช็คให้อัตโนมัติว่าอ่างวางพอดีในแผ่นหรือคร่อมรอยต่อแผ่นหรือไม่",
                    "ใช้ปุ่ม \"วางอ่างกึ่งกลางแผ่น\" หรือ \"จัดระยะห่างอ่างเท่ากัน\" (เมื่อมี 2 อ่าง) เพื่อจัดตำแหน่งให้สวยเร็วขึ้น",
                    "ตั้งค่าขอบแต่ละด้านของแผ่นได้ (ปกติ / ติดบัว / ขอบเปิด / ชิดผนัง) จากช่อง Inspector ด้านขวาของผัง — มีผลต่อราคาค่าบัว/ขอบเปิด",
                  ]}
                />
              </div>
              <div>
                <p className="font-medium text-sm mb-2">ขั้นที่ 4 — เช็คราคาและส่งใบเสนอราคา</p>
                <StepList
                  steps={[
                    "ดูราคาประมาณการแบบสดที่กล่อง \"LIVE ESTIMATE\" ด้านล่าง — อัปเดตทันทีทุกครั้งที่แก้ไขผัง",
                    "เช็คช่อง \"สิ่งที่ต้องแก้ทั้งหมด\" (checklist) ให้ครบก่อนส่ง — ระบบจะฟ้องจุดที่ยังไม่สมบูรณ์ เช่น อ่างวางคร่อมรอยต่อ หรือยังไม่ได้ระบุราคาขอบเปิด",
                    "กรอกข้อมูลลูกค้าให้ครบ (หัวข้อที่ 4) แล้วกด \"ส่งขอใบเสนอราคา\"",
                    "ระบบบันทึกแบบร่างอัตโนมัติระหว่างทำงานอยู่แล้ว (ดูสถานะ \"กำลังบันทึก...\" ที่แถบด้านบน) — กด \"บันทึกแบบร่าง\" เพื่อตั้งชื่อเก็บไว้เปิดดูทีหลังได้ที่ \"แบบร่างของฉัน\"",
                    "ดาวน์โหลดแบบเป็นไฟล์ DXF / PDF / PNG ได้จากปุ่มท้ายหน้า ถ้าต้องการส่งให้ทีมผลิตหรือช่างหน้างาน",
                  ]}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sketch" className="border border-[var(--line)] rounded-lg px-5 bg-[var(--card-paper)]">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2.5">
                <PenLine size={18} /> <span className="font-semibold">3. ส่งแบบร่างด้วยมือ</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-1">
              <p className="text-sm text-[var(--ink-soft)]">ใช้เมื่อลูกค้ามีแบบร่างหรือภาพหน้างานอยู่แล้ว ไม่ต้องการวาดในระบบเอง — เลือกโหมดนี้จากแท็บบนหน้า Studio</p>
              <StepList
                steps={[
                  "แนบไฟล์ภาพแบบร่างได้สูงสุด 5 รูป ทีละรูป (รองรับ JPG, PNG, WEBP, GIF ไม่เกิน 10 MB ต่อรูป) — ถ่ายได้หลายมุม/หลายแผ่นถ้าลูกค้ามีหน้างานหลายจุด",
                  "กรอกข้อมูลลูกค้าให้ครบ",
                  "กดส่ง — ทีมขายจะได้รับรูปแบบร่างครบทุกรูปพร้อมข้อมูลติดต่อทาง Telegram เพื่อประเมินราคาต่อเอง",
                ]}
              />
              <p className="text-xs text-[var(--ink-soft)]">
                หมายเหตุ: ถ้าลูกค้าเขียนขนาดกำกับไว้ในภาพ ทีมขายสามารถเปิดดูรูปทั้งหมดและกรอกขนาด (กว้าง/ยาว/หนา-ลึก) เก็บไว้กับ lead นั้นได้จากหน้า <Link href="/admin" className="underline">/admin</Link> แท็บ &quot;ลูกค้า / Lead&quot;
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="fields" className="border border-[var(--line)] rounded-lg px-5 bg-[var(--card-paper)]">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2.5">
                <User size={18} /> <span className="font-semibold">4. คำอธิบายข้อมูลลูกค้าที่ต้องกรอก</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-5 pt-1">
              <div>
                <Badge variant="outline" className="mb-2">ข้อมูลติดต่อ</Badge>
                <FieldTable
                  rows={[
                    ["ชื่อผู้ติดต่อ", "ชื่อ-นามสกุลลูกค้า หรือผู้ประสานงานหน้างาน", true],
                    ["บริษัท", "ชื่อบริษัท/ร้าน (ถ้ามี ไม่บังคับ)", false],
                    ["โทรศัพท์", "เบอร์ 9–10 หลัก ใช้สำหรับติดต่อกลับ", true],
                    ["อีเมล", "รูปแบบต้องถูกต้อง เช่น name@example.com (ไม่บังคับ)", false],
                    ["ชื่อโครงการ", "ชื่อโครงการ/บ้าน เพื่อใช้อ้างอิงในใบเสนอราคา", true],
                    ["ที่อยู่ / สถานที่ติดตั้ง", "ที่อยู่หน้างานสำหรับประเมินค่าติดตั้ง/ค่าขนส่ง", true],
                    ["LINE สำหรับติดต่อ", "ไอดีหรือชื่อบัญชี LINE (ไม่บังคับ แต่แนะนำให้กรอก)", false],
                    ["ช่องทางติดต่อที่สะดวก", "LINE / โทรศัพท์ / อีเมล — ใช้วางแผนติดต่อกลับลูกค้า", false],
                    ["บทบาทลูกค้า", "เจ้าของบ้าน / สถาปนิก-อินทีเรีย / ผู้รับเหมา-ช่าง", false],
                    ["ประเภทสถานที่", "บ้านเดี่ยว-ทาวน์โฮม / คอนโด / อาคารพาณิชย์ (เลือกคอนโดจะมีช่องกรอกชั้นเพิ่ม)", false],
                    ["วันที่คาดว่าจะติดตั้ง", "ใช้วางแผนคิวช่าง", false],
                  ]}
                />
              </div>
              <div>
                <Badge variant="outline" className="mb-2">ข้อมูลใบกำกับภาษี (ถ้าลูกค้าต้องการใบกำกับภาษีเต็มรูป)</Badge>
                <FieldTable
                  rows={[
                    ["ชื่อสำหรับใบกำกับภาษี", "ชื่อบุคคล/นิติบุคคลตามที่จะออกใบกำกับภาษี", false],
                    ["เลขประจำตัวผู้เสียภาษี", "13 หลัก — กรอกผิดจำนวนหลักระบบจะฟ้องเตือน", false],
                    ["สาขา", "สำนักงานใหญ่ หรือเลขสาขา", false],
                    ["ที่อยู่สำหรับใบกำกับภาษี", "ถ้าต่างจากที่อยู่ติดตั้ง ให้กรอกแยกตรงนี้", false],
                  ]}
                />
              </div>
              <p className="text-xs text-[var(--ink-soft)]">ช่องที่มี <span className="text-[#a24439]">*</span> กำกับ คือช่องบังคับกรอก ระบบจะไม่ให้กดส่งจนกว่าจะกรอกครบและถูกต้อง</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="after" className="border border-[var(--line)] rounded-lg px-5 bg-[var(--card-paper)]">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2.5">
                <Send size={18} /> <span className="font-semibold">5. หลังส่งใบเสนอราคาแล้ว</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1">
              <StepList
                steps={[
                  "ระบบพาลูกค้าไปหน้าใบเสนอราคาแบบเต็มทันที มีลิงก์ให้คัดลอกส่งลูกค้าซ้ำได้ทาง LINE/อีเมล",
                  "ทีมขายจะได้รับแจ้งเตือนเข้า Telegram ทันที พร้อมสรุปรายการ ราคา และข้อมูลติดต่อลูกค้าครบ",
                  "ถ้าลูกค้า Login ด้วย LINE ไว้ จะดูประวัติใบเสนอราคาเก่าของตัวเองได้ที่หน้า \"โปรไฟล์ของฉัน\"",
                  "ใบเสนอราคาที่ส่งแล้วสามารถพิมพ์ออกมาเป็น PDF ได้จากหน้าลิงก์ใบเสนอราคาโดยตรง",
                  "ในหน้า Quote Builder กดปุ่ม \"ดูใบเสนอราคาก่อนหน้า\" ข้างปุ่ม \"พิมพ์ / PDF ทางการ\" เพื่อดูรายการที่เคยบันทึกไว้ — หากยังไม่ได้ล็อกอิน LINE ระบบจะแจ้งให้เข้าสู่ระบบก่อน",
                ]}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="payment" className="border border-[var(--line)] rounded-lg px-5 bg-[var(--card-paper)]">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2.5">
                <Upload size={18} /> <span className="font-semibold">6. การชำระเงินและอัปโหลดสลิป</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-1">
              <p className="text-sm text-[var(--ink-soft)]">
                ลูกค้าอัปโหลดสลิปโอนเงินมัดจำ 50% ได้ 2 ทาง: (1) จากหน้าใบเสนอราคาที่บันทึกไว้ (หน้าที่เปิดจากลิงก์ใบเสนอราคา) หรือ (2) แนบรูปเข้าไปในแชทน้องไนท์ได้เลยจากทุกหน้าของเว็บ (กดไอคอนหนีบกระดาษ 📎 ในกล่องแชท แล้วพิมพ์เลขที่ใบเสนอราคา — ถ้ายังไม่ได้ล็อกอิน LINE ต้องพิมพ์เบอร์โทรที่ให้ไว้ตอนขอใบเสนอราคาด้วย เพื่อยืนยันว่าเป็นเจ้าของใบเสนอราคาจริง) — ทั้งสองทางระบบตรวจสอบสลิปอัตโนมัติผ่าน SlipOK ทันทีที่อัปโหลด แล้วแจ้งผลกลับมาที่ Telegram ทีมขายทันที
              </p>
              <div>
                <p className="font-medium text-sm mb-2">ผลตรวจสอบที่เป็นไปได้ 3 แบบ</p>
                <div className="space-y-2.5">
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-[#17816d] text-white shrink-0 mt-0.5 hover:bg-[#17816d]">ตรวจสอบแล้ว</Badge>
                    <p className="text-sm text-[var(--ink-soft)]">ระบบเช็คยอดเงินและบัญชีปลายทางกับธนาคารจริงผ่าน QR Code บนสลิปแล้วตรงกัน — ถือว่าชำระเงินแล้ว ไม่ต้องตรวจซ้ำ</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-[#a9791f] text-white shrink-0 mt-0.5 hover:bg-[#a9791f] whitespace-nowrap">ไม่มี QR · ต้องตรวจด้วยตา</Badge>
                    <p className="text-sm text-[var(--ink-soft)]">
                      ระบบหาข้อมูลยืนยันการโอนในรูปที่แนบมาไม่เจอ — <strong>ไม่ใช่การปฏิเสธ</strong> อาจเป็นสลิปโอนบัญชีนิติบุคคลบางแบบที่ไม่มี QR Code (ระบบตรวจสอบกับธนาคารแบบนี้ไม่ได้จริง ไม่ใช่แค่ SlipOK เจ้าเดียว) <strong>หรืออาจเป็นรูปที่ไม่ใช่สลิปเลยก็ได้</strong> (ลูกค้าแนบรูปผิด) — ทีมขายต้องเปิดรูปดูด้วยตาเองก่อนว่าใช่สลิปไหม ถ้าใช่ให้ยืนยันยอดเงินตามปกติ (เหมือนขั้นตอนก่อนมี SlipOK) ถ้าไม่ใช่ให้ทักลูกค้าขอรูปสลิปที่ถูกต้องใหม่
                    </p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-[#a24439] text-white shrink-0 mt-0.5 hover:bg-[#a24439]">ไม่ผ่านอัตโนมัติ</Badge>
                    <p className="text-sm text-[var(--ink-soft)]">ยอดเงินหรือบัญชีปลายทางไม่ตรงกับที่คาดไว้ หรือสลิปนี้เคยถูกใช้ยืนยันไปแล้ว (ซ้ำ) — ทีมขายต้องตรวจสอบและติดต่อลูกค้าเพื่อยืนยันก่อนดำเนินการต่อ</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-[var(--ink-soft)]">
                ดูรูปสลิปและผลตรวจสอบทั้งหมดของแต่ละ lead ได้ที่หน้า <Link href="/admin" className="underline">/admin</Link> แท็บ &quot;ลูกค้า / Lead&quot; — เปิดดูรูปสลิปเต็มขนาดได้จากรูปย่อที่แนบไว้ในรายการ
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Card className="bg-[var(--ink)] text-[var(--paper)] border-0">
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <Lightbulb size={20} className="shrink-0 mt-0.5" />
            <div>
              <CardTitle className="text-base text-[var(--paper)]">เคล็ดลับสำหรับทีมขาย</CardTitle>
              <CardDescription className="text-[var(--paper)]/70 mt-2 space-y-1.5">
                <p>• ถ้าลูกค้าไม่แน่ใจขนาดเคาน์เตอร์ ให้เริ่มจากทรง I ก่อน แล้วค่อยปรับเป็น L/U ทีหลังได้ — Shape Wizard คำนวณราคาใหม่ให้อัตโนมัติทุกครั้ง</p>
                <p>• สีหินที่ราคา 9,500 บาท/ตร.ม. มักเป็นลายหินอ่อน ระบบจะเตือนว่า &quot;ทีมขายจะคิดให้&quot; — ต้องประเมินราคาเพิ่มเองแยกต่างหาก อย่าลืมแจ้งลูกค้า</p>
                <p>• งานพื้นที่เล็กกว่าขั้นต่ำ (5 ตร.ม. ในกรุงเทพฯ / 10 ตร.ม. ต่างจังหวัด) จะมีค่าธรรมเนียมงานเล็กเพิ่มอัตโนมัติ — เป็นเรื่องปกติ ไม่ใช่บั๊ก</p>
                <p>• ถ้าลูกค้ายังตัดสินใจไม่ได้ แนะนำให้กด &quot;บันทึกแบบร่าง&quot; แล้วตั้งชื่อไว้ก่อน จะได้กลับมาแก้ต่อได้โดยไม่ต้องเริ่มใหม่</p>
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </main>
    </div>
  );
}
