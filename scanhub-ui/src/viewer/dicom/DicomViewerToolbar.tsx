/**
 * Copyright (C) 2024, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
 * SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
 *
 * DicomViewerTools.tsx is responsible for rendering a toolbar for the dicom viewer.
 */
import React from 'react'

// Icons
// import Divider from '@mui/joy/Divider'
import IconButton from '@mui/joy/IconButton'
import ToggleButtonGroup from '@mui/joy/ToggleButtonGroup'
import Stack from '@mui/joy/Stack';
import Tooltip from '@mui/joy/Tooltip';
import Divider from '@mui/joy/Divider';
import { Enums } from '@cornerstonejs/tools';
import { getLinkedToolGroup, tools } from './cornerstone/toolgroups';


// Layout icons (you can pick from @mui/icons-material or any other)
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded';
import ViewComfyRoundedIcon from '@mui/icons-material/ViewComfyRounded';


interface DicomViewerToolbarProps {
  onLayoutChange: (layout: '1x1' | '1x3' | '2x2') => void;
  currentLayout: '1x1' | '1x3' | '2x2';
}



function DiconViewerToolbar({onLayoutChange, currentLayout}: DicomViewerToolbarProps) {
  const [activeTool, setActiveTool] = React.useState<string | null>(null)

	const toolGroup = React.useMemo(() => getLinkedToolGroup(), [])

  React.useEffect(() => {
    if (activeTool && toolGroup) {
      // Set all tools passive
      tools.forEach(({ Tool }) => toolGroup.setToolPassive(Tool.toolName, {removeAllBindings: [{ mouseButton: Enums.MouseBindings.Primary }]}));
      // Activate selected tool
      toolGroup.setToolActive(activeTool, {
				bindings: [{ mouseButton: Enums.MouseBindings.Primary }],
			});
    }
  }, [activeTool, toolGroup])

  return (
    <Stack direction="row" gap={2} sx={{ p: 0, m: 0 }}>

      {/* --- Layout Selection --- */}
      <ToggleButtonGroup
        variant="plain"
        spacing={0.5}
        value={currentLayout}
        onChange={(_event, layout: '1x1' | '1x3' | '2x2' | null) => {
          if (layout) onLayoutChange(layout);
        }}
        aria-label="layout selection"
      >
        <Tooltip title="Single View (1×1)" variant="soft">
          <IconButton value="1x1" aria-label="1x1 Layout">
            <GridViewRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Three Orthogonal Views (1×3)" variant="soft">
          <IconButton value="1x3" aria-label="1x3 Layout">
            <ViewComfyRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="MPR + 3D (2×2)" variant="soft">
          <IconButton value="2x2" aria-label="2x2 Layout">
            <ViewModuleRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </ToggleButtonGroup>

      <Divider orientation="vertical"/>

      <ToggleButtonGroup
        variant="plain"
        spacing={0.5}
        value={activeTool}
        onChange={(_event, tool: string | null) => {
          setActiveTool(tool) // tool may be null on deselect
        }}
        aria-label="viewer tools"
      >
        {tools.map(({ Tool, Icon, label }) => (
          <IconButton
            key={Tool.toolName}
            value={Tool.toolName}
            aria-label={label ?? Tool.toolName}
            title={label ?? Tool.toolName}
          >
            <Icon fontSize="small"/>
          </IconButton>
        ))}
      </ToggleButtonGroup>
    </Stack>

  )
}

      {/* <IconButton value='Pan' aria-label='Pan image'>
        <PanToolSharpIcon sx={{ p: 0.5 }} />
      </IconButton>

      <IconButton value='Zoom' aria-label='Zoom image'>
        <ZoomInSharpIcon />
      </IconButton>

      <IconButton value='Rotate' aria-label='Rotate image'>
        <RotateLeftSharpIcon />
      </IconButton>

      <IconButton value='Wwwc' aria-label='Contrast and brightness'>
        <ContrastSharpIcon sx={{ p: 0.2 }} />
      </IconButton>

      <Divider orientation='vertical' />

      <IconButton value='Length' aria-label='Measure length'>
        <StraightenSharpIcon />
      </IconButton>

      <IconButton value='Angle' aria-label='Measure angle'>
        <SquareFootSharpIcon />
      </IconButton>

      <IconButton value='Bidirectional' aria-label='Bidirectional'>
        <VerticalAlignCenterSharpIcon />
      </IconButton>

      <IconButton value='FreehandRoi' aria-label='Draw custom region of interest'>
        <HighlightAltSharpIcon sx={{ p: 0.2 }} />
      </IconButton>

      <IconButton value='Eraser' aria-label='Erase'>
        <AutoFixNormalSharpIcon sx={{ p: 0.2 }} />
      </IconButton> */}
//     </ToggleButtonGroup>
//   )
// }

export default DiconViewerToolbar
