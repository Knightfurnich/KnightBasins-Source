import type { CSSProperties, ReactNode } from "react";
import {
  pieceBounds,
  studioPieceEdges,
  studioPieceJoints,
  studioRectangleSize,
  studioSideStatuses,
  studioSideStatusLabel,
  type StudioPiece,
  type SideStatus,
} from "@/data/studio-model";

type StudioFootprintProps = {
  piece: StudioPiece;
  stoneTone?: string;
  className?: string;
  testId?: string;
  ariaLabel?: string;
  unsafe?: boolean;
  zoom?: number;
  highlightRectangleId?: string | null;
  canvasPieceId?: string;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  edgeStatus?: SideStatus;
  onEdgeStatusChange?: (rectangleId: string, side: "top" | "right" | "bottom" | "left", status: SideStatus) => void;
  children?: ReactNode;
};

function stoneToneStyle(stoneTone?: string): CSSProperties {
  const tone = stoneTone?.trim();
  if (!tone) return {};
  const hex = tone.match(/^#([0-9a-f]{6})$/i);
  const channels = hex ? [0, 2, 4].map((offset) => Number.parseInt(hex[1].slice(offset, offset + 2), 16)) : null;
  const luminance = channels
    ? channels.reduce((sum, channel) => {
        const normalized = channel / 255;
        return sum + (normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4);
      }, 0)
    : 0.5;
  const dark = luminance < 0.42;
  return {
    ["--studio-stone-tone" as string]: tone,
    ["--studio-stone-ink" as string]: dark ? "#ffffff" : "#17324a",
    ["--studio-stone-edge" as string]: dark ? "rgba(255,255,255,.72)" : "rgba(23,50,74,.32)",
    ["--studio-stone-text-shadow" as string]: dark ? "0 1px 2px rgba(0,0,0,.8)" : "0 1px 2px rgba(255,255,255,.72)",
    ["--studio-joint-color" as string]: dark ? "#ffe08a" : "#704f00",
  };
}

function rectangleStyle(piece: StudioPiece, rectangle: StudioPiece["rectangles"][number], bounds: { widthMm: number; heightMm: number }): CSSProperties {
  const size = studioRectangleSize(rectangle);
  return {
    left: `${(rectangle.xMm / Math.max(1, bounds.widthMm)) * 100}%`,
    top: `${(rectangle.yMm / Math.max(1, bounds.heightMm)) * 100}%`,
    width: `${(size.widthMm / Math.max(1, bounds.widthMm)) * 100}%`,
    height: `${(size.heightMm / Math.max(1, bounds.heightMm)) * 100}%`,
    ["--piece-rotation" as string]: `${rectangle.rotation}deg`,
    ["--piece-status-top" as string]: studioSideStatusLabel(piece.sideStatuses[`${rectangle.id}:top`] ?? "normal"),
  };
}

export function StudioFootprint({
  piece,
  stoneTone,
  className = "",
  testId,
  ariaLabel,
  unsafe = false,
  zoom = 1,
  highlightRectangleId = null,
  canvasPieceId,
  onDragOver,
  onDrop,
  edgeStatus = "upstand",
  onEdgeStatusChange,
  children,
}: StudioFootprintProps) {
  const bounds = pieceBounds(piece);
  const joints = studioPieceJoints(piece);
  return (
    <div
      className={`studio-canvas studio-piece-canvas ${unsafe ? "studio-canvas--unsafe" : ""} ${className}`}
      style={{ aspectRatio: `${Math.max(1, bounds.widthMm)} / ${Math.max(1, bounds.heightMm)}`, ...stoneToneStyle(stoneTone) }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-testid={testId}
      data-studio-piece-id={canvasPieceId}
      aria-label={ariaLabel}
    >
      <div className="studio-canvas-stage" style={{ transform: `scale(${zoom})` }}>
        {piece.rectangles.map((rectangle) => (
          <div
            key={rectangle.id}
            className={`studio-piece-rectangle ${rectangle.id === highlightRectangleId ? "studio-piece-rectangle--highlight" : ""}`}
            style={rectangleStyle(piece, rectangle, bounds)}
            aria-label={`${rectangle.widthMm} × ${rectangle.lengthMm} mm`}
          >
            <span className="studio-piece-size">{rectangle.widthMm} × {rectangle.lengthMm}</span>
            {studioSideStatuses(piece, rectangle.id).map(({ side, status }) => {
              const sideLabel = side === "top" ? "ด้านบน" : side === "right" ? "ด้านขวา" : side === "bottom" ? "ด้านล่าง" : "ด้านซ้าย";
              const statusLabel = studioSideStatusLabel(status);
              if (!onEdgeStatusChange) {
                return status === "normal" ? null : (
                  <span
                    key={`${rectangle.id}-${side}-status`}
                    className={`studio-edge-marker studio-edge-marker--${side} studio-edge-marker--${status}`}
                    title={`${sideLabel}: ${statusLabel}`}
                    aria-label={`${sideLabel} ${statusLabel}`}
                  >
                    {statusLabel}
                  </span>
                );
              }
              return (
                <div key={`${rectangle.id}-${side}-status`} className={`studio-edge-marker studio-edge-marker--${side} studio-edge-marker--${status}`}>
                  <button
                    type="button"
                    className="studio-edge-marker-action"
                    title={`${sideLabel}: ${status === "normal" ? "คลิกเพื่อกำหนดสถานะขอบ" : statusLabel}`}
                    aria-label={`${sideLabel} ${status === "normal" ? "ปกติ · คลิกเพื่อกำหนดสถานะขอบ" : statusLabel}`}
                    data-testid={`studio-edge-marker-${rectangle.id}-${side}`}
                    onClick={() => onEdgeStatusChange(rectangle.id, side, edgeStatus)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      event.dataTransfer.dropEffect = "copy";
                    }}
                    onDrop={(event) => {
                      const droppedStatus = event.dataTransfer.getData("application/x-studio-edge-status");
                      if (!["upstand", "wall-flush", "wall-flush+upstand", "open-edge", "normal"].includes(droppedStatus)) return;
                      event.preventDefault();
                      event.stopPropagation();
                      onEdgeStatusChange(rectangle.id, side, droppedStatus as SideStatus);
                    }}
                  >
                    {status === "normal" ? <span aria-hidden="true">＋</span> : statusLabel}
                  </button>
                  {status !== "normal" && (
                    <button
                      type="button"
                      className="studio-edge-marker-clear"
                      aria-label={`ล้างสถานะขอบ${sideLabel.replace("ด้าน", "")}`}
                      title="ล้างสถานะขอบ"
                      data-testid={`button-clear-studio-edge-${rectangle.id}-${side}`}
                      onClick={() => onEdgeStatusChange(rectangle.id, side, "normal")}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {joints.map((joint) => {
          const vertical = joint.first.side === "left" || joint.first.side === "right";
          const xMm = vertical ? joint.first.start.xMm : Math.max(joint.first.start.xMm, joint.second.start.xMm);
          const yMm = vertical ? Math.max(joint.first.start.yMm, joint.second.start.yMm) : joint.first.start.yMm;
          const jointStyle: CSSProperties = {
            left: `${(xMm / Math.max(1, bounds.widthMm)) * 100}%`,
            top: `${(yMm / Math.max(1, bounds.heightMm)) * 100}%`,
            ...(vertical
              ? { height: `${(joint.lengthMm / Math.max(1, bounds.heightMm)) * 100}%` }
              : { width: `${(joint.lengthMm / Math.max(1, bounds.widthMm)) * 100}%` }),
          };
          return <span key={`${joint.first.key}-${joint.second.key}`} className={`studio-panel-joint ${vertical ? "is-vertical" : "is-horizontal"}`} style={jointStyle} title="ต่อแผ่นแล้วต้องได้ฉาก 90°" aria-label="ต่อแผ่นแล้วต้องได้ฉาก 90°" />;
        })}
        <span className="studio-canvas-label">{piece.name}</span>
        <span className="studio-joint-note">ต่อแผ่นแล้วต้องได้ฉาก 90°</span>
        {children}
      </div>
    </div>
  );
}