// app.config.ts
import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  ssr: false,//process.env.NODE_ENV === "production",
  server: process.env.NODE_ENV === "production" ? {
    preset: "static",
    baseURL: "/pareidolia/",
    prerender: {
      routes: ["/", "/about", "/game", "/composite", "/pareidolia"],
      crawlLinks: false
    }
  } : undefined,
});