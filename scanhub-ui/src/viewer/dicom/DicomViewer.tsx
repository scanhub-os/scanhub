// src/viewer/dicom/DicomViewerMinimal.tsx
import React from 'react';
import {
  RenderingEngine,
  getRenderingEngine,
  Enums,
  volumeLoader,
  utilities,
  cache,
  type Types,
} from '@cornerstonejs/core';
import { initCornerstone } from './cornerstone/init';
import { useNumberOfFrames } from './hooks/useNumberOfFrames';
import LoginContext from '../../LoginContext';
import { attachToolGroupsForLayout, destroyToolGroups } from './cornerstone/toolgroups';
import DiconViewerToolbar from './DicomViewerToolbar';
import { VIEW_LAYOUTS, VIEW_LAYOUT_META, ViewportId, ViewLayout } from './cornerstone/viewLayouts';
import { useViewportResize } from './hooks/useViewportResize';
import { customPreset } from './cornerstone/volumePreset';

import Card from '@mui/joy/Card';
import Stack from '@mui/joy/Stack';
import Container from '@mui/joy/Container';
import AlertItem from '../../components/AlertItem';
import { ITEM_UNSELECTED, ItemSelection } from '../../interfaces/components.interface'
import { Alerts } from '../../interfaces/components.interface'
import Select from '@mui/joy/Select';
import Option from '@mui/joy/Option';
import { useTaskResults } from './hooks/useTaskResults';
import { useImageIds } from '../../hooks/useImageIds';


// Constants:
const RENDERING_ENGINE_ID = 're-min';


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
export default function DicomViewer3D({ item }: { item: ItemSelection }) {

  const { results } = useTaskResults(item);
  const [selectedResultId, setSelectedResultId] = React.useState<string | undefined>(undefined);

  // Automatically select newest result when available or updated
  React.useEffect(() => {
    setSelectedResultId(undefined); // Reset on item change
  }, [item.itemId]);

  React.useEffect(() => {
    if (!results || results.length === 0) return;
    // useTaskResults sorts by date already, so results[0] is newest.
    // Only update if current selection is invalid or empty
    if (!selectedResultId || !results.find(r => r.id === selectedResultId)) {
      setSelectedResultId(results[0].id);
    }
  }, [results, selectedResultId]);

  const { imageIds } = useImageIds(item, selectedResultId);

  // References
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const engineRef = React.useRef<RenderingEngine | null>(null);
  const engineViewportIdsRef = React.useRef<ViewportId[]>([]);  // Save current engine viewport IDs
  const volumeIdRef = React.useRef<string | null>(null);  // Save current volume ID

  // Hooks
  const [user] = React.useContext(LoginContext);
  const [ready, setReady] = React.useState(false);
  const [viewportReady, setViewportReady] = React.useState(false);
  const [layout, setLayout] = React.useState<ViewLayout>(ViewLayout.Single);
  const numberOfFrames = useNumberOfFrames(imageIds, ready);
  useViewportResize(engineRef, layout, containerRef);


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
        destroyToolGroups()
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

    setViewportReady(false); // Block loading/rendering while reconfiguring viewports

    let cancelled = false;
    const engine = engineRef.current;
    const layoutViewportIds = VIEW_LAYOUTS[layout].map(v => v.id);

    // Disable removed viewports
    for (const id of engineViewportIdsRef.current) {
      if (!layoutViewportIds.includes(id)) {
        try { engine.disableElement(id); } catch { }
      }
    }

    // Enable viewports
    (async () => {
      for (const view of VIEW_LAYOUTS[layout]) {
        if (cancelled) return;

        const element = containerRef.current!.querySelector(`#viewport-${view.id}`) as HTMLDivElement;
        const engineVpIds = Object.keys(engine.getViewports?.() ?? {});
        const type = numberOfFrames <= 1 ? Enums.ViewportType.STACK
          : (view.is3D ? Enums.ViewportType.VOLUME_3D : Enums.ViewportType.ORTHOGRAPHIC)

        if (!engineVpIds.includes(view.id)) {
          await engine.enableElement({
            viewportId: view.id,
            element,
            type,
            defaultOptions: { background: [0, 0, 0] },
          });
        } else {
          // Reattach if element changed (e.g., React re-rendered) OR if type changed (Stack <-> Volume)
          const vp = engine.getViewport(view.id);
          if ((vp as any).element !== element || vp.type !== type) {
            engine.disableElement(view.id);
            if (cancelled) return;
            await engine.enableElement({
              viewportId: view.id,
              element,
              type,
              defaultOptions: { background: [0, 0, 0] },
            });
          }
        }
      }

      if (cancelled) return;

      // Enginge resize after layout change
      requestAnimationFrame(() => {
        if (cancelled) return;
        const engine = engineRef.current;
        if (!engine) return
        // Resize with keep camera = true
        engine.resize(false, true);
        // Fit all active viewports to their container
        engine.getViewports().forEach(vp => vp?.resetCamera?.());
        engine.render();
      });

      engineViewportIdsRef.current = layoutViewportIds;
      setViewportReady(true);
    })();

    return () => {
      cancelled = true;
    };

  }, [ready, layout, numberOfFrames]);


  // Load and assign volume(s)
  React.useEffect(() => {
    if (!viewportReady || imageIds.length === 0) return;

    let cancelled = false;

    (async () => {
      const engine = engineRef.current!;
      const currentLayout = VIEW_LAYOUTS[layout];

      if (cancelled) return;

      // For 2D stack-only data
      if (layout === ViewLayout.Single && numberOfFrames <= 1) {
        const vp = engine.getViewport('single');
        if (!vp) return;

        if (vp.type === Enums.ViewportType.STACK) {
          await (vp as Types.IStackViewport).setStack(imageIds);
          if (!cancelled) await vp.render();
        } else {
          console.warn(`[DicomViewer] Mismatch: Expected Stack viewport for single frame, got ${vp.type}`);
        }
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
        if (cancelled) return;
        await vol.load();
        volumeIdRef.current = volumeId;
      }

      if (cancelled) return;

      // Set volume in viewports
      for (const view of currentLayout) {
        if (cancelled) return;
        // Get viewport by ID and set volume
        const vp = engine.getViewport(view.id) as Types.IVolumeViewport;
        if (!vp) continue

        await vp.setVolumes([{ volumeId }]);
        // Set orientation
        if (view.orientation) vp.setOrientation(view.orientation)
        // Reset camera
        await vp.resetCamera(); // ensure proper frustum after setVolumes/orientation

        // Render viewport
        if (!cancelled) await vp.render();
      }

      // Add enabled viewports to toolGroup
      if (!cancelled) await attachToolGroupsForLayout(VIEW_LAYOUTS[layout], RENDERING_ENGINE_ID)

    })();

    return () => {
      cancelled = true;
    };

  }, [viewportReady, layout, imageIds, numberOfFrames]);

  // Grid configuration
  const { rows, cols } = VIEW_LAYOUT_META[layout];
  const gridTemplate = `repeat(${rows}, 1fr) / repeat(${cols}, 1fr)`;

  if (imageIds.length === 0 || !numberOfFrames) {
    return (
      <Container maxWidth={false} sx={{ width: '50%', mt: 5, justifyContent: 'center' }}>
        <AlertItem
          title="Please select a reconstruction or processing task with a result to show a DICOM image."
          type={Alerts.Info}
        />
      </Container>
    )
  }

  return (
    <Stack sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, width: '100%', height: 'calc(100vh - var(--Navigation-height) - var(--Status-height))', p: 1, gap: 1 }}>

      {/* Result Selector and Toolbar */}
      <Stack direction="row" gap={2} alignItems="center">
        <Select
          size="sm"
          placeholder="Select Result"
          value={selectedResultId ?? null}
          onChange={(_, value) => value && setSelectedResultId(value)}
          sx={{ minWidth: 200 }}
        >
          {results.map((r) => (
            <Option key={r.id} value={r.id}>
              {new Date(r.datetime_created).toLocaleString()}
            </Option>
          ))}
        </Select>

        <DiconViewerToolbar onLayoutChange={setLayout} currentLayout={layout} />

      </Stack>


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
            // gap: '1px',
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
                borderRadius: 5,
                overflow: 'hidden',
              }}
            />
          ))}
        </div>
      </Card>
    </Stack>
  );
}