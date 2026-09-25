import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "สั่งผลิตเคาน์เตอร์หินสังเคราะห์ใช้เวลากี่วัน?",
    answer: "ประมาณ 5–7 วันทำการหลังยืนยันแบบและวัดระยะหน้างานจริงครับ โดยเริ่มนับจากวันที่ลูกค้าอนุมัติแบบและชำระมัดจำเรียบร้อย",
  },
  {
    question: "มีบริการวัดหน้างานไหม?",
    answer: "มีครับ ทีมช่างของบริษัทจะเข้าหน้างานเพื่อวัดระยะจริงทุกจุด (ความกว้าง ยาว ระยะอ่าง ระยะก๊อก และสิ่งกีดขวาง) ก่อนตัดหินทุกครั้ง เพื่อให้ชิ้นงานประกอบเข้าที่ได้พอดีหน้างานจริง",
  },
  {
    question: "ราคาตารางเมตรละเท่าไหร่ และมีเรตอย่างไร?",
    answer: "งานผลิตพร้อมติดตั้งมี 3 เรตตามลวดลายหินครับ — เรต 1 สีพื้นเรียบ 7,500 บาท/ตร.ม. · เรต 2 ลายเกล็ดชิป 8,500 บาท/ตร.ม. · เรต 3 ลายหินอ่อน/สายแร่ 9,500 บาท/ตร.ม. ราคารวมค่าเจาะช่องอ่าง ช่องก๊อก และติดตั้งหน้างานแล้ว",
  },
  {
    question: "หินสังเคราะห์ต่างจากหินแท้อย่างไร ดูแลยากไหม?",
    answer: "หินสังเคราะห์เชื่อมต่อกันได้ไร้รอยต่อ กันน้ำ 100% ไม่ซึมคราบฝังลึก ไม่เป็นแหล่งสะสมเชื้อรา และถ้ามีรอยขีดข่วนก็ขัดลบพร้อมเคลือบผิวใหม่ให้เงางามเหมือนเดิมได้ครับ ดูแลแค่เช็ดด้วยผ้าชุบน้ำสบู่อ่อนก็เพียงพอ",
  },
  {
    question: "ครอบคลุมพื้นที่ให้บริการที่ไหนบ้าง?",
    answer: "ให้บริการกรุงเทพมหานครและปริมณฑล (ปทุมธานี นนทบุรี สมุทรปราการ นครปฐม สมุทรสาคร) เป็นหลักครับ ส่วนต่างจังหวัดสามารถแจ้งพื้นที่มาได้ ทีมงานจะประเมินค่าเดินทางและจัดคิวให้ครับ",
  },
  {
    question: "มีรับประกันไหม?",
    answer: "รับประกันงานติดตั้งและคุณภาพหินสังเคราะห์ 1 ปีเต็มครับ พร้อมบริการหลังการขายโดยทีมช่างของบริษัทเอง ไม่ได้ส่งต่อให้ผู้รับเหมาช่วง",
  },
];

export function QuickFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="quick-faq" aria-label="คำถามที่พบบ่อย" data-testid="quick-faq">
      <div className="quick-faq-heading">
        <p className="eyebrow">QUESTIONS</p>
        <h2>คำถามที่พบบ่อย</h2>
        <p className="quick-faq-sub">รวมข้อสงสัยที่ลูกค้าถามบ่อยที่สุดก่อนตัดสินใจสั่งผลิต</p>
      </div>

      <div className="quick-faq-list">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={item.question} className={`quick-faq-item ${isOpen ? "is-open" : ""}`}>
              <button
                type="button"
                className="quick-faq-question"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
                data-testid={`faq-question-${index}`}
              >
                <span>{item.question}</span>
                <ChevronDown size={17} className="quick-faq-chevron" aria-hidden="true" />
              </button>
              {isOpen && (
                <p className="quick-faq-answer" data-testid={`faq-answer-${index}`}>
                  {item.answer}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
