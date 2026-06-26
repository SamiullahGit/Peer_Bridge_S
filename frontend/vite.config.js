import { defineConfig } from 'vite';
import react           from '@vitejs/plugin-react';

// Vite dev server runs on 5173. /api, /uploads and /certificates are
// proxied to the backend so the frontend can use relative URLs in
// production *and* development.
//
// Proxy target defaults to the local backend (http://localhost:4000).
// To preview the UI against the LIVE backend without running a local
// server, set VITE_PROXY_TARGET, e.g. (PowerShell):
//   $env:VITE_PROXY_TARGET="https://peer-bridge-s.onrender.com"; npm run dev
const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:4000';
const proxyEntry  = { target: proxyTarget, changeOrigin: true };

export default defineConfig({
  plugins: [react()],
  server : {
    port: 5173,
    proxy: {
      '/api'         : proxyEntry,
      '/uploads'     : proxyEntry,
      '/certificates': proxyEntry,
    },
  },
});
