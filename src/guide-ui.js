function beginAttack(uid){
 if(!canAct())return;
 const u=mine().field.find(u=>u.uid===uid);if(!u)return;
 const reason=attackReason(room.state,room.seat,u);if(reason)return toast(reason);
 selected={kind:'unit',uid,id:u.id};diceCopy=null;targeting={kind:'attack',uid,side:'enemy'};closeModal();render();
 toast(theirs().field.length?'붉게 표시된 상대 계약수를 누르면 공격합니다.':'상대의 CORE 숫자를 누르면 공격합니다.');
}
function requestRoll(){
 if(!canAct()||room.state.phase!=='prepare')return;
 const summon=mine().hand.some(h=>C[h.id].category==='unit'&&C[h.id].cost<=mine().energy);
 if(!mine().field.length&&summon){
  showModal('계약수를 먼저 소환할까요?','준비 → 교전','roll-warning');
  $('modalBody').innerHTML='<div class="guide-warning"><h3>주사위를 굴리면 준비 단계가 끝납니다.</h3><p>지금 소환할 수 있는 계약수가 손패에 있습니다. 먼저 소환해야 이번 턴에 주사위를 장착할 수 있습니다.</p><p>굴린 뒤에는 계약수 소환과 예언 설치를 할 수 없습니다. 마도술과 소모 도구는 굴린 뒤에 사용합니다.</p><div class="guide-actions"><button id="backToSummon" class="primary">소환하러 돌아가기</button><button id="rollAnyway" class="secondary">그래도 굴리기</button></div></div>';
  $('backToSummon').onclick=()=>{closeModal();coachSelect(mine().hand.find(h=>C[h.id].category==='unit'&&C[h.id].cost<=mine().energy),'hand');};
  $('rollAnyway').onclick=()=>{closeModal();action({type:'roll'});};
 }else action({type:'roll'});
}
function coachSelect(h,kind){if(!h)return;selected={kind,id:h.id,uid:h.uid};targeting=null;diceCopy=null;render();if(innerWidth<=850)inspectMobile();else $('inspector').scrollIntoView?.({block:'nearest',behavior:'smooth'});}
function renderTurnCoach(){
 const s=room?.state,root=$('turnCoach');if(!s||!root)return;
 let title='',body='',label='',fn=null;const p=mine();
 if(s.status==='over'){title='결투가 끝났습니다';body='결과 창에서 포인트와 보상 팩을 확인하세요.';}
 else if(!online){title='서버에 다시 연결하고 있습니다';body='연결이 복구되면 행동할 수 있습니다. 진행 중인 방은 새로고침 후 이어갈 수 있습니다.';}
 else if(rolling||Date.now()<s.readyAt){title='마력석과 예언을 해결하는 중';body='다섯 눈금이 모두 멈추면 주사위 장착과 카드 사용이 열립니다.';}
 else if(busy){title='행동을 반영하는 중';body='잠시 기다려 주세요.';}
 else if(s.active!==room.seat){title='상대 차례 · 내 필드는 방어 중';body='장착한 눈금과 수호 자세는 유지됩니다. 다음 내 턴에는 주사위를 새로 굴려 다시 장착합니다.';}
 else if(targeting||diceCopy){title=diceCopy?'복사받을 주사위 선택':'마지막 단계 · 대상 선택';body=diceCopy?'처음 고른 주사위와 다른 미사용 주사위를 누르세요.':targeting.side==='own'?'효과를 받을 내 계약수를 누르세요.':targeting.kind==='attack'?(theirs().field.length?'붉게 표시된 상대 계약수를 누르세요. 수호 계약수가 있으면 먼저 공격해야 합니다.':'상단 상대 CORE 숫자를 누르면 공격합니다.'):'붉게 표시된 상대 계약수 또는, 허용된 경우 상대 CORE를 누르세요.';label='선택 취소';fn=()=>{targeting=null;diceCopy=null;render();};}
 else if(s.phase==='draw'){title='1 · 카드 한 장 뽑기';body='덱을 누르고 섞인 카드 뒷면 하나를 골라 주세요. 한 턴의 기본 드로우는 한 장입니다.';label='카드 뽑기';fn=openDraw;}
 else if(s.phase==='prepare'){
  title='2 · 먼저 소환하고 예언을 준비하세요';body='손패 선택 → 소환/설치 버튼. 다 준비했다면 주사위를 굴리세요. 굴린 뒤에는 새 계약수를 소환할 수 없습니다.';
  const h=p.field.length<3&&p.hand.find(h=>C[h.id].category==='unit'&&C[h.id].cost<=p.energy);
  label=h?'소환할 카드 보기':'주사위 굴리기';fn=h?()=>coachSelect(h,'hand'):requestRoll;
 }else{
  const ready=p.field.find(u=>canUnitAttack(s,room.seat,u));
  const unbound=p.field.find(u=>!u.acted&&!u.slots[0]);
  const guard=p.field.find(u=>!u.acted&&u.slots[0]&&u.summonedTurn===s.turn&&u.stance==='strike');
  title='3 · 주사위를 장착하고 교전하세요';
  body='계약수 선택 → 미사용 주사위 → 주 슬롯 장착. 마도술은 손패에서 주사위를 고르고 발동하세요.';
  if(ready){body='공격하기 → 붉은 대상 선택. 공격 자세 변경만으로는 공격하지 않습니다. 각 계약수는 한 턴에 한 번 공격합니다.';label='공격 가능한 카드';fn=()=>coachSelect(ready,'unit');}
  else if(unbound&&p.dice.some(d=>dieCanUse(d))){label='주사위 장착하기';fn=()=>coachSelect(unbound,'unit');}
  else if(guard){body='방금 소환한 일반 계약수는 다음 내 턴부터 공격합니다. 지금은 수호 자세로 바꿔 방어하세요.';label='수호 자세 설정';fn=()=>coachSelect(guard,'unit');}
  else{body+=' 더 할 행동이 없다면 턴 종료를 누르세요.';}
 }
 root.innerHTML=`<div><span class="eyebrow">NEXT ACTION</span><strong>${escapeHTML(title)}</strong><p>${escapeHTML(body)}</p></div><div class="coach-buttons">${label?'<button class="secondary" data-coach-action>'+escapeHTML(label)+'</button>':''}<button class="text-btn" data-coach-help>플레이 방법</button></div>`;
 root.querySelector('[data-coach-action]')?.addEventListener('click',fn);root.querySelector('[data-coach-help]').onclick=openGuide;
}
function openGuide(){
 if(drawBusy||packBusy||authBusy)return;
 showModal('한 장씩, 다섯 주사위로','NAL-MUK-CARD · 플레이 방법','guide');
 $('modalBody').innerHTML=`<div class="play-guide">
 <div class="guide-hero"><div><span class="eyebrow">처음에는 이 순서만 기억하세요</span><h3>뽑기 → 소환 → 굴림<br>→ 장착 → 교전 → 턴 종료</h3><p>상대의 핵(CORE) 100을 먼저 0으로 만들면 승리합니다.<br>카드를 내는 에너지와, 효과를 증폭하는 주사위는 서로 다른 자원입니다.</p></div><button id="guidePractice" class="primary" ${room?.status==='playing'?'disabled':''}>2턴 따라 해보기 →</button></div>
 ${room?.status==='playing'?'<p class="guide-note">실제 결투 중에는 아래 설명을 보세요. 따라 해보기는 결투가 끝난 뒤 로비에서 열 수 있습니다.</p>':'<p class="guide-note">연습은 로그인 없이 가능하며 계정·온라인 대전·보상에 영향을 주지 않습니다.</p>'}
 <ol class="guide-steps">
 <li><b>카드를 한 장 뽑습니다</b><p>내 턴이 오면 <strong>카드 한 장 뽑기</strong> 또는 덱을 누르세요. 섞인 뒷면 하나 선택 → <strong>필드로 가져가기</strong>. 처음에는 손패 4장으로 시작하며, 턴마다 한 장을 추가로 뽑습니다. 손패가 8장이면 새 카드는 소멸합니다.</p></li>
 <li><b>주사위를 굴리기 전에 소환합니다</b><p>손패의 계약수를 누르고 <strong>계약수 소환</strong>을 누르세요. 비용만큼 에너지가 줄고 빈 마법진에 들어갑니다. 계약수는 최대 3장, 예언은 최대 2장입니다. 비전 룬도 이 단계에서 설치하세요.</p><p class="guide-note">주사위를 굴리면 준비 단계로 돌아갈 수 없습니다. 새 계약수와 예언은 다음 내 턴까지 기다려야 합니다.</p></li>
 <li><b>마력석 5개를 굴립니다</b><p><strong>마력석 5개 굴리기</strong>를 누르면 슬롯머신처럼 하나씩 멈춥니다. 첫 굴림은 무료입니다. 눈금이 마음에 들지 않으면 미사용 주사위 아래의 <strong>리롤</strong>을 체크하고 다시 굴리세요. 기본 리롤은 턴당 1회이며 에너지 1을 소비합니다. 이미 장착하거나 소비한 주사위는 리롤할 수 없습니다.</p></li>
 <li><b>계약수의 주 슬롯에 장착합니다</b><p>필드의 내 계약수 선택 → 카드 설명 안의 <strong>미사용 주사위</strong> 선택 → <strong>주 슬롯에 장착</strong>. 화면 중앙의 주사위를 먼저 고른 뒤 필드의 ‘주 ＋’를 눌러도 됩니다. 공격하기 전에는 채워진 슬롯을 눌러 해제하고 다른 카드에 옮길 수 있습니다.</p><div class="guide-equation">기본 위력 4 × 주 눈금 5 = 전투력 20</div><p>보조 슬롯은 각성 조건을 맞추는 용도입니다. 주·보조 눈금을 합산하지 않으며, 같은 눈금 페어도 전체 카드에 공통 배수를 주지 않습니다.</p></li>
 <li><b>공격하기 또는 수호를 선택합니다</b><p><strong>이번 턴에 소환한 일반 계약수는 바로 공격하지 못합니다.</strong> 지금은 주사위를 달고 <strong>수호 자세로 바꾸기</strong>로 방어하세요. 다음 내 턴에 새 주사위를 장착하고 공격 자세로 바꾸면 <strong>공격하기</strong>가 열립니다. 예외로 ‘속공’ 효과가 있는 계약수는 각성 시 즉시 공격합니다.</p><p><strong>공격하기 → 붉게 표시된 상대 계약수</strong>를 누르면 실행됩니다. 상대 필드가 비었을 때는 상단 <strong>상대 CORE 숫자</strong>를 누르세요. 계약수 한 장당 턴에 한 번 공격할 수 있으며, 공격 후에는 주사위와 자세를 바꿀 수 없습니다.</p></li>
 <li><b>마도술을 쓰고 턴을 넘깁니다</b><p>손패의 마도술 선택 → 설명 안에서 <strong>미사용 주사위</strong> 선택 → <strong>카드 발동</strong> → 표시된 대상 선택. 대상이 필요 없는 회복 등은 바로 발동합니다. 소비형 주사위는 회색으로 표시되어 다시 쓸 수 없습니다. 행동을 마쳤다면 <strong>턴 종료</strong>를 누르세요.</p><p>내 장착 주사위는 상대 턴 동안 유지되며, 다음 내 턴 시작에 초기화됩니다. 에너지는 처음 4에서 두 턴마다 1씩 증가해 최대 8까지 충전됩니다. 남은 에너지가 다음 턴에 합산되는 방식은 아닙니다.</p></li>
 </ol>
 <details open><summary>카드 네 종류 · 언제 사용하나요?</summary><div class="guide-types"><article><b>계약수 · 150종</b><p>준비 단계에 소환. 주 슬롯의 눈금으로 교전하며, 카드의 안정도가 0이 되면 소멸합니다.</p></article><article><b>마도술 · 50종</b><p>굴린 뒤 발동. 주사위 하나를 소비하여 피해·회복·상태 효과를 만듭니다. 대상과 효과는 카드 설명을 확인하세요.</p></article><article><b>연금 도구 · 60종</b><p>영구 유물은 2장까지 장착. 주사위를 쓰지 않는 도구는 준비/교전 모두 가능하며, 눈금을 조작하거나 소비하는 도구는 굴린 뒤 사용합니다.</p></article><article><b>비전 룬 · 40종</b><p>준비 단계에 뒷면 설치. 자신/상대의 굴림이나 리롤이 조건을 만족하면 자동 발동 후 소멸합니다. 공격 선언 자체에는 반응하지 않습니다.</p></article></div></details>
 <details><summary>각성, 수호, 반격은 어떻게 계산하나요?</summary><p>각성 조건은 카드마다 짝수 / 홀수 / 5 이상 / 6 / 같은 눈금 2개 중 하나입니다. ‘같은 눈금 2개’만 주·보조 두 슬롯이 필요하며, 나머지는 주 슬롯을 봅니다. 각성하면 기본 위력 +2(최대 10)와 카드의 고유 효과를 얻습니다. 조건을 잃으면 각성도 풀립니다.</p><p>공격 자세인 상대에게는 전투력만큼 피해를 주지만, 상대 전투력의 절반(버림)을 반격으로 받습니다. 수호 자세인 상대에게는 상대 전투력만큼 피해가 감소하고, 일반 반격은 없습니다. 카드 고유 효과가 추가될 수 있습니다.</p><div class="guide-equation">내 전투력 20 − 상대 수호 12 = 상대 안정도 피해 8</div><p>주사위를 장착한 수호 계약수가 있으면 일반 공격은 그 계약수를 먼저 대상으로 삼아야 합니다. 마도술은 카드에 적힌 대상 규칙을 따릅니다. 핵의 ‘보호’ 수치도 핵에 들어오는 피해를 먼저 흡수합니다.</p></details>
 <details><summary>버튼이 안 눌릴 때 확인할 것</summary><ul><li><strong>소환 버튼:</strong> 드로우를 마쳤는지, 아직 굴리기 전인지, 에너지와 빈 마법진이 있는지 확인하세요.</li><li><strong>공격 버튼:</strong> 주 슬롯 장착, 공격 자세, 소환 대기/빙결 해제, 이번 턴 미공격 상태가 필요합니다. ‘자세: 공격’은 자세 전환 버튼입니다.</li><li><strong>카드 발동:</strong> 카드 설명 안에서 사용할 주사위를 선택하세요. 장착됨·소비됨은 일반 카드에 사용할 수 없습니다. 복구 도구만 소비된 주사위를 고릅니다.</li><li><strong>발동을 눌렀는데 멈춘 것 같다면:</strong> 대상 선택 중인지 위의 ‘다음 행동’ 안내를 보세요. 붉은 상대나 아군 대상을 눌러야 완료됩니다.</li><li><strong>눈금 복사:</strong> 원본 주사위 선택 → 도구 발동 → 중앙에서 다른 미사용 주사위 선택 순서입니다.</li><li><strong>아무 행동도 안 된다면:</strong> 상대 차례이거나 주사위 애니메이션/서버 처리가 진행 중일 수 있습니다. 연결 안내와 토스트 메시지를 확인하세요.</li></ul></details>
 <details><summary>가입부터 친구와 대전하기 · 저장과 보상</summary><p>회원가입으로 나만의 가상 주소 <strong>아이디@NALMUK.COM</strong>을 만드세요. 실제 이메일을 받는 주소는 아닙니다. 복구 코드는 한 번만 표시되므로 보관하세요.</p><p>기본 카드 12종으로 24장 덱을 바로 쓸 수 있고, 시작 팩에는 랜덤 3장이 있습니다. 덱은 24장, 계약수 10장 이상, 같은 카드 최대 2장입니다. 방 만들기 → 초대 주소 복사 → 친구가 자기 계정으로 주소를 열고 입장하면 시작합니다. 같은 계정 두 개로 대전할 수 없습니다.</p><p>한 판 종료마다 1포인트와 일반 5장 팩을 받습니다. 상점 가격은 일반 10 / 레어 50 / 에픽 100포인트입니다. 이미 보유한 카드는 R 10 / SR 40 / SSR 200 경험치로 전환됩니다. 수집·포인트는 자동 저장되며, 이름·덱은 계정의 저장 버튼으로도 저장할 수 있습니다.</p></details>
 </div>`;
 $('guidePractice').onclick=startPractice;
}
let practice=null;
const PRACTICE_STEPS=[
 ['내 첫 턴 · 카드 한 장','매 턴 덱에서 한 장을 뽑습니다. 연습에서는 뽑기 버튼이 카드 뒷면 하나를 선택하는 동작까지 진행합니다.','한 장 뽑기'],
 ['굴리기 전에 계약','손패의 서리뿔 사슴왕을 소환하세요. 비용 2를 내고, 필드의 빈 마법진에 배치합니다.','서리뿔 사슴왕 소환 · ◆2'],
 ['다섯 주사위 굴리기','이제 준비를 마치고 교전 단계로 갑니다. 연습용 눈금은 5·4·3·2·1로 고정됩니다. 실제 대전에서는 무작위입니다.','마력석 5개 굴리기'],
 ['주 슬롯에 눈금 5','주 슬롯에 5를 장착하면 기본 위력 2 × 눈금 5 = 전투력 10이 됩니다. 아래의 눈금 5를 눌러 장착하세요.','눈금 5를 눌러 장착'],
 ['공격이 안 되는 이유','이번 턴에 소환한 일반 계약수는 아직 공격할 수 없습니다. 수호 자세로 바꾸면 상대 턴에 전투력 10만큼 받는 피해를 줄일 수 있습니다.','수호 자세로 바꾸기'],
 ['턴 넘기기','주사위는 상대 턴 동안 유지됩니다. 연습 상대는 드로우 후 공격 없이 턴을 넘깁니다. 다음 내 턴에는 에너지가 5로 충전되고 주사위는 초기화됩니다.','턴 종료 → 상대 턴 진행'],
 ['다음 내 턴 · 다시 한 장','계약수는 필드에 남아 있습니다. 이번에는 공격할 수 있지만, 먼저 드로우와 굴림을 마쳐야 합니다.','한 장 뽑기'],
 ['새 주사위가 필요합니다','지난 턴의 장착 눈금은 사라졌습니다. 다시 굴려 새 주사위를 얻으세요.','마력석 5개 굴리기'],
 ['다시 주 슬롯 장착','아래 눈금 5를 눌러 주 슬롯에 장착하세요. 다음 턴에도 자동으로 장착되는 것은 아닙니다.','눈금 5를 눌러 장착'],
 ['수호에서 공격 자세로','수호 자세는 유지됩니다. 이제 공격 자세로 바꿉니다. 자세 변경만으로 공격이 실행되지는 않습니다.','공격 자세로 바꾸기'],
 ['공격 실행','실제 대전은 공격하기 → 붉은 대상 선택 순서입니다. 지금 상대 필드가 비어 있으니 상대 핵을 직접 공격할 수 있습니다. 아래 버튼으로 실행해 보세요.','상대 CORE 공격하기'],
 ['이제 첫 결투를 할 수 있습니다','주 슬롯 전투력 10으로 상대 핵에 피해를 줬습니다. 다른 눈금을 쓰거나 각성하면 위력이 달라집니다. 실제 대전에서도 위의 다음 행동 안내와 카드 설명을 따라가세요.','연습 다시 하기']
];
function startPractice(){if(room?.status==='playing')return toast('진행 중인 결투를 마친 뒤 연습할 수 있습니다.');practice=createPractice();showModal('처음 두 턴 따라 해보기','연습 · 고정 눈금 · 보상 없음','practice');renderPractice();}
function renderPractice(){
 const {state:s,step}=practice,p=s.players[0],u=p.field[0],[title,body,label]=PRACTICE_STEPS[step];
 $('modalBody').innerHTML=`<div class="practice"><div class="practice-progress" aria-label="연습 ${step+1}/12">${PRACTICE_STEPS.map((_,i)=>'<i class="'+(i<=step?'done':'')+'"></i>').join('')}</div><div class="practice-top"><span>STEP ${String(step+1).padStart(2,'0')} / 12</span><span>TURN ${s.turn} · ${step===11?'완료':s.phase==='draw'?'드로우':s.phase==='prepare'?'준비':'교전'}</span></div><h3>${title}</h3><p class="practice-instruction">${body}</p><div class="practice-board"><div class="practice-core"><span>상대 CORE</span><b>${s.players[1].hp}</b><small>상대 필드 비어 있음</small></div><div class="practice-card">${cardHTML(C[1])}<div class="practice-card-state">${u?(u.stance==='guard'?'수호 자세':'공격 자세')+' · '+unitPower(p,u)+' × '+(u.slots[0]?.face||0)+' = '+unitForce(p,u):'손패 · 소환 전'}</div></div><div class="practice-resources"><strong>내 에너지 ◆ ${p.energy}</strong><span>손패 ${p.hand.length}장</span><span>필드 ${p.field.length} / 3</span><span>내 CORE ${p.hp}</span></div></div><div class="practice-dice">${Array.from({length:5},(_,i)=>`<button data-practice-die="${i}" ${[3,8].includes(step)&&i===0?'':'disabled'} class="${[3,8].includes(step)&&i===0?'ready':''}"><canvas width="60" height="60"></canvas><small>${!p.dice.length?'미굴림':p.dice[i].bound!==null?'장착됨':'눈금 '+p.dice[i].face}</small></button>`).join('')}</div><div class="guide-actions"><button id="practiceNext" class="primary" ${[3,8].includes(step)?'disabled':''}>${label}</button><button id="practiceGuide" class="text-btn">전체 플레이 방법</button></div>${step===11?'<p class="guide-note">연습에는 팩·포인트 보상이 없고 온라인 기록에 저장되지 않습니다.</p>':''}</div>`;
 paintIcons($('modalBody'));$('modalBody').querySelectorAll('[data-practice-die]').forEach((b,i)=>{PixelRenderer.die(b.querySelector('canvas').getContext('2d'),p.dice[i]?.face||1,0,0,60);b.onclick=stepPractice;});
 $('practiceNext').onclick=step===11?startPractice:stepPractice;$('practiceGuide').onclick=openGuide;
}
function stepPractice(){if(modalMode!=='practice'||!practice)return;try{practice=advancePractice(practice);sound([3,8].includes(practice.step)?'roll':practice.step===11?'attack':'play');renderPractice();}catch(e){toast(e.message);}}
$('learnBtn').onclick=startPractice;$('battleHelpBtn').onclick=openGuide;
