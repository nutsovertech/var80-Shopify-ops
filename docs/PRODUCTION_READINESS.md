# Var80 Store Ops production readiness

## Verified locally

- Embedded React Router app typechecks and builds for production.
- Shopify OAuth/session handling uses the official React Router library and App Bridge provider.
- Admin operations use GraphQL, not the legacy REST Admin API.
- App scopes are limited to product reads/writes and order reads.
- Mandatory uninstall and privacy webhook routes are present.
- The authoritative `gateway/` package passes all 18 security, tenant-isolation, OAuth, token-refresh, MCP, webhook, retry, redaction, write-gate, and embedded-integration tests.
- The embedded app uses a private authenticated server-to-server API to synchronize Shopify sessions and manage the gateway registry. Prisma is used only for Shopify session storage.
- Repository scan found no committed Shopify access token, private key, generated client key, or generated bot key.
- Shopify App Security 5.0.1 / ruleset 5.0.1 reports no active deterministic or semantic findings after replacing four unsafe HTML assignments in the gateway console. All 35 detected files were scanned with no coverage gaps.

## Production blockers

1. **Set the production HTTPS origins.** Replace development/example URLs, configure TLS, reverse-proxy limits, trusted forwarding, and receiver hostname allowlisting.
2. **Install the Compose project with durable volumes and backups.** Packaging now persists Shopify sessions and encrypted gateway data, but the actual VPS backup/restore job must be configured and tested.
3. **Complete Shopify configuration validation and security review** against the final linked production app before releasing a version.
4. **Decide whether the app is free.** If merchants are charged, use Shopify App Pricing or the Billing API; no billing implementation is currently present.
5. **Complete listing and operational material.** Privacy policy, terms, support URL, incident response, privacy fulfillment, backup redaction, and external bot-system deletion remain human/operational requirements.

`npm audit --omit=dev` now reports zero high or critical findings. Two moderate findings remain in `@react-router/fs-routes` through `minimatch`; npm reports no compatible fix. Forcing minimatch 11 breaks React Router route generation, so this development-tool advisory is documented pending an upstream React Router release.

## App Store self-review snapshot

Likely passing from local evidence:

- Session-token-compatible embedded authentication
- No external checkout, payment gateway, theme download, lending, marketplace, refund, advertising, or fabricated-sales behavior
- Shopify GraphQL Admin API usage
- Current App Bridge integration
- OAuth on install/reinstall and post-authenticated embedded UI
- No legacy REST Admin API operations
- No unnecessary restricted scopes detected

Needs human or deployed-environment review:

- Valid production TLS certificate and HTTPS redirects
- Public distribution and final Dev Dashboard version
- Pricing/free-app decision
- Privacy, terms, support, listing accuracy, and protected-data declarations
- Two-store live isolation, live webhook delivery, retry/deduplication, token refresh, uninstall, and compliance acceptance

Skipped as not applicable: theme app extension, payment app, payment facilitator, purchase options, product sourcing, checkout customization, sales channel, post-purchase, mobile app builder, and donation groups.

## Release gate

Run `npm run verify` and require a clean result. Then validate the final linked Shopify configuration and run Shopify's app security review. Do not deploy or issue production credentials while any blocker above remains open.
