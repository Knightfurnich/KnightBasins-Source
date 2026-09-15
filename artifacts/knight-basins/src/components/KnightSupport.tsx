import { useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { useGetLineAuthStatus, useSendSupportChatMessage } from "@workspace/api-client-react";

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
  productCodes?: string[];
};

export function LineLoginButton({ compact = false }: { compact?: boolean }) {
  const { data } = useGetLineAuthStatus();

  const startLogin = () => {
    if (!data?.configured) return;
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/api/auth/line/login?returnTo=${encodeURIComponent(returnTo)}`);
  };

  if (data?.authenticated) {
    return <span className="line-login-user">{data.user?.displayName ?? "LINE"}</span>;
  }

  return (
    <button
      type="button"
      className={`line-login-button ${compact ? "line-login-button--compact" : ""}`}
      onClick={startLogin}
      title={data?.configured ? "เข้าสู่ระบบด้วย LINE" : "LINE Login ยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์"}
      data-testid="button-line-login"
    >
      <span className="line-logo-mark">LINE</span>
      {!compact && "เข้าสู่ระบบ"}
    </button>
  );
}

type KnightSupportProps = {
  onAddToQuote?: (sku: string) => void;
  onRequestQuote?: (skus: string[]) => void;
  onLeadEvent?: (status: "new_lead" | "selecting", productSkus?: string[]) => void;
};

export function KnightSupport({ onAddToQuote, onRequestQuote, onLeadEvent }: KnightSupportProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: "สวัสดีครับ ผมช่วยค้นหา SKU ราคา ขนาด และวิดีโอ 3D 360° ของสินค้าได้" },
  ]);
  const chat = useSendSupportChatMessage();

  const send = () => {
    const message = draft.trim();
    if (!message || chat.isPending) return;
    setDraft("");
    setMessages((current) => [...current, { role: "user", text: message }]);
    chat.mutate(
      { data: { message } },
      {
        onSuccess: (result) => {
          const productCodes = result.compareItems?.map((item) => item.code) ?? (result.matchedCode ? [result.matchedCode] : []);
          onLeadEvent?.("new_lead", productCodes);
          setMessages((current) => [...current, { role: "assistant", text: result.reply, productCodes }]);
        },
        onError: () => setMessages((current) => [...current, { role: "assistant", text: "ขออภัยครับ ระบบค้นหาข้อมูลขัดข้องชั่วคราว กรุณาลองอีกครั้ง" }]),
      },
    );
  };

  return (
    <div className="knight-support">
      {open && (
        <section className="knight-support-panel" aria-label="น้องไนท์ (ผู้ช่วยทีมขาย)">
          <div className="knight-support-head">
            <div><strong>น้องไนท์ (ผู้ช่วยทีมขาย)</strong><small>สอบถามสินค้า ราคา และวิธีออกแบบ 2D ได้เลยค่ะ</small></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="ปิดน้องไนท์"><X size={16} /></button>
          </div>
          <div className="knight-support-messages" aria-live="polite">
            {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`knight-support-message-wrap knight-support-message-wrap--${message.role}`}><p className={`knight-support-message knight-support-message--${message.role}`}>{message.text}</p>{message.role === "assistant" && message.productCodes && message.productCodes.length > 0 && <div className="knight-support-actions"><button type="button" onClick={() => { message.productCodes?.forEach((sku) => onAddToQuote?.(sku)); onLeadEvent?.("selecting", message.productCodes); }} disabled={!onAddToQuote}>เพิ่มเข้าใบเสนอราคา</button><button type="button" onClick={() => { message.productCodes?.forEach((sku) => onAddToQuote?.(sku)); onLeadEvent?.("selecting", message.productCodes); onRequestQuote?.(message.productCodes ?? []); }} disabled={!onRequestQuote}>ขอใบเสนอราคา</button></div>}</div>)}
            {chat.isPending && <p className="knight-support-message knight-support-message--assistant">กำลังค้นข้อมูล...</p>}
          </div>
          <form className="knight-support-form" onSubmit={(event) => { event.preventDefault(); send(); }}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="เช่น KF023 หรือ BW010" aria-label="คำถามน้องไนท์" />
            <button type="submit" aria-label="ส่งคำถาม" disabled={chat.isPending || !draft.trim()}><Send size={15} /></button>
          </form>
        </section>
      )}
      <button type="button" className="knight-support-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="เปิด KnightSupport" data-testid="button-knight-support">
        {open ? <X size={17} /> : <MessageCircle size={17} />} <span>น้องไนท์</span>
      </button>
    </div>
  );
}