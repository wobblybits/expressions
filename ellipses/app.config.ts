import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  ssr: false,
  server: process.env.NODE_ENV === "production" ? {
    preset: "static",
    baseURL: "/pareidolia/", // GitHub Pages subdirectory
  } : undefined,
}); 