import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths(), TanStackRouterVite()],
  resolve: {
    alias: {
      "@": "/src",
      react: path.resolve("../../node_modules/react"),
      "react-dom": path.resolve("../../node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query", "@vellbase/api-client", "@vellbase/auth", "@vellbase/social-store", "@vellbase/react-hooks", "@vellbase/utils"],
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});