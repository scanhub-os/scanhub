/**
 * Copyright (C) 2024, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
 * SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
 *
 * Initialize cornerstone 3D.
 */
import { init as csInit, cache } from '@cornerstonejs/core';
import { init as toolsInit } from '@cornerstonejs/tools';
// import { init as dicomImageLoaderInit } from '@cornerstonejs/dicom-image-loader';
import dicomImageLoader from '@cornerstonejs/dicom-image-loader';
import { registerDefaultTools } from './toolgroups';


let initialized: Promise<void> | null = null;
let currentGetAccessToken: (() => string | undefined) | undefined;

// Nuke all image cache (careful in bigger apps)
cache.purgeCache();


export function initCornerstone(getAccessToken?: () => string | undefined) {
  currentGetAccessToken = getAccessToken;

  if (!initialized) {
    initialized = (
      async () => {

        // Init cornerstone core
        await csInit();

        // Init cornerstone tools
        toolsInit();

        // Init dicom image loader
        await dicomImageLoader.init({
          strict: false,
          maxWebWorkers: navigator.hardwareConcurrency || 1,
          beforeSend: (xhr: XMLHttpRequest) => {
            const token = currentGetAccessToken?.();
            if (token) {
              xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            // Optional: Prevent caching
            xhr.setRequestHeader('Cache-Control', 'no-cache');
            xhr.setRequestHeader('Pragma', 'no-cache');
          },
        });

        // Register tools
        registerDefaultTools();

        // Optional: enlarge cache for big series
        // cache.setMaxCacheSize(1024 * 1024 * 1024);
      }
    )();
  }
  return initialized;
}
