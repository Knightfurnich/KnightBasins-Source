import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";

type AssistantMode = "dashboard" | "leads" | "calendar";

type AssistantMessage = {
  id: number;
  question: string;
  mode: AssistantMode;
  reply?: string;
  unavailable?: boolean;
};

type AssistantModeOption = {
  id: AssistantMode;
  label: string;
  testId: string;
};

const MODES: AssistantModeOption[] = [
  { id: "dashboard", label: "ภาพรวม", testId: "assistant-mode-dashboard" },
  { id: "leads", label: "งาน / ลูกค้า", testId: "assistant-mode-leads" },
  { id: "calendar", label: "คิวช่าง", testId: "assistant-mode-calendar" },
];

const SUGGESTIONS = [
  "งานติดตั้งในเดือนนี้มีกี่งาน",
  "มีลูกค้ารายใดที่ควรติดตามวันนี้",
  "สัปดาห์นี้มีคิวช่างวันไหนบ้าง",
];

const UNAVAILABLE_MESSAGE =
  "ขออภัย ผู้ช่วย AI ยังไม่พร้อมให้บริการในขณะนี้ ลองอีกครั้งภายหลังหรือติดต่อเจ้าหน้าที่ได้เลย";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function OpsAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AssistantMode>("dashboard");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const nextMessageId = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  const updateMessage = (id: number, update: Partial<AssistantMessage>) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, ...update } : message)),
    );
  };

  const askAssistant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion || isLoading || cleanQuestion.length > 500) return;

    const id = nextMessageId.current++;
    const selectedMode = mode;
    setMessages((current) => [...current, { id, question: cleanQuestion, mode: selectedMode }]);
    setQuestion("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/assistant/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ question: cleanQuestion, mode: selectedMode }),
      });

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (
        !response.ok ||
        !isRecord(payload) ||
        payload.ok !== true ||
        typeof payload.reply !== "string" ||
        !payload.reply.trim()
      ) {
        updateMessage(id, { unavailable: true });
        return;
      }

      updateMessage(id, { reply: payload.reply.trim() });
    } catch {
      updateMessage(id, { unavailable: true });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .ops-assistant-panel,
        .ops-assistant-launcher,
        .ops-assistant-panel *,
        .ops-assistant-launcher * { box-sizing: border-box; }
        .ops-assistant-launcher {
          position: fixed; right: 22px; bottom: 22px; z-index: 60;
          display: inline-flex; align-items: center; gap: 9px;
          min-height: 52px; padding: 0 18px; border: 1px solid var(--ink, #173f6b);
          color: var(--paper, #fff); background: var(--ink, #173f6b);
          box-shadow: 0 10px 30px rgba(23, 63, 107, .24);
          font: inherit; font-size: 13px; font-weight: 700; cursor: pointer;
          transition: transform .18s ease, box-shadow .18s ease;
        }
        .ops-assistant-launcher:hover { transform: translateY(-2px); box-shadow: 0 14px 34px rgba(23, 63, 107, .3); }
        .ops-assistant-launcher:focus-visible,
        .ops-assistant-panel button:focus-visible,
        .ops-assistant-panel textarea:focus-visible,
        .ops-assistant-panel a:focus-visible { outline: 3px solid var(--saffron, #c48638); outline-offset: 2px; }
        .ops-assistant-panel {
          position: fixed; right: 22px; bottom: 86px; z-index: 60;
          display: flex; flex-direction: column; width: min(400px, calc(100vw - 32px));
          max-height: min(720px, calc(100dvh - 108px)); overflow: hidden;
          border: 1px solid var(--line, #d7e5ef); border-radius: 16px;
          color: var(--ink, #173f6b); background: var(--card-paper, #fff);
          box-shadow: 0 22px 70px rgba(15, 35, 52, .24);
          font-family: var(--app-font-sans, "Noto Sans Thai", sans-serif);
        }
        .ops-assistant-header {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 16px 17px; border-bottom: 1px solid var(--line, #d7e5ef);
          background: var(--paper, #f4f9fd);
        }
        .ops-assistant-title { display: flex; align-items: center; gap: 11px; min-width: 0; }
        .ops-assistant-title-icon {
          display: grid; flex: none; width: 38px; height: 38px; place-items: center;
          color: var(--paper, #fff); background: var(--ink, #173f6b);
        }
        .ops-assistant-title h2 { margin: 0; font-size: 15px; line-height: 1.35; }
        .ops-assistant-title p { margin: 3px 0 0; color: var(--ink-soft, #55718a); font-size: 11px; }
        .ops-assistant-close {
          display: grid; flex: none; width: 34px; height: 34px; place-items: center;
          border: 1px solid transparent; color: var(--ink-soft, #55718a); background: transparent; cursor: pointer;
        }
        .ops-assistant-close:hover { border-color: var(--line, #d7e5ef); color: var(--ink, #173f6b); }
        .ops-assistant-modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; padding: 12px 14px 0; }
        .ops-assistant-mode {
          min-height: 36px; padding: 6px 5px; border: 1px solid var(--line, #d7e5ef);
          color: var(--ink-soft, #55718a); background: transparent; font: inherit; font-size: 11px;
          cursor: pointer; transition: color .15s ease, border-color .15s ease, background .15s ease;
        }
        .ops-assistant-mode[aria-pressed="true"] {
          border-color: var(--ink, #173f6b); color: var(--ink, #173f6b);
          background: color-mix(in srgb, var(--ink, #173f6b) 7%, white); font-weight: 700;
        }
        .ops-assistant-messages {
          display: flex; flex: 1 1 auto; flex-direction: column; gap: 12px; min-height: 120px;
          margin: 12px 0 0; padding: 15px; overflow-y: auto; overscroll-behavior: contain;
          border-top: 1px solid var(--line, #d7e5ef); background: var(--paper, #f4f9fd);
        }
        .ops-assistant-empty { margin: auto; max-width: 275px; color: var(--ink-soft, #55718a); font-size: 12px; line-height: 1.65; text-align: center; }
        .ops-assistant-message { display: grid; gap: 7px; }
        .ops-assistant-question {
          justify-self: end; max-width: 88%; margin: 0; padding: 10px 12px;
          color: #fff; background: var(--ink, #173f6b); font-size: 12px; line-height: 1.55;
          white-space: pre-wrap; overflow-wrap: anywhere;
        }
        .ops-assistant-answer {
          justify-self: start; max-width: 94%; margin: 0; padding: 10px 12px;
          border: 1px solid var(--line, #d7e5ef); color: var(--ink, #173f6b);
          background: var(--card-paper, #fff); font-size: 12px; line-height: 1.65;
          white-space: pre-wrap; overflow-wrap: anywhere;
        }
        .ops-assistant-answer--unavailable { border-color: rgba(162, 68, 57, .28); color: #84483f; }
        .ops-assistant-loading { display: inline-flex; align-items: center; gap: 8px; color: var(--ink-soft, #55718a); font-size: 11px; }
        .ops-assistant-suggestions { display: grid; gap: 6px; padding: 12px 15px 0; }
        .ops-assistant-suggestions-label { margin: 0 0 1px; color: var(--ink-soft, #55718a); font-size: 10px; font-weight: 700; letter-spacing: .04em; }
        .ops-assistant-suggestion {
          padding: 7px 9px; border: 1px solid var(--line, #d7e5ef); color: var(--ink, #173f6b);
          background: transparent; font: inherit; font-size: 11px; text-align: left; cursor: pointer;
        }
        .ops-assistant-suggestion:hover { border-color: var(--ink-soft, #55718a); background: var(--paper, #f4f9fd); }
        .ops-assistant-form { display: grid; gap: 7px; padding: 12px 15px 0; }
        .ops-assistant-input {
          width: 100%; min-height: 76px; resize: vertical; padding: 10px 11px;
          border: 1px solid var(--line, #d7e5ef); border-radius: 0; color: var(--ink, #173f6b);
          background: var(--card-paper, #fff); font: inherit; font-size: 12px; line-height: 1.5;
        }
        .ops-assistant-input::placeholder { color: var(--ink-soft, #55718a); opacity: .8; }
        .ops-assistant-form-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .ops-assistant-counter { color: var(--ink-soft, #55718a); font-size: 10px; }
        .ops-assistant-send {
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          min-height: 36px; padding: 0 13px; border: 1px solid var(--ink, #173f6b);
          color: #fff; background: var(--ink, #173f6b); font: inherit; font-size: 11px;
          font-weight: 700; cursor: pointer;
        }
        .ops-assistant-send:disabled { border-color: var(--line, #d7e5ef); color: var(--ink-soft, #55718a); background: var(--paper, #f4f9fd); cursor: not-allowed; }
        .ops-assistant-footer { display: grid; gap: 8px; padding: 12px 15px 14px; }
        .ops-assistant-disclaimer { margin: 0; color: var(--ink-soft, #55718a); font-size: 10px; line-height: 1.5; }
        .ops-assistant-escalate {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          min-height: 36px; border: 1px solid #20a05a; color: #187943; background: #f1fbf5;
          font: inherit; font-size: 11px; font-weight: 700; text-decoration: none;
        }
        @media (max-width: 480px) {
          .ops-assistant-launcher { right: 14px; bottom: 14px; min-height: 48px; }
          .ops-assistant-panel { right: 12px; bottom: 74px; width: calc(100vw - 24px); max-height: calc(100dvh - 92px); }
          .ops-assistant-messages { min-height: 92px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ops-assistant-launcher, .ops-assistant-mode { transition: none; }
          .ops-assistant-loading svg { animation-duration: 1.8s; }
        }
      `}</style>

      {isOpen ? (
        <section className="ops-assistant-panel" data-testid="panel-ops-assistant" aria-label="ผู้ช่วย AI ประจำระบบ">
          <header className="ops-assistant-header">
            <div className="ops-assistant-title">
              <span className="ops-assistant-title-icon" aria-hidden="true"><Sparkles size={19} /></span>
              <div>
                <h2>ผู้ช่วย AI ประจำระบบ</h2>
                <p>ถามข้อมูลหลังบ้านเป็นภาษาไทยได้เลย</p>
              </div>
            </div>
            <button
              type="button"
              className="ops-assistant-close"
              aria-label="ปิดผู้ช่วย AI"
              onClick={() => setIsOpen(false)}
              data-testid="button-close-ops-assistant"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <div className="ops-assistant-modes" role="group" aria-label="เลือกโหมดผู้ช่วย">
            {MODES.map((option) => (
              <button
                key={option.id}
                type="button"
                className="ops-assistant-mode"
                aria-pressed={mode === option.id}
                data-testid={option.testId}
                onClick={() => setMode(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div
            className="ops-assistant-messages"
            data-testid="list-assistant-messages"
            aria-live="polite"
            aria-busy={isLoading}
          >
            {!messages.length && !isLoading && (
              <p className="ops-assistant-empty">
                เลือกโหมด แล้วพิมพ์คำถามเกี่ยวกับภาพรวม งานลูกค้า หรือคิวช่าง
              </p>
            )}
            {messages.map((message) => (
              <article className="ops-assistant-message" key={message.id}>
                <p className="ops-assistant-question">{message.question}</p>
                {message.reply && <p className="ops-assistant-answer">{message.reply}</p>}
                {message.unavailable && (
                  <p className="ops-assistant-answer ops-assistant-answer--unavailable" data-testid="assistant-unavailable" role="status">
                    {UNAVAILABLE_MESSAGE}
                  </p>
                )}
              </article>
            ))}
            {isLoading && (
              <div className="ops-assistant-loading" role="status" data-testid="assistant-loading">
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                <span>กำลังค้นหาคำตอบ…</span>
              </div>
            )}
          </div>

          <div className="ops-assistant-suggestions" data-testid="assistant-suggestions">
            <p className="ops-assistant-suggestions-label">ลองถาม</p>
            {SUGGESTIONS.map((suggestion) => (
              <button
                type="button"
                className="ops-assistant-suggestion"
                key={suggestion}
                onClick={() => setQuestion(suggestion.slice(0, 500))}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <form className="ops-assistant-form" onSubmit={askAssistant}>
            <label className="sr-only" htmlFor="ops-assistant-question">คำถามถึงผู้ช่วย AI</label>
            <textarea
              id="ops-assistant-question"
              className="ops-assistant-input"
              value={question}
              onChange={(event) => setQuestion(event.target.value.slice(0, 500))}
              maxLength={500}
              rows={3}
              placeholder="พิมพ์คำถามของคุณ…"
              data-testid="input-ops-assistant-question"
            />
            <div className="ops-assistant-form-meta">
              <span className="ops-assistant-counter" aria-live="polite">{question.length}/500 ตัวอักษร</span>
              <button
                type="submit"
                className="ops-assistant-send"
                disabled={!question.trim() || isLoading}
                data-testid="button-ask-ops-assistant"
              >
                <Send size={14} aria-hidden="true" />
                ส่งคำถาม
              </button>
            </div>
          </form>

          <footer className="ops-assistant-footer">
            <p className="ops-assistant-disclaimer" data-testid="assistant-disclaimer">
              คำตอบของ AI ใช้เป็นข้อมูลประกอบ ควรตรวจสอบกับข้อมูลจริงอีกครั้ง
            </p>
            <a
              className="ops-assistant-escalate"
              href="https://line.me/R/ti/p/@789gcnhq"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="button-assistant-escalate"
            >
              <MessageCircle size={15} aria-hidden="true" />
              ส่งต่อให้เจ้าหน้าที่
              <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          </footer>
        </section>
      ) : (
        <button
          type="button"
          className="ops-assistant-launcher"
          onClick={() => setIsOpen(true)}
          aria-label="เปิดผู้ช่วย AI"
          data-testid="button-open-ops-assistant"
        >
          <Sparkles size={18} aria-hidden="true" />
          <span>ผู้ช่วย AI</span>
        </button>
      )}
    </>
  );
}