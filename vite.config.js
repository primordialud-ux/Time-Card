import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = `http://localhost:${env.PORT || 3000}`;

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': apiTarget,
        '/socket.io': { target: apiTarget, ws: true },
        '/uploads': apiTarget,
      },
    },
  };
});