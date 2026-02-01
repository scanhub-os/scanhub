// Definition of the viewport layouts
import { Enums } from '@cornerstonejs/core';


export enum ViewLayout {
  Single = '1x1',
  OneByThree = '1x3',
  TwoByTwo = '2x2',
}

export type ViewDefinition = {
  id: string;
  orientation: Enums.OrientationAxis | null;
  is3D: boolean;
};

export const VIEW_LAYOUT_META = {
  [ViewLayout.Single]: { rows: 1, cols: 1 },
  [ViewLayout.OneByThree]: { rows: 1, cols: 3 },
  [ViewLayout.TwoByTwo]: { rows: 2, cols: 2 },
};

export const VIEW_LAYOUTS: Record<ViewLayout, ViewDefinition[]> = {
  [ViewLayout.Single]: [
    { id: 'single', orientation: null, is3D: false },
  ],
  [ViewLayout.OneByThree]: [
    { id: 'axial', orientation: Enums.OrientationAxis.AXIAL, is3D: false },
    { id: 'sagittal', orientation: Enums.OrientationAxis.SAGITTAL, is3D: false },
    { id: 'coronal', orientation: Enums.OrientationAxis.CORONAL, is3D: false },
  ],
  [ViewLayout.TwoByTwo]: [
    { id: 'axial', orientation: Enums.OrientationAxis.AXIAL, is3D: false },
    { id: 'sagittal', orientation: Enums.OrientationAxis.SAGITTAL, is3D: false },
    { id: 'coronal', orientation: Enums.OrientationAxis.CORONAL, is3D: false },
    { id: 'volume3D', orientation: null, is3D: true },
  ],
};

export type ViewportId = ViewDefinition['id'];
