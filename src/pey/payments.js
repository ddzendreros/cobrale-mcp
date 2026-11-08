// Núcleo de cobros CoDi. Lo usan Libreta (src/libreta) y el servidor MCP (src/mcp).
// CONTRATO (ver AGENTS.md): createCharge, getCharge, listCharges, waitForPayment,
// handleWebhook, simulatePayment, reconcile, events('paid' | 'charge' | 'orphan').
import { EventEmitter } from "node:events";
import QRCode from "qrcode";
import { Webhook } from "standardwebhooks";
import * as store from "../store.js";
import * as pey from "./client.js";

export const events = new EventEmitter();
events.setMaxListeners(100);

const PORT = Number(process.env.PORT || 3000);
export const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
export const TEST_AMOUNT = process.env.PEY_TEST_AMOUNT ? Number(process.env.PEY_TEST_AMOUNT) : null;
export const CAN_SIMULATE = !pey.peyLive() || process.env.ALLOW_SIMULATE === "1";
const WEBHOOK_SECRET = process.env.PEY_WEBHOOK_SECRET || "";
export const baseUrl = () => PUBLIC_URL || `http://localhost:${PORT}`;
export const linksEnabled = () => !pey.peyLive() || PUBLIC_URL.startsWith("https://");

export function mode() {
  return { pey: pey.peyLive() ? "live" : "demo", publicUrl: PUBLIC_URL || null, linksEnabled: linksEnabled(), webhookVerified: Boolean(WEBHOOK_SECRET), testAmount: TEST_AMOUNT, canSimulate: CAN_SIMULATE };
}

export class ChargeError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; this.expose = true; }
}

/** Vista pública de un cobro (lo que regresan la API y el MCP). */
export const toPublic = (c) => c && ({
  id: c.id, kind: c.kind, status: c.status, amount: c.amount, chargedAmount: c.chargedAmount, concept: c.concept,
  reference: c.reference || null, source: c.source, customerId: c.customerId || null, customerName: c.customerName || null,
  phone: c.phone || null, url: c.url || null, qrSvg: c.qrSvg || null, payPage: `${baseUrl()}/cobro/${c.id}`,
  createdAt: c.createdAt, paidAt: c.paidAt || null, demo: Boolean(c.demo),
});

/**
 * Crea un cobro CoDi.
 * @param {{kind:'qr'|'push'|'link', amount:number, concept?:string, phone?:string, reference?:string,
 *          source?:'libreta'|'mcp'|'api', customerId?:string, customerName?:string}} o
 */
export async function createCharge(o) {
  const kind = o.kind || "qr";
  const amount = store.round2(o.amount);
  if (!amount || amount <= 0) throw new ChargeError("El monto debe ser mayor a 0");
  if (amount > 1_000_000) throw new ChargeError("Monto demasiado alto");
  const d = store.getDb();
  d.counter = d.counter + 1 >= 10_000_000 ? 1000 : d.counter + 1;
  const numRef = String(d.counter);
  const chargeId = store.id("cob");
  const chargedAmount = TEST_AMOUNT ?? amount;
  const concept = o.concept || (o.customerName ? `Cuenta ${o.customerName}` : "Pago");
  const metadata = { chargeId, source: o.source || "api", ...(o.reference ? { reference: String(o.reference).slice(0, 80) } : {}), ...(o.customerId ? { customerId: o.customerId } : {}) };
  const c = {
    id: chargeId, kind, amount, chargedAmount, concept, reference: o.reference || null, source: o.source || "api",
    customerId: o.customerId || null, customerName: o.customerName || null, status: "pending", numRef, createdAt: Date.now(),
  };

  if (kind === "qr") {
    const r = await pey.createQr({ amount: chargedAmount, concept, numRef, metadata, expiration: 3600 });
    Object.assign(c, { peyId: r.id, qrString: r.qrString, demo: Boolean(r.demo) });
    c.qrSvg = await QRCode.toString(r.qrString, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#14213d", light: "#ffffff" } });
  } else if (kind === "push") {
    const phone = String(o.phone || "").replace(/\D/g, "").slice(-10);
    if (phone.length !== 10) throw new ChargeError("Se necesita un celular de 10 dígitos ligado a CoDi");
    const r = await pey.createPush({ amount: chargedAmount, phoneNumber: phone, concept, numRef, metadata, expiration: 3600 });
    Object.assign(c, { peyTx: r.transactionId, peyId: r.codiId, phone, demo: Boolean(r.demo) });
  } else if (kind === "link") {
    if (!linksEnabled()) throw new ChargeError("Para links de pago configura PUBLIC_URL con https (túnel o deploy)");
    const r = await pey.createPaymentLink({ amount: chargedAmount, successUrl: `${baseUrl()}/pagado?c=${chargeId}`, backUrl: `${baseUrl()}/`, clientReferenceId: chargeId, metadata });
    Object.assign(c, { peyId: r.id, url: r.url, demo: Boolean(r.demo) });
  } else throw new ChargeError("Tipo de cobro inválido: usa qr, push o link");

  if (process.env.PEY_DEBUG === "1") {
    console.log("[cobro]", c.id, kind, chargedAmount, "peyId=", c.peyId, "peyTx=", c.peyTx, "numRef=", numRef);
  }
  d.charges.push(c);
  store.save();
  events.emit("charge", c);
  return c;
}

export const getCharge = (id) => store.getDb().charges.find((c) => c.id === id) || null;

export function listCharges({ status, sinceMs, source, limit = 50 } = {}) {
  return store.getDb().charges
    .filter((c) => (!status || c.status === status) && (!sinceMs || (c.paidAt || c.createdAt) >= sinceMs) && (!source || c.source === source))
    .sort((a, b) => (b.paidAt || b.createdAt) - (a.paidAt || a.createdAt))
    .slice(0, limit);
}

/** Espera a que un cobro se pague (por webhook, conciliación o simulación). Resuelve con el cobro. */
export function waitForPayment(chargeId, timeoutMs = 55_000) {
  const c = getCharge(chargeId);
  if (!c) return Promise.reject(new ChargeError("No existe ese cobro", 404));
  if (c.status === "paid" || c.status === "superseded") return Promise.resolve(c);
  return new Promise((resolve) => {
    const onPaid = (paid) => { if (paid.id === chargeId) done(paid); };
    const onSuperseded = (superseded) => { if (superseded.id === chargeId) done(superseded); };
    const t = setTimeout(() => done(getCharge(chargeId)), timeoutMs);
    function done(x) { clearTimeout(t); events.off("paid", onPaid); events.off("superseded", onSuperseded); resolve(x); }
    events.on("paid", onPaid);
    events.on("superseded", onSuperseded);
  });
}

/** Marca un cobro como sustituido (p. ej. Libreta lo hace si el cliente pagó por otro medio). */
export function supersede(chargeId) {
  const c = getCharge(chargeId);
  if (c && c.status === "pending") {
    c.status = "superseded";
    store.save();
    events.emit("superseded", c);
  }
}

// ---------------- Webhooks ----------------
/** Verifica firma (si hay secreto) y procesa. Regresa {status, body}. */
export function handleWebhook(raw, headers) {
  if (WEBHOOK_SECRET) {
    try { new Webhook(WEBHOOK_SECRET).verify(raw, headers); }
    catch (e) { console.warn("[webhook] firma inválida:", e.message); return { status: 401, body: { message: "firma inválida" } }; }
  }
  if (process.env.PEY_DEBUG === "1") {
    const id = headers?.["webhook-id"] || null;
    const body = String(raw).slice(0, 4000);
    console.log("[webhook:raw]", id, body);
    const d = store.getDb();
    d.webhookLog ||= [];
    d.webhookLog.push({ at: Date.now(), id, body });
    d.webhookLog = d.webhookLog.slice(-30);
    store.save();
  }
  let evt;
  try { evt = JSON.parse(raw); } catch { return { status: 400, body: { message: "JSON inválido" } }; }
  const result = processEvent(evt, headers["webhook-id"]);
  console.log(`[webhook] ${evt.type} $${evt.amount ?? ""} -> ${result}`);
  return { status: 200, body: { ok: true, result } };
}

function paidAtMilliseconds(datePaid) {
  if (datePaid === undefined || datePaid === null || datePaid === "") return null;
  const numeric = Number(datePaid);
  if (Number.isFinite(numeric)) return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  const parsed = Date.parse(datePaid);
  return Number.isFinite(parsed) ? parsed : null;
}

function findChargeFor(evt, allowAmountOnly = true) {
  const paidAtMs = paidAtMilliseconds(evt.datePaid);
  const ext = { ...(evt.metadata || {}), ...(evt.metadata?.externalMetadata || {}) };
  const transactionMetadata = evt.transactions?.[0]?.metadata;
  const transactionExt = { ...(transactionMetadata || {}), ...(transactionMetadata?.externalMetadata || {}) };
  const by = (fn) => store.getDb().charges.find((c) => c.status !== "paid" && (!paidAtMs || paidAtMs >= c.createdAt - 120_000) && fn(c));
  return (
    (ext.chargeId && by((c) => c.id === ext.chargeId)) ||
    (transactionExt.chargeId && by((c) => c.id === transactionExt.chargeId)) ||
    (evt.clientReferenceId && by((c) => c.id === evt.clientReferenceId)) ||
    (evt.paymentLinkId && by((c) => c.peyId === evt.paymentLinkId)) ||
    (evt.codiQrId && by((c) => c.peyId === evt.codiQrId)) ||
    (evt.payableId && by((c) => c.peyId === evt.payableId || c.peyTx === evt.payableId)) ||
    (evt.transactionId && by((c) => c.peyTx === evt.transactionId)) ||
    (evt.numRef && by((c) => c.numRef === String(evt.numRef) && Math.abs(c.chargedAmount - Number(evt.amount)) < 0.005)) ||
    (allowAmountOnly ? uniquePendingByAmount(Number(evt.amount), paidAtMs) : null)
  );
}

function uniquePendingByAmount(amount, paidAtMs) {
  if (!amount) return null;
  const cands = store.getDb().charges.filter((c) => c.status === "pending" && c.createdAt > Date.now() - 3 * 3600_000 && (!paidAtMs || paidAtMs >= c.createdAt - 120_000) && Math.abs(c.chargedAmount - amount) < 0.005);
  return cands.length === 1 ? cands[0] : null;
}

function alreadyPaidFor(evt) {
  const transactionId = evt.transactionId || evt.transactions?.[0]?.transactionId;
  return store.getDb().charges.find((c) => c.status === "paid" && (
    (transactionId && (c.transactionId === transactionId || c.peyTx === transactionId)) ||
    (evt.type === "codi.qr.payment_received" && evt.codiQrId && c.peyId === evt.codiQrId) ||
    (evt.type === "payment_link.status_updated" && evt.paymentLinkId && c.peyId === evt.paymentLinkId)
  )) || null;
}

function processEvent(evt, dedupeId, { allowAmountOnly = true } = {}) {
  const d = store.getDb();
  const key = dedupeId || evt.transactionId || (evt.paymentLinkId && evt.paymentLinkId + evt.status);
  if (key && d.seenWebhooks.includes(key)) return "duplicado";

  if (evt.type === "payment_link.status_updated" && evt.status !== "paid") {
    if (key) { d.seenWebhooks.push(key); d.seenWebhooks = d.seenWebhooks.slice(-500); }
    return "estado " + evt.status;
  }
  if (!/payment_received|status_updated/.test(evt.type || "")) {
    if (key) { d.seenWebhooks.push(key); d.seenWebhooks = d.seenWebhooks.slice(-500); }
    return "ignorado";
  }

  const prior = alreadyPaidFor(evt);
  if (prior) return "ya pagado " + prior.id;

  if (key) { d.seenWebhooks.push(key); d.seenWebhooks = d.seenWebhooks.slice(-500); }

  const amount = evt.amount ?? evt.transactions?.reduce((s, t) => s + (t.amountBreakdown?.base ?? t.amount ?? 0), 0);
  const c = findChargeFor({ ...evt, amount }, allowAmountOnly);
  if (!c) {
    const o = { at: Date.now(), amount: store.round2(amount || 0), concept: evt.concept, type: evt.type, transactionId: evt.transactionId };
    d.orphanPayments.push(o);
    store.save();
    events.emit("orphan", o);
    return "sin asignar";
  }
  Object.assign(c, { status: "paid", paidAt: Date.now(), paidVia: evt.type, transactionId: evt.transactionId || evt.transactions?.[0]?.transactionId, paidAmount: amount });
  store.save();
  events.emit("paid", c);
  return "pagado " + c.id;
}

/** Solo en modo demo (o ALLOW_SIMULATE=1): genera un webhook falso para el cobro. */
export function simulatePayment(chargeId) {
  if (!CAN_SIMULATE) throw new ChargeError("Simulación desactivada en modo en vivo", 403);
  const c = getCharge(chargeId);
  if (!c) throw new ChargeError("No existe ese cobro", 404);
  const now = Math.floor(Date.now() / 1000);
  const evt = c.kind === "link"
    ? { type: "payment_link.status_updated", paymentLinkId: c.peyId, status: "paid", clientReferenceId: c.id, transactions: [{ transactionId: "sim_" + now, datePaid: now, amount: c.chargedAmount, amountBreakdown: { base: c.chargedAmount } }] }
    : { type: c.kind === "push" ? "codi.pn.payment_received" : "codi.qr.payment_received", amount: c.chargedAmount, codiQrId: c.peyId, concept: c.concept, datePaid: now, numRef: c.numRef, transactionId: "sim_" + c.id, metadata: { externalMetadata: { chargeId: c.id } } };
  return processEvent(evt, "sim_" + c.id);
}

// ---------------- Conciliación (por si el webhook no llega) ----------------
let reconciling = false;

/** Convierte una transacción de GET /transaction/api-key a la forma del webhook. */
export function txToEvent(tx) {
  const payableType = tx.payableType;
  const payableId = tx.payableId;
  const type = payableType === "PAYMENT_LINK"
    ? "payment_link.status_updated"
    : payableType === "API_CODI_PN"
      ? "codi.pn.payment_received"
      : "codi.qr.payment_received";
  return {
    type,
    status: tx.status === "PAID" || tx.datePaid ? "paid" : "pending",
    amount: tx.amountBreakdown?.base ?? tx.amount,
    transactionId: tx.transactionId || tx.id,
    datePaid: tx.datePaid,
    metadata: tx.metadata,
    concept: tx.description,
    payableId,
    ...(payableType === "PAYMENT_LINK" ? { paymentLinkId: payableId } : {}),
    ...(payableType !== "PAYMENT_LINK" && payableType !== "API_CODI_PN" ? { codiQrId: payableId } : {}),
  };
}

export async function reconcile() {
  if (!pey.peyLive() || reconciling) return 0;
  reconciling = true;
  let n = 0;
  let arrived = 0;
  let paid = 0;
  let matched = 0;
  try {
    let nextToken;
    const seenTokens = new Set();
    // Corre cada 12 s: solo revisa las páginas recientes (máx. 3) y para al pasar de los cobros pendientes más viejos.
    const pendings = store.getDb().charges.filter((c) => c.status === "pending").map((c) => c.createdAt);
    const oldestMs = (pendings.length ? Math.min(...pendings) : Date.now()) - 3600_000;
    for (let pageNo = 0; pageNo < 3; pageNo++) {
      const page = await pey.listTransactions(nextToken);
      const items = Array.isArray(page?.items) ? page.items : [];
      arrived += items.length;
      for (const tx of items) {
        if (tx.status !== "PAID") continue;
        paid++;
        const evt = txToEvent(tx);
        const found = findChargeFor(evt, false);
        if (!found && !alreadyPaidFor(evt)) continue;
        matched++;
        if (processEvent(evt, "tx_" + tx.id, { allowAmountOnly: false }).startsWith("pagado")) n++;
      }
      const token = page?.nextToken || null;
      const lastCreatedMs = paidAtMilliseconds(items.at(-1)?.dateCreated);
      if (!token || seenTokens.has(token) || (lastCreatedMs && lastCreatedMs < oldestMs)) break;
      seenTokens.add(token);
      nextToken = token;
    }
  } catch (e) { console.warn("[reconcile]", e.message); } finally { reconciling = false; }
  if (process.env.PEY_DEBUG === "1") console.log(`[reconcile] items=${arrived} PAID=${paid} casaron=${matched}`);
  return n;
}
setInterval(() => {
  if (store.getDb().charges.some((c) => c.status === "pending" && Date.now() - c.createdAt < 2 * 3600_000)) reconcile();
}, 12_000).unref();

export { pey };
