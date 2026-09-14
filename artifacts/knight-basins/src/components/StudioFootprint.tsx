import type { CSSProperties, ReactNode } from "react";
import {
  counterBounds,
  counterClearanceRegions,
  counterRegions,
  counterShapeLabel,
  type StudioState,
} from "@/data/studio-model";

type StudioFootprintProps = {
  state: Pick<StudioState, "shape" | "dimensions">;
  className?: string;
  testId?: string;
  ariaLabel?: string;
  unsafe?: boolean;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  children?: ReactNode;
};

function regionStyle(
  region: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  bounds: { widthMm: number; heightMm: number },
): CSSProperties {
  return {
    left: `${(region.xMm / Math.max(1, bounds.widthMm)) * 100}%`,
    top: `${(region.yMm / Math.max(1, bounds.heightMm)) * 100}%`,
    width: `${(region.widthMm / Math.max(1, bounds.widthMm)) * 100}%`,
    height: `${(region.heightMm / Math.max(1, bounds.heightMm)) * 100}%`,
  };
}

export function StudioFootprint({
  state,
  className = "",
  testId,
  ariaLabel,
  unsafe = false,
  onDragOver,
  onDrop,
  children,
}: StudioFootprintProps) {
  const bounds = counterBounds(state.shape, state.dimensions);
  const regions = counterRegions(state.shape, state.dimensions);
  const clearanceRegions = counterClearanceRegions(state.shape, state.dimensions);
  return (
    <div
      className={`studio-canvas studio-canvas--${state.shape} ${unsafe ? "studio-canvas--unsafe" : ""} ${className}`}
      style={{ aspectRatio: `${Math.max(1, bounds.widthMm)} / ${Math.max(1, bounds.heightMm)}` }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-testid={testId}
      aria-label={ariaLabel}
    >
      {regions.map((region, index) => (
        <div
          key={`counter-region-${index}`}
          className="studio-counter-region"
          style={regionStyle(region, bounds)}
          aria-hidden="true"
        />
      ))}
      {clearanceRegions.map((region, index) => (
        <div
          key={`clearance-region-${index}`}
          className="studio-clearance-region"
          style={regionStyle(region, bounds)}
          aria-hidden="true"
        />
      ))}
      <span className="studio-canvas-label">{counterShapeLabel(state.shape, state.dimensions)}</span>
      {children}
    </div>
  );
}