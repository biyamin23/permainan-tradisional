import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Big libraries go in their own chunks: they change rarely, so browsers keep
// them cached between deploys, and the landing page doesn't wait for them.
function vendorChunk(id) {
  if (!id.includes('node_modules')) return undefined
  if (id.includes('@dimforge') || id.includes('@react-three/rapier')) return 'physics'
  if (id.includes('@react-three/drei') || id.includes('three-stdlib') || id.includes('troika') || id.includes('camera-controls'))
    return 'drei'
  if (id.includes('/three/')) return 'three'
  if (id.includes('@react-three/fiber')) return 'fiber'
  if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'react'
  return undefined
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: vendorChunk,
      },
    },
  },
})
