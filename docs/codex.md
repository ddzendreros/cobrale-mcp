# Conectar Cóbrale MCP a Codex (y a cualquier agente)

El servidor expone el MCP en `http://localhost:3000/mcp` (Streamable HTTP, stateless). Si definiste `PEY_MCP_TOKEN`, manda `Authorization: Bearer <token>`.

## Codex CLI / IDE

Opción A, por comando:

```bash
codex mcp add cobrale --url http://localhost:3000/mcp
```

Opción B, en `~/.codex/config.toml`:

```toml
[mcp_servers.cobrale]
url = "http://localhost:3000/mcp"
# bearer_token_env_var = "PEY_MCP_TOKEN"   # si usas token
tool_timeout_sec = 300                      # esperar_pago puede tardar
```

Si tu versión de Codex no acepta `url`, usa el puente stdio:

```toml
[mcp_servers.cobrale]
command = "npx"
args = ["-y", "mcp-remote", "http://localhost:3000/mcp"]
tool_timeout_sec = 300
```

Verifica con `/mcp` dentro de Codex: deben aparecer 6 herramientas.

Prompt de demo:

> Cóbrale $0.01 al 55XXXXXXXX por la factura FAC-001 y avísame en cuanto pague.

## OpenAI Responses API (agente de empresa)

Ver `examples/agente-empresa/agente.js`. Necesita `PUBLIC_URL` https:

```js
tools: [{ type: "mcp", server_label: "cobrale", server_url: `${PUBLIC_URL}/mcp`, require_approval: "never" }]
```

## Claude Desktop / otros clientes MCP

Cualquier cliente con Streamable HTTP apunta a `/mcp`. Para clientes solo-stdio: `npx -y mcp-remote http://localhost:3000/mcp`.

## Herramientas

| Herramienta | Para qué |
|---|---|
| `cobrar_con_qr` | QR CoDi (regresa imagen + página `/cobro/:id` con estado en vivo) |
| `cobrar_a_celular` | Solicitud push a la app bancaria del celular (10 dígitos) |
| `crear_link_de_pago` | Checkout de pey para WhatsApp/correo |
| `esperar_pago` | Bloquea hasta que llega el webhook de pago (máx. 280 s por llamada) |
| `estado_del_cobro` | pending / paid / superseded |
| `pagos_recibidos` | Pagos de la ventana de tiempo, para conciliar |
