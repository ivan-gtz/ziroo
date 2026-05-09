import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      tailwindcss()
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            // Charts — loaded only on admin dashboard
            'vendor-charts': ['recharts'],
            // Maps — loaded only in customer delivery flow & settings
            'vendor-maps': ['leaflet', 'react-leaflet', '@turf/union', '@turf/helpers'],
            // PDF/Excel — loaded only in reports/earnings
            'vendor-pdf': ['jspdf', 'jspdf-autotable'],
            // Icons — large library, shared across app but cacheable separately
            'vendor-icons': ['lucide-react'],
            // Supabase
            'vendor-supabase': ['@supabase/supabase-js'],
          }
        }
      }
    }
  };
});
