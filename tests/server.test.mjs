import test from 'node:test';import assert from 'node:assert/strict';
import {api} from '../src/server.js';import {PRESETS} from '../src/core.js';import {CARD_DATABASE} from '../src/cards.js';
export class MemoryBucket{constructor(){this.rows=new Map();this.v=0;}async get(k){const r=this.rows.get(k);return r?{etag:r.etag,json:async()=>JSON.parse(r.body)}:null;}async put(k,body,o){const prev=this.rows.get(k);if(o?.onlyIf?.etagDoesNotMatch==='*'&&prev)return null;if(o?.onlyIf?.etagMatches&&prev?.etag!==o.onlyIf.etagMatches)return null;const row={body,etag:String(++this.v)};this.rows.set(k,row);return row;}}
export function harness(){const env={BUCKET:new MemoryBucket()},sessions=new Map();
 async function send(path,method,body,token,cookie,user){const r=await api(new Request('https://duel.test/api'+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(user?{'oai-authenticated-user-id':user}:{}),...(body?{'Content-Type':'application/json','Origin':'https://duel.test'}:{}),...(token?{'X-Duel-Token':token}:{})},body:body?JSON.stringify(body):undefined}),env);return {...await r.json(),httpStatus:r.status,cookie:r.headers.get('Set-Cookie')?.split(';')[0]};}
 async function call(path,method='GET',body=null,token=null,user='A'){
  if(user&&!sessions.has(user))sessions.set(user,send('/auth/register','POST',{email:'test_'+user.toLowerCase(),password:'testing-password-123'},null,null,user).then(r=>r.cookie));
  return send(path,method,body,token,user?await sessions.get(user):null,user);
 }return {env,call};}

const deck=PRESETS[0].cards;
test('online rooms: identity, hidden cards, races, rewards for both seats exactly once',async()=>{
 const {call}=harness(),h=await call('/rooms','POST',{name:'A',deck});assert.equal(h.httpStatus,201);assert.equal(h.token.length,64);
 assert.equal((await call('/rooms/'+h.code)).httpStatus,403);
 assert.equal((await call('/rooms/'+h.code,'GET',null,h.token,'thief')).httpStatus,403);
 assert.equal((await call('/rooms/'+h.code+'/join','POST',{name:'B',deck},null,'A')).httpStatus,409);
 const g=await call('/rooms/'+h.code+'/join','POST',{name:'B',deck},null,'B');assert.equal(g.seat,1);assert.ok(g.state.players[0].hand.every(x=>!x.id));
 const state=await call('/rooms/'+h.code,'GET',null,h.token);assert.ok(state.state.players[1].hand.every(x=>!x.id));assert.ok(!JSON.stringify(state).includes('tokenHash'));assert.ok(!JSON.stringify(state).includes('account'));
 const active=state.state.active,t=active?g.token:h.token,u=active?'B':'A',move={version:state.version,action:{type:'draw',pick:1}};
 const race=await Promise.all([call('/rooms/'+h.code+'/action','POST',move,t,u),call('/rooms/'+h.code+'/action','POST',move,t,u)]);assert.equal(race.filter(x=>x.httpStatus===409).length,1);
 const latest=await call('/rooms/'+h.code,'GET',null,t,u);assert.equal(latest.state.players[active].hand.length,5);
 const finish=await call('/rooms/'+h.code+'/action','POST',{version:latest.version,action:{type:'concede'}},t,u);assert.equal(finish.state.status,'over');assert.equal(finish.profile.points,1);assert.equal(finish.profile.packs.length,2);assert.equal(finish.reward.points,1);
 const again=await Promise.all(Array.from({length:6},()=>call('/rooms/'+h.code,'GET',null,t,u)));for(const x of again){assert.equal(x.profile.points,1);assert.equal(x.profile.matches,1);}
 const other=await call('/profile','GET',null,null,active?'A':'B');assert.equal(other.profile.points,1);assert.equal(other.profile.packs.length,2);
});
test('concurrent joins admit one guest, owned decks enforced',async()=>{
 const {call}=harness(),h=await call('/rooms','POST',{deck});const race=await Promise.all(['B','C'].map(user=>call('/rooms/'+h.code+'/join','POST',{deck},null,user)));assert.equal(race.filter(x=>x.state).length,1);assert.equal(race.filter(x=>x.httpStatus===409).length,1);
 const bad=[...deck];bad[0]=150;assert.equal((await call('/rooms','POST',{deck:bad})).httpStatus,400);
});
test('anonymous, cross-origin, invalid payload, expiry and unplayed rewards rejected',async()=>{
 const {call,env}=harness();assert.equal((await call('/profile','GET',null,null,null)).httpStatus,401);
 assert.equal((await call('/rooms','POST',{deck:[1]})).httpStatus,400);
 const cross=await api(new Request('https://duel.test/api/packs/open',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://evil.test','oai-authenticated-user-id':'A'},body:'{"packId":"starter"}'}),env);assert.equal(cross.status,403);
 assert.equal((await call('/rooms','POST',{deck,name:'a'.repeat(9000)})).httpStatus,400);
 const h=await call('/rooms','POST',{deck});assert.equal((await call('/profile')).profile.points,0);
 const row=env.BUCKET.rows.get('duel-v4/'+h.code+'.json'),data=JSON.parse(row.body);data.expiresAt=0;row.body=JSON.stringify(data);assert.equal((await call('/rooms/'+h.code,'GET',null,h.token)).httpStatus,410);
});
test('starter pack, concurrent opening, ownership and duplicate XP persist',async()=>{
 const {call,env}=harness();const initial=await Promise.all([call('/profile'),call('/profile')]);for(const x of initial){assert.equal(x.profile.owned.length,12);assert.equal(x.profile.packs.length,1);}
 const row=[...env.BUCKET.rows.values()].find(r=>JSON.parse(r.body).schema===1),p=JSON.parse(row.body);p.owned=CARD_DATABASE.map(c=>c.id);row.body=JSON.stringify(p);
 const r=await Promise.all([call('/packs/open','POST',{packId:'starter'}),call('/packs/open','POST',{packId:'starter'})]);assert.deepEqual(r[0].receipt,r[1].receipt);assert.equal(r[0].receipt.cards.length,3);assert.ok(r[0].receipt.cards.every(c=>c.duplicate));
 const after=(await call('/profile')).profile;assert.equal(after.xp,r[0].receipt.xp);assert.equal(after.packs.length,0);assert.equal(after.opened.length,1);assert.equal(after.owned.length,300);
 assert.equal((await call('/packs/open','POST',{packId:'nonexistent'})).httpStatus,400);
 assert.equal((await call('/profile','GET',null,null,'B')).profile.xp,0);
});
test('atomic purchase, idempotent retries, overspend and stale replay protection',async()=>{
 const {call,env}=harness();await call('/profile');const row=[...env.BUCKET.rows.values()].find(r=>JSON.parse(r.body).schema===1),p=JSON.parse(row.body);p.points=100;row.body=JSON.stringify(p);
 const body={type:'epic',requestId:'purchase-1234567890',revision:0};const result=await Promise.all([call('/packs/buy','POST',body),call('/packs/buy','POST',body)]);assert.ok(result.every(x=>x.httpStatus===200));assert.deepEqual(result[0].purchase,result[1].purchase);assert.equal((await call('/profile')).profile.points,0);
 assert.equal((await call('/packs/buy','POST',{type:'normal',requestId:'purchase-9999999999',revision:1})).httpStatus,400);
 const receipt=await call('/packs/open','POST',{packId:result[0].purchase.packId});assert.equal(receipt.receipt.cards.length,5);
 const replay=await call('/packs/buy','POST',body);assert.equal(replay.profile.points,0);assert.equal(replay.profile.packs.length,1);
 assert.equal((await call('/packs/buy','POST',{...body,type:'rare'})).httpStatus,400);
 const {call:call2,env:env2}=harness();await call2('/profile');const row2=[...env2.BUCKET.rows.values()].find(r=>JSON.parse(r.body).schema===1),p2=JSON.parse(row2.body);p2.points=10;row2.body=JSON.stringify(p2);
 const races=await Promise.all(['aaaaaaaaaaaaaaaa','bbbbbbbbbbbbbbbb'].map(requestId=>call2('/packs/buy','POST',{type:'normal',requestId,revision:0})));assert.equal(races.filter(x=>x.httpStatus===200).length,1);assert.equal((await call2('/profile')).profile.points,0);
});
test('hosting can close before a guest joins, never grants rewards, and cannot close a live duel',async()=>{
 const {call}=harness(),h=await call('/rooms','POST',{deck});
 assert.equal((await call('/rooms/'+h.code+'/close','POST',{},null,'B')).httpStatus,403);
 assert.equal((await call('/rooms/'+h.code+'/close','POST',{},h.token)).closed,true);
 assert.equal((await call('/rooms/'+h.code+'/join','POST',{deck},null,'B')).httpStatus,410);
 assert.equal((await call('/profile')).profile.points,0);
 const next=await call('/rooms','POST',{deck});const g=await call('/rooms/'+next.code+'/join','POST',{deck},null,'B');
 assert.equal((await call('/rooms/'+next.code+'/close','POST',{},g.token,'B')).httpStatus,403);
 assert.equal((await call('/rooms/'+next.code+'/close','POST',{},next.token)).httpStatus,409);
});
test('simultaneous host close and guest join commit exactly one outcome',async()=>{
 const {call}=harness(),h=await call('/rooms','POST',{deck});const results=await Promise.all([call('/rooms/'+h.code+'/close','POST',{},h.token),call('/rooms/'+h.code+'/join','POST',{deck},null,'B')]);assert.equal(results.filter(x=>x.httpStatus===200).length,1);assert.equal(results.filter(x=>[409,410].includes(x.httpStatus)).length,1);assert.equal((await call('/profile')).profile.points,0);
});
