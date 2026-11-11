// Sites supplies trusted identity headers. Standalone Workers must verify Access JWTs.
const accessKeys=new Map();
const decodeJWT=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export async function accountIdentity(req,env){
 if(!env.AUTH_MODE||env.AUTH_MODE==='sites')return req.headers.get('oai-authenticated-user-id')||null;
 if(env.AUTH_MODE!=='cloudflare-access')throw Error('지원하지 않는 로그인 설정입니다.');
 const domain=env.ACCESS_TEAM_DOMAIN,aud=env.ACCESS_AUD;
 if(!domain||!aud||!/^[-a-z0-9]+\.cloudflareaccess\.com$/.test(domain))throw Error('서버 로그인 설정이 필요합니다.');
 const jwt=req.headers.get('Cf-Access-Jwt-Assertion');if(!jwt)return null;
 try{
  const parts=jwt.split('.');if(parts.length!==3)return null;
  const header=JSON.parse(new TextDecoder().decode(decodeJWT(parts[0]))),body=JSON.parse(new TextDecoder().decode(decodeJWT(parts[1])));
  const now=Math.floor(Date.now()/1000);if(header.alg!=='RS256'||body.iss!=='https://'+domain||!Array.isArray(body.aud)||!body.aud.includes(aud)||!Number.isFinite(body.exp)||body.exp<=now||body.nbf>now||!body.sub)return null;
  let cached=accessKeys.get(domain);if(!cached||cached.until<Date.now()||!cached.keys.some(k=>k.kid===header.kid)){const res=await fetch('https://'+domain+'/cdn-cgi/access/certs');if(!res.ok)return null;cached={keys:(await res.json()).keys,until:Date.now()+3600000};accessKeys.set(domain,cached);}
  const jwk=cached.keys.find(k=>k.kid===header.kid);if(!jwk)return null;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decodeJWT(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
  return valid?'access:'+domain+':'+body.sub:null;
 }catch{return null;}
}
