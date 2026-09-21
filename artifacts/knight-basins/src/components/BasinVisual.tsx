import { useState, type CSSProperties } from "react";

type BasinVisualProps = {
  tone: string;
  imageUrl?: string;
  hoverImageUrl?: string;
  alt?: string;
  tall?: boolean;
  className?: string;
};

export function BasinVisual({ tone, imageUrl, hoverImageUrl, alt, tall = false, className = "" }: BasinVisualProps) {
  const normalizedImageUrl = imageUrl?.trim();
  const normalizedHoverImageUrl = hoverImageUrl?.trim();
  const [imageFailed, setImageFailed] = useState(false);
  const [hoverImageFailed, setHoverImageFailed] = useState(false);
  const showImage = Boolean(normalizedImageUrl) && !imageFailed;
  const showHoverImage = showImage
    && Boolean(normalizedHoverImageUrl)
    && normalizedHoverImageUrl !== normalizedImageUrl
    && !hoverImageFailed;
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
      <div className="basin-shadow" />
      {!showImage && (
        <>
          <div className="basin-body"><div className="basin-bowl" /><div className="basin-drain" /></div>
          {tall && <div className="basin-stem" />}
        </>
      )}
      {normalizedImageUrl && (
        <img
          className="basin-image"
          src={normalizedImageUrl}
          alt={alt ?? ""}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      )}
      {showHoverImage && (
        <img
          className="basin-image basin-image--hover"
          src={normalizedHoverImageUrl}
          alt=""
          loading="lazy"
          onError={() => setHoverImageFailed(true)}
        />
      )}
    </div>
  );
}