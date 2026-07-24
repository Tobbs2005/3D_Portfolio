import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  esbuild: {
    jsx: 'automatic', // the copied intro components rely on the automatic JSX runtime
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
