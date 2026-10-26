/// <reference types="vitest/config" />
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rolldownOptions: {
      // print.html is the separate printable worksheet; remove it here to drop the feature.
      input: { main: resolve(import.meta.dirname, 'index.html'), print: resolve(import.meta.dirname, 'print.html') },
    },
  },
  test: {
    environment: 'node',
  },
})
