import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  return {
    publicDir: "static",
    envPrefix: "PUBLIC_",
    plugins: [react({ jsxImportSource: "@emotion/react" })],
    define: {
      "import.meta.env.EDGE_API_BASE_URL": JSON.stringify(
        env.EDGE_API_BASE_URL == null ? "/api" : "/edge-api"
      ),
    },
    server: {
      port: process.env.PORT ?? 8080,
      proxy: {
        "/edge-api": {
          target: env.EDGE_API_BASE_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/edge-api/, ""),
        },
      },
    },
  };
});
