import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8081,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      // Never run the SW during dev/preview — it breaks the Lovable iframe.
      devOptions: { enabled: false },
      // Use the static kill-switch SW in public/sw.js instead of generating one.
      // This guarantees previously-installed SWs are cleaned up and no new
      // workbox SW is registered to interfere with preview navigations.
      strategies: "injectManifest",
      srcDir: "public",
      filename: "sw.js",
      injectRegister: false,
      injectManifest: {
        injectionPoint: undefined,
      },
      includeAssets: ["ramky-logo.png", "favicon.ico"],
      manifest: {
        name: "Ramky Vendor Portal",
        short_name: "Ramky VMS",
        description: "Ramky Infrastructure Limited - Vendor Management System",
        theme_color: "#2563eb",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/ramky-logo.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/ramky-logo.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
