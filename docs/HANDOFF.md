# Public app and console handoff

## Implementation decisions

- Brand: **Var80 Store Ops**; AI clients connect behind this Shopify-facing identity.
- One public Shopify registration and one VPS service, with separate authorization on every merchant store.
- Non-embedded Shopify app. Separate standalone admin and client views.
- Persistent client/store/bot registry; changes apply immediately.
- Per-store tool and write permissions, independent inbound bot keys, and optional outgoing webhook routes.
- No OpenAI API key is needed: agents call the service, which does not call a model.

## Balbir: code and development-store acceptance

1. Pull the changes, configure `.env`, and run `npm test`.
2. Create a public registration if the old registration selected custom distribution. Set URLs, scopes and webhooks using the TOML example; release the configuration.
3. On a Shopify development store, create its client/store in `/admin`, complete merchant authorization and confirm actual granted scopes.
4. Register a test bot, grant that store only, and test reads plus a product preview. Then enable global/store/bot writes, apply one reversible update, verify in Shopify and restore it.
5. Repeat with a second client/store. Verify that the first client's key and bot grants cannot access the second store.
6. Configure a real bot receiver with the documented bearer/HMAC/payload contract. Validate delivery, timeout, retries and event deduplication.
7. Test token refresh, reconnect, uninstall, signed Shopify launch and mandatory compliance deliveries. Complete privacy tasks outside the service before recording resolution.

## Saurav: VPS and production release

Deploy one supervised process behind HTTPS with persistent storage, secure environment configuration and receiver hostname allowlisting. Complete Shopify listing/privacy/support requirements and review. Use limited listing visibility if direct-link distribution is preferred after approval.

Install separately on each authorized merchant store. Issue client and bot keys securely. Do not put credentials into GitHub or chat transcripts. ChatGPT connector authentication is separate from Shopify OAuth and must be implemented/configured for the chosen client environment.

## Pending external work

This commit does not register/approve a Shopify app, deploy a VPS, connect a live store or configure a live Grok/ChatGPT client. Local tests mock Shopify. Tool audits are server-side files; the UI shows event delivery activity. Queue/audit retention, backup handling and privacy fulfillment in external bot systems remain operational responsibilities.
