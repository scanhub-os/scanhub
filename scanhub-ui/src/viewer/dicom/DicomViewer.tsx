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
import { attachToolGroupsForLayout, destroyToolGroups} from './cornerstone/toolgroups';
import DiconViewerToolbar from './DicomViewerToolbar';
import { VIEW_LAYOUTS, VIEW_LAYOUT_META, ViewportId, ViewLayout } from './cornerstone/viewLayouts';
import { useViewportResize } from './hooks/useViewportResize';
import { customPreset } from './cornerstone/volumePreset';

import Card from '@mui/joy/Card';
import Stack from '@mui/joy/Stack';
import Container from '@mui/joy/Container';
import AlertItem from '../../components/AlertItem';
import { Alerts } from '../../interfaces/components.interface'

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
export default function DicomViewer3D({imageIds}: {imageIds: string[]}) {

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

    const engine = engineRef.current;
    const layoutViewportIds = VIEW_LAYOUTS[layout].map(v => v.id);

    // Disable removed viewports
    for (const id of engineViewportIdsRef.current) {
      if (!layoutViewportIds.includes(id)) {
        try { engine.disableElement(id); } catch {}
      }
    }

  // Enable viewports
  (async () => {
    for (const view of VIEW_LAYOUTS[layout]) {

      const element = containerRef.current!.querySelector(`#viewport-${view.id}`) as HTMLDivElement;
      const engineVpIds = Object.keys(engine.getViewports?.() ?? {});
      const type = numberOfFrames === 1 ? Enums.ViewportType.STACK
        : (view.is3D ? Enums.ViewportType.VOLUME_3D : Enums.ViewportType.ORTHOGRAPHIC)

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

    // Enginge resize after layout change
    requestAnimationFrame(() => {
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

}, [ready, layout, numberOfFrames]);


  // Load and assign volume(s)
  React.useEffect(() => {
    if (!viewportReady || imageIds.length === 0) return;

    (async () => {
      const engine = engineRef.current!;
      const currentLayout = VIEW_LAYOUTS[layout];

      // For 2D stack-only data
      if (layout === ViewLayout.Single && numberOfFrames <= 1) {
        const vp = engine.getViewport('single') as Types.IStackViewport;
        if (!vp) return
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
        if (!vp) continue

        await vp.setVolumes([{ volumeId }]);
        // Set orientation
        if (view.orientation) vp.setOrientation(view.orientation)
        // Reset camera
        await vp.resetCamera(); // ensure proper frustum after setVolumes/orientation

        
        // TODO: Properly display the 3D rendered volume
        // if (vp.type === Enums.ViewportType.VOLUME_3D) {
        //   // Set preset for volume rendering
        //   // const actorEntry = vp.getDefaultActor();
        //   // if (!actorEntry) return;
        //   // // const vtkActor = actorEntry.actor as any; // vtkVolume
        //   // // const preset = CONSTANTS.VIEWPORT_PRESETS[22];  // 22 = MR-Default
        //   // // if (!preset) return;
        //   // // console.log("Applying preset: ", preset.name)

        //   // // utilities.applyPreset(actorEntry.actor as any, customPreset);
        //   // const property = (actorEntry.actor as any).getProperty();
        //   // const opacityFunc = property.getScalarOpacity(0);
        //   // opacityFunc.removeAllPoints();

        //   // // Define mapping: (intensity, opacity)
        //   // opacityFunc.addPoint(0, 0.0);       // black = fully transparent
        //   // opacityFunc.addPoint(1000, 0.0);      // near black still transparent
        //   // // opacityFunc.addPoint(600, 0.1);     // start fading in
        //   // // opacityFunc.addPoint(1000, 0.8);     // mostly opaque
        //   // opacityFunc.addPoint(2000, 1.0);    // fully opaque

        //   const actorEntry = vp.getDefaultActor();
        //   if (!actorEntry) return;

        //   // const preset = CONSTANTS.VIEWPORT_PRESETS[22];  // 22 = MR-Default
        //   // if (!preset) return;
        //   // console.log("Applying preset: ", preset.name)

        //   // get the volume to read spacing & intensity range
        //   const vol = cache.getVolume(volumeId);
        //   const scalars = vol?.imageData?.getPointData().getScalars();
        //   let minI = 0, maxI = 1;
        //   if (scalars) {
        //     // vtkDataArray provides a getRange() method
        //     const [minVal, maxVal] = scalars.getRange();
        //     minI = minVal;
        //     maxI = maxVal;
        //   }
        //   const [sx, sy, sz] = vol?.spacing ?? [1, 1, 1];

        //   // a good unit distance ~ voxel diagonal (in mm)
        //   const unitDistance = Math.sqrt(sx * sx + sy * sy + sz * sz);

        //   const vtkVolume = actorEntry.actor as any;
        //   const prop = vtkVolume.getProperty();
        //   const mapper = vtkVolume.getMapper();

        //   // Ensure composite blending (not MIP) for “see-through black”
        //   if (mapper.setBlendModeToComposite) mapper.setBlendModeToComposite();

        //   // Critical: set how opacity accumulates per mm along the ray
        //   if (prop.setScalarOpacityUnitDistance) {
        //     prop.setScalarOpacityUnitDistance(0, unitDistance);
        //   }

        //   // Reasonable ray step (smaller = sharper, slower)
        //   if (mapper.setSampleDistance) {
        //     mapper.setSampleDistance(unitDistance * 0.5);
        //   }

        //   // Build a transfer function that truly zeros-out “black”
        //   // const threshold = Math.max(minI,  /* your threshold */ 500);
        //   const threshold = maxI * 0.4

        //   // Scalar opacity (intensity → opacity)
        //   const of = prop.getScalarOpacity(0);
        //   of.removeAllPoints();
        //   of.addPoint(minI, 0.0);               // everything near min is transparent
        //   of.addPoint(threshold - 1, 0.0);      // still transparent below threshold
        //   of.addPoint(threshold + 50, 0.10);    // start to fade in
        //   of.addPoint((threshold + maxI) * 0.5, 0.80);
        //   of.addPoint(maxI, 1.0);               // dense stuff fully opaque

        //   // Grayscale color transfer (optional but good to reset)
        //   const ctf = prop.getRGBTransferFunction(0);
        //   ctf.removeAllPoints();
        //   ctf.addRGBPoint(minI, 0, 0, 0);
        //   ctf.addRGBPoint(maxI, 1, 1, 1);

        //   // Nice lighting
        //   prop.setShade(true);
        //   prop.setAmbient(0.25);
        //   prop.setDiffuse(0.7);
        //   prop.setSpecular(0.1);
        //   prop.setSpecularPower(10);
               
        // }

        // Render viewport
        await vp.render();
      }

      // Add enabled viewports to toolGroup
      await attachToolGroupsForLayout(VIEW_LAYOUTS[layout], RENDERING_ENGINE_ID)

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
  const { rows, cols } = VIEW_LAYOUT_META[layout];
  const gridTemplate = `repeat(${rows}, 1fr) / repeat(${cols}, 1fr)`;

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