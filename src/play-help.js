import {CARD_BY_ID as C} from './cards.js';
import {canUnitAttack,requiresBattle} from './core.js';
export function dieCanUse(d,mode='free'){return !!d&&d.bound===null&&(mode==='spent'?d.spent:!d.spent);}
export function cardPlayReason(s,seat,c,dieIndex){
 if(s.status!=='playing')return '종료된 결투입니다.';
 if(s.active!==seat)return '상대 차례입니다. 내 차례가 되면 사용할 수 있습니다.';
 const p=s.players[seat],q=s.players[1-seat];
 if(s.phase==='draw')return '먼저 덱에서 카드 한 장을 뽑으세요.';
 if(['unit','oracle'].includes(c.category)&&s.phase!=='prepare')return '이미 주사위를 굴렸습니다. 이 카드는 다음 내 턴의 준비 단계에 사용하세요.';
 if(requiresBattle(c)&&s.phase!=='battle')return '주사위를 굴린 뒤 사용할 수 있습니다. 계약수를 먼저 소환하고 굴리세요.';
 if(c.cost>p.energy)return `에너지 부족: 필요 ${c.cost}, 현재 ${p.energy}. 다음 내 턴에 충전됩니다.`;
 if(c.category==='unit'&&p.field.length>=3)return '계약수는 최대 3장입니다. 빈 마법진이 필요합니다.';
 if(c.category==='oracle'&&p.oracles.length>=2)return '예언은 최대 2장입니다. 기존 예언을 해제하면 새로 설치할 수 있습니다.';
 if(c.equipment&&p.gear.length>=2)return '유물은 최대 2장입니다. 기존 유물을 해제하세요.';
 if(c.target==='own'&&!p.field.length)return '효과를 받을 내 계약수가 없습니다.';
 if(c.target==='enemy'&&!q.field.length)return '효과를 받을 상대 계약수가 없습니다.';
 if(['recall','salvage'].includes(c.effectType)&&p.hand.length>=8)return '계약수를 회수하려면 먼저 다른 카드를 사용해 손패 공간을 만드세요.';
 if(['recall','salvage'].includes(c.effectType)&&!p.discard.some(id=>C[id]?.category==='unit'))return '되살릴 계약수가 소멸 더미에 없습니다.';
 if(c.diceMode!=='none'){
  const mode=c.diceMode==='spent'?'spent':'free';
  if(!p.dice.some(d=>dieCanUse(d,mode)))return mode==='spent'?'이미 소비된 주사위가 있어야 복구할 수 있습니다.':'사용할 주사위가 없습니다. 공격 전이라면 카드의 장착 주사위를 해제할 수 있습니다.';
  if(!dieCanUse(p.dice[dieIndex],mode))return mode==='spent'?'아래에서 소비된 주사위 하나를 선택하세요.':'아래에서 미사용 주사위 하나를 선택하세요.';
  if(c.effectType==='twin'&&p.dice.filter(d=>dieCanUse(d)).length<2)return '눈금을 복사하려면 서로 다른 미사용 주사위 2개가 필요합니다.';
 }
 return '';
}
export function attackReason(s,seat,u){
 if(s.status!=='playing')return '종료된 결투입니다.';
 if(s.active!==seat)return '상대 차례입니다.';
 if(s.phase!=='battle')return '이번 턴의 주사위를 먼저 굴리세요.';
 if(u.acted)return '이 계약수는 이번 턴에 이미 공격했습니다.';
 if(u.stance==='guard')return '현재 수호 자세입니다. 공격 자세로 바꾼 뒤 공격하세요.';
 if(!u.slots[0])return '주사위 하나를 주 슬롯에 장착하세요. 보조 슬롯만으로는 공격할 수 없습니다.';
 if(!canUnitAttack(s,seat,u))return u.summonedTurn===s.turn?'이번 턴에 소환했습니다. 일반 계약수는 다음 내 턴부터 공격합니다. 지금은 수호로 방어할 수 있습니다.':'빙결로 이번 턴 공격할 수 없습니다. 다음 내 턴을 기다리거나 해제 효과를 사용하세요.';
 return '';
}
