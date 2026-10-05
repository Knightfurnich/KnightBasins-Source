/**
 * ใบงาน 266 (บอย) — หน้าทดสอบ "จับคู่สีหินจากภาพ" (/admin/stone-match)
 *
 * อัปโหลด/ลากภาพ 1 ใบ → POST /api/admin/stone-match → แสดงรหัสสี + ชื่อ + เหตุผล + ความมั่นใจ
 *  - ผลว่าง → บอกตรง ๆ ว่า "ไม่พบสีที่ใกล้เคียงจากภาพนี้" (ห้ามเดาสี)
 *  - สีที่ไม่มีภาพอ้างอิงหิน → ระบุตรง ๆ ว่ายังไม่มีภาพอ้างอิง (ห้ามทำให้เข้าใจผิดว่าเทียบแล้ว)
 *  - ข้อความผิดพลาดเป็นภาษาไทยทั้งหมด · ไม่ฝังชื่อโมเดล/คีย์/ค่า env ใด ๆ
 *  - ห้ามแตะ src/index.css — ใช้ CSS variables ของธีมแอ็ดมินที่มีอยู่เท่านั้น
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

type StoneMatchItem = {
  code: string;
  name: string;
  reason: string;
  /** contract ปัจจุบันไม่มีคะแนนความมั่นใจ — แสดงเป็น "—" ห้ามแต่งตัวเลขขึ้นเอง */
  confidence: string | null;
  hasSlabReference: boolean;
};

type StoneMatchResponse = {
  ok: boolean;
  code?: string;
  message?: string;
  matches?: StoneMatchItem[];
  dataAsOf?: string;
};

const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FALLBACK_ERROR = "ไม่สามารถจับคู่สีหินจากภาพได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง";

function validateImageFile(file: File): string | null {
  if (!ACCEPTED_MIME_TYPES.has(file.type)) {
    return "รองรับเฉพาะไฟล์ภาพ JPG, PNG หรือ WEBP เท่านั้น";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "ภาพมีขนาดใหญ่เกิน 8 MB กรุณาลดขนาดภาพแล้วลองใหม่";
  }
  return null;
}

function formatDataAsOf(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

export function StoneMatchPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState<StoneMatchItem[] | null>(null);
  const [dataAsOf, setDataAsOf] = useState<string | undefined>(undefined);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const chooseFile = (nextFile: File | null | undefined) => {
    if (!nextFile) return;
    const validationError = validateImageFile(nextFile);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setMatches(null);
    setHasSearched(false);
    setDataAsOf(undefined);
    setFile(nextFile);
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(nextFile);
    });
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    chooseFile(event.dataTransfer.files?.[0]);
  };

  const runMatch = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError("");
    setMatches(null);
    setHasSearched(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/stone-match", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as StoneMatchResponse | null;
      if (!response.ok) {
        setError(payload?.message || FALLBACK_ERROR);
        setHasSearched(false);
        return;
      }
      if (!payload || payload.ok !== true) {
        // matcher ปิด / ยิงไม่ผ่าน: เซิร์ฟเวอร์ส่งข้อความไทยมาให้ ห้ามเดาคำตอบเอง
        setError(payload?.message || FALLBACK_ERROR);
        setHasSearched(false);
        return;
      }
      setMatches(payload.matches ?? []);
      setDataAsOf(payload.dataAsOf);
    } catch {
      setError(FALLBACK_ERROR);
      setHasSearched(false);
    } finally {
      setLoading(false);
    }
  };

  const stamp = formatDataAsOf(dataAsOf);

  return (
    <div className="flex flex-col gap-6 max-w-3xl" data-testid="admin-stone-match-page">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">จับคู่สีหินจากภาพ</h1>
        <p className="text-sm text-[var(--ink-soft)]">
          อัปโหลดภาพห้องหรือภาพหิน เพื่อค้นหาสีหินที่ใกล้เคียงที่สุดจากสีที่มีในระบบ (สูงสุด 3 อันดับ
          พร้อมเหตุผลประกอบ) — ระบบจะไม่เดาสีที่ไม่พบจากภาพ
        </p>
      </header>

      <section
        className="border border-dashed border-[var(--line)] bg-[var(--card-paper)] p-6 flex flex-col items-center gap-4 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        data-testid="stone-match-dropzone"
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="ภาพที่เลือกเพื่อเปรียบเทียบ"
            className="max-h-64 max-w-full object-contain border border-[var(--line)]"
          />
        ) : (
          <UploadCloud className="w-8 h-8 text-[var(--ink-soft)]" aria-hidden="true" />
        )}

        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-[var(--ink-soft)]">
            {file ? file.name : "ลากภาพมาวางที่นี่ หรือเลือกไฟล์จากเครื่อง"}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            data-testid="stone-match-file-input"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
          >
            {file ? "เปลี่ยนภาพ" : "เลือกภาพ"}
          </Button>
          <p className="text-xs text-[var(--ink-soft)]">รองรับ JPG · PNG · WEBP ขนาดไม่เกิน 8 MB</p>
        </div>

        <Button
          type="button"
          className="rounded-none"
          disabled={!file || loading}
          onClick={() => void runMatch()}
          data-testid="stone-match-submit"
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
          {loading ? "กำลังเปรียบเทียบ..." : "เปรียบเทียบสีหิน"}
        </Button>
      </section>

      {loading && (
        <section
          className="border border-[var(--line)] bg-[var(--card-paper)] p-4 text-sm text-[var(--ink-soft)]"
          data-testid="stone-match-loading"
        >
          <Loader2 className="w-4 h-4 mr-2 animate-spin inline align-middle" aria-hidden="true" />
          กำลังเปรียบเทียบกับภาพหินอ้างอิงทั้งแคตตาล็อก — อาจใช้เวลา 1-2 นาที
        </section>
      )}

      {error && (
        <section
          className="border border-[var(--line)] bg-[var(--card-paper)] p-4 text-sm"
          data-testid="stone-match-error"
          role="alert"
        >
          {error}
        </section>
      )}

      {!loading && !error && hasSearched && matches !== null && matches.length === 0 && (
        <section
          className="border border-[var(--line)] bg-[var(--card-paper)] p-4 text-sm"
          data-testid="stone-match-empty"
        >
          ไม่พบสีที่ใกล้เคียงจากภาพนี้
        </section>
      )}

      {!loading && matches !== null && matches.length > 0 && (
        <section className="flex flex-col gap-3" data-testid="stone-match-results">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink-soft)]">
              สีที่ใกล้เคียงที่สุด
            </h2>
            {stamp && <span className="text-xs text-[var(--ink-soft)]">ผลลัพธ์ ณ {stamp}</span>}
          </div>
          {matches.map((match, index) => (
            <article
              key={match.code}
              className="border border-[var(--line)] bg-[var(--card-paper)] p-4 flex flex-col gap-2"
              data-testid="stone-match-result-item"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-[var(--ink-soft)]">อันดับ {index + 1}</span>
                <code className="font-mono text-sm border border-[var(--line)] px-2 py-0.5">{match.code}</code>
                <strong className="text-sm">{match.name}</strong>
              </div>
              <p className="text-sm text-[var(--ink)]">{match.reason || "ไม่มีเหตุผลประกอบจากระบบ"}</p>
              <div className="flex items-center gap-4 flex-wrap text-xs text-[var(--ink-soft)]">
                <span title="โมเดลไม่ได้ส่งคะแนนความมั่นใจมาในการเทียบครั้งนี้">
                  ความมั่นใจ: {match.confidence ?? "—"}
                </span>
                {!match.hasSlabReference && (
                  <span className="text-[var(--saffron)]" data-testid="stone-match-no-reference">
                    ยังไม่มีภาพอ้างอิงหินสำหรับสีนี้
                  </span>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

export default StoneMatchPage;
