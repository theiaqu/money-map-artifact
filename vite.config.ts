import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/money-map-artifact/',
  plugins: [react()],
  server: { port: 5199 },
});
