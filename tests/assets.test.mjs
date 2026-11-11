import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {gzipSync} from 'node:zlib';
import worker from '../dist/server/index.js';import {CARD_DATABASE} from '../src/cards.js';
test('all300 illustrations map one-to-one to12 independently served WebP pages',async()=>{
 const manifest=JSON.parse(await fs.readFile('assets/v3/manifest.json','utf8'));assert.equal(manifest.length,12);assert.equal(new Set(CARD_DATABASE.map(c=>c.artSet+':'+c.art)).size,300);
 const res=await worker.fetch(new Request('https://duel.test/'),{}),html=await res.text();assert.equal(res.status,200);assert.ok(html.length<400000);assert.ok(!html.includes('data:image/'));const match=html.match(/const ART_ASSETS=(\{[^;]+\});/);assert.ok(match);const meta=JSON.parse(match[1]);assert.equal(Object.keys(meta).length,12);
 for(const page of manifest){const asset=meta[page.key];assert.ok(asset);const expected=await fs.readFile('assets/v3/'+page.file);const response=await worker.fetch(new Request('https://duel.test'+asset.url),{});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');const bytes=Buffer.from(await response.arrayBuffer());assert.deepEqual(bytes,expected);assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');const cached=await worker.fetch(new Request('https://duel.test'+asset.url,{headers:{'If-None-Match':response.headers.get('ETag')}}),{});assert.equal(cached.status,304);}
 for(const c of CARD_DATABASE){assert.ok(meta[c.artSet]);assert.ok(c.art>=0&&c.art<25);}
 assert.match(html,/300장 룬 카드 도감/);for(const kind of ['unit','tactic','artifact','oracle'])assert.ok(html.includes('data-filter="'+kind+'"'));assert.ok(html.includes('data-socket'));
 const compressed=gzipSync(await fs.readFile('dist/server/index.js'));assert.ok(compressed.length<10*1024*1024,'Worker must fit deployment size limit');
});
