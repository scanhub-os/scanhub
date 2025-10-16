import { Types } from '@cornerstonejs/core';

export const customPreset: Types.ViewportPreset = {
  name: 'MR-Thresholded',
  interpolation: '1',
  shade: '1000',          // enable shading
  ambient: '0.3',
  diffuse: '0.7',
  specular: '0.1',
  specularPower: '10',
  gradientOpacity: '4 0 0 100 0.5 500 1 2000 1',

  // scalarOpacity: <numPoints> <x1> <y1> <x2> <y2> ...
  // x = voxel intensity, y = opacity
  // Here: below 200 → 0; 200–500 → fade-in; >1000 → fully opaque
  scalarOpacity: '0 0 0 200 0 500 0.7 1000 0.8 2000 1',

  // grayscale color transfer function (flat 0–255 → white)
  // format: <numPoints> <x1> <r1> <g1> <b1> ...
  colorTransfer: '16 0 0 0 0 200 0 0 0 1000 1 1 1 2000 1 1 1',
};
