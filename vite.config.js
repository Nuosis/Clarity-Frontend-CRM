import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1234,
    host: true,
    open: false
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  logLevel: 'info'
})
