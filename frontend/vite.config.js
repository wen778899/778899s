import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // 关键：相对路径，适配 APK
  server: {
    host: true,
    port: 5173
  }
});