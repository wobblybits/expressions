import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  server: {
    preset: "static",
    prerender: {
      routes: ["/", "/about", "/game", "/composite", "/pareidolia"],
      crawlLinks: false
    },
  },
}); 