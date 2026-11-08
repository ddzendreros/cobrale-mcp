// Demo B2B: el agente de cobranza de cualquier empresa, conectado a Cóbrale MCP en ~5 líneas.
// Usa la Responses API de OpenAI con el MCP como herramienta remota.
// Requiere PUBLIC_URL https (túnel o deploy): OpenAI llama a tu /mcp desde internet.
//
//   npm run agente -- "Cóbrale $0.01 al 5512345678 por la factura FAC-001 y avísame cuando pague"
import "dotenv/config";
import OpenAI from "openai";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { pickModel } from "../../src/libreta/ai.js";

const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
if (!process.env.OPENAI_API_KEY) throw new Error("Falta OPENAI_API_KEY");
if (!PUBLIC_URL.startsWith("https://")) throw new Error("Falta PUBLIC_URL https (OpenAI no puede llegar a localhost)");

const client = new OpenAI();
const model = (await pickModel()) || "gpt-5.5";
const instructions =
  "Eres el agente de cobranza de una PyME mexicana. Cobras con CoDi usando las herramientas de Cóbrale. " +
  "Si te piden un cobro presencial, usa cobrar_con_qr; si es por chat, crear_link_de_pago. " +
  "Antes de cobrar a un celular, confirma con el usuario el número de 10 dígitos; después de confirmarlo, usa cobrar_a_celular. " +
  "Nunca inventes montos: si no te dieron uno, pregunta antes de crear el cobro. " +
  "Después de crear un cobro, llama esperar_pago con segundos: 45; si sigue pending, repite la llamada hasta 4 veces. " +
  "Responde breve, en español.";
const tools = [
  {
    type: "mcp",
    server_label: "cobrale",
    server_url: `${PUBLIC_URL}/mcp`,
    require_approval: "never",
    ...(process.env.PEY_MCP_TOKEN ? { headers: { Authorization: `Bearer ${process.env.PEY_MCP_TOKEN}` } } : {}),
  },
];

function compact(value, maxLength = 240) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function formatArguments(args) {
  if (typeof args !== "string") return compact(JSON.stringify(args));
  try {
    return compact(JSON.stringify(JSON.parse(args)));
  } catch {
    return compact(args);
  }
}

function summarizeResult(rawOutput) {
  if (rawOutput == null || rawOutput === "") return "sin resultado";

  let output = rawOutput;
  if (typeof rawOutput === "string") {
    try {
      output = JSON.parse(rawOutput);
    } catch {
      return compact(rawOutput);
    }
  }

  if (Array.isArray(output?.content)) {
    const texts = output.content.filter((part) => part?.type === "text" && part.text).map((part) => part.text);
    if (texts.length) return compact(texts.join(" · "));
  }
  if (output?.structuredContent) {
    const withoutImages = (value) => {
      if (Array.isArray(value)) return value.slice(0, 5).map(withoutImages);
      if (value && typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => !/(qrstring|qrsvg|image|base64)/i.test(key))
            .slice(0, 10)
            .map(([key, nested]) => [key, withoutImages(nested)]),
        );
      }
      return typeof value === "string" ? compact(value, 120) : value;
    };
    return compact(JSON.stringify(withoutImages(output.structuredContent)));
  }
  return compact(JSON.stringify(output));
}

function printToolCalls(response) {
  for (const item of response.output) {
    if (item.type !== "mcp_call") continue;
    console.log(`🔧 ${item.name}(${formatArguments(item.arguments)})`);
    console.log(`   ↳ ${item.error ? `Error: ${compact(item.error)}` : summarizeResult(item.output)}`);
  }
}

async function respond(input, previousResponseId, signal) {
  const params = {
    model,
    instructions,
    input,
    tools,
    ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
  };
  return signal ? client.responses.create(params, { signal }) : client.responses.create(params);
}

async function runOnce(input) {
  const response = await respond(input);
  printToolCalls(response);
  console.log("\n🤖 " + response.output_text);
}

async function runChat() {
  const rl = createInterface({ input: stdin, output: stdout });
  const controller = new AbortController();
  let closing = false;
  let previousResponseId;
  rl.on("close", () => {
    closing = true;
  });
  rl.on("SIGINT", () => {
    console.log("\nHasta luego.");
    controller.abort();
    rl.close();
  });

  try {
    while (!closing) {
      let input;
      try {
        input = await rl.question("tú › ");
      } catch (error) {
        if (closing) break;
        throw error;
      }

      if (input.trim().toLocaleLowerCase("es-MX") === "salir") break;
      if (!input.trim()) continue;

      try {
        const response = await respond(input, previousResponseId, controller.signal);
        previousResponseId = response.id;
        printToolCalls(response);
        console.log("\n🤖 " + response.output_text);
      } catch (error) {
        if (closing || controller.signal.aborted) break;
        console.error(`⚠️ Error de OpenAI o de red: ${error.message}`);
      }
    }
  } finally {
    rl.close();
  }
}

const argv = process.argv.slice(2);
const onceFlag = argv[0] === "--once";
const input = (onceFlag ? argv.slice(1) : argv).join(" ").trim();
if (input) await runOnce(input);
else await runChat();
