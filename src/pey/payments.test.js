import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Importar payments carga el store; usa una carpeta temporal para no leer ni escribir data/.
const previousDataDir = process.env.DATA_DIR;
const temporaryDataDir = mkdtempSync(path.join(os.tmpdir(), "cobrale-payments-test-"));
process.env.DATA_DIR = temporaryDataDir;
const { txToEvent } = await import("./payments.js");

after(() => {
  rmSync(temporaryDataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
});

test("txToEvent convierte transacciones QR de pey", () => {
  const event = txToEvent({
    id: "tx-qr-1",
    status: "PAID",
    amount: 125,
    amountBreakdown: { base: 123 },
    payableType: "API_CODI_QR",
    payableId: "qr-123",
    description: "Venta de prueba",
    datePaid: 1_800_000_000,
    metadata: { reference: "R-1" },
  });

  assert.deepEqual(event, {
    type: "codi.qr.payment_received",
    status: "paid",
    amount: 123,
    transactionId: "tx-qr-1",
    datePaid: 1_800_000_000,
    metadata: { reference: "R-1" },
    concept: "Venta de prueba",
    payableId: "qr-123",
    codiQrId: "qr-123",
  });
});

test("txToEvent convierte transacciones CoDi por celular", () => {
  const event = txToEvent({
    id: "tx-pn-id",
    transactionId: "tx-pn-1",
    status: "PENDING",
    amount: 52,
    payableType: "API_CODI_PN",
    payableId: "codi-456",
    description: "Cuenta Lupita",
    metadata: { externalMetadata: { chargeId: "cob_1" } },
  });

  assert.deepEqual(event, {
    type: "codi.pn.payment_received",
    status: "pending",
    amount: 52,
    transactionId: "tx-pn-1",
    datePaid: undefined,
    metadata: { externalMetadata: { chargeId: "cob_1" } },
    concept: "Cuenta Lupita",
    payableId: "codi-456",
  });
});

test("txToEvent convierte transacciones de links de pago", () => {
  const event = txToEvent({
    id: "tx-link-1",
    status: "PENDING",
    amount: 21,
    payableType: "PAYMENT_LINK",
    payableId: "link-789",
    description: "Compra",
    metadata: {},
  });

  assert.deepEqual(event, {
    type: "payment_link.status_updated",
    status: "pending",
    amount: 21,
    transactionId: "tx-link-1",
    datePaid: undefined,
    metadata: {},
    concept: "Compra",
    payableId: "link-789",
    paymentLinkId: "link-789",
  });
});
