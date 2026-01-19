// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';

export default defineConfig({
  plugins: [react(), viteCommonjs()],

  // serve workers & WASM correctly
  worker: { format: 'es' },
  assetsInclude: ['**/*.wasm'],

  // Required for dev
  optimizeDeps: {
    include: ['dicom-parser'],
    exclude: ['@cornerstonejs/dicom-image-loader'],
  },

  resolve: { dedupe: ['react', 'react-dom'] },

  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    // origin: 'https://localhost:8443', // Removed to allow access from other hosts
    // headers: {
    //   'Cross-Origin-Opener-Policy': 'same-origin',
    //   'Cross-Origin-Embedder-Policy': 'require-corp',
    //   // 'Cross-Origin-Resource-Policy': 'same-origin',
    // },
    // If you proxy through HTTPS:8443 (nginx), HMR may need these:
    hmr: {
      protocol: 'wss', clientPort: 8443, // browser connects to 8443 (nginx), NOT Vite
    },
  },

  preview: {
    host: '0.0.0.0',
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  build: { target: 'es2020' },
});