// Capa de IA (OpenAI). Si no hay key o la llamada falla, cae a un parser local para que el demo nunca se caiga.
import OpenAI from "openai";
import { localParseCommand, localReminder, demoNotebook } from "./fallback.js";

const KEY = process.env.OPENAI_API_KEY || "";
const client = KEY ? new OpenAI({ apiKey: KEY, timeout: 45_000, maxRetries: 1 }) : null;
export const aiLive = () => Boolean(client);

// Elegimos el mejor modelo disponible para tu key al arrancar (los nombres cambian seguido).
const PREFERENCE = [
  process.env.OPENAI_MODEL,
  "gpt-5.6-terra",
  "gpt-5.6-sol",
  "gpt-6-luna",
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.1",
  "gpt-5",
  "gpt-5-mini",
  "gpt-4.1",
  "gpt-4o",
].filter(Boolean);
let MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

export async function pickModel() {
  if (!client) return null;
  try {
    const ids = new Set();
    for await (const m of client.models.list()) ids.add(m.id);
    MODEL = PREFERENCE.find((p) => ids.has(p)) || MODEL;
  } catch (e) {
    console.warn("[ai] no pude listar modelos:", e.message);
  }
  console.log(`[ai] usando modelo ${MODEL}`);
  return MODEL;
}
export const currentModel = () => (client ? MODEL : null);

async function structured({ system, user, schemaName, schema }) {
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } },
  });
  const msg = res.choices?.[0]?.message;
  if (msg?.refusal) throw new Error("refusal: " + msg.refusal);
  return JSON.parse(msg.content);
}

// ---------- Comandos en lenguaje natural ----------
const ACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["add_debt", "cash_payment", "charge", "set_phone", "sale"] },
          customer: { type: ["string", "null"], description: "Nombre del cliente tal como lo conoce la tienda. null solo para 'sale'." },
          amount: { type: ["number", "null"], description: "Monto en pesos MXN. null si no se dijo (ej. cobrar todo el saldo)." },
          items: { type: "string", description: "Qué se llevó, breve. Vacío si no aplica." },
          phone: { type: ["string", "null"], description: "Celular de 10 dígitos si se mencionó." },
          method: { type: ["string", "null"], description: "Solo para 'charge': 'qr' si está en la tienda, 'push' si se manda a su celular, 'link' si es por WhatsApp. null en otro caso." },
        },
        required: ["type", "customer", "amount", "items", "phone", "method"],
      },
    },
    reply: { type: "string", description: "Confirmación corta y cálida para el tendero, en español de México." },
  },
  required: ["actions", "reply"],
};

export async function parseCommand(text, knownCustomers = []) {
  if (!client) return { ...localParseCommand(text), ai: false };
  try {
    const out = await structured({
      schemaName: "libreta_actions",
      schema: ACTION_SCHEMA,
      system: `Eres el asistente de la libreta del fiado de una tiendita de barrio en México. Conviertes lo que dice el tendero en acciones.
- "add_debt": alguien se llevó algo fiado ("apúntale", "se llevó", "fíale"). Si dan precios por producto, suma el total.
- "cash_payment": alguien pagó/abonó en efectivo.
- "charge": cobrar con CoDi ("cóbrale", "mándale el cobro", "que me pague"). amount null = todo su saldo. method: push si mencionan "a su cel/celular/teléfono", link si mencionan WhatsApp, si no qr.
- "set_phone": guardar el celular de un cliente.
- "sale": venta de mostrador para cobrar con QR ahora mismo (sin cliente), ej. "cóbrame 45 de unas tortillas".
Clientes existentes: ${knownCustomers.join(", ") || "(ninguno)"}. Si el nombre se parece a uno existente usa exactamente ese nombre.
Montos con decimales si aplica. No inventes montos que no se dijeron.`,
      user: text,
    });
    return { ...out, ai: true };
  } catch (e) {
    console.warn("[ai] parseCommand falló, uso parser local:", e.message);
    return { ...localParseCommand(text), ai: false, aiError: e.message };
  }
}

// ---------- Foto de la libreta de papel ----------
const NOTEBOOK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    entries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          customer: { type: "string" },
          amount: { type: "number", description: "Total pendiente de esa persona en esa línea, MXN" },
          items: { type: "string" },
          phone: { type: ["string", "null"] },
          confidence: { type: "string", enum: ["alta", "media", "baja"] },
        },
        required: ["customer", "amount", "items", "phone", "confidence"],
      },
    },
    notes: { type: "string", description: "Observaciones breves: líneas tachadas que se ignoraron, montos dudosos, etc." },
  },
  required: ["entries", "notes"],
};

export async function parseNotebookPhoto(dataUrl, knownCustomers = []) {
  if (!client) return { ...demoNotebook(), ai: false };
  try {
    const out = await structured({
      schemaName: "libreta_foto",
      schema: NOTEBOOK_SCHEMA,
      system: `Lees fotos de libretas de fiado escritas a mano en tienditas mexicanas. Extrae cada deuda PENDIENTE.
- Ignora líneas tachadas, palomeadas o marcadas como "pagado"/"pagó".
- Si una persona tiene varias líneas pendientes, devuelve una entrada por persona con el total y los productos resumidos.
- Interpreta abreviaturas comunes (refres, cocas, tort, kg, pzas). Montos en pesos.
- Si un monto no se lee bien, ponlo con confidence "baja".
Clientes ya registrados: ${knownCustomers.join(", ") || "(ninguno)"}. Usa ese nombre exacto si coincide.`,
      user: [
        { type: "text", text: "Extrae las deudas pendientes de esta libreta." },
        { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
      ],
    });
    return { ...out, ai: true };
  } catch (e) {
    console.warn("[ai] foto falló:", e.message);
    return { entries: [], notes: "No pude leer la foto con IA: " + e.message, ai: false, aiError: e.message };
  }
}

// ---------- Recordatorio amable ----------
export async function writeReminder({ store, owner, customer, balance, items, payUrl, pushSent }) {
  if (!client) return localReminder({ store, owner, customer, balance, payUrl, pushSent });
  try {
    const out = await structured({
      schemaName: "recordatorio",
      schema: { type: "object", additionalProperties: false, properties: { message: { type: "string" } }, required: ["message"] },
      system: `Escribes recordatorios de pago por WhatsApp de parte de un tendero de barrio en México a su cliente.
Tono: cálido, respetuoso, de confianza, nada de amenazas ni presión. Máximo 4 líneas. Usa "usted" salvo que el nombre sugiera confianza juvenil.
Incluye el monto exacto con formato $X.XX. ${payUrl ? "Incluye el link de pago tal cual en su propia línea." : ""}${pushSent ? " Menciona que le llegó una solicitud de cobro CoDi a la app de su banco para pagar con un toque." : ""}
Firma con el nombre del tendero. Un emoji como máximo.`,
      user: JSON.stringify({ tienda: store, tendero: owner, cliente: customer, saldo: balance, productos_recientes: items, link: payUrl || null }),
    });
    let msg = out.message;
    if (payUrl && !msg.includes(payUrl)) msg += `\n${payUrl}`;
    return msg;
  } catch (e) {
    console.warn("[ai] recordatorio falló:", e.message);
    return localReminder({ store, owner, customer, balance, payUrl, pushSent });
  }
}
