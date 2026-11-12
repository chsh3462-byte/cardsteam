function setProfile(p){
 if(profile&&p.revision<profile.revision)return;profile=p;
 if(currentDeck().some(id=>!p.owned.includes(id))){selectedPreset='starter';remember('hexrune3-preset',selectedPreset);}
 $('packCount').textContent=p.packs.length;
 const level=p.level;$('profilePanel').innerHTML=`<div class="profile-emblem">${level.level}<small>LEVEL</small></div><div class="profile-progress"><span class="eyebrow">THE CONTRACT ARCHIVE</span><strong>룬 수집가 <span>${p.owned.length} / 300</span></strong><div class="xp-track"><i style="width:${level.current/level.needed*100}%"></i></div><small>${level.current} / ${level.needed} XP · 완료한 결투 ${p.matches}회</small></div><div class="point-wallet"><strong>${p.points}<small> POINTS</small></strong><span>결투 완료마다 +1</span></div><button id="profilePacks" class="primary">팩 보관함 <b>${p.packs.length}</b> →</button><button id="profileShop" class="secondary">팩 상점</button>`;
 $('profilePacks').onclick=()=>openPackHub('inventory');$('profileShop').onclick=()=>openPackHub('shop');presets();
}
async function loadProfile(){try{setProfile((await request('/profile')).profile);return true;}catch(e){if(e.status===401&&e.signInPath){profile=null;$('profilePanel').innerHTML='<div class="profile-progress"><span class="eyebrow">WELCOME, SUMMONER</span><strong>로그인하고 친구와 결투하세요</strong><p>카드 수집·포인트·보상을 내 계정에 저장합니다. 처음이라면 기본 덱과 3장 팩을 드립니다.</p></div><a id="signInBtn" class="primary sign-in-button" href="/signin-with-chatgpt" target="_top">ChatGPT 계정으로 로그인 →</a>';$('signInBtn').onclick=()=>{const code=parseRoomAddress($('roomInput').value,location.origin);if(code)try{sessionStorage.setItem('hexrune4-pending-invite',JSON.stringify({code,until:Date.now()+86400000}));}catch{}};return false;}$('profilePanel').innerHTML=`<div><strong>수집 정보를 불러오지 못했습니다.</strong><p>${escapeHTML(e.message)}</p></div><button id="retryProfile" class="secondary">다시 연결</button>`;$('retryProfile').onclick=loadProfile;return false;}}
function packVisual(type){const p=PACK_TYPES[type];return `<div class="pack-shell pack-${type}" style="--pack-color:${p.color}"><div class="pack-seal"></div><small>HEX HAVOC</small><div class="pack-sigil"><span>✧</span></div><strong>${type==='starter'?'FIRST OATH':type==='normal'?'RUNE ARCHIVE':type==='rare'?'LUNAR RELIC':'CELESTIAL OATH'}</strong><span>${p.size} CARDS</span><div class="pack-bottom"></div></div>`;}
function oddsLine(p){return ['R','SR','SSR'].map(r=>`${r} ${p.odds[r]/100}%`).join(' · ');}
async function openPackHub(tab='inventory'){
 if(packBusy)return;if(!profile&&!(await loadProfile()))return;
 showModal('계약의 보관함','COLLECT · REVEAL · AWAKEN','packs');renderPackHub(tab);
}
function renderPackHub(tab){
 const p=profile;$('modalBody').innerHTML=`<div class="pack-hub-top"><div class="pack-tabs"><button id="inventoryTab" class="${tab==='inventory'?'primary':'secondary'}">내 팩 ${p.packs.length}</button><button id="shopTab" class="${tab==='shop'?'primary':'secondary'}">포인트 상점</button><button id="historyTab" class="${tab==='history'?'primary':'secondary'}">개봉 기록</button></div><strong>${p.points} <small>POINTS</small></strong></div><p class="pack-explainer">기본 12종으로 24장 덱을 지급합니다. 시작 팩은 3장, 결투 보상·상점 팩은 5장입니다.<br>중복 카드 → R <b>10 XP</b> · SR <b>40 XP</b> · SSR <b>200 XP</b>. 수집한 카드는 덱에 최대 2장 사용할 수 있습니다.</p><div id="packHubContent"></div>`;
 $('inventoryTab').onclick=()=>renderPackHub('inventory');$('shopTab').onclick=()=>renderPackHub('shop');$('historyTab').onclick=()=>renderPackHub('history');
 const content=$('packHubContent');
 if(tab==='shop'){
  content.innerHTML='<div class="pack-shop">'+['normal','rare','epic'].map(type=>{const spec=PACK_TYPES[type];return `<article class="pack-product">${packVisual(type)}<h3>${spec.name}</h3><p>${spec.size}장 · 각 장 독립 추첨</p><div class="pack-odds">${oddsLine(spec)}</div><button class="primary" data-buy="${type}" ${p.points<spec.price?'disabled':''}>${spec.price} POINTS · 구매</button>${p.points<spec.price?`<small>${spec.price-p.points}포인트 더 필요합니다</small>`:'<small>구매 후 보관함에서 개봉</small>'}</article>`;}).join('')+'</div><p class="small-note">완료된 온라인 결투 한 판마다 승패와 관계없이 1포인트와 일반 팩 1개를 얻습니다. 기다리다 나간 방은 보상이 없습니다. 등급 확정·천장 없이 모든 카드는 표시된 확률로 추첨합니다.</p>';
  content.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>purchasePack(b.dataset.buy,b));
 }else if(tab==='history'){
  content.innerHTML=p.opened.length?'<div class="pack-history">'+p.opened.map((r,i)=>`<button class="history-row" data-history="${i}"><span>${PACK_TYPES[r.type].name}<small>${new Date(r.openedAt).toLocaleString('ko-KR')}</small></span><span>${r.cards.map(c=>`<b class="rarity-label rarity-${c.rarity}">${c.rarity}</b>`).join(' ')}</span><strong>+${r.xp} XP →</strong></button>`).join('')+'</div>':'<div class="empty-packs">아직 개봉한 팩이 없습니다.</div>';
  content.querySelectorAll('[data-history]').forEach(b=>b.onclick=()=>showPackReceipt(p.opened[+b.dataset.history],true));
 }else{
  content.innerHTML=p.packs.length?'<div class="pack-inventory">'+['starter','normal','rare','epic'].filter(t=>p.packs.some(x=>x.type===t)).map(type=>{const packs=p.packs.filter(x=>x.type===type),spec=PACK_TYPES[type];return `<article class="pack-product">${packVisual(type)}<h3>${spec.name} <span>×${packs.length}</span></h3><p>${spec.size}장 · ${type==='starter'?'첫 방문 선물':'결투 보상 / 상점 구매'}</p><div class="pack-odds">${oddsLine(spec)}</div><button class="primary" data-open-pack="${packs[0].id}">봉인 해제 →</button></article>`;}).join('')+'</div>':'<div class="empty-packs"><span>◇</span><h3>새로운 계약을 기다립니다</h3><p>온라인 결투를 완료하면 일반 팩 1개와 1포인트를 받습니다.</p><button id="emptyShop" class="secondary">상점 둘러보기</button></div>';
  content.querySelectorAll('[data-open-pack]').forEach(b=>b.onclick=()=>revealPack(b.dataset.openPack));if($('emptyShop'))$('emptyShop').onclick=()=>renderPackHub('shop');
 }
}
async function purchasePack(type,button){
 if(packBusy)return;packBusy=true;button.disabled=true;button.textContent='구매 처리 중…';
 pendingPurchase??={type,requestId:crypto.randomUUID(),revision:profile.revision};if(pendingPurchase.type!==type)pendingPurchase={type,requestId:crypto.randomUUID(),revision:profile.revision};
 try{const data=await request('/packs/buy','POST',pendingPurchase);setProfile(data.profile);pendingPurchase=null;toast(PACK_TYPES[type].name+'을 보관함에 넣었습니다.');sound('play');renderPackHub('inventory');}
 catch(e){toast(e.message);if(e.status)pendingPurchase=null;await loadProfile();renderPackHub('shop');}finally{packBusy=false;}
}
async function revealPack(packId){
 if(packBusy)return;const pack=profile.packs.find(p=>p.id===packId);if(!pack)return;packBusy=true;
 $('modalBody').innerHTML=`<div class="pack-opening">${packVisual(pack.type)}<h3>봉인에 마력을 주입합니다…</h3><p>서버에서 카드를 추첨하고 있습니다.</p></div>`;
 try{const data=await request('/packs/open','POST',{packId});setProfile(data.profile);$('modalBody').querySelector('.pack-opening').classList.add('unsealing');sound('roll');await delay(matchMedia('(prefers-reduced-motion: reduce)').matches?80:800);showPackReceipt(data.receipt);}
 catch(e){toast(e.message);await loadProfile();renderPackHub('inventory');}finally{packBusy=false;}
}
function showPackReceipt(receipt,history=false){
 modalMode='packReveal';$('modalTitle').textContent=PACK_TYPES[receipt.type].name+' · 개봉';
 $('modalBody').innerHTML=`<div class="reveal-heading"><span class="eyebrow">${history?'ARCHIVED CONTRACT':'THE SEAL IS BROKEN'}</span><h3>${history?'이미 수집한 계약의 기록':'카드를 눌러 운명을 확인하세요'}</h3><p>획득 결과는 이미 저장되었습니다. 창을 닫아도 카드는 사라지지 않습니다.</p></div><div class="pack-reveal-grid">${receipt.cards.map((entry,i)=>`<div class="pack-reveal-cell ${history?'revealed':''}" style="--reveal-delay:${i*85}ms"><button class="pack-card-back" data-reveal="${i}" ${history?'disabled':''} aria-label="${i+1}번째 카드 공개"><span>✧</span><b>REVEAL</b><small>${String(i+1).padStart(2,'0')}</small></button><div class="pack-card-front" ${history?'':'inert'}>${cardHTML(C[entry.id])}<span class="pull-result ${entry.duplicate?'duplicate':'new'}">${entry.duplicate?'중복 → +'+entry.xp+' XP':'NEW · 새로운 계약'}</span></div></div>`).join('')}</div><div class="pack-reveal-summary"><strong>+${receipt.xp} XP</strong><span>${receipt.levelAfter>receipt.levelBefore?'LEVEL UP · Lv.'+receipt.levelBefore+' → Lv.'+receipt.levelAfter:'현재 Lv.'+profile.level.level}</span><button id="revealAll" class="primary" ${history?'hidden':''}>모두 공개</button><button id="returnPacks" class="secondary">보관함으로</button></div>`;
 paintIcons($('modalBody'));const reveal=i=>{const cell=$('modalBody').querySelectorAll('.pack-reveal-cell')[i];if(!cell||cell.classList.contains('revealed'))return;cell.classList.add('revealed');cell.querySelector('.pack-card-front').removeAttribute('inert');cell.querySelector('.pack-card-back').disabled=true;const entry=receipt.cards[i];sound(entry.rarity==='SSR'?'win':entry.rarity==='SR'?'reaction':'draw');if(entry.rarity==='SSR'){cell.classList.add('ssr-reveal');burst(cell,'#f2c670',45);}if([...$('modalBody').querySelectorAll('.pack-reveal-cell')].every(x=>x.classList.contains('revealed')))$('revealAll').hidden=true;};
 $('modalBody').querySelectorAll('[data-reveal]').forEach(b=>b.onclick=()=>reveal(+b.dataset.reveal));$('modalBody').querySelectorAll('.pack-card-front .card').forEach(b=>b.onclick=()=>showCardDetail(C[b.dataset.card]));$('revealAll').onclick=()=>receipt.cards.forEach((_,i)=>reveal(i));$('returnPacks').onclick=()=>openPackHub('inventory');
}
$('packsBtn').onclick=()=>openPackHub();loadProfile();
