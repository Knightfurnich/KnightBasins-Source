import type { CSSProperties, ReactNode } from "react";
import {
  pieceBounds,
  studioPieceEdges,
  studioPieceJoints,
  studioRectangleSize,
  studioSideStatusLabel,
  type StudioPiece,
} from "@/data/studio-model";

type StudioFootprintProps = {
  piece: StudioPiece;
  className?: string;
  testId?: string;
  ariaLabel?: string;
  unsafe?: boolean;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  children?: ReactNode;
};

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
  className = "",
  testId,
  ariaLabel,
  unsafe = false,
  onDragOver,
  onDrop,
  children,
}: StudioFootprintProps) {
  const bounds = pieceBounds(piece);
  const joints = studioPieceJoints(piece);
  return (
    <div
      className={`studio-canvas studio-piece-canvas ${unsafe ? "studio-canvas--unsafe" : ""} ${className}`}
      style={{ aspectRatio: `${Math.max(1, bounds.widthMm)} / ${Math.max(1, bounds.heightMm)}` }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-testid={testId}
      aria-label={ariaLabel}
    >
      {piece.rectangles.map((rectangle) => (
        <div
          key={rectangle.id}
          className="studio-piece-rectangle"
          style={rectangleStyle(piece, rectangle, bounds)}
          aria-label={`${rectangle.widthMm} × ${rectangle.lengthMm} mm`}
        >
          <span className="studio-piece-size">{rectangle.widthMm} × {rectangle.lengthMm}</span>
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
  );
}