import React from 'react';
import { SvgIcon, type SvgIconProps } from '@mui/material';

/**
 * A square grid icon representing layout patterns (e.g., 1x1, 1x3, 2x2).
 * Keeps consistent aspect ratio across all variants.
 */
export function GridIcon({ rows, cols, ...props }: SvgIconProps & { rows: number; cols: number }) {
  const viewBoxSize = 24;       // Material icon box

  // Compute cell size and spacing to fit inner square
  const gapRatio = 0.2; // relative gap between cells
  const totalGapX = (cols - 1) * gapRatio;
  const totalGapY = (rows - 1) * gapRatio;

  const cellWidth = viewBoxSize / (cols + totalGapX);
  const cellHeight = viewBoxSize / (rows + totalGapY);
  const gapX = cellWidth * gapRatio;
  const gapY = cellHeight * gapRatio;
  const rx = Math.min(cellWidth, cellHeight) * 0.3; // rounded corners

  const rects = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * (cellWidth + gapX);
      const y = r * (cellHeight + gapY);
      rects.push(
        <rect
          key={`${r}-${c}`}
          x={x}
          y={y}
          width={cellWidth}
          height={cellHeight}
          rx={rx}
          ry={rx}
          fill="currentColor"
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
