// Diagnóstico rápido: `npm run check`. Corre esto ANTES del demo.
import "dotenv/config";
import { createQr, peyLive } from "../src/pey/client.js";
import { pickModel, parseCommand, aiLive, aiProvider } from "../src/libreta/ai.js";

const ok = (m) => console.log("  ✅ " + m);
const bad = (m) => console.log("  ❌ " + m);
const warn = (m) => console.log("  ⚠️  " + m);

console.log("\n📒 Diagnóstico de Libreta\n");

console.log("IA (Claude u OpenAI)");
if (!aiLive()) warn("Sin ANTHROPIC_API_KEY ni OPENAI_API_KEY: se usará el parser local (funciona, pero sin foto ni IA).");
else {
  const model = await pickModel();
  try {
    const r = await parseCommand("Apúntale 85 a Doña Mary de 2 cocas y un pan", []);
    r.ai ? ok(`${aiProvider()} · modelo ${model} respondió: ${JSON.stringify(r.actions[0])}`) : bad(`La IA falló (${r.aiError}). Revisa la key o prueba otro modelo (ANTHROPIC_MODEL / OPENAI_MODEL).`);
  } catch (e) { bad(e.message); }
}

console.log("\npey / CoDi");
if (!peyLive()) warn("Sin PEY_API_KEY: CoDi simulado (botón 'Simular pago').");
else {
  try {
    const r = await createQr({ amount: 0.01, concept: "Prueba Libreta", numRef: "1234567", expiration: 360 });
    ok(`QR creado (id ${r.id}). qrString: ${String(r.qrString).slice(0, 60)}…`);
  } catch (e) {
    bad(`pey respondió ${e.status || ""}: ${e.message} ${JSON.stringify(e.body || {})}`);
    if (e.status === 401 || e.status === 403) console.log("     → Revisa la API key en portal.mipey.mx/developers");
    if (e.status === 400) console.log("     → ¿Tu cuenta de pago ya está ACTIVA? Puedes usar la cuenta de prueba de pey mientras.");
  }
}

console.log("\nWebhook");
const pu = process.env.PUBLIC_URL;
pu?.startsWith("https://") ? ok(`Registra en el portal: ${pu.replace(/\/$/, "")}/webhooks/pey`) : warn("Define PUBLIC_URL=https://... (túnel o deploy) y regístralo en portal.mipey.mx/developers");
process.env.PEY_WEBHOOK_SECRET ? ok("PEY_WEBHOOK_SECRET definido: se verifica la firma") : warn("Sin PEY_WEBHOOK_SECRET: se aceptan webhooks sin verificar firma");
if (process.env.PEY_TEST_AMOUNT) warn(`PEY_TEST_AMOUNT=${process.env.PEY_TEST_AMOUNT}: todos los cobros reales serán de ese monto`);
console.log("");
