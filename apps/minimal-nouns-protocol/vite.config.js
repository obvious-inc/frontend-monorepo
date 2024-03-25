import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  envPrefix: "PUBLIC_",
  plugins: [react()],
  server: {
    port: process.env.PORT ?? 8080,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          wagmi: ["wagmi", "viem", "@tanstack/react-query"],
        },
      },
    },
  },
});
