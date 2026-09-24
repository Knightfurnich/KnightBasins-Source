import { useEffect, useRef, useState } from "react";
import { Film, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadVideoFile } from "./imageUploadClient";

type VideoUploadFieldProps = {
  value?: string | null;
  onChange: (value: string) => void;
  label: string;
};

export function VideoUploadField({ value, onChange, label }: VideoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!previewUrl?.startsWith("blob:")) setPreviewUrl(value || null);
  }, [value, previewUrl]);

  useEffect(() => () => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleFile = async (file: File) => {
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl((previous) => {
      if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
      return localPreview;
    });
    setError(null);
    setIsUploading(true);

    try {
      const uploadedUrl = await uploadVideoFile(file);
      onChange(uploadedUrl);
      setPreviewUrl(uploadedUrl);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "อัปโหลดวิดีโอไม่สำเร็จ");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="admin-upload-field space-y-2">
      <span className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">{label}</span>
      <div className="admin-upload-shell flex flex-col gap-3 rounded-none border border-[var(--line)] bg-[rgba(255,255,255,0.72)] p-3 sm:flex-row sm:items-center">
        <div className="admin-upload-preview flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden border border-[var(--line)] bg-[var(--paper)]">
          {previewUrl ? (
            <video src={previewUrl} controls preload="metadata" className="h-full w-full object-cover" aria-label="ตัวอย่างวิดีโอสินค้า" />
          ) : (
            <Film className="h-7 w-7 text-[var(--ink-soft)]" />
          )}
        </div>
        <div className="admin-upload-copy space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="rounded-none border-[var(--line)]"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            {isUploading ? "กำลังอัปโหลด..." : "อัปโหลดวิดีโอ"}
          </Button>
          <p className="text-xs text-[var(--ink-soft)]">MP4, WEBM หรือ MOV ไม่เกิน 100 MB · เล่นตัวอย่างได้ทันที</p>
          {error && <p className="text-xs text-[#a24439]">{error}</p>}
          {value && <p className="max-w-[28rem] break-all text-[12px] text-[var(--ink-soft)]">{value}</p>}
        </div>
      </div>
    </div>
  );
}