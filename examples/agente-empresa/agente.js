// Demo B2B: el agente de cobranza de cualquier empresa, conectado a pey MCP en ~5 líneas.
// Usa la Responses API de OpenAI con el MCP como herramienta remota.
// Requiere PUBLIC_URL https (túnel o deploy): OpenAI llama a tu /mcp desde internet.
//
//   npm run agente -- "Cóbrale $0.01 al 5512345678 por la factura FAC-001 y avísame cuando pague"
//
// TODO (Persona 3): hacerlo conversacional (loop en terminal o bot de WhatsApp/Telegram).
import "dotenv/config";
import OpenAI from "openai";
import { pickModel } from "../../src/libreta/ai.js";

const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
if (!process.env.OPENAI_API_KEY) throw new Error("Falta OPENAI_API_KEY");
if (!PUBLIC_URL.startsWith("https://")) throw new Error("Falta PUBLIC_URL https (OpenAI no puede llegar a localhost)");

const client = new OpenAI();
const model = (await pickModel()) || "gpt-5.5";
const input = process.argv.slice(2).join(" ") || "Cóbrale $0.01 al 5512345678 por la factura FAC-001 y avísame cuando pague.";

const response = await client.responses.create({
  model,
  instructions:
    "Eres el agente de cobranza de una PyME mexicana. Cobras con CoDi usando las herramientas de pey. " +
    "Si te dan un celular usa cobrar_a_celular; si es presencial, cobrar_con_qr; si es por chat, crear_link_de_pago. " +
    "Después de crear un cobro llama esperar_pago hasta que se pague o pasen ~2 intentos. Responde breve, en español.",
  input,
  tools: [
    {
      type: "mcp",
      server_label: "pey",
      server_url: `${PUBLIC_URL}/mcp`,
      require_approval: "never",
      ...(process.env.PEY_MCP_TOKEN ? { headers: { Authorization: `Bearer ${process.env.PEY_MCP_TOKEN}` } } : {}),
    },
  ],
});

for (const item of response.output) if (item.type === "mcp_call") console.log(`🔧 ${item.name}(${item.arguments})`);
console.log("\n🤖 " + response.output_text);
