// app.config.ts
import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  ssr: false,
  vite: {
    plugins: [tailwindcss()],
  },
  server: process.env.NODE_ENV === "production" ? {
    preset: "static",
    baseURL: "/pareidolia/",
    prerender: {
      routes: ["/", "/about", "/game", "/composite", "/pareidolia"],
      crawlLinks: false
    }
  } : undefined,
});