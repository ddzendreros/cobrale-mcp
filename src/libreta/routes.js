// Libreta: API HTTP + tiempo real (SSE). Usa el núcleo de cobros de src/pey/payments.js.
import express from "express";
import * as store from "../store.js";
import * as ledger from "./ledger.js";
import * as ai from "./ai.js";
import * as payments from "../pey/payments.js";

export const router = express.Router();
const ADMIN = process.env.ADMIN_TOKEN || "";

router.use("/api", (req, res, next) => {
  if (!ADMIN || req.method === "GET" || req.get("x-admin-token") === ADMIN) return next();
  res.status(401).json({ message: "Modo solo lectura: falta el token de admin" });
});

// ---------------- Tiempo real ----------------
const clients = new Set();
const publicState = () => ({
  ...ledger.snapshot(),
  mode: {
    ...payments.mode(),
    locked: Boolean(ADMIN),
    ai: ai.currentModel(),
    mcp: { url: `${payments.baseUrl()}/mcp`, auth: Boolean(process.env.PEY_MCP_TOKEN) },
  },
});
function broadcast(type, payload = {}) {
  const data = JSON.stringify({ type, ...payload, state: publicState() });
  for (const res of clients) res.write(`data: ${data}\n\n`);
}
setInterval(() => { for (const res of clients) res.write(": ping\n\n"); }, 20_000).unref();

// Cuando se paga CUALQUIER cobro (Libreta o MCP): si es de un cliente, se descuenta de su cuenta.
payments.events.on("paid", (c) => {
  if (c.customerId) {
    const bal = ledger.balanceOf(c.customerId);
    ledger.addEntry({ customerId: c.customerId, kind: "payment", amount: Math.min(c.amount, bal) || c.amount, method: "codi", items: `CoDi (${c.kind})`, ref: c.id });
    for (const o of store.getDb().charges) if (o.customerId === c.customerId && o.status === "pending" && o.id !== c.id) payments.supersede(o.id);
  }
  broadcast("paid", { charge: payments.toPublic(c) });
});
payments.events.on("charge", (c) => broadcast("charge_created", { charge: payments.toPublic(c) }));
payments.events.on("superseded", (c) => broadcast("charge_updated", { charge: payments.toPublic(c) }));
payments.events.on("orphan", (o) => broadcast("orphan_payment", { amount: o.amount }));

// ---------------- Helpers ----------------
const fmt = (n) => Number(n).toFixed(2);
const labelKind = (k) => ({ qr: "con QR", push: "a su celular", link: "por link" }[k] || k);
function httpErr(status, message) { const e = new Error(message); e.status = status; e.expose = true; return e; }
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  const status = e.status || (e instanceof payments.pey.PeyError ? 502 : 500);
  console.error("[libreta]", status, e.message, e.body || "");
  res.status(status).json({ message: e.expose ? e.message : e instanceof payments.pey.PeyError ? `pey: ${e.message}` : e.message });
});

async function chargeCustomer(c, kind = "qr", amount = null) {
  const amt = amount && amount > 0 ? amount : ledger.balanceOf(c.id);
  if (!amt || amt <= 0) throw httpErr(400, `${c.name} no debe nada 🎉`);
  return payments.createCharge({ kind, amount: amt, phone: c.phone, source: "libreta", customerId: c.id, customerName: c.name, concept: `Cuenta ${c.name}` });
}

async function runActions(actions) {
  const results = [];
  let openCharge = null;
  for (const a of actions) {
    try {
      if (a.type === "add_debt") {
        if (!a.customer || !a.amount) throw httpErr(400, "Faltó el nombre o el monto");
        const c = ledger.upsertCustomer(a.customer, a.phone);
        ledger.addEntry({ customerId: c.id, kind: "debt", amount: a.amount, items: a.items || "" });
        results.push({ ok: true, text: `+$${fmt(a.amount)} a ${c.name}${a.items ? ` (${a.items})` : ""}` });
      } else if (a.type === "cash_payment") {
        const c = ledger.findCustomer(a.customer);
        if (!c) throw httpErr(404, `No encontré a ${a.customer}`);
        const amt = a.amount || ledger.balanceOf(c.id);
        ledger.addEntry({ customerId: c.id, kind: "payment", amount: amt, method: "efectivo", items: "Efectivo" });
        results.push({ ok: true, text: `${c.name} abonó $${fmt(amt)} en efectivo` });
      } else if (a.type === "set_phone") {
        const c = ledger.findCustomer(a.customer) || ledger.upsertCustomer(a.customer);
        const ph = String(a.phone || "").replace(/\D/g, "").slice(-10);
        if (ph.length !== 10) throw httpErr(400, "El celular debe tener 10 dígitos");
        c.phone = ph; store.save();
        results.push({ ok: true, text: `Cel de ${c.name}: ${ph}` });
      } else if (a.type === "charge") {
        const c = ledger.findCustomer(a.customer);
        if (!c) throw httpErr(404, `No encontré a ${a.customer}`);
        if (a.phone) { const ph = a.phone.replace(/\D/g, "").slice(-10); if (ph.length === 10) { c.phone = ph; store.save(); } }
        let kind = ["qr", "push", "link"].includes(a.method) ? a.method : "qr";
        if (kind === "link" && !payments.linksEnabled()) kind = c.phone ? "push" : "qr";
        if (kind === "push" && !c.phone) kind = "qr";
        const ch = await chargeCustomer(c, kind, a.amount);
        openCharge ||= ch;
        results.push({ ok: true, text: `Cobro ${labelKind(kind)} a ${c.name} por $${fmt(ch.amount)}` });
      } else if (a.type === "sale") {
        const ch = await payments.createCharge({ kind: "qr", amount: a.amount, source: "libreta", concept: a.items ? `Mostrador ${a.items}` : "Venta mostrador" });
        openCharge ||= ch;
        results.push({ ok: true, text: `QR de mostrador por $${fmt(ch.amount)}` });
      }
    } catch (e) {
      results.push({ ok: false, text: e.expose ? e.message : `Error: ${e.message}` });
    }
  }
  broadcast("ledger");
  return { results, charge: payments.toPublic(openCharge) };
}

const findById = (id) => store.getDb().customers.find((x) => x.id === id) || (() => { throw httpErr(404, "Cliente no encontrado"); })();

// ---------------- Rutas ----------------
router.get("/api/state", (req, res) => res.json(publicState()));

router.get("/api/events", (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: "hello", state: publicState() })}\n\n`);
  clients.add(res);
  req.on("close", () => clients.delete(res));
});

router.get("/api/charges", (req, res) => {
  const source = typeof req.query.source === "string" && req.query.source ? req.query.source : undefined;
  const status = typeof req.query.status === "string" && req.query.status ? req.query.status : undefined;
  const requestedLimit = req.query.limit;
  const parsedLimit = Number(requestedLimit);
  const limit = requestedLimit === undefined || requestedLimit === "" || !Number.isFinite(parsedLimit)
    ? 30
    : Math.max(1, Math.min(100, Math.floor(parsedLimit)));
  const charges = payments.listCharges({ source, status, limit }).map((c) => {
    const { qrSvg, ...charge } = payments.toPublic(c);
    return charge;
  });
  res.json({ charges });
});

router.post("/api/command", wrap(async (req, res) => {
  const text = String(req.body?.text || "").slice(0, 1000);
  if (!text.trim()) throw httpErr(400, "Dime algo 🙂");
  const parsed = await ai.parseCommand(text, store.getDb().customers.map((c) => c.name));
  res.json({ reply: parsed.reply, ai: parsed.ai, ...(await runActions(parsed.actions || [])) });
}));

router.post("/api/photo", wrap(async (req, res) => {
  const image = String(req.body?.image || "");
  if (!image.startsWith("data:image/")) throw httpErr(400, "Manda una imagen");
  res.json(await ai.parseNotebookPhoto(image, store.getDb().customers.map((c) => c.name)));
}));

// Venta de mostrador desde el teclado: el monto tecleado va directo al cobro, sin pasar por el parser.
router.post("/api/sale", wrap(async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw httpErr(400, "Escribe el monto");
  const items = String(req.body?.concept || "").trim().slice(0, 60);
  const ch = await payments.createCharge({ kind: "qr", amount, source: "libreta", concept: items ? `Mostrador ${items}` : "Venta mostrador" });
  res.json({ charge: payments.toPublic(ch) });
}));

router.post("/api/entries/bulk", wrap(async (req, res) => {
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  res.json(await runActions(entries.filter((e) => e.customer && Number(e.amount) > 0).map((e) => ({ type: "add_debt", customer: e.customer, amount: Number(e.amount), items: e.items || "", phone: e.phone || null }))));
}));

router.post("/api/customers/:id/charge", wrap(async (req, res) => {
  const c = findById(req.params.id);
  const ch = await chargeCustomer(c, req.body?.method || "qr", req.body?.amount ? Number(req.body.amount) : null);
  res.json({ charge: payments.toPublic(ch) });
}));

router.post("/api/customers/:id/cash", wrap(async (req, res) => {
  res.json(await runActions([{ type: "cash_payment", customer: findById(req.params.id).name, amount: Number(req.body?.amount) || null }]));
}));

router.patch("/api/customers/:id", wrap(async (req, res) => {
  const c = findById(req.params.id);
  if (req.body.phone !== undefined) {
    const ph = String(req.body.phone).replace(/\D/g, "").slice(-10);
    if (ph && ph.length !== 10) throw httpErr(400, "El celular debe tener 10 dígitos");
    c.phone = ph || null;
  }
  if (req.body.name) c.name = String(req.body.name).slice(0, 60);
  store.save(); broadcast("ledger"); res.json({ ok: true });
}));

router.post("/api/customers/:id/reminder", wrap(async (req, res) => {
  const d = store.getDb();
  const c = findById(req.params.id);
  const balance = ledger.balanceOf(c.id);
  if (balance <= 0) throw httpErr(400, `${c.name} no debe nada 🎉`);
  let payUrl = null, pushSent = false;
  const warnings = [];
  if (payments.linksEnabled()) { try { payUrl = (await chargeCustomer(c, "link")).url; } catch (e) { warnings.push(e.message); } }
  if (c.phone && req.body?.push !== false) { try { await chargeCustomer(c, "push"); pushSent = true; } catch (e) { warnings.push(e.message); } }
  const items = d.entries.filter((e) => e.customerId === c.id && e.kind === "debt").slice(-4).map((e) => e.items).filter(Boolean).join(", ");
  const message = await ai.writeReminder({ store: d.store.name, owner: d.store.owner, customer: c.name, balance, items, payUrl, pushSent });
  res.json({ message, waUrl: `https://wa.me/${c.phone ? "52" + c.phone : ""}?text=${encodeURIComponent(message)}`, payUrl, pushSent, warnings });
}));

router.get("/api/charges/:id", (req, res) => {
  const c = payments.getCharge(req.params.id);
  c ? res.json({ charge: payments.toPublic(c) }) : res.status(404).json({ message: "No existe" });
});
router.post("/api/charges/:id/simulate", wrap(async (req, res) => res.json({ result: payments.simulatePayment(req.params.id) })));
router.post("/api/reconcile", wrap(async (req, res) => res.json({ matched: await payments.reconcile() })));

router.post("/api/store", wrap(async (req, res) => {
  const s = store.getDb().store;
  if (req.body.name) s.name = String(req.body.name).slice(0, 60);
  if (req.body.owner) s.owner = String(req.body.owner).slice(0, 60);
  store.save(); broadcast("ledger"); res.json({ ok: true });
}));

router.post("/api/demo/seed", wrap(async (req, res) => {
  store.reset();
  const day = 86400_000, now = Date.now();
  const seed = [
    ["Doña Mary", "5512345678", [[86, "2 cocas 600 y pan", 3], [42, "huevo 1/2 kg", 1]]],
    ["Don Chuy", null, [[74.5, "cigarros y encendedor", 2]]],
    ["Lupita", "5598765432", [[52, "leche y galletas", 1]]],
    ["El Güero del taller", null, [[120, "refrescos para la comida", 5], [35, "sabritas", 4]]],
  ];
  for (const [name, phone, debts] of seed) {
    const c = ledger.upsertCustomer(name, phone);
    for (const [amount, items, daysAgo] of debts) ledger.addEntry({ customerId: c.id, kind: "debt", amount, items, at: now - daysAgo * day });
  }
  broadcast("ledger"); res.json({ ok: true });
}));
router.post("/api/demo/reset", wrap(async (req, res) => { store.reset({ full: true }); broadcast("ledger"); res.json({ ok: true }); }));
