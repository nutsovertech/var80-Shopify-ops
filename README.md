# Var80 Store Ops

A multi-client Shopify integration with an **admin console**, **client portal**, API/MCP gateway and persistent store-to-bot webhook relay. Run one VPS service with one public Shopify app registration. Each store still installs and authorizes **Var80 Store Ops** separately.

## Status and interfaces

The code is implemented and locally tested with mocked Shopify responses. App registration/review, VPS deployment, live-store validation and external bot connections remain separate tasks. The Shopify app is **non-embedded**; both interfaces run on your own domain.

| Interface | Access | Functions |
| --- | --- | --- |
| /admin | Operator key | Clients, stores, bot registration/keys, per-store tools/writes, event routes, delivery retries, privacy cases |
| /client | Client portal key | Own stores/bots only; add/connect/reconnect/pause stores; control store writes; own delivery status |
| /mcp | Bot bearer key | Stateless Streamable HTTP tool calls |
| /v1/tools and /v1/call | Bot bearer key | REST tool discovery and execution |
| /webhooks | Shopify HMAC | Operational events and uninstall |
| /webhooks/compliance | Shopify HMAC | Public-app compliance topics |

Registry changes persist immediately without a restart. Pausing a client/store/bot blocks subsequent calls. Already-running upstream requests cannot be recalled. Store ownership cannot be reassigned through the console.

## Run on your VPS

Node.js 22+; no package dependencies or frontend build.

```sh
cp .env.example .env
# Set secrets and APP_URL, then:
npm test
npm start
```

Set Shopify client ID/secret, a 32-byte encryption key as 64 hex characters, and a random operator key of at least 32 characters. Generate secrets securely and never commit .env. Open /admin and sign in with OPERATOR_TOKEN.

1. Create a client; enroll its permanent myshopify.com hostname.
2. Generate a connection link and have the merchant approve it in Shopify.
3. Register a bot and securely save its key shown once.
4. Configure tools, execution permission and event topics separately on each store assignment.
5. Issue a client portal key if required. Rotation revokes its previous key and existing client sessions.
6. Configure WEBHOOK_ALLOWED_HOSTS on the server before adding bot receivers. Network-policy changes require a restart.

ENABLE_PRODUCT_WRITES is the global kill switch. Actual product execution also requires the store write switch, bot/store write grant, product_update permission and dry_run:false. A tool granted on one store is never implicitly granted on another.

Run one supervised process behind HTTPS with persistent writable DATA_DIR, reverse-proxy request/rate limits and access logs that omit query strings, credentials, cookies and bodies. Docker includes src/ and web/; mount /app/data owned by UID 1000. Horizontal scaling requires transactional shared storage, OAuth/session storage and distributed refresh locking.

## Public Shopify registration

Create Var80 Store Ops in a Partner organization and select Public distribution. Shopify does not allow changing a previously selected distribution method; if your existing registration selected Custom, create a new public registration. GitHub visibility is unrelated.

Use shopify.app.toml.example for the application URL, exact /auth/callback redirect, scopes and webhook subscriptions. Distribution is selected in Shopify, not via a TOML flag. Release the configuration.

This is managed-client enrollment: add a store in the console before giving its merchant the installation link. A signed Shopify launch for an enrolled, disconnected store begins OAuth; a connected store opens the client portal login. Unknown stores get an enrollment message.

Public distribution requires Shopify approval for unrelated live stores. An approved app can use limited listing visibility and direct installation links. Every store still authorizes independently. Complete the applicable listing, support/privacy URLs, protected-data declarations and review requirements before production distribution. This repository is not an approved App Store submission.

Official references:
- https://shopify.dev/docs/apps/launch/distribution
- https://shopify.dev/docs/apps/launch/distribution/visibility
- https://shopify.dev/docs/apps/launch/app-store-review/review-process
- https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps
- https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance

## Tools and agent connection

| Tool | Implemented behavior |
| --- | --- |
| shop_info | Store identity, currency and timezone |
| products_list | Products, descriptions and SEO with pagination |
| orders_list | Order status/totals without customer identity fields |
| inventory_list | Item ID, SKU and tracking status |
| product_update | Product title, description HTML and SEO; preview by default |

Price/inventory adjustments, refunds, deletion, order writes and arbitrary GraphQL are not implemented. Shopify history limits and protected-data requirements still apply. Adding bot grants cannot exceed merchant-approved Shopify scopes. Scope changes require a released configuration and merchant reapproval.

Connect compatible remote agents to https://YOUR_HOST/mcp with Authorization: Bearer BOT_KEY. Stateless JSON responses over HTTP POST are supported; SSE subscriptions, resumability and sessions are not.

Cursor/stdio clients can run src/mcp.mjs with STORE_OPS_URL and STORE_OPS_AGENT_TOKEN injected through client secret storage:

```json
{"mcpServers":{"var80-store-ops":{"command":"node","args":["/ABSOLUTE/PATH/var80-Shopify-ops/src/mcp.mjs"],"env":{"STORE_OPS_URL":"https://YOUR_HOST","STORE_OPS_AGENT_TOKEN":"INJECT_FROM_SECRET_STORAGE"}}}}
```

REST execution body:

```json
{"name":"product_update","arguments":{"shop":"your-store.myshopify.com","product_id":"gid://shopify/Product/123","title":"Proposed title","dry_run":true}}
```

Grok agents can use these interfaces if their environment supports bearer authentication. Test actual compatibility. **An OpenAI API key does not connect ChatGPT.** The service does not call AI models. ChatGPT needs its own supported connector/action authentication, and this app does not implement an OAuth authorization server for ChatGPT.

## Webhook event routing

Agents pull through MCP/API. Events travel Shopify → Var80 Store Ops → configured bot routine.

Supported topics: orders/create, orders/updated, products/update and inventory_levels/update. Select them in both the Shopify subscription configuration and bot/store grants. Every event is deduplicated per Shopify event ID and bot. Payloads contain event_id, shop, topic and resource_id only; bots fetch additional permitted data through the gateway.

Receivers get Authorization: Bearer WEBHOOK_SECRET, X-Var80-Event-Id and X-Var80-Signature: sha256=HMAC_HEX over the exact JSON body. Adapt actual Grok receivers to this contract where needed. The outbound receiver secret is separate from the bot's inbound API/MCP key.

Destinations require HTTPS, port 443 and exact server-allowlisted hostnames. URL credentials/query strings/fragments, redirects and private DNS destinations are rejected. DNS answers are validated and pinned to each outbound request.

The queue persists and drains every five seconds, with up to five attempts and exponential delay. Failed deliveries can be manually retried. Receivers must deduplicate event_id because a timeout can occur after processing. Paused/revoked grants cancel pending deliveries on processing. The queue's configured payload format has not been tested against a live Grok routine.

## Privacy and uninstall

All webhook mutations require Shopify HMAC. Uninstall revokes usable tokens and cancels pending events. shop/redact deletes local store tokens, enrollment, grants, deliveries and privacy cases. customers/redact removes that shop's delivery metadata and scrubs prior customer-request identifiers. customers/data_request keeps only request/customer/order identifiers in the encrypted registry.

Compliance requests appear as pending admin cases. View their details, finish required export/communication/downstream deletion, then record a resolution note. An HTTP acknowledgment is not privacy fulfillment. External bot systems and backups require operator handling. No public-app compliance approval is claimed.

## Management API and authentication

All management routes accept operator/client bearer keys or HttpOnly console sessions. Cookie-based mutations require X-CSRF-Token. Cross-origin requests are rejected. Login is rate-limited per direct peer IP; add proxy-level limits. Tokens never enter localStorage.

| Route | Permission |
| --- | --- |
| POST /api/login, POST /api/logout | Console session lifecycle |
| GET /api/overview | Role-scoped, credentials omitted |
| POST /api/clients, PATCH /api/clients/:id | Admin |
| POST /api/clients/:id/portal-key | Admin; issue/rotate |
| POST /api/stores | Admin or own client |
| PATCH /api/stores/:shop | Admin or owning client |
| POST /api/stores/:shop/install-link | Admin or owning client |
| POST /api/bots, PATCH /api/bots/:id | Admin |
| POST /api/bots/:id/rotate-key | Admin |
| POST /api/deliveries/:id/retry | Admin |
| GET /api/compliance/:id | Admin |
| POST /api/compliance/:id/complete | Admin; resolution note required |

Authorized chat/gateway integrations may use these endpoints; this conversation is not automatically connected.

## Persistence, migration and boundaries

registry.enc holds encrypted clients, stores, bot grants, webhook secrets and queues. Per-store encrypted files hold Shopify tokens. Client/bot keys are hashed; the raw keys are shown only when issued. Back up the encryption key separately and protect the host/backups.

Legacy ALLOWED_SHOPS and AGENTS_JSON import once into an Existing stores client only when no registry exists. Existing encrypted Shopify token files remain readable. Further registry edits come through the console/API. In-memory console/OAuth sessions end on restart; registry and queue records survive. Keep one process/replica.

audit.jsonl records configuration/tool metadata and mutation hashes; the console displays event-delivery status, not historical tool audit files. Mutation responses include before/after values, but this is not a full rollback archive. On write timeout, read the product before retrying. Queue/audit retention requires an operator policy; records remain until redaction or approved maintenance cleanup.

Tests cover tenant isolation, store/tool/write boundaries, key revocation, CSRF, OAuth validation, encrypted persistence, event retries/deduplication, receiver restrictions and compliance processing. Live Shopify, VPS and bot-receiver acceptance remain pending.
