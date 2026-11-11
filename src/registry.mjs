import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { hash, equal, shopHost, tools } from './core.mjs';

export const EVENT_TOPICS = ['orders/create', 'orders/updated', 'products/update', 'inventory_levels/update'];
const id = prefix => `${prefix}_${randomBytes(8).toString('hex')}`;
const key = () => randomBytes(32).toString('base64url');
function text(value, label, limit = 160) { if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new Error(`Invalid ${label}`); return value.trim(); }
function bool(value, fallback = false) { if (value === undefined) return fallback; if (typeof value !== 'boolean') throw new Error('Expected boolean'); return value; }

export class Registry {
  constructor(cfg, vault) {
    this.cfg = cfg; this.vault = vault; this.path = join(cfg.dir, 'registry.enc');
    this.data = vault.read(this.path, 'var80-registry-v1');
    if (!this.data) {
      this.data = { version: 1, clients: [], stores: [], bots: [], deliveries: [], compliance: [] };
      if (cfg.shops.length) {
        this.data.clients.push({ id: 'legacy', name: 'Existing stores', active: true, created_at: new Date().toISOString() });
        this.data.stores = cfg.shops.map(shop => ({ shop, client_id: 'legacy', name: shop, active: true, writes: cfg.writes }));
        this.data.bots = cfg.agents.map(a => ({ id: a.id, name: a.id, active: true, token_sha256: a.token_sha256, grants: a.shops.map(shop => ({ shop, tools: a.tools, writes: cfg.writes, events: [] })), webhook: null }));
      }
      this.save();
    }
    cfg.registry = this;
  }
  save() { this.vault.write(this.path, 'var80-registry-v1', this.data); }
  client(clientId) { const c = this.data.clients.find(c => c.id === clientId); if (!c) throw new Error('Client not found'); return c; }
  store(shop) { return this.data.stores.find(s => s.shop === shop); }
  isAllowed(shop) { const s = this.store(shop); return !!s && s.active && this.client(s.client_id).active; }
  actor(token) {
    if (equal(token, this.cfg.operator)) return { role: 'admin', id: 'operator' };
    const c = this.data.clients.find(c => c.active && c.portal_hash && equal(c.portal_hash, hash(token || '')));
    return c ? { role: 'client', id: c.id, client_id: c.id, credential_hash: c.portal_hash } : null;
  }
  validActor(actor) { return actor?.role === 'admin' || !!this.data.clients.find(c => c.id === actor?.client_id && c.active && equal(c.portal_hash, actor.credential_hash)); }
  assertStore(actor, shop) {
    const s = this.store(shop);
    if (!s || (actor.role !== 'admin' && actor.client_id !== s.client_id)) throw new Error('Access denied');
    return s;
  }
  snapshot(actor) {
    const clients = this.data.clients.filter(c => actor.role === 'admin' || c.id === actor.client_id).map(({ portal_hash, ...c }) => ({ ...c, portal_enabled: !!portal_hash }));
    const ids = new Set(clients.map(c => c.id));
    const stores = this.data.stores.filter(s => ids.has(s.client_id)).map(s => { const token = this.vault.get(s.shop); return { ...s, connection: !token ? 'not_connected' : token.revoked ? 'disconnected' : token.expires_at && token.expires_at <= Date.now() && !token.refresh_token ? 'reconnect_required' : 'connected', scopes: token?.revoked ? '' : token?.scope || '', connected_at: token?.revoked ? null : token?.installed_at || null }; });
    const shops = new Set(stores.map(s => s.shop));
    const bots = this.data.bots.filter(b => actor.role === 'admin' || b.grants.some(g => shops.has(g.shop))).map(b => ({ id: b.id, name: b.name, active: b.active, grants: b.grants.filter(g => actor.role === 'admin' || shops.has(g.shop)), webhook: actor.role === 'admin' && b.webhook ? { url: b.webhook.url, secret_configured: !!b.webhook.secret } : null }));
    return { actor: { role: actor.role, client_id: actor.client_id }, clients, stores, bots, tools: tools.map(t => ({ name: t.name, description: t.description })), event_topics: EVENT_TOPICS, deliveries: this.data.deliveries.filter(d => shops.has(d.shop)).slice(-100).reverse().map(({ payload, ...d }) => d), compliance: actor.role === 'admin' ? this.data.compliance.map(({ payload, ...c }) => c) : [], settings: { product_writes_enabled: this.cfg.writes, distribution: 'public', mcp_url: `${this.cfg.origin}/mcp` } };
  }
  createClient(input) {
    const c = { id: id('client'), name: text(input.name, 'client name'), active: true, created_at: new Date().toISOString() };
    this.data.clients.push(c); this.save(); return c;
  }
  updateClient(clientId, input) {
    const c = this.client(clientId);
    const patch = {};
    if ('name' in input) patch.name = text(input.name, 'client name');
    if ('active' in input) patch.active = bool(input.active);
    Object.assign(c, patch);
    this.save(); return { id: c.id };
  }
  portalKey(clientId) { const c = this.client(clientId), token = key(); c.portal_hash = hash(token); this.save(); return { token, client_id: c.id }; }
  addStore(input) {
    const shop = shopHost(input.shop); this.client(input.client_id);
    if (this.store(shop)) throw new Error('Store already belongs to a client');
    const s = { shop, client_id: input.client_id, name: input.name ? text(input.name, 'store name') : shop, active: true, writes: false };
    this.data.stores.push(s); this.save(); return s;
  }
  updateStore(actor, shop, input) {
    const s = this.assertStore(actor, shop);
    const patch = {};
    if ('name' in input && actor.role === 'admin') patch.name = text(input.name, 'store name');
    if ('active' in input) patch.active = bool(input.active);
    if ('writes' in input) patch.writes = bool(input.writes);
    if ('client_id' in input && input.client_id !== s.client_id) throw new Error('Store ownership cannot be reassigned');
    Object.assign(s, patch); this.save(); return s;
  }
  createBot(input) {
    const token = key(), b = { id: id('bot'), name: text(input.name, 'bot name'), active: true, token_sha256: hash(token), grants: [], webhook: null };
    this.data.bots.push(b); this.save(); return { id: b.id, token };
  }
  bot(botId) { const b = this.data.bots.find(b => b.id === botId); if (!b) throw new Error('Bot not found'); return b; }
  updateBot(botId, input) {
    const b = this.bot(botId), patch = {};
    if ('name' in input) patch.name = text(input.name, 'bot name');
    if ('active' in input) patch.active = bool(input.active);
    if ('grants' in input) {
      if (!Array.isArray(input.grants) || input.grants.length > 500) throw new Error('Invalid grants');
      const seen = new Set();
      patch.grants = input.grants.map(g => {
        const shop = shopHost(g.shop); if (!this.store(shop) || seen.has(shop)) throw new Error('Unknown or duplicate store'); seen.add(shop);
        if (!Array.isArray(g.tools) || g.tools.some(t => !tools.some(tool => tool.name === t))) throw new Error('Unknown tool');
        const events = g.events || []; if (!Array.isArray(events) || events.some(e => !EVENT_TOPICS.includes(e))) throw new Error('Unknown event');
        return { shop, tools: [...new Set(g.tools)], events: [...new Set(events)], writes: bool(g.writes) };
      });
    }
    if ('webhook' in input) {
      if (input.webhook === null) patch.webhook = null;
      else {
        const url = new URL(text(input.webhook.url, 'webhook URL', 2048));
        if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search || (url.port && url.port !== '443') || !this.cfg.webhookHosts.includes(url.hostname.toLowerCase())) throw new Error('Webhook must use HTTPS on an allowed host, without URL credentials or query parameters');
        const secret = input.webhook.secret || b.webhook?.secret;
        if (typeof secret !== 'string' || secret.length < 32 || secret.length > 512 || /[\r\n]/.test(secret)) throw new Error('Webhook secret must have at least 32 characters');
        patch.webhook = { url: url.href, secret };
      }
    }
    Object.assign(b, patch); this.save(); return { id: b.id };
  }
  rotateBot(botId) { const b = this.bot(botId), token = key(); b.token_sha256 = hash(token); this.save(); return { id: b.id, token }; }
  agent(token) {
    const b = this.data.bots.find(b => b.active && equal(b.token_sha256, hash(token || '')));
    if (!b) return null;
    const grants = b.grants.filter(g => this.isAllowed(g.shop));
    return { id: b.id, shops: grants.map(g => g.shop), tools: [...new Set(grants.flatMap(g => g.tools))] };
  }
  check(botId, shop, tool, write = false) {
    const b = this.bot(botId), s = this.store(shop), g = b.grants.find(g => g.shop === shop);
    if (!b.active || !this.isAllowed(shop) || !g?.tools.includes(tool)) throw new Error('Access denied');
    if (write && (!s.writes || !g.writes || !this.cfg.writes)) throw new Error('Product writes are disabled for this store or bot');
  }
  enqueue(shop, topic, payload, eventId) {
    if (!this.isAllowed(shop)) return;
    const connection = this.vault.get(shop); if (!connection || connection.revoked) return;
    if (!eventId || !/^[a-zA-Z0-9_-]{1,128}$/.test(eventId)) throw new Error('Missing or invalid webhook event ID');
    for (const b of this.data.bots.filter(b => b.active && b.webhook && b.grants.some(g => g.shop === shop && g.events.includes(topic)))) {
      if (this.data.deliveries.some(d => d.bot_id === b.id && d.event_id === eventId)) continue;
      this.data.deliveries.push({ id: id('delivery'), bot_id: b.id, shop, topic, event_id: eventId, status: 'pending', attempts: 0, next_at: Date.now(), created_at: new Date().toISOString(), payload: { event_id: eventId, shop, topic, resource_id: payload.admin_graphql_api_id || payload.id || payload.inventory_item_id || null } });
    }
    this.save();
  }
  redactShop(shop) {
    this.vault.remove(shop);
    this.data.deliveries = this.data.deliveries.filter(d => d.shop !== shop);
    this.data.compliance = this.data.compliance.filter(c => c.shop !== shop);
    this.data.bots.forEach(b => { b.grants = b.grants.filter(g => g.shop !== shop); });
    this.data.stores = this.data.stores.filter(s => s.shop !== shop);
    this.save();
  }
}
