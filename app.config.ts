// app.config.ts
import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // appRoot: "./src",
  // routeDir: "./src/routes",
  ssr: process.env.NODE_ENV === "production" || process.env.NODE_ENV === "local",
  vite: {
    plugins: [tailwindcss()],
  },
  server: process.env.NODE_ENV === "production" ? {
    preset: "static",
    baseURL: "/expressions/",
    prerender: {
      routes: ["", "index", "camera", "arithmetic", "pareidolia", "transference"],
    }
  } : process.env.NODE_ENV === "local" ? {
    preset: "static",
    baseURL: "/ellipses/.output/public/",
    serveStatic: true,
    prerender: {
      autoSubfolderIndex: false,
      routes: ["index", "camera", "arithmetic", "pareidolia", "transference"],
    }
  } : undefined,
});