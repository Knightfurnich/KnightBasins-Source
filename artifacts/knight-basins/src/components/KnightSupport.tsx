import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { GripVertical, MessageCircle, RotateCcw, Send, X } from "lucide-react";
import { Link } from "wouter";
import { useGetLineAuthStatus, useSendSupportChatMessage, type SupportProfileUpdate } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
  productCodes?: string[];
  profileUpdate?: SupportProfileUpdate;
};

export function LineLoginButton({ compact = false }: { compact?: boolean }) {
  const { data } = useGetLineAuthStatus();

  const startLogin = () => {
    if (!data?.configured) return;
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/api/auth/line/login?returnTo=${encodeURIComponent(returnTo)}`);
  };

  if (data?.authenticated) {
    return <Link href="/profile" className="line-login-user" title={data.user?.displayName ?? "LINE"} data-testid="link-my-profile">👤 โปรไฟล์ของฉัน</Link>;
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

type SupportPosition = {
  left: number;
  top: number;
};

const SUPPORT_POSITION_KEY = "knight-support-position";

function readSupportPosition(): SupportPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(SUPPORT_POSITION_KEY) || "null") as Partial<SupportPosition> | null;
    return value && Number.isFinite(value.left) && Number.isFinite(value.top)
      ? { left: value.left!, top: value.top! }
      : null;
  } catch {
    return null;
  }
}

export function KnightSupport({ onAddToQuote, onRequestQuote, onLeadEvent }: KnightSupportProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<SupportPosition | null>(readSupportPosition);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: "สวัสดีครับ ผมช่วยค้นหา SKU ราคา ขนาด วิดีโอ 3D 360° และอธิบายวิธีใช้งานหน้า Knight Basins ได้ครับ" },
  ]);
  const chat = useSendSupportChatMessage();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (position) window.localStorage.setItem(SUPPORT_POSITION_KEY, JSON.stringify(position));
  }, [position]);

  const updatePosition = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const wrapper = event.currentTarget.closest(".knight-support") as HTMLElement | null;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
    const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
    setPosition({
      left: Math.min(maxLeft, Math.max(8, event.clientX - dragRef.current.offsetX)),
      top: Math.min(maxTop, Math.max(8, event.clientY - dragRef.current.offsetY)),
    });
  };

  const startDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    const wrapper = event.currentTarget.closest(".knight-support") as HTMLElement | null;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    dragRef.current = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    setPosition({ left: rect.left, top: rect.top });
    setDragging(true);
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Keep pointer movement working when capture is unavailable.
    }
  };

  const stopDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    setDragging(false);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events may not have an active capture.
    }
  };

  const resetPosition = () => {
    dragRef.current = null;
    setDragging(false);
    setPosition(null);
    window.localStorage.removeItem(SUPPORT_POSITION_KEY);
  };

  const send = (requestedMessage?: string) => {
    const message = (requestedMessage ?? draft).trim();
    if (!message || chat.isPending) return;
    if (!requestedMessage) setDraft("");
    setMessages((current) => [...current, { role: "user", text: message }]);
    chat.mutate(
      { data: { message } },
      {
        onSuccess: (result) => {
          const productCodes = result.compareItems?.map((item) => item.code) ?? (result.matchedCode ? [result.matchedCode] : []);
          if (productCodes.length || !result.profileUpdate) onLeadEvent?.("new_lead", productCodes);
          if (result.profileUpdate?.status === "updated") {
            void queryClient.invalidateQueries({ queryKey: ["customer-profile"] });
          }
          setMessages((current) => [...current, { role: "assistant", text: result.reply, productCodes, profileUpdate: result.profileUpdate }]);
        },
        onError: () => setMessages((current) => [...current, { role: "assistant", text: "ขออภัยครับ ระบบค้นหาข้อมูลขัดข้องชั่วคราว กรุณาลองอีกครั้ง" }]),
      },
    );
  };

  return (
    <div
      className={`knight-support ${dragging ? "is-dragging" : ""}`}
      style={position ? { left: `${position.left}px`, top: `${position.top}px`, right: "auto", bottom: "auto" } : undefined}
    >
      {open && (
        <section className="knight-support-panel" aria-label="น้องไนท์ (ผู้ช่วยทีมขาย)">
          <div
            className="knight-support-head"
            onPointerDown={startDragging}
            onPointerMove={updatePosition}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            title="ลากแถบนี้เพื่อย้ายตำแหน่งกล่องแชต"
          >
            <div className="knight-support-title"><GripVertical size={15} aria-hidden="true" /><div><strong>น้องไนท์ (ผู้ช่วยทีมขาย)</strong><small>ถามสินค้า ราคา หรือวิธีใช้งาน Knight Basins ได้เลยค่ะ</small></div></div>
            <div className="knight-support-head-actions">
              <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={resetPosition} aria-label="รีเซ็ตตำแหน่งกล่องแชต" title="รีเซ็ตตำแหน่งกล่องแชต" data-testid="button-reset-knight-support-position"><RotateCcw size={14} /></button>
              <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setOpen(false)} aria-label="ปิดน้องไนท์"><X size={16} /></button>
            </div>
          </div>
          <div className="knight-support-messages" aria-live="polite">
             {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`knight-support-message-wrap knight-support-message-wrap--${message.role}`}><p className={`knight-support-message knight-support-message--${message.role}`}>{message.text}</p>{message.role === "assistant" && message.productCodes && message.productCodes.length > 0 && <div className="knight-support-actions"><button type="button" onClick={() => { message.productCodes?.forEach((sku) => onAddToQuote?.(sku)); onLeadEvent?.("selecting", message.productCodes); }} disabled={!onAddToQuote}>เพิ่มเข้าใบเสนอราคา</button><button type="button" onClick={() => { message.productCodes?.forEach((sku) => onAddToQuote?.(sku)); onLeadEvent?.("selecting", message.productCodes); onRequestQuote?.(message.productCodes ?? []); }} disabled={!onRequestQuote}>ขอใบเสนอราคา</button></div>}{message.role === "assistant" && message.profileUpdate?.status === "confirmation_required" && <div className="knight-support-actions"><button type="button" onClick={() => send("ยืนยัน")} disabled={chat.isPending}>ยืนยันการอัปเดต</button><button type="button" onClick={() => send("ยกเลิก")} disabled={chat.isPending}>ยกเลิก</button></div>}</div>)}
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