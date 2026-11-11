import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { config, hash, Vault, shopHost, authorize, validate, execute, createShopify } from '../src/core.mjs';
import { app } from '../src/server.mjs';
const shop = 'test-store.myshopify.com', token = 'agent-test-token-with-sufficient-entropy';
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'var80-test-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const cfg = config({ APP_URL: 'http://127.0.0.1:3000', SHOPIFY_CLIENT_ID: 'test-client', SHOPIFY_CLIENT_SECRET: 'test-secret', TOKEN_ENCRYPTION_KEY: 'ab'.repeat(32), OPERATOR_TOKEN: 'operator-test-token-with-sufficient-entropy', DATA_DIR: dir, ALLOWED_SHOPS: shop, AGENTS_JSON: JSON.stringify([{ id: 'test', token_sha256: hash(token), shops: [shop], tools: ['shop_info', 'products_list', 'orders_list', 'inventory_list', 'product_update'] }]) });
  return { cfg, vault: new Vault(dir, cfg.encryptionKey) };
}
async function serverFixture(t) {
  const f = fixture(t), calls = [];
  const api = { graphql: async (...args) => { calls.push(args); return { shop: { name: 'Test Store' } }; }, tokenRequest: async () => { throw new Error('Unexpected token exchange'); } };
  const server = app(f.cfg, { vault: f.vault, api });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { ...f, calls, origin, request: (path, options) => fetch(origin + path, options) };
}
test('rejects hostile Shopify hosts and cross-store or unauthorized tool access', t => {
  const { cfg } = fixture(t);
  for (const value of ['https://test.myshopify.com', 'test.myshopify.com.evil.com', '../token', '127.0.0.1']) assert.throws(() => shopHost(value));
  assert.equal(authorize(cfg, token, 'products_list', shop).id, 'test');
  assert.throws(() => authorize(cfg, token, 'products_list', 'other.myshopify.com'));
  assert.throws(() => authorize(cfg, token, 'raw_graphql', shop));
  assert.throws(() => authorize(cfg, 'wrong-token', 'products_list', shop));
  assert.throws(() => validate('product_update', { shop, product_id: 'gid://shopify/Product/1', price: '0' }));
  assert.throws(() => validate('products_list', { shop, first: 500 }));
});
test('encrypts tokens, authenticates ciphertext, and binds records to store identity', t => {
  const { vault } = fixture(t);
  vault.set(shop, { access_token: 'sensitive-token' });
  assert.equal(vault.get(shop).access_token, 'sensitive-token');
  assert.ok(!readFileSync(vault.file(shop), 'utf8').includes('sensitive-token'));
  const wrongKey = new Vault(vault.dir, Buffer.alloc(32));
  assert.throws(() => wrongKey.get(shop));
});
test('product changes preview by default; execution obeys write policy and records outcome', async t => {
  const { cfg, vault } = fixture(t); let writes = 0;
  const api = { graphql: async (_, query) => query.startsWith('mutation') ? (writes++, { productUpdate: { product: { id: 'gid://shopify/Product/1', title: 'New' }, userErrors: [] } }) : { product: { id: 'gid://shopify/Product/1', title: 'Old' } } };
  const args = { shop, product_id: 'gid://shopify/Product/1', title: 'New' };
  const preview = await execute(cfg, vault, api, cfg.agents[0], 'product_update', args);
  assert.equal(preview.dry_run, true); assert.equal(writes, 0);
  await assert.rejects(execute(cfg, vault, api, cfg.agents[0], 'product_update', { ...args, dry_run: false }), /disabled/);
  const applied = await execute({ ...cfg, writes: true }, vault, api, cfg.agents[0], 'product_update', { ...args, dry_run: false });
  assert.equal(applied.applied, true); assert.equal(writes, 1);
  const audit = readFileSync(join(cfg.dir, 'audit.jsonl'), 'utf8'); assert.match(audit, /intent/); assert.match(audit, /applied/);
});
test('HTTP rejects missing agent auth, unauthorized origins, and cross-store requests before Shopify calls', async t => {
  const f = await serverFixture(t);
  assert.equal((await f.request('/v1/tools')).status, 401);
  const opts = { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'shop_info', arguments: { shop: 'other.myshopify.com' } }) };
  assert.equal((await f.request('/v1/call', opts)).status, 403);
  opts.headers.Origin = 'https://evil.example'; assert.equal((await f.request('/v1/call', opts)).status, 403);
  assert.equal(f.calls.length, 0);
  const list = await (await f.request('/v1/tools', { headers: { Authorization: `Bearer ${token}` } })).json(); assert.equal(list.tools.length, 5);
});
test('OAuth install requires operator identity, single-use ticket, callback HMAC and browser cookie', async t => {
  const f = await serverFixture(t);
  const opts = { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ shop }) };
  assert.equal((await f.request('/operator/install-link', opts)).status, 401);
  opts.headers.Authorization = `Bearer ${f.cfg.operator}`;
  const install = await (await f.request('/operator/install-link', opts)).json();
  const path = new URL(install.install_url).pathname + new URL(install.install_url).search;
  const redirect = await f.request(path, { redirect: 'manual' }); assert.equal(redirect.status, 302);
  assert.match(redirect.headers.get('set-cookie'), /HttpOnly/);
  assert.equal((await f.request(path, { redirect: 'manual' })).status, 400);
  const state = new URL(redirect.headers.get('location')).searchParams.get('state');
  const p = new URLSearchParams({ shop, state, code: 'test-code', timestamp: String(Math.floor(Date.now() / 1000)) });
  const message = [...p].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&');
  p.set('hmac', createHmac('sha256', f.cfg.secret).update(message).digest('hex'));
  const response = await f.request('/auth/callback?' + p); assert.equal(response.status, 400);
  assert.match((await response.json()).error, /state/);
  p.set('hmac', 'wrong'); assert.equal((await f.request('/auth/callback?' + p)).status, 400);
});
test('signed uninstall revokes stored token; forged uninstall cannot revoke it', async t => {
  const f = await serverFixture(t); f.vault.set(shop, { access_token: 'secret', installed_at: Date.now() - 10000 });
  const raw = JSON.stringify({ myshopify_domain: shop }), headers = { 'X-Shopify-Shop-Domain': shop, 'X-Shopify-Topic': 'app/uninstalled', 'X-Shopify-Hmac-Sha256': 'wrong' };
  assert.equal((await f.request('/webhooks', { method: 'POST', headers, body: raw })).status, 401);
  assert.equal(f.vault.get(shop).access_token, 'secret');
  headers['X-Shopify-Hmac-Sha256'] = createHmac('sha256', f.cfg.secret).update(raw).digest('base64');
  assert.equal((await f.request('/webhooks', { method: 'POST', headers, body: raw })).status, 200);
  assert.equal(f.vault.get(shop).revoked, true); assert.equal(f.vault.get(shop).access_token, undefined);
});
test('concurrent reads share one token refresh and preserve installation date', async t => {
  const { cfg, vault } = fixture(t); let refreshes = 0;
  vault.set(shop, { access_token: 'expired', expires_at: 1, refresh_token: 'refresh', installed_at: 1000 });
  const transport = async (url, options) => {
    if (url.endsWith('access_token')) { refreshes++; assert.equal(options.body.get('grant_type'), 'refresh_token'); return Response.json({ access_token: 'fresh', refresh_token: 'rotated', expires_in: 3600 }); }
    assert.equal(options.headers['X-Shopify-Access-Token'], 'fresh'); return Response.json({ data: { shop: { name: 'Test' } } });
  };
  const api = createShopify(cfg, vault, transport);
  await Promise.all([api.graphql(shop, '{shop{name}}'), api.graphql(shop, '{shop{name}}')]);
  assert.equal(refreshes, 1); assert.equal(vault.get(shop).installed_at, 1000);
});
test('stdio MCP negotiates protocol and handles malformed input without losing the session', () => {
  const result = spawnSync(process.execPath, ['src/mcp.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, STORE_OPS_AGENT_TOKEN: token }, input: 'null\n{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}\n', encoding: 'utf8' });
  assert.equal(result.status, 0);
  const lines = result.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(lines[0].error.code, -32600); assert.equal(lines[1].result.protocolVersion, '2024-11-05');
});
test('remote MCP authenticates clients and enforces store permissions on tool calls', async t => {
  const f = await serverFixture(t);
  const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) };
  assert.equal((await f.request('/mcp', opts)).status, 401);
  opts.headers.Authorization = `Bearer ${token}`;
  assert.equal((await (await f.request('/mcp', opts)).json()).result.tools.length, 5);
  opts.body = JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'shop_info', arguments: { shop: 'other.myshopify.com' } } });
  assert.equal((await (await f.request('/mcp', opts)).json()).result.isError, true);
  assert.equal(f.calls.length, 0);
  opts.body = JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'shop_info', arguments: { shop } } });
  assert.match((await (await f.request('/mcp', opts)).json()).result.content[0].text, /Test Store/);
});
