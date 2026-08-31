import { federation } from '@module-federation/vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    vue(),
    federation({
      name: 'moduleCommercial',
      filename: 'remoteEntry.js',
      dev: { remoteHmr: true },
      exposes: {
        './CommercialPage': './src/CommercialPage.vue'
      },
      dts: false,
      shared: ['vue']
    })
  ],
  server: {
    origin: 'http://localhost:4175'
  }
})
