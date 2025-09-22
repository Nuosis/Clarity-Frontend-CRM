import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: {
    port: 1235,
    host: true,
    open: false,
    proxy: {
      '/api': {
        target: 'https://api.claritybusinesssolutions.ca',
        changeOrigin: true,
        secure: true
      }
    }
  },
  build: {
    assetsInlineLimit: 100000000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        manualChunks: undefined
      }
    }
  },
  logLevel: 'info'
})
