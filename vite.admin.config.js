import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Admin UI. Built into dist-admin/ and then inlined into the Worker by scripts/inline-admin.mjs.
// In development, `npm run admin:dev` proxies /api to `npm run worker:dev` on port 8788.
export default defineConfig({
  root: fileURLToPath(new URL('./admin', import.meta.url)),
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://localhost:8788' },
  },
  build: {
    outDir: fileURLToPath(new URL('./dist-admin', import.meta.url)),
    emptyOutDir: true,
    modulePreload: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
