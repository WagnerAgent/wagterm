import { defineConfig } from 'electron-vite';
import { resolve } from 'path';

export default defineConfig({
  main: {
    entry: 'src/main/index.ts',
    build: {
      outDir: 'dist/main'
    }
  },
  preload: {
    input: {
      index: resolve(__dirname, 'src/preload/index.ts')
    },
    build: {
      outDir: 'dist/preload'
    }
  },
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: '../../dist/renderer'
    },
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src')
      }
    }
  }
});
