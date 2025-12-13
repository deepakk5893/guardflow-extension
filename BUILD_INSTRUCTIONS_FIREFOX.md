# Firefox Extension Build Instructions

## System Requirements

- **Operating System**: macOS, Linux, or Windows
- **Node.js**: Version 18.x or higher (tested on 18.0.0+)
- **npm**: Version 9.x or higher (comes with Node.js)

## Installation Steps

### 1. Install Node.js and npm

Download and install Node.js from: https://nodejs.org/

Verify installation:
```bash
node --version  # Should show v18.x or higher
npm --version   # Should show 9.x or higher
```

### 2. Install Dependencies

Navigate to the extension directory and install all required packages:

```bash
cd guardflow-extension
npm install
```

This will install all dependencies listed in `package.json`, including:
- vite (v6.4.1) - Build tool and bundler
- typescript (v5.3.3) - TypeScript compiler
- react (v18.2.0) - UI framework
- And other development dependencies

### 3. Build the Firefox Extension

Run the build command:

```bash
npm run build:firefox
```

This command executes the following steps:
1. Changes directory to `browsers/firefox/`
2. Runs TypeScript compiler: `tsc`
3. Runs Vite build: `vite build`
4. Outputs the built extension to `dist-firefox/` directory

### 4. Verify the Build

After building, verify the output:

```bash
ls -la dist-firefox/
```

You should see:
- `manifest.json` - Extension manifest (version 1.0.2)
- `popup.html` - Extension popup HTML
- `assets/` - Compiled JavaScript files
  - `background.js` - Background service worker
  - `content.js` - Content script
  - `popup.js` - Popup UI script
- `icons/` - Extension icons (16px, 48px, 128px)
- `public/` - Static assets

## Build Process Details

### What the build does:

1. **TypeScript Compilation**:
   - Converts TypeScript files from `src/` to JavaScript
   - Type checks all code
   - Configuration: `tsconfig.json`

2. **Vite Bundling**:
   - Bundles React components and dependencies
   - Minifies JavaScript for production
   - Processes and copies static assets
   - Configuration: `browsers/firefox/vite.config.ts`

3. **Output Structure**:
   - All source files are compiled into the `dist-firefox/` directory
   - Code is minified and optimized
   - Assets are copied from `public/icons/` to output

### Source File Mapping:

- `src/popup/Popup.tsx` → `assets/popup.js`
- `src/content/content.ts` → `assets/content.js`
- `src/background/background.ts` → `assets/background.js`
- `browsers/firefox/public/popup.html` → `popup.html`
- `public/icons/*` → `icons/*`

## Verification

To verify the build is identical:

1. Clean previous builds:
```bash
rm -rf dist-firefox
```

2. Rebuild:
```bash
npm run build:firefox
```

3. The output in `dist-firefox/` should match the submitted extension package exactly.

## Package Creation

To create the submission zip file:

```bash
npm run package:firefox
```

This creates `guardflow-firefox.zip` containing the entire `dist-firefox/` directory.

## Troubleshooting

**Issue**: npm install fails
- **Solution**: Ensure Node.js 18+ is installed, delete `node_modules` and `package-lock.json`, then run `npm install` again

**Issue**: Build fails with TypeScript errors
- **Solution**: Run `npm run typecheck` to see detailed errors

**Issue**: Missing dependencies
- **Solution**: Run `npm install` to ensure all packages are installed

## Support

For questions about the build process, refer to:
- Vite documentation: https://vitejs.dev/
- TypeScript documentation: https://www.typescriptlang.org/
- React documentation: https://react.dev/

## Version Information

- Extension Version: 1.0.2
- Manifest Version: 2 (Firefox)
- Build Date: 2024-11-24
