// Parser local de respaldo: si no hay internet/IA, la libreta sigue funcionando con frases simples.

const NUM = /\$?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:pesos|varos|baros|mxn)?/i;
const PHONE = /(?:\+?52\s*)?(\d[\d\s-]{8,}\d)/;

function amountOf(t) {
  const clean = t.replace(PHONE, " ");
  const all = [...clean.matchAll(/\$?\s*(\d+(?:[.,]\d{1,2})?)/g)].map((m) => parseFloat(m[1].replace(",", ".")));
  if (!all.length) return null;
  // "2 cocas de 20 y un pan de 5" => suma lo que parece precio (último número de cada "de X")
  const priced = [...clean.matchAll(/de\s*\$?\s*(\d+(?:[.,]\d{1,2})?)/gi)].map((m) => parseFloat(m[1].replace(",", ".")));
  if (priced.length > 1) return priced.reduce((a, b) => a + b, 0);
  return Math.max(...all);
}

function nameOf(t) {
  const m =
    t.match(/(?:a|de|para)\s+((?:do[nñ]a|don|la|el|se[nñ]ora|t[ií]a|t[ií]o)?\s*[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)?)/) ||
    t.match(/^((?:do[nñ]a|don|la|el|se[nñ]ora|t[ií]a|t[ií]o)?\s*[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)?)/i);
  if (!m) return null;
  return m[1].replace(/\s+(se|ya|me|le|pag[oó]|abon[oó]|llev[oó]).*$/i, "").trim();
}

export function localParseCommand(text) {
  const t = String(text || "").trim();
  const lower = t.toLowerCase();
  const amount = amountOf(t);
  const name = nameOf(t);
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
