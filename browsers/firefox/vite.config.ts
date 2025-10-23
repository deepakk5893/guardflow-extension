import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '~': resolve(__dirname, '../../src'),
    },
  },
  build: {
    outDir: '../../dist-firefox',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'public/popup.html'),
      },
    },
  },
});
