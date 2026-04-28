import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/HR-System-Portfolio/' : '/',
  plugins: [
    react(),
    // 매 빌드마다 index.html 내용이 달라져 GitHub Pages에 올라간 엔트리 HTML이 최신 번들을 가리키도록 유도
    {
      name: 'inject-build-meta',
      transformIndexHtml(html) {
        const tag = `<meta name="app-built-at" content="${new Date().toISOString()}" />`;
        return html.replace('<title>', `${tag}\n    <title>`);
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
}));
