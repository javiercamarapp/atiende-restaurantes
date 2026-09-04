import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Mantiene el panel operativo y el superadmin fuera del bundle
        // inicial, incluso cuando compartan dependencias grandes.
        manualChunks(id) {
          if (id.includes("/src/pages/AdminDashboard")) return "admin-dashboard";
          if (id.includes("/src/pages/SuperAdminDashboard")) return "superadmin-dashboard";
        },
      },
    },
  },
}));
