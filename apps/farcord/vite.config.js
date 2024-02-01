import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  publicDir: "static",
  envPrefix: "PUBLIC_",
  plugins: [react({ jsxImportSource: "@emotion/react" })],
  server: {
    port: process.env.PORT ?? 8080,
  },
});
