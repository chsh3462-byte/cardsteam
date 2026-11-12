import {createGame,applyAction,viewGame} from './core.js';
import {createProfile,profileView,ownedDeck,openPack,buyPack,rewardMatch} from './progression.js';
import {accountAction,gameAccount} from './accounts.js';
const TTL=24*60*60*1000;
const json=(value,status=200,extra={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const token=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const hash=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
const key=code=>'duel-v4/'+code+'.json';
const cleanName=x=>typeof x==='string'?x.replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,14)||'결투가':'결투가';
async function payload(req){let bytes=0,parts=[];const reader=req.body?.getReader();if(!reader)throw Error('요청이 비어 있습니다.');for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>8192){await reader.cancel();throw Error('요청이 너무 큽니다.');}parts.push(value);}const all=new Uint8Array(bytes);let at=0;parts.forEach(p=>{all.set(p,at);at+=p.length;});return JSON.parse(new TextDecoder().decode(all));}
function publicRoom(room,seat){return {code:room.code,version:room.version,seat,expiresAt:room.expiresAt,status:room.status,hostName:room.host.name,state:room.game?viewGame(room.game,seat):null};}
const accountKey=id=>'collection-v1/'+id+'.json';
async function readProfile(env,id){
 const path=accountKey(id);let object=await env.BUCKET.get(path);
 if(!object){await env.BUCKET.put(path,JSON.stringify(createProfile()),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});object=await env.BUCKET.get(path);}
 if(!object)throw Error('수집 정보를 불러오지 못했습니다.');return {p:await object.json(),etag:object.etag};
}
async function updateProfile(env,id,operation){
 for(let attempt=0;attempt<8;attempt++){
  const {p,etag}=await readProfile(env,id),before=JSON.stringify(p),result=operation(p);
  if(JSON.stringify(p)===before)return {profile:profileView(p),result};
  p.revision++;const saved=await env.BUCKET.put(accountKey(id),JSON.stringify(p),{onlyIf:{etagMatches:etag},httpMetadata:{contentType:'application/json'}});
  if(saved)return {profile:profileView(p),result};
 }throw Error('다른 수집 요청을 처리 중입니다. 잠시 후 다시 시도하세요.');
}
async function roomResponse(room,seat,env,extra={}){
 const data={...publicRoom(room,seat),...extra};
 if(room.status==='over'){
  const id=(seat===0?room.host:room.guest).account;
  const settled=await updateProfile(env,id,p=>rewardMatch(p,room.code));data.profile=settled.profile;data.reward=settled.result;
 }return data;
}
export async function api(req,env){
 try{
  if(!env.BUCKET)return json({error:'대전 저장소가 연결되지 않았습니다. 잠시 후 다시 시도해 주세요.'},503);
  const path=new URL(req.url).pathname;
  if(path==='/api/health')return json({ok:true,mode:'rune-contract-v3'});
  if(req.method==='POST'){
   const origin=req.headers.get('Origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'잘못된 요청 출처입니다.'},403);
   if(!req.headers.get('Content-Type')?.includes('application/json'))return json({error:'JSON 요청만 지원합니다.'},415);
  }
  const authRoute=path.match(/^\/api\/auth\/(register|login|logout|recover)$/);
  if(authRoute&&req.method==='POST'){const result=await accountAction(req,env,authRoute[1],await payload(req));const cookie=result.cookie;delete result.cookie;return json(result,200,{'Set-Cookie':cookie});}
  const signedIn=await gameAccount(req,env);if(!signedIn)return json({error:'NAL-MUK-CARD 계정으로 로그인해 주세요.'},401);
  const expectedAccount=req.headers.get('X-Nalmuk-Account');if(expectedAccount&&expectedAccount!==signedIn.user.id)return json({error:'이 브라우저의 로그인 계정이 바뀌었습니다. 다시 로그인해 주세요.'},401);
  const account=signedIn.profileKey;
  if(path==='/api/profile'&&req.method==='GET')return json({user:signedIn.user,profile:profileView((await readProfile(env,account)).p)});
  if(path==='/api/profile/settings'&&req.method==='POST'){
   const body=await payload(req);const result=await updateProfile(env,account,p=>{const deck=ownedDeck(body.deck,p);p.settings={deck,name:cleanName(body.name)};return {saved:true};});return json({profile:result.profile,saved:true});
  }
  if(path==='/api/packs/open'&&req.method==='POST'){const body=await payload(req);const result=await updateProfile(env,account,p=>openPack(p,body.packId));return json({profile:result.profile,receipt:result.result});}
  if(path==='/api/packs/buy'&&req.method==='POST'){const body=await payload(req);const result=await updateProfile(env,account,p=>buyPack(p,body.type,body.requestId,body.revision));return json({profile:result.profile,purchase:result.result});}
  if(path==='/api/rooms'&&req.method==='POST'){
   const body=await payload(req),deck=ownedDeck(body.deck,(await readProfile(env,account)).p),t=token(),th=await hash(t);
   for(let attempt=0;attempt<4;attempt++){
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const code=Array.from(crypto.getRandomValues(new Uint8Array(8)),x=>alphabet[x%32]).join('');
    const room={code,version:1,status:'waiting',expiresAt:Date.now()+TTL,host:{name:cleanName(body.name),deck,tokenHash:th,account},guest:null,game:null};
    const result=await env.BUCKET.put(key(code),JSON.stringify(room),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
    if(result)return json({...publicRoom(room,0),token:t},201);
   }return json({error:'방 생성이 지연되고 있습니다. 다시 시도해 주세요.'},503);
  }
  const match=path.match(/^\/api\/rooms\/([A-HJ-NP-Z2-9]{8})(?:\/(join|action|close))?$/);if(!match)return json({error:'대전 주소를 확인해 주세요.'},404);
  const object=await env.BUCKET.get(key(match[1]));if(!object)return json({error:'방을 찾을 수 없습니다. 코드를 확인해 주세요.'},404);
  const room=await object.json();if(room.status==='closed')return json({error:'호스트가 이 방을 종료했습니다. 새로운 접속 주소를 받아 주세요.'},410);if(room.expiresAt<Date.now())return json({error:'이 방은 만료되었습니다. 새 방을 만들어 주세요.'},410);
  const t=req.headers.get('X-Duel-Token')||'';const th=t.length===64?await hash(t):'';const seat=room.host.tokenHash===th?0:room.guest?.tokenHash===th?1:-1;
  if(match[2]==='join'&&req.method==='POST'){
   if(seat>=0){if((seat===0?room.host:room.guest).account!==account)return json({error:'다른 계정의 참가 정보입니다.'},403);return json(await roomResponse(room,seat,env));}if(room.status!=='waiting')return json({error:'이미 두 명이 참가한 방입니다.'},409);
   if(room.host.account===account)return json({error:'같은 계정으로 양쪽 자리에 참가할 수 없습니다. 친구의 계정으로 입장하세요.'},409);
   const body=await payload(req),deck=ownedDeck(body.deck,(await readProfile(env,account)).p),guestToken=token();room.guest={name:cleanName(body.name),deck,tokenHash:await hash(guestToken),account};
   room.game=createGame(room.host,room.guest);room.status='playing';room.version++;
   const saved=await env.BUCKET.put(key(room.code),JSON.stringify(room),{onlyIf:{etagMatches:object.etag},httpMetadata:{contentType:'application/json'}});
   if(!saved)return json({error:'다른 플레이어가 먼저 입장했습니다.'},409);
   return json({...publicRoom(room,1),token:guestToken});
  }
  if(seat<0||(seat===0?room.host:room.guest).account!==account)return json({error:'이 방의 참가 정보가 없습니다. 방 코드로 입장해 주세요.'},403);
  if(match[2]==='close'&&req.method==='POST'){
   if(seat!==0)return json({error:'호스트만 방을 종료할 수 있습니다.'},403);
   if(room.status!=='waiting')return json({error:'이미 대전이 시작되었습니다. 대전 화면에서 나가기를 선택하세요.'},409);
   room.status='closed';room.version++;
   const saved=await env.BUCKET.put(key(room.code),JSON.stringify(room),{onlyIf:{etagMatches:object.etag},httpMetadata:{contentType:'application/json'}});
   if(!saved)return json({error:'상대가 입장했습니다. 대전 화면을 확인하세요.'},409);
   return json({closed:true});
  }
  if(!match[2]&&req.method==='GET')return json(await roomResponse(room,seat,env));
  if(match[2]==='action'&&req.method==='POST'){
   const body=await payload(req);if(body.version!==room.version)return json({error:'대전 상태가 바뀌었습니다. 갱신 후 다시 선택하세요.'},409);
   if(!room.game)throw Error('상대의 입장을 기다려 주세요.');
   room.game=applyAction(room.game,seat,body.action||{});room.status=room.game.status;room.version++;
   const saved=await env.BUCKET.put(key(room.code),JSON.stringify(room),{onlyIf:{etagMatches:object.etag},httpMetadata:{contentType:'application/json'}});
   if(!saved)return json({error:'동시에 들어온 요청이 있습니다. 갱신 후 다시 선택하세요.'},409);
   if(room.status==='over')await Promise.allSettled([room.host,room.guest].map(player=>updateProfile(env,player.account,p=>rewardMatch(p,room.code))));
   return json(await roomResponse(room,seat,env));
  }
  return json({error:'지원하지 않는 요청입니다.'},405);
 }catch(e){if(e instanceof SyntaxError)return json({error:'요청 형식이 올바르지 않습니다.'},400);if(e.message?.startsWith('R2')||e.message?.includes('bucket'))return json({error:'대전 서버에 연결할 수 없습니다. 다시 시도해 주세요.'},503);return json({error:e.message||'요청을 처리할 수 없습니다.'},[401,409,429].includes(e.status)?e.status:400);}
}
