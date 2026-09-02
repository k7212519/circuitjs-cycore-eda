import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_PUBLIC_BASE || '/circuit/breadboard/',
    plugins: [react()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      outDir: '../war/breadboard',
      emptyOutDir: true,
      sourcemap: true,
      rolldownOptions: {
        output: {
          codeSplitting: {
            minSize: 20_000,
            groups: [
              { name: 'canvas-engine', test: /node_modules\/(?:\.pnpm\/)?(?:konva|react-konva)/ },
              { name: 'react-runtime', test: /node_modules\/(?:\.pnpm\/)?(?:react|react-dom|scheduler)/ },
              { name: 'data-runtime', test: /node_modules\/(?:\.pnpm\/)?(?:@tanstack|zustand|zod)/ },
            ],
          },
        },
      },
    },
    server: {
      port: 5174,
      host: '0.0.0.0',
      proxy: {
        '/circuit-engine': {
          target: env.VITE_CIRCUITJS_DEV_ORIGIN || 'http://127.0.0.1:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/circuit-engine/, ''),
        },
        '/circuitjs1': {
          target: env.VITE_CIRCUITJS_DEV_ORIGIN || 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/circuit/manifest.json': {
          target: env.VITE_CIRCUITJS_DEV_ORIGIN || 'http://127.0.0.1:8000',
          changeOrigin: true,
          rewrite: () => '/manifest.json',
        },
        '/api': {
          target: env.VITE_API_DEV_ORIGIN || 'http://192.168.1.103:8088',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      exclude: ['e2e/**', 'node_modules/**'],
      coverage: { reporter: ['text', 'html'] },
    },
  }
})
