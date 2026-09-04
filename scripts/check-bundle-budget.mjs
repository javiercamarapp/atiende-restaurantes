import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const assetDir = join(process.cwd(), "dist", "assets");
// These budgets sit just above the measured route chunks. Shared vendor
// chunks remain separate; forcing them into AdminDashboard regressed it by
// more than 1 MB during the audit and is intentionally rejected here.
const budgets = {
  "AdminDashboard": 400_000,
  "SuperAdminDashboard": 30_000,
  "voice-": 600_000,
};
const files = readdirSync(assetDir);
for (const [name, budget] of Object.entries(budgets)) {
  const file = files.find((f) => f.startsWith(name) && f.endsWith(".js"));
  if (!file) throw new Error(`Bundle ausente: ${name}`);
  const bytes = statSync(join(assetDir, file)).size;
  console.log(`${name}: ${bytes} bytes (budget ${budget})`);
  if (bytes > budget) throw new Error(`${name} supera el budget (${bytes} > ${budget})`);
}
