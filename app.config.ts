// app.config.ts
import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";

const target = process.env.DEPLOYMENT_TARGET || "development";
console.log("🚀 Build-time DEPLOYMENT_TARGET:", target); // Add this debug line

const isDev = target === "development";
const isProduction = target === "production";
const isLocal = target === "local";

export default defineConfig({
  ssr: !isDev,
  appRoot: "./src",
  routeDir: "./src/routes",
  vite: {
    plugins: [tailwindcss()],
    define: {
      "import.meta.env.DEPLOYMENT_TARGET": JSON.stringify(target),
    },
    optimizeDeps: {
      force: true
    },
  },
  extensions: [".tsx"],
  ...(isDev ? {} : {
    server: {
      preset: "static",
      baseURL: isProduction ? "/expressions/" : "/ellipses/.output/public/",
      serveStatic: true,
      prerender: {
        autoSubfolderIndex: false,
        routes: ["/", "/camera", "/arithmetic", "/pareidolia", "/transference", "/synth"],
      }
    }
  }),
});