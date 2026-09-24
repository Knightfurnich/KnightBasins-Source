import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadImageFile } from "./imageUploadClient";

type ImageUploadFieldProps = {
  value?: string | null;
  onChange: (value: string) => void;
  label: string;
};

export function ImageUploadField({ value, onChange, label }: ImageUploadFieldProps) {
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
      const uploadedUrl = await uploadImageFile(file);
      onChange(uploadedUrl);
      setPreviewUrl(uploadedUrl);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "อัปโหลดรูปภาพไม่สำเร็จ");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="admin-upload-field space-y-2">
      <span className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">{label}</span>
      <div className="admin-upload-shell flex flex-col gap-3 rounded-none border border-[var(--line)] bg-[rgba(255,255,255,0.72)] p-3 sm:flex-row sm:items-center">
        <div className="admin-upload-preview flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden border border-[var(--line)] bg-[var(--paper)]">
          {previewUrl ? (
            <img src={previewUrl} alt="ตัวอย่างรูปภาพสินค้า" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-7 w-7 text-[var(--ink-soft)]" />
          )}
        </div>
        <div className="admin-upload-copy space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
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
            {isUploading ? "กำลังอัปโหลด..." : "อัปโหลดรูปภาพ"}
          </Button>
          <p className="text-xs text-[var(--ink-soft)]">JPG, PNG, WEBP หรือ GIF ไม่เกิน 10 MB · แสดงตัวอย่างทันที</p>
          {error && <p className="text-xs text-[#a24439]">{error}</p>}
          {value && <p className="max-w-[28rem] break-all text-[12px] text-[var(--ink-soft)]">{value}</p>}
        </div>
      </div>
    </div>
  );
}