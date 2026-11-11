# Var80 Store Ops

Backend-only Shopify app service for Var80. No dashboard, merchant configuration screens, or frontend build. Configuration lives in environment secrets and source-controlled examples. Shopify merchants still approve installation and requested scopes on Shopify's own authorization screen.

## Status

Implemented and locally tested: standalone merchant OAuth, encrypted per-store offline tokens, expiring-token refresh, authenticated REST tools, stateless HTTP MCP, stdio MCP bridge, and signed uninstall handling. This repository does **not** register an app in Shopify, create Shopify credentials, install on a merchant store, or deploy a running service. Live Shopify API behavior must be validated on a development store before production use.

## Supported operations

| Tool | Behavior |
| --- | --- |
| `shop_info` | Store identity, currency and timezone |
| `products_list` | Products, descriptions and SEO fields; cursor pagination |
| `orders_list` | Order status and totals; excludes customer identity fields |
| `inventory_list` | Inventory item IDs, SKU and tracking status |
| `product_update` | Product title, description HTML and SEO; dry run by default |

Product execution requires `ENABLE_PRODUCT_WRITES=true`, agent permission for `product_update`, and `dry_run:false` on the individual call. Price changes, inventory adjustments, refunds, deletion, order writes and arbitrary GraphQL execution are not implemented. Add each operation deliberately in `src/core.mjs` with corresponding scopes and tests.

## Run

Requires Node.js 22+. No third-party runtime dependencies or install step.

```sh
cp .env.example .env
# Configure .env with real values, then:
npm test
npm start
```

Generate the encryption key and operator/agent tokens with a password manager or Node's `crypto.randomBytes`. Use at least 32 random bytes per token. Store raw agent tokens only in the relevant agent's secret environment; put their SHA-256 hex digests in `AGENTS_JSON`. Operator and agent credentials must be distinct.

The server binds to localhost by default. Place it behind an HTTPS reverse proxy with request limits, rate limiting, and access logs that omit query strings, bodies, cookies, and authorization headers. For a container set `HOST=0.0.0.0`, pass secrets through the hosting environment, and mount a writable persistent volume at `/app/data` owned by container user `node` (UID 1000).

Run **one backend process/replica**. Encrypted file storage, refresh coordination and pending OAuth state are designed for a single instance. Do not use ephemeral/serverless filesystems. For multiple replicas, migrate the vault and OAuth state to a transactional database with refresh locking. A process restart expires unfinished installation links; request another link.

## Register in Shopify

1. In Shopify Dev Dashboard, create **Var80 Store Ops**, owned by the appropriate business account.
2. Choose the distribution appropriate to the target store. Custom distribution targets one store or stores within one eligible Plus organization. Unrelated merchant stores require separate custom app registrations or the public-distribution route with Shopify approval. Use a separate deployment/configuration per app registration in this implementation.
3. Configure the app as non-embedded with application URL `https://YOUR_BACKEND_HOST` and exact redirect URL `https://YOUR_BACKEND_HOST/auth/callback`.
4. Request `read_products,write_products,read_orders,read_inventory` (or the smaller set your configured tools need). Release the app version and configure the install/distribution link as required by Shopify.
5. Subscribe to `app/uninstalled` at `https://YOUR_BACKEND_HOST/webhooks`. `shopify.app.toml.example` provides the equivalent CLI configuration; copy it and replace placeholders if using Shopify CLI.
6. Put the real client ID, client secret, host origin, exact store allowlist, encryption key and agent policies in the backend's environment.
7. Start merchant authorization using the operator endpoint below, then open the returned single-use URL in the installing merchant's browser. Merchant approval and a valid callback complete token storage. Shopify's distribution/install flow must permit this app on that store.

This implementation uses authorization-code exchange for client stores. It does not implement the own-organization client-credentials grant. It requests expiring offline tokens and refreshes when needed. Orders remain subject to Shopify history restrictions and protected-data requirements. Public distribution additionally requires the applicable Shopify review/privacy/compliance work; this starter is not an App Store submission package.

Official references:
- https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps
- https://shopify.dev/docs/apps/launch/distribution
- https://shopify.dev/docs/api/usage/access-scopes

## Operator installation API

With `OPERATOR_TOKEN` exported securely in your terminal:

```sh
curl --fail-with-body https://YOUR_BACKEND_HOST/operator/install-link \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"shop":"YOUR_STORE.myshopify.com"}'
```

The returned `install_url` expires after ten minutes and is single-use. Treat it as sensitive. Opening it sets an HttpOnly state cookie, then redirects to Shopify. The callback validates HMAC, store, timestamp, nonce and browser cookie before exchanging the code. Backend secrets are never returned to the merchant or AI client.

## Agent REST API

`GET /v1/tools` lists tools permitted for the bearer identity. `POST /v1/call` accepts:

```json
{
  "name": "product_update",
  "arguments": {
    "shop": "YOUR_STORE.myshopify.com",
    "product_id": "gid://shopify/Product/123",
    "title": "Proposed title",
    "dry_run": true
  }
}
```

Send `Authorization: Bearer AGENT_TOKEN`. Each agent is independently restricted to the exact stores and tools in `AGENTS_JSON`. Review the returned preview before explicit execution. A timeout on a write may mean the result is unknown; read the product and consult its operation ID before retrying. Mutations are not automatically retried.

## MCP clients

### Remote clients that support bearer authentication

Connect to `https://YOUR_BACKEND_HOST/mcp` using Streamable HTTP POST and a bearer token. The server is stateless and returns JSON responses. GET/SSE subscriptions, sessions and resumability are not provided. Tools run under the same backend permissions as REST calls.

### Cursor or another stdio client

Configure an MCP server using the absolute path of `src/mcp.mjs` on the machine running the client:

```json
{
  "mcpServers": {
    "var80-store-ops": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/var80-Shopify-ops/src/mcp.mjs"],
      "env": {
        "STORE_OPS_URL": "https://YOUR_BACKEND_HOST",
        "STORE_OPS_AGENT_TOKEN": "INJECT_FROM_CLIENT_SECRET_STORAGE"
      }
    }
  }
}
```

Do not commit the client configuration containing a raw token. The bridge speaks newline-delimited JSON-RPC over stdio and makes HTTPS requests to the backend; it does not hold Shopify credentials.

### ChatGPT

The backend is not automatically connected to this conversation. A ChatGPT connection requires a supported custom MCP connector/action and compatible authentication in that environment. This repository provides bearer authentication only; it does not provide an OAuth authorization server for ChatGPT or dynamic client registration. If the target ChatGPT connection requires OAuth, add that authentication layer before claiming ChatGPT connectivity. Shopify merchant OAuth and AI-client authentication are separate systems.

## Storage and operations

Tokens are AES-256-GCM encrypted and bound to the store hostname. Keep the encryption key backed up separately from the persistent data volume. Changing it without migrating encrypted records makes existing connections unreadable. Files have restrictive creation permissions; protect the host and backups too.

`data/audit.jsonl` records agent identity, store, tool and product mutation intent/result hashes, not access tokens or full customer/product payloads. Mutation responses include before/after values for the caller; the local audit is not a full rollback archive. Apply your own retention and centralized log policy. Signed uninstall events remove usable tokens. Rotate/revoke individual agent access through secret configuration and restart the service.

## Verification

`npm test` exercises authorization isolation, hostname validation, ciphertext protection, dry-run/write policy, HTTP origin checks, OAuth rejection paths, signed uninstall, concurrent token refresh, stdio protocol handling and remote MCP tool permissions. Shopify calls are mocked; no live store is modified by tests.
