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
      "import.meta.env.SERVER_BASE_URL": JSON.stringify("/ellipses/.output/public/"),
      "import.meta.env.VITE_BASE_URL": JSON.stringify("/ellipses/.output/public/"),
    },
    optimizeDeps: {
      force: true
    },
  },
  extensions: [".tsx"],
  server: {
    preset: "static",
    baseURL: "/ellipses/.output/public/",
    serveStatic: true,
    prerender: {
      autoSubfolderIndex: false,
      routes: ["index", "camera", "arithmetic", "pareidolia", "transference"],
    }
  },
});