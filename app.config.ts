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
    baseURL: "/expressions/",
    prerender: {
      routes: ["/", "/index", "/camera", "/arithmetic", "/pareidolia", "/transference"],
      crawlLinks: false
    }
  } : process.env.NODE_ENV === "local" ? {
    preset: "static",
    baseURL: "/",
    prerender: {
      routes: ["/", "/index", "/camera", "/arithmetic", "/pareidolia", "/transference"],
      crawlLinks: false
    }
  } : undefined,
});