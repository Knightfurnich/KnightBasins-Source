import { useRef, useState } from "react";
import { Camera, ImagePlus, Trash2, X } from "lucide-react";

interface SitePhotoUploadProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
}

export function SitePhotoUpload({
  photos,
  onChange,
  maxPhotos = 4,
}: SitePhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);

  const processFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    try {
      const remainingSlots = maxPhotos - photos.length;
      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      const newUrls = await Promise.all(filesToProcess.map(processFile));
      onChange([...photos, ...newUrls]);
    } catch (err) {
      console.error("Error processing photos:", err);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = (index: number) => {
    const next = photos.filter((_, i) => i !== index);
    onChange(next);
  };

  return (
    <div className="site-photo-upload-container" data-testid="section-site-photo-upload">
      <div className="site-photo-header">
        <div>
          <strong className="site-photo-title">ภาพถ่ายหน้างานจริง / แปลนมือวาด</strong>
          <small className="site-photo-subtitle">
            แนบภาพห้องน้ำ จุดติดตั้ง หรือแปลนร่าง เพื่อให้ช่างและฝ่ายผลิตประเมินได้แม่นยำ (สูงสุด {maxPhotos} ภาพ)
          </small>
        </div>
        {photos.length < maxPhotos && (
          <button
            type="button"
            className="button button--secondary button--compact site-photo-add-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            data-testid="button-add-site-photo"
          >
            <Camera size={14} />
            <span>{isProcessing ? "กำลังแปลงภาพ..." : "ถ่ายรูป / เลือกภาพ"}</span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        style={{ display: "none" }}
        onChange={handleFiles}
        data-testid="input-site-photo-file"
      />

      {photos.length > 0 ? (
        <div className="site-photo-grid" data-testid="grid-site-photos">
          {photos.map((url, idx) => (
            <div key={idx} className="site-photo-item" data-testid={`item-site-photo-${idx}`}>
              <img
                src={url}
                alt={`ภาพหน้างาน ${idx + 1}`}
                className="site-photo-thumb"
                onClick={() => setSelectedPreview(url)}
              />
              <button
                type="button"
                className="site-photo-delete-btn"
                onClick={() => handleRemove(idx)}
                aria-label="ลบรูป"
                title="ลบรูปนี้"
                data-testid={`button-delete-site-photo-${idx}`}
              >
                <Trash2 size={13} />
              </button>
              <span className="site-photo-badge">{idx + 1}</span>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="site-photo-dropzone"
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <ImagePlus size={22} className="site-photo-empty-icon" />
          <p>แตะเพื่อถ่ายรูปหน้างานจริง หรือเลือกไฟล์ภาพแบบแปลน</p>
          <small>รองรับไฟล์ JPG, PNG (ระบบจะย่อขนาดให้อัตโนมัติ)</small>
        </div>
      )}

      {selectedPreview && (
        <div className="site-photo-modal" onClick={() => setSelectedPreview(null)}>
          <div className="site-photo-modal-content" onClick={(e) => e.stopPropagation()}>
            <img src={selectedPreview} alt="ภาพขยาย" />
            <button
              type="button"
              className="site-photo-modal-close"
              onClick={() => setSelectedPreview(null)}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
