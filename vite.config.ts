import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import topLevelAwait from 'vite-plugin-top-level-await'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    topLevelAwait({
      promiseExportName: "__tla",
      promiseImportName: i => `__tla_${i}`
    })
  ],
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        format: 'es'
      }
    }
  },
  esbuild: {
    target: 'es2022'
  },
  optimizeDeps: {
    exclude: ['mupdf'],
    esbuildOptions: {
      target: 'es2022',
      supported: {
        "top-level-await": true
      }
    }
  },
  server: {
    fs: {
      allow: ['..', 'node_modules']
    }
  },
  assetsInclude: ['**/*.wasm'],
  define: {
    global: 'globalThis'
  }
})
