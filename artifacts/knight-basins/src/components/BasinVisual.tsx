import { useEffect, useState, type CSSProperties, type SyntheticEvent } from "react";

type BasinVisualProps = {
  tone: string;
  imageUrl?: string;
  fallbackImageUrl?: string;
  alt?: string;
  tall?: boolean;
  className?: string;
};

export function BasinVisual({ tone, imageUrl, fallbackImageUrl, alt, tall = false, className = "" }: BasinVisualProps) {
  const normalizedImageUrl = imageUrl?.trim();
  const normalizedFallbackImageUrl = fallbackImageUrl?.trim();
  const localCutoutMatch = normalizedImageUrl?.match(/(?:^|\/)basin-cutouts\/([^/?#]+)\.png(?:[?#].*)?$/i);
  const inferredFallbackImageUrl = localCutoutMatch
    ? `/basin-originals/${localCutoutMatch[1]}.jpg`
    : undefined;
  const effectiveFallbackImageUrl = normalizedFallbackImageUrl || inferredFallbackImageUrl;
  const [activeImageUrl, setActiveImageUrl] = useState(normalizedImageUrl);
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(activeImageUrl) && !imageFailed;

  useEffect(() => {
    setActiveImageUrl(normalizedImageUrl);
    setImageFailed(false);
  }, [effectiveFallbackImageUrl, normalizedImageUrl]);

  const handleImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    const failedUrl = event.currentTarget.getAttribute("src")?.trim()
      || event.currentTarget.currentSrc
      || event.currentTarget.src;
    if (activeImageUrl && failedUrl && failedUrl !== activeImageUrl) {
      setImageFailed(true);
      return;
    }
    if (activeImageUrl && effectiveFallbackImageUrl && activeImageUrl !== effectiveFallbackImageUrl) {
      setActiveImageUrl(effectiveFallbackImageUrl);
      return;
    }
    setImageFailed(true);
  };

  const visualClassName = [
    "basin-visual",
    tall ? "basin-visual--tall" : "",
    showImage ? "basin-visual--image" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div
      className={visualClassName}
      style={{ "--basin-tone": tone } as CSSProperties & { "--basin-tone": string }}
      data-has-image={showImage ? "true" : "false"}
    >
      {!showImage && (
        <>
          <div className="basin-body"><div className="basin-bowl" /><div className="basin-drain" /></div>
          {tall && <div className="basin-stem" />}
        </>
      )}
      {activeImageUrl && (
        <img
          className="basin-image"
          src={activeImageUrl}
          alt={alt ?? ""}
          loading="lazy"
          onError={handleImageError}
        />
      )}
    </div>
  );
}