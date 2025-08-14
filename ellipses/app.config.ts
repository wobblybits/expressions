import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  ssr: process.env.NODE_ENV === "production",
  server: process.env.NODE_ENV === "production" ? {
    preset: "static",
    prerender: {
      routes: ["/", "/about", "/game", "/composite", "/pareidolia"], // Keep all routes
      crawlLinks: false
    }
  } : undefined,
}); 