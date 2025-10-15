// src/viewer/dicom/DicomViewerMinimal.tsx
import React from 'react';
import {
  RenderingEngine,
  getRenderingEngine,
  Enums,
  volumeLoader,
  type Types,
} from '@cornerstonejs/core';
import { initCornerstone } from './cornerstone/init';
import { useNumberOfFrames } from './hooks/useNumberOfFrames';
import LoginContext from '../../LoginContext';
import { getLinkedToolGroup, destroyLinkedToolGroup, attachViewportsToLinkedGroup, TOOL_GROUP_ID } from './cornerstone/toolgroups';
import DiconViewerToolbar from './DicomViewerToolbar';

import Card from '@mui/joy/Card';
import Stack from '@mui/joy/Stack';
import Container from '@mui/joy/Container';
import AlertItem from '../../components/AlertItem';
import { Alerts } from '../../interfaces/components.interface'

// Constants:
const RENDERING_ENGINE_ID = 're-min';

const VIEW_LAYOUTS = {
  '1x1': [
    { id: 'single', orientation: null },
  ],
  '1x3': [
    { id: 'axial', orientation: Enums.OrientationAxis.AXIAL },
    { id: 'sagittal', orientation: Enums.OrientationAxis.SAGITTAL },
    { id: 'coronal', orientation: Enums.OrientationAxis.CORONAL },
  ],
  '2x2': [
    { id: 'axial', orientation: Enums.OrientationAxis.AXIAL },
    { id: 'sagittal', orientation: Enums.OrientationAxis.SAGITTAL },
    { id: 'coronal', orientation: Enums.OrientationAxis.CORONAL },
    { id: 'volume3D', orientation: null }, // 3D rendering
  ],
};


// Helper function to obtain deterministic volume ID
function makeVolumeId(imageIds: string[]) {
  // Deterministic volume ID: Truncated binary to ASCII (btoa) output (0-16) 
  return `cornerstoneStreamingImageVolume:${btoa(imageIds[0]).slice(0, 16)}`;
}


/**
 * Minimal single-viewport DICOM viewer:
 * - Initializes Cornerstone3D once (uses your existing initCornerstone3D)
 * - Creates 1 viewport (STACK or ORTHOGRAPHIC for volume)
 * - Loads imageIds for the given task and displays them
 */
export default function DicomViewer3D({imageIds}: {imageIds: string[]}) {
  // Hooks
  const [user] = React.useContext(LoginContext);
  const [ready, setReady] = React.useState(false);
  const [viewportReady, setViewportReady] = React.useState(false);
  const [layout, setLayout] = React.useState<'1x1' | '1x3' | '2x2'>('1x1');
  const numberOfFrames = useNumberOfFrames(imageIds, ready);

  // References
  const containerRef = React.useRef<HTMLDivElement>(null);
  const engineRef = React.useRef<RenderingEngine | null>(null);
  const engineViewportIdsRef = React.useRef<string[]>([]);  // Save current engine viewport IDs
  const volumeIdRef = React.useRef<string | null>(null);  // Save current volume ID


  // Create engine once (mount -> unmount)
  React.useEffect(() => {
    if (!ready) return

    let engine = getRenderingEngine(RENDERING_ENGINE_ID);
    if (!engine) {
      engine = new RenderingEngine(RENDERING_ENGINE_ID);
    }
    engineRef.current = engine;

    return () => {
      // Full cleanup on unmount only
      try {
        engineRef.current?.destroy();
      } finally {
        engineRef.current = null;
      }
    };
  }, [ready]);

  
  // Initialize Cornerstone
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      await initCornerstone(() => user?.access_token);
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.access_token]);


  // Create and configure rendering engine
  React.useEffect(() => {
    if (!ready || !containerRef.current || !engineRef.current) return;


    const engine = engineRef.current;
    const current = VIEW_LAYOUTS[layout].map(v => v.id);
    const prev = engineViewportIdsRef.current;

    // Disable removed viewports
    for (const id of prev) {
      if (!current.includes(id)) {
        try { engine.disableElement(id); } catch {}
      }
    }


  // Enable new/current viewports
  (async () => {
    for (const view of VIEW_LAYOUTS[layout]) {
      const element = containerRef.current!.querySelector(`#viewport-${view.id}`) as HTMLDivElement;

      const type = layout === '1x1' ? (numberOfFrames > 1 ? Enums.ViewportType.ORTHOGRAPHIC : Enums.ViewportType.STACK)
        : (view.orientation ? Enums.ViewportType.ORTHOGRAPHIC : Enums.ViewportType.VOLUME_3D);

      const engineVpIds = Object.keys(engine.getViewports?.() ?? {});

      if (!engineVpIds.includes(view.id)) {
        await engine.enableElement({
          viewportId: view.id,
          element,
          type,
          defaultOptions: { background: [0, 0, 0] },
        });
      } else {
        // Reattach if element changed (e.g., React re-rendered)
        const vp = engine.getViewport(view.id);
        if ((vp as any).element !== element) {
          engine.disableElement(view.id);
          await engine.enableElement({
            viewportId: view.id,
            element,
            type,
            defaultOptions: { background: [0, 0, 0] },
          });
        }
      }
    }

    engineViewportIdsRef.current = current;
    setViewportReady(true);
  })();

  // no engine destroy here!
}, [ready, layout, numberOfFrames]);


  // Load and assign volume(s)
  React.useEffect(() => {
    if (!viewportReady || imageIds.length === 0) return;

    (async () => {
      const engine = engineRef.current!;
      const currentLayout = VIEW_LAYOUTS[layout];

      // For 2D stack-only data
      if (layout === '1x1' && numberOfFrames <= 1) {
        const vp = engine.getViewport('single') as Types.IStackViewport;
        await vp.setStack(imageIds);
        await vp.render();
        return;
      }

      // 3D or multi-slice
      // Create volume image ids -> add ?frame=1...N
      // const volumeId = `cornerstoneStreamingImageVolume:${Date.now()}`;
      const volumeId = makeVolumeId(imageIds);
      const volumeImageIds = Array.from({ length: numberOfFrames }, (_, i) => `${imageIds[0]}?frame=${i + 1}`);

      if (volumeIdRef.current !== volumeId) {
        // Create + cache once per series
        const vol = await volumeLoader.createAndCacheVolume(volumeId, { imageIds: volumeImageIds });
        await vol.load();
        volumeIdRef.current = volumeId;
      }

      // Set volume in viewports
      for (const view of currentLayout) {
        // Get viewport by ID and set volume
        const vp = engine.getViewport(view.id) as Types.IVolumeViewport;
        await vp.setVolumes([{ volumeId }]);
        // Set orientation
        if (view.orientation) {
          vp.setOrientation(view.orientation)
        }
        await vp.resetCamera(); // ensure proper frustum after setVolumes/orientation
        // Render viewport
        await vp.render();
      }
  
    })();
  }, [viewportReady, layout, imageIds, numberOfFrames]);

  if (imageIds.length === 0 || !numberOfFrames) {
    return (
      <Container maxWidth={false} sx={{ width: '50%', mt: 5, justifyContent: 'center' }}>
        <AlertItem
          title="Please select a reconstruction or processing task with a result to show a DICOM image."
          type={Alerts.Info}
        />
      </Container>
    );
  }

  // Grid configuration
  const gridTemplate =
    layout === '1x1'
      ? 'repeat(1, 1fr) / repeat(1, 1fr)'
      : layout === '1x3'
      ? 'repeat(1, 1fr) / repeat(3, 1fr)'
      : 'repeat(2, 1fr) / repeat(2, 1fr)';

  return (
    <Stack sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, width: '100%', height: 'calc(100vh - var(--Navigation-height) - var(--Status-height))', p: 1, gap: 1}}>
      <DiconViewerToolbar onLayoutChange={setLayout} currentLayout={layout}/>
      <Card
        variant="plain"
        color="neutral"
        sx={{ p: 0.5, bgcolor: '#000', height: '100%', border: '5px solid' }}
      >
        <div
          ref={containerRef}
          style={{
            display: 'grid',
            gridTemplate,
            width: '100%',
            height: '100%',
            gap: '4px',
          }}
        >
          {VIEW_LAYOUTS[layout].map((v) => (
            <div
              key={v.id}
              id={`viewport-${v.id}`}
              style={{
                width: '100%',
                height: '100%',
                background: 'black',
                borderRadius: 8,
              }}
            />
          ))}
        </div>
      </Card>
    </Stack>
  );
}