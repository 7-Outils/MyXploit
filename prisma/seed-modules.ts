/**
 * Script pour activer tous les modules pour toutes les organisations existantes
 * Usage: npm run seed:modules
 */

// Simple script - utilise directement les commandes SQL via psql si besoin
const modules = ["ENERGY", "FINANCIER", "ADMINISTRATIF", "EXPLOITATION", "OUTILS", "CONTRACTS", "PRICING"];

console.log("🌱 Pour activer les modules, exécutez ce script SQL:");
console.log("");
console.log("INSERT INTO organization_modules (id, organization_id, module, is_enabled, created_at, updated_at)");
console.log("SELECT");
console.log("  gen_random_uuid(),");
console.log("  o.id,");
console.log("  m.module,");
console.log("  true,");
console.log("  NOW(),");
console.log("  NOW()");
console.log("FROM organizations o");
console.log("CROSS JOIN (VALUES");
modules.forEach((mod, i) => {
  console.log(`  ('${mod}')${i < modules.length - 1 ? "," : ""}`);
});
console.log(") AS m(module)");
console.log("ON CONFLICT (organization_id, module) DO UPDATE SET is_enabled = true;");
console.log("");
console.log("✅ Ou utilisez l'API /api/admin/organizations/[id]/modules pour chaque org");
