import { request } from 'node:https';
import { lookup } from 'node:dns';
import { isIP } from 'node:net';
import { createHmac } from 'node:crypto';

export function publicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b)) || (a === 198 && [18, 19, 51].includes(b)) || (a === 203 && b === 0));
  }
  if (isIP(address) === 6) {
    const s = address.toLowerCase();
    // Accept global-unicast only; exclude IPv4-mapped, local, multicast and documentation ranges.
    const parts = s.split(':');
    return /^[23]/.test(s) && !s.startsWith('2001:db8:') && !(parts[0] === '2001' && parseInt(parts[1] || '0', 16) < 0x200) && !s.startsWith('2002:') && !s.startsWith('3fff:');
  }
  return false;
}
export function deliverWebhook(url, secret, payload) {
  const body = JSON.stringify(payload), signature = createHmac('sha256', secret).update(body).digest('hex');
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: 'POST', timeout: 10000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), Authorization: `Bearer ${secret}`, 'X-Var80-Signature': `sha256=${signature}`, 'X-Var80-Event-Id': payload.event_id, 'User-Agent': 'Var80-Store-Ops/0.2' },
      lookup(host, options, cb) {
        lookup(host, { all: true }, (error, addresses) => {
          if (error) return cb(error);
          if (!addresses.length || addresses.some(a => !publicAddress(a.address))) return cb(new Error('Webhook DNS must resolve to public addresses'));
          // Pin the validated address to this request, avoiding a second DNS lookup.
          if (options.all) cb(null, [addresses[0]]); else cb(null, addresses[0].address, addresses[0].family);
        });
      }
    }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('timeout', () => req.destroy(new Error('Webhook timed out')));
    req.on('error', reject); req.end(body);
  });
}
export function dispatcher(registry, send = deliverWebhook) {
  let busy = false;
  return async function drain() {
    if (busy) return; busy = true;
    try {
      for (const d of registry.data.deliveries.filter(d => ['pending', 'retry'].includes(d.status) && d.next_at <= Date.now()).slice(0, 10)) {
        const b = registry.data.bots.find(b => b.id === d.bot_id);
        const connection = registry.vault.get(d.shop);
        if (!b?.active || !b.webhook || !connection || connection.revoked || !registry.isAllowed(d.shop) || !b.grants.some(g => g.shop === d.shop && g.events.includes(d.topic))) { d.status = 'cancelled'; registry.save(); continue; }
        d.attempts++; registry.save();
        try {
          const status = await send(b.webhook.url, b.webhook.secret, d.payload);
          d.http_status = status;
          if (status >= 200 && status < 300) { d.status = 'delivered'; d.delivered_at = new Date().toISOString(); }
          else throw new Error('Non-success response');
        } catch {
          d.status = d.attempts >= 5 ? 'failed' : 'retry';
          d.next_at = Date.now() + 30000 * 2 ** (d.attempts - 1);
        }
        registry.save();
      }
    } finally { busy = false; }
  };
}
