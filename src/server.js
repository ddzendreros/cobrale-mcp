// Un solo proceso: pey permite UN webhook por API key, así que este servidor lo recibe
// y reparte los pagos a Libreta (UI) y al MCP (agentes).
import "dotenv/config";
import express from "express";
import path from "node:path";
import * as payments from "./pey/payments.js";
import { router as libreta } from "./libreta/routes.js";
import * as ai from "./libreta/ai.js";
import { mountMcp } from "./mcp/server.js";

const PORT = Number(process.env.PORT || 3000);
const app = express();
app.disable("x-powered-by");

// Webhook de pey: raw body para verificar la firma (Standard Webhooks)
app.post("/webhooks/pey", express.raw({ type: "*/*", limit: "1mb" }), (req, res) => {
  const { status, body } = payments.handleWebhook(req.body?.toString("utf8") || "", req.headers);
  res.status(status).json(body);
});

app.use(express.json({ limit: "15mb" }));
mountMcp(app);
app.use(libreta);
app.use(express.static(path.resolve("public"), { extensions: ["html"] }));

// Página pública de un cobro: el agente le pasa este link a quien paga (QR grande + estado en vivo)
app.get("/cobro/:id", (req, res) => {
  const c = payments.getCharge(req.params.id);
  if (!c) return res.status(404).send(page("Cobro no encontrado", "", "🤔"));
  const body = c.kind === "qr" ? `<div class="qr">${c.qrSvg}</div><p>Escanea con la app de tu banco (CoDi)</p>` : c.kind === "link" ? `<p><a href="${c.url}">${c.url}</a></p>` : `<p>Solicitud enviada al celular •••• ${c.phone?.slice(-4)}</p>`;
  res.send(page(`$${Number(c.amount).toFixed(2)}`, `${escapeHtml(c.concept)}${body}<p id="st" class="${c.status}">${c.status === "paid" ? "✅ Pagado" : "Esperando pago…"}</p>`, "💸",
    `<script>setInterval(async()=>{const r=await fetch('/api/charges/${c.id}').then(r=>r.json());if(r.charge.status==='paid'){const s=document.getElementById('st');s.textContent='✅ ¡Pagado!';s.className='paid'}},2500)</script>`));
});
app.get("/pagado", (req, res) => res.send(page("¡Pago recibido!", "Gracias, tu pago llegó. Ya puedes cerrar esta ventana.", "✅")));
app.get("/demo-checkout/:id", (req, res) => {
  const c = payments.listCharges({ limit: 1000 }).find((x) => x.peyId === req.params.id);
  if (!c) return res.status(404).send(page("Link no encontrado", "", "🤔"));
  res.send(page(`Pagar $${Number(c.amount).toFixed(2)}`, `${escapeHtml(c.concept)}<br><small>Checkout simulado (modo demo).</small>`, "💳",
    `<button onclick="fetch('/api/charges/${c.id}/simulate',{method:'POST'}).then(()=>location.href='/pagado')">Pagar con CoDi</button>`));
});

function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])); }
function page(title, body, icon, extra = "") {
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;background:#f6f1e7;color:#14213d;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px}
.c{background:#fff;padding:36px 30px;border-radius:20px;box-shadow:0 10px 40px #0001;max-width:420px}h1{margin:.2em 0;font-size:44px}.i{font-size:48px}
.qr svg{width:300px;max-width:80vw;height:auto}#st{font-weight:700;font-size:20px}#st.paid{color:#0a7d4f;font-size:28px}
button{margin-top:20px;font:600 18px system-ui;background:#0a7d4f;color:#fff;border:0;border-radius:12px;padding:14px 28px;cursor:pointer}</style>
<div class="c"><div class="i">${icon}</div><h1>${title}</h1><div>${body}</div>${extra}</div></html>`;
}

app.listen(PORT, async () => {
  await ai.pickModel();
  const m = payments.mode();
  console.log(`\n💸 AlanCobra lista en http://localhost:${PORT}`);
  console.log(`   Libreta:  http://localhost:${PORT}/`);
  console.log(`   MCP:      ${m.publicUrl || `http://localhost:${PORT}`}/mcp ${process.env.PEY_MCP_TOKEN ? "(con token)" : "(sin token)"}`);
  console.log(`   pey:      ${m.pey === "live" ? "EN VIVO" : "DEMO simulado (sin PEY_API_KEY)"}`);
  console.log(`   IA:       ${ai.currentModel() || "parser local (sin OPENAI_API_KEY)"}`);
  console.log(`   Webhook:  ${m.publicUrl ? m.publicUrl + "/webhooks/pey" : "(define PUBLIC_URL)"} ${m.webhookVerified ? "· firma verificada" : "· SIN verificar firma"}`);
  if (m.testAmount) console.log(`   ⚠️  Modo prueba: todos los cobros reales serán de $${m.testAmount}`);
});
