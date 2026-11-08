// Gate de integración en demo: inicia un server aislado y verifica Libreta, webhooks, MCP y cancelación.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Webhook } from "standardwebhooks";
import { runMcpChecks } from "./test-mcp.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const check = (message) => console.log(`✅ ${message}`);

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

function findTests(directory) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...findTests(fullPath));
    else if (entry.isFile() && entry.name.endsWith(".test.js")) found.push(fullPath);
  }
  return found;
}

async function stopServer(server) {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  const exited = new Promise((resolve) => server.once("exit", resolve));
  server.kill();
  await Promise.race([exited, sleep(3_000)]);
  if (server.exitCode === null && server.signalCode === null) {
    try { server.kill("SIGKILL"); } catch { server.kill(); }
    await Promise.race([exited, sleep(1_000)]);
  }
}

async function waitForServer(server, baseUrl) {
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error(`El server terminó antes de iniciar (código ${server.exitCode}, señal ${server.signalCode})`);
    }
    try {
      const response = await fetch(new URL("/api/state", baseUrl), { signal: AbortSignal.timeout(500) });
      if (response.ok) {
        await response.json();
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`El server no respondió en 10 s${lastError ? `: ${lastError.message}` : ""}`);
}

async function requestJson(baseUrl, pathname, { method = "GET", body, headers = {} } = {}) {
  const requestHeaders = new Headers(headers);
  const options = { method, headers: requestHeaders, signal: AbortSignal.timeout(10_000) };
  if (body !== undefined) {
    requestHeaders.set("content-type", "application/json");
    options.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const response = await fetch(new URL(pathname, baseUrl), options);
  let data;
  try { data = await response.json(); } catch { data = {}; }
  assert.ok(response.ok, `${method} ${pathname} respondió HTTP ${response.status}: ${data.message || "sin detalle"}`);
  return data;
}

async function postJson(baseUrl, pathname, body, headers) {
  return requestJson(baseUrl, pathname, { method: "POST", body, headers });
}

async function chargeFromTemporaryDb(state, id) {
  // store.save() escribe con un retraso de 50 ms; deja margen antes de leer la carpeta aislada.
  await sleep(150);
  const db = JSON.parse(readFileSync(path.join(state.tempDir, "db.json"), "utf8"));
  const charge = db.charges.find((item) => item.id === id);
  assert.ok(charge, `No encontré el cobro ${id} en los datos temporales`);
  return charge;
}

async function sendSignedWebhook(state, event, id) {
  const rawBody = JSON.stringify(event);
  const date = new Date();
  const result = await requestJson(state.baseUrl, "/webhooks/pey", {
    method: "POST",
    body: rawBody,
    headers: {
      "content-type": "application/json",
      "webhook-id": id,
      "webhook-timestamp": String(Math.floor(date.getTime() / 1000)),
      "webhook-signature": new Webhook(state.secret).sign(id, date, rawBody),
    },
  });
  return result;
}

async function runChecks(state) {
  const port = await freePort();
  state.tempDir = mkdtempSync(path.join(os.tmpdir(), "cobrale-"));
  state.secret = `whsec_${randomBytes(24).toString("base64")}`;
  state.baseUrl = new URL(`http://localhost:${port}`);

  const serverEnv = {
    ...process.env,
    PORT: String(port),
    DATA_DIR: state.tempDir,
    PEY_API_KEY: "",
    OPENAI_API_KEY: "",
    PUBLIC_URL: "",
    PEY_WEBHOOK_SECRET: state.secret,
    PEY_MCP_TOKEN: "",
    PEY_TEST_AMOUNT: "",
    ALLOW_SIMULATE: "",
    ADMIN_TOKEN: "",
    PEY_DEBUG: "",
  };
  state.server = spawn(process.execPath, ["src/server.js"], {
    cwd: projectRoot,
    env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  state.server.stdout.setEncoding("utf8");
  state.server.stderr.setEncoding("utf8");
  state.server.stdout.on("data", (chunk) => { state.serverOutput = (state.serverOutput + chunk).slice(-100_000); });
  state.server.stderr.on("data", (chunk) => { state.serverOutput = (state.serverOutput + chunk).slice(-100_000); });
  state.server.on("error", (error) => { state.serverError = error; });

  await waitForServer(state.server, state.baseUrl);
  check("server aislado listo con datos temporales y modo demo");

  await postJson(state.baseUrl, "/api/demo/reset", {});
  await postJson(state.baseUrl, "/api/demo/seed", {});
  let current = await requestJson(state.baseUrl, "/api/state");
  assert.equal(current.customers.length, 4, "La semilla debe crear cuatro clientes");
  const mary = current.customers.find((customer) => customer.name === "Doña Mary");
  const chuy = current.customers.find((customer) => customer.name === "Don Chuy");
  const lupita = current.customers.find((customer) => customer.name === "Lupita");
  assert.ok(mary && chuy && lupita, "La semilla debe incluir a Doña Mary, Don Chuy y Lupita");
  assert.equal(mary.balance, 128, "Doña Mary debe iniciar con saldo de $128");
  check("Libreta reinicia y siembra cuatro clientes; Doña Mary debe $128");

  const maryCommand = await postJson(state.baseUrl, "/api/command", { text: "Cóbrale a Doña Mary" });
  assert.equal(maryCommand.charge?.kind, "qr", "El comando a Doña Mary debe crear un QR");
  assert.equal(maryCommand.charge?.amount, 128, "El QR de Doña Mary debe ser por $128");
  const maryPayment = await postJson(state.baseUrl, `/api/charges/${encodeURIComponent(maryCommand.charge.id)}/simulate`, {});
  assert.match(String(maryPayment.result || ""), /^pagado/i, "La simulación debe pagar el QR de Doña Mary");
  current = await requestJson(state.baseUrl, "/api/state");
  assert.equal(current.customers.find((customer) => customer.id === mary.id)?.balance, 0, "El saldo de Doña Mary debe quedar en cero");
  assert.equal(current.totals.cobradoHoyCodi, 128, "Libreta debe contar $128 cobrados por CoDi");
  check("el pago simulado liquida la cuenta de Doña Mary y actualiza los totales");

  await postJson(state.baseUrl, `/api/customers/${encodeURIComponent(chuy.id)}/cash`, { amount: 20 });
  current = await requestJson(state.baseUrl, "/api/state");
  assert.equal(current.customers.find((customer) => customer.id === chuy.id)?.balance, 54.5, "Don Chuy debe quedar debiendo $54.50");
  check("el abono en efectivo baja el saldo de Don Chuy a $54.50");

  const reminder = await postJson(state.baseUrl, `/api/customers/${encodeURIComponent(lupita.id)}/reminder`, {});
  assert.ok(reminder.message?.includes("52.00"), "El recordatorio de Lupita debe mencionar $52.00");
  assert.equal(reminder.pushSent, true, "El recordatorio debe enviar el push demo");
  check("el recordatorio de Lupita incluye $52.00 y genera el push demo");

  const sale45 = await postJson(state.baseUrl, "/api/command", { text: "Cóbrame 45 de tortillas" });
  assert.equal(sale45.charge?.kind, "qr", "La venta de tortillas debe crear un QR");
  assert.equal(sale45.charge?.amount, 45, "La venta de tortillas debe ser por $45");
  check("el comando de mostrador crea un QR por $45");

  const photo = await postJson(state.baseUrl, "/api/photo", { image: "data:image/jpeg;base64,AAAA" });
  assert.equal(photo.entries?.length, 4, "La foto demo debe regresar cuatro apuntes");
  check("la foto de libreta regresa cuatro apuntes en modo demo");

  const cobroPage = await fetch(new URL(`/cobro/${encodeURIComponent(maryCommand.charge.id)}`, state.baseUrl));
  assert.equal(cobroPage.status, 200, "La página de un cobro existente debe responder 200");
  const missingCobroPage = await fetch(new URL("/cobro/nope", state.baseUrl));
  assert.equal(missingCobroPage.status, 404, "La página de un cobro inexistente debe responder 404");
  check("la página pública del cobro responde 200 y el cobro inexistente responde 404");

  const sale33 = await postJson(state.baseUrl, "/api/command", { text: "Cóbrame 33 de café" });
  assert.equal(sale33.charge?.kind, "qr", "La venta de café debe crear un QR para la prueba webhook");
  assert.equal(sale33.charge?.amount, 33, "El cobro de webhook debe ser por $33");

  const signedEvent = {
    type: "codi.qr.payment_received",
    amount: 33,
    transactionId: "tx_smoke_1",
    datePaid: Math.floor(Date.now() / 1000),
  };
  const rawBody = JSON.stringify(signedEvent);
  const webhookId = "wh_smoke_1";
  const webhookDate = new Date();
  const timestamp = Math.floor(webhookDate.getTime() / 1000);
  const signature = new Webhook(state.secret).sign(webhookId, webhookDate, rawBody);
  const webhookHeaders = {
    "webhook-id": webhookId,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": signature,
  };

  const unsignedResponse = await fetch(new URL("/webhooks/pey", state.baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: rawBody,
  });
  assert.equal(unsignedResponse.status, 401, "El webhook sin firma debe responder 401");

  const signedResult = await requestJson(state.baseUrl, "/webhooks/pey", {
    method: "POST",
    body: rawBody,
    headers: { "content-type": "application/json", ...webhookHeaders },
  });
  assert.match(String(signedResult.result || ""), /^pagado/i, "El webhook firmado debe marcar el cobro como pagado");

  const duplicateResult = await requestJson(state.baseUrl, "/webhooks/pey", {
    method: "POST",
    body: rawBody,
    headers: { "content-type": "application/json", ...webhookHeaders },
  });
  assert.match(String(duplicateResult.result || ""), /duplicado/i, "El webhook repetido debe detectarse como duplicado");

  const orphanEvent = { type: "codi.qr.payment_received", amount: 999, transactionId: "tx_smoke_orphan", datePaid: Math.floor(Date.now() / 1000) };
  const orphanBody = JSON.stringify(orphanEvent);
  const orphanId = "wh_smoke_orphan";
  const orphanDate = new Date();
  const orphanTimestamp = Math.floor(orphanDate.getTime() / 1000);
  const orphanSignature = new Webhook(state.secret).sign(orphanId, orphanDate, orphanBody);
  const orphanResult = await requestJson(state.baseUrl, "/webhooks/pey", {
    method: "POST",
    body: orphanBody,
    headers: {
      "content-type": "application/json",
      "webhook-id": orphanId,
      "webhook-timestamp": String(orphanTimestamp),
      "webhook-signature": orphanSignature,
    },
  });
  assert.match(String(orphanResult.result || ""), /sin asignar/i, "Un pago sin cobro debe quedar sin asignar");
  check("webhooks rechaza firmas faltantes, acepta pagos firmados, detecta duplicados y registra huérfanos");

  const qrWithoutMetadata = await postJson(state.baseUrl, "/api/command", { text: "Cóbrame 34 de pan" });
  const qrWithoutMetadataSaved = await chargeFromTemporaryDb(state, qrWithoutMetadata.charge.id);
  const qrWithoutMetadataResult = await sendSignedWebhook(state, {
    type: "codi.qr.payment_received",
    amount: qrWithoutMetadataSaved.chargedAmount,
    codiQrId: qrWithoutMetadataSaved.peyId,
    transactionId: "tx_smoke_qr_id_only",
    datePaid: Math.floor(Date.now() / 1000),
  }, "wh_smoke_qr_id_only");
  assert.match(String(qrWithoutMetadataResult.result || ""), /^pagado/i, "El QR debe casar por codiQrId sin metadata");

  const pn = await postJson(state.baseUrl, `/api/customers/${encodeURIComponent(lupita.id)}/charge`, { method: "push" });
  const pnResult = await sendSignedWebhook(state, {
    type: "codi.pn.payment_received",
    amount: (await chargeFromTemporaryDb(state, pn.charge.id)).chargedAmount,
    transactionId: "tx_smoke_pn_metadata",
    datePaid: Math.floor(Date.now() / 1000),
    metadata: { externalMetadata: { chargeId: pn.charge.id } },
  }, "wh_smoke_pn_metadata");
  assert.match(String(pnResult.result || ""), /^pagado/i, "El push debe casar con metadata.externalMetadata.chargeId");

  const link = await postJson(state.baseUrl, `/api/customers/${encodeURIComponent(lupita.id)}/charge`, { method: "link", amount: 18 });
  const linkResult = await sendSignedWebhook(state, {
    type: "payment_link.status_updated",
    status: "paid",
    clientReferenceId: link.charge.id,
    transactions: [{
      transactionId: "tx_smoke_link_client_ref",
      datePaid: Math.floor(Date.now() / 1000),
      amountBreakdown: { base: 18 },
    }],
  }, "wh_smoke_link_client_ref");
  assert.match(String(linkResult.result || ""), /^pagado/i, "El link debe casar por clientReferenceId y el monto base de la transacción");

  const firstTen = await postJson(state.baseUrl, "/api/command", { text: "Cóbrame 10 de pan" });
  const secondTen = await postJson(state.baseUrl, "/api/command", { text: "Cóbrame 10 de café" });
  const firstTenSaved = await chargeFromTemporaryDb(state, firstTen.charge.id);
  const firstTenEvent = {
    type: "codi.qr.payment_received",
    amount: firstTenSaved.chargedAmount,
    codiQrId: firstTenSaved.peyId,
    transactionId: "tx_smoke_same_transaction",
    datePaid: Math.floor(Date.now() / 1000),
  };
  const firstTenResult = await sendSignedWebhook(state, firstTenEvent, "wh_smoke_same_transaction_first");
  assert.match(String(firstTenResult.result || ""), /^pagado/i, "El primer cobro de $10 debe pagarse");
  const repeatedTransactionResult = await sendSignedWebhook(state, firstTenEvent, "wh_smoke_same_transaction_second");
  assert.match(String(repeatedTransactionResult.result || ""), /^ya pagado/i, "La misma transacción con otro webhook-id debe ser idempotente");
  const firstTenAfter = await requestJson(state.baseUrl, `/api/charges/${encodeURIComponent(firstTen.charge.id)}`);
  const secondTenAfter = await requestJson(state.baseUrl, `/api/charges/${encodeURIComponent(secondTen.charge.id)}`);
  assert.equal(firstTenAfter.charge?.status, "paid", "El primer cobro de $10 debe seguir pagado");
  assert.equal(secondTenAfter.charge?.status, "pending", "El segundo cobro de $10 debe seguir pendiente");
  check("QR, push y link casan por los identificadores de pey; un webhook repetido no paga otro cobro del mismo monto");

  const { cancelledCobroId } = await runMcpChecks(new URL("/mcp", state.baseUrl).href, { token: "" });
  check("smoke MCP verifica las siete herramientas, cancelar_cobro, espera inmediata y pagos de hoy");

  const cancelledCharge = await chargeFromTemporaryDb(state, cancelledCobroId);
  const paidAfterCancel = await sendSignedWebhook(state, {
    type: "codi.qr.payment_received",
    amount: cancelledCharge.chargedAmount,
    codiQrId: cancelledCharge.peyId,
    transactionId: "tx_smoke_paid_after_cancel",
    datePaid: Math.floor(Date.now() / 1000),
  }, "wh_smoke_paid_after_cancel");
  assert.match(String(paidAfterCancel.result || ""), /^pagado/i, "El pago recibido después de cancelar debe registrarse");
  const paidAfterCancelState = await requestJson(state.baseUrl, `/api/charges/${encodeURIComponent(cancelledCobroId)}`);
  assert.equal(paidAfterCancelState.charge?.status, "paid", "El pago debe cambiar el cobro cancelado a paid");
  check("un webhook válido registra el pago aunque el cobro se hubiera cancelado en Cóbrale");

  const tests = findTests(path.join(projectRoot, "src"));
  if (tests.length) {
    const unitTests = spawnSync(process.execPath, ["--test", ...tests], {
      cwd: projectRoot,
      stdio: "inherit",
      env: serverEnv,
      timeout: 60_000,
    });
    assert.equal(unitTests.status, 0, `Fallaron las pruebas unitarias de src/${unitTests.error?.message || "revisa la salida anterior"}`);
    check(`pasaron ${tests.length} archivo(s) de pruebas unitarias`);
  } else {
    check("no hay pruebas unitarias en src/ para ejecutar");
  }
}

async function main() {
  const startedAt = Date.now();
  const state = { server: null, serverOutput: "", serverError: null, tempDir: null };
  let timeout;
  try {
    await Promise.race([
      runChecks(state),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("npm test excedió el límite de 90 segundos")), 90_000);
      }),
    ]);
    console.log(`✅ smoke OK (${((Date.now() - startedAt) / 1000).toFixed(1)} s)`);
  } catch (error) {
    console.error(`❌ smoke falló: ${error.stack || error.message || error}`);
    if (state.serverError) console.error(`Error al iniciar el server: ${state.serverError.message}`);
    if (state.serverOutput.trim()) console.error(`Salida del server de prueba:\n${state.serverOutput.trim()}`);
    process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
    await stopServer(state.server);
    if (state.tempDir) rmSync(state.tempDir, { recursive: true, force: true });
  }
}

await main();
