import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest',
      apply: 'build',
      generateBundle() {
        // Manifest will be copied via writeBundle hook
      },
      writeBundle() {
        const distDir = resolve(__dirname, '../../dist-firefox');
        const manifestSrc = resolve(__dirname, 'manifest.json');
        mkdirSync(distDir, { recursive: true });
        copyFileSync(manifestSrc, resolve(distDir, 'manifest.json'));
      },
    },
  ],
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
        content: resolve(__dirname, '../../src/content/content.ts'),
        background: resolve(__dirname, '../../src/background/background.ts'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
      },
    },
  },
});
