// Prueba de punta a punta del MCP en modo demo: `npm run test:mcp -- [url]`.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const REQUIRED_TOOLS = [
  "cobrar_con_qr",
  "cobrar_a_celular",
  "crear_link_de_pago",
  "esperar_pago",
  "estado_del_cobro",
  "pagos_recibidos",
];

function checkOk(result, label) {
  assert.ok(!result?.isError, `${label}: el servidor MCP respondió con error: ${result?.content?.[0]?.text || "sin detalle"}`);
}

function logCheck(message) {
  console.log(`✅ ${message}`);
}

/** Corre las verificaciones del MCP contra un servidor ya levantado. */
export async function runMcpChecks(mcpUrl, { token } = {}) {
  const url = new URL(mcpUrl);
  assert.ok(["http:", "https:"].includes(url.protocol), "La URL del MCP debe usar HTTP o HTTPS");

  const client = new Client({ name: "pruebas-cobrale", version: "1.0.0" });
  try {
    const requestInit = token ? { requestInit: { headers: { Authorization: `Bearer ${token}` } } } : undefined;
    await client.connect(new StreamableHTTPClientTransport(url, requestInit));

    const listed = await client.listTools();
    const names = new Set(listed.tools.map((tool) => tool.name));
    for (const name of REQUIRED_TOOLS) assert.ok(names.has(name), `Falta la herramienta MCP obligatoria "${name}"`);
    logCheck("el MCP publica las seis herramientas del contrato");

    const qr = await client.callTool({
      name: "cobrar_con_qr",
      arguments: { monto: 149.5, concepto: "Factura 123", referencia: "FAC-123" },
    });
    checkOk(qr, "cobrar_con_qr");
    const qrImage = qr.content?.find((item) => item.type === "image");
    assert.ok(qrImage?.data, "cobrar_con_qr debe regresar una imagen QR");
    const qrId = qr.structuredContent?.cobro_id;
    assert.ok(qrId, "cobrar_con_qr debe regresar structuredContent.cobro_id");
    logCheck("cobrar_con_qr devuelve el identificador y la imagen QR");

    const mcpOrigin = url.origin;
    const simulateUrl = new URL(`/api/charges/${encodeURIComponent(qrId)}/simulate`, mcpOrigin);
    const simulation = new Promise((resolve) => {
      setTimeout(async () => {
        try {
          const response = await fetch(simulateUrl, { method: "POST" });
          const body = await response.json().catch(() => ({}));
          resolve({ response, body });
        } catch (error) {
          // Resolver el rechazo aquí evita una promesa suelta si el servidor no está disponible.
          resolve({ error });
        }
      }, 1_000);
    });

    const waitStarted = Date.now();
    const paid = await client.callTool({ name: "esperar_pago", arguments: { cobro_id: qrId, segundos: 10 } });
    const waitElapsed = Date.now() - waitStarted;
    const simulated = await simulation;
    if (simulated.error) throw new Error(`No pude simular el pago del QR: ${simulated.error.message}`);
    assert.ok(simulated.response.ok, `La simulación del QR falló (HTTP ${simulated.response.status})`);
    assert.match(String(simulated.body.result || ""), /^pagado/i, "La simulación debe confirmar el pago");
    checkOk(paid, "esperar_pago después de simular");
    assert.equal(paid.structuredContent?.estado, "paid", "esperar_pago debe detectar el pago simulado");
    assert.ok(waitElapsed < 5_000, `esperar_pago tardó ${waitElapsed} ms; debe despertar antes de 5 s`);
    logCheck(`esperar_pago detecta el pago simulado en ${waitElapsed} ms`);

    const push = await client.callTool({
      name: "cobrar_a_celular",
      arguments: { monto: 20, celular: "55 1234 5678", concepto: "Prueba de celular" },
    });
    checkOk(push, "cobrar_a_celular válido");
    assert.ok(push.structuredContent?.cobro_id, "cobrar_a_celular debe crear un cobro");
    logCheck("cobrar_a_celular acepta un número válido");

    const invalidPush = await client.callTool({
      name: "cobrar_a_celular",
      arguments: { monto: 20, celular: "123" },
    });
    assert.equal(invalidPush.isError, true, "Un celular inválido debe regresar isError: true");
    logCheck("cobrar_a_celular rechaza un número inválido");

    const link = await client.callTool({ name: "crear_link_de_pago", arguments: { monto: 99 } });
    checkOk(link, "crear_link_de_pago");
    assert.ok(link.structuredContent?.link_de_pago, "crear_link_de_pago debe regresar link_de_pago");
    logCheck("crear_link_de_pago devuelve un enlace");

    const pending = await client.callTool({
      name: "esperar_pago",
      arguments: { cobro_id: push.structuredContent.cobro_id, segundos: 1 },
    });
    checkOk(pending, "esperar_pago de un cobro pendiente");
    assert.equal(pending.structuredContent?.estado, "pending", "El cobro push debe seguir pendiente");
    logCheck("esperar_pago devuelve pending para un cobro sin pagar");

    const received = await client.callTool({ name: "pagos_recibidos", arguments: {} });
    checkOk(received, "pagos_recibidos");
    assert.ok(Number(received.structuredContent?.total) >= 149.5, "pagos_recibidos debe incluir el pago de $149.50");
    logCheck("pagos_recibidos incluye el cobro pagado");
  } finally {
    await client.close();
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    // Solo al ejecutarlo directamente se lee .env para admitir PEY_MCP_TOKEN.
    await import("dotenv/config");
    const mcpUrl = process.argv[2] || process.env.MCP_URL || "http://localhost:3000/mcp";
    await runMcpChecks(mcpUrl, { token: process.env.PEY_MCP_TOKEN || "" });
    console.log("✅ pruebas MCP OK");
  } catch (error) {
    console.error(`❌ fallaron las pruebas MCP: ${error.stack || error.message || error}`);
    process.exitCode = 1;
  }
}
