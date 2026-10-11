import { useState } from "react";
import { Check, Loader2, ShieldAlert, X } from "lucide-react";
import {
  bowlShapePatchBody,
  confirmShapeSummary,
  deriveShapeOptions,
  labelForCode,
  saveBowlShape,
  sourceBadge,
  type BowlShapeValue,
} from "./basinBowlShape";

type BasinBowlShapeFieldProps = {
  /** null while a new model is still being created — the shape is saved per existing row. */
  basinId: number | null | undefined;
  sku: string;
  /** Exactly what the admin API reported for this row (job 445-C). Never filled in locally. */
  current: BowlShapeValue;
  /** The whole `GET /api/admin/basins` result; the option list is derived from its labels. */
  rows: ReadonlyArray<unknown>;
  onSaved?: () => void;
};

const NOT_SPECIFIED = "__not_specified__";

/**
 * job 446-B — the boss edits a model's bowl shape here. Every word shown comes from the
 * API: the code list and the Thai labels are read out of the rows that came back from
 * `GET /api/admin/basins`, so this panel carries no copy of its own, and "ไม่ระบุ" is a
 * real, savable state (null) rather than an empty box that silently does nothing.
 */
export function BasinBowlShapeField({ basinId, sku, current, rows, onSaved }: BasinBowlShapeFieldProps) {
  const options = deriveShapeOptions(rows.length ? rows : [current]);
  const [next, setNext] = useState<string | null>(current.bowlShape ?? null);
  const [asked, setAsked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fromLabel = labelForCode(options, current.bowlShape ?? null, current.bowlShapeLabel);
  const toLabel = labelForCode(options, next, null);
  const dirty = (next ?? NOT_SPECIFIED) !== (current.bowlShape ?? NOT_SPECIFIED);
  const badge = sourceBadge(current.bowlShapeSource);

  const commit = async () => {
    if (!basinId) return;
    setBusy(true);
    setMessage(null);
    const result = await saveBowlShape(fetch, basinId, next);
    setBusy(false);
    if (!result.ok) {
      // The server explains itself (shape of its body, permission, missing column...).
      // We repeat what it said instead of guessing what it wanted.
      setMessage(result.message);
      return;
    }
    setAsked(false);
    onSaved?.();
  };

  return (
    <div className="admin-basin-bowl-shape space-y-2" data-testid="field-basin-bowl-shape">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs uppercase tracking-wider text-[var(--ink-soft)] font-bold">รูปทรงอ่าง</span>
        <span className="text-xs text-[var(--ink)]" data-testid="text-basin-bowl-shape-current">
          {fromLabel}
          {badge ? <span className="ml-1 text-[var(--ink-soft)]">{badge}</span> : null}
        </span>
        <code className="rounded-sm bg-[rgba(0,0,0,0.05)] px-1.5 py-0.5 font-mono text-[10px]">{current.bowlShape ?? "null"}</code>
      </div>

      {options.length === 0 && (
        <p className="text-[11px] leading-snug text-[var(--ink-soft)]" data-testid="text-basin-bowl-shape-nooptions">
          ยังไม่มีตัวเลือกที่ API ส่งกลับมา (คอลัมน์/endpoint อยู่ระหว่างใบ 445-C) — เราไม่เติมคำหรือค่าเอง
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={next ?? NOT_SPECIFIED}
          disabled={!basinId}
          onChange={(event) => {
            const picked = event.target.value;
            setNext(picked === NOT_SPECIFIED ? null : picked);
            setMessage(null);
          }}
          className="min-h-[44px] min-w-[180px] max-w-full flex-1 rounded-none border border-[var(--line)] bg-[rgba(255,255,255,0.86)] px-2 text-xs [overflow-wrap:anywhere]"
          data-testid="select-basin-bowl-shape"
          aria-label="เลือกรูปทรงอ่าง"
        >
          <option value={NOT_SPECIFIED}>ไม่ระบุ (null)</option>
          {options.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label ?? option.code} — {option.code}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setAsked(true);
          }}
          disabled={!dirty || !basinId || busy}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-none border border-[var(--brand-blue)] bg-[var(--brand-blue)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          data-testid="button-open-bowl-shape-confirm"
        >
          <Check className="h-3.5 w-3.5" /> ยืนยันเปลี่ยนรูปทรง
        </button>
        <button
          type="button"
          onClick={() => {
            setNext(null);
            setMessage(null);
          }}
          disabled={!basinId}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-none border border-[var(--line)] px-3 py-2 text-xs hover:bg-[var(--paper)] disabled:opacity-50"
          data-testid="button-clear-bowl-shape"
        >
          ล้างเป็นไม่ระบุ
        </button>
      </div>

      {!basinId && (
        <p className="text-[11px] text-[var(--ink-soft)]">ตั้งรูปทรงได้หลังบันทึกรุ่นใหม่แล้ว (บันทึกเป็นรายรุ่นผ่าน API)</p>
      )}
      <p className="text-[11px] leading-snug text-[var(--ink-soft)]">
        ลูกค้ายอดเห็นบรรทัดนี้บนการ์ด: <strong data-testid="text-basin-bowl-shape-preview">{toLabel}</strong>
        {dirty ? " (ยังไม่บันทึก — กดยืนยัน)" : ""}
      </p>
      {message && (
        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-[#a24439]" data-testid="text-basin-bowl-shape-error">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{message}</span>
        </p>
      )}

      {asked && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="ยืนยันการเปลี่ยนรูปทรงอ่าง"
          className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--brand-blue)] bg-[var(--card-paper)] p-3"
          data-testid="dialog-confirm-bowl-shape"
        >
          <p className="min-w-0 flex-1 text-xs leading-snug" data-testid="text-basin-bowl-shape-confirm">
            {confirmShapeSummary({ sku: sku || "รุ่นนี้", from: fromLabel, to: toLabel })}
            <span className="mt-1 block text-[11px] text-[var(--ink-soft)]">
              บันทึกรายรุ่นเท่านั้น (ไม่เกี่ยวกับราคา/ภาพ/ฟิลด์อื่น) และมี audit log
            </span>
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => void commit()}
              disabled={busy}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-sm bg-[var(--brand-blue)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              data-testid="button-confirm-bowl-shape"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              บันทึก
            </button>
            <button
              type="button"
              onClick={() => setAsked(false)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-[var(--line)] px-3 py-2 text-xs hover:bg-[var(--paper)]"
              data-testid="button-cancel-bowl-shape"
            >
              <X className="h-3.5 w-3.5" /> ยังไม่บันทึก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { bowlShapePatchBody, deriveShapeOptions };
