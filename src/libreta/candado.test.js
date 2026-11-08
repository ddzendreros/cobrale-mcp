import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

process.env.ADMIN_TOKEN = "t0k";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "cobrale-"));
const testDataDir = process.env.DATA_DIR;
const { router } = await import("./routes.js");

test("ADMIN_TOKEN limita escrituras y mantiene abierto el estado", async () => {
  const app = express();
  app.use(router);
  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", resolve);
  });

  try {
    const { port } = server.address();
    const origin = `http://127.0.0.1:${port}`;
    const denied = await fetch(`${origin}/api/demo/seed`, { method: "POST" });
    assert.equal(denied.status, 401);
    assert.deepEqual(await denied.json(), { message: "Modo solo lectura: falta el token de admin" });

    const allowed = await fetch(`${origin}/api/demo/seed`, {
      method: "POST",
      headers: { "x-admin-token": "t0k" },
    });
    assert.equal(allowed.status, 200);

    const stateResponse = await fetch(`${origin}/api/state`);
    assert.equal(stateResponse.status, 200);
    const state = await stateResponse.json();
    assert.equal(state.mode.locked, true);
    assert.equal(JSON.stringify(state).includes("t0k"), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => setTimeout(resolve, 80));
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
});
