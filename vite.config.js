import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");
  const serverApiTarget = String(env.VITE_SERVER_API_TARGET || "http://127.0.0.1:4173").trim();
  return {
    base: "./",
    plugins: [react()],
    server: {
      proxy: {
        "/api/v1": {
          target: serverApiTarget,
          changeOrigin: false,
        },
        "/api/vehicle": {
          target: serverApiTarget,
          changeOrigin: false,
        },
      },
    },
    build: {
      rollupOptions: {
        input: path.resolve(root, "index.html"),
      },
    },
  };
});
