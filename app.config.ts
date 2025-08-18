// app.config.ts
import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  ssr: true,
  appRoot: "./src",
  routeDir: "./src/routes",
  vite: {
    plugins: [tailwindcss()],
    define: {
      "import.meta.env.NODE_ENV": JSON.stringify("local"),
    },
    optimizeDeps: {
      force: true
    },
  },
  extensions: [".tsx"],
  server: {
    preset: "static",
    // Add the baseURL back for asset paths
    baseURL: "/ellipses/.output/public/",
    serveStatic: true,
    prerender: {
      autoSubfolderIndex: false,
      routes: ["/", "/camera", "/arithmetic", "/pareidolia", "/transference"],
    }
  },
});