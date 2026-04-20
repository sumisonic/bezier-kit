import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages 公開用に `VITE_BASE` を設定する。
// ローカル dev では空文字列なので `/` で動作。
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
  },
})
