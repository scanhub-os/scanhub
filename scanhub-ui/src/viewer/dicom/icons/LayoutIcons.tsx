import React from 'react';
import { SvgIcon, type SvgIconProps } from '@mui/material';

/**
 * A square grid icon representing layout patterns (e.g., 1x1, 1x3, 2x2).
 */
export function GridIcon({
  rows,
  cols,
  padding = 2,
  gap = 3,
  ...props
}: SvgIconProps & { rows: number; cols: number; padding?: number; gap?: number }) {
  const viewBoxSize = 24; // Material icon box

  // Compute cell size and spacing to fit inner square
  const usableSize = viewBoxSize - 2 * padding;

  const totalGapX = (cols - 1) * gap;
  const totalGapY = (rows - 1) * gap;

  const cellWidth = (usableSize - totalGapX) / cols;
  const cellHeight = (usableSize - totalGapY) / rows;
  const gapX = gap;
  const gapY = gap;
  const rx = Math.min(cellWidth, cellHeight) * 0.3; // rounded corners

  const rects = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = padding + c * (cellWidth + gapX);
      const y = padding + r * (cellHeight + gapY);
      rects.push(
        <rect
          key={`${r}-${c}`}
          x={x}
          y={y}
          width={cellWidth}
          height={cellHeight}
          rx={rx}
          ry={rx}
          // fill="currentColor"
          fill="transparent"
          stroke="currentColor"
          strokeWidth={1.5}
        />
      );
    }
  }

  return (
    <SvgIcon {...props} viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}>
      {rects}
    </SvgIcon>
  );
}
