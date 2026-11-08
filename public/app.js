// Libreta — frontend sin dependencias.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const money = (n) => "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ago = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "ayer" : `hace ${d} días`;
};
const maskPhone = (p) => (p ? `${p.slice(0, 2)} •••• ${p.slice(-4)}` : "");

let adminToken = "";
let serverLocked = false;
function readAdminToken() {
  const url = new URL(location.href);
  if (url.searchParams.has("admin")) {
    adminToken = url.searchParams.get("admin") || "";
    try {
      if (adminToken) localStorage.setItem("cobrale-admin", adminToken);
      else localStorage.removeItem("cobrale-admin");
    } catch {}
    url.searchParams.delete("admin");
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } else {
    try { adminToken = localStorage.getItem("cobrale-admin") || ""; } catch {}
  }
}
readAdminToken();

let state = null;
let openChargeId = null;
let pollTimer = null;
let agentCharges = [];
let agentBadgeCount = 0;

const isReadOnly = () => Boolean(serverLocked && !adminToken);

function applyReadOnly() {
  const locked = isReadOnly();
  document.documentElement.classList.toggle("read-only", locked);
  const controls = $$("#cmdForm input, #cmdForm button, #examples button, #customers [data-act], #panel-mostrador input, #panel-mostrador button, #seedBtn, #resetBtn, #modalBody button, #modalBody input, #modalBody textarea");
  for (const el of controls) {
    if ("disabled" in el) {
      if (locked) {
        if (!("readOnlyDisabled" in el.dataset)) el.dataset.readOnlyDisabled = String(el.disabled);
        el.disabled = true;
      } else if ("readOnlyDisabled" in el.dataset) {
        el.disabled = el.dataset.readOnlyDisabled === "true";
        delete el.dataset.readOnlyDisabled;
      }
    } else {
      el.classList.toggle("readonly-disabled", locked);
      if (locked) el.setAttribute("aria-disabled", "true");
      else el.removeAttribute("aria-disabled");
    }
  }
  for (const input of [$("#photoInput"), $("#photoInput2")]) {
    const label = input?.closest("label");
    label?.classList.toggle("readonly-disabled", locked);
    if (locked) label?.setAttribute("aria-disabled", "true");
    else label?.removeAttribute("aria-disabled");
  }
  const storeName = $("#storeName");
  storeName?.classList.toggle("readonly-disabled", locked);
  if (locked) storeName?.setAttribute("aria-disabled", "true");
  else storeName?.removeAttribute("aria-disabled");
}

function showError(err) {
  toast(err?.status === 401 ? "Modo solo lectura" : err?.message || "Ocurrió un error", "err");
}

async function api(path, body, method) {
  const headers = body ? { "Content-Type": "application/json" } : {};
  if (adminToken) headers["x-admin-token"] = adminToken;
  const res = await fetch(path, {
    method: method || (body ? "POST" : "GET"),
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      serverLocked = true;
      applyReadOnly();
    }
    const err = new Error(res.status === 401 ? "Modo solo lectura" : data.message || `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---------------- Render ----------------
function render(s) {
  const prev = state;
  state = s;
  serverLocked = Boolean(s.mode?.locked);
  $("#storeName").textContent = `${s.store.name} · ${s.store.owner}`;
  bumpIfChanged("#stPorCobrar", money(s.totals.porCobrar));
  bumpIfChanged("#stCodi", money(s.totals.cobradoHoyCodi));
  bumpIfChanged("#stCash", money(s.totals.cobradoHoyEfectivo));
  $("#stClientes").textContent = `${s.totals.clientesConDeuda} ${s.totals.clientesConDeuda === 1 ? "cliente" : "clientes"} con cuenta`;
  renderChips(s.mode);
  renderAgentConnect(s.mode);
  renderCustomers(s.customers, prev);
  renderFeed(s.feed);
  applyReadOnly();
}

function bumpIfChanged(sel, text) {
  const el = $(sel);
  if (el.textContent !== text) {
    el.textContent = text;
    el.classList.add("bump");
    setTimeout(() => el.classList.remove("bump"), 300);
  }
}

function renderChips(m) {
  const chips = [];
  chips.push(m.pey === "live" ? `<span class="chip live"><span class="dot"></span>CoDi en vivo · pey</span>` : `<span class="chip demo"><span class="dot"></span>CoDi simulado</span>`);
  chips.push(m.ai ? `<span class="chip live"><span class="dot"></span>IA · ${esc(m.ai)}</span>` : `<span class="chip demo"><span class="dot"></span>IA local</span>`);
  if (m.testAmount) chips.push(`<span class="chip warn">Cobros de prueba: ${money(m.testAmount)}</span>`);
  if (m.locked && !adminToken) chips.push(`<span class="chip warn">👀 Solo lectura</span>`);
  $("#modeChips").innerHTML = chips.join("");
}

function renderCustomers(list, prev) {
  const grid = $("#customers");
  $("#empty").hidden = list.length > 0;
  const prevBal = Object.fromEntries((prev?.customers || []).map((c) => [c.id, c.balance]));
  grid.innerHTML = list
    .map((c) => {
      const zero = c.balance <= 0;
      const hist = c.history
        .slice(0, 3)
        .map((e) => `<li class="${e.kind === "payment" ? "pay" : ""}"><span>${e.kind === "payment" ? "✓ " + esc(e.items || "Pago") : esc(e.items || "Fiado")}<span class="when">${ago(e.at)}</span></span><span class="amt">${e.kind === "payment" ? "−" : "+"}${money(e.amount)}</span></li>`)
        .join("");
      return `<article class="card ${zero ? "zero" : ""} ${prevBal[c.id] > c.balance && prev ? "paid" : ""}" data-id="${c.id}">
        <div class="card-head">
          <div><div class="card-name">${esc(c.name)}</div><div class="card-phone" data-act="phone">${c.phone ? "📱 " + maskPhone(c.phone) : "+ agregar celular"}</div></div>
          <div class="right"><div class="card-balance ${zero ? "zero" : ""}">${zero ? "Al corriente ✓" : money(c.balance)}</div>${c.pendingCharges && !zero ? `<span class="pending-badge">⏳ cobro enviado</span>` : ""}</div>
        </div>
        <ul class="hist">${hist || `<li><span>Sin movimientos</span></li>`}</ul>
        <div class="actions">
          <button class="btn codi" data-act="qr" ${zero ? "disabled" : ""}>▦ Cobrar QR</button>
          <button class="btn" data-act="push" ${zero ? "disabled" : ""}>📲 A su cel</button>
          <button class="btn" data-act="whats" ${zero ? "disabled" : ""}>💬 Recordar</button>
          <button class="btn" data-act="cash" ${zero ? "disabled" : ""}>💵 Efectivo</button>
        </div>
      </article>`;
    })
    .join("");
}

function renderFeed(feed) {
  $("#feed").innerHTML = feed.length
    ? feed
        .map((f) => `<li><div><div><b>${esc(f.name)}</b></div><div class="f-sub">${f.type === "orphan" ? "Pago CoDi sin asignar" : "CoDi · " + ({ qr: "QR", push: "notificación", link: "link de pago", mcp: "agente vía MCP" }[f.via] || f.via)} · ${ago(f.at)}</div></div><div class="f-amt">+${money(f.amount)}</div></li>`)
        .join("")
    : `<li class="empty-feed">Aquí aparecen los pagos CoDi en cuanto llegan.</li>`;
}

function renderAgentConnect(mode = state?.mode) {
  const url = mode?.mcp?.url || `${location.origin}/mcp`;
  $("#agentMcpUrl").textContent = url;
  $("#agentCodex").textContent = `codex mcp add cobrale --url ${url}`;
  const authLine = mode?.mcp?.auth ? 'bearer_token_env_var = "PEY_MCP_TOKEN"\n' : "";
  $("#agentToml").textContent = `[mcp_servers.cobrale]\nurl = "${url}"\ntool_timeout_sec = 300\n${authLine}`.trimEnd();
  $("#agentResponses").textContent = `tools: [{ type: "mcp", server_label: "cobrale", server_url: "${url}", require_approval: "never" }]`;
  $("#agentAuthNote").hidden = !mode?.mcp?.auth;
}

function renderAgentCharges(charges = agentCharges, { animateId = null, animateKind = "new" } = {}) {
  $("#agentCharges").innerHTML = charges.map((c) => {
    const kind = c.kind === "qr" ? "QR" : c.kind === "push" ? `Celular •••• ${(c.phone || "").slice(-4)}` : "Link";
    const status = c.status === "paid"
      ? ["paid", "✅ Pagado"]
      : c.status === "superseded"
        ? ["superseded", "Cancelado"]
        : ["pending", "⏳ Esperando pago"];
    const animation = c.id === animateId ? (animateKind === "paid" ? " agent-charge-flash" : " agent-charge-in") : "";
    const href = c.payPage || `/cobro/${encodeURIComponent(c.id)}`;
    return `<li class="agent-charge agent-charge-${status[0]}${animation}" data-charge-id="${esc(c.id)}">
      <div class="agent-charge-head"><strong class="agent-charge-amount">${money(c.amount)}</strong><span class="agent-charge-kind">${esc(kind)}</span><span class="agent-charge-status">${status[1]}</span></div>
      <div class="agent-charge-concept">${esc(c.concept || "Cobro CoDi")}</div>
      <div class="agent-charge-meta"><span>Referencia: ${esc(c.reference || "—")}</span><time>${esc(ago(c.createdAt))}</time></div>
      <a class="agent-charge-link" href="${esc(href)}" target="_blank" rel="noopener">Ver cobro ↗</a>
    </li>`;
  }).join("");
  $("#agentEmpty").hidden = charges.length > 0;
}

function setAgentBadge(count) {
  const badge = $("#agentBadge");
  badge.textContent = count > 99 ? "99+" : String(count);
  badge.hidden = count < 1;
}

function upsertAgentCharge(charge, { animateKind = "new" } = {}) {
  if (!charge?.id) return false;
  const index = agentCharges.findIndex((c) => c.id === charge.id);
  const isNew = index < 0;
  agentCharges = isNew
    ? [charge, ...agentCharges]
    : agentCharges.map((c) => c.id === charge.id ? { ...c, ...charge } : c);
  agentCharges.sort((a, b) => (b.paidAt || b.createdAt) - (a.paidAt || a.createdAt));
  renderAgentCharges(agentCharges, { animateId: isNew || animateKind === "paid" ? charge.id : null, animateKind });
  if (isNew && !$(".tab[data-tab='agentes']").classList.contains("active")) {
    agentBadgeCount++;
    setAgentBadge(agentBadgeCount);
  }
  return isNew;
}

async function loadAgentCharges() {
  try {
    const result = await api("/api/charges?source=mcp");
    agentCharges = Array.isArray(result.charges) ? result.charges : [];
    renderAgentCharges();
  } catch {}
}

// ---------------- Comandos ----------------
const EXAMPLES = [
  "Apúntale 85 a Doña Mary de 2 cocas y un pan",
  "Don Chuy se llevó cigarros de 74.50",
  "Cóbrale a Doña Mary",
  "Mándale el cobro a Lupita a su cel",
  "Lupita me abonó 20",
  "El cel de Don Chuy es 5511223344",
  "Cóbrame 45 de tortillas",
];
$("#examples").innerHTML = EXAMPLES.slice(0, 4).map((e) => `<button type="button">${esc(e)}</button>`).join("");
$("#examples").addEventListener("click", (e) => {
  if (e.target.tagName === "BUTTON") { $("#cmdInput").value = e.target.textContent; $("#cmdInput").focus(); }
});
let exIdx = 0;
setInterval(() => { if (!$("#cmdInput").value) $("#cmdInput").placeholder = EXAMPLES[(exIdx = (exIdx + 1) % EXAMPLES.length)] + "…"; }, 3500);

$("#cmdForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("#cmdInput").value.trim();
  if (!text) return;
  if (isReadOnly()) return toast("Modo solo lectura", "err");
  await runCommand(text);
});

async function runCommand(text) {
  if (isReadOnly()) return toast("Modo solo lectura", "err");
  const btn = $("#sendBtn");
  btn.disabled = true;
  btn.textContent = "Pensando…";
  try {
    const r = await api("/api/command", { text });
    $("#cmdInput").value = "";
    const reply = $("#reply");
    reply.hidden = false;
    reply.innerHTML = `<div class="r-main">${esc(r.reply)}<span class="tag">${r.ai ? "IA" : "parser local"}</span></div>${
      r.results?.length ? `<ul>${r.results.map((x) => `<li class="${x.ok ? "" : "err"}">${esc(x.text)}</li>`).join("")}</ul>` : ""
    }`;
    if (r.charge) openCharge(r.charge);
  } catch (err) {
    showError(err);
  } finally {
    btn.disabled = isReadOnly();
    btn.textContent = "Anotar";
  }
}

// ---------------- Voz ----------------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SR) $("#micBtn").title = "Tu navegador no soporta dictado; usa Chrome";
let rec = null;
$("#micBtn").addEventListener("click", () => {
  if (isReadOnly()) return toast("Modo solo lectura", "err");
  if (!SR) return toast("Dictado no disponible en este navegador. Usa Chrome.", "err");
  if (rec) return rec.stop();
  rec = new SR();
  rec.lang = "es-MX";
  rec.interimResults = true;
  rec.continuous = false;
  let finalText = "";
  rec.onresult = (ev) => {
    let t = "";
    for (const r of ev.results) t += r[0].transcript;
    $("#cmdInput").value = t;
    if (ev.results[ev.results.length - 1].isFinal) finalText = t;
  };
  rec.onerror = (ev) => toast("Micrófono: " + ev.error, "err");
  rec.onend = () => {
    $("#micBtn").classList.remove("recording");
    rec = null;
    if (finalText.trim()) runCommand(finalText.trim());
  };
  $("#micBtn").classList.add("recording");
  rec.start();
});

// ---------------- Foto de la libreta ----------------
for (const inp of [$("#photoInput"), $("#photoInput2")]) inp.addEventListener("change", (e) => {
  if (isReadOnly()) { e.target.value = ""; return toast("Modo solo lectura", "err"); }
  if (e.target.files[0]) handlePhoto(e.target.files[0], e.target);
});

async function handlePhoto(file, input) {
  input.value = "";
  const dataUrl = await compress(file, 1600, 0.85);
  showModal(`<h2 class="m-title">Leyendo tu libreta…</h2><p class="m-sub">La IA está pasando el fiado a limpio.</p><div class="scan"><img src="${dataUrl}" style="width:100%;display:block;border-radius:12px"></div>`);
  try {
    const r = await api("/api/photo", { image: dataUrl });
    showPhotoPreview(dataUrl, r);
  } catch (err) {
    if (err.status === 401) showError(err);
    else showModal(`<h2 class="m-title">No pude leer la foto</h2><p class="m-sub">${esc(err.message)}</p>`);
  }
}

function showPhotoPreview(dataUrl, r) {
  const rows = (r.entries || []).map((e, i) => `<tr data-i="${i}">
    <td><input value="${esc(e.customer)}" data-f="customer"></td>
    <td><input value="${esc(e.items)}" data-f="items"></td>
    <td><input class="amt" type="number" step="0.01" value="${Number(e.amount).toFixed(2)}" data-f="amount"></td>
    <td><span class="conf ${e.confidence}">${e.confidence}</span></td>
    <td><button class="btn ghost small" data-del>✕</button></td></tr>`).join("");
  const total = (r.entries || []).reduce((s, e) => s + Number(e.amount || 0), 0);
  showModal(`<h2 class="m-title">Encontré ${r.entries?.length || 0} cuentas pendientes</h2>
    <p class="m-sub">Revisa y corrige antes de pasarlas a la libreta. Total: <b>${money(total)}</b></p>
    <div class="photo-layout"><img src="${dataUrl}"><div>
      <table class="ptable"><thead><tr><th>Cliente</th><th>Qué se llevó</th><th>Monto</th><th></th><th></th></tr></thead><tbody>${rows}</tbody></table>
    </div></div>
    ${r.notes ? `<div class="notes">📝 ${esc(r.notes)}</div>` : ""}
    <button class="btn primary wide" id="bulkSave" ${r.entries?.length ? "" : "disabled"}>Pasar a la libreta</button>`, true);
  $("#modalBody").addEventListener("click", (e) => { if (e.target.dataset.del !== undefined) e.target.closest("tr").remove(); });
  $("#bulkSave").onclick = async () => {
    const entries = $$("#modalBody tbody tr").map((tr) => ({
      customer: $('[data-f="customer"]', tr).value.trim(),
      items: $('[data-f="items"]', tr).value.trim(),
      amount: Number($('[data-f="amount"]', tr).value),
    }));
    try {
      await api("/api/entries/bulk", { entries });
      closeModal();
      toast(`✓ ${entries.length} cuentas pasadas a la libreta`, "ok");
    } catch (err) { showError(err); }
  };
}

function compress(file, max, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", quality));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// ---------------- Acciones por cliente ----------------
$("#customers").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  if (isReadOnly()) return toast("Modo solo lectura", "err");
  const card = btn.closest(".card");
  const c = state.customers.find((x) => x.id === card.dataset.id);
  const act = btn.dataset.act;
  try {
    if (act === "phone") return editPhone(c);
    if (act === "qr") return openCharge((await withBusy(btn, () => api(`/api/customers/${c.id}/charge`, { method: "qr" }))).charge);
    if (act === "push") {
      if (!c.phone) { await editPhone(c, true); return; }
      return openCharge((await withBusy(btn, () => api(`/api/customers/${c.id}/charge`, { method: "push" }))).charge);
    }
    if (act === "whats") return reminder(c, btn);
    if (act === "cash") return cash(c);
  } catch (err) { showError(err); }
});

async function withBusy(btn, fn) {
  const t = btn.innerHTML;
  const wasDisabled = btn.disabled;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>`;
  try { return await fn(); } finally { btn.disabled = wasDisabled || isReadOnly(); btn.innerHTML = t; }
}

function editPhone(c, thenPush = false) {
  if (isReadOnly()) return toast("Modo solo lectura", "err");
  showModal(`<h2 class="m-title">Celular de ${esc(c.name)}</h2><p class="m-sub">El que tiene ligado a CoDi en la app de su banco. 10 dígitos.</p>
    <input id="phoneIn" inputmode="numeric" maxlength="14" value="${esc(c.phone || "")}" class="pos-concept" style="font-size:22px;text-align:center" placeholder="55 1234 5678">
    <button class="btn primary wide" id="phoneSave">${thenPush ? "Guardar y mandar cobro" : "Guardar"}</button>`);
  $("#phoneIn").focus();
  $("#phoneSave").onclick = async () => {
    try {
      await api(`/api/customers/${c.id}`, { phone: $("#phoneIn").value }, "PATCH");
      if (thenPush) openCharge((await api(`/api/customers/${c.id}/charge`, { method: "push" })).charge);
      else closeModal();
    } catch (err) { showError(err); }
  };
}

function cash(c) {
  showModal(`<h2 class="m-title">Abono en efectivo</h2><p class="m-sub">${esc(c.name)} debe ${money(c.balance)}</p>
    <input id="cashIn" type="number" step="0.01" class="pos-concept" style="font-size:26px;text-align:center" value="${c.balance.toFixed(2)}">
    <button class="btn primary wide" id="cashSave">Anotar abono</button>`);
  $("#cashIn").select();
  $("#cashSave").onclick = async () => {
    try { await api(`/api/customers/${c.id}/cash`, { amount: Number($("#cashIn").value) }); closeModal(); toast("Abono anotado", "ok"); } catch (err) { showError(err); }
  };
}

async function reminder(c, btn) {
  const r = await withBusy(btn, () => api(`/api/customers/${c.id}/reminder`, {}));
  showModal(`<h2 class="m-title">Recordatorio para ${esc(c.name)}</h2>
    <p class="m-sub">${r.pushSent ? "📲 Ya le llegó la solicitud CoDi a su banco. " : ""}${r.payUrl ? "🔗 Link de pago incluido." : ""}</p>
    <textarea class="msg" id="msgTxt">${esc(r.message)}</textarea>
    ${r.warnings?.length ? `<div class="warnings">${r.warnings.map(esc).join("<br>")}</div>` : ""}
    <div class="actions" style="margin-top:12px">
      <a class="btn codi" id="waBtn" href="${esc(r.waUrl)}" target="_blank" rel="noopener">💬 Abrir WhatsApp</a>
      <button class="btn" id="copyBtn">Copiar</button>
    </div>`);
  $("#msgTxt").addEventListener("input", () => { $("#waBtn").href = r.waUrl.split("?")[0] + "?text=" + encodeURIComponent($("#msgTxt").value); });
  $("#copyBtn").onclick = () => navigator.clipboard.writeText($("#msgTxt").value).then(() => toast("Copiado", "ok"));
}

// ---------------- Modal de cobro ----------------
function openCharge(ch) {
  openChargeId = ch.id;
  const sim = state?.mode?.canSimulate ? `<button class="btn ghost small" id="simBtn">Simular pago (demo)</button>` : "";
  const test = state?.mode?.testAmount ? `<div class="test-note">Modo prueba: el banco cobrará ${money(ch.chargedAmount)} en lugar de ${money(ch.amount)}.</div>` : "";
  let body;
  if (ch.kind === "qr") {
    body = `<div style="text-align:center"><span class="codi-tag">CoDi® · Banco de México</span></div>
      <p class="qr-amount">${money(ch.amount)}</p>
      <p class="qr-help">${esc(ch.customerName ? `Cuenta de ${ch.customerName}` : ch.concept)} · Escanea con la app de tu banco</p>
      <div class="qr-wrap" id="qrWrap">${ch.qrSvg}</div>`;
  } else if (ch.kind === "push") {
    body = `<div class="push-anim">📲</div><p class="qr-amount">${money(ch.amount)}</p>
      <p class="qr-help">Le llegó una solicitud de cobro CoDi a la app del banco de <b>${esc(ch.customerName)}</b></p>
      <div class="phone-big">${maskPhone(ch.phone)}</div><div class="qr-wrap" id="qrWrap" style="background:transparent;box-shadow:none;min-height:10px"></div>`;
  } else {
    body = `<p class="qr-amount">${money(ch.amount)}</p><p class="qr-help"><a href="${esc(ch.url)}" target="_blank">${esc(ch.url)}</a></p><div class="qr-wrap" id="qrWrap" style="min-height:10px"></div>`;
  }
  showModal(`${body}${test}<div class="waiting" id="waiting"><span class="spinner"></span>Esperando pago…</div><div class="row">${sim}</div>`);
  $("#simBtn")?.addEventListener("click", () => api(`/api/charges/${ch.id}/simulate`, {}).catch(showError));
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!openChargeId) return clearInterval(pollTimer);
    try { const r = await api(`/api/charges/${openChargeId}`); if (r.charge.status === "paid") onPaid(r.charge); } catch {}
  }, 3000);
}

let celebrated = new Set();
function onPaid(ch) {
  if (celebrated.has(ch.id)) return;
  celebrated.add(ch.id);
  chaChing();
  confetti();
  if (openChargeId === ch.id) {
    clearInterval(pollTimer);
    const wrap = $("#qrWrap");
    $("#waiting")?.remove();
    $("#simBtn")?.remove();
    if (wrap) {
      wrap.style.minHeight = "260px";
      wrap.insertAdjacentHTML("beforeend", `<div class="paid-overlay"><div><div class="big">✓</div><h3>¡Pagado!</h3><div>${money(ch.amount)}${ch.customerName ? " · " + esc(ch.customerName) : ""}</div><div style="opacity:.8;font-size:13px;margin-top:6px">Llegó directo a tu cuenta, sin comisión</div></div></div>`);
    }
    setTimeout(() => { if (openChargeId === ch.id) closeModal(); }, 4500);
  } else {
    toast(`💸 ${ch.customerName || "Mostrador"} pagó ${money(ch.amount)} con CoDi`, "ok");
  }
}

// ---------------- Mostrador ----------------
let posValue = "";
$("#keypad").innerHTML = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k) => `<button>${k}</button>`).join("");
$("#keypad").addEventListener("click", (e) => {
  if (isReadOnly()) return toast("Modo solo lectura", "err");
  const k = e.target.textContent;
  if (e.target.tagName !== "BUTTON") return;
  if (k === "⌫") posValue = posValue.slice(0, -1);
  else if (k === "." && posValue.includes(".")) return;
  else if (posValue.includes(".") && posValue.split(".")[1].length >= 2) return;
  else posValue += k;
  $("#posDisplay").textContent = "$" + (posValue || "0");
});
$("#posCharge").addEventListener("click", async () => {
  if (isReadOnly()) return toast("Modo solo lectura", "err");
  const amount = Number(posValue);
  if (!amount) return toast("Escribe el monto", "err");
  const concept = $("#posConcept").value.trim();
  try {
    const r = await withBusy($("#posCharge"), () => api("/api/command", { text: `Cóbrame ${amount} de ${concept || "venta"} en mostrador` }));
    if (r.charge) { openCharge(r.charge); posValue = ""; $("#posDisplay").textContent = "$0"; $("#posConcept").value = ""; }
    else toast(r.results?.[0]?.text || "No se pudo", "err");
  } catch (err) { showError(err); }
});

// ---------------- Tabs, misc ----------------
$$(".tab").forEach((t) => t.addEventListener("click", () => {
  $$(".tab").forEach((x) => x.classList.toggle("active", x === t));
  $$(".panel").forEach((p) => (p.hidden = p.id !== "panel-" + t.dataset.tab));
  if (t.dataset.tab === "agentes") {
    agentBadgeCount = 0;
    setAgentBadge(agentBadgeCount);
    loadAgentCharges();
  }
}));
$$('[data-copy]').forEach((button) => button.addEventListener("click", async () => {
  const target = $(button.dataset.copy);
  if (!target) return;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard no disponible");
    await navigator.clipboard.writeText(target.textContent.trim());
    toast("Copiado al portapapeles", "ok");
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(target);
    selection.removeAllRanges();
    selection.addRange(range);
    toast("Cópialo con Ctrl+C");
  }
}));
$("#seedBtn").addEventListener("click", () => api("/api/demo/seed", {}).catch(showError));
$("#resetBtn").addEventListener("click", () => confirmModal("¿Borrar toda la libreta?", () => api("/api/demo/reset", {})));
$("#storeName").addEventListener("click", () => {
  if (isReadOnly()) return toast("Modo solo lectura", "err");
  showModal(`<h2 class="m-title">Tu tienda</h2>
    <input id="stName" class="pos-concept" value="${esc(state.store.name)}" placeholder="Nombre de la tienda">
    <input id="stOwner" class="pos-concept" value="${esc(state.store.owner)}" placeholder="Tu nombre">
    <button class="btn primary wide" id="stSave">Guardar</button>`);
  $("#stSave").onclick = () => api("/api/store", { name: $("#stName").value, owner: $("#stOwner").value }).then(closeModal).catch(showError);
});

function confirmModal(text, fn) {
  showModal(`<h2 class="m-title">${esc(text)}</h2><div class="actions" style="margin-top:16px"><button class="btn" id="cNo">Cancelar</button><button class="btn primary" id="cYes">Sí</button></div>`);
  $("#cNo").onclick = closeModal;
  $("#cYes").onclick = () => { Promise.resolve(fn()).catch(showError); closeModal(); };
}

function showModal(html, wide = false) {
  $("#modalBody").innerHTML = html;
  $(".sheet").classList.toggle("wide", wide);
  $("#modal").hidden = false;
  applyReadOnly();
}
function closeModal() {
  $("#modal").hidden = true;
  $("#modalBody").innerHTML = "";
  openChargeId = null;
  clearInterval(pollTimer);
}
$("#modalClose").addEventListener("click", closeModal);
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

let toastTimer;
function toast(msg, kind = "") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast " + kind;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3800);
}

// ---------------- Efectos ----------------
let audio;
function chaChing() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const now = audio.currentTime;
    [[1318.5, 0], [1760, 0.09], [2637, 0.18]].forEach(([f, t]) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = "triangle"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.25, now + t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.5);
      o.connect(g).connect(audio.destination); o.start(now + t); o.stop(now + t + 0.55);
    });
  } catch {}
}
document.addEventListener("click", () => { try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); } catch {} }, { once: true });

function confetti() {
  const cv = $("#confetti"), ctx = cv.getContext("2d");
  cv.width = innerWidth; cv.height = innerHeight;
  const colors = ["#0a7d4f", "#ffd166", "#e4572e", "#14213d", "#4cc9f0"];
  const ps = Array.from({ length: 160 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight / 2.2, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 16 - 4,
    s: Math.random() * 8 + 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: colors[(Math.random() * colors.length) | 0],
  }));
  let frame = 0;
  (function tick() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const p of ps) {
      p.vy += 0.45; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    }
    if (++frame < 160) requestAnimationFrame(tick); else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}

// ---------------- Tiempo real ----------------
function connect() {
  const es = new EventSource("/api/events");
  es.onmessage = (m) => {
    const ev = JSON.parse(m.data);
    if (ev.state) render(ev.state);
    if (ev.type === "hello") loadAgentCharges();
    if (ev.type === "charge_created" && ev.charge?.source === "mcp") {
      if (upsertAgentCharge(ev.charge)) toast(`🤖 Un agente creó un cobro de ${money(ev.charge.amount)}`);
    }
    if (ev.type === "paid" && ev.charge) {
      onPaid(ev.charge);
      if (ev.charge.source === "mcp") upsertAgentCharge(ev.charge, { animateKind: "paid" });
    }
    if (ev.type === "charge_updated" && ev.charge?.source === "mcp") {
      upsertAgentCharge(ev.charge, { animateKind: ev.charge.status === "paid" ? "paid" : "update" });
    }
    if (ev.type === "orphan_payment") { chaChing(); toast(`💸 Llegó un pago CoDi de ${money(ev.amount)}`, "ok"); }
  };
  es.onerror = () => { es.close(); setTimeout(connect, 2000); };
}
renderAgentConnect();
applyReadOnly();
loadAgentCharges();
api("/api/state").then(render).catch(() => {});
connect();
