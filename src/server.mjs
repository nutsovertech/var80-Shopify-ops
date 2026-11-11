import { createServer } from 'node:http';
import { createHmac, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { config, Vault, equal, shopHost, callbackHmac, shopifyHmac, tools, authorize, createShopify, execute } from './core.mjs';
import { Registry, EVENT_TOPICS } from './registry.mjs';
import { consoleRoutes } from './console.mjs';
import { dispatcher } from './relay.mjs';

function reply(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(data));
}
async function body(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 256000) throw new Error('Request too large'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
export function app(cfg, { vault = new Vault(cfg.dir, cfg.encryptionKey), api = createShopify(cfg, vault) } = {}) {
  const registry = new Registry(cfg, vault);
  const tickets = new Map(), states = new Map();
  const cookieName = cfg.origin.startsWith('https:') ? '__Host-var80_oauth' : 'var80_oauth';
  const cookie = value => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${value ? 600 : 0}${cfg.origin.startsWith('https:') ? '; Secure' : ''}`;
  function mintInstall(shop) {
    shopHost(shop);
    if (!registry.isAllowed(shop)) throw new Error('Store not allowed or paused');
    if (tickets.size >= 100) throw new Error('Too many pending installs');
    const ticket = randomBytes(32).toString('hex');
    tickets.set(ticket, { shop, expires: Date.now() + 600000 });
    return { install_url: `${cfg.origin}/auth/authorize?ticket=${ticket}`, expires_in: 600 };
  }
  const consoleHandler = consoleRoutes(cfg, registry, mintInstall);
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, cfg.origin);
      const bearer = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1] || '';
      if (req.headers.origin && req.headers.origin !== cfg.origin) return reply(res, 403, { error: 'Origin denied' });
      for (const map of [tickets, states]) for (const [key, value] of map) if (value.expires < Date.now()) map.delete(key);
      if (req.method === 'GET' && url.pathname === '/health') return reply(res, 200, { service: 'Var80 Store Ops', status: 'ok' });
      if (req.method === 'GET' && url.pathname === '/' && url.searchParams.has('shop')) {
        const p = url.searchParams;
        if (!shopifyHmac(p, cfg.secret) || !/^\d+$/.test(p.get('timestamp')) || Math.abs(Date.now() / 1000 - Number(p.get('timestamp'))) > 300) return reply(res, 400, { error: 'Invalid Shopify launch signature' });
        const shop = shopHost(p.get('shop'));
        if (!registry.isAllowed(shop)) return reply(res, 403, { error: 'This store is not yet enrolled. Ask your Var80 administrator to add it to your client workspace.' });
        const connected = vault.get(shop);
        if (connected && !connected.revoked) return reply(res, 302, { message: 'Open client workspace' }, { Location: `${cfg.origin}/client` });
        const link = mintInstall(shop);
        return reply(res, 302, { message: 'Authorize Var80 Store Ops' }, { Location: link.install_url });
      }
      if (await consoleHandler(req, res, url, body, reply)) return;
      if (req.method === 'POST' && url.pathname === '/operator/install-link') {
        if (!equal(bearer, cfg.operator)) return reply(res, 401, { error: 'Unauthorized' });
        const { shop } = JSON.parse((await body(req)).toString());
        return reply(res, 200, mintInstall(shop));
      }
      if (req.method === 'GET' && url.pathname === '/auth/authorize') {
        const ticket = url.searchParams.get('ticket'), pending = tickets.get(ticket); tickets.delete(ticket);
        if (!pending || pending.expires < Date.now() || !registry.isAllowed(pending.shop)) return reply(res, 400, { error: 'Invalid or expired install link' });
        const state = randomBytes(32).toString('hex'); states.set(state, pending);
        const authorizeUrl = new URL(`https://${pending.shop}/admin/oauth/authorize`);
        authorizeUrl.search = new URLSearchParams({ client_id: cfg.clientId, scope: cfg.scopes, redirect_uri: `${cfg.origin}/auth/callback`, state }).toString();
        return reply(res, 302, { redirect: 'Shopify authorization' }, { Location: authorizeUrl.href, 'Set-Cookie': cookie(state) });
      }
      if (req.method === 'GET' && url.pathname === '/auth/callback') {
        const p = url.searchParams;
        if (!callbackHmac(p, cfg.secret)) return reply(res, 400, { error: 'Invalid callback signature' });
        const shop = shopHost(p.get('shop')), state = p.get('state'), pending = states.get(state);
        const cookieState = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
        if (!pending || pending.expires < Date.now() || pending.shop !== shop || !registry.isAllowed(shop) || !equal(state, cookieState) || !/^\d+$/.test(p.get('timestamp')) || Math.abs(Date.now() / 1000 - Number(p.get('timestamp'))) > 300) return reply(res, 400, { error: 'Invalid callback state or timestamp' });
        states.delete(state);
        await api.tokenRequest(shop, { code: p.get('code'), expiring: 1 });
        vault.audit({ phase: 'connected', shop });
        return reply(res, 200, { connected: true, shop, app: 'Var80 Store Ops' }, { 'Set-Cookie': cookie('') });
      }
      if (req.method === 'POST' && ['/webhooks', '/webhooks/compliance'].includes(url.pathname)) {
        const raw = await body(req);
        const hmac = createHmac('sha256', cfg.secret).update(raw).digest('base64');
        if (!equal(hmac, req.headers['x-shopify-hmac-sha256'])) return reply(res, 401, { error: 'Invalid webhook signature' });
        const shop = shopHost(req.headers['x-shopify-shop-domain']);
        const topic = req.headers['x-shopify-topic'], payload = JSON.parse(raw.toString()), eventId = req.headers['x-shopify-event-id'] || req.headers['x-shopify-webhook-id'];
        if (['customers/data_request', 'customers/redact', 'shop/redact'].includes(topic)) {
          if (payload.shop_domain !== shop) return reply(res, 400, { error: 'Webhook store mismatch' });
          if (topic === 'shop/redact') registry.redactShop(shop);
          else {
            if (!eventId) return reply(res, 400, { error: 'Missing webhook event ID' });
            if (!registry.data.compliance.some(c => c.event_id === eventId && c.shop === shop)) {
              if (topic === 'customers/redact') {
                registry.data.deliveries = registry.data.deliveries.filter(d => d.shop !== shop);
                registry.data.compliance.filter(c => c.shop === shop).forEach(c => { delete c.payload; });
              }
              registry.data.compliance.push({ id: randomBytes(12).toString('hex'), event_id: eventId, shop, topic, status: 'pending', created_at: new Date().toISOString(), payload: topic === 'customers/data_request' ? { request_id: payload.data_request?.id, customer_id: payload.customer?.id, orders_requested: payload.orders_requested || [] } : undefined });
              registry.save();
            }
          }
          return reply(res, 200, { received: true });
        }
        if (topic === 'app/uninstalled') {
          if (payload.myshopify_domain !== shop) return reply(res, 400, { error: 'Webhook store mismatch' });
          const record = vault.get(shop), triggered = Date.parse(req.headers['x-shopify-triggered-at']);
          if (record && (!Number.isFinite(triggered) || triggered >= record.installed_at)) {
            vault.set(shop, { revoked: true, installed_at: record.installed_at });
            registry.data.deliveries.filter(d => d.shop === shop && ['pending', 'retry'].includes(d.status)).forEach(d => { d.status = 'cancelled'; }); registry.save();
            vault.audit({ phase: 'uninstalled', shop });
          }
        } else if (EVENT_TOPICS.includes(topic)) {
          if (registry.store(shop)) registry.enqueue(shop, topic, payload, eventId);
        } else {
          return reply(res, 400, { error: 'Unsupported webhook' });
        }
        return reply(res, 200, { received: true });
      }
      if (url.pathname === '/mcp') {
        const agent = registry.agent(bearer);
        if (!agent) return reply(res, 401, { error: 'Unauthorized' });
        if (req.method !== 'POST') return reply(res, 405, { error: 'Stateless MCP supports POST only' }, { Allow: 'POST' });
        const message = JSON.parse((await body(req)).toString());
        if (!message || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') return reply(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } });
        if (!Object.hasOwn(message, 'id')) { res.writeHead(202); return res.end(); }
        const respond = result => reply(res, 200, { jsonrpc: '2.0', id: message.id, result });
        if (message.method === 'initialize') return respond({ protocolVersion: ['2025-03-26', '2025-06-18'].includes(message.params?.protocolVersion) ? message.params.protocolVersion : '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'var80-store-ops', version: '0.1.0' } });
        if (message.method === 'ping') return respond({});
        if (message.method === 'tools/list') return respond({ tools: tools.filter(t => agent.tools.includes(t.name)) });
        if (message.method === 'tools/call') {
          try {
            const result = await execute(cfg, vault, api, agent, message.params?.name, message.params?.arguments);
            return respond({ content: [{ type: 'text', text: JSON.stringify(result) }] });
          } catch (error) { return respond({ isError: true, content: [{ type: 'text', text: error.message }] }); }
        }
        return reply(res, 200, { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } });
      }
      if (req.method === 'GET' && url.pathname === '/v1/tools') {
        const agent = registry.agent(bearer);
        if (!agent) return reply(res, 401, { error: 'Unauthorized' });
        return reply(res, 200, { tools: tools.filter(t => agent.tools.includes(t.name)) });
      }
      if (req.method === 'POST' && url.pathname === '/v1/call') {
        const { name, arguments: args } = JSON.parse((await body(req)).toString());
        let agent; try { agent = authorize(cfg, bearer, name, args?.shop); } catch { return reply(res, 403, { error: 'Access denied' }); }
        const result = await execute(cfg, vault, api, agent, name, args);
        return reply(res, 200, { result });
      }
      return reply(res, 404, { error: 'Not found' });
    } catch (error) {
      // Never include request bodies, access tokens, or upstream response bodies in logs.
      return reply(res, 400, { error: error instanceof SyntaxError ? 'Invalid JSON' : error.message });
    }
  });
  const drain = dispatcher(registry);
  const timer = setInterval(() => drain().catch(() => {}), 5000); timer.unref();
  server.on('close', () => clearInterval(timer));
  server.registry = registry;
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cfg = config();
  const server = app(cfg);
  server.requestTimeout = 30000; server.headersTimeout = 10000;
  const option = name => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; };
  server.listen(Number(option('--port') || process.env.PORT || 3000), option('--host') || process.env.HOST || '127.0.0.1', () => console.log('Var80 Store Ops backend started'));
}
