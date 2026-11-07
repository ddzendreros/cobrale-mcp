// Persistencia compartida en data/db.json. Cada módulo es dueño de sus colecciones:
//   pey/      -> charges, orphanPayments, seenWebhooks, counter
//   libreta/  -> store, customers, entries
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = process.env.DATA_DIR || path.resolve("data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const empty = () => ({
  store: { name: process.env.STORE_NAME || "La Tiendita", owner: process.env.STORE_OWNER || "Don Pepe" },
  customers: [],
  entries: [],
  charges: [],
  orphanPayments: [],
  seenWebhooks: [],
  counter: 1000,
});

let db = load();
function load() {
  try { return { ...empty(), ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) }; } catch { return empty(); }
}

let timer = null;
export function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE + ".tmp", JSON.stringify(db, null, 2));
    fs.renameSync(DB_FILE + ".tmp", DB_FILE);
  }, 50);
}

export const getDb = () => db;
/** Borra los datos de Libreta (clientes/movimientos) y, si full=true, también los cobros. */
export function reset({ full = false } = {}) {
  const keep = full ? {} : { charges: db.charges, orphanPayments: db.orphanPayments, seenWebhooks: db.seenWebhooks, counter: db.counter };
  db = { ...empty(), store: db.store, ...keep };
  save();
}
export const id = (p) => `${p}_${crypto.randomBytes(5).toString("hex")}`;
export const round2 = (x) => Math.round((Number(x) + Number.EPSILON) * 100) / 100;
