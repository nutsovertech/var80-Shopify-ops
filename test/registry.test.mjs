import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { config, Vault, authorize, execute } from '../src/core.mjs';
import { Registry } from '../src/registry.mjs';
import { dispatcher, publicAddress } from '../src/relay.mjs';
import { app } from '../src/server.mjs';
const op = 'test-operator-with-at-least-thirty-two-characters';
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'var80-registry-')); t.after(() => rmSync(dir,{recursive:true,force:true}));
  const cfg = config({ APP_URL:'http://localhost:3000', SHOPIFY_CLIENT_ID:'client', SHOPIFY_CLIENT_SECRET:'secret', TOKEN_ENCRYPTION_KEY:'ab'.repeat(32), OPERATOR_TOKEN:op, DATA_DIR:dir, ENABLE_PRODUCT_WRITES:'true', WEBHOOK_ALLOWED_HOSTS:'bots.example.com' });
  const vault = new Vault(dir,cfg.encryptionKey), registry = new Registry(cfg,vault);
  return {cfg,vault,registry};
}
function setup(f) {
  const a=f.registry.createClient({name:'Client A'}), b=f.registry.createClient({name:'Client B'});
  f.registry.addStore({client_id:a.id,shop:'a-store.myshopify.com'}); f.registry.addStore({client_id:b.id,shop:'b-store.myshopify.com'});
  const bot=f.registry.createBot({name:'Shared bot'});
  f.registry.updateBot(bot.id,{grants:[{shop:'a-store.myshopify.com',tools:['products_list','product_update'],writes:true,events:['products/update']},{shop:'b-store.myshopify.com',tools:['shop_info'],writes:false,events:[]}]});
  return {a,b,bot};
}
test('persistent registry bootstraps empty and encrypts bot secrets at rest',t=>{
  const f=fixture(t);const {bot}=setup(f);
  assert.ok(!readFileSync(join(f.cfg.dir,'registry.enc'),'utf8').includes(bot.token));
  const reopened=new Registry(f.cfg,f.vault); assert.equal(reopened.data.clients.length,2); assert.equal(reopened.agent(bot.token).id,bot.id);
});
test('per-store tool grants cannot be widened by the union of another store’s tools',async t=>{
  const f=fixture(t);const {bot}=setup(f);
  assert.equal(authorize(f.cfg,bot.token,'products_list','a-store.myshopify.com').id,bot.id);
  assert.throws(()=>authorize(f.cfg,bot.token,'products_list','b-store.myshopify.com'),/Access denied/);
  let calls=0; const api={graphql:async()=>{calls++;}};
  await assert.rejects(execute(f.cfg,f.vault,api,f.registry.agent(bot.token),'product_update',{shop:'a-store.myshopify.com',product_id:'gid://shopify/Product/1',title:'test',dry_run:false}),/disabled/);
  assert.equal(calls,0);
});
test('client snapshots and mutations cannot cross tenant boundaries; portal rotation revokes existing sessions',t=>{
  const f=fixture(t);const {a,b,bot}=setup(f), portal=f.registry.portalKey(a.id),actor=f.registry.actor(portal.token);
  const snapshot=f.registry.snapshot(actor);
  assert.deepEqual(snapshot.clients.map(c=>c.id),[a.id]); assert.equal(snapshot.stores.length,1);
  assert.equal(snapshot.bots[0].grants.length,1); assert.equal(JSON.stringify(snapshot).includes(b.id),false);
  assert.equal(JSON.stringify(snapshot).includes('token_sha256'),false); assert.equal(JSON.stringify(snapshot).includes(bot.token),false);
  assert.throws(()=>f.registry.updateStore(actor,'b-store.myshopify.com',{active:false}),/Access denied/);
  assert.throws(()=>f.registry.addStore({client_id:a.id,shop:'b-store.myshopify.com'}),/already/);
  f.registry.portalKey(a.id); assert.equal(f.registry.validActor(actor),false);
});
test('bot rotation, bot pause and client pause take effect without a restart',t=>{
  const f=fixture(t);const {a,bot}=setup(f);
  const rotated=f.registry.rotateBot(bot.id); assert.equal(f.registry.agent(bot.token),null); assert.ok(f.registry.agent(rotated.token));
  f.registry.updateBot(bot.id,{active:false}); assert.equal(f.registry.agent(rotated.token),null);
  f.registry.updateBot(bot.id,{active:true}); f.registry.updateClient(a.id,{active:false});
  assert.throws(()=>authorize(f.cfg,rotated.token,'products_list','a-store.myshopify.com'),/Access denied/);
});
test('relay deduplicates signed event identifiers, retries failures, and cancels revoked grants',async t=>{
  const f=fixture(t);const {bot}=setup(f),shop='a-store.myshopify.com';
  f.vault.set(shop,{access_token:'test-token',installed_at:Date.now()});
  f.registry.updateBot(bot.id,{webhook:{url:'https://bots.example.com/routine',secret:'s'.repeat(40)}});
  f.registry.enqueue(shop,'products/update',{id:1,email:'private@example.com'},'event-1');f.registry.enqueue(shop,'products/update',{id:1},'event-1');
  assert.equal(f.registry.data.deliveries.length,1);assert.equal(JSON.stringify(f.registry.data.deliveries).includes('private@example.com'),false);
  let n=0;const drain=dispatcher(f.registry,async()=>++n===1?500:200);
  await drain();assert.equal(f.registry.data.deliveries[0].status,'retry');
  f.registry.data.deliveries[0].next_at=0;await drain();assert.equal(f.registry.data.deliveries[0].status,'delivered');
  f.registry.enqueue(shop,'products/update',{id:2},'event-2');f.registry.updateBot(bot.id,{grants:[]});await drain();assert.equal(f.registry.data.deliveries[1].status,'cancelled');
});
test('webhook destinations reject private URLs, URL credentials and non-allowlisted hosts',t=>{
  const f=fixture(t);const {bot}=setup(f);
  for(const url of ['http://bots.example.com/x','https://evil.example/x','https://user:pass@bots.example.com/x','https://bots.example.com/x?token=secret']) assert.throws(()=>f.registry.updateBot(bot.id,{webhook:{url,secret:'s'.repeat(40)}}));
  for(const address of ['127.0.0.1','10.1.2.3','169.254.169.254','192.168.2.3','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001::1','2001:20::1','3fff::1'])assert.equal(publicAddress(address),false,address);
  assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
});
async function httpFixture(t){
  const f=fixture(t);const server=app(f.cfg);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const url=`http://127.0.0.1:${server.address().port}`;
  return {...f,registry:server.registry,call:(path,opts)=>fetch(url+path,opts)};
}
test('console sessions require CSRF, reject agent credentials and limit client administration',async t=>{
  const f=await httpFixture(t);const {a,bot}=setup(f);
  const post=(data,headers={})=>({method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
  assert.equal((await f.call('/api/login',post({key:bot.token}))).status,401);
  const login=await f.call('/api/login',post({key:op})),cookie=login.headers.get('set-cookie').split(';')[0],{csrf}=await login.json();
  assert.equal((await f.call('/api/clients',post({name:'Blocked'},{Cookie:cookie}))).status,403);
  assert.equal((await f.call('/api/clients',post({name:'Allowed'},{Cookie:cookie,'X-CSRF-Token':csrf}))).status,200);
  const portal=f.registry.portalKey(a.id);
  assert.equal((await f.call('/api/bots',post({name:'Unauthorized'},{Authorization:`Bearer ${portal.token}`}))).status,403);
  const scoped=await(await f.call('/api/overview',{headers:{Authorization:`Bearer ${portal.token}`}})).json();assert.equal(scoped.clients.length,1);
});
test('public compliance webhooks authenticate, redact local records and preserve pending fulfillment cases',async t=>{
  const f=await httpFixture(t);setup(f);const shop='a-store.myshopify.com';f.vault.set(shop,{access_token:'test',installed_at:1});
  async function webhook(topic,event,payload,valid=true){const raw=JSON.stringify(payload);return f.call('/webhooks/compliance',{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Shop-Domain':shop,'X-Shopify-Topic':topic,'X-Shopify-Event-Id':event,'X-Shopify-Hmac-Sha256':valid?createHmac('sha256',f.cfg.secret).update(raw).digest('base64'):'wrong'},body:raw});}
  assert.equal((await webhook('shop/redact','one',{shop_domain:shop},false)).status,401);assert.ok(f.vault.get(shop));
  assert.equal((await webhook('customers/data_request','two',{shop_domain:shop,customer:{id:123},data_request:{id:456},orders_requested:[789]})).status,200);
  assert.equal(f.registry.data.compliance[0].status,'pending');assert.equal(f.registry.data.compliance[0].payload.customer_id,123);
  assert.equal((await webhook('customers/redact','three',{shop_domain:shop})).status,200);assert.equal(f.registry.data.compliance[0].payload,undefined);
  assert.equal((await webhook('shop/redact','four',{shop_domain:shop})).status,200);assert.equal(f.vault.get(shop),null);assert.equal(f.registry.store(shop),undefined);
});
