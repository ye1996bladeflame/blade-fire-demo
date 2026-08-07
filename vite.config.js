import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // GitHub Pages 部署路径（仓库名为 blade-fire-demo）
  base: '/blade-fire-demo/',
  server: {
    host: true,
    port: 8888,
  },
})
