import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { hash, equal } from './core.mjs';

const html = readFileSync(new URL('../web/index.html', import.meta.url));
const js = readFileSync(new URL('../web/app.js', import.meta.url));
const css = readFileSync(new URL('../web/style.css', import.meta.url));
export function consoleRoutes(cfg, registry, mintInstall) {
  const sessions = new Map(), attempts = new Map();
  const name = cfg.origin.startsWith('https:') ? '__Host-var80_session' : 'var80_session';
  const cookie = value => `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${value ? 28800 : 0}${cfg.origin.startsWith('https:') ? '; Secure' : ''}`;
  function actorFor(req, mutation) {
    const bearer = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
    if (bearer) { const actor = registry.actor(bearer); if (!actor) throw new Error('Unauthorized'); return actor; }
    const token = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`))?.slice(name.length + 1);
    const session = sessions.get(hash(token || ''));
    if (!session || session.expires < Date.now() || !registry.validActor(session.actor)) throw new Error('Unauthorized');
    if (mutation && !equal(req.headers['x-csrf-token'], session.csrf)) throw new Error('Invalid CSRF token');
    return { ...session.actor, csrf: session.csrf };
  }
  const admin = actor => { if (actor.role !== 'admin') throw new Error('Access denied'); };
  return async function handle(req, res, url, body, reply) {
    const security = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'", 'X-Frame-Options': 'DENY' };
    if (req.method === 'GET' && ['/', '/admin', '/client', '/assets/app.js', '/assets/style.css'].includes(url.pathname)) {
      const asset = url.pathname === '/assets/app.js' ? [js, 'application/javascript'] : url.pathname === '/assets/style.css' ? [css, 'text/css'] : [html, 'text/html'];
      res.writeHead(200, { ...security, 'Content-Type': `${asset[1]}; charset=utf-8` }); res.end(asset[0]); return true;
    }
    if (!url.pathname.startsWith('/api/')) return false;
    try {
      for (const [key, s] of sessions) if (s.expires < Date.now()) sessions.delete(key);
      for (const [key, a] of attempts) if (a.until < Date.now()) attempts.delete(key);
      if (req.method === 'POST' && url.pathname === '/api/login') {
        const ip = req.socket.remoteAddress || 'local', limit = attempts.get(ip) || { count: 0, until: Date.now() + 900000 };
        if (limit.count >= 10) { reply(res, 429, { error: 'Too many login attempts. Try again in 15 minutes.' }); return true; }
        limit.count++; attempts.set(ip, limit);
        const { key } = JSON.parse((await body(req)).toString());
        const actor = typeof key === 'string' ? registry.actor(key) : null;
        if (!actor) throw new Error('Unauthorized');
        if (sessions.size > 1000) throw new Error('Session capacity reached');
        const token = randomBytes(32).toString('base64url'), csrf = randomBytes(24).toString('hex');
        sessions.set(hash(token), { actor, csrf, expires: Date.now() + 28800000 });
        reply(res, 200, { role: actor.role, csrf }, { 'Set-Cookie': cookie(token) }); return true;
      }
      const mutation = !['GET', 'HEAD'].includes(req.method), actor = actorFor(req, mutation);
      let input = mutation ? JSON.parse((await body(req)).toString() || '{}') : {};
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid input');
      let result, match;
      if (req.method === 'GET' && url.pathname === '/api/overview') result = { ...registry.snapshot(actor), csrf: actor.csrf };
      else if (req.method === 'POST' && url.pathname === '/api/logout') {
        const token = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`))?.slice(name.length + 1);
        sessions.delete(hash(token || '')); reply(res, 200, { ok: true }, { 'Set-Cookie': cookie('') }); return true;
      }
      else if (req.method === 'POST' && url.pathname === '/api/clients') { admin(actor); result = registry.createClient(input); }
      else if ((match = /^\/api\/clients\/([^/]+)$/.exec(url.pathname)) && req.method === 'PATCH') { admin(actor); result = registry.updateClient(match[1], input); }
      else if ((match = /^\/api\/clients\/([^/]+)\/portal-key$/.exec(url.pathname)) && req.method === 'POST') { admin(actor); result = registry.portalKey(match[1]); }
      else if (req.method === 'POST' && url.pathname === '/api/stores') result = registry.addStore(actor.role === 'admin' ? input : { ...input, client_id: actor.client_id });
      else if ((match = /^\/api\/stores\/([^/]+)$/.exec(url.pathname)) && req.method === 'PATCH') result = registry.updateStore(actor, decodeURIComponent(match[1]), input);
      else if ((match = /^\/api\/stores\/([^/]+)\/install-link$/.exec(url.pathname)) && req.method === 'POST') { const shop = decodeURIComponent(match[1]); registry.assertStore(actor, shop); result = mintInstall(shop); }
      else if (req.method === 'POST' && url.pathname === '/api/bots') { admin(actor); result = registry.createBot(input); }
      else if ((match = /^\/api\/bots\/([^/]+)$/.exec(url.pathname)) && req.method === 'PATCH') { admin(actor); result = registry.updateBot(match[1], input); }
      else if ((match = /^\/api\/bots\/([^/]+)\/rotate-key$/.exec(url.pathname)) && req.method === 'POST') { admin(actor); result = registry.rotateBot(match[1]); }
      else if ((match = /^\/api\/deliveries\/([^/]+)\/retry$/.exec(url.pathname)) && req.method === 'POST') {
        admin(actor); const d = registry.data.deliveries.find(d => d.id === match[1]); if (!d || !['failed', 'cancelled'].includes(d.status)) throw new Error('Delivery cannot be retried'); d.status = 'pending'; d.attempts = 0; d.next_at = Date.now(); registry.save(); result = { ok: true };
      }
      else if ((match = /^\/api\/compliance\/([^/]+)$/.exec(url.pathname)) && req.method === 'GET') {
        admin(actor); const c = registry.data.compliance.find(c => c.id === match[1]); if (!c) throw new Error('Request not found'); result = c;
      }
      else if ((match = /^\/api\/compliance\/([^/]+)\/complete$/.exec(url.pathname)) && req.method === 'POST') {
        admin(actor); const c = registry.data.compliance.find(c => c.id === match[1]); if (!c) throw new Error('Request not found');
        if (typeof input.note !== 'string' || input.note.trim().length < 10 || input.note.length > 2000) throw new Error('Provide a resolution note of 10–2000 characters');
        c.status = 'completed'; c.completed_at = new Date().toISOString(); c.note = input.note; registry.save(); result = { ok: true };
      }
      else { reply(res, 404, { error: 'Not found' }); return true; }
      if (mutation) registry.vault.audit({ actor: actor.role === 'admin' ? 'operator' : actor.client_id, phase: 'configuration', method: req.method, path: url.pathname });
      reply(res, 200, result); return true;
    } catch (error) { const status = error.message === 'Unauthorized' ? 401 : /Access denied|CSRF/.test(error.message) ? 403 : 400; reply(res, status, { error: error instanceof SyntaxError ? 'Invalid JSON' : error.message }); return true; }
  };
}
