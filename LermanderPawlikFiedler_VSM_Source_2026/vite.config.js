import { defineConfig } from "vite";

export default defineConfig({
  // Emit folder-relative URLs so dist can be hosted from any subdirectory.
  base: "./",
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: true
  }
});
