/**
 * Copyright (C) 2024, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
 * SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
 *
 * toolgroups.ts registers all the tools and create a linked tool group.
 */
import {
  addTool,
  Enums,
  ToolGroupManager,
  PanTool,
  PlanarRotateTool,
  ZoomTool,
  WindowLevelTool,
  SynchronizerManager,
  StackScrollTool,
  CrosshairsTool,
  ReferenceLinesTool,
  HeightTool,
  LengthTool,
  RectangleROITool,
  EllipticalROITool,
  CircleROIStartEndThresholdTool,
  ProbeTool,
  BidirectionalTool,
  TrackballRotateTool,
  EraserTool,
  LivewireContourTool,
} from '@cornerstonejs/tools';
import type { ComponentType } from 'react'
import { createVOISynchronizer } from '@cornerstonejs/tools/synchronizers';
import OpenInFullSharpIcon from '@mui/icons-material/OpenInFullSharp';
import ContrastSharpIcon from '@mui/icons-material/ContrastSharp'
import ZoomInSharpIcon from '@mui/icons-material/ZoomInSharp'
import ControlCameraSharpIcon from '@mui/icons-material/ControlCameraSharp';
import HeightSharpIcon from '@mui/icons-material/HeightSharp';
import ReorderSharpIcon from '@mui/icons-material/ReorderSharp';
import CropSquareSharpIcon from '@mui/icons-material/CropSquareSharp';
import JoinInnerSharpIcon from '@mui/icons-material/JoinInnerSharp';
import ScreenRotationSharpIcon from '@mui/icons-material/ScreenRotationSharp';
import RadioButtonUncheckedSharpIcon from '@mui/icons-material/RadioButtonUncheckedSharp';
import ModeStandbySharpIcon from '@mui/icons-material/ModeStandbySharp';
import PolylineSharpIcon from '@mui/icons-material/PolylineSharp';
import SwapHorizSharpIcon from '@mui/icons-material/SwapHorizSharp';
import ClearSharpIcon from '@mui/icons-material/ClearSharp';
import type { SvgIconProps } from '@mui/material/SvgIcon'

import { ViewDefinition } from './viewLayouts';

export const TOOL_GROUP_ID = 'tg-min';
export const TOOL_GROUP_ID_3D = 'tg-3d';
const WL_SYNC = 'wl-sync'


// // Update default tool style
// const customStyle = {
//   global: {
//     color: '#6c757d',
//     colorActive: '#0d6efd',
//     lineWidth: '2',
//   }
// };
// annotation.config.style.setDefaultToolStyles(deepMerge(customStyle, annotation.config.style.getDefaultToolStyles()));


// --- Tool list ---
type CornerstoneToolClass = { toolName: string; new (...args: any[]): any }

type ToolDefinition = {
  Tool: CornerstoneToolClass;
  Icon: ComponentType<SvgIconProps> 
  label?: string;
};

export const tools: ToolDefinition[] = [
  { Tool: PanTool, Icon: ControlCameraSharpIcon, label: 'Pan' },
  { Tool: PlanarRotateTool, Icon: ScreenRotationSharpIcon, label: 'Rotate' },
  { Tool: ZoomTool, Icon: ZoomInSharpIcon, label: 'Zoom' },
  { Tool: WindowLevelTool, Icon: ContrastSharpIcon, label: 'W/L' },
  { Tool: StackScrollTool, Icon: ReorderSharpIcon, label: 'Slices' },
  { Tool: HeightTool, Icon: HeightSharpIcon, label: 'Measure height' },
  { Tool: LengthTool, Icon: OpenInFullSharpIcon, label: 'Measure length' },
  { Tool: RectangleROITool, Icon: CropSquareSharpIcon, label: 'Rectangle ROI' },
  { Tool: EllipticalROITool, Icon: RadioButtonUncheckedSharpIcon, label: 'Ellipticle ROI' },
  { Tool: CircleROIStartEndThresholdTool, Icon: JoinInnerSharpIcon, label: 'Circle ROI start-end threshold' },
  { Tool: LivewireContourTool, Icon: PolylineSharpIcon, label: 'Livewire' },
  { Tool: ProbeTool, Icon: ModeStandbySharpIcon, label: 'Probe' },
  { Tool: BidirectionalTool, Icon: SwapHorizSharpIcon, label: 'Bidirectional' },
  { Tool: EraserTool, Icon: ClearSharpIcon, label: 'Erase' },

  
];

// --- Tool registration
export function registerDefaultTools() {
  addTool(CrosshairsTool);
  addTool(ReferenceLinesTool);
  addTool(TrackballRotateTool);
  tools.forEach(({ Tool }) => addTool(Tool));
}


// --- Setup synchronizer
function getWindowLevelSync() {
  let sync = SynchronizerManager.getSynchronizer(WL_SYNC);
  if (!sync) {
    sync = createVOISynchronizer(WL_SYNC, {syncInvertState: true, syncColormap: false});
  }
  return sync;
}


/**
 * (Re)creates a synchronized ToolGroup with crosshair + reference line support.
 */
export function getToolGroup() {
  const existing = ToolGroupManager.getToolGroup(TOOL_GROUP_ID);
  if (existing) return existing;

  const toolGroup = ToolGroupManager.createToolGroup(TOOL_GROUP_ID);
  if (!toolGroup) throw new Error('Failed to create ToolGroup');

  // Add base and sync tools
  toolGroup.addTool(CrosshairsTool.toolName);
  toolGroup.addTool(ReferenceLinesTool.toolName);
  tools.forEach(({ Tool }) => toolGroup.addTool(Tool.toolName));

  // --- Input bindings ---
  toolGroup.setToolActive(WindowLevelTool.toolName, {
    bindings: [{ mouseButton: Enums.MouseBindings.Primary }],
  });
  toolGroup.setToolActive(PanTool.toolName, {
    bindings: [{ mouseButton: Enums.MouseBindings.Secondary }],
  });
  toolGroup.setToolActive(ZoomTool.toolName, {
    bindings: [
      { mouseButton: Enums.MouseBindings.Primary, modifierKey: Enums.KeyboardBindings.Ctrl },
    ],
  });
  toolGroup.setToolActive(StackScrollTool.toolName, {
    bindings: [{ mouseButton: Enums.MouseBindings.Wheel }],
  });

  // --- Synchronization tools: Default is disabled, enable dynamically
  toolGroup.setToolDisabled(ReferenceLinesTool.toolName);
  toolGroup.setToolDisabled(CrosshairsTool.toolName);

  // Configuration
  toolGroup.setToolConfiguration(ReferenceLinesTool.toolName, {
    getReferenceLineColor: () => '#0d6efd',
  });

  toolGroup.setToolConfiguration(CrosshairsTool.toolName, {
    autoPan: true,
    autoPanSpeed: 0.2,
    autoPanSmooth: true,
    centerCrosshairsOnNewImage: true,
    getReferenceLineColor: () => 'rgba(255,0,0,0.75)',
  });

  return toolGroup;
}



export function get3DToolGroup() {
  const existing = ToolGroupManager.getToolGroup(TOOL_GROUP_ID_3D);
  if (existing) return existing;

  const toolGroup = ToolGroupManager.createToolGroup(TOOL_GROUP_ID_3D);
  if (!toolGroup) throw new Error('Failed to create 3D ToolGroup');

  toolGroup.addTool(TrackballRotateTool.toolName);
  toolGroup.addTool(PanTool.toolName);
  toolGroup.addTool(ZoomTool.toolName);

  // Set 3D-specific bindings
  toolGroup.setToolActive(TrackballRotateTool.toolName, {
    bindings: [{ mouseButton: Enums.MouseBindings.Primary }],
  });
  toolGroup.setToolActive(PanTool.toolName, {
    bindings: [{ mouseButton: Enums.MouseBindings.Secondary }],
  });
  toolGroup.setToolActive(ZoomTool.toolName, {
    bindings: [{ mouseButton: Enums.MouseBindings.Wheel }],
  });

  return toolGroup;
}


/**
 * Attaches the correct tool groups for the current layout.
 * Handles 2D-only layouts and mixed (2D + 3D) layouts automatically.
 */
export async function attachToolGroupsForLayout(
  views: ViewDefinition[],
  renderingEngineId: string,
) {
  const toolGroup = getToolGroup();
  const toolGroup3D = get3DToolGroup();
  if (!toolGroup || !toolGroup3D) return;

  // Remove any previous viewports before reattaching
  toolGroup.removeViewports(renderingEngineId);
  toolGroup3D.removeViewports(renderingEngineId);

  // Get window level synchronization and remove any existing viewports
  const wlSync = getWindowLevelSync();
  wlSync.getSourceViewports().forEach((vp) => wlSync.removeSource(vp))
  wlSync.getTargetViewports().forEach((vp) => wlSync.removeTarget(vp))

  for (const view of views) {
    // Setup synchronization for given viewports
    wlSync.addSource({viewportId: view.id, renderingEngineId})
    wlSync.addTarget({viewportId: view.id, renderingEngineId})

    if (view.is3D) {
      toolGroup3D.addViewport(view.id, renderingEngineId)
    } else {
      toolGroup.addViewport(view.id, renderingEngineId)
    }
  }

  // Dynamically activate crosshairs
  if (views.filter(v => !v.is3D).length >= 2) {
    toolGroup.setToolEnabled(CrosshairsTool.toolName);
    toolGroup.setToolEnabled(ReferenceLinesTool.toolName);
  } else {
    toolGroup.setToolDisabled(CrosshairsTool.toolName);
    toolGroup.setToolDisabled(ReferenceLinesTool.toolName);
  }

}


/** Detach & destroy the shared groups. */
export function destroyToolGroups() {
  const existing = ToolGroupManager.getToolGroup(TOOL_GROUP_ID);
  if (existing) ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID);
  const existing_3d = ToolGroupManager.getToolGroup(TOOL_GROUP_ID_3D);
  if (existing_3d) ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID_3D);
}