import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const assetDir = join(process.cwd(), "dist", "assets");
// AdminDashboard incluye el editor operativo, gráficas y modales; el límite
// evita regresiones accidentales sobre su tamaño actual (~3.08 MB).
const budgets = { "admin-dashboard": 3_200_000, "superadmin-dashboard": 300_000 };
const files = readdirSync(assetDir);
for (const [name, budget] of Object.entries(budgets)) {
  const file = files.find((f) => f.startsWith(name) && f.endsWith(".js"));
  if (!file) throw new Error(`Bundle ausente: ${name}`);
  const bytes = statSync(join(assetDir, file)).size;
  console.log(`${name}: ${bytes} bytes (budget ${budget})`);
  if (bytes > budget) throw new Error(`${name} supera el budget (${bytes} > ${budget})`);
}
