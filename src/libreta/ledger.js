// Libreta: clientes y movimientos del fiado. Dueña de las colecciones customers/entries.
import { getDb, save, id, round2 } from "../store.js";

// ---------- Nombres ----------
const HONORIFICS = /^(do[nñ]a|don|se[nñ]ora|se[nñ]or|sra|sr|srita|la|el|tia|tio|t[ií]a|t[ií]o|seño|joven|güero|guero|profe)\.?\s+/i;
export function normName(s = "") {
  let n = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let prev;
  do {
    prev = n;
    n = n.replace(HONORIFICS, "");
  } while (n !== prev);
  return n;
}

function lev(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

export function findCustomer(name) {
  const n = normName(name);
  if (!n) return null;
  let best = null, bestScore = Infinity;
  for (const c of getDb().customers) {
    const cn = normName(c.name);
    if (cn === n) return c;
    if (cn.split(" ")[0] === n.split(" ")[0] && (cn.includes(n) || n.includes(cn))) return c;
    const dist = lev(cn, n);
    const tol = Math.max(1, Math.floor(Math.min(cn.length, n.length) / 5));
    if (dist <= tol && dist < bestScore) { best = c; bestScore = dist; }
  }
  return best;
}

export function upsertCustomer(name, phone) {
  let c = findCustomer(name);
  const cleanPhone = phone ? String(phone).replace(/\D/g, "").slice(-10) : null;
  if (!c) {
    c = { id: id("cli"), name: prettyName(name), phone: cleanPhone && cleanPhone.length === 10 ? cleanPhone : null, createdAt: Date.now() };
    getDb().customers.push(c);
  } else if (cleanPhone && cleanPhone.length === 10 && !c.phone) {
    c.phone = cleanPhone;
  }
  save();
  return c;
}

function prettyName(s) {
  return String(s)
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w, i) => (i > 0 && /^(de|del|la|las|los|el|y)$/i.test(w) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

// ---------- Saldos ----------

export function balanceOf(customerId) {
  let b = 0;
  for (const e of getDb().entries) if (e.customerId === customerId) b += e.kind === "debt" ? e.amount : -e.amount;
  return round2(Math.max(0, b));
}

export function addEntry({ customerId, kind, amount, items = "", method = null, ref = null, at = Date.now() }) {
  const e = { id: id("mov"), customerId, kind, amount: round2(amount), items, method, ref, at };
  getDb().entries.push(e);
  save();
  return e;
}

export function snapshot() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const customers = getDb().customers
    .map((c) => {
      const history = getDb().entries.filter((e) => e.customerId === c.id).sort((a, b) => b.at - a.at);
      const pending = getDb().charges.filter((ch) => ch.customerId === c.id && ch.status === "pending");
      return { ...c, balance: balanceOf(c.id), history: history.slice(0, 12), pendingCharges: pending.length, lastAt: history[0]?.at || c.createdAt };
    })
    .sort((a, b) => b.balance - a.balance || b.lastAt - a.lastAt);
  const paidToday = getDb().charges.filter((ch) => ch.status === "paid" && ch.paidAt >= startOfDay.getTime());
  const cashToday = getDb().entries.filter((e) => e.kind === "payment" && e.method === "efectivo" && e.at >= startOfDay.getTime());
  const feed = [
    ...getDb().charges.filter((c) => c.status === "paid").map((c) => ({ type: "codi", at: c.paidAt, amount: c.amount, name: c.customerName || (c.source === "mcp" ? `🤖 Agente · ${c.reference || c.concept}` : "Mostrador"), via: c.source === "mcp" ? "mcp" : c.kind })),
    ...getDb().orphanPayments.map((p) => ({ type: "orphan", at: p.at, amount: p.amount, name: p.concept || "Pago CoDi", via: p.type })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 15);
  return {
    store: getDb().store,
    customers,
    totals: {
      porCobrar: round2(customers.reduce((s, c) => s + c.balance, 0)),
      cobradoHoyCodi: round2(paidToday.reduce((s, c) => s + c.amount, 0)),
      cobradoHoyEfectivo: round2(cashToday.reduce((s, e) => s + e.amount, 0)),
      clientesConDeuda: customers.filter((c) => c.balance > 0).length,
    },
    feed,
  };
}
