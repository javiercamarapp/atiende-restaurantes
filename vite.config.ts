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
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    // El único chunk cercano a este límite es LiveKit (558 kB / 146 kB
    // gzip), cargado bajo demanda al iniciar la prueba de voz. Los chunks de
    // navegación inicial quedan bastante por debajo y tienen budget propio.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // El panel administrativo reúne mapas, gráficas, exportadores y el
        // SDK de voz. Separar esas familias evita un único chunk de >2 MB y
        // permite que el navegador descargue solo lo necesario por caché.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/xlsx/")) return "spreadsheet";
          if (id.includes("/recharts/") || id.includes("/d3-")) return "charts";
          if (id.includes("/leaflet/")) return "maps";
          if (id.includes("/@livekit/")) return "voice-livekit-protocol";
          if (id.includes("/livekit-client/")) return "voice-livekit-client";
          if (id.includes("/@elevenlabs/")) return "voice-elevenlabs";
          if (id.includes("/framer-motion/")) return "motion";
          if (id.includes("/@supabase/") || id.includes("/@radix-ui/")) {
            return "app-platform";
          }
          return undefined;
        },
      },
    },
  },
}));
