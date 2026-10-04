import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import { GripVertical, Loader2, MessageCircle, Paperclip, RotateCcw, Send, Volume2, X } from "lucide-react";
import { Link } from "wouter";
import { useDeleteLineSession, useGetLineAuthStatus, useSendSupportChatMessage, type SupportProfileUpdate } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
  productCodes?: string[];
  profileUpdate?: SupportProfileUpdate;
  loginRequired?: boolean;
};

export function LineLoginButton({ compact = false, testId = "button-line-login" }: { compact?: boolean; testId?: string }) {
  const { data } = useGetLineAuthStatus();
  const logoutMutation = useDeleteLineSession();

  const startLogin = () => {
    if (!data?.configured) return;
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/api/auth/line/login?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const logout = () => {
    logoutMutation.mutate(undefined, { onSuccess: () => window.location.assign("/") });
  };

  if (data?.authenticated) {
    return (
      <span className="line-login-user-group">
        <Link href="/profile" className="line-login-user" title={data.user?.displayName ?? "LINE"} data-testid="link-my-profile">👤 โปรไฟล์ของฉัน</Link>
        <button
          type="button"
          className="line-logout-button"
          onClick={logout}
          disabled={logoutMutation.isPending}
          data-testid="button-line-logout"
        >
          ออกจากระบบ
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`line-login-button ${compact ? "line-login-button--compact" : ""}`}
      onClick={startLogin}
      title={data?.configured ? "เข้าสู่ระบบด้วย LINE" : "LINE Login ยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์"}
      data-testid={testId}
    >
      <span className="line-logo-mark">LINE</span>
      เข้าสู่ระบบ
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
    { role: "assistant", text: "สวัสดีค่ะ น้องไนท์พร้อมช่วยค่ะ 💬\n• ดูราคา/สี/ขนาด/วิดีโอ 3D: พิมพ์รหัส เช่น KF001, BW010\n• ปรึกษาออกแบบ/ชำระเงิน/ติดตามใบเสนอราคา: เข้าสู่ระบบด้วย LINE" },
  ]);
  const chat = useSendSupportChatMessage();
  const { data: lineAuthStatus } = useGetLineAuthStatus();
  const queryClient = useQueryClient();
  const [pendingSlip, setPendingSlip] = useState<File | null>(null);
  const [slipSending, setSlipSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const busy = chat.isPending || slipSending;
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const speakMessage = async (text: string, index: number) => {
    if (speakingIndex !== null) return;
    setSpeakingIndex(index);
    try {
      const response = await fetch("/api/support/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error("เล่นเสียงไม่สำเร็จ");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      speechAudioRef.current?.pause();
      const audio = new Audio(url);
      speechAudioRef.current = audio;
      audio.addEventListener("ended", () => { setSpeakingIndex(null); URL.revokeObjectURL(url); }, { once: true });
      audio.addEventListener("error", () => { setSpeakingIndex(null); URL.revokeObjectURL(url); }, { once: true });
      await audio.play();
    } catch {
      setSpeakingIndex(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const response = await fetch("/api/support/voice-status");
        if (!response.ok) {
          if (mounted) setVoiceEnabled(false);
          return;
        }
        const payload = await response.json() as { enabled?: unknown };
        if (mounted) setVoiceEnabled(payload.enabled === true);
      } catch {
        if (mounted) setVoiceEnabled(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

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

  const sendSlip = async (text: string, file: File) => {
    setMessages((current) => [...current, { role: "user", text }]);
    setSlipSending(true);
    const [quoteNumberPart, phonePart] = text.split(",");
    const form = new FormData();
    form.append("file", file);
    form.append("quoteNumber", (quoteNumberPart ?? "").trim());
    if (phonePart?.trim()) form.append("phone", phonePart.trim());
    try {
      const response = await fetch("/api/support/payment-slip", { method: "POST", body: form });
      const payload = (await response.json().catch(() => null)) as { reply?: string } | null;
      setMessages((current) => [
        ...current,
        { role: "assistant", text: payload?.reply || "ขออภัยค่ะ ระบบอัปโหลดสลิปขัดข้องชั่วคราว กรุณาลองอีกครั้ง" },
      ]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: "ขออภัยค่ะ อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }]);
    } finally {
      setSlipSending(false);
      setPendingSlip(null);
    }
  };

  const send = (requestedMessage?: string) => {
    const message = (requestedMessage ?? draft).trim();
    if (!message || busy) return;
    if (!requestedMessage) setDraft("");
    if (pendingSlip) {
      void sendSlip(message, pendingSlip);
      return;
    }
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
          const loginRequired = (result as typeof result & { loginRequired?: boolean }).loginRequired === true;
          setMessages((current) => [...current, { role: "assistant", text: result.reply, productCodes, profileUpdate: result.profileUpdate, loginRequired }]);
        },
        onError: () => setMessages((current) => [...current, { role: "assistant", text: "ขออภัยค่ะ ระบบค้นหาข้อมูลขัดข้องชั่วคราว กรุณาลองอีกครั้ง" }]),
      },
    );
  };

  const handleSlipFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    setPendingSlip(file);
    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        text: "แนบรูปสลิปแล้วค่ะ รบกวนพิมพ์เลขที่ใบเสนอราคา (และเบอร์โทรที่ให้ไว้ ถ้ายังไม่ได้ล็อกอิน LINE) คั่นด้วยจุลภาค เช่น \"QT-202610-US-0001, 0812345678\" แล้วกดส่งได้เลยค่ะ",
      },
    ]);
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
          <div
            role="status"
            className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
            data-testid="knight-support-mode-banner"
          >
            <span>{lineAuthStatus?.authenticated ? "โหมดเต็ม (เชื่อมต่อ LINE แล้ว)" : "โหมดทั่วไป · ค้นหาสินค้าได้"}</span>
            {!lineAuthStatus?.authenticated && <LineLoginButton compact testId="button-line-login-mode-banner" />}
          </div>
          <div className="knight-support-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`knight-support-message-wrap knight-support-message-wrap--${message.role}`}
              >
                <p
                  className={`knight-support-message knight-support-message--${message.role}`}
                  style={{ whiteSpace: "pre-line" }}
                >
                  {message.text}
                </p>
                {message.role === "assistant" && message.loginRequired && (
                  <div className="mt-2 flex justify-end">
                    <LineLoginButton compact testId={`button-line-login-required-${index}`} />
                  </div>
                )}
                {message.role === "assistant" && voiceEnabled && (
                  <button
                    type="button"
                    className="knight-support-speak-button"
                    onClick={() => speakMessage(message.text, index)}
                    disabled={speakingIndex !== null}
                    data-testid={`button-speak-message-${index}`}
                  >
                    {speakingIndex === index ? (
                      <Loader2 size={14} className="knight-support-speak-spin" aria-hidden="true" />
                    ) : (
                      <Volume2 size={14} aria-hidden="true" />
                    )}{" "}
                    ฟังเสียง
                  </button>
                )}
                {message.role === "assistant" && message.productCodes && message.productCodes.length > 0 && (
                  <div className="knight-support-actions">
                    <button
                      type="button"
                      onClick={() => {
                        message.productCodes?.forEach((sku) => onAddToQuote?.(sku));
                        onLeadEvent?.("selecting", message.productCodes);
                      }}
                      disabled={!onAddToQuote}
                    >
                      เพิ่มเข้าใบเสนอราคา
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        message.productCodes?.forEach((sku) => onAddToQuote?.(sku));
                        onLeadEvent?.("selecting", message.productCodes);
                        onRequestQuote?.(message.productCodes ?? []);
                      }}
                      disabled={!onRequestQuote}
                    >
                      ขอใบเสนอราคา
                    </button>
                  </div>
                )}
                {message.role === "assistant" && message.profileUpdate?.status === "confirmation_required" && (
                  <div className="knight-support-actions">
                    <button type="button" onClick={() => send("ยืนยัน")} disabled={busy}>
                      ยืนยันการอัปเดต
                    </button>
                    <button type="button" onClick={() => send("ยกเลิก")} disabled={busy}>
                      ยกเลิก
                    </button>
                  </div>
                )}
              </div>
            ))}
            {chat.isPending && <p className="knight-support-message knight-support-message--assistant">กำลังค้นข้อมูล...</p>}
            {slipSending && <p className="knight-support-message knight-support-message--assistant">กำลังตรวจสอบสลิป...</p>}
          </div>
          {pendingSlip && (
            <p className="knight-support-pending-slip" data-testid="text-knight-support-pending-slip">
              📎 {pendingSlip.name}
              <button type="button" onClick={() => setPendingSlip(null)} aria-label="ยกเลิกการแนบสลิป" disabled={slipSending}><X size={12} /></button>
            </p>
          )}
          <form className="knight-support-form" onSubmit={(event) => { event.preventDefault(); send(); }}>
            <input type="file" ref={fileInputRef} accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleSlipFileChange} style={{ display: "none" }} data-testid="input-knight-support-slip-file" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy} aria-label="แนบรูปสลิปโอนเงิน" title="แนบรูปสลิปโอนเงิน" data-testid="button-knight-support-attach-slip"><Paperclip size={15} /></button>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={pendingSlip ? "เลขที่ใบเสนอราคา, เบอร์โทร (ถ้ามี)" : "เช่น KF023 หรือ BW010"} aria-label="คำถามน้องไนท์" />
            <button type="submit" aria-label="ส่งคำถาม" disabled={busy || !draft.trim()}><Send size={15} /></button>
          </form>
        </section>
      )}
      <button type="button" className="knight-support-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="เปิด KnightSupport" data-testid="button-knight-support">
        {open ? <X size={17} /> : <MessageCircle size={17} />} <span>น้องไนท์</span>
      </button>
    </div>
  );
}