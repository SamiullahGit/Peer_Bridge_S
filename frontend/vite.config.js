import { defineConfig } from 'vite';
import react           from '@vitejs/plugin-react';

// Vite dev server runs on 5173. /api, /uploads and /certificates are
// proxied to the Express backend on 4000 so the frontend can use
// relative URLs in production *and* development.
export default defineConfig({
  plugins: [react()],
  server : {
    port: 5173,
    proxy: {
      '/api'         : 'http://localhost:4000',
      '/uploads'     : 'http://localhost:4000',
      '/certificates': 'http://localhost:4000',
    },
  },
});
