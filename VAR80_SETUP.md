# Var80 Store Ops setup

This project is an embedded public Shopify app built with the official React Router template.

## Local configuration

1. Copy `.env.example` to `.env` and add the app credentials from the Shopify Dev Dashboard.
2. Link the project to the intended Shopify organization with `npm run config:link`.
3. Run `npm install`, `npm run setup`, and `npm test`.
4. Start a development session with `npm run dev` and install it on a development store.

Do not commit `.env`, client keys, bot keys, webhook secrets, or access tokens. Client and bot bearer keys are displayed once and only their SHA-256 hashes are stored. Shopify access tokens remain in the Prisma session store.

## Write authorization

A write is permitted only when all applicable gates are enabled: client, store, bot, and bot-to-store grant. Tool allowlists are stored independently for the store and each bot grant. Enforcement must also be applied in every external tool endpoint before production release.

## Production notes

SQLite is suitable for local development only. Configure a durable production database and supervised HTTPS deployment for the VPS release. Add receiver-host allowlisting, delivery retries, event deduplication, retention, backups, and the external bot tool API before production approval.

## Agent gateway

The hardened MCP/REST gateway imported from the existing repository is in `gateway/`. It includes encrypted persistence, tenant-isolated bot grants, product previews and guarded writes, webhook delivery retries, compliance cases, and its own test suite.

Run the full monorepo verification with `npm run verify`. For local gateway testing, copy `gateway/.env.example` to `gateway/.env`, add development-only secrets, and run `npm run gateway:start`. Never reuse development secrets in production.

The embedded app and gateway currently retain separate registries and Shopify token stores. Before production, choose one authoritative registry and connect the embedded management UI to the gateway management API; do not issue production keys from both systems.
