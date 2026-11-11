import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, appendFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';

export const hash = value => createHash('sha256').update(value).digest('hex');
export const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
export function shopHost(value) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(value)) throw new Error('Invalid Shopify hostname');
  return value;
}
export function config(env = process.env) {
  for (const key of ['APP_URL', 'SHOPIFY_CLIENT_ID', 'SHOPIFY_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY', 'OPERATOR_TOKEN']) {
    if (!env[key]) throw new Error(`Missing configuration: ${key}`);
  }
  const url = new URL(env.APP_URL);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('APP_URL must use HTTPS outside localhost');
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('APP_URL must be an origin');
  if (!/^[a-f0-9]{64}$/i.test(env.TOKEN_ENCRYPTION_KEY)) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes as hex');
  if (env.OPERATOR_TOKEN.length < 32) throw new Error('OPERATOR_TOKEN must have at least 32 characters');
  const shops = (env.ALLOWED_SHOPS || '').split(',').filter(Boolean).map(x => shopHost(x.trim()));
  const agents = JSON.parse(env.AGENTS_JSON || '[]');
  if (!Array.isArray(agents)) throw new Error('Invalid agent configuration');
  const ids = new Set(), tokens = new Set();
  for (const a of agents) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(a.id) || !/^[a-f0-9]{64}$/.test(a.token_sha256) || equal(a.token_sha256, hash(env.OPERATOR_TOKEN)) || ids.has(a.id) || tokens.has(a.token_sha256) || !Array.isArray(a.shops) || !a.shops.length || a.shops.some(s => !shops.includes(s)) || !Array.isArray(a.tools) || a.tools.some(t => !tools.some(tool => tool.name === t))) throw new Error('Invalid agent configuration');
    ids.add(a.id); tokens.add(a.token_sha256);
  }
  const version = env.SHOPIFY_API_VERSION || '2026-10';
  if (!/^20\d{2}-(01|04|07|10)$/.test(version)) throw new Error('Invalid Shopify API version');
  return { origin: url.origin, clientId: env.SHOPIFY_CLIENT_ID, secret: env.SHOPIFY_CLIENT_SECRET, encryptionKey: Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'hex'), operator: env.OPERATOR_TOKEN, shops, agents, version, scopes: env.SHOPIFY_SCOPES || 'read_products,write_products,read_orders,read_inventory', writes: env.ENABLE_PRODUCT_WRITES === 'true', webhookHosts: (env.WEBHOOK_ALLOWED_HOSTS || '').split(',').filter(Boolean).map(x => x.trim().toLowerCase()), dir: resolve(env.DATA_DIR || './data') };
}
export class Vault {
  constructor(dir, key) { this.dir = dir; this.key = key; mkdirSync(dir, { recursive: true, mode: 0o700 }); }
  file(shop) { return join(this.dir, `${shopHost(shop)}.enc`); }
  get(shop) {
    return this.read(this.file(shop), shop);
  }
  read(path, context) {
    if (!existsSync(path)) return null;
    const { iv, tag, body } = JSON.parse(readFileSync(path, 'utf8'));
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'hex'));
    decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(body, 'hex')), decipher.final()]).toString());
  }
  set(shop, record) {
    this.write(this.file(shop), shopHost(shop), record);
  }
  write(path, context, record) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(context));
    const body = Buffer.concat([cipher.update(JSON.stringify(record)), cipher.final()]);
    const temp = `${path}.${randomBytes(8).toString('hex')}.tmp`;
    writeFileSync(temp, JSON.stringify({ iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), body: body.toString('hex') }), { mode: 0o600 });
    renameSync(temp, path);
  }
  remove(shop) { rmSync(this.file(shop), { force: true }); }
  audit(record) { appendFileSync(join(this.dir, 'audit.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...record }) + '\n', { mode: 0o600 }); }
}
export function callbackHmac(params, secret) {
  if (['hmac', 'shop', 'state', 'code', 'timestamp'].some(k => params.getAll(k).length !== 1)) return false;
  return shopifyHmac(params, secret);
}
export function shopifyHmac(params, secret) {
  if (params.getAll('hmac').length !== 1 || [...new Set(params.keys())].some(k => params.getAll(k).length !== 1)) return false;
  const message = [...params.entries()].filter(([k]) => k !== 'hmac').sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&');
  const expected = createHmac('sha256', secret).update(message).digest('hex');
  return equal(expected, params.get('hmac'));
}
const shopProperty = { type: 'string', description: 'Exact authorized myshopify.com hostname' };
const schema = properties => ({ type: 'object', properties: { shop: shopProperty, ...properties }, required: ['shop'], additionalProperties: false });
const listSchema = schema({ first: { type: 'integer', minimum: 1, maximum: 50 }, after: { type: 'string' }, query: { type: 'string' } });
export const tools = [
  { name: 'shop_info', description: 'Read store identity and timezone.', inputSchema: schema({}) },
  { name: 'products_list', description: 'Read products, descriptions and SEO fields with cursor pagination.', inputSchema: listSchema },
  { name: 'orders_list', description: 'Read order totals and status, excluding customer identity fields. Shopify order-history limits apply.', inputSchema: listSchema },
  { name: 'inventory_list', description: 'Read inventory items and tracking with cursor pagination.', inputSchema: schema({ first: { type: 'integer', minimum: 1, maximum: 50 }, after: { type: 'string' } }) },
  { name: 'product_update', description: 'Preview or apply a product title, description or SEO update. Defaults to dry run; execution requires dry_run=false and enabled write policy.', inputSchema: { ...schema({ product_id: { type: 'string' }, title: { type: 'string' }, descriptionHtml: { type: 'string' }, seo: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' } }, additionalProperties: false }, dry_run: { type: 'boolean', default: true } }), required: ['shop', 'product_id'] } }
];
export function validate(name, a) {
  const tool = tools.find(t => t.name === name);
  if (!tool || !a || typeof a !== 'object' || Array.isArray(a)) throw new Error('Unknown tool or invalid arguments');
  for (const key of Object.keys(a)) if (!(key in tool.inputSchema.properties)) throw new Error('Unknown argument');
  shopHost(a.shop);
  if ('first' in a && (!Number.isInteger(a.first) || a.first < 1 || a.first > 50)) throw new Error('first must be between 1 and 50');
  for (const k of ['after', 'query', 'title', 'descriptionHtml']) if (k in a && (typeof a[k] !== 'string' || a[k].length > 100000)) throw new Error(`Invalid ${k}`);
  if (name === 'product_update') {
    if (!/^gid:\/\/shopify\/Product\/\d+$/.test(a.product_id)) throw new Error('Invalid product_id');
    if ('dry_run' in a && typeof a.dry_run !== 'boolean') throw new Error('Invalid dry_run');
    if (!['title', 'descriptionHtml', 'seo'].some(k => k in a)) throw new Error('Provide at least one product field');
    if ('seo' in a && (!a.seo || typeof a.seo !== 'object' || Array.isArray(a.seo) || !Object.keys(a.seo).length || Object.entries(a.seo).some(([k, v]) => !['title', 'description'].includes(k) || typeof v !== 'string' || v.length > 5000))) throw new Error('Invalid seo');
  }
  return a;
}
export function authorize(cfg, bearer, name, shop) {
  const agent = cfg.registry ? cfg.registry.agent(bearer) : cfg.agents.find(a => equal(a.token_sha256, hash(bearer || '')));
  if (!agent || !agent.shops.includes(shop) || !agent.tools.includes(name)) throw new Error('Access denied');
  if (cfg.registry) cfg.registry.check(agent.id, shop, name);
  return agent;
}
export function createShopify(cfg, vault, transport = fetch) {
  const refreshing = new Map();
  async function tokenRequest(shop, payload) {
    const response = await transport(`https://${shopHost(shop)}/admin/oauth/access_token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.secret, ...payload }), signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Shopify token exchange failed (${response.status})`);
    const value = await response.json();
    if (!value.access_token) throw new Error('Shopify returned no token');
    const previous = vault.get(shop);
    if (payload.grant_type === 'refresh_token' && (!previous || previous.revoked || previous.refresh_token !== payload.refresh_token)) throw new Error('Connection changed while refreshing; reconnect required');
    const record = { ...value, expires_at: Number(value.expires_in) > 0 ? Date.now() + value.expires_in * 1000 : null, installed_at: payload.grant_type === 'refresh_token' ? previous.installed_at : Date.now() };
    vault.set(shop, record); return record;
  }
  async function access(shop) {
    const record = vault.get(shop);
    if (!record || record.revoked) throw new Error('Store is not connected');
    if (!record.expires_at || record.expires_at > Date.now() + 60000) return record.access_token;
    if (!record.refresh_token) throw new Error('Store token expired; reconnect required');
    if (!refreshing.has(shop)) refreshing.set(shop, tokenRequest(shop, { grant_type: 'refresh_token', refresh_token: record.refresh_token }).finally(() => refreshing.delete(shop)));
    return (await refreshing.get(shop)).access_token;
  }
  async function graphql(shop, query, variables = {}) {
    const response = await transport(`https://${shopHost(shop)}/admin/api/${cfg.version}/graphql.json`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': await access(shop) }, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Shopify request failed (${response.status})`);
    const value = await response.json();
    if (value.errors?.length) throw new Error('Shopify GraphQL error; check scopes and API version');
    return value.data;
  }
  return { tokenRequest, graphql };
}
export async function execute(cfg, vault, api, agent, name, args) {
  const a = validate(name, args);
  if (!agent.shops.includes(a.shop) || !agent.tools.includes(name)) throw new Error('Access denied');
  if (cfg.registry) cfg.registry.check(agent.id, a.shop, name, name === 'product_update' && a.dry_run === false);
  const variables = { first: a.first ?? 20, after: a.after ?? null, query: a.query ?? null };
  let result;
  if (name === 'shop_info') result = await api.graphql(a.shop, '{ shop { id name myshopifyDomain currencyCode ianaTimezone } }');
  if (name === 'products_list') result = await api.graphql(a.shop, 'query($first:Int!,$after:String,$query:String){products(first:$first,after:$after,query:$query){nodes{id title handle status descriptionHtml seo{title description} updatedAt} pageInfo{hasNextPage endCursor}}}', variables);
  if (name === 'orders_list') result = await api.graphql(a.shop, 'query($first:Int!,$after:String,$query:String){orders(first:$first,after:$after,query:$query){nodes{id name createdAt displayFinancialStatus displayFulfillmentStatus totalPriceSet{shopMoney{amount currencyCode}}} pageInfo{hasNextPage endCursor}}}', variables);
  if (name === 'inventory_list') result = await api.graphql(a.shop, 'query($first:Int!,$after:String){inventoryItems(first:$first,after:$after){nodes{id sku tracked} pageInfo{hasNextPage endCursor}}}', { first: variables.first, after: variables.after });
  if (name === 'product_update') {
    if (!cfg.writes && a.dry_run === false) throw new Error('Product writes are disabled');
    const before = await api.graphql(a.shop, 'query($id:ID!){product(id:$id){id title descriptionHtml seo{title description} updatedAt}}', { id: a.product_id });
    if (!before.product) throw new Error('Product not found');
    const product = { id: a.product_id, ...Object.fromEntries(['title', 'descriptionHtml', 'seo'].filter(k => k in a).map(k => [k, a[k]])) };
    if (a.dry_run !== false) return { dry_run: true, before: before.product, proposed: product };
    const operation_id = randomBytes(16).toString('hex');
    vault.audit({ phase: 'intent', operation_id, actor: agent.id, shop: a.shop, tool: name, product_id: a.product_id, before_hash: hash(JSON.stringify(before.product)), proposed_hash: hash(JSON.stringify(product)) });
    try {
      result = await api.graphql(a.shop, 'mutation($product:ProductUpdateInput!){productUpdate(product:$product){product{id title descriptionHtml seo{title description} updatedAt} userErrors{field message}}}', { product });
      if (result.productUpdate.userErrors?.length) { vault.audit({ phase: 'rejected', operation_id }); return { applied: false, errors: result.productUpdate.userErrors }; }
      vault.audit({ phase: 'applied', operation_id, after_hash: hash(JSON.stringify(result.productUpdate.product)) });
      return { applied: true, operation_id, before: before.product, after: result.productUpdate.product };
    } catch (error) { vault.audit({ phase: 'outcome_unknown', operation_id }); throw error; }
  }
  vault.audit({ actor: agent.id, shop: a.shop, tool: name, phase: 'read' });
  return result;
}
