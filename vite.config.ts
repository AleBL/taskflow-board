import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

/**
 * Absolute site URL for Open Graph tags (LinkedIn and others ignore relative
 * og:image URLs). Override with VITE_SITE_URL; on Vercel the production
 * domain is exposed as VERCEL_PROJECT_PRODUCTION_URL.
 */
const siteUrl = (
  process.env.VITE_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://taskflow-board-nine.vercel.app")
).replace(/\/$/, "");

const siteUrlPlugin: Plugin = {
  name: "taskflow-site-url",
  transformIndexHtml: (html) => html.replaceAll("%SITE_URL%", siteUrl),
};

const plugins = [react(), tailwindcss(), jsxLocPlugin(), siteUrlPlugin];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
