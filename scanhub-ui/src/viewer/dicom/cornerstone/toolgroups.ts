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
  EraserTool,
  LivewireContourTool,
} from '@cornerstonejs/tools';
import type { ComponentType } from 'react'
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
// import { deepMerge } from '@cornerstonejs/core/utilities';


const TOOL_GROUP_ID = 'linked';


// // Update default tool style
// const customStyle = {
//   global: {
//     color: '#6c757d',
//     colorActive: '#0d6efd',
//     lineWidth: '2',
//   }
// };
// annotation.config.style.setDefaultToolStyles(deepMerge(customStyle, annotation.config.style.getDefaultToolStyles()));


// Declare cornerstone tool class
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

export function registerDefaultTools() {
  addTool(CrosshairsTool);
  addTool(ReferenceLinesTool);
  tools.forEach(({Tool}) => ( addTool(Tool) ))
}

/**
 * (Re)creates a tool group with the given id and returns the id.
 * If a group with the same id exists, it is destroyed first.
 */
export function getLinkedToolGroup() {

  const existing = ToolGroupManager.getToolGroup(TOOL_GROUP_ID);
  if (existing) return existing;

  const toolGroup = ToolGroupManager.createToolGroup(TOOL_GROUP_ID);
  if (!toolGroup) throw new Error('Failed to create ToolGroup');

  // Add tools to this group by their static toolName
  toolGroup.addTool(CrosshairsTool.toolName);
  toolGroup.addTool(ReferenceLinesTool.toolName);
  tools.forEach(({Tool}) => ( toolGroup.addTool(Tool.toolName) ))

  // Activate with sensible bindings:
  // Left mouse: Window/Level
  toolGroup.setToolActive(WindowLevelTool.toolName, {
    bindings: [{ mouseButton: Enums.MouseBindings.Primary }],
  });

  // Right mouse: Pan
  toolGroup.setToolActive(PanTool.toolName, {
    bindings: [{ mouseButton: Enums.MouseBindings.Secondary }],
  });

  // Ctrl + Left mouse: Zoom
  toolGroup.setToolActive(ZoomTool.toolName, {
    bindings: [
      {
        mouseButton: Enums.MouseBindings.Primary,
        modifierKey: Enums.KeyboardBindings.Ctrl,
      },
    ],
  });

  // Mouse Wheel: Stack Scroll
  toolGroup.setToolActive(StackScrollTool.toolName, {
    bindings: [{ mouseButton: Enums.MouseBindings.Wheel }],
  });

  // Overlay/sync tools enabled
  // toolGroup.setToolEnabled(ReferenceLinesTool.toolName);
  // toolGroup.setToolEnabled(CrosshairsTool.toolName);

  return toolGroup;
}


/** Attach all current viewports to the shared group. */
export function attachViewportsToLinkedGroup(renderingEngineId: string, viewportIds: string[]) {
  const toolGroup = getLinkedToolGroup();
  viewportIds.forEach((vpId) => toolGroup.addViewport(vpId, renderingEngineId));
}

/** Detach & destroy the shared group (safe to call at unmount). */
export function destroyLinkedToolGroup() {
  const existing = ToolGroupManager.getToolGroup(TOOL_GROUP_ID);
  if (existing) ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID);
}
