import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The built site is written into the hub's static folder, so one uvicorn process serves
// the NEST story at /nest/ and the working prototype pages next to it.
const hub = "http://127.0.0.1:8000";

export default defineConfig({
  base: "/nest/",
  plugins: [react(), tailwindcss()],
  build: { outDir: "../web/nest", emptyOutDir: true },
  server: {
    proxy: {
      "/api": hub,
      "/ws": { target: hub, ws: true },
    },
  },
});
