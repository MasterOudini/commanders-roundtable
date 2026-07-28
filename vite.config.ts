// defineConfig comes from vitest/config, not vite, so the `test` block below is
// type-checked. It is otherwise identical to Vite's own.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base: './' is required so the built app loads from file:// inside Electron.
// Unique strictPort (5280) avoids colliding with the sibling apps in this
// workspace (SphereMapper 5173/5174, realmscribe 5180, TerrainScribe 5183,
// script picker 5193, topoforge 5210, the static 52xx block, counterpoint
// 5240, Mundifex 5260/5261, Cartapriscus 5273). 5281 is the dev relay and
// 5282 the LAN host listener, so both stay clear of Vite.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: {
    host: 'localhost',
    // 5280 by default (electron/main.cjs hardcodes http://localhost:5280).
    // Honor a PORT override so the Claude preview harness can run a browser
    // preview on an assigned free port. Unset in every normal launch.
    port: Number(process.env.PORT) || 5280,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  test: {
    // The engine must never need a DOM — that is itself an assertion.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});
