// Parser local de respaldo: si no hay internet/IA, la libreta sigue funcionando con frases simples.
import { normName } from "./ledger.js";

const NUM = /\$?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:pesos|varos|baros|mxn)?/i;
const PHONE = /(?:\+?52\s*)?(\d[\d\s-]{8,}\d)/;
const COMMAND_PREFIX = /^(?:c[oó]brale|m[aá]ndale|ap[uú]ntale|f[ií]ale|an[oó]tale|anota|c[oó]brame|ponle)\b[,:]?\s*/i;
const HONORIFICS_IN_TEXT = ["dona", "don", "senora", "senor", "sra", "sr", "srita", "la", "el", "tia", "tio", "seno", "joven", "guero", "profe"];

function amountOf(t) {
  const clean = t.replace(PHONE, " ");
  const all = [...clean.matchAll(/\$?\s*(\d+(?:[.,]\d{1,2})?)/g)].map((m) => parseFloat(m[1].replace(",", ".")));
  if (!all.length) return null;
  // "2 cocas de 20 y un pan de 5" => suma lo que parece precio (último número de cada "de X")
  const priced = [...clean.matchAll(/de\s*\$?\s*(\d+(?:[.,]\d{1,2})?)/gi)].map((m) => parseFloat(m[1].replace(",", ".")));
  if (priced.length > 1) return priced.reduce((a, b) => a + b, 0);
  return Math.max(...all);
}

function knownNameOf(t, knownCustomers) {
  if (!Array.isArray(knownCustomers) || !knownCustomers.length) return null;
  // normName quita honoríficos al principio; permite el mismo honorífico antes
  // del nombre dentro de la frase, como en "a doña mary".
  const normalizedText = normName(t);
  const paddedText = " " + normalizedText + " ";
  return knownCustomers
    .filter((customer) => typeof customer === "string")
    .map((customer) => ({ customer, normalized: normName(customer) }))
    .filter(({ normalized }) => normalized && (
      paddedText.includes(" " + normalized + " ") ||
      HONORIFICS_IN_TEXT.some((honorific) => paddedText.includes(" " + honorific + " " + normalized + " "))
    ))
    .sort((a, b) => b.normalized.length - a.normalized.length)[0]?.customer || null;
}

function nameOf(t, knownCustomers = []) {
  const known = knownNameOf(t, knownCustomers);
  if (known) return known;

  const clean = t.replace(COMMAND_PREFIX, "");
  const honorific = "do[nñ]a|don|la|el|se[nñ]ora|t[ií]a|t[ií]o";
  const stopWords = "se|ya|me|le|es|pag[oó]|abon[oó]|llev[oó]|de|del|a|para|en|el|la|los|las|y";
  const word = "[A-ZÁÉÍÓÚÑ][\\wáéíóúñ]+";
  const person =
    "((?:(?:" + honorific + ")\\s+)?" +
    word +
    "(?:\\s+(?!(?:" + stopWords + ")\\b)" + word + ")?)";
  const m = clean.match(new RegExp("\\b(?:a|de|para)\\s+" + person, "i")) || clean.match(new RegExp("^" + person, "i"));
  if (!m) return null;
  return m[1].replace(new RegExp("\\s+(?:" + stopWords + ")\\b.*$", "i"), "").trim();
}

export function localParseCommand(text, knownCustomers = []) {
  const t = String(text || "").trim();
  const lower = t.toLowerCase();
  const amount = amountOf(t);
  const name = nameOf(t, knownCustomers);
  const phone = (t.match(PHONE)?.[1] || "").replace(/\D/g, "").slice(-10) || null;
  const items = (t.match(/(?:se llev[oó]|llev[oó]|de)\s+(.+?)(?:\s+de\s+\$?\d|$)/i)?.[1] || "").slice(0, 60);

  if (/c[oó]br(a|ame|ar)\b.*mostrador|^c[oó]brame|venta/i.test(lower) && amount) {
    return { actions: [{ type: "sale", customer: null, amount, items, phone: null, method: "qr" }], reply: `Listo, QR por $${amount.toFixed(2)}.` };
  }
  if (/(pag[oó]|abon[oó]|liquid[oó]|me dio)/i.test(lower) && name) {
    return { actions: [{ type: "cash_payment", customer: name, amount, items: "", phone: null, method: null }], reply: `Anotado el abono de ${name}.` };
  }
  if (/(c[oó]br|m[aá]nd)/i.test(lower) && name) {
    const method = /whats|wa\b|mensaje/i.test(lower) ? "link" : /cel|tel[eé]fono|banco/i.test(lower) ? "push" : "qr";
    return { actions: [{ type: "charge", customer: name, amount, items: "", phone, method }], reply: `Generando cobro para ${name}.` };
  }
  if (phone && name && !amount) {
    return { actions: [{ type: "set_phone", customer: name, amount: null, items: "", phone, method: null }], reply: `Guardé el cel de ${name}.` };
  }
  if (name && amount) {
    return { actions: [{ type: "add_debt", customer: name, amount, items, phone, method: null }], reply: `Apuntado: ${name} debe $${amount.toFixed(2)} más.` };
  }
  return { actions: [], reply: "No te entendí bien. Prueba: \"Apúntale 85 a Doña Mary de refrescos\"." };
}

export function localReminder({ owner, customer, balance, payUrl, pushSent }) {
  const lines = [
    `Buen día ${customer}, le saluda ${owner} de la tiendita 🙂`,
    `Le comparto que su cuenta va en $${Number(balance).toFixed(2)}.`,
  ];
  if (pushSent) lines.push("Le llegó una solicitud de cobro CoDi a la app de su banco, la puede pagar con un toque.");
  if (payUrl) lines.push(`Si gusta puede pagar aquí:\n${payUrl}`);
  lines.push("¡Gracias por su preferencia!");
  return lines.join("\n");
}

export function demoNotebook() {
  return {
    entries: [
      { customer: "Doña Mary", amount: 186, items: "2 cocas 600, pan Bimbo, huevo 1kg", phone: null, confidence: "alta" },
      { customer: "Don Chuy", amount: 74.5, items: "cigarros, encendedor", phone: null, confidence: "alta" },
      { customer: "Lupita", amount: 52, items: "leche, galletas", phone: null, confidence: "media" },
      { customer: "El güero del taller", amount: 120, items: "refrescos para la comida", phone: null, confidence: "baja" },
    ],
    notes: "Modo demo: sin OPENAI_API_KEY se muestran datos de ejemplo. Se ignoró una línea tachada de Pedro ($40).",
  };
}
