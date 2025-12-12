import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Important pour Electron / chargement via file:// :
  // génère des chemins relatifs ("./assets/...") au lieu de "/assets/..."
  base: "./",
});
