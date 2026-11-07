// pey MCP: le da a cualquier agente (Codex, ChatGPT, Claude, el agente de tu empresa) la capacidad de cobrar con CoDi.
// Transporte: Streamable HTTP en /mcp (stateless). Comparte el núcleo de cobros con Libreta,
// así que los webhooks de pey que recibe este mismo servidor despiertan a `esperar_pago`.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import QRCode from "qrcode";
import * as payments from "../pey/payments.js";

const MCP_TOKEN = process.env.PEY_MCP_TOKEN || "";
const money = (n) => "$" + Number(n).toFixed(2);

function summary(c) {
  const p = payments.toPublic(c);
  return {
    cobro_id: p.id, tipo: p.kind, estado: p.status, monto: p.amount, monto_cobrado: p.chargedAmount, concepto: p.concept,
    referencia: p.reference, celular: p.phone, link_de_pago: p.url, pagina_del_cobro: p.payPage,
    creado: new Date(p.createdAt).toISOString(), pagado: p.paidAt ? new Date(p.paidAt).toISOString() : null, demo: p.demo,
  };
}
const ok = (text, data, extra = []) => ({ content: [{ type: "text", text: `${text}\n\n${JSON.stringify(data, null, 2)}` }, ...extra], structuredContent: data });
const fail = (e) => ({ isError: true, content: [{ type: "text", text: e.expose ? e.message : e instanceof payments.pey.PeyError ? `pey: ${e.message} ${JSON.stringify(e.body || {})}` : e.message }] });

const amountSchema = z.number().positive().max(1_000_000).describe("Monto en pesos MXN, ej. 149.50");
const conceptSchema = z.string().max(40).optional().describe("Concepto que verá quien paga (máx. 40 caracteres)");
const refSchema = z.string().max(80).optional().describe("Tu referencia interna: número de pedido, factura, cliente…");

export function buildServer() {
  const server = new McpServer({ name: "pey-codi", version: "1.0.0" }, {
    instructions:
      "Herramientas para cobrar en México con CoDi (Banco de México) vía pey. Flujo típico: crea el cobro (cobrar_con_qr si la persona está presente, cobrar_a_celular si conoces su celular, crear_link_de_pago para mandarlo por chat/correo) y luego llama esperar_pago con el cobro_id para enterarte cuando se pague. Los pagos son instantáneos y sin comisión. Nunca inventes montos: confírmalos con el usuario.",
  });

  server.registerTool("cobrar_con_qr", {
    title: "Cobrar con QR CoDi",
    description: "Crea un cobro CoDi con QR para que la persona lo escanee con la app de su banco. Regresa el QR como imagen y una página web para mostrarlo en pantalla.",
    inputSchema: { monto: amountSchema, concepto: conceptSchema, referencia: refSchema },
  }, async ({ monto, concepto, referencia }) => {
    try {
      const c = await payments.createCharge({ kind: "qr", amount: monto, concept: concepto, reference: referencia, source: "mcp" });
      const png = await QRCode.toDataURL(c.qrString, { margin: 1, width: 360 });
      return ok(`Cobro QR por ${money(c.amount)} creado. Muestra el QR o abre ${payments.toPublic(c).payPage}. Después llama esperar_pago con cobro_id=${c.id}.`, summary(c),
        [{ type: "image", data: png.split(",")[1], mimeType: "image/png" }]);
    } catch (e) { return fail(e); }
  });

  server.registerTool("cobrar_a_celular", {
    title: "Mandar cobro CoDi al celular",
    description: "Envía una solicitud de cobro CoDi directo a la app bancaria ligada al celular (10 dígitos). La persona solo acepta en su banco.",
    inputSchema: { monto: amountSchema, celular: z.string().describe("Celular de 10 dígitos registrado en CoDi"), concepto: conceptSchema, referencia: refSchema },
  }, async ({ monto, celular, concepto, referencia }) => {
    try {
      const c = await payments.createCharge({ kind: "push", amount: monto, phone: celular, concept: concepto, reference: referencia, source: "mcp" });
      return ok(`Solicitud de ${money(c.amount)} enviada al celular terminación ${c.phone.slice(-4)}. Llama esperar_pago con cobro_id=${c.id}.`, summary(c));
    } catch (e) { return fail(e); }
  });

  server.registerTool("crear_link_de_pago", {
    title: "Crear link de pago",
    description: "Crea un link de pago (checkout de pey con CoDi y otros métodos) para mandarlo por WhatsApp, correo o chat.",
    inputSchema: { monto: amountSchema, concepto: conceptSchema, referencia: refSchema },
  }, async ({ monto, concepto, referencia }) => {
    try {
      const c = await payments.createCharge({ kind: "link", amount: monto, concept: concepto, reference: referencia, source: "mcp" });
      return ok(`Link de pago por ${money(c.amount)}: ${c.url}`, summary(c));
    } catch (e) { return fail(e); }
  });

  server.registerTool("esperar_pago", {
    title: "Esperar a que paguen",
    description: "Se queda esperando hasta que el cobro se pague o pase el tiempo límite. Úsalo justo después de crear un cobro. Si regresa 'pending', puedes volver a llamarlo.",
    inputSchema: { cobro_id: z.string(), segundos: z.number().int().min(1).max(280).optional().describe("Tiempo máximo de espera (default 50)") },
    annotations: { readOnlyHint: true },
  }, async ({ cobro_id, segundos }) => {
    try {
      const c = await payments.waitForPayment(cobro_id, (segundos || 50) * 1000);
      return ok(c.status === "paid" ? `✅ ¡Pagado! ${money(c.amount)} recibidos.` : `Aún no se paga (estado: ${c.status}). Puedes volver a esperar.`, summary(c));
    } catch (e) { return fail(e); }
  });

  server.registerTool("estado_del_cobro", {
    title: "Consultar un cobro",
    description: "Regresa el estado actual de un cobro: pending, paid o superseded.",
    inputSchema: { cobro_id: z.string() },
    annotations: { readOnlyHint: true },
  }, async ({ cobro_id }) => {
    const c = payments.getCharge(cobro_id);
    return c ? ok(`Estado: ${c.status}`, summary(c)) : fail(new payments.ChargeError("No existe ese cobro", 404));
  });

  server.registerTool("pagos_recibidos", {
    title: "Pagos recibidos",
    description: "Lista los cobros pagados recientemente (de cualquier canal: agentes o Libreta). Útil para conciliar.",
    inputSchema: { ultimos_minutos: z.number().int().min(1).max(10080).optional().describe("Ventana de tiempo, default 1440 (24 h)"), limite: z.number().int().min(1).max(100).optional() },
    annotations: { readOnlyHint: true },
  }, async ({ ultimos_minutos, limite }) => {
    const list = payments.listCharges({ status: "paid", sinceMs: Date.now() - (ultimos_minutos || 1440) * 60_000, limit: limite || 20 }).map(summary);
    const total = list.reduce((s, c) => s + c.monto, 0);
    return ok(`${list.length} pagos, total ${money(total)}`, { total, pagos: list });
  });

  return server;
}

/** Monta POST/GET/DELETE /mcp en la app de Express (modo stateless). */
export function mountMcp(app) {
  app.all("/mcp", async (req, res) => {
    if (MCP_TOKEN && req.headers.authorization !== `Bearer ${MCP_TOKEN}`) return res.status(401).json({ error: "Falta Authorization: Bearer <PEY_MCP_TOKEN>" });
    if (req.method !== "POST") return res.status(405).set("Allow", "POST").json({ jsonrpc: "2.0", error: { code: -32000, message: "Usa POST (modo stateless)" }, id: null });
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      console.error("[mcp]", e);
      if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Error interno" }, id: null });
    }
  });
}
