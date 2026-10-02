import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { KNIGHT_FAQ_ITEMS } from "@/data/faq-data";

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
        {KNIGHT_FAQ_ITEMS.map((item, index) => {
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
              <p className="quick-faq-answer" data-testid={`faq-answer-${index}`} hidden={!isOpen}>
                {item.answer}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
