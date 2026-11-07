// Cliente mínimo de la API de pey (https://docs.pey.mx). Sin API key => modo demo simulado.
import crypto from "node:crypto";

const BASE = process.env.PEY_BASE_URL || "https://api.pey.mx";
const KEY = process.env.PEY_API_KEY || "";
const BANK_ACCOUNT_ID = process.env.PEY_BANK_ACCOUNT_ID || undefined;

export const peyLive = () => Boolean(KEY);

class PeyError extends Error {
  constructor(status, body) {
    super(body?.message || `pey respondió ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function call(method, path, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
    if (!res.ok) throw new PeyError(res.status, data);
    return data;
  } finally {
    clearTimeout(t);
  }
}

const fakeId = (n = 10) => crypto.randomBytes(n).toString("hex").slice(0, n);
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));
// pey: concept corto; Banxico recorta conceptos largos.
const concept = (s) => String(s || "Pago").replace(/[^\p{L}\p{N} .,#\-]/gu, "").slice(0, 40);

/** POST /codi/qr -> { id, qrString, qrImage? } */
export async function createQr({ amount, concept: c, numRef, expiration = 3600, metadata }) {
  const body = clean({ amount, concept: concept(c), numRef, expiration, bankAccountId: BANK_ACCOUNT_ID, metadata });
  if (!peyLive()) {
    const id = fakeId();
    return { id, qrString: JSON.stringify({ TYP: 19, v: { DEV: "DEMO" }, ic: { IDC: id, SER: numRef, AMT: amount, CON: body.concept } }), demo: true };
  }
  return call("POST", "/codi/qr", body);
}

/** POST /codi/pn -> { transactionId, codiId } */
export async function createPush({ amount, phoneNumber, concept: c, numRef, expiration = 3600, metadata }) {
  const body = clean({ amount, phoneNumber, concept: concept(c), numRef, expiration: Math.max(360, expiration), bankAccountId: BANK_ACCOUNT_ID, metadata });
  if (!peyLive()) return { transactionId: "demo_" + fakeId(12), codiId: fakeId(), demo: true };
  return call("POST", "/codi/pn", body);
}

/** POST /payment-link/create -> { id, url } (successUrl/backUrl deben ser HTTPS) */
export async function createPaymentLink({ amount, successUrl, backUrl, clientReferenceId, metadata }) {
  const body = clean({ amount, successUrl, backUrl, clientReferenceId, metadata, hasTip: false });
  if (!peyLive()) {
    const id = "demo_" + fakeId(12);
    return { id, url: `${process.env.PUBLIC_URL || "http://localhost:" + (process.env.PORT || 3000)}/demo-checkout/${id}`, demo: true };
  }
  return call("POST", "/payment-link/create", body);
}

/** GET /transaction/api-key — para conciliar si el webhook no llega. Forma tolerante. */
export async function listTransactions(nextToken) {
  if (!peyLive()) return { items: [] };
  const data = await call("GET", "/transaction/api-key" + (nextToken ? `?nextToken=${encodeURIComponent(nextToken)}` : ""));
  const items = Array.isArray(data) ? data : data.items || data.transactions || data.data || [];
  return { items, nextToken: data.nextToken };
}

export { PeyError };
