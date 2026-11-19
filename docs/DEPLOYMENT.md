# Production deployment

Var80 Store Ops runs as one Compose project with two supervised services: the embedded Shopify app and the authoritative gateway. Both listen only on VPS loopback; the HTTPS reverse proxy is the sole public entry point.

## Required DNS and HTTPS routes

- `SHOPIFY_APP_URL` routes to `127.0.0.1:3000` (embedded app).
- `GATEWAY_APP_URL` routes to `127.0.0.1:3001` (MCP, REST, admin/client consoles and gateway OAuth callback).
- Both origins require valid TLS certificates and HTTP-to-HTTPS redirects.

In Shopify configuration, use `${SHOPIFY_APP_URL}` as the app URL, `${SHOPIFY_APP_URL}/auth/callback` as the embedded redirect URL, and `${GATEWAY_APP_URL}/auth/callback` as an additional redirect URL if gateway-generated install links are used.

## Secret configuration

Create a VPS-only `.env` next to `compose.production.yml`. Never commit it. Required values are:

- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`
- `SHOPIFY_APP_URL`, `GATEWAY_APP_URL`
- `TOKEN_ENCRYPTION_KEY`: 32 random bytes encoded as 64 hexadecimal characters
- `OPERATOR_TOKEN`: at least 32 random characters
- `INTERNAL_API_TOKEN`: at least 32 random characters and different from the operator token
- `WEBHOOK_ALLOWED_HOSTS`: exact comma-separated receiver hostnames
- `ENABLE_PRODUCT_WRITES=false` for the initial release

## Release commands

```text
docker compose -f compose.production.yml build --pull
docker compose -f compose.production.yml up -d
docker compose -f compose.production.yml ps
docker compose -f compose.production.yml logs --tail=200 app gateway
```

Back up both named volumes before upgrades. The gateway encryption key must be backed up separately; encrypted data cannot be recovered without it. Start with one gateway replica because its encrypted registry uses local file serialization.

## Acceptance gate

Install on two development stores. Confirm embedded launch, bot isolation, read tools, product preview, gated reversible write, webhook signature/retry/deduplication, uninstall/reinstall, token refresh, and all mandatory compliance deliveries before enabling production writes.
