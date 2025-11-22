import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', 
  server: {
    host: true,
    port: 5173,
    // 【关键新增】本地开发代理配置
    proxy: {
      '/api': {
        target: 'http://9526.ip-ddns.com/index.php',
        changeOrigin: true,
        // 重写路径：把 /api/login 变成 index.php?endpoint=login
        rewrite: (path) => {
           const endpoint = path.replace(/^\/api\//, '');
           return `?endpoint=${endpoint}`;
        }
      }
    }
  }
});