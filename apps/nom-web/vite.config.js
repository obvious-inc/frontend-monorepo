import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  return {
    publicDir: 'static',
    envPrefix: "PUBLIC_",
    plugins: [react({ jsxImportSource: "@emotion/react" })],
    define: {
      "import.meta.env.EDGE_API_BASE_URL": JSON.stringify(
        // If there’s no edge api origin specified we proxy everything through /api
        env.EDGE_API_ORIGIN == null ? "/api" : "/edge-api"
      ),
    },
    server: {
      proxy: {
        "/api": {
          target: env.API_BASE_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/edge-api": {
          target: env.EDGE_API_BASE_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/edge-api/, ""),
        },
      },
    },
  };
});
