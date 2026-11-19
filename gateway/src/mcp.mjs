// Dependency-free stdio MCP bridge. One JSON-RPC message per line.
// Run on the agent host; it calls the authenticated backend over HTTP(S).
import { createInterface } from 'node:readline';
const endpoint = new URL(process.env.STORE_OPS_URL || 'http://127.0.0.1:3000');
if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(endpoint.hostname))) throw new Error('Use HTTPS for remote Store Ops');
if (!process.env.STORE_OPS_AGENT_TOKEN) throw new Error('Missing STORE_OPS_AGENT_TOKEN');
async function call(path, payload) {
  const response = await fetch(new URL(path, endpoint), { method: payload ? 'POST' : 'GET', headers: { Authorization: `Bearer ${process.env.STORE_OPS_AGENT_TOKEN}`, 'Content-Type': 'application/json' }, ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(30000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Backend error (${response.status})`);
  return data;
}
const send = obj => process.stdout.write(JSON.stringify(obj) + '\n');
for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  if (!line.trim()) continue;
  let msg;
  try { msg = JSON.parse(line); } catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); continue; }
  if (!msg || Array.isArray(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') { send({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } }); continue; }
  if (!Object.hasOwn(msg, 'id')) continue;
  try {
    let result;
    if (msg.method === 'initialize') result = { protocolVersion: ['2024-11-05', '2025-03-26', '2025-06-18'].includes(msg.params?.protocolVersion) ? msg.params.protocolVersion : '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'var80-store-ops', version: '0.1.0' } };
    else if (msg.method === 'ping') result = {};
    else if (msg.method === 'tools/list') result = await call('/v1/tools');
    else if (msg.method === 'tools/call') {
      try { const data = await call('/v1/call', msg.params); result = { content: [{ type: 'text', text: JSON.stringify(data.result) }] }; }
      catch (e) { result = { isError: true, content: [{ type: 'text', text: e.message }] }; }
    } else { send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } }); continue; }
    send({ jsonrpc: '2.0', id: msg.id, result });
  } catch (e) { send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: e.message } }); }
}
