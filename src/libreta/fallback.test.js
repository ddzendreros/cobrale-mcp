import test from "node:test";
import assert from "node:assert/strict";
import { localParseCommand } from "./fallback.js";

const KNOWN = ["Doña Mary", "Don Chuy", "Lupita"];
const EXAMPLES = [
  ["Apúntale 85 a Doña Mary de 2 cocas y un pan", "add_debt", "Doña Mary", 85],
  ["Don Chuy se llevó cigarros de 74.50", "add_debt", "Don Chuy", 74.5],
  ["Cóbrale a Doña Mary", "charge", "Doña Mary", null],
  ["Mándale el cobro a Lupita a su cel", "charge", "Lupita", null],
  ["Lupita me abonó 20", "cash_payment", "Lupita", 20],
  ["El cel de Don Chuy es 5511223344", "set_phone", "Don Chuy", null],
  ["Cóbrame 45 de tortillas", "sale", null, 45],
];

for (const [text, type, customer, amount] of EXAMPLES) {
  test("interpreta el ejemplo: " + text, () => {
    const action = localParseCommand(text, KNOWN).actions[0];
    assert.ok(action);
    assert.equal(action.type, type);
    assert.equal(action.customer, customer);
    assert.equal(action.amount, amount);
  });
}

test("reconoce clientes registrados aunque el dictado venga en minúsculas", () => {
  const action = localParseCommand("cobrale a doña mary", KNOWN).actions[0];
  assert.equal(action.type, "charge");
  assert.equal(action.customer, "Doña Mary");
  assert.equal(action.method, "qr");
});

test("si coinciden varios clientes, elige el nombre normalizado más largo", () => {
  const action = localParseCommand("apuntale 10 a lupita de la rosa", ["Lupita", "Lupita de la Rosa"]).actions[0];
  assert.equal(action.customer, "Lupita de la Rosa");
});

test("apunta una deuda a un cliente conocido con el nombre registrado", () => {
  const action = localParseCommand("apuntale 50 a lupita de leche", KNOWN).actions[0];
  assert.equal(action.type, "add_debt");
  assert.equal(action.customer, "Lupita");
  assert.equal(action.amount, 50);
});

test("manda el cobro al celular del cliente conocido", () => {
  const action = localParseCommand("mandale el cobro a don chuy a su cel", KNOWN).actions[0];
  assert.equal(action.type, "charge");
  assert.equal(action.customer, "Don Chuy");
  assert.equal(action.method, "push");
});

test("anota un pago total sin inventar un monto", () => {
  const action = localParseCommand("doña mary pagó todo", KNOWN).actions[0];
  assert.equal(action.type, "cash_payment");
  assert.equal(action.customer, "Doña Mary");
  assert.equal(action.amount, null);
});

test("interpreta cóbrame como venta de mostrador", () => {
  const action = localParseCommand("cóbrame 45 de tortillas", KNOWN).actions[0];
  assert.equal(action.type, "sale");
  assert.equal(action.customer, null);
  assert.equal(action.amount, 45);
});

test("sin clientes conocidos no confunde el verbo con el nombre", () => {
  const action = localParseCommand("cobrale a doña mary").actions[0];
  assert.ok(action);
  assert.notEqual(action.customer, "cobrale");
});

test("parseCommand pasa los clientes registrados al parser local", async () => {
  process.env.OPENAI_API_KEY = "";
  const { parseCommand } = await import("./ai.js");
  const parsed = await parseCommand("cobrale a doña mary", ["Doña Mary"]);
  assert.equal(parsed.ai, false);
  assert.equal(parsed.actions[0].customer, "Doña Mary");
});
