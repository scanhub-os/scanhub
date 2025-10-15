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
import { getLinkedToolGroup, destroyLinkedToolGroup, attachViewportsToLinkedGroup } from './cornerstone/toolgroups';
import DiconViewerToolbar from './DicomViewerToolbar';

import Card from '@mui/joy/Card';
import Stack from '@mui/joy/Stack';
import Container from '@mui/joy/Container';
import AlertItem from '../../components/AlertItem';
import { Alerts } from '../../interfaces/components.interface'


const RENDERING_ENGINE_ID = 're-min';
const VIEWPORT_ID = 'vp-min';



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





/**
 * Minimal single-viewport DICOM viewer:
 * - Initializes Cornerstone3D once (uses your existing initCornerstone3D)
 * - Creates 1 viewport (STACK or ORTHOGRAPHIC for volume)
 * - Loads imageIds for the given task and displays them
 */
export default function DicomViewer3D({imageIds}: {imageIds: string[]}) {
  const [user] = React.useContext(LoginContext);
  const [ready, setReady] = React.useState(false);
  const [viewportReady, setViewportReady] = React.useState(false);
  const [layout, setLayout] = React.useState<'1x1' | '1x3' | '2x2'>('1x1');
  const containerRef = React.useRef<HTMLDivElement>(null);
  const engineRef = React.useRef<RenderingEngine | null>(null);

  const numberOfFrames = useNumberOfFrames(imageIds, ready);
  
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
    if (!ready || !containerRef.current) return;

    let engine: RenderingEngine | null = null;
    let cancelled = false;
    
    const setup = async () => {
      // Fully destroy any previous engine
      const prev = getRenderingEngine(RENDERING_ENGINE_ID);
      if (prev) {
        try {
          for (const v of Object.keys(prev.getViewports?.() ?? {})) {
            prev.disableElement(v);
          }
          prev.destroy();
        } catch (err) {
          console.warn('Failed to destroy previous rendering engine', err);
        }
      }

      // Create new engine
      engine = new RenderingEngine(RENDERING_ENGINE_ID);
      engineRef.current = engine;

      const currentLayout = VIEW_LAYOUTS[layout];
      for (const view of currentLayout) {
        const el = containerRef.current!.querySelector(`#viewport-${view.id}`) as HTMLDivElement;

        // Determine viewport type
        const viewportType =
          layout === '1x1' ? (numberOfFrames > 1 ? Enums.ViewportType.ORTHOGRAPHIC : Enums.ViewportType.STACK)
            : (view.orientation ? Enums.ViewportType.ORTHOGRAPHIC : Enums.ViewportType.VOLUME_3D);

        await engine.enableElement({
          viewportId: view.id,
          element: el,
          type: viewportType,
          defaultOptions: { background: [0, 0, 0] },
        });

      }
      setViewportReady(true);

      getLinkedToolGroup();
      attachViewportsToLinkedGroup(RENDERING_ENGINE_ID, VIEW_LAYOUTS[layout].map(view => view.id));
    };

    setup();

    return () => {
      setViewportReady(false);
      cancelled = true;
      const engine = getRenderingEngine(RENDERING_ENGINE_ID);
      if (engine) {
        for (const v of VIEW_LAYOUTS[layout]) {
          try {
            engine.disableElement(v.id);
          } catch {}
        }
        engine.destroy();
      }
      destroyLinkedToolGroup();
    };
  }, [ready, layout, numberOfFrames]);

  
  // Load and assign volume(s)
  React.useEffect(() => {
    if (!viewportReady) return;
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

      // Create volume image ids -> add ?frame=1...N
      const volumeId = `cornerstoneStreamingImageVolume:${Date.now()}`;
      const volumeImageIds = Array.from({ length: numberOfFrames }, (_, i) => `${imageIds[0]}?frame=${i + 1}`);
      // Create and cache volume image ids for volume id
      const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds: volumeImageIds });
      // Load volume
      await volume.load();
      // Set volume in viewports
      for (const view of currentLayout) {
        // Get viewport by ID and set volume
        const vp = engine.getViewport(view.id) as Types.IVolumeViewport;
        await vp.setVolumes([{ volumeId }]);
        // Set orientation
        if (view.orientation) {
          vp.setOrientation(view.orientation)
        }
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
    <Stack sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, width: '100%', height: 'calc(100vh - var(--Navigation-height))', p: 1, gap: 1}}>
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