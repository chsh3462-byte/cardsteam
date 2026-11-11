import {CARD_DATABASE,CARD_BY_ID as C,STARTER_DECK} from './cards.js';
export {CARD_DATABASE};
export const RULESET='rune-contract-v3';
export const PRESETS=[
 {id:'starter',name:'첫 계약의 수호단',subtitle:'기본 지급 · 12종 / 24장 · 즉시 대전',color:'#e8c47d',cards:STARTER_DECK},
 {id:'frost',name:'서리 룬 수호단',subtitle:'계약수 · 수호 · 짝수 각성',color:'#8cdde8',cards:[1,2,3,4,5,7,8,10,151,166,201,265].flatMap(x=>[x,x])},
 {id:'ember',name:'홍련의 용병단',subtitle:'돌파 · 화염 · 최고 눈금',color:'#f0a16e',cards:[26,27,28,29,30,31,33,35,152,156,206,273].flatMap(x=>[x,x])},
 {id:'grove',name:'세계수 계약회',subtitle:'재생 · 회복 · 쌍눈금',color:'#9ee2a5',cards:[51,52,53,54,55,57,59,60,167,176,226,269].flatMap(x=>[x,x])},
 {id:'astral',name:'별무리 예언단',subtitle:'주사위 조작 · 예언 · 공명',color:'#c9aceb',cards:[126,127,128,129,130,132,134,135,186,216,261,297].flatMap(x=>[x,x])}
];
export function randomInt(n){const a=new Uint32Array(1),limit=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%n;}
export function shuffle(deck,rng=randomInt){const a=[...deck];for(let i=a.length-1;i>0;i--){const j=rng(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function validateDeck(ids){if(!Array.isArray(ids)||ids.length!==24)throw Error('덱은 정확히 24장이어야 합니다.');const counts={};for(const id of ids){if(!Number.isInteger(id)||!C[id])throw Error('존재하지 않는 카드입니다.');if((counts[id]=(counts[id]||0)+1)>2)throw Error('같은 카드는 최대 2장입니다.');}if(ids.filter(id=>C[id].category==='unit').length<10)throw Error('계약수를 10장 이상 넣어 주세요.');return [...ids];}
function newPlayer(name,deck,rng){return {name,hp:100,shield:0,energy:4,maxEnergy:4,deck:shuffle(validateDeck(deck),rng),hand:[],field:[],oracles:[],gear:[],discard:[],dice:[],fatigue:0,tempPower:0,nextSix:false};}
function event(s,type,text,extra={}){const e={eid:s.seq++,type,text,at:Date.now(),...extra};s.events.push(e);s.events=s.events.slice(-32);return e;}
export function createGame(a,b,rng=randomInt){const s={ruleset:RULESET,status:'playing',turn:1,active:rng(2),phase:'draw',players:[newPlayer(a.name,a.deck,rng),newPlayer(b.name,b.deck,rng)],dice:[],rerolls:1,seq:1,events:[],winner:null,readyAt:0};for(let seat=0;seat<2;seat++)for(let i=0;i<4;i++)draw(s,seat);event(s,'start','룬 계약 결투가 시작되었습니다.');return s;}
function draw(s,seat,pick=0){const p=s.players[seat];if(!p.deck.length){p.fatigue++;p.hp=Math.max(0,p.hp-p.fatigue);event(s,'fatigue',p.name+' · 덱 소진 피해 '+p.fatigue);return;}const id=p.deck.splice(Math.min(pick,p.deck.length-1),1)[0];if(p.hand.length>=8){p.discard.push(id);event(s,'burn',p.name+' · 손패 초과로 '+C[id].name+' 소멸');}else p.hand.push({uid:s.seq++,id});}
function heal(s,seat,n){const p=s.players[seat];if(p.hp>0)p.hp=Math.min(100,p.hp+n);}
function hitCore(s,seat,n){const p=s.players[seat],blocked=Math.min(p.shield,n);p.shield-=blocked;const damage=Math.min(p.hp,Math.max(0,n-blocked));p.hp-=damage;return damage;}
function finish(s){const dead=s.players.map(p=>p.hp<=0);if(dead.some(Boolean)&&s.status!=='over'){s.status='over';s.phase='over';s.winner=dead[0]&&dead[1]?-1:dead[0]?1:0;event(s,'finish',s.winner<0?'무승부':s.players[s.winner].name+' 승리');}}
export function isAwake(u){const c=C[u.id],a=u.slots?.[0]?.face,b=u.slots?.[1]?.face;if(!a)return false;return c.overclock==='even'?a%2===0:c.overclock==='high'?a>=5:c.overclock==='pair'?a===b:c.overclock==='odd'?a%2===1:a===6;}
export function unitPower(p,u){let power=u.power+(p.tempPower||0)+(isAwake(u)?2:0);if(u.stance==='guard'){power+=p.gear.filter(g=>C[g.id].effectType==='guardgear').reduce((n,g)=>n+C[g.id].value,0);if(isAwake(u)&&C[u.id].effectType==='bulwark')power+=2;}return Math.max(1,Math.min(10,power));}
export function unitForce(p,u){return unitPower(p,u)*(u.slots?.[0]?.face||0);}
export function canUnitAttack(s,seat,u){return s.status==='playing'&&s.active===seat&&s.phase==='battle'&&u.stance==='strike'&&!!u.slots?.[0]&&!u.acted&&(u.ready||(u.summonedTurn===s.turn&&isAwake(u)&&C[u.id].effectType==='haste'));}
export function cardTarget(c){return c?.target||null;}
export function requiresBattle(c){return c.category==='tactic'||(c.category==='artifact'&&c.diceMode!=='none');}
function unit(s,h){const c=C[h.id];return {...h,power:c.basePower,hp:c.hp,maxHp:c.hp,slots:[null,null],stance:'strike',ready:false,acted:false,frozen:0,reborn:false,summonedTurn:s.turn};}
function clearUnitDice(p,u,spent=true){for(const slot of u.slots||[]){if(!slot)continue;const d=p.dice[slot.index];if(d?.bound===u.uid){d.bound=null;d.spent=spent;}}u.slots=[null,null];}
function cleanup(s){for(let seat=0;seat<2;seat++){const p=s.players[seat];for(const u of p.field){if(u.hp<=0&&isAwake(u)&&C[u.id].effectType==='rebirth'&&!u.reborn){u.hp=1;u.reborn=true;u.ready=false;u.acted=true;event(s,'revive',C[u.id].name+' · 룬 재생',{cardId:u.id,seat});}}const dead=p.field.filter(u=>u.hp<=0);p.field=p.field.filter(u=>u.hp>0);for(const u of dead){const echo=isAwake(u)&&C[u.id].effectType==='echo';clearUnitDice(p,u);p.discard.push(u.id);if(echo)draw(s,seat);}}finish(s);}
function freeDie(p,index,mode='free'){if(!Number.isInteger(index)||index<0||index>=p.dice.length)throw Error('사용할 주사위를 먼저 선택하세요.');const d=p.dice[index];if(d.bound!==null)throw Error('계약수에 장착된 주사위입니다. 먼저 해제하세요.');if(mode==='spent'?!d.spent:d.spent)throw Error(mode==='spent'?'이미 소비한 주사위를 선택하세요.':'이미 소비한 주사위입니다.');return d;}
function latestUnit(p){return p.discard.findLastIndex(id=>C[id].category==='unit');}
export function oracleMatches(trigger,roller,owner,faces){const own=roller===owner,counts={};faces.forEach(f=>counts[f]=(counts[f]||0)+1);const pair=Object.values(counts).some(n=>n>=2),sum=faces.reduce((a,b)=>a+b,0);switch(trigger){case 'enemySix':return !own&&faces.includes(6);case 'ownPair':return own&&pair;case 'ownSum18':return own&&sum>=18;case 'ownEven3':return own&&faces.filter(n=>n%2===0).length>=3;case 'enemyOdd3':return !own&&faces.filter(n=>n%2).length>=3;case 'ownSum10':return own&&sum>=10;case 'enemyPair':return !own&&pair;case 'ownSix':return own&&faces.includes(6);case 'ownDistinct':return own&&new Set(faces).size===5;default:return false;}}
function resolveOracles(s,roller,rolledFaces){const peak=Math.max(...rolledFaces);for(const owner of [1-roller,roller]){const p=s.players[owner],enemy=s.players[1-owner];const firing=p.oracles.filter(h=>oracleMatches(C[h.id].trigger,roller,owner,rolledFaces));for(const h of firing){p.oracles=p.oracles.filter(x=>x.uid!==h.uid);p.discard.push(h.id);const c=C[h.id];event(s,'oracle',p.name+' · '+c.name,{seat:owner,cardId:c.id,trigger:c.trigger});switch(c.effectType){case 'steal':{const d=s.players[roller].dice.find(d=>d.face===6&&!d.bound&&!d.spent);if(d)d.face=1;p.nextSix=true;p.shield+=c.value;break;}case 'barrier':p.shield+=c.value*peak;break;case 'mend':heal(s,owner,c.value*peak);break;case 'smite':hitCore(s,1-owner,c.value*6);break;case 'insight':draw(s,owner);p.energy=Math.min(10,p.energy+1);p.shield+=c.value;break;case 'jam':{const d=s.players[roller].dice.filter(d=>d.bound===null&&!d.spent).sort((a,b)=>b.face-a.face)[0];if(d)d.face=Math.max(1,d.face-c.value);break;}case 'focus':p.tempPower=Math.min(4,p.tempPower+c.value);break;case 'tax':enemy.energy=Math.max(0,enemy.energy-c.value);heal(s,owner,c.value);break;case 'revive':{const i=latestUnit(p);if(i>=0&&p.field.length<3){const id=p.discard.splice(i,1)[0];p.field.push(unit(s,{uid:s.seq++,id}));}else heal(s,owner,c.value*6);break;}case 'nova':enemy.field.forEach(u=>u.hp-=c.value*peak);break;}}}cleanup(s);}
function roll(s,seat,indices,rng,now){const p=s.players[seat],floor=Math.max(1,...p.gear.filter(h=>C[h.id].effectType==='floor').map(h=>C[h.id].value));indices.forEach(i=>p.dice[i].face=Math.max(floor,rng(6)+1));if(p.nextSix&&indices.length){p.dice[indices[0]].face=6;p.nextSix=false;}const faces=p.dice.map(d=>d.face);s.readyAt=now+2600;const e=event(s,'roll',p.name+' · 마력석 굴림 '+faces.join(' · '),{seat,faces,indices,rollUntil:s.readyAt});resolveOracles(s,seat,faces);e.finalFaces=p.dice.map(d=>d.face);}
export function applyAction(source,seat,a,rng=randomInt,now=Date.now()){
 const s=structuredClone(source);if(s.ruleset!==RULESET)throw Error('새 규칙의 방을 만들어 주세요.');if(s.status!=='playing')throw Error('이미 종료된 결투입니다.');if(![0,1].includes(seat))throw Error('참가자만 행동할 수 있습니다.');const p=s.players[seat],enemy=s.players[1-seat];
 if(a.type==='concede'){s.status='over';s.phase='over';s.winner=1-seat;event(s,'finish',p.name+' 항복');return s;}
 if(seat!==s.active)throw Error('상대 차례입니다.');if(now<s.readyAt)throw Error('주사위와 예언이 해결될 때까지 기다려 주세요.');
 if(a.type==='draw'){
  if(s.phase!=='draw')throw Error('턴마다 기본 드로우는 한 번입니다.');if(!Number.isInteger(a.pick)||a.pick<0||a.pick>=Math.max(1,Math.min(3,p.deck.length)))throw Error('카드 뒷면 하나를 선택하세요.');draw(s,seat,a.pick);s.phase='prepare';event(s,'draw',p.name+' · 카드 한 장 드로우',{seat});finish(s);
 }else if(a.type==='roll'){
  if(s.phase!=='prepare')throw Error('준비 단계에서 굴릴 수 있습니다.');p.dice=Array.from({length:5},()=>({face:1,bound:null,spent:false}));s.phase='battle';roll(s,seat,[0,1,2,3,4],rng,now);
 }else if(a.type==='reroll'){
  if(s.phase!=='battle'||s.rerolls<1||p.energy<1)throw Error('리롤 기회와 에너지 1이 필요합니다.');if(!Array.isArray(a.indices)||!a.indices.length||a.indices.length>5||new Set(a.indices).size!==a.indices.length)throw Error('리롤할 주사위를 선택하세요.');a.indices.forEach(i=>freeDie(p,i));s.rerolls--;p.energy--;roll(s,seat,a.indices,rng,now);
 }else if(['bind','unbind','stance'].includes(a.type)){
  if(s.phase!=='battle')throw Error('주사위를 먼저 굴리세요.');const u=p.field.find(u=>u.uid===a.uid);if(!u)throw Error('아군 계약수를 선택하세요.');if(u.acted)throw Error('공격을 끝낸 계약수의 주사위와 자세는 바꿀 수 없습니다.');
  const before=isAwake(u);if(a.type==='stance'){if(!['strike','guard'].includes(a.stance))throw Error('공격 또는 수호 자세를 선택하세요.');u.stance=a.stance;}
  else{if(![0,1].includes(a.slot))throw Error('주 슬롯 또는 보조 슬롯을 선택하세요.');if(a.type==='bind'){if(u.slots[a.slot])throw Error('장착된 주사위를 먼저 해제하세요.');const d=freeDie(p,a.dieIndex);d.bound=u.uid;u.slots[a.slot]={index:a.dieIndex,face:d.face};}else{const slot=u.slots[a.slot];if(!slot)throw Error('빈 슬롯입니다.');p.dice[slot.index].bound=null;u.slots[a.slot]=null;}}
  if(!before&&isAwake(u))event(s,'awaken',C[u.id].awakenedName+' · 오버클럭',{seat,cardId:u.id,target:u.uid});
 }else if(a.type==='removeGear'||a.type==='removeOracle'){
  if(!['prepare','battle'].includes(s.phase))throw Error('드로우부터 마쳐 주세요.');const list=a.type==='removeGear'?p.gear:p.oracles;const i=list.findIndex(h=>h.uid===a.uid);if(i<0)throw Error('장착된 카드가 없습니다.');const h=list.splice(i,1)[0];p.discard.push(h.id);event(s,'remove',p.name+' · '+C[h.id].name+' 해제');
 }else if(a.type==='play'){
  if(!['prepare','battle'].includes(s.phase))throw Error('드로우부터 마쳐 주세요.');const index=p.hand.findIndex(h=>h.uid===a.uid);if(index<0)throw Error('손패에 없는 카드입니다.');const h=p.hand[index],c=C[h.id];if(c.cost>p.energy)throw Error('에너지가 부족합니다.');
  if(c.category==='unit'&&(s.phase!=='prepare'||p.field.length>=3))throw Error('준비 단계의 빈 마법진에 소환하세요.');
  if(c.category==='oracle'&&(s.phase!=='prepare'||p.oracles.length>=2))throw Error('준비 단계의 빈 예언 칸에 설치하세요.');
  if(c.equipment&&p.gear.length>=2)throw Error('유물 칸이 가득 찼습니다. 기존 유물을 해제하세요.');
  if(requiresBattle(c)&&s.phase!=='battle')throw Error('이 카드는 주사위를 굴린 뒤 사용하세요.');
  let target=null;const kind=cardTarget(c);if(kind==='own')target=p.field.find(u=>u.uid===a.target);if(kind==='enemy'||(kind==='enemyOrCore'&&a.target!=='core'))target=enemy.field.find(u=>u.uid===a.target);if(kind&&!(kind==='enemyOrCore'&&a.target==='core')&&!target)throw Error('효과를 받을 계약수를 선택하세요.');
  let die=null,face=1;if(c.diceMode!=='none'){die=freeDie(p,a.dieIndex,c.diceMode==='spent'?'spent':'free');face=die.face;}
  let second=null;if(c.effectType==='twin'&&c.category==='artifact'){if(a.targetDieIndex===a.dieIndex)throw Error('서로 다른 주사위 두 개를 선택하세요.');second=freeDie(p,a.targetDieIndex);}
  if(['recall','salvage'].includes(c.effectType)&&(p.hand.length>=8||latestUnit(p)<0))throw Error('손패 여유와 소멸한 계약수가 필요합니다.');
  p.energy-=c.cost;p.hand.splice(index,1);if(c.diceMode==='spend')die.spent=true;
  if(c.category==='unit'){p.field.push(unit(s,h));event(s,'play',p.name+' · '+c.name+' 계약',{cardId:c.id,seat});}
  else if(c.category==='oracle'){p.oracles.push(h);event(s,'set',p.name+' · 비전 룬 설치',{seat});}
  else if(c.equipment){p.gear.push(h);event(s,'play',p.name+' · '+c.name+' 장착',{cardId:c.id,seat});}
  else{
   p.discard.push(c.id);event(s,'play',p.name+' · '+c.name+(c.diceMode==='spend'?' ×'+face:''),{cardId:c.id,seat,target:a.target??null});
   const n=c.value*face;
   if(c.category==='tactic')switch(c.effectType){
    case 'strike':case 'bolt':if(target)target.hp-=n;else hitCore(s,1-seat,n);event(s,'hit',c.name+' · '+n+' 피해',{cardId:c.id,seat,target:a.target,damage:n});if(c.effectType==='bolt'&&face===6)draw(s,seat);break;
    case 'chill':target.hp-=n;if(face%2===0)target.frozen=1;break;
    case 'weaken':target.hp-=n;target.power=Math.max(1,target.power-1);break;
    case 'mend':heal(s,seat,n);break;
    case 'barrier':p.shield+=n;break;
    case 'recall':{const id=p.discard.splice(latestUnit(p),1)[0];p.hand.push({uid:s.seq++,id});heal(s,seat,n);break;}
    case 'dispel':clearUnitDice(enemy,target);target.hp-=n;break;
    case 'tune':target.power=Math.min(10,target.power+(face>=5?2:1));target.hp=Math.min(target.maxHp,target.hp+n);break;
    case 'sweep':enemy.field.forEach(u=>u.hp-=n);break;
   }
   else switch(c.effectType){
    case 'raise':die.face=Math.min(6,die.face+c.value);break;
    case 'reroll':s.rerolls=Math.min(3,s.rerolls+1);p.shield+=c.value;break;
    case 'twin':second.face=face;heal(s,seat,c.value);break;
    case 'invert':die.face=7-face;heal(s,seat,c.value);break;
    case 'reclaim':die.spent=false;die.face=c.value;break;
    case 'potion':heal(s,seat,n);break;
    case 'mana':p.energy=Math.min(10,p.energy+Math.min(c.value,face));break;
    case 'salvage':{const id=p.discard.splice(latestUnit(p),1)[0];p.hand.push({uid:s.seq++,id});p.shield+=n;break;}
    case 'cleanse':target.frozen=0;target.hp=Math.min(target.maxHp,target.hp+n);if(!target.acted&&target.summonedTurn!==s.turn)target.ready=true;break;
   }
  }cleanup(s);
 }else if(a.type==='attack'){
  const u=p.field.find(u=>u.uid===a.uid);if(!u||!canUnitAttack(s,seat,u))throw Error('주 마력석을 장착하고 공격 가능한 계약수를 선택하세요.');let target=null;
  if(a.target==='core'){if(enemy.field.length)throw Error('적 마법진부터 정리해야 핵을 직접 공격할 수 있습니다.');}
  else{target=enemy.field.find(u=>u.uid===a.target);if(!target)throw Error('공격할 계약수를 선택하세요.');if(enemy.field.some(u=>u.stance==='guard'&&u.slots[0])&&!(target.stance==='guard'&&target.slots[0]))throw Error('마력석을 장착한 수호 계약수를 먼저 공격하세요.');}
  const awake=isAwake(u),effect=C[u.id].effectType,face=u.slots[0].face;let power=unitPower(p,u);if(awake&&effect==='focus'&&target&&target.hp<target.maxHp)power=Math.min(10,power+1);const raw=power*face;u.acted=true;u.ready=false;let dealt=0;
  if(awake&&effect==='disrupt')enemy.shield=Math.max(0,enemy.shield-face);
  if(target){const defense=target.stance==='guard'?unitForce(enemy,target):0,ward=target.stance==='guard'&&isAwake(target)&&C[target.id].effectType==='guard'?2:0;const damage=Math.max(0,raw-defense-ward),overflow=Math.max(0,damage-target.hp);dealt=Math.min(target.hp,damage);target.hp-=damage;const counter=(target.stance==='strike'?Math.floor(unitForce(enemy,target)/2):0)+(isAwake(target)&&C[target.id].effectType==='thorns'?(target.slots[0]?.face||0):0);u.hp-=counter;if(awake&&effect==='pierce'&&overflow)hitCore(s,1-seat,overflow);if(awake&&effect==='freeze')target.frozen=1;event(s,'attack',C[u.id].name+' · '+power+' × '+face+' = '+raw+' / 수호 후 '+damage,{cardId:u.id,seat,source:u.uid,target:a.target,damage,counter});}
  else{dealt=hitCore(s,1-seat,raw);event(s,'attack',C[u.id].name+' · '+power+' × '+face+' = '+raw,{cardId:u.id,seat,source:u.uid,target:'core',damage:dealt});}
  if(awake){if(effect==='drain')heal(s,seat,Math.floor(dealt/2));if(effect==='gift')draw(s,seat);if(effect==='scorch')hitCore(s,1-seat,face);if(effect==='siphon')p.energy=Math.min(10,p.energy+1);}cleanup(s);
 }else if(a.type==='end'){
  if(!['prepare','battle'].includes(s.phase))throw Error('드로우부터 마쳐 주세요.');p.tempPower=0;s.active=1-seat;s.turn++;s.phase='draw';s.rerolls=1;s.readyAt=0;const next=s.players[s.active];const sum=next.field.reduce((v,u)=>v+(u.slots[0]?.face||0),0);for(const u of next.field)if(isAwake(u)&&C[u.id].effectType==='mend')heal(s,s.active,u.slots[0].face);for(const g of next.gear)if(C[g.id].effectType==='regengear')heal(s,s.active,Math.min(sum,C[g.id].value));next.tempPower=0;next.maxEnergy=Math.min(8,4+Math.floor((s.turn-1)/2));next.energy=next.maxEnergy;next.dice=[];next.field.forEach(u=>{u.ready=!u.frozen;if(u.frozen)u.frozen--;u.acted=false;u.slots=[null,null];});event(s,'turn',next.name+'의 차례',{seat:s.active});
 }else throw Error('지원하지 않는 행동입니다.');
 s.dice=s.players[s.active].dice.map(d=>d.face);finish(s);return s;
}
export function viewGame(s,seat){return {...s,players:s.players.map((p,i)=>({...p,deck:undefined,deckCount:p.deck.length,handCount:p.hand.length,hand:i===seat?p.hand:p.hand.map(h=>({uid:h.uid})),oracles:i===seat?p.oracles:p.oracles.map(h=>({uid:h.uid})),discardCount:p.discard.length}))};}
