import {accountIdentity} from './identity.js';
const ACCOUNT_COOKIE='__Host-nalmuk_session';
const SESSION_SECONDS=30*24*60*60;
const aHex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const aRandom=()=>aHex(crypto.getRandomValues(new Uint8Array(32)));
const aDigest=async text=>aHex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))));
const aKey=name=>'accounts-v1/'+name+'.json';
const aSessionKey=async value=>'sessions-v1/'+await aDigest(value)+'.json';
function authError(message,status=400){const e=Error(message);e.status=status;return e;}
export function normalizeAccount(input){
 const name=String(input||'').trim().toLowerCase().replace(/@nalmuk\.com$/,'');
 if(!/^[a-z][a-z0-9_]{2,19}$/.test(name))throw authError('아이디는 영문으로 시작하는 영문·숫자·밑줄 3~20자입니다.');return name;
}
function validPassword(value){if(typeof value!=='string'||value.length<10||value.length>128)throw authError('비밀번호는 10~128자로 입력하세요.');}
async function passwordHash(password,salt){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return aHex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},material,256)));}
function equalHash(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
const userView=a=>({id:a.uid,name:a.name,email:a.name+'@NALMUK.COM',importedLegacy:!!a.importedLegacy});
export function sessionCookie(value,maxAge=SESSION_SECONDS){return ACCOUNT_COOKIE+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge;}
function readSessionCookie(req){const value=req.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(ACCOUNT_COOKIE+'='))?.slice(ACCOUNT_COOKIE.length+1);return /^[0-9a-f]{64}$/.test(value||'')?value:null;}
async function limitAuth(req,env,name,kind){
 const ip=req.headers.get('CF-Connecting-IP')||'unavailable';const rules=[{key:'ip:'+ip,limit:60,window:600000},{key:kind+':'+name,limit:12,window:600000}];
 for(const rule of rules){const k='auth-limits-v1/'+await aDigest(rule.key)+'.json';let saved=false;
  for(let i=0;i<8;i++){const obj=await env.BUCKET.get(k),previous=obj?await obj.json():null,now=Date.now(),r=previous&&previous.until>now?previous:{count:0,until:now+rule.window};if(r.count>=rule.limit)throw authError('로그인 시도가 많습니다. 10분 후 다시 시도하세요.',429);r.count++;saved=await env.BUCKET.put(k,JSON.stringify(r),{onlyIf:obj?{etagMatches:obj.etag}:{etagDoesNotMatch:'*'}});if(saved)break;}if(!saved)throw authError('인증 요청을 처리 중입니다. 잠시 후 다시 시도하세요.',429);
 }
}
// Before the first session exists, atomically claim the old platform save once.
async function finalizeAccount(env,name){
 for(let i=0;i<8;i++){const object=await env.BUCKET.get(aKey(name));if(!object)throw authError('계정을 찾을 수 없습니다.',401);const a=await object.json();if(a.profileKey)return a;
  let profileKey=await aDigest('nalmuk:'+a.uid),imported=false;
  if(a.legacyCandidate){const k='legacy-claims-v1/'+a.legacyCandidate+'.json';const claim=await env.BUCKET.put(k,JSON.stringify({uid:a.uid,createdAt:Date.now()}),{onlyIf:{etagDoesNotMatch:'*'}});const owner=claim?{uid:a.uid}:await (await env.BUCKET.get(k)).json();if(owner.uid===a.uid){profileKey=a.legacyCandidate;imported=true;}}
  a.profileKey=profileKey;a.importedLegacy=imported;delete a.legacyCandidate;
  if(await env.BUCKET.put(aKey(name),JSON.stringify(a),{onlyIf:{etagMatches:object.etag}}))return a;
 }throw authError('계정 저장 중입니다. 로그인으로 다시 시도해 주세요.',409);
}
async function createSession(env,a){const value=aRandom(),now=Date.now();await env.BUCKET.put(await aSessionKey(value),JSON.stringify({name:a.name,uid:a.uid,version:a.authVersion,expiresAt:now+SESSION_SECONDS*1000}));return {user:userView(a),cookie:sessionCookie(value)};}
export async function gameAccount(req,env){
 const value=readSessionCookie(req);if(!value)return null;const object=await env.BUCKET.get(await aSessionKey(value));if(!object)return null;const s=await object.json();if(s.revoked||s.expiresAt<=Date.now())return null;
 const saved=await env.BUCKET.get(aKey(s.name));if(!saved)return null;const a=await saved.json();if(a.uid!==s.uid||a.authVersion!==s.version||!a.profileKey)return null;return {user:userView(a),profileKey:a.profileKey};
}
export async function accountAction(req,env,action,body){
 if(action==='logout'){const value=readSessionCookie(req);if(value)await env.BUCKET.put(await aSessionKey(value),JSON.stringify({revoked:true,expiresAt:0}));return {loggedOut:true,cookie:sessionCookie('',0)};}
 const name=normalizeAccount(body.email??body.name);await limitAuth(req,env,name,action);
 if(action==='register'){
  validPassword(body.password);const salt=aRandom(),recoveryCode=aRandom(),a={uid:aRandom(),name,salt,passwordHash:await passwordHash(body.password,salt),recoveryHash:await aDigest(recoveryCode),authVersion:1,createdAt:Date.now(),profileKey:null};
  if(body.importLegacy===true){const oldIdentity=await accountIdentity(req,env);if(oldIdentity){const oldKey=await aDigest(oldIdentity);if(await env.BUCKET.get('collection-v1/'+oldKey+'.json'))a.legacyCandidate=oldKey;}}
  const created=await env.BUCKET.put(aKey(name),JSON.stringify(a),{onlyIf:{etagDoesNotMatch:'*'}});if(!created)throw authError('이미 사용 중인 게임 이메일입니다. 다른 아이디를 선택하세요.',409);
  const ready=await finalizeAccount(env,name);return {...await createSession(env,ready),recoveryCode};
 }
 const obj=await env.BUCKET.get(aKey(name));let a=obj?await obj.json():null;
 if(action==='login'){
  validPassword(body.password);const calculated=await passwordHash(body.password,a?.salt||'nalmuk-unknown-account-salt');if(!a||!equalHash(a.passwordHash,calculated))throw authError('이메일 또는 비밀번호가 올바르지 않습니다.',401);
  const verifiedHash=a.passwordHash;a=await finalizeAccount(env,name);if(!equalHash(verifiedHash,a.passwordHash))throw authError('비밀번호가 변경되었습니다. 다시 로그인하세요.',401);return createSession(env,a);
 }
 if(action==='recover'){
  validPassword(body.password);const code=String(body.recoveryCode||'').trim().toLowerCase();if(!/^[a-f0-9]{64}$/.test(code)||!a||!equalHash(a.recoveryHash,await aDigest(code)))throw authError('이메일 또는 복구 코드가 올바르지 않습니다.',401);
  const recoveryCode=aRandom(),salt=aRandom();a.salt=salt;a.passwordHash=await passwordHash(body.password,salt);a.recoveryHash=await aDigest(recoveryCode);a.authVersion++;
  if(!await env.BUCKET.put(aKey(name),JSON.stringify(a),{onlyIf:{etagMatches:obj.etag}}))throw authError('계정 정보가 변경되었습니다. 다시 시도하세요.',409);
  a=await finalizeAccount(env,name);return {...await createSession(env,a),recoveryCode};
 }
 throw authError('지원하지 않는 계정 요청입니다.',404);
}
