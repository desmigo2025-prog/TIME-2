import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          manifest: {
            name: 'T.T App',
            short_name: 'TT App',
            description: 'AI-Powered Timetable & Productivity App',
            theme_color: '#000000',
            background_color: '#000000',
            display: 'standalone',
            icons: [
              {
                src: 'https://picsum.photos/seed/ttapp/192/192',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: 'https://picsum.photos/seed/ttapp/512/512',
                sizes: '512x512',
                type: 'image/png'
              }
            ]
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom', 'react-router-dom'],
              ui: ['lucide-react', 'recharts', 'framer-motion'],
              firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
              ai: ['@google/genai']
            }
          }
        }
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
