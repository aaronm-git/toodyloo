import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'

const config = defineConfig(({ command }) => ({
  plugins: [
    tanstackStart(),
    devtools(),
    ...(command === 'build' ? [netlify()] : []),
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    viteReact({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
  ],
  optimizeDeps: {
    exclude: [
      '@tanstack/react-start',
      '@tanstack/start-server-core',
      '@tanstack/react-router',
      '@tanstack/react-router-devtools',
    ],
  },
}))

export default config
