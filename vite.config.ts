import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pinned Deno npm specifiers used by offline fiscal backend tests.
  resolve: { alias: {
    'npm:node-forge@1.3.1': 'node-forge',
    'npm:xml-crypto@6.4.0': 'xml-crypto',
    'npm:@xmldom/xmldom@0.8.15': '@xmldom/xmldom',
    'npm:libxml2-wasm@0.7.2': 'libxml2-wasm',
  } },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true
  }
})
