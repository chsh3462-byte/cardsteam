import test from 'node:test';import assert from 'node:assert/strict';import {accountIdentity} from '../src/identity.js';
const b64=data=>Buffer.from(typeof data==='string'?data:JSON.stringify(data)).toString('base64url');
test('Sites rejects anonymous; standalone ignores spoofed identity and validates Access JWT signatures',async()=>{
 const req=(headers={})=>new Request('https://duel.test/api/profile',{headers});assert.equal(await accountIdentity(req(),{}),null);assert.equal(await accountIdentity(req({'oai-authenticated-user-id':'alice'}),{}),'alice');
 const env={AUTH_MODE:'cloudflare-access',ACCESS_TEAM_DOMAIN:'duel-test.cloudflareaccess.com',ACCESS_AUD:'audience-id'};
 assert.equal(await accountIdentity(req({'oai-authenticated-user-id':'forged'}),env),null);
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);jwk.kid='test-key';const original=globalThis.fetch;globalThis.fetch=async url=>{assert.equal(url,'https://duel-test.cloudflareaccess.com/cdn-cgi/access/certs');return Response.json({keys:[jwk]});};
 const make=async (changes={},alg='RS256')=>{const payload={iss:'https://duel-test.cloudflareaccess.com',aud:['audience-id'],sub:'alice',exp:Math.floor(Date.now()/1000)+300,...changes};const input=b64({alg,kid:'test-key'})+'.'+b64(payload);return input+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(input))).toString('base64url');};
 const identity=async jwt=>accountIdentity(req({'Cf-Access-Jwt-Assertion':jwt}),env);
 try{assert.equal(await identity(await make()),'access:duel-test.cloudflareaccess.com:alice');for(const change of [{iss:'https://evil.test'},{aud:['other']},{exp:0},{exp:'9999999999'},{sub:''},{nbf:9999999999}])assert.equal(await identity(await make(change)),null);assert.equal(await identity(await make({},'none')),null);const jwt=await make();const parts=jwt.split('.');parts[1]=b64({sub:'admin',iss:'https://duel-test.cloudflareaccess.com',aud:['audience-id'],exp:9999999999});assert.equal(await identity(parts.join('.')),null);}finally{globalThis.fetch=original;}
});
