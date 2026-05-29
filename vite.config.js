import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const openRouterApiKey = env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || '';
  const appUrl = env.OPENROUTER_APP_URL || process.env.OPENROUTER_APP_URL || 'http://localhost:5173';
  const appTitle = env.OPENROUTER_APP_TITLE || process.env.OPENROUTER_APP_TITLE || 'solo-leveling-fit';

  const proxy = openRouterApiKey
    ? {
        '/api/openrouter/chat': {
          target: 'https://openrouter.ai',
          changeOrigin: true,
          secure: true,
          rewrite: () => '/api/v1/chat/completions',
          headers: {
            Authorization: `Bearer ${openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': appUrl,
            'X-Title': appTitle
          }
        }
      }
    : undefined;

  return {
    plugins: [react()],
    server: { proxy },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'react-core';
            if (id.includes('node_modules/scheduler/')) return 'react-core';
            if (id.includes('node_modules/three/examples')) return 'three-extras';
            if (id.includes('node_modules/@react-three/drei')) return 'three-drei';
            if (id.includes('node_modules/@react-three/fiber')) return 'three-fiber';
            if (id.includes('node_modules/three') || id.includes('node_modules/@react-three')) return 'three-core';
            if (id.includes('node_modules/recharts')) return 'charts';
            if (id.includes('node_modules/framer-motion')) return 'motion';
            if (id.includes('node_modules')) return 'vendor';
            return undefined;
          }
        }
      }
    }
  };
});
