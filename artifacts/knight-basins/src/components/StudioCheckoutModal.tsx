import { useCreatePromptPayQr, useSubmitPaymentSlip } from "@workspace/api-client-react";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import * as QRCode from "qrcode";

type PaymentType = "deposit_50" | "deposit_30" | "full";
type QrResult = {
  qrPayload: string;
  amountThb: number;
  paymentType: PaymentType;
  companyAccount: {
    bankName: string | null;
    bankAccountName: string;
    bankAccountNumber: string | null;
    taxId: string;
  };
};
type SlipResult = {
  status: "verified" | "needs_review" | "rejected";
  verifiedAmountThb?: number | null;
  claimedAmountThb?: number | null;
  senderName?: string | null;
  slipokErrorCode?: string | null;
};
type StudioCheckoutModalProps = {
  token: string;
  quoteNumber: string;
  quoteTotalTHB: number;
  onClose: () => void;
};

const paymentOptions: { type: PaymentType; label: string; shortLabel: string }[] = [
  { type: "deposit_50", label: "🟢 ชำระมัดจำ 50%", shortLabel: "มัดจำ 50%" },
  { type: "deposit_30", label: "ชำระมัดจำ 30%", shortLabel: "มัดจำ 30%" },
  { type: "full", label: "ชำระเต็มจำนวน 100%", shortLabel: "เต็มจำนวน" },
];
const FALLBACK_ACCOUNT = {
  bankName: "ธ.กรุงศรีอยุธยา",
  bankAccountName: "บริษัท ไนท์ เฟอร์นิช จำกัด",
  bankAccountNumber: "574-1-18925-4",
};
const baht = (value: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(value);

export default function StudioCheckoutModal({
  token,
  quoteNumber,
  quoteTotalTHB,
  onClose,
}: StudioCheckoutModalProps) {
  const createQr = useCreatePromptPayQr();
  const submitSlip = useSubmitPaymentSlip();
  const [paymentType, setPaymentType] = useState<PaymentType>("deposit_50");
  const [qr, setQr] = useState<QrResult | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [qrError, setQrError] = useState("");
  const [qrLoading, setQrLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [slip, setSlip] = useState<SlipResult | null>(null);
  const [fileError, setFileError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const qrRequestRef = useRef(0);
  const createQrRef = useRef(createQr.mutateAsync);
  createQrRef.current = createQr.mutateAsync;

  const requestQr = useCallback(async (type: PaymentType) => {
    const requestId = ++qrRequestRef.current;
    setQrLoading(true);
    setQrError("");
    setQr(null);
    setQrImage("");
    try {
      const result = await createQrRef.current({ data: { token, paymentType: type } }) as QrResult;
      if (requestId !== qrRequestRef.current) return;
      setQr(result);
      const image = await QRCode.toDataURL(result.qrPayload, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 320,
        color: { dark: "#1d3335", light: "#fffdf8" },
      });
      if (requestId === qrRequestRef.current) setQrImage(image);
    } catch (error) {
      if (requestId === qrRequestRef.current) {
        setQrError(error instanceof Error ? error.message : "สร้าง QR ไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
    } finally {
      if (requestId === qrRequestRef.current) setQrLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void requestQr("deposit_50");
  }, [requestQr]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const selectPayment = (type: PaymentType) => {
    setPaymentType(type);
    setSlip(null);
    setSelectedFile(null);
    setFileError("");
    if (inputRef.current) inputRef.current.value = "";
    void requestQr(type);
  };

  const downloadQr = () => {
    if (!qrImage) return;
    const link = document.createElement("a");
    link.href = qrImage;
    link.download = `knight-furnich-${quoteNumber}-promptpay.png`;
    link.click();
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSlip(null);
    setFileError("");
    if (file && !file.type.startsWith("image/")) {
      setSelectedFile(null);
      setFileError("กรุณาเลือกไฟล์รูปภาพสลิป เช่น JPG, PNG หรือ WEBP");
      event.target.value = "";
      return;
    }
    setSelectedFile(file);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile || submitSlip.isPending) return;
    setFileError("");
    try {
      const result = await submitSlip.mutateAsync({
        data: { file: selectedFile, token, kind: "deposit", paymentType },
      }) as SlipResult;
      setSlip(result);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "ส่งสลิปไม่สำเร็จ กรุณาลองใหม่");
    }
  };

  const account = qr?.companyAccount;
  const accountName = account?.bankAccountName || FALLBACK_ACCOUNT.bankAccountName;
  const bankName = account?.bankName || FALLBACK_ACCOUNT.bankName;
  const accountNumber = account?.bankAccountNumber || FALLBACK_ACCOUNT.bankAccountNumber;
  const remaining = qr ? Math.max(0, quoteTotalTHB - qr.amountThb) : 0;
  const isVerified = slip?.status === "verified";

  return (
    <div className="kfc-overlay" data-testid="modal-studio-checkout-overlay">
      <section
        id="modal-studio-checkout"
        className="kfc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kfc-title"
        aria-describedby="kfc-description"
        data-testid="modal-studio-checkout"
      >
        <style>{`
          .kfc-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(25,39,39,.62);backdrop-filter:blur(5px);font-family:Manrope,"Noto Sans Thai",sans-serif;color:#263638}
          .kfc-modal{position:relative;width:min(100%,950px);max-height:min(92dvh,900px);overflow:auto;background:#f7f4ed;border:1px solid #d9d2c5;border-radius:22px;box-shadow:0 28px 90px rgba(20,33,33,.28);animation:kfc-enter .24s ease-out}
          .kfc-modal *{box-sizing:border-box}
          .kfc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding:27px 32px 20px;border-bottom:1px solid #e2ddd3}
          .kfc-kicker{margin:0 0 7px;color:#537c78;font-size:11px;font-weight:800;letter-spacing:.15em;text-transform:uppercase}
          .kfc-title{margin:0;color:#263638;font-size:clamp(23px,3vw,31px);line-height:1.2;letter-spacing:-.04em}
          .kfc-desc{margin:7px 0 0;color:#6f7976;font-size:13px;line-height:1.6}
          .kfc-close{display:grid;place-items:center;flex:none;width:40px;height:40px;border:1px solid #ded8cc;border-radius:50%;background:#fffdf8;color:#39494a;font-size:23px;line-height:1;cursor:pointer;transition:transform .18s,background .18s}
          .kfc-close:hover{background:#ebe7dd;transform:rotate(5deg)}
          .kfc-content{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:28px;padding:25px 32px 32px}
          .kfc-section-label{margin:0 0 12px;color:#6b7774;font-size:11px;font-weight:800;letter-spacing:.11em;text-transform:uppercase}
          .kfc-choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:22px}
          .kfc-choice{min-height:70px;padding:12px 9px;border:1px solid #d9d4ca;border-radius:12px;background:#fcfaf5;color:#435151;font:700 12px/1.45 Manrope,"Noto Sans Thai",sans-serif;cursor:pointer;transition:transform .16s,border-color .16s,background .16s}
          .kfc-choice:hover{transform:translateY(-2px);border-color:#77938c}
          .kfc-choice[aria-pressed=true]{border-color:#587e78;background:#e6efea;color:#284843;box-shadow:inset 0 0 0 1px #587e78}
          .kfc-amounts{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:15px 16px;margin-bottom:20px;border-radius:14px;background:#ece8de}
          .kfc-amounts div{min-width:0}
          .kfc-amounts small{display:block;margin-bottom:3px;color:#77817d;font-size:11px}
          .kfc-amounts strong{display:block;color:#2c3d3e;font-size:19px;font-weight:800;letter-spacing:-.03em}
          .kfc-amounts .kfc-remaining strong{color:#547e75}
          .kfc-bank{padding:15px 16px;margin-bottom:20px;border:1px solid #e1dbce;border-radius:14px;background:#fbf9f3}
          .kfc-bank-row{display:flex;justify-content:space-between;gap:12px;padding:6px 0;color:#737d79;font-size:12px}
          .kfc-bank-row strong{color:#334344;text-align:right;font-weight:700}
          .kfc-account-number{font-family:"DM Mono",monospace;font-size:14px!important;letter-spacing:.04em}
          .kfc-qr-panel{display:flex;flex-direction:column;align-items:center;padding:18px 15px 17px;border:1px solid #e1dbce;border-radius:16px;background:#fffdf8;text-align:center}
          .kfc-qr-box{display:grid;place-items:center;width:min(100%,230px);aspect-ratio:1;margin:1px auto 12px;border-radius:12px;background:#fffdf8}
          .kfc-qr-box img{width:100%;height:100%;object-fit:contain}
          .kfc-qr-loading{width:100%;height:100%;border-radius:10px;background:linear-gradient(100deg,#eee9df 20%,#f8f5ee 42%,#eee9df 64%);background-size:220% 100%;animation:kfc-shimmer 1.5s ease-in-out infinite}
          .kfc-qr-caption{margin:0 0 12px;color:#65716e;font-size:12px;line-height:1.5}
          .kfc-button{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:46px;padding:11px 15px;border:0;border-radius:11px;background:#315c58;color:#fffdf8;font:800 13px/1.4 Manrope,"Noto Sans Thai",sans-serif;text-align:center;cursor:pointer;transition:transform .16s,background .16s,opacity .16s}
          .kfc-button:hover:not(:disabled){transform:translateY(-1px);background:#244b48}
          .kfc-button:disabled{opacity:.48;cursor:not-allowed}
          .kfc-download{min-height:42px;border:1px solid #cbd6ce;background:#eff4ee;color:#355650;font-size:12px}
          .kfc-download:hover:not(:disabled){background:#e4eee7}
          .kfc-upload{display:flex;align-items:center;justify-content:center;min-height:47px;padding:10px 13px;border:1px dashed #9cad9f;border-radius:11px;background:#fbfaf5;color:#46615c;font-size:12px;font-weight:700;cursor:pointer}
          .kfc-upload:hover{background:#edf2ec}
          .kfc-file{margin:8px 0 0;color:#61736c;font-size:11px;overflow-wrap:anywhere}
          .kfc-form{display:grid;gap:9px;margin-top:12px}
          .kfc-note{margin:11px 0 0;color:#89918c;font-size:10px;line-height:1.55;text-align:center}
          .kfc-error{padding:10px 12px;border:1px solid #e8c4b7;border-radius:10px;background:#fff0e9;color:#8d4938;font-size:12px;line-height:1.5}
          .kfc-result{padding:13px 14px;border-radius:12px;font-size:12px;line-height:1.6}
          .kfc-result strong{display:block;margin-bottom:3px;font-size:14px}
          .kfc-review{border:1px solid #ddc995;background:#fbf4df;color:#63542c}
          .kfc-rejected{border:1px solid #e0b9ad;background:#fff0eb;color:#854b3d}
          .kfc-success{grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:390px;padding:32px 22px;text-align:center}
          .kfc-check{display:grid;place-items:center;width:102px;height:102px;margin-bottom:20px;border-radius:50%;background:#e1f0e5;color:#42805a;font-size:56px;font-weight:500;animation:kfc-pop .55s cubic-bezier(.18,.89,.32,1.28) both}
          .kfc-success h3{max-width:520px;margin:0;color:#2c5140;font-size:clamp(22px,4vw,32px);line-height:1.35;letter-spacing:-.035em}
          .kfc-success p{margin:10px 0 22px;color:#6c7a71;font-size:14px}
          .kfc-track{max-width:420px;text-decoration:none}
          .kfc-quote-pill{padding:7px 12px;margin-bottom:14px;border:1px solid #dce5dc;border-radius:999px;background:#f2f7f0;color:#587461;font-family:"DM Mono",monospace;font-size:12px}
          .kfc-footer-hint{position:absolute;right:32px;bottom:11px;color:#939a94;font-size:10px}
          .kfc-modal :focus-visible{outline:3px solid #80a9a0;outline-offset:3px}
          @keyframes kfc-enter{from{opacity:0;transform:translateY(10px) scale(.99)}to{opacity:1;transform:translateY(0) scale(1)}}
          @keyframes kfc-pop{0%{opacity:0;transform:scale(.45)}75%{opacity:1;transform:scale(1.12)}100%{transform:scale(1)}}
          @keyframes kfc-shimmer{to{background-position-x:-220%}}
          @media(max-width:720px){.kfc-overlay{padding:0;align-items:end}.kfc-modal{width:100%;max-height:96dvh;border-radius:20px 20px 0 0}.kfc-head{padding:22px 20px 17px}.kfc-content{grid-template-columns:1fr;gap:18px;padding:18px 20px 28px}.kfc-qr-panel{order:-1}.kfc-qr-box{width:190px}.kfc-footer-hint{right:20px}.kfc-success{min-height:360px}.kfc-choice{font-size:11px}}
          @media(prefers-reduced-motion:reduce){.kfc-modal,.kfc-check,.kfc-qr-loading{animation:none}.kfc-choice,.kfc-button,.kfc-close{transition:none}}
        `}</style>

        <header className="kfc-head">
          <div>
            <p className="kfc-kicker">Knight Furnich · 2D Studio</p>
            <h2 className="kfc-title" id="kfc-title" data-testid="text-checkout-title">
              {isVerified ? "ยืนยันการชำระเงินแล้ว" : "ชำระเงินเพื่อเริ่มงาน"}
            </h2>
            <p className="kfc-desc" id="kfc-description" data-testid="text-checkout-quote">
              ใบเสนอราคา {quoteNumber} · ยอดรวม ฿{baht(quoteTotalTHB)}
            </p>
          </div>
          <button className="kfc-close" type="button" aria-label="ปิดหน้าต่าง" onClick={onClose} data-testid="button-close-studio-checkout">
            ×
          </button>
        </header>

        {isVerified ? (
          <div className="kfc-success" role="status" data-testid="status-payment-verified">
            <div className="kfc-check" aria-hidden="true">✓</div>
            <div className="kfc-quote-pill" data-testid="text-verified-quote-number">ใบเสนอราคา {quoteNumber}</div>
            <h3 data-testid="text-payment-confirmed">ชำระเงินเรียบร้อยแล้ว!</h3>
            <p data-testid="text-payment-production-status">รหัสงานของคุณคือ {quoteNumber} · ระบบกำลังเปิดคิวผลิตอัตโนมัติ</p>
            <p data-testid="text-payment-verified-amount">
              ยอดที่ตรวจสอบแล้ว ฿{baht(slip?.verifiedAmountThb ?? qr?.amountThb ?? 0)}
              {slip?.senderName ? ` · ผู้โอน ${slip.senderName}` : ""}
            </p>
            <a className="kfc-button kfc-track" href="/track" data-testid="link-track-job">
              📱 ติดตามสถานะงานของคุณ (/track)
            </a>
          </div>
        ) : (
          <div className="kfc-content">
            <div>
              <p className="kfc-section-label">เลือกยอดชำระ</p>
              <div className="kfc-choices" role="group" aria-label="เลือกรูปแบบการชำระเงิน" data-testid="group-payment-options">
                {paymentOptions.map((option) => (
                  <button
                    key={option.type}
                    className="kfc-choice"
                    type="button"
                    aria-pressed={paymentType === option.type}
                    onClick={() => selectPayment(option.type)}
                    data-testid={`button-payment-${option.type}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="kfc-amounts" aria-live="polite" data-testid="panel-payment-amounts">
                <div>
                  <small>ชำระครั้งนี้ · {paymentOptions.find((option) => option.type === paymentType)?.shortLabel}</small>
                  <strong data-testid="text-payment-amount">
                    {qrLoading ? "กำลังคำนวณ…" : qr ? `฿${baht(qr.amountThb)}` : "—"}
                  </strong>
                </div>
                <div className="kfc-remaining">
                  <small>ยอดคงเหลือหลังชำระ</small>
                  <strong data-testid="text-remaining-balance">
                    {qrLoading ? "—" : qr ? `฿${baht(remaining)}` : "—"}
                  </strong>
                </div>
              </div>

              <section className="kfc-bank" aria-label="ข้อมูลบัญชีรับชำระ" data-testid="panel-company-account">
                <p className="kfc-section-label">บัญชีรับชำระ</p>
                <div className="kfc-bank-row"><span>ธนาคาร</span><strong data-testid="text-bank-name">{bankName}</strong></div>
                <div className="kfc-bank-row"><span>ชื่อบัญชี</span><strong data-testid="text-bank-account-name">{accountName}</strong></div>
                <div className="kfc-bank-row"><span>เลขที่บัญชี</span><strong className="kfc-account-number" data-testid="text-bank-account-number">{accountNumber}</strong></div>
              </section>

              <p className="kfc-section-label">แนบสลิปเพื่อยืนยัน</p>
              <form className="kfc-form" onSubmit={handleSubmit} data-testid="form-checkout-slip">
                <label className="kfc-upload" htmlFor="input-checkout-slip" data-testid="label-checkout-slip">
                  {selectedFile ? "เปลี่ยนรูปสลิป" : "เลือกภาพสลิปจากอุปกรณ์"}
                </label>
                <input
                  ref={inputRef}
                  id="input-checkout-slip"
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  hidden
                  data-testid="input-checkout-slip"
                />
                {selectedFile && <p className="kfc-file" data-testid="text-selected-slip">{selectedFile.name}</p>}
                {fileError && <div className="kfc-error" role="alert" data-testid="error-checkout-slip">{fileError}</div>}
                {slip?.status === "needs_review" && (
                  <div className="kfc-result kfc-review" role="status" data-testid="status-payment-needs-review">
                    <strong>รับสลิปแล้ว · รอตรวจสอบ</strong>
                    ระบบได้รับหลักฐานการชำระเงินแล้ว ทีมงานจะตรวจสอบและอัปเดตสถานะให้โดยเร็ว
                    {(slip.claimedAmountThb ?? slip.verifiedAmountThb) != null && <div>ยอดในสลิป ฿{baht((slip.claimedAmountThb ?? slip.verifiedAmountThb) as number)}</div>}
                    {slip.senderName && <div>ผู้โอน {slip.senderName}</div>}
                  </div>
                )}
                {slip?.status === "rejected" && (
                  <div className="kfc-result kfc-rejected" role="alert" data-testid="status-payment-rejected">
                    <strong>ตรวจสอบสลิปไม่สำเร็จ</strong>
                    {slip.slipokErrorCode
                      ? `ไม่สามารถยืนยันรายการนี้ได้ (${slip.slipokErrorCode}) กรุณาตรวจสอบยอดและแนบสลิปที่ชัดเจนอีกครั้ง`
                      : "กรุณาตรวจสอบยอดชำระ แล้วแนบภาพสลิปที่ชัดเจนอีกครั้ง"}
                  </div>
                )}
                <button
                  id="button-submit-checkout-slip"
                  className="kfc-button"
                  type="submit"
                  disabled={!selectedFile || submitSlip.isPending || qrLoading || !qr}
                  data-testid="button-submit-checkout-slip"
                >
                  {submitSlip.isPending ? "กำลังตรวจสอบสลิป…" : "🚀 ยืนยันการชำระเงิน"}
                </button>
              </form>
              <p className="kfc-note">ระบบจะตรวจสอบข้อมูลจากสลิปโดยอัตโนมัติ กรุณาโอนตามยอดที่แสดงใน QR นี้</p>
            </div>

            <aside className="kfc-qr-panel" aria-label="PromptPay QR สำหรับชำระเงิน" data-testid="panel-promptpay-qr">
              <p className="kfc-section-label">PromptPay · {paymentOptions.find((option) => option.type === paymentType)?.shortLabel}</p>
              <div className="kfc-qr-box" aria-live="polite" data-testid="display-promptpay-qr">
                {qrLoading ? <div className="kfc-qr-loading" aria-label="กำลังสร้าง QR" data-testid="loading-promptpay-qr" /> :
                  qrImage ? <img src={qrImage} alt={`PromptPay QR ยอด ${baht(qr?.amountThb ?? 0)} บาท`} data-testid="image-promptpay-qr" /> :
                    <span aria-hidden="true">QR</span>}
              </div>
              {qrError && (
                <div className="kfc-error" role="alert" data-testid="error-promptpay-qr">
                  {qrError}
                  <button type="button" className="kfc-button kfc-download" onClick={() => void requestQr(paymentType)} data-testid="button-retry-promptpay-qr">ลองสร้าง QR อีกครั้ง</button>
                </div>
              )}
              <p className="kfc-qr-caption" data-testid="text-qr-instructions">
                {qr ? `สแกนเพื่อชำระ ฿${baht(qr.amountThb)} · QR นี้สร้างสำหรับยอดที่เลือก` : "QR จะสร้างตามยอดชำระที่เลือก"}
              </p>
              <button
                className="kfc-button kfc-download"
                type="button"
                onClick={downloadQr}
                disabled={!qrImage}
                data-testid="button-download-promptpay-qr"
              >
                📥 บันทึกรูป QR ลงมือถือ
              </button>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}