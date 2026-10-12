import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  integrations: [react()],
  devToolbar: { enabled: false },
  server: { host: "127.0.0.1", port: 4321 },
  vite: { server: { proxy: { "/api": "http://127.0.0.1:4000" } } },
});
