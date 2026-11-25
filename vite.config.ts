import { defineConfig } from 'vite';

// Relative base so the build works from GitHub Pages (/<repo>/) or any static host.
export default defineConfig({
  base: './',
  server: { host: true },
});
