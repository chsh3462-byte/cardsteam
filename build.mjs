import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {CARD_DATABASE} from './src/cards.js';
const read=name=>fs.readFile(new URL(name,import.meta.url),'utf8');
const strip=s=>s.replace(/^import .+;\n/gm,'').replace(/^export \{[^}]+\};\n/gm,'').replace(/\bexport (?=(const|function|async function)\b)/g,'');
const cards=strip(await read('src/cards.js')),core=strip(await read('src/core.js')),server=strip(await read('src/server.js'));
const progression=strip(await read('src/progression.js')),identity=strip(await read('src/identity.js'));
const accounts=strip(await read('src/accounts.js'));
const artMeta={},artPayloads={};
const manifest=JSON.parse(await read('assets/v3/manifest.json'));
if(manifest.length!==12||CARD_DATABASE.length!==300)throw Error('All 12 artwork pages and 300 cards are required.');
const occupied=new Set();
for(const page of manifest){
 const {key,file,columns,rows,firstId,lastId}=page;
 if(columns!==5||rows!==5||lastId-firstId!==24)throw Error('Invalid 25-cell art page: '+key);
 const bytes=await fs.readFile(new URL('assets/v3/'+file,import.meta.url));
 const hash=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,16);
 const url=`/art/${key}-${hash}.webp`;artMeta[key]={url,columns,rows};artPayloads[url]={base64:bytes.toString('base64'),etag:'"'+hash+'"',mime:'image/webp'};
 for(let id=firstId;id<=lastId;id++){const c=CARD_DATABASE[id-1];if(!c||c.artSet!==key||c.art!==id-firstId)throw Error('Card artwork mismatch: '+id);const cell=c.artSet+':'+c.art;if(occupied.has(cell))throw Error('Reused card artwork: '+cell);occupied.add(cell);}
}
if(occupied.size!==300)throw Error('Every card must own a distinct illustration.');
const css=await read('src/style.css');
const client=[cards,'const C=CARD_BY_ID;','const ART_ASSETS='+JSON.stringify(artMeta)+';',core,progression,strip(await read('src/invites.js')),await read('src/pixels.js'),await read('src/card-art.js'),await read('src/client.js'),await read('src/collection-ui.js'),await read('src/account-ui.js')].join('\n');
const html=(await read('src/index.html')).replace('/*STYLE*/',css).replace('/*CLIENT*/',client.replaceAll('</script','<\\/script'));
const etag='"'+crypto.createHash('sha256').update(html).digest('hex').slice(0,24)+'"';
const output=[cards,'const C=CARD_BY_ID;',core,progression,identity,accounts,server,'const HTML='+JSON.stringify(html)+';','const ART_PAYLOADS='+JSON.stringify(artPayloads)+';',`
const artBytes=new Map();
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/'))return api(request,env);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const art=ART_PAYLOADS[url.pathname];
 if(art){const headers={'Content-Type':art.mime,'Cache-Control':'public, max-age=31536000, immutable','ETag':art.etag,'X-Content-Type-Options':'nosniff'};
  if(request.headers.get('If-None-Match')===art.etag)return new Response(null,{status:304,headers});
  if(request.method==='HEAD')return new Response(null,{headers});
  if(!artBytes.has(url.pathname))artBytes.set(url.pathname,Uint8Array.from(atob(art.base64),c=>c.charCodeAt(0)));
  return new Response(artBytes.get(url.pathname),{headers});
 }
 if(url.pathname==='/favicon.ico')return new Response(null,{status:204});
 if(url.pathname!=='/')return new Response('Not found',{status:404});
 const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','ETag':${JSON.stringify(etag)},'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'"};
 if(request.headers.get('If-None-Match')===headers.ETag)return new Response(null,{status:304,headers});
 return new Response(request.method==='HEAD'?null:HTML,{headers});
}};`].join('\n');
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});await fs.writeFile('dist/server/index.js',output);try{await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');}catch(e){if(e.code!=='ENOENT')throw e;}
await fs.rm('dist/index.html',{force:true});await fs.writeFile('dist/client-check.mjs',client);
console.log(`Built Worker (${output.length} characters), HTML ${html.length} characters, ${CARD_DATABASE.length} cards, ${manifest.length} image endpoints, 300 exclusive illustrations.`);
