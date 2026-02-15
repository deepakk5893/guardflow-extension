import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, cpSync, existsSync } from 'fs';

/**
 * Firefox MV2 Vite Plugin: Inline Shared Chunks
 *
 * Firefox MV2 background scripts and content scripts are loaded as classic scripts,
 * NOT ES modules. They cannot use `import` statements. When Rollup creates shared
 * chunks (e.g., storage.js used by multiple entries), it generates `import { ... }`
 * statements that break in Firefox MV2.
 *
 * This plugin inlines shared chunk code directly into each entry that imports it,
 * eliminating cross-file imports.
 */
function firefoxMV2InlineChunks() {
  return {
    name: 'firefox-mv2-inline-chunks',
    enforce: 'post' as const,
    generateBundle(_: unknown, bundle: Record<string, any>) {
      // Find non-entry chunks (shared dependencies like storage.js)
      const sharedChunks = new Map<string, any>();
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && !chunk.isEntry) {
          sharedChunks.set(fileName, chunk);
        }
      }

      if (sharedChunks.size === 0) return;

      // Process each entry chunk
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || !chunk.isEntry) continue;

        // Skip popup - it loads via <script type="module"> in HTML
        if (chunk.facadeModuleId?.includes('popup.html') || chunk.facadeModuleId?.includes('popup.tsx')) continue;

        let code: string = chunk.code;

        // Replace import statements from shared chunks with inlined code
        for (const [sharedFileName, sharedChunk] of sharedChunks) {
          const baseName = sharedFileName.replace(/^assets\//, '');
          // Escape special chars for regex
          const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

          // Match: import { x, y } from './storage-abc.js';
          const importPattern = new RegExp(
            `import\\s*\\{[^}]*\\}\\s*from\\s*['"]\\.\\/` + escaped + `['"];?\\n?`
          );

          if (importPattern.test(code)) {
            // Get the shared chunk code and strip export statements
            let inlinedCode = sharedChunk.code;
            // Remove: export { storageGet, storageSet, storageRemove };
            inlinedCode = inlinedCode.replace(/export\s*\{[^}]*\}\s*;?\s*$/m, '');
            // Remove: export keyword from individual declarations
            inlinedCode = inlinedCode.replace(/^export\s+/gm, '');

            // Replace import statement with inlined code
            code = code.replace(importPattern, inlinedCode + '\n');
          }
        }

        chunk.code = code;
      }

      // Remove shared chunks from output (they're now inlined)
      for (const fileName of sharedChunks.keys()) {
        delete bundle[fileName];
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    firefoxMV2InlineChunks(),
    {
      name: 'copy-manifest-and-assets',
      apply: 'build',
      generateBundle() {
        // Manifest will be copied via writeBundle hook
      },
      writeBundle() {
        const distDir = resolve(__dirname, '../../dist-firefox');
        const manifestSrc = resolve(__dirname, 'manifest.json');
        mkdirSync(distDir, { recursive: true });
        copyFileSync(manifestSrc, resolve(distDir, 'manifest.json'));

        // Copy blocked folder if exists
        const blockedSrc = resolve(__dirname, 'public/blocked');
        const blockedDest = resolve(distDir, 'blocked');
        if (existsSync(blockedSrc)) {
          cpSync(blockedSrc, blockedDest, { recursive: true });
        }

        // Copy icons if exists
        const iconsSrc = resolve(__dirname, 'public/icons');
        const iconsDest = resolve(distDir, 'icons');
        if (existsSync(iconsSrc)) {
          cpSync(iconsSrc, iconsDest, { recursive: true });
        }
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
    // Disable minification for Firefox MV2 so that import/export names
    // match after the inline-chunks plugin strips import statements.
    // Extension code runs locally so minification isn't needed.
    minify: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'public/popup.html'),
        content: resolve(__dirname, '../../src/content/content.ts'),
        background: resolve(__dirname, '../../src/background/background.ts'),
        'shadow-ai-banner': resolve(__dirname, '../../src/shadow-ai/shadow-ai-banner.ts'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
      },
    },
  },
});
