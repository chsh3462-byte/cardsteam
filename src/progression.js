import {CARD_DATABASE,CARD_BY_ID,STARTER_CARD_IDS} from './cards.js';
import {randomInt,validateDeck} from './core.js';
export const PACK_TYPES={
 starter:{name:'첫 계약 팩',size:3,price:0,odds:{R:9690,SR:300,SSR:10},color:'#9adfe3'},
 normal:{name:'일반 카드팩',size:5,price:10,odds:{R:9690,SR:300,SSR:10},color:'#9adfe3'},
 rare:{name:'레어 카드팩',size:5,price:50,odds:{R:8950,SR:1000,SSR:50},color:'#bb9cf5'},
 epic:{name:'에픽 카드팩',size:5,price:100,odds:{R:7300,SR:2500,SSR:200},color:'#f2c670'}
};
export const DUPLICATE_XP={R:10,SR:40,SSR:200};
export function levelProgress(xp){let level=1,remaining=xp;while(remaining>=level*100){remaining-=level*100;level++;}return {level,current:remaining,needed:level*100,total:xp};}
export function createProfile(now=Date.now()){return {schema:1,revision:0,owned:[...STARTER_CARD_IDS],points:0,xp:0,matches:0,packs:[{id:'starter',type:'starter',createdAt:now}],opened:[],purchases:[],rewards:{}};}
export function profileView(p){return {settings:p.settings||null,revision:p.revision,owned:p.owned,points:p.points,xp:p.xp,level:levelProgress(p.xp),matches:p.matches,packs:p.packs,opened:p.opened.slice(-12).reverse()};}
export function ownedDeck(ids,p){const deck=validateDeck(ids);if(deck.some(id=>!p.owned.includes(id)))throw Error('아직 수집하지 않은 카드가 덱에 있습니다. 기본 덱 또는 보유 카드로 구성하세요.');return deck;}
export function drawPack(type,rng=randomInt){const spec=PACK_TYPES[type];if(!spec)throw Error('알 수 없는 카드팩입니다.');return Array.from({length:spec.size},()=>{const roll=rng(10000),rarity=roll<spec.odds.R?'R':roll<spec.odds.R+spec.odds.SR?'SR':'SSR',pool=CARD_DATABASE.filter(c=>c.rarity===rarity);return pool[rng(pool.length)].id;});}
export function openPack(p,packId,rng=randomInt,now=Date.now()){
 const existing=p.opened.find(x=>x.packId===packId);if(existing)return existing;
 const i=p.packs.findIndex(x=>x.id===packId);if(i<0)throw Error('개봉할 팩이 없습니다. 보관함을 갱신해 주세요.');
 const pack=p.packs[i],before=levelProgress(p.xp).level;
 const cards=drawPack(pack.type,rng).map(id=>{const c=CARD_BY_ID[id],duplicate=p.owned.includes(id),xp=duplicate?DUPLICATE_XP[c.rarity]:0;if(!duplicate)p.owned.push(id);p.xp+=xp;return {id,rarity:c.rarity,duplicate,xp};});
 p.packs.splice(i,1);const receipt={packId,type:pack.type,cards,xp:cards.reduce((n,c)=>n+c.xp,0),levelBefore:before,levelAfter:levelProgress(p.xp).level,openedAt:now};p.opened.push(receipt);if(p.opened.length>50)p.opened.shift();return receipt;
}
export function buyPack(p,type,requestId,revision,now=Date.now()){
 if(typeof requestId!=='string'||!/^[-a-zA-Z0-9]{16,64}$/.test(requestId))throw Error('구매 요청 번호가 올바르지 않습니다.');
 const existing=p.purchases.find(x=>x.requestId===requestId);if(existing){if(existing.type!==type)throw Error('이미 사용한 구매 요청 번호입니다.');return existing;}
 if(revision!==p.revision)throw Error('보관함이 변경되었습니다. 갱신 후 다시 구매하세요.');
 if(!['normal','rare','epic'].includes(type))throw Error('구매할 수 없는 팩입니다.');const spec=PACK_TYPES[type];
 if(p.points<spec.price)throw Error('포인트가 부족합니다. 완료한 결투마다 1포인트를 얻습니다.');
 p.points-=spec.price;const pack={id:'buy-'+requestId,type,createdAt:now};p.packs.push(pack);const receipt={requestId,type,packId:pack.id,price:spec.price};p.purchases.push(receipt);if(p.purchases.length>50)p.purchases.shift();return receipt;
}
export function rewardMatch(p,matchId,now=Date.now()){
 if(p.rewards[matchId])return p.rewards[matchId];
 const reward={matchId,points:1,packId:'match-'+matchId,type:'normal',at:now};p.points++;p.matches++;p.packs.push({id:reward.packId,type:'normal',createdAt:now});p.rewards[matchId]=reward;return reward;
}
