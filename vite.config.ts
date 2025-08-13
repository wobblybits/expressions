import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [
    solidPlugin(), 
    tailwindcss(),
  ],
  base: './', // Use relative paths instead of absolute
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
    outDir: "dist",
    emptyOutDir: true,
  },
  optimizeDeps: {
  }
});
